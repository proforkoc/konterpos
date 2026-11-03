import { db } from '../index.ts';
import { storeExpenses } from '../schema.ts';
import { desc, eq, and, gte, lte } from 'drizzle-orm';

export interface CreateExpensePayload {
  category: string; // 'sewa_tempat' | 'listrik_air' | 'koneksi_internet' | 'gaji_karyawan' | 'atk_nota_kertas' | 'kredit_tool_server' | 'operasional_harian' | 'lainnya'
  title: string;
  amount: number;
  expenseDate: string; // YYYY-MM-DD
  paidBy?: string;
  notes?: string;
}

export async function createExpense(payload: CreateExpensePayload) {
  try {
    const [expense] = await db
      .insert(storeExpenses)
      .values({
        category: payload.category,
        title: payload.title,
        amount: payload.amount,
        expenseDate: payload.expenseDate,
        paidBy: payload.paidBy || 'cash',
        notes: payload.notes || null,
      })
      .returning();

    return expense;
  } catch (error) {
    console.error('Failed to create store expense:', error);
    throw new Error('Gagal mencatat pengeluaran operasional toko', { cause: error });
  }
}

export async function getExpenses(filter?: {
  startDate?: string;
  endDate?: string;
  category?: string;
}) {
  try {
    const conditions = [];

    if (filter?.category && filter.category !== 'all') {
      conditions.push(eq(storeExpenses.category, filter.category));
    }
    if (filter?.startDate) {
      conditions.push(gte(storeExpenses.expenseDate, filter.startDate));
    }
    if (filter?.endDate) {
      conditions.push(lte(storeExpenses.expenseDate, filter.endDate));
    }

    const query = db
      .select()
      .from(storeExpenses)
      .orderBy(desc(storeExpenses.expenseDate), desc(storeExpenses.id));

    return conditions.length > 0 ? await query.where(and(...conditions)) : await query;
  } catch (error) {
    console.error('Failed to get expenses:', error);
    throw new Error('Gagal mengambil daftar pengeluaran toko', { cause: error });
  }
}

export async function deleteExpense(id: number) {
  try {
    await db.delete(storeExpenses).where(eq(storeExpenses.id, id));
    return true;
  } catch (error) {
    console.error('Failed to delete expense:', error);
    throw new Error('Gagal menghapus catatan pengeluaran', { cause: error });
  }
}
