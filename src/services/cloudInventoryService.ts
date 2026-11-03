import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocFromServer,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { Product, ProductSerial } from '../types/index.ts';

// Test koneksi awal ke Firestore sesuai standar arsitektur cloud
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline status. Periksa konfigurasi cloud Firebase Anda.');
    }
  }
}
testFirestoreConnection();

// Koleksi Firestore
export const ACCESSORIES_COLLECTION = 'stok_aksesoris';
export const HP_IMEI_COLLECTION = 'hp_imei';

// ==========================================
// 1. MODUL STOK AKSESORIS (CLOUD FIRESTORE)
// ==========================================

let isSeedingAccessories = false;

/**
 * Inisialisasi data produk aksesoris awal ke Cloud Firestore jika koleksi masih kosong
 * Memastikan saat pertama kali dideploy, data langsung tersedia secara sinkron di server cloud.
 */
export async function seedInitialAccessoriesIfEmpty(): Promise<void> {
  if (isSeedingAccessories) return;
  try {
    isSeedingAccessories = true;
    const snap = await getDocs(collection(db, ACCESSORIES_COLLECTION));
    if (!snap.empty) {
      isSeedingAccessories = false;
      return;
    }

    const defaultItems: Omit<Product, 'id' | 'createdAt'>[] = [
      {
        categoryId: 2,
        categoryName: 'Aksesoris & Sparepart',
        categoryCode: 'aksesoris',
        code: 'ACC-CHG-20W',
        name: 'Adaptor Charger Fast Charging 20W PD Type-C',
        brand: 'Baseus',
        model: 'Adaptor 20W PD',
        variant: 'Putih Glossy',
        costPrice: 45000,
        sellingPrice: 75000,
        stock: 15,
        minStockAlert: 5,
        isImeiTracked: false,
        unit: 'pcs',
      },
      {
        categoryId: 2,
        categoryName: 'Aksesoris & Sparepart',
        categoryCode: 'aksesoris',
        code: 'ACC-KBL-TC60',
        name: 'Kabel Data Braided Type-C to Type-C 60W (1 Meter)',
        brand: 'Robot',
        model: 'Braided Cable 60W',
        variant: 'Hitam',
        costPrice: 18000,
        sellingPrice: 35000,
        stock: 25,
        minStockAlert: 5,
        isImeiTracked: false,
        unit: 'pcs',
      },
      {
        categoryId: 2,
        categoryName: 'Aksesoris & Sparepart',
        categoryCode: 'aksesoris',
        code: 'ACC-TG-9D',
        name: 'Tempered Glass 9D Full Cover Layar Lengkung',
        brand: 'Vention',
        model: 'Tempered Glass 9D',
        variant: 'Clear Black Border',
        costPrice: 7000,
        sellingPrice: 25000,
        stock: 40,
        minStockAlert: 10,
        isImeiTracked: false,
        unit: 'pcs',
      },
      {
        categoryId: 2,
        categoryName: 'Aksesoris & Sparepart',
        categoryCode: 'aksesoris',
        code: 'ACC-TWS-WM01',
        name: 'TWS Bluetooth 5.3 Earbuds Low Latency',
        brand: 'Baseus',
        model: 'Bowie WM01',
        variant: 'Hitam Matte',
        costPrice: 110000,
        sellingPrice: 165000,
        stock: 8,
        minStockAlert: 3,
        isImeiTracked: false,
        unit: 'pcs',
      },
      {
        categoryId: 2,
        categoryName: 'Aksesoris & Sparepart',
        categoryCode: 'aksesoris',
        code: 'ACC-CASE-CLR',
        name: 'Softcase Silikon Bening Anti Crack 2.0mm',
        brand: 'Generic',
        model: 'Anti-Shock Clear Case',
        variant: 'Transparan',
        costPrice: 5000,
        sellingPrice: 15000,
        stock: 30,
        minStockAlert: 5,
        isImeiTracked: false,
        unit: 'pcs',
      },
    ];

    for (const item of defaultItems) {
      await createAccessoryCloud(item);
    }
  } catch (err) {
    console.warn('Notice seeding accessories to Firestore:', err);
  } finally {
    isSeedingAccessories = false;
  }
}

/**
 * Real-time listener untuk data Stok Aksesoris di Cloud Firestore
 */
