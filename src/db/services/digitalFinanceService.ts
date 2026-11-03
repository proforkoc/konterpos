import { db } from '../index.ts';
import { digitalFinancialTransactions } from '../schema.ts';
import { desc, eq, and, or, ilike } from 'drizzle-orm';

export interface DigitalTransactionPayload {
  type: string; // 'brilink_transfer' | 'brilink_tarik_tunai' | 'topup_ewallet' | 'ppob_pulsa' | 'ppob_token_pln' | 'ppob_tagihan'
  provider: string; // BRI, BCA, DANA, OVO, GOPAY, PLN, etc.
  targetAccount: string;
  customerName?: string;
  nominal: number;
  adminBankCost: number; // Modal biaya bank/aplikasi
  adminStoreFee: number; // Biaya admin jasa toko
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
  cashierUid?: string;
}

export async function createDigitalTransaction(payload: DigitalTransactionPayload) {
  try {
    const totalCustomerPaid = payload.nominal + payload.adminStoreFee;
    const profit = payload.adminStoreFee - payload.adminBankCost;

    // Generate reference number if not provided
    const ref = payload.referenceNumber || 
      `${payload.provider.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const [record] = await db
      .insert(digitalFinancialTransactions)
      .values({
        type: payload.type,
        provider: payload.provider.toUpperCase(),
        targetAccount: payload.targetAccount,
        customerName: payload.customerName || 'Pelanggan',
        nominal: payload.nominal,
        adminBankCost: payload.adminBankCost,
        adminStoreFee: payload.adminStoreFee,
        totalCustomerPaid,
        profit,
        paymentMethod: payload.paymentMethod || 'cash',
        referenceNumber: ref,
        status: 'success',
        cashierUid: payload.cashierUid || null,
        notes: payload.notes || null,
      })
      .returning();

    return record;
  } catch (error) {
    console.error('Failed to create digital financial transaction:', error);
    throw new Error('Gagal mencatat transaksi keuangan digital / keagenan', { cause: error });
  }
}

export async function getDigitalTransactions(filter?: {
  type?: string;
  provider?: string;
  search?: string;
  limit?: number;
}) {
  try {
    const conditions = [];

    if (filter?.type) {
      conditions.push(eq(digitalFinancialTransactions.type, filter.type));
    }
    if (filter?.provider) {
      conditions.push(eq(digitalFinancialTransactions.provider, filter.provider.toUpperCase()));
    }
    if (filter?.search) {
      const q = `%${filter.search}%`;
      conditions.push(
        or(
          ilike(digitalFinancialTransactions.targetAccount, q),
          ilike(digitalFinancialTransactions.customerName, q),
          ilike(digitalFinancialTransactions.referenceNumber, q)
        )
      );
    }

    const query = db
      .select()
      .from(digitalFinancialTransactions)
      .orderBy(desc(digitalFinancialTransactions.id))
      .limit(filter?.limit ?? 50);

    return conditions.length > 0 ? await query.where(and(...conditions)) : await query;
  } catch (error) {
    console.error('Failed to get digital transactions:', error);
    throw new Error('Gagal mengambil data transaksi keuangan digital', { cause: error });
  }
}

export async function getDigitalTransactionById(id: number) {
  if (typeof id !== 'number' || isNaN(id) || !Number.isInteger(id) || id <= 0 || id > 2147483647) {
    return null;
  }
  try {
    const [record] = await db
      .select()
      .from(digitalFinancialTransactions)
      .where(eq(digitalFinancialTransactions.id, id));

    return record || null;
  } catch (error) {
    console.error('Failed to get digital transaction by id:', error);
    throw new Error('Gagal mengambil detail transaksi', { cause: error });
  }
}

export async function deleteDigitalTransaction(id: number, referenceNumber?: string) {
  try {
    const isIdValid = typeof id === 'number' && Number.isInteger(id) && id > 0 && id <= 2147483647;
    let condition;
    if (referenceNumber && isIdValid) {
      condition = or(eq(digitalFinancialTransactions.id, id), eq(digitalFinancialTransactions.referenceNumber, referenceNumber));
    } else if (referenceNumber) {
      condition = eq(digitalFinancialTransactions.referenceNumber, referenceNumber);
    } else if (isIdValid) {
      condition = eq(digitalFinancialTransactions.id, id);
    } else {
      return null;
    }

    const [deleted] = await db
      .delete(digitalFinancialTransactions)
      .where(condition)
      .returning();
    return deleted || null;
  } catch (error) {
    console.error('Failed to delete digital transaction:', error);
    throw new Error('Gagal menghapus mutasi transaksi digital', { cause: error });
  }
}
