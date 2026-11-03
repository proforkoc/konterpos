import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';

export interface StoreQrisConfig {
  merchantName: string;
  nmid: string;
  subCode?: string;
  imageUrl?: string; // Data URL Base64 atau URL gambar QRIS eksternal
  updatedAt?: string;
}

export const DEFAULT_QRIS_CONFIG: StoreQrisConfig = {
  merchantName: 'KONTER NUSANTARA CELL',
  nmid: 'ID1020304050607 | A01',
  subCode: 'A01',
  imageUrl: '',
};

export const STORAGE_KEY_QRIS = 'konter_store_qris_config';
export const EVENT_QRIS_UPDATED = 'konter_qris_updated';

/**
 * Mengambil konfigurasi QRIS toko yang tersimpan di localStorage (sinkron & instan)
 */
export function getStoredQrisConfig(): StoreQrisConfig {
  if (typeof window === 'undefined') return DEFAULT_QRIS_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_QRIS);
    if (!raw) return DEFAULT_QRIS_CONFIG;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.merchantName === 'string') {
      return {
        merchantName: parsed.merchantName || DEFAULT_QRIS_CONFIG.merchantName,
        nmid: parsed.nmid || DEFAULT_QRIS_CONFIG.nmid,
        subCode: parsed.subCode || 'A01',
        imageUrl: parsed.imageUrl || '',
        updatedAt: parsed.updatedAt,
      };
    }
  } catch (err) {
    console.warn('Gagal membaca qris config dari localStorage:', err);
  }
  return DEFAULT_QRIS_CONFIG;
}

/**
 * Menyimpan konfigurasi QRIS toko ke localStorage dan memicu CustomEvent agar UI reaktif
 */
export function saveStoredQrisConfig(config: StoreQrisConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_QRIS, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent(EVENT_QRIS_UPDATED, { detail: config }));
  } catch (err) {
    console.warn('Gagal menyimpan qris config ke localStorage:', err);
  }
}

/**
 * Menyimpan konfigurasi QRIS toko ke Cloud Firestore dan localStorage
 */
export async function saveQrisConfigCloud(config: StoreQrisConfig): Promise<void> {
  const payload: StoreQrisConfig = {
    merchantName: config.merchantName.trim() || DEFAULT_QRIS_CONFIG.merchantName,
    nmid: config.nmid.trim() || DEFAULT_QRIS_CONFIG.nmid,
    subCode: config.subCode?.trim() || 'A01',
    imageUrl: config.imageUrl || '',
    updatedAt: new Date().toISOString(),
  };

  // 1. Simpan ke Local Storage untuk ketersediaan instan & offline
  saveStoredQrisConfig(payload);

  // 2. Simpan ke Cloud Firestore (koleksi: settings, dokumen: qris_profile)
  try {
    const qrisDocRef = doc(db, 'settings', 'qris_profile');
    await setDoc(qrisDocRef, payload, { merge: true });
  } catch (cloudErr) {
    console.warn('Peringatan: Gagal sinkronisasi QRIS ke Cloud Firestore (tersimpan lokal):', cloudErr);
  }
}

/**
 * Berlangganan (Real-Time Listener) ke Cloud Firestore untuk pembaruan QRIS Toko
 */
export function subscribeQrisConfig(
  onUpdate: (config: StoreQrisConfig) => void
): Unsubscribe {
  try {
    const qrisDocRef = doc(db, 'settings', 'qris_profile');
    const unsub = onSnapshot(
      qrisDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<StoreQrisConfig>;
          const merged: StoreQrisConfig = {
            merchantName: data.merchantName || DEFAULT_QRIS_CONFIG.merchantName,
            nmid: data.nmid || DEFAULT_QRIS_CONFIG.nmid,
            subCode: data.subCode || 'A01',
            imageUrl: data.imageUrl || '',
            updatedAt: data.updatedAt,
          };
          saveStoredQrisConfig(merged);
          onUpdate(merged);
        }
      },
      (err) => {
        console.warn('Gagal berlangganan real-time snapshot QRIS Cloud:', err);
      }
    );
    return unsub;
  } catch (err) {
    console.warn('Error saat subscribe ke Firestore QRIS:', err);
    return () => {};
  }
}

/**
 * Kompres dan ubah file gambar yang diunggah ke Data URL Base64 ringan
 * Memastikan gambar QRIS tetap tajam saat discan namun tidak memberatkan database cloud
 */
export function resizeImageToDataUrl(file: File, maxSize: number = 600): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Gagal memuat gambar untuk diproses'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.readAsDataURL(file);
  });
}
