import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  User as FirebaseUser,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { User, UserRole, UserStatus } from '@shared/types/models';
import { auth, db, googleProvider, isFirebaseConfigured } from '../config/firebase';
import { dataService } from '../services/dataService';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  firebaseUser: FirebaseUser | null;
  user: User | null;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapAuthError(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return 'Không thể đăng nhập bằng Google. Vui lòng kiểm tra kết nối và thử lại.';
  }

  const messages: Record<string, string> = {
    'auth/popup-closed-by-user': 'Bạn đã đóng cửa sổ đăng nhập Google.',
    'auth/cancelled-popup-request': 'Yêu cầu đăng nhập trước đó đã bị hủy. Vui lòng thử lại.',
    'auth/popup-blocked': 'Trình duyệt đã chặn cửa sổ đăng nhập. Ứng dụng sẽ chuyển sang trang Google.',
    'auth/network-request-failed': 'Không thể kết nối đến Google. Vui lòng kiểm tra mạng và thử lại.',
    'auth/unauthorized-domain': 'Tên miền này chưa được cấp phép trong Firebase Authentication.',
    'auth/operation-not-allowed': 'Đăng nhập Google chưa được bật trong Firebase Console.',
    'auth/user-disabled': 'Tài khoản này đã bị vô hiệu hóa.',
  };

  return messages[error.code] || 'Không thể đăng nhập bằng Google. Vui lòng thử lại.';
}

function validRole(value: unknown): UserRole {
  return value === 'ADMIN' ? 'ADMIN' : 'MEMBER';
}

function validStatus(value: unknown): UserStatus {
  return value === 'DISABLED' || value === 'INVITED' || value === 'PENDING_APPROVAL' ? value : 'ACTIVE';
}

async function syncUserProfile(firebaseUser: FirebaseUser): Promise<User> {
  if (!firebaseUser.email) throw new Error('Tài khoản Google không cung cấp địa chỉ email.');

  const profileRef = doc(db, 'users', firebaseUser.uid);
  const snapshot = await getDoc(profileRef);
  const now = new Date().toISOString();
  const existing = snapshot.exists() ? snapshot.data() : undefined;

  if (existing) {
    await setDoc(
      profileRef,
      {
        email: firebaseUser.email,
        normalizedEmail: firebaseUser.email.toLowerCase(),
        displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        photoURL: firebaseUser.photoURL || null,
        provider: 'google',
        lastLoginAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  } else {
    await setDoc(profileRef, {
      uid: firebaseUser.uid,
      googleUid: firebaseUser.uid,
      email: firebaseUser.email,
      normalizedEmail: firebaseUser.email.toLowerCase(),
      displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
      photoURL: firebaseUser.photoURL || null,
      provider: 'google',
      role: 'MEMBER',
      status: 'ACTIVE',
      createdAt: now,
      lastLoginAt: now,
      updatedAt: now,
    });
  }

  return dataService.syncAuthenticatedUser({
    googleUid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
    photoURL: firebaseUser.photoURL || undefined,
    role: validRole(existing?.role),
    status: validStatus(existing?.status),
    createdAt: typeof existing?.createdAt === 'string' ? existing.createdAt : now,
    lastLoginAt: now,
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    auth.languageCode = 'vi';
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    void setPersistence(auth, browserLocalPersistence).catch(() => {
      setError('Không thể lưu phiên đăng nhập an toàn trên trình duyệt này.');
    });

    return onAuthStateChanged(auth, async (nextFirebaseUser) => {
      setStatus('loading');
      setFirebaseUser(nextFirebaseUser);
      if (!nextFirebaseUser) {
        dataService.logout();
        setUser(null);
        setStatus('unauthenticated');
        return;
      }

      try {
        const appUser = await syncUserProfile(nextFirebaseUser);
        setUser(appUser);
        setError(null);
        setStatus('authenticated');
      } catch (syncError) {
        dataService.logout();
        setUser(null);
        setError(
          syncError instanceof Error && syncError.message
            ? `Không thể đồng bộ hồ sơ người dùng: ${syncError.message}`
            : 'Không thể đồng bộ hồ sơ người dùng.'
        );
        await firebaseSignOut(auth).catch(() => undefined);
        setStatus('unauthenticated');
      }
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    if (!isFirebaseConfigured) {
      setError('Firebase chưa được cấu hình. Hãy bổ sung các biến VITE_FIREBASE_* trong tệp .env.local.');
      return;
    }

    setStatus('loading');
    try {
      await setPersistence(auth, browserLocalPersistence);
      const useRedirect = window.matchMedia('(max-width: 768px)').matches;
      if (useRedirect) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      await signInWithPopup(auth, googleProvider);
    } catch (signInError) {
      if (signInError instanceof FirebaseError && signInError.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      setError(mapAuthError(signInError));
      setStatus(auth.currentUser ? 'loading' : 'unauthenticated');
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    await firebaseSignOut(auth);
    dataService.logout();
    setUser(null);
    setFirebaseUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, firebaseUser, user, error, signInWithGoogle, logout, clearError: () => setError(null) }),
    [status, firebaseUser, user, error, signInWithGoogle, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải được sử dụng bên trong AuthProvider.');
  return context;
}
