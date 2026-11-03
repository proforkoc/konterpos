import { db } from '../index.ts';
import { sales, saleItems, products, productSerials } from '../schema.ts';
import { eq, desc, and, or, gte, lte } from 'drizzle-orm';

export interface CheckoutCartItem {
  productId?: any;
  productName: string;
  productCategory: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  isImeiTracked?: boolean;
  selectedSerialId?: any;
  imeiOrSerial?: string;
}

export interface CheckoutPayload {
  customerName?: string;
  customerPhone?: string;
  items: CheckoutCartItem[];
  discount?: number;
  paymentMethod: string; // 'cash' | 'qris' | 'transfer'
  amountPaid: number;
  cashierUid?: string;
  notes?: string;
}

export async function processCheckout(payload: CheckoutPayload) {
  try {
    return await db.transaction(async (tx) => {
      // 1. Calculate totals
      let subtotal = 0;
      let totalCost = 0;

      for (const item of payload.items) {
        subtotal += item.sellingPrice * item.quantity;
        totalCost += item.costPrice * item.quantity;
      }

      const discount = payload.discount ?? 0;
      const grandTotal = Math.max(0, subtotal - discount);
      const totalProfit = grandTotal - totalCost;
      const amountPaid = payload.amountPaid;
      const changeAmount = Math.max(0, amountPaid - grandTotal);

      // Generate invoice number: INV-YYYYMMDD-XXXX
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `INV-${dateStr}-${randomSuffix}`;

      // 2. Insert Sale Header
      const [sale] = await tx
        .insert(sales)
        .values({
          invoiceNumber,
          customerName: payload.customerName || 'Pelanggan Umum',
          customerPhone: payload.customerPhone || null,
          subtotal,
          discount,
          grandTotal,
          totalCost,
          totalProfit,
          paymentMethod: payload.paymentMethod || 'cash',
          amountPaid,
          changeAmount,
          cashierUid: payload.cashierUid || null,
          status: 'completed',
          notes: payload.notes || null,
        })
        .returning();

      // 3. Process items, deduct stock, and update IMEI
      const insertedItems = [];

      for (const item of payload.items) {
        const itemSubtotal = item.sellingPrice * item.quantity;
        const itemProfit = (item.sellingPrice - item.costPrice) * item.quantity;

        // Safely resolve valid 32-bit integer for productId in PostgreSQL
        let validProductId: number | null = null;
        const parsedProdId = Number(item.productId);
        if (
          !isNaN(parsedProdId) &&
          Number.isInteger(parsedProdId) &&
          parsedProdId > 0 &&
          parsedProdId <= 2147483647
        ) {
          const [existingProd] = await tx
            .select({ id: products.id })
            .from(products)
            .where(eq(products.id, parsedProdId));
          if (existingProd) {
            validProductId = existingProd.id;
          }
        }

        // If not matched by numeric ID, try finding product by exact name in database
        if (!validProductId && item.productName) {
          const [byName] = await tx
            .select({ id: products.id })
            .from(products)
            .where(eq(products.name, item.productName))
            .limit(1);
          if (byName) {
            validProductId = byName.id;
          }
        }

        // Safely resolve valid 32-bit integer for productSerialId in PostgreSQL
        let validSerialId: number | null = null;
        const parsedSerialId = Number(item.selectedSerialId);
        if (
          !isNaN(parsedSerialId) &&
          Number.isInteger(parsedSerialId) &&
          parsedSerialId > 0 &&
          parsedSerialId <= 2147483647
        ) {
          const [existingSerial] = await tx
            .select({ id: productSerials.id })
            .from(productSerials)
            .where(eq(productSerials.id, parsedSerialId));
          if (existingSerial) {
            validSerialId = existingSerial.id;
          }
        }

        const [saleItem] = await tx
          .insert(saleItems)
          .values({
            saleId: sale.id,
            productId: validProductId,
            productName: item.productName,
            productCategory: item.productCategory,
            quantity: item.quantity,
            costPrice: item.costPrice,
            sellingPrice: item.sellingPrice,
            subtotal: itemSubtotal,
            profit: itemProfit,
            imeiOrSerial: item.imeiOrSerial || null,
            productSerialId: validSerialId,
          })
          .returning();

        insertedItems.push(saleItem);

        // Deduct physical stock if valid product exists in SQL
        if (validProductId) {
          const [prod] = await tx
            .select({ stock: products.stock })
            .from(products)
            .where(eq(products.id, validProductId));

          if (prod) {
            const newStock = Math.max(0, prod.stock - item.quantity);
            await tx
              .update(products)
              .set({ stock: newStock })
              .where(eq(products.id, validProductId));
          }
        }

        // If IMEI tracked and valid serial exists, mark serial as sold
        if (validSerialId) {
          await tx
            .update(productSerials)
            .set({
              status: 'sold',
              saleId: sale.id,
              soldAt: new Date(),
            })
            .where(eq(productSerials.id, validSerialId));
        }
      }

      return {
        ...sale,
        items: insertedItems,
      };
    });
  } catch (error) {
    console.error('POS Checkout Transaction failed:', error);
    throw new Error('Gagal memproses transaksi kasir POS', { cause: error });
  }
}