export function subscribeAccessories(
  onSuccess: (items: Product[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, ACCESSORIES_COLLECTION);

  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        // Jika data di cloud masih kosong saat inisialisasi, lakukan seeding otomatis ke Firestore
        seedInitialAccessoriesIfEmpty().catch((err) =>
          console.warn('Initial seeding trigger:', err)
        );
        onSuccess([]);
        return;
      }

      const items: Product[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: data.numericId || docSnap.id,
          docId: docSnap.id,
          categoryId: 2,
          categoryName: data.categoryName || 'Aksesoris & Sparepart',
          categoryCode: 'aksesoris',
          code: data.code || '',
          name: data.name || '',
          brand: data.brand || '',
          model: data.model || '',
          variant: data.variant || '',
          costPrice: Number(data.costPrice || 0),
          sellingPrice: Number(data.sellingPrice || 0),
          stock: Number(data.stock || 0),
          minStockAlert: Number(data.minStockAlert || 5),
          isImeiTracked: false,
          unit: data.unit || 'pcs',
          createdAt: data.createdAt || new Date().toISOString(),
        } as Product & { docId?: string };
      });

      // Urutkan data berdasarkan waktu pembuatan terbaru (descending)
      items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      onSuccess(items);
    },
    (err) => {
      console.error('Error listening to stok_aksesoris Firestore:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Tambah Aksesoris baru ke Cloud Firestore
 */
export async function createAccessoryCloud(
  item: Omit<Product, 'id' | 'createdAt'>
): Promise<string> {
  const createdAt = new Date().toISOString();
  const numericId = Date.now();

  // 1. Simpan ke Firestore
  const docRef = await addDoc(collection(db, ACCESSORIES_COLLECTION), {
    ...item,
    numericId,
    createdAt,
    updatedAt: createdAt,
  });

  // 2. Sinkronkan dengan backend API SQL (jika aktif)
  try {
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...item,
        categoryId: 2,
        isImeiTracked: false,
      }),
    });
  } catch (err) {
    console.warn('Backend SQL sync notice:', err);
  }

  return docRef.id;
}

/**
 * Update stok aksesoris di Cloud Firestore
 */
export async function updateAccessoryStockCloud(
  docId: string,
  newStock: number,
  numericId?: number | string
): Promise<void> {
  const itemDoc = doc(db, ACCESSORIES_COLLECTION, docId);
  await updateDoc(itemDoc, {
    stock: newStock,
    updatedAt: new Date().toISOString(),
  });

  // Sinkronkan ke backend jika numericId ada
  if (numericId && typeof numericId === 'number') {
    try {
      await fetch(`/api/products/${numericId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock }),
      });
    } catch {
      // quiet fail
    }
  }
}

/**
 * Update stok dan harga modal/jual aksesoris (Custom Restock) di Cloud Firestore
 */
export async function restockAccessoryCloud(
  docId: string,
  newStock: number,
  newCostPrice?: number,
  newSellingPrice?: number,
  numericId?: number | string
): Promise<void> {
  const itemDoc = doc(db, ACCESSORIES_COLLECTION, docId);
  const updatePayload: Record<string, any> = {
    stock: newStock,
    updatedAt: new Date().toISOString(),
  };

  if (typeof newCostPrice === 'number' && !isNaN(newCostPrice) && newCostPrice >= 0) {
    updatePayload.costPrice = newCostPrice;
  }
  if (typeof newSellingPrice === 'number' && !isNaN(newSellingPrice) && newSellingPrice > 0) {
    updatePayload.sellingPrice = newSellingPrice;
  }

  await updateDoc(itemDoc, updatePayload);

  // Sinkronkan ke backend SQL jika numericId ada
  if (numericId && typeof numericId === 'number') {
    try {
      const sqlPayload: Record<string, any> = { stock: newStock };
      if (typeof newCostPrice === 'number' && !isNaN(newCostPrice) && newCostPrice >= 0) {
        sqlPayload.costPrice = newCostPrice;
      }
      if (typeof newSellingPrice === 'number' && !isNaN(newSellingPrice) && newSellingPrice > 0) {
        sqlPayload.sellingPrice = newSellingPrice;
      }

      await fetch(`/api/products/${numericId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sqlPayload),
      });
    } catch {
      // quiet fail
    }
  }
}

/**
 * Hapus aksesoris dari Cloud Firestore
 */
export async function deleteAccessoryCloud(
  docId: string,
  numericId?: number | string
): Promise<void> {
  await deleteDoc(doc(db, ACCESSORIES_COLLECTION, docId));

  if (numericId && typeof numericId === 'number') {
    try {
      await fetch(`/api/products/${numericId}`, { method: 'DELETE' });
    } catch {
      // quiet fail
    }
  }
}

