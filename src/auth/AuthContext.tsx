import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  User as FirebaseUser,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User, UserRole, UserStatus } from '@shared/types/models';
import { auth, db, googleProvider, isFirebaseConfigured, browserPopupRedirectResolver } from '../config/firebase';
import { dataService } from '../services/dataService';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  firebaseUser: FirebaseUser | null;
  user: User | null;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInAsDemoUser: (email: string) => void;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapAuthError(error: unknown): string {
  if (!error) return 'Không thể đăng nhập bằng Google. Vui lòng thử lại.';

  const errObj = (typeof error === 'object' && error !== null ? error : {}) as {
    code?: string;
    message?: string;
  };
  const code = errObj.code || '';
  const message = errObj.message || '';

  const messages: Record<string, string> = {
    'auth/popup-closed-by-user': 'Bạn đã đóng cửa sổ đăng nhập Google trước khi hoàn tất.',
    'auth/cancelled-popup-request': 'Yêu cầu đăng nhập trước đó đã bị hủy. Vui lòng thử lại.',
    'auth/popup-blocked':
      'Trình duyệt hoặc khung xem trước đã chặn cửa sổ đăng nhập (popup). Vui lòng cấp quyền mở popup hoặc mở ứng dụng trong tab mới.',
    'auth/network-request-failed': 'Không thể kết nối đến máy chủ Google. Vui lòng kiểm tra kết nối mạng và thử lại.',
    'auth/unauthorized-domain':
      'Tên miền hiện tại chưa được cấp phép trong Firebase Authentication. Bạn có thể sử dụng đăng nhập nhanh tài khoản bên dưới.',
    'auth/operation-not-allowed': 'Đăng nhập Google chưa được kích hoạt trong Firebase Authentication.',
    'auth/user-disabled': 'Tài khoản Google này đã bị vô hiệu hóa trong hệ thống.',
    'auth/web-storage-unsupported':
      'Trình duyệt chặn lưu trữ bên thứ ba trong khung xem trước. Vui lòng mở ứng dụng trong tab mới hoặc chọn đăng nhập nhanh.',
    'auth/internal-error': 'Lỗi kết nối từ dịch vụ Google Authentication. Vui lòng thử lại.',
  };

  if (code && messages[code]) {
    return messages[code];
  }

  if (code) {
    return `Đăng nhập không thành công (${code}). ${message ? `Chi tiết: ${message}` : 'Vui lòng thử lại hoặc mở trong tab mới.'}`;
  }

  if (message) {
    return `Đăng nhập không thành công: ${message}`;
  }

  return 'Không thể đăng nhập bằng Google. Vui lòng thử lại hoặc mở ứng dụng trong tab mới.';
}

function validRole(value: unknown, isDesignatedAdmin: boolean): UserRole {
  if (isDesignatedAdmin) return 'ADMIN';
  return value === 'ADMIN' ? 'ADMIN' : 'MEMBER';
}

function validStatus(value: unknown): UserStatus {
  return value === 'DISABLED' || value === 'INVITED' || value === 'PENDING_APPROVAL' ? value : 'ACTIVE';
}

const DESIGNATED_ADMIN_EMAILS = ['duykhuong332@gmail.com', 'admin@company.com'];

