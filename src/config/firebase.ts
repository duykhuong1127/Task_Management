/// <reference types="vite/client" />
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, browserPopupRedirectResolver } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { APP_REGION, BUSINESS_TIMEZONE } from '@shared/constants/regions';
import appletConfig from '../../firebase-applet-config.json';

// Firebase configuration loaded directly from platform applet config with environment variable fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId,
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
export { browserPopupRedirectResolver, appletConfig };

// The AI Studio project uses a named Firestore database for application data.
// Keep an explicit handle to the default database as well because Cloud Storage
// Security Rules can only call firestore.get() against (default).
export const defaultDb = getFirestore(app);
export const db =
  appletConfig.firestoreDatabaseId && appletConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, appletConfig.firestoreDatabaseId)
    : defaultDb;

// Binary attachments live in Firebase Storage; Firestore stores metadata only.
export const storage = getStorage(app);

export { app, APP_REGION, BUSINESS_TIMEZONE };