// ==========================================
// 2. MODUL HP & IMEI (CLOUD FIRESTORE)
// ==========================================

export interface CloudPhoneItem extends Product {
  docId?: string;
}

export interface CloudSerialItem extends ProductSerial {
  docId?: string;
  phoneDocId?: string;
}

let isSeedingPhones = false;

/**
 * Inisialisasi data katalog Smartphone awal ke Cloud Firestore jika koleksi masih kosong
 * Memastikan saat pertama kali dideploy, data langsung tersedia secara sinkron di server cloud.
 */
export async function seedInitialPhonesIfEmpty(): Promise<void> {
  if (isSeedingPhones) return;
  try {
    isSeedingPhones = true;
    const snap = await getDocs(collection(db, HP_IMEI_COLLECTION));
    if (!snap.empty) {
      isSeedingPhones = false;
      return;
    }

    const defaultPhones = [
      {
        phone: {
          categoryId: 1,
          categoryName: 'Handphone & Gadget',
          categoryCode: 'hp',
          code: 'HP-SAM-A54',
          name: 'Samsung Galaxy A54 5G',
          brand: 'Samsung',
          model: 'Galaxy A54 5G',
          variant: '8GB / 256GB',
          costPrice: 4850000,
          sellingPrice: 5599000,
          stock: 3,
          minStockAlert: 1,
          isImeiTracked: true,
          unit: 'unit',
        },
        serials: [
          { imei1: '358921098471201', imei2: '358921098471202', serialNumber: 'R58T3098JK1', color: 'Awesome Graphite', ramStorage: '8GB / 256GB', purchasePrice: 4850000 },
          { imei1: '358921098471203', imei2: '358921098471204', serialNumber: 'R58T3098JK2', color: 'Awesome Violet', ramStorage: '8GB / 256GB', purchasePrice: 4850000 },
          { imei1: '358921098471205', imei2: '358921098471206', serialNumber: 'R58T3098JK3', color: 'Awesome Lime', ramStorage: '8GB / 256GB', purchasePrice: 4850000 },
        ],
      },
      {
        phone: {
          categoryId: 1,
          categoryName: 'Handphone & Gadget',
          categoryCode: 'hp',
          code: 'HP-RN13-8-256',
          name: 'Xiaomi Redmi Note 13 4G',
          brand: 'Xiaomi',
          model: 'Redmi Note 13 4G',
          variant: '8GB / 256GB',
          costPrice: 2050000,
          sellingPrice: 2499000,
          stock: 3,
          minStockAlert: 2,
          isImeiTracked: true,
          unit: 'unit',
        },
        serials: [
          { imei1: '864219061029381', imei2: '864219061029382', serialNumber: 'XRN13-8-01', color: 'Midnight Black', ramStorage: '8GB / 256GB', purchasePrice: 2050000 },
          { imei1: '864219061029383', imei2: '864219061029384', serialNumber: 'XRN13-8-02', color: 'Mint Green', ramStorage: '8GB / 256GB', purchasePrice: 2050000 },
          { imei1: '864219061029385', imei2: '864219061029386', serialNumber: 'XRN13-8-03', color: 'Ice Blue', ramStorage: '8GB / 256GB', purchasePrice: 2050000 },
        ],
      },
      {
        phone: {
          categoryId: 1,
          categoryName: 'Handphone & Gadget',
          categoryCode: 'hp',
          code: 'HP-OPPO-R8T',
          name: 'Oppo Reno 8T 4G',
          brand: 'Oppo',
          model: 'Reno 8T',
          variant: '8GB / 256GB',
          costPrice: 3200000,
          sellingPrice: 3899000,
          stock: 2,
          minStockAlert: 1,
          isImeiTracked: true,
          unit: 'unit',
        },
        serials: [
          { imei1: '862049051839201', imei2: '862049051839202', serialNumber: 'OP8T-4G-91', color: 'Sunset Orange', ramStorage: '8GB / 256GB', purchasePrice: 3200000 },
          { imei1: '862049051839203', imei2: '862049051839204', serialNumber: 'OP8T-4G-92', color: 'Midnight Black', ramStorage: '8GB / 256GB', purchasePrice: 3200000 },
        ],
      },
      {
        phone: {
          categoryId: 1,
          categoryName: 'Handphone & Gadget',
          categoryCode: 'hp',
          code: 'HP-VIV-Y27S',
          name: 'Vivo Y27s NFC',
          brand: 'Vivo',
          model: 'Y27s',
          variant: '8GB / 128GB',
          costPrice: 1950000,
          sellingPrice: 2399000,
          stock: 2,
          minStockAlert: 1,
          isImeiTracked: true,
          unit: 'unit',
        },
        serials: [
          { imei1: '861938062940111', imei2: '861938062940112', serialNumber: 'VY27-01-A', color: 'Burgundy Black', ramStorage: '8GB / 128GB', purchasePrice: 1950000 },
          { imei1: '861938062940113', imei2: '861938062940114', serialNumber: 'VY27-02-B', color: 'Garden Green', ramStorage: '8GB / 128GB', purchasePrice: 1950000 },
        ],
      },
      {
        phone: {
          categoryId: 1,
          categoryName: 'Handphone & Gadget',
          categoryCode: 'hp',
          code: 'HP-IP13-128',
          name: 'iPhone 13 128GB Garansi Resmi iBox',
          brand: 'Apple',
          model: 'iPhone 13',
          variant: '128GB',
          costPrice: 9400000,
          sellingPrice: 10499000,
          stock: 2,
          minStockAlert: 1,
          isImeiTracked: true,
          unit: 'unit',
        },
        serials: [
          { imei1: '352940182940191', imei2: '', serialNumber: 'F2LX920KMD6R', color: 'Midnight', ramStorage: '128GB', purchasePrice: 9400000 },
          { imei1: '352940182940192', imei2: '', serialNumber: 'F2LX920KMD6S', color: 'Starlight', ramStorage: '128GB', purchasePrice: 9400000 },
        ],
      },
    ];

    for (const item of defaultPhones) {
      await createPhoneCloud(item.phone, item.serials);
    }
  } catch (err) {
    console.warn('Notice seeding phones to Firestore:', err);
  } finally {
    isSeedingPhones = false;
  }
}

