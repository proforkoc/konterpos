import { DigitalTransaction, ServiceSoftwareOrder, Sale } from '../types/index.ts';
import { restoreStockFromSaleCloud } from '../services/cloudInventoryService.ts';

export const STORAGE_KEY_DIGITAL = 'konter_digital_transactions';
export const STORAGE_KEY_SERVICES = 'konter_service_orders';
export const STORAGE_KEY_SALES = 'konter_sales_list';

export const EVENT_TRANSACTION_DELETED = 'konter_transaction_deleted';
export const EVENT_DATA_UPDATED = 'konter_data_updated';

export interface DeleteTransactionPayload {
  category: 'pos' | 'digital' | 'service';
  rawId: number;
  invoiceNumber: string;
  items?: any[];
}

// ==========================================
// 1. LOCAL STORAGE HELPERS & AUTO-PURGE DUMMY
// ==========================================

// Pembersihan otomatis data dummy lama dari browser localStorage saat aplikasi dimuat
if (typeof window !== 'undefined') {
  try {
    const CLEANUP_KEY = 'konter_initial_dummy_cleaned_v2';
    if (!localStorage.getItem(CLEANUP_KEY)) {
      localStorage.removeItem(STORAGE_KEY_DIGITAL);
      localStorage.removeItem(STORAGE_KEY_SERVICES);
      localStorage.removeItem(STORAGE_KEY_SALES);
      localStorage.setItem(CLEANUP_KEY, 'true');
    }
  } catch {
    // quiet fail in non-browser environment
  }
}

// --- Digital Transactions ---
export function getStoredDigitalTransactions(): DigitalTransaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DIGITAL);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter keluar data dummy legacy (ID 301-320 atau prefix dummy)
    return parsed.filter(
      (item) => !(item.id >= 301 && item.id <= 325) && !item.referenceNumber?.startsWith('TRX-BRI-98124')
    );
  } catch {
    return [];
  }
}

export function saveStoredDigitalTransactions(list: DigitalTransaction[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_DIGITAL, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to save digital transactions to localStorage:', e);
  }
}

export function removeStoredDigitalTransaction(id: number, refNumber?: string): DigitalTransaction[] {
  const current = getStoredDigitalTransactions();
  const updated = current.filter(
    (item) => item.id !== id && (refNumber ? item.referenceNumber !== refNumber : true)
  );
  saveStoredDigitalTransactions(updated);
  return updated;
}

// --- Service Software Orders ---
export function getStoredServiceOrders(): ServiceSoftwareOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SERVICES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter keluar data dummy legacy (ID 401-425 atau prefix dummy)
    return parsed.filter(
      (item) => !(item.id >= 401 && item.id <= 425) && !item.orderNumber?.startsWith('SRV-20261026-001')
    );
  } catch {
    return [];
  }
}

export function saveStoredServiceOrders(list: ServiceSoftwareOrder[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_SERVICES, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to save service orders to localStorage:', e);
  }
}

export function removeStoredServiceOrder(id: number, orderNumber?: string): ServiceSoftwareOrder[] {
  const current = getStoredServiceOrders();
  const updated = current.filter(
    (item) => item.id !== id && (orderNumber ? item.orderNumber !== orderNumber : true)
  );
  saveStoredServiceOrders(updated);
  return updated;
}

