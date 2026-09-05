/// <reference types="vite/client" />
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { APP_REGION, BUSINESS_TIMEZONE } from '@shared/constants/regions';

// Firebase configuration loaded from environment
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'task-management-sg.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'task-management-sg',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'task-management-sg.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '217631329737',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:217631329737:web:sg-prod-app',
};

export const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY && 
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_API_KEY !== 'demo-api-key'
);

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

export { app, APP_REGION, BUSINESS_TIMEZONE };