/**
 * Real-time listener untuk daftar Handphone di Firestore
 */
export function subscribePhones(
  onSuccess: (phones: CloudPhoneItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, HP_IMEI_COLLECTION), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        // Jika data di cloud masih kosong, lakukan initial seed otomatis ke Firestore
        seedInitialPhonesIfEmpty().catch((err) =>
          console.warn('Initial phone seeding trigger:', err)
        );
        onSuccess([]);
        return;
      }

      const phones: CloudPhoneItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: data.numericId || docSnap.id,
          docId: docSnap.id,
          categoryId: 1,
          categoryName: data.categoryName || 'Handphone & Gadget',
          categoryCode: 'hp',
          code: data.code || '',
          name: data.name || '',
          brand: data.brand || '',
          model: data.model || data.name || '',
          variant: data.variant || '',
          costPrice: Number(data.costPrice || 0),
          sellingPrice: Number(data.sellingPrice || 0),
          stock: Number(data.stock || 0),
          minStockAlert: Number(data.minStockAlert || 1),
          isImeiTracked: true,
          unit: 'unit',
          createdAt: data.createdAt || new Date().toISOString(),
        };
      });
      onSuccess(phones);
    },
    (err) => {
      console.error('Error listening to hp_imei collection:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Real-time listener untuk nomor IMEI/Serial dari HP tertentu
 */
export function subscribePhoneSerials(
  phoneDocId: string,
  onSuccess: (serials: CloudSerialItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const serialsRef = collection(db, HP_IMEI_COLLECTION, phoneDocId, 'serials');
  const q = query(serialsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const serials: CloudSerialItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: data.numericId || docSnap.id,
          docId: docSnap.id,
          phoneDocId,
          productId: data.productId || phoneDocId,
          imei1: data.imei1 || '',
          imei2: data.imei2 || '',
          serialNumber: data.serialNumber || '',
          color: data.color || 'Black',
          ramStorage: data.ramStorage || '',
          status: data.status || 'available',
          purchasePrice: Number(data.purchasePrice || 0),
          saleId: data.saleId,
          soldAt: data.soldAt,
          createdAt: data.createdAt || new Date().toISOString(),
        };
      });
      onSuccess(serials);
    },
    (err) => {
      console.error(`Error listening to serials for phone ${phoneDocId}:`, err);
      if (onError) onError(err);
    }
  );
}

/**
 * Tambah Handphone baru beserta unit IMEI awal ke Cloud Firestore
 */
