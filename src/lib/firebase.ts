import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Baca environment variables Vite/Production (import.meta.env) dengan fallback ke firebase-applet-config.json
const env =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env as Record<string, string | undefined>)
    : ({} as Record<string, string | undefined>);

export const resolvedFirebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId || '',
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfig.appId || '',
  firestoreDatabaseId:
    env.VITE_FIRESTORE_DATABASE_ID ||
    firebaseConfig.firestoreDatabaseId ||
    '(default)',
};

// Inisialisasi Firebase App
export const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(resolvedFirebaseConfig);

export const auth: Auth = getAuth(app);
export const googleAuthProvider: GoogleAuthProvider = new GoogleAuthProvider();

// Inisialisasi Firestore Cloud Database dengan database ID yang sesuai dan fallback aman
let firestoreDb: Firestore;
try {
  const dbId = resolvedFirebaseConfig.firestoreDatabaseId;
  firestoreDb =
    dbId && dbId !== '(default)'
      ? getFirestore(app, dbId)
      : getFirestore(app);
} catch (error) {
  console.warn('Gagal menghubungkan ke custom Firestore database ID, fallback ke default:', error);
  firestoreDb = getFirestore(app);
}

export const db: Firestore = firestoreDb;
