import { db } from '../index.ts';
import { categories } from '../schema.ts';
import { asc } from 'drizzle-orm';

export async function getAllCategories() {
  try {
    return await db.select().from(categories).orderBy(asc(categories.id));
  } catch (error) {
    console.error('Failed to get categories:', error);
    throw new Error('Gagal mengambil data kategori', { cause: error });
  }
}