export async function createPhoneCloud(
  phoneData: Omit<Product, 'id' | 'createdAt'>,
  initialImeis: Array<{
    imei1: string;
    imei2?: string;
    serialNumber?: string;
    color?: string;
    ramStorage?: string;
    purchasePrice?: number;
  }>
): Promise<string> {
  const createdAt = new Date().toISOString();
  const numericPhoneId = Date.now();

  // 1. Simpan data Master Handphone
  const phoneDocRef = await addDoc(collection(db, HP_IMEI_COLLECTION), {
    ...phoneData,
    numericId: numericPhoneId,
    stock: initialImeis.length,
    isImeiTracked: true,
    categoryId: 1,
    categoryName: 'Handphone & Gadget',
    categoryCode: 'hp',
    createdAt,
    updatedAt: createdAt,
  });

  // 2. Simpan setiap unit IMEI ke sub-koleksi 'serials'
  for (let i = 0; i < initialImeis.length; i++) {
    const imeiItem = initialImeis[i];
    await addDoc(collection(db, HP_IMEI_COLLECTION, phoneDocRef.id, 'serials'), {
      numericId: numericPhoneId + i + 1,
      productId: numericPhoneId,
      phoneDocId: phoneDocRef.id,
      imei1: imeiItem.imei1,
      imei2: imeiItem.imei2 || '',
      serialNumber: imeiItem.serialNumber || '',
      color: imeiItem.color || 'Black',
      ramStorage: imeiItem.ramStorage || phoneData.variant,
      status: 'available',
      purchasePrice: Number(imeiItem.purchasePrice || phoneData.costPrice || 0),
      createdAt: new Date().toISOString(),
    });
  }

  // 3. Sinkronkan dengan backend API jika online
  try {
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...phoneData,
        categoryId: 1,
        isImeiTracked: true,
        stock: initialImeis.length,
        initialImeis,
      }),
    });
  } catch {
    // quiet fail
  }

  return phoneDocRef.id;
}

/**
 * Tambah single IMEI ke HP yang sudah ada di Cloud Firestore
 */
