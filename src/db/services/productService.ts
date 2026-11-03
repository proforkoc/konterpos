import { db } from '../index.ts';
import { products, productSerials, categories } from '../schema.ts';
import { eq, and, ilike, or, lte, desc } from 'drizzle-orm';

export interface ProductFilter {
  categoryId?: number;
  search?: string;
  lowStockOnly?: boolean;
}

export async function getProducts(filter?: ProductFilter) {
  try {
    const conditions = [];

    if (filter?.categoryId) {
      conditions.push(eq(products.categoryId, filter.categoryId));
    }

    if (filter?.search) {
      const q = `%${filter.search}%`;
      conditions.push(
        or(
          ilike(products.name, q),
          ilike(products.code, q),
          ilike(products.brand, q),
          ilike(products.model, q)
        )
      );
    }

    const query = db
      .select({
        id: products.id,
        categoryId: products.categoryId,
        categoryName: categories.name,
        categoryCode: categories.code,
        code: products.code,
        name: products.name,
        brand: products.brand,
        model: products.model,
        variant: products.variant,
        costPrice: products.costPrice,
        sellingPrice: products.sellingPrice,
        stock: products.stock,
        minStockAlert: products.minStockAlert,
        isImeiTracked: products.isImeiTracked,
        unit: products.unit,
        createdAt: products.createdAt,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .orderBy(desc(products.id));

    let result = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    if (filter?.lowStockOnly) {
      result = result.filter(p => p.stock <= p.minStockAlert);
    }

    return result;
  } catch (error) {
    console.error('Failed to get products:', error);
    throw new Error('Gagal mengambil data produk', { cause: error });
  }
}

export const MAX_PG_INT = 2147483647;

export function isValidPgIntegerId(id: unknown): id is number {
  if (typeof id !== 'number' || isNaN(id) || !Number.isInteger(id)) {
    return false;
  }
  return id > 0 && id <= MAX_PG_INT;
}

export async function getProductById(id: number) {
  if (!isValidPgIntegerId(id)) {
    return null;
  }
  try {
    const list = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    return list[0] || null;
  } catch (error) {
    console.error('Failed to get product by id:', error);
    throw new Error('Gagal mengambil detail produk', { cause: error });
  }
}

export async function getAvailableSerials(productId: number) {
  if (!isValidPgIntegerId(productId)) {
    return [];
  }
  try {
    return await db
      .select()
      .from(productSerials)
      .where(
        and(
          eq(productSerials.productId, productId),
          eq(productSerials.status, 'available')
        )
      );
  } catch (error) {
    console.error('Failed to get available serials:', error);
    throw new Error('Gagal mengambil daftar IMEI/SN produk', { cause: error });
  }
}

export async function getAllSerialsForProduct(productId: number) {
  if (!isValidPgIntegerId(productId)) {
    return [];
  }
  try {
    return await db
      .select()
      .from(productSerials)
      .where(eq(productSerials.productId, productId))
      .orderBy(desc(productSerials.id));
  } catch (error) {
    console.error('Failed to get serials for product:', error);
    throw new Error('Gagal mengambil data serials', { cause: error });
  }
}

export async function createProduct(data: {
  categoryId: number;
  code: string;
  name: string;
  brand?: string;
  model?: string;
  variant?: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStockAlert?: number;
  isImeiTracked?: boolean;
  unit?: string;
  initialImeis?: Array<{
    imei1: string;
    imei2?: string;
    serialNumber?: string;
    color?: string;
    ramStorage?: string;
    purchasePrice?: number;
    notes?: string;
  }>;
}) {
  try {
    return await db.transaction(async (tx) => {
      const [newProduct] = await tx
        .insert(products)
        .values({
          categoryId: data.categoryId,
          code: data.code,
          name: data.name,
          brand: data.brand || null,
          model: data.model || null,
          variant: data.variant || null,
          costPrice: data.costPrice,
          sellingPrice: data.sellingPrice,
          stock: data.isImeiTracked && data.initialImeis ? data.initialImeis.length : data.stock,
          minStockAlert: data.minStockAlert ?? 3,
          isImeiTracked: Boolean(data.isImeiTracked),
          unit: data.unit || 'pcs',
        })
        .returning();

      if (data.isImeiTracked && data.initialImeis && data.initialImeis.length > 0) {
        for (const imei of data.initialImeis) {
          if (imei.imei1) {
            await tx.insert(productSerials).values({
              productId: newProduct.id,
              imei1: imei.imei1,
              imei2: imei.imei2 || null,
              serialNumber: imei.serialNumber || null,
              color: imei.color || null,
              ramStorage: imei.ramStorage || null,
              purchasePrice: imei.purchasePrice ?? data.costPrice,
              status: 'available',
              notes: imei.notes || null,
            });
          }
        }
      }

      return newProduct;
    });
  } catch (error) {
    console.error('Failed to create product:', error);
    throw new Error('Gagal menambahkan produk baru', { cause: error });
  }
}

export async function addImeiToProduct(productId: number, data: {
  imei1: string;
  imei2?: string;
  serialNumber?: string;
  color?: string;
  ramStorage?: string;
  purchasePrice?: number;
  notes?: string;
}) {
  if (!isValidPgIntegerId(productId)) {
    throw new Error('ID produk tidak valid untuk PostgreSQL');
  }
  try {
    return await db.transaction(async (tx) => {
      const [product] = await tx.select().from(products).where(eq(products.id, productId));
      if (!product) throw new Error('Produk tidak ditemukan');

      const [newSerial] = await tx
        .insert(productSerials)
        .values({
          productId,
          imei1: data.imei1,
          imei2: data.imei2 || null,
          serialNumber: data.serialNumber || null,
          color: data.color || null,
          ramStorage: data.ramStorage || null,
          purchasePrice: data.purchasePrice ?? product.costPrice,
          status: 'available',
          notes: data.notes || null,
        })
        .returning();

      // Increment product stock
      await tx
        .update(products)
        .set({ stock: product.stock + 1 })
        .where(eq(products.id, productId));

      return newSerial;
    });
  } catch (error) {
    console.error('Failed to add IMEI to product:', error);
    throw new Error('Gagal mendaftarkan IMEI baru ke produk', { cause: error });
  }
}

export async function updateProduct(id: number, data: Partial<{
  categoryId: number;
  code: string;
  name: string;
  brand: string;
  model: string;
  variant: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStockAlert: number;
  isImeiTracked: boolean;
  unit: string;
}>) {
  if (!isValidPgIntegerId(id)) {
    return null;
  }
  try {
    const [updated] = await db
      .update(products)
      .set(data)
      .where(eq(products.id, id))
      .returning();
    return updated;
  } catch (error) {
    console.error('Failed to update product:', error);
    throw new Error('Gagal memperbarui data produk', { cause: error });
  }
}

export async function deleteProduct(id: number) {
  if (!isValidPgIntegerId(id)) {
    return false;
  }
  try {
    await db.delete(products).where(eq(products.id, id));
    return true;
  } catch (error) {
    console.error('Failed to delete product:', error);
    throw new Error('Gagal menghapus produk (pastikan tidak memiliki riwayat transaksi)', { cause: error });
  }
}
