import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  User as FirebaseUser,
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithCredential,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User, UserRole, UserStatus } from '@shared/types/models';
import { auth, db, googleProvider, isFirebaseConfigured, appletConfig } from '../config/firebase';
import { dataService } from '../services/dataService';

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  error_uri?: string;
};

type GooglePopupError = {
  type?: string;
  message?: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
            error_callback?: (error: GooglePopupError) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  firebaseUser: FirebaseUser | null;
  user: User | null;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DESIGNATED_ADMIN_EMAILS = ['duykhuong332@gmail.com', 'admin@company.com'];

function mapAuthError(error: unknown): string {
  if (!error) return 'Không thể đăng nhập bằng Google. Vui lòng thử lại.';

  const errObj = (typeof error === 'object' && error !== null ? error : {}) as {
    code?: string;
    message?: string;
  };
  const code = errObj.code || '';
  const message = errObj.message || '';

  const messages: Record<string, string> = {
    'oauth/access_denied':
      'Google chưa cho phép tài khoản này đăng nhập. Nếu ứng dụng OAuth đang ở chế độ Testing, hãy thêm Gmail này vào danh sách Test users hoặc chuyển OAuth consent screen sang Production.',
    'oauth/popup_failed_to_open':
      'Trình duyệt đã chặn cửa sổ đăng nhập Google. Vui lòng cho phép popup hoặc mở ứng dụng trong một tab trình duyệt độc lập.',
    'oauth/popup_closed': 'Bạn đã đóng cửa sổ đăng nhập Google trước khi hoàn tất.',
    'oauth/gis_unavailable':
      'Dịch vụ đăng nhập Google chưa tải được. Vui lòng tải lại trang hoặc mở ứng dụng trong tab mới rồi thử lại.',
    'oauth/client_not_configured':
      'OAuth Client ID chưa được cấu hình. Vui lòng kiểm tra firebase-applet-config.json và Google Cloud OAuth Client.',
    'auth/account-exists-with-different-credential':
      'Email này đã tồn tại với một phương thức xác thực khác. Vui lòng liên hệ quản trị viên để hợp nhất tài khoản.',
    'auth/invalid-credential':
      'Google token không được Firebase chấp nhận. Vui lòng kiểm tra OAuth Client ID có thuộc cùng Google Cloud/Firebase project hay không.',
    'auth/network-request-failed': 'Không thể kết nối đến máy chủ Google/Firebase. Vui lòng kiểm tra kết nối mạng và thử lại.',
    'auth/unauthorized-domain':
      'Tên miền hiện tại chưa được cấp phép. Hãy thêm domain đang chạy ứng dụng vào Firebase Authentication > Settings > Authorized domains và OAuth Authorized JavaScript origins.',
    'auth/operation-not-allowed': 'Đăng nhập Google chưa được bật trong Firebase Authentication.',
    'auth/user-disabled': 'Tài khoản Google này đã bị vô hiệu hóa trong hệ thống.',
    'auth/web-storage-unsupported':
      'Trình duyệt đang chặn vùng lưu trữ cần cho phiên đăng nhập. Vui lòng mở ứng dụng trong tab mới hoặc dùng trình duyệt khác.',
  };

  if (code && messages[code]) return messages[code];

  if (code.startsWith('oauth/')) {
    return `Google OAuth không hoàn tất (${code.replace('oauth/', '')}). ${message || 'Vui lòng thử lại hoặc kiểm tra cấu hình OAuth.'}`;
  }

  if (message.toLowerCase().includes('the requested action is invalid') || message.toLowerCase().includes('bad-request')) {
    return 'Cấu hình Google OAuth/Firebase Auth chưa hợp lệ cho domain hiện tại. Luồng đăng nhập Firebase handler đã bị vô hiệu hóa trong ứng dụng; hãy kiểm tra OAuth Client ID, Authorized JavaScript origins và trạng thái Test users/Production.';
  }

  if (message.toLowerCase().includes('origin_mismatch') || code === 'oauth/origin_mismatch') {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `Lỗi 400 (origin_mismatch): Tên miền ${origin ? `"${origin}"` : 'hiện tại'} chưa được thêm vào mục "Authorized JavaScript origins" trong Google Cloud Console.`;
  }

  if (code) {
    return `Đăng nhập không thành công (${code}). ${message ? `Chi tiết: ${message}` : 'Vui lòng kiểm tra cấu hình Google OAuth.'}`;
  }

  if (message) return `Đăng nhập không thành công: ${message}`;
  return 'Không thể đăng nhập bằng Google. Vui lòng thử lại.';
}

function mapProfileSyncError(error: unknown): string {
  const errObj = (typeof error === 'object' && error !== null ? error : {}) as {
    code?: string;
    message?: string;
  };
  if (errObj.code === 'permission-denied' || errObj.code === 'firestore/permission-denied') {
    return 'Đăng nhập Google thành công nhưng Firestore từ chối tạo/đồng bộ hồ sơ. Hãy triển khai firestore.rules mới để cho phép tài khoản mới ở trạng thái PENDING_APPROVAL.';
  }
  return `Đăng nhập Google thành công nhưng không thể đồng bộ hồ sơ người dùng.${errObj.message ? ` Chi tiết: ${errObj.message}` : ''}`;
}

function validRole(value: unknown): UserRole {
  return value === 'ADMIN' ? 'ADMIN' : 'MEMBER';
}

function validStatus(value: unknown): UserStatus {
  if (value === 'DISABLED' || value === 'INVITED' || value === 'PENDING_APPROVAL' || value === 'ACTIVE') {
    return value as UserStatus;
  }
  return 'PENDING_APPROVAL';
}

async function configurePersistence(): Promise<void> {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    try {
      await setPersistence(auth, browserSessionPersistence);
    } catch {
      await setPersistence(auth, inMemoryPersistence);
    }
  }
}