// --- POS Sales ---
export function getStoredSales(): Sale[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SALES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredSales(list: Sale[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_SALES, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to save sales to localStorage:', e);
  }
}

export function removeStoredSale(id: number, invoiceNumber?: string): Sale[] {
  const current = getStoredSales();
  const updated = current.filter(
    (item) => item.id !== id && (invoiceNumber ? item.invoiceNumber !== invoiceNumber : true)
  );
  saveStoredSales(updated);
  return updated;
}

// ==========================================
// 2. CENTRALIZED DELETE HANDLER
// ==========================================

/**
 * Fungsi Hapus Terpusat:
 * 1. Mengidentifikasi kategori modul ('pos' | 'digital' | 'service') dan ID / nomor faktur.
 * 2. Membaca daftar item transaksi penjualan jika POS dan mengembalikan stok (Restock) ke Cloud Firestore (Aksesoris & HP/IMEI).
 * 3. Memanggil backend REST API untuk menghapus data di database (PostgreSQL) serta mengembalikan stok fisik di database relational.
 * 4. Menghapus record secara langsung dari localStorage modul asal.
 * 5. Menyiarkan (broadcast) CustomEvent ke seluruh aplikasi agar modul asal langsung bereaksi dan reaktif mengupdate tabel & KPI tanpa refresh.
 */
export async function executeUnifiedDelete(payload: DeleteTransactionPayload): Promise<{ success: boolean; message: string; restoredCount?: number }> {
  const { category, rawId, invoiceNumber } = payload;

  // 1. Jika kategori POS (Penjualan Retail): Ambil detail item & pulihkan stok ke Cloud Firestore
  if (category === 'pos') {
    let itemsToRestore = payload.items;

    // Jika item belum disertakan di payload, cari di penyimpanan lokal
    if (!itemsToRestore || itemsToRestore.length === 0) {
      const stored = getStoredSales();
      const matchedSale = stored.find(
        (s) => s.id === rawId || s.invoiceNumber === invoiceNumber
      );
      if (matchedSale?.items && matchedSale.items.length > 0) {
        itemsToRestore = matchedSale.items;
      }
    }

    // Jika masih belum ada, coba baca langsung dari server API sebelum transaksi dihapus
    if (!itemsToRestore || itemsToRestore.length === 0) {
      try {
        const saleRes = await fetch(`/api/sales/${rawId}`);
        if (saleRes.ok) {
          const detailed = await saleRes.json();
          if (detailed?.items && Array.isArray(detailed.items)) {
            itemsToRestore = detailed.items;
          }
        }
      } catch (fetchErr) {
        console.warn('Notice fetching sale items for restock:', fetchErr);
      }
    }

    // Eksekusi pemulihan stok ke Cloud Firestore (Aksesoris & HP/IMEI)
    if (itemsToRestore && itemsToRestore.length > 0) {
      try {
        await restoreStockFromSaleCloud(itemsToRestore);
      } catch (cloudErr) {
        console.warn('Gagal memulihkan stok ke Cloud Firestore:', cloudErr);
      }
    }
  }

  let endpoint = '';
  if (category === 'pos') {
    endpoint = `/api/sales/${rawId}?invoice=${encodeURIComponent(invoiceNumber)}`;
  } else if (category === 'digital') {
    endpoint = `/api/digital-finance/${rawId}?ref=${encodeURIComponent(invoiceNumber)}`;
  } else if (category === 'service') {
    endpoint = `/api/services/${rawId}?orderNumber=${encodeURIComponent(invoiceNumber)}`;
  }

  // 2. Request ke Backend API (akan memulihkan stok di database SQL dan menghapus record transaksi)
  try {
    const res = await fetch(endpoint, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // Jika 404 tapi data ada di local/mock, tetap lanjutkan pembersihan lokal
      if (res.status !== 404) {
        throw new Error(err.error || 'Gagal menghapus transaksi dari server');
      }
    }
  } catch (err: any) {
    console.warn('Server delete call returned error, proceeding with local cascade removal:', err);
  }

  // 3. Cascade Hapus Data dari LocalStorage Modul Asal
  if (category === 'pos') {
    removeStoredSale(rawId, invoiceNumber);
  } else if (category === 'digital') {
    removeStoredDigitalTransaction(rawId, invoiceNumber);
  } else if (category === 'service') {
    removeStoredServiceOrder(rawId, invoiceNumber);
  }

  // 4. Broadcast Event Sinkronisasi ke Seluruh Komponen Aktif
  notifyTransactionDeleted(payload);
  notifyDataUpdated(category);

  return {
    success: true,
    message:
      category === 'pos'
        ? `Transaksi ${invoiceNumber} berhasil dihapus dan seluruh stok barang berhasil dikembalikan ke inventaris toko.`
        : `Transaksi ${invoiceNumber} berhasil dihapus dan disinkronkan ke seluruh modul.`,
  };
}

// ==========================================
// 3. EVENT BROADCAST & SUBSCRIPTION
// ==========================================

export function notifyTransactionDeleted(payload: DeleteTransactionPayload): void {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent(EVENT_TRANSACTION_DELETED, { detail: payload });
    window.dispatchEvent(event);
  }
}

export function notifyDataUpdated(category: 'pos' | 'digital' | 'service' | 'all'): void {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent(EVENT_DATA_UPDATED, { detail: { category } });
    window.dispatchEvent(event);
  }
}

export function onTransactionDeleted(
  callback: (payload: DeleteTransactionPayload) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const custom = e as CustomEvent<DeleteTransactionPayload>;
    if (custom.detail) {
      callback(custom.detail);
    }
  };

  window.addEventListener(EVENT_TRANSACTION_DELETED, handler);
  return () => window.removeEventListener(EVENT_TRANSACTION_DELETED, handler);
}

export function onDataUpdated(
  callback: (payload: { category: string }) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const custom = e as CustomEvent<{ category: string }>;
    if (custom.detail) {
      callback(custom.detail);
    }
  };

  window.addEventListener(EVENT_DATA_UPDATED, handler);
  return () => window.removeEventListener(EVENT_DATA_UPDATED, handler);
}
