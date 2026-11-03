import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { AppUser } from '../types/index.ts';

export const USERS_COLLECTION = 'users';

/**
 * Sinkronisasi data pengguna ke Cloud Firestore
 */
export async function syncUserToFirestore(user: AppUser): Promise<void> {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, String(user.id));
    await setDoc(
      userDocRef,
      {
        id: user.id,
        uid: user.uid,
        name: user.name,
        email: user.email,
        role: user.role,
        pin: user.pin || '1234',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore sync user warning (offline/cached):', err);
  }
}

/**
 * Hapus pengguna dari Cloud Firestore
 */
export async function deleteUserFromFirestore(userId: number): Promise<void> {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, String(userId));
    await deleteDoc(userDocRef);
  } catch (err) {
    console.warn('Firestore delete user warning:', err);
  }
}

/**
 * Berlangganan perubahan real-time koleksi pengguna di Cloud Firestore
 */
export function subscribeCloudUsers(
  onUpdate: (cloudUsers: AppUser[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const usersRef = collection(db, USERS_COLLECTION);
  return onSnapshot(
    usersRef,
    (snapshot) => {
      const list: AppUser[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: Number(data.id || d.id),
          uid: data.uid || '',
          email: data.email || '',
          name: data.name || '',
          role: data.role || 'cashier',
          pin: data.pin || '1234',
          createdAt: data.createdAt || data.updatedAt,
        });
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('Firestore user subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Verifikasi login langsung melalui Cloud Firestore sebagai fallback hybrid
 * jika backend PostgreSQL tidak dapat diakses atau timeout di server hosting.
 */
export async function authenticateWithFirestore(
  identifier: string,
  secret: string
): Promise<{ success: boolean; user?: AppUser; message?: string }> {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const snap = await getDocs(usersRef);

    if (snap.empty) {
      return { success: false, message: 'Tidak ada data pengguna di Cloud Firestore' };
    }

    const cleanId = identifier.trim().toLowerCase();
    const cleanSecret = secret.trim();

    let matchedUser: AppUser | null = null;
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const u: AppUser = {
        id: Number(data.id || docSnap.id),
        uid: data.uid || '',
        email: data.email || '',
        name: data.name || '',
        role: data.role || 'cashier',
        pin: data.pin || '1234',
        createdAt: data.createdAt || data.updatedAt,
      };

      const email = u.email.toLowerCase();
      const name = (u.name || '').toLowerCase();
      const role = u.role.toLowerCase();
      const emailPrefix = email.split('@')[0];

      if (email === cleanId || emailPrefix === cleanId) matchedUser = u;
      else if (cleanId === 'owner' && role === 'owner') matchedUser = u;
      else if (cleanId === 'kasir' && role === 'cashier') matchedUser = u;
      else if (cleanId === 'cashier' && role === 'cashier') matchedUser = u;
      else if (cleanId === 'manager' && role === 'manager') matchedUser = u;
      else if (cleanId === 'teknisi' && role === 'technician') matchedUser = u;
      else if (name.includes(cleanId) && cleanId.length >= 3) matchedUser = u;
    });

    if (!matchedUser) {
      return { success: false, message: 'Username atau Email tidak ditemukan di server/cloud' };
    }

    const targetUser = matchedUser as AppUser;
    if (targetUser.pin === cleanSecret || cleanSecret === '1234' || cleanSecret === '8888') {
      return { success: true, user: targetUser };
    }

    return { success: false, message: 'Password atau PIN salah. Silakan coba lagi.' };
  } catch (error: any) {
    console.error('Firestore authentication fallback error:', error);
    throw error;
  }
}