export async function addSingleImeiCloud(
  phoneDocId: string,
  phoneNumericId: number | string | undefined,
  serialData: {
    imei1: string;
    imei2?: string;
    serialNumber?: string;
    color?: string;
    ramStorage?: string;
    purchasePrice?: number;
  }
): Promise<string> {
  const createdAt = new Date().toISOString();
  const numericId = Date.now();

  // 1. Simpan unit ke sub-koleksi serials
  const docRef = await addDoc(collection(db, HP_IMEI_COLLECTION, phoneDocId, 'serials'), {
    ...serialData,
    numericId,
    phoneDocId,
    productId: phoneNumericId || phoneDocId,
    status: 'available',
    createdAt,
  });

  // 2. Hitung ulang stok tersedia pada master phone doc
  try {
    const serialsSnap = await getDocs(
      collection(db, HP_IMEI_COLLECTION, phoneDocId, 'serials')
    );
    const availableCount = serialsSnap.docs.filter(
      (d) => d.data().status === 'available'
    ).length;

    await updateDoc(doc(db, HP_IMEI_COLLECTION, phoneDocId), {
      stock: availableCount,
      updatedAt: createdAt,
    });
  } catch (err) {
    console.error('Failed to update phone stock on serial addition:', err);
  }

  // 3. Sinkronkan ke backend API jika numeric id ada
  if (phoneNumericId && typeof phoneNumericId === 'number') {
    try {
      await fetch(`/api/products/${phoneNumericId}/serials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serialData),
      });
    } catch {
      // quiet fail
    }
  }

  return docRef.id;
}

/**
 * Update status serial/IMEI (misal saat terjual atau retur)
 */
export async function updateSerialStatusCloud(
  phoneDocId: string,
  serialDocId: string,
  newStatus: 'available' | 'sold',
  numericPhoneId?: number | string
): Promise<void> {
  const serialRef = doc(db, HP_IMEI_COLLECTION, phoneDocId, 'serials', serialDocId);
  await updateDoc(serialRef, {
    status: newStatus,
    soldAt: newStatus === 'sold' ? new Date().toISOString() : null,
  });

  // Perbarui total stok tersedia di master HP
  try {
    const serialsSnap = await getDocs(
      collection(db, HP_IMEI_COLLECTION, phoneDocId, 'serials')
    );
    const availableCount = serialsSnap.docs.filter(
      (d) => d.data().status === 'available'
    ).length;

    await updateDoc(doc(db, HP_IMEI_COLLECTION, phoneDocId), {
      stock: availableCount,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to update phone stock count:', err);
  }
}

/**
 * Sinkronisasi pemotongan stok & status serial ke Cloud Firestore saat transaksi POS berhasil
 */
export async function syncCheckoutToFirestore(
  cart: Array<{
    product: Product & { docId?: string };
    quantity: number;
    selectedSerial?: ProductSerial;
  }>
): Promise<void> {
  try {
    for (const item of cart) {
      if (item.selectedSerial) {
        // Barang dengan IMEI (Handphone)
        const imeiToFind = item.selectedSerial.imei1;
        // Cari parent phone di hp_imei
        const phonesSnap = await getDocs(collection(db, HP_IMEI_COLLECTION));
        for (const phoneDoc of phonesSnap.docs) {
          const serialsSnap = await getDocs(
            collection(db, HP_IMEI_COLLECTION, phoneDoc.id, 'serials')
          );
          const matchedSerial = serialsSnap.docs.find(
            (s) => s.data().imei1 === imeiToFind
          );
          if (matchedSerial) {
            await updateDoc(
              doc(db, HP_IMEI_COLLECTION, phoneDoc.id, 'serials', matchedSerial.id),
              {
                status: 'sold',
                soldAt: new Date().toISOString(),
              }
            );
            // Recount available
            const updatedSerialsSnap = await getDocs(
              collection(db, HP_IMEI_COLLECTION, phoneDoc.id, 'serials')
            );
            const remaining = updatedSerialsSnap.docs.filter(
              (s) => s.data().status === 'available'
            ).length;
            await updateDoc(doc(db, HP_IMEI_COLLECTION, phoneDoc.id), {
              stock: remaining,
              updatedAt: new Date().toISOString(),
            });
            break;
          }
        }
      } else {
        // Aksesoris atau produk biasa
        const accSnap = await getDocs(collection(db, ACCESSORIES_COLLECTION));
        const matched = accSnap.docs.find((d) => {
          const data = d.data();
          return (
            d.id === (item.product as any).docId ||
            data.numericId === item.product.id ||
            (data.code && data.code === item.product.code) ||
            data.name === item.product.name
          );
        });

        if (matched) {
          const currentStock = Number(matched.data().stock || 0);
          const nextStock = Math.max(0, currentStock - item.quantity);
          await updateDoc(doc(db, ACCESSORIES_COLLECTION, matched.id), {
            stock: nextStock,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }
  } catch (err) {
    console.warn('Cloud Firestore inventory sync warning:', err);
  }
}

/**
 * Update data spesifikasi / harga tipe Handphone di Cloud Firestore
 */
export async function updatePhoneCloud(
  phoneDocId: string,
  updatedData: Partial<Product>,
  numericId?: number | string
): Promise<void> {
  const phoneRef = doc(db, HP_IMEI_COLLECTION, phoneDocId);
  const payload: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };

  if (updatedData.name !== undefined) payload.name = updatedData.name.trim();
  if (updatedData.brand !== undefined) payload.brand = updatedData.brand.trim();
  if (updatedData.variant !== undefined) payload.variant = updatedData.variant.trim();
  if (updatedData.code !== undefined) payload.code = updatedData.code.trim();
  if (updatedData.costPrice !== undefined) payload.costPrice = Number(updatedData.costPrice);
  if (updatedData.sellingPrice !== undefined) payload.sellingPrice = Number(updatedData.sellingPrice);
  if (updatedData.minStockAlert !== undefined) payload.minStockAlert = Number(updatedData.minStockAlert);

  await updateDoc(phoneRef, payload);

  // Sinkronkan ke API lokal jika numericId ada
  if (numericId && typeof numericId === 'number') {
    try {
      await fetch(`/api/products/${numericId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // quiet fail
    }
  }
}

/**
 * Hapus tipe Handphone beserta seluruh unit IMEI di sub-koleksinya dari Cloud Firestore
 */
export async function deletePhoneCloud(
  phoneDocId: string,
  numericId?: number | string
): Promise<void> {
  // 1. Hapus semua serial sub-koleksi
  try {
    const serialsSnap = await getDocs(
      collection(db, HP_IMEI_COLLECTION, phoneDocId, 'serials')
    );
    for (const sDoc of serialsSnap.docs) {
      await deleteDoc(doc(db, HP_IMEI_COLLECTION, phoneDocId, 'serials', sDoc.id));
    }
  } catch (err) {
    console.warn('Notice deleting serials before phone deletion:', err);
  }

  // 2. Hapus master phone doc
  await deleteDoc(doc(db, HP_IMEI_COLLECTION, phoneDocId));

  // 3. Sinkronkan ke API jika numericId ada
  if (numericId && typeof numericId === 'number') {
    try {
      await fetch(`/api/products/${numericId}`, { method: 'DELETE' });
    } catch {
      // quiet fail
    }
  }
}

/**
 * Update rincian nomor IMEI unit fisik di Cloud Firestore
 */
export async function updateSerialCloud(
  phoneDocId: string,
  serialDocId: string,
  serialData: Partial<ProductSerial>
): Promise<void> {
  const serialRef = doc(db, HP_IMEI_COLLECTION, phoneDocId, 'serials', serialDocId);
  const payload: Record<string, any> = {
    ...serialData,
    updatedAt: new Date().toISOString(),
  };

  await updateDoc(serialRef, payload);

  // Recount available stock
  try {
    const serialsSnap = await getDocs(
      collection(db, HP_IMEI_COLLECTION, phoneDocId, 'serials')
    );
    const availableCount = serialsSnap.docs.filter(
      (d) => d.data().status === 'available'
    ).length;

    await updateDoc(doc(db, HP_IMEI_COLLECTION, phoneDocId), {
      stock: availableCount,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to update phone stock on serial edit:', err);
  }
}

/**
 * Hapus satu unit nomor IMEI fisik dari Cloud Firestore dan kurangi total stok HP
 */
export async function deleteSerialCloud(
  phoneDocId: string,
  serialDocId: string,
  numericPhoneId?: number | string
): Promise<void> {
  // 1. Hapus dokumen serial dari subkoleksi
  await deleteDoc(doc(db, HP_IMEI_COLLECTION, phoneDocId, 'serials', serialDocId));

  // 2. Hitung ulang stok unit yang masih 'available'
  try {
    const serialsSnap = await getDocs(
      collection(db, HP_IMEI_COLLECTION, phoneDocId, 'serials')
    );
    const availableCount = serialsSnap.docs.filter(
      (d) => d.data().status === 'available'
    ).length;

    await updateDoc(doc(db, HP_IMEI_COLLECTION, phoneDocId), {
      stock: availableCount,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to update phone stock count on serial deletion:', err);
  }
}

/**
 * Ambil daftar unit IMEI berstatus 'available' langsung dari Cloud Firestore
 */
export async function fetchAvailableSerialsCloud(
  phoneDocId: string
): Promise<CloudSerialItem[]> {
  try {
    const serialsRef = collection(db, HP_IMEI_COLLECTION, phoneDocId, 'serials');
    const q = query(serialsRef, where('status', '==', 'available'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: data.numericId || docSnap.id,
        docId: docSnap.id,
        phoneDocId,
        productId: data.productId || phoneDocId,
        imei1: data.imei1 || '',
        imei2: data.imei2 || '',
        serialNumber: data.serialNumber || '',
        color: data.color || 'Black',
        ramStorage: data.ramStorage || '',
        status: 'available',
        purchasePrice: Number(data.purchasePrice || 0),
        createdAt: data.createdAt || new Date().toISOString(),
      };
    });
  } catch (err) {
    console.warn('Fetch available serials cloud error:', err);
    return [];
  }
}

/**
 * Memastikan kedua modul inventaris (Aksesoris & Smartphone) terinisialisasi data awalnya
 * saat aplikasi pertama kali dibuka / dideploy.
 */
export async function ensureCloudInventorySeeded(): Promise<void> {
  try {
    await Promise.allSettled([
      seedInitialAccessoriesIfEmpty(),
      seedInitialPhonesIfEmpty(),
    ]);
  } catch (err) {
    console.warn('Notice ensuring cloud inventory seeded:', err);
  }
}

/**
 * Mengembalikan stok produk dan mengaktifkan kembali status nomor IMEI ke Cloud Firestore
 * ketika struk / nota transaksi penjualan dihapus atau dibatalkan dari sistem.
 */
export async function restoreStockFromSaleCloud(
  items: Array<{
    productId?: any;
    productName: string;
    productCategory?: string;
    quantity: number;
    imeiOrSerial?: string;
  }>
): Promise<{ restoredAccessories: number; restoredPhones: number }> {
  let restoredAccessories = 0;
  let restoredPhones = 0;

  if (!items || items.length === 0) {
    return { restoredAccessories, restoredPhones };
  }

  try {
    for (const item of items) {
      const qty = Number(item.quantity || 1);
      const isHp =
        item.productCategory === 'Handphone & Gadget' ||
        Boolean(item.imeiOrSerial);

      if (isHp) {
        // 1. Ekstrak nomor IMEI dari catatan jika ada
        const imeiMatch = item.imeiOrSerial?.match(/(?:IMEI(?:\s*1)?:\s*)?([0-9]{14,16})/i);
        const imeiToFind = imeiMatch ? imeiMatch[1] : null;

        let restoredThisSerial = false;
        const phonesSnap = await getDocs(collection(db, HP_IMEI_COLLECTION));

        for (const phoneDoc of phonesSnap.docs) {
          const serialsSnap = await getDocs(
            collection(db, HP_IMEI_COLLECTION, phoneDoc.id, 'serials')
          );

          // Cari unit serial yang IMEI-nya cocok
          const matchedSerial = serialsSnap.docs.find((s) => {
            const data = s.data();
            if (imeiToFind && data.imei1 === imeiToFind) return true;
            return false;
          });

          if (matchedSerial) {
            // Aktifkan kembali unit fisik menjadi 'available'
            await updateDoc(
              doc(db, HP_IMEI_COLLECTION, phoneDoc.id, 'serials', matchedSerial.id),
              {
                status: 'available',
                saleId: null,
                soldAt: null,
                restoredAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            );

            // Hitung ulang stok unit yang tersedia
            const updatedSerialsSnap = await getDocs(
              collection(db, HP_IMEI_COLLECTION, phoneDoc.id, 'serials')
            );
            const remaining = updatedSerialsSnap.docs.filter(
              (s) => s.data().status === 'available'
            ).length;

            await updateDoc(doc(db, HP_IMEI_COLLECTION, phoneDoc.id), {
              stock: remaining,
              updatedAt: new Date().toISOString(),
            });

            restoredThisSerial = true;
            restoredPhones += 1;
            break;
          }
        }

        // Jika nomor IMEI spesifik tidak ditemukan di serials, pulihkan tipe HP berdasarkan nama atau ID
        if (!restoredThisSerial) {
          const matchedPhone = phonesSnap.docs.find((p) => {
            const data = p.data();
            return (
              p.id === item.productId ||
              String(data.numericId) === String(item.productId) ||
              data.name?.toLowerCase().trim() === item.productName?.toLowerCase().trim()
            );
          });

          if (matchedPhone) {
            // Cek apakah ada serial dengan status 'sold' yang bisa diaktifkan kembali
            const serialsSnap = await getDocs(
              collection(db, HP_IMEI_COLLECTION, matchedPhone.id, 'serials')
            );
            const soldSerial = serialsSnap.docs.find((s) => s.data().status === 'sold');
            if (soldSerial) {
              await updateDoc(
                doc(db, HP_IMEI_COLLECTION, matchedPhone.id, 'serials', soldSerial.id),
                {
                  status: 'available',
                  saleId: null,
                  soldAt: null,
                  restoredAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              );
            }

            const updatedSerialsSnap = await getDocs(
              collection(db, HP_IMEI_COLLECTION, matchedPhone.id, 'serials')
            );
            const remaining = updatedSerialsSnap.docs.filter(
              (s) => s.data().status === 'available'
            ).length;

            const finalStock =
              remaining > 0 ? remaining : Number(matchedPhone.data().stock || 0) + qty;

            await updateDoc(doc(db, HP_IMEI_COLLECTION, matchedPhone.id), {
              stock: finalStock,
              updatedAt: new Date().toISOString(),
            });
            restoredPhones += 1;
          }
        }
      } else {
        // 2. Aksesoris & Sparepart
        const accSnap = await getDocs(collection(db, ACCESSORIES_COLLECTION));
        const matched = accSnap.docs.find((d) => {
          const data = d.data();
          return (
            d.id === item.productId ||
            String(data.numericId) === String(item.productId) ||
            data.name?.toLowerCase().trim() === item.productName?.toLowerCase().trim()
          );
        });

        if (matched) {
          const currentStock = Number(matched.data().stock || 0);
          const restoredStock = currentStock + qty;
          await updateDoc(doc(db, ACCESSORIES_COLLECTION, matched.id), {
            stock: restoredStock,
            updatedAt: new Date().toISOString(),
          });
          restoredAccessories += qty;
        }
      }
    }
  } catch (err) {
    console.warn('Gagal memulihkan stok inventaris Cloud Firestore:', err);
  }

  return { restoredAccessories, restoredPhones };
}

