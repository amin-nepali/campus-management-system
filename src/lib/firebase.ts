import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  type Auth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';

const requiredConfig = {
  apiKey: import.meta.env['VITE_FIREBASE_API_KEY'],
  authDomain: import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'],
  projectId: import.meta.env['VITE_FIREBASE_PROJECT_ID'],
  appId: import.meta.env['VITE_FIREBASE_APP_ID'],
};

const isConfigured = Object.values(requiredConfig).every(Boolean);
const app = isConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp({
        ...requiredConfig,
        storageBucket: import.meta.env['VITE_FIREBASE_STORAGE_BUCKET'],
        messagingSenderId: import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID'],
      })
  : null;

export const firebaseAuth: Auth | null = app ? getAuth(app) : null;
export const firestoreDb: Firestore | null = app ? getFirestore(app) : null;
export const firebaseConfigError = isConfigured
  ? null
  : 'Firebase is not configured. Add the required VITE_FIREBASE_* values to your local .env file.';

if (app && import.meta.env['VITE_USE_FIREBASE_EMULATORS'] === 'true') {
  if (firebaseAuth) {
    connectAuthEmulator(firebaseAuth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
  }
  if (firestoreDb) {
    connectFirestoreEmulator(firestoreDb, '127.0.0.1', 8080);
  }
}