async function syncUserProfile(firebaseUser: FirebaseUser): Promise<User> {
  if (!firebaseUser.email) throw new Error('Tài khoản Google không cung cấp địa chỉ email.');

  const normalizedEmail = firebaseUser.email.toLowerCase();
  const isDesignatedAdmin = DESIGNATED_ADMIN_EMAILS.includes(normalizedEmail);
  const initialRole: UserRole = isDesignatedAdmin ? 'ADMIN' : 'MEMBER';
  const initialStatus: UserStatus = isDesignatedAdmin ? 'ACTIVE' : 'PENDING_APPROVAL';
  const profileRef = doc(db, 'users', firebaseUser.uid);
  const now = new Date().toISOString();

  const snapshot = await getDoc(profileRef);
  const existing = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : undefined;

  if (existing) {
    await setDoc(
      profileRef,
      {
        email: firebaseUser.email,
        normalizedEmail,
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
      normalizedEmail,
      displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
      photoURL: firebaseUser.photoURL || null,
      provider: 'google',
      role: initialRole,
      status: initialStatus,
      createdAt: now,
      lastLoginAt: now,
      updatedAt: now,
    });
  }

  const role = existing ? validRole(existing.role) : initialRole;
  const status = existing ? validStatus(existing.status) : initialStatus;

  return dataService.syncAuthenticatedUser({
    googleUid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
    photoURL: firebaseUser.photoURL || undefined,
    role,
    status,
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
    void configurePersistence().catch(() => undefined);

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
        console.error('Could not synchronize authenticated Google user with Firestore:', syncError);
        dataService.logout();
        setUser(null);
        setError(mapProfileSyncError(syncError));
        setStatus('unauthenticated');
        try {
          await firebaseSignOut(auth);
        } catch {
          // Keep the visible synchronization error even if sign-out cleanup fails.
        }
      }
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);

    if (!isFirebaseConfigured) {
      setError('Firebase chưa được cấu hình. Vui lòng kiểm tra lại cấu hình hệ thống.');
      setStatus('unauthenticated');
      return;
    }

    if (!appletConfig.oAuthClientId) {
      setError(mapAuthError({ code: 'oauth/client_not_configured' }));
      setStatus('unauthenticated');
      return;
    }

    const oauth2 = typeof window !== 'undefined' ? window.google?.accounts?.oauth2 : undefined;
    if (!oauth2) {
      setError(mapAuthError({ code: 'oauth/gis_unavailable' }));
      setStatus('unauthenticated');
      return;
    }

    setStatus('loading');

    try {
      await configurePersistence();

      await new Promise<void>((resolve, reject) => {
        let settled = false;

        const rejectOnce = (reason: unknown) => {
          if (settled) return;
          settled = true;
          reject(reason);
        };

        const tokenClient = oauth2.initTokenClient({
          client_id: appletConfig.oAuthClientId,
          scope: 'openid email profile',
          callback: (tokenResponse) => {
            if (settled) return;

            if (tokenResponse.error) {
              if (tokenResponse.error === 'access_denied') {
                rejectOnce({
                  code: 'oauth/access_denied',
                  message: tokenResponse.error_description || tokenResponse.error,
                });
              } else {
                rejectOnce({
                  code: `oauth/${tokenResponse.error}`,
                  message: tokenResponse.error_description || tokenResponse.error,
                });
              }
              return;
            }

            if (!tokenResponse.access_token) {
              rejectOnce({
                code: 'auth/invalid-credential',
                message: 'Google không trả về access token.',
              });
              return;
            }

            settled = true;
            void (async () => {
              try {
                const credential = GoogleAuthProvider.credential(null, tokenResponse.access_token);
                await signInWithCredential(auth, credential);
                resolve();
              } catch (credentialError) {
                reject(credentialError);
              }
            })();
          },
          error_callback: (popupError) => {
            const popupCode =
              popupError.type === 'popup_failed_to_open'
                ? 'oauth/popup_failed_to_open'
                : popupError.type === 'popup_closed'
                  ? 'oauth/popup_closed'
                  : `oauth/${popupError.type || 'popup_error'}`;
            rejectOnce({ code: popupCode, message: popupError.message });
          },
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
      });
    } catch (signInError) {
      console.warn('Google Identity Services sign-in failed:', signInError);
      setError(mapAuthError(signInError));
      setStatus(auth.currentUser ? 'authenticated' : 'unauthenticated');
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    if (!user) return null;

    const profileUid = firebaseUser?.uid || user.googleUid || user.uid;

    try {
      if (isFirebaseConfigured && profileUid) {
        const profileRef = doc(db, 'users', profileUid);
        const snapshot = await getDoc(profileRef);
        if (snapshot.exists()) {
          const remote = snapshot.data();
          const updatedUser = dataService.syncAuthenticatedUser({
            googleUid: profileUid,
            email: user.email,
            displayName: (remote.displayName as string) || user.displayName,
            photoURL: (remote.photoURL as string) || user.photoURL,
            role: validRole(remote.role),
            status: validStatus(remote.status),
            createdAt: typeof remote.createdAt === 'string' ? remote.createdAt : user.createdAt,
          });
          setUser({ ...updatedUser });
          return updatedUser;
        }
      }
    } catch (readErr) {
      console.warn('Could not read user profile from Firestore during refresh:', readErr);
    }

    const local = dataService.getUserById(user.uid) || dataService.getUserByEmail(user.email);
    if (local) {
      setUser({ ...local });
      return local;
    }
    return user;
  }, [firebaseUser?.uid, user]);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignore sign-out transport errors; local session is still cleared below.
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
      refreshUser,
      logout,
      clearError: () => setError(null),
    }),
    [status, firebaseUser, user, error, signInWithGoogle, refreshUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải được sử dụng bên trong AuthProvider.');
  return context;
}
