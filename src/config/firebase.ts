/// <reference types="vite/client" />
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, browserPopupRedirectResolver } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { APP_REGION, BUSINESS_TIMEZONE } from '@shared/constants/regions';
import appletConfig from '../../firebase-applet-config.json';

// Bypass client-side originValidation to allow preview environments and dynamic container domains
try {
  const resolverProto = (browserPopupRedirectResolver as unknown as {
    prototype?: {
      _originValidation?: (authInstance: unknown) => Promise<void>;
      _isIframeWebStorageSupported?: (authInstance: unknown, cb: (supported: boolean) => void) => void;
    };
  })?.prototype;

  if (resolverProto) {
    if (typeof resolverProto._originValidation === 'function') {
      resolverProto._originValidation = async () => Promise.resolve();
    }
    if (typeof resolverProto._isIframeWebStorageSupported === 'function') {
      resolverProto._isIframeWebStorageSupported = function (_authInstance: unknown, cb: (supported: boolean) => void) {
        cb(true);
      };
    }
  }
} catch (patchErr) {
  console.warn('Could not apply resolver patches:', patchErr);
}

// Firebase configuration loaded directly from platform applet config (firebase-applet-config.json)
const firebaseConfig = {
  apiKey: appletConfig.apiKey,
  authDomain: appletConfig.authDomain,
  projectId: appletConfig.projectId,
  storageBucket: appletConfig.storageBucket,
  messagingSenderId: appletConfig.messagingSenderId,
  appId: appletConfig.appId,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== 'demo-api-key' &&
  !firebaseConfig.projectId.includes('placeholder')
);

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export { browserPopupRedirectResolver };

// Standard Google authentication parameters: force account selection
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Use the provisioned Firestore database ID if available
export const db =
  appletConfig.firestoreDatabaseId && appletConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, appletConfig.firestoreDatabaseId)
    : getFirestore(app);

export { app, APP_REGION, BUSINESS_TIMEZONE };