export async function getSalesHistory(limit = 50) {
  try {
    const list = await db
      .select()
      .from(sales)
      .orderBy(desc(sales.id))
      .limit(limit);

    return list;
  } catch (error) {
    console.error('Failed to get sales history:', error);
    throw new Error('Gagal mengambil riwayat transaksi penjualan', { cause: error });
  }
}

export async function getSaleWithItems(saleId: number) {
  if (typeof saleId !== 'number' || isNaN(saleId) || !Number.isInteger(saleId) || saleId <= 0 || saleId > 2147483647) {
    return null;
  }
  try {
    const [sale] = await db
      .select()
      .from(sales)
      .where(eq(sales.id, saleId));

    if (!sale) return null;

    const items = await db
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, saleId));

    return {
      ...sale,
      items,
    };
  } catch (error) {
    console.error('Failed to get sale details:', error);
    throw new Error('Gagal mengambil rincian nota penjualan', { cause: error });
  }
}

export async function deleteSale(saleId: number, invoiceNumber?: string) {
  try {
    return await db.transaction(async (tx) => {
      const isValidSaleId = typeof saleId === 'number' && Number.isInteger(saleId) && saleId > 0 && saleId <= 2147483647;
      let targetSaleId: number | null = isValidSaleId ? saleId : null;
      if (invoiceNumber) {
        const queryConditions = [eq(sales.invoiceNumber, invoiceNumber)];
        if (targetSaleId !== null) {
          queryConditions.push(eq(sales.id, targetSaleId));
        }
        const [found] = await tx
          .select({ id: sales.id })
          .from(sales)
          .where(or(...queryConditions));
        if (found) targetSaleId = found.id;
      }

      if (!targetSaleId) {
        return { success: true, restoredItems: [] };
      }

      // 1. Fetch sale items to restore stock and serials
      const items = await tx
        .select()
        .from(saleItems)
        .where(eq(saleItems.saleId, targetSaleId));

      // 2. Restore physical stock for each item
      for (const item of items) {
        let prodId = item.productId;
        // Fallback: If prodId is null, search by productName in products
        if (!prodId && item.productName) {
          const [byName] = await tx
            .select({ id: products.id })
            .from(products)
            .where(eq(products.name, item.productName))
            .limit(1);
          if (byName) prodId = byName.id;
        }

        if (prodId) {
          const [prod] = await tx
            .select({ stock: products.stock })
            .from(products)
            .where(eq(products.id, prodId));

          if (prod) {
            await tx
              .update(products)
              .set({ stock: prod.stock + item.quantity })
              .where(eq(products.id, prodId));
          }
        }

        // 3. Restore serial status if IMEI tracked
        if (item.productSerialId) {
          await tx
            .update(productSerials)
            .set({
              status: 'available',
              saleId: null,
              soldAt: null,
            })
            .where(eq(productSerials.id, item.productSerialId));
        } else if (item.imeiOrSerial) {
          // Extract IMEI1 from string (e.g. "IMEI 1: 864219061029381 ...")
          const imeiMatch = item.imeiOrSerial.match(/(?:IMEI(?:\s*1)?:\s*)?([0-9]{14,16})/i);
          const imei1 = imeiMatch ? imeiMatch[1] : null;
          if (imei1) {
            await tx
              .update(productSerials)
              .set({
                status: 'available',
                saleId: null,
                soldAt: null,
              })
              .where(eq(productSerials.imei1, imei1));
          }
        }
      }

      // Also restore any serials that had saleId set to this sale
      await tx
        .update(productSerials)
        .set({
          status: 'available',
          saleId: null,
          soldAt: null,
        })
        .where(eq(productSerials.saleId, targetSaleId));

      // 4. Delete sale items
      await tx.delete(saleItems).where(eq(saleItems.saleId, targetSaleId));

      // 5. Delete sale record
      await tx.delete(sales).where(eq(sales.id, targetSaleId));

      return { success: true, restoredItems: items };
    });
  } catch (error) {
    console.error('Failed to delete sale:', error);
    throw new Error('Gagal menghapus nota penjualan', { cause: error });
  }
}

