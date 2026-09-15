/// <reference types="vite/client" />
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, browserPopupRedirectResolver } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { APP_REGION, BUSINESS_TIMEZONE } from '@shared/constants/regions';
import appletConfig from '../../firebase-applet-config.json';

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
export { browserPopupRedirectResolver, appletConfig };

// Use the provisioned Firestore database ID if available
export const db =
  appletConfig.firestoreDatabaseId && appletConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, appletConfig.firestoreDatabaseId)
    : getFirestore(app);

export { app, APP_REGION, BUSINESS_TIMEZONE };