async function syncUserProfile(firebaseUser: FirebaseUser): Promise<User> {
  if (!firebaseUser.email) throw new Error('Tài khoản Google không cung cấp địa chỉ email.');

  const isDesignatedAdmin = DESIGNATED_ADMIN_EMAILS.includes(firebaseUser.email.toLowerCase());
  const initialRole: UserRole = isDesignatedAdmin ? 'ADMIN' : 'MEMBER';

  const profileRef = doc(db, 'users', firebaseUser.uid);
  const now = new Date().toISOString();
  let existing: Record<string, unknown> | undefined;

  try {
    const snapshot = await getDoc(profileRef);
    existing = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : undefined;
  } catch (readErr) {
    console.warn('Could not read user profile from Firestore, using local fallback:', readErr);
  }

  try {
    if (existing) {
      await setDoc(
        profileRef,
        {
          email: firebaseUser.email,
          normalizedEmail: firebaseUser.email.toLowerCase(),
          displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
          photoURL: firebaseUser.photoURL || null,
          provider: 'google',
          role: isDesignatedAdmin ? 'ADMIN' : validRole(existing.role, false),
          status: validStatus(existing.status),
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
        role: initialRole,
        status: 'ACTIVE',
        createdAt: now,
        lastLoginAt: now,
        updatedAt: now,
      });
    }
  } catch (writeErr) {
    console.warn('Could not persist profile to Firestore:', writeErr);
  }

  return dataService.syncAuthenticatedUser({
    googleUid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
    photoURL: firebaseUser.photoURL || undefined,
    role: validRole(existing?.role, isDesignatedAdmin),
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

    // Safely set persistence without causing unhandled errors to block auth
    void (async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch {
        try {
          await setPersistence(auth, browserSessionPersistence);
        } catch {
          try {
            await setPersistence(auth, inMemoryPersistence);
          } catch {
            // Ignore persistence fallback error
          }
        }
      }
    })();

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
        console.warn('Firestore profile sync fallback:', syncError);
        const isDesignatedAdmin = DESIGNATED_ADMIN_EMAILS.includes(nextFirebaseUser.email?.toLowerCase() || '');
        const appUser = dataService.syncAuthenticatedUser({
          googleUid: nextFirebaseUser.uid,
          email: nextFirebaseUser.email || '',
          displayName: nextFirebaseUser.displayName || nextFirebaseUser.email?.split('@')[0] || 'Google User',
          photoURL: nextFirebaseUser.photoURL || undefined,
          role: isDesignatedAdmin ? 'ADMIN' : 'MEMBER',
          status: 'ACTIVE',
        });
        setUser(appUser);
        setError(null);
        setStatus('authenticated');
      }
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    if (!isFirebaseConfigured) {
      setError('Firebase chưa được cấu hình. Vui lòng kiểm tra lại cấu hình hệ thống.');
      return;
    }

    setStatus('loading');
    try {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch {
        try {
          await setPersistence(auth, browserSessionPersistence);
        } catch {
          // Ignore storage restriction and proceed to popup
        }
      }
      await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
    } catch (signInError: unknown) {
      console.warn('Firebase Google sign-in exception:', signInError);
      const errCode = (signInError as { code?: string })?.code || '';

      if (errCode === 'auth/popup-blocked') {
        if (typeof window !== 'undefined' && window.self === window.top) {
          try {
            await signInWithRedirect(auth, googleProvider);
            return;
          } catch (redirectErr) {
            setError(mapAuthError(redirectErr));
            setStatus(auth.currentUser ? 'authenticated' : 'unauthenticated');
            return;
          }
        }
      }

      setError(mapAuthError(signInError));
      setStatus(auth.currentUser ? 'authenticated' : 'unauthenticated');
    }
  }, []);

  const signInAsDemoUser = useCallback((email: string) => {
    setError(null);
    const users = dataService.getUsers();
    const targetUser = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() || u.normalizedEmail.toLowerCase() === email.toLowerCase()
    );
    if (!targetUser) {
      setError(`Không tìm thấy hồ sơ người dùng với email: ${email}`);
      return;
    }
    dataService.setCurrentUser(targetUser.uid);
    setUser(targetUser);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore
    }
    dataService.logout();
    setUser(null);
    setFirebaseUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      firebaseUser,
      user,
      error,
      signInWithGoogle,
      signInAsDemoUser,
      logout,
      clearError: () => setError(null),
    }),
    [status, firebaseUser, user, error, signInWithGoogle, signInAsDemoUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải được sử dụng bên trong AuthProvider.');
  return context;
}

