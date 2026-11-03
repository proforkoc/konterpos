import { Product, ProductSerial, DigitalTransaction, ServiceSoftwareOrder } from '../types/index.ts';

// 1. STOK AKSESORIS: Awal Kosong (Murni Array Kosong [])
export const INITIAL_MOCK_ACCESSORIES: Product[] = [];

// 2. HP & IMEI: Awal Kosong (Murni Array Kosong [])
export const INITIAL_MOCK_PHONES: Product[] = [];

export const INITIAL_MOCK_PHONE_SERIALS: Record<number, ProductSerial[]> = {};

// 3. AGEN DIGITAL: Awal Kosong (Murni Array Kosong [])
export const INITIAL_MOCK_DIGITAL_TRANSACTIONS: DigitalTransaction[] = [];

// 4. SERVICE SOFTWARE: Awal Kosong (Murni Array Kosong [])
export const INITIAL_MOCK_SERVICE_ORDERS: ServiceSoftwareOrder[] = [];
