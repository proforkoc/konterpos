import { db } from '../src/db/index.ts';
import {
  categories,
  products,
  productSerials,
  digitalFinancialTransactions,
  serviceSoftwareOrders,
} from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';
import {
  INITIAL_MOCK_ACCESSORIES,
  INITIAL_MOCK_PHONES,
  INITIAL_MOCK_PHONE_SERIALS,
  INITIAL_MOCK_DIGITAL_TRANSACTIONS,
  INITIAL_MOCK_SERVICE_ORDERS,
} from '../src/lib/mockData.ts';

async function seed() {
  console.log('--- Starting Realistic Mock Data Seeding ---');

  // 1. Ensure Categories
  const existingCats = await db.select().from(categories);
  const catMap: Record<string, number> = {};
  for (const c of existingCats) {
    catMap[c.code] = c.id;
  }

  const hpCatId = catMap['hp'] || 1;
  const accCatId = catMap['aksesoris'] || 2;

  // 2. Seed Accessories (10 SKU)
  console.log('Seeding 10 Accessories SKUs...');
  for (const acc of INITIAL_MOCK_ACCESSORIES) {
    const existing = await db
      .select()
      .from(products)
      .where(eq(products.code, acc.code));

    if (existing.length === 0) {
      await db.insert(products).values({
        categoryId: accCatId,
        code: acc.code,
        name: acc.name,
        brand: acc.brand,
        model: acc.model,
        variant: acc.variant,
        costPrice: acc.costPrice,
        sellingPrice: acc.sellingPrice,
        stock: acc.stock,
        minStockAlert: acc.minStockAlert,
        isImeiTracked: false,
        unit: 'pcs',
      });
      console.log(`+ Inserted Accessory: ${acc.code} - ${acc.name}`);
    } else {
      await db
        .update(products)
        .set({
          name: acc.name,
          brand: acc.brand,
          model: acc.model,
          variant: acc.variant,
          costPrice: acc.costPrice,
          sellingPrice: acc.sellingPrice,
          stock: acc.stock,
          minStockAlert: acc.minStockAlert,
        })
        .where(eq(products.code, acc.code));
      console.log(`~ Updated Accessory: ${acc.code}`);
    }
  }

  // 3. Seed Phones & IMEIs (9 Models, 16+ Serials)
  console.log('Seeding 9 Phone Models and IMEI Serials...');
  for (const phone of INITIAL_MOCK_PHONES) {
    let productId: number;
    const existing = await db
      .select()
      .from(products)
      .where(eq(products.code, phone.code));

    if (existing.length === 0) {
      const [inserted] = await db
        .insert(products)
        .values({
          categoryId: hpCatId,
          code: phone.code,
          name: phone.name,
          brand: phone.brand,
          model: phone.model,
          variant: phone.variant,
          costPrice: phone.costPrice,
          sellingPrice: phone.sellingPrice,
          stock: phone.stock,
          minStockAlert: phone.minStockAlert,
          isImeiTracked: true,
          unit: 'unit',
        })
        .returning();
      productId = inserted.id;
      console.log(`+ Inserted Phone: ${phone.code} - ${phone.name}`);
    } else {
      productId = existing[0].id;
      await db
        .update(products)
        .set({
          name: phone.name,
          brand: phone.brand,
          model: phone.model,
          variant: phone.variant,
          costPrice: phone.costPrice,
          sellingPrice: phone.sellingPrice,
          minStockAlert: phone.minStockAlert,
        })
        .where(eq(products.id, productId));
      console.log(`~ Updated Phone: ${phone.code}`);
    }

    // Insert serials for this phone
    const mockSerials = INITIAL_MOCK_PHONE_SERIALS[phone.id] || [];
    for (const serial of mockSerials) {
      const existingSerial = await db
        .select()
        .from(productSerials)
        .where(eq(productSerials.imei1, serial.imei1));

      if (existingSerial.length === 0) {
        await db.insert(productSerials).values({
          productId,
          imei1: serial.imei1,
          imei2: serial.imei2 || null,
          serialNumber: serial.serialNumber || null,
          color: serial.color || null,
          ramStorage: serial.ramStorage || null,
          status: serial.status,
          purchasePrice: serial.purchasePrice,
        });
        console.log(`  + Serial IMEI: ${serial.imei1} (${serial.color})`);
      }
    }

    // Recalculate available stock for this phone
    const availableSerials = await db
      .select()
      .from(productSerials)
      .where(eq(productSerials.productId, productId));
    const availCount = availableSerials.filter((s) => s.status === 'available').length;
    await db
      .update(products)
      .set({ stock: availCount })
      .where(eq(products.id, productId));
  }

  // 4. Seed Digital Transactions (11 Transactions)
  console.log('Seeding 11 Digital Finance Transactions...');
  for (const tx of INITIAL_MOCK_DIGITAL_TRANSACTIONS) {
    const existingTx = await db
      .select()
      .from(digitalFinancialTransactions)
      .where(eq(digitalFinancialTransactions.referenceNumber, tx.referenceNumber || ''));

    if (existingTx.length === 0) {
      await db.insert(digitalFinancialTransactions).values({
        type: tx.type,
        provider: tx.provider,
        targetAccount: tx.targetAccount,
        customerName: tx.customerName || null,
        nominal: tx.nominal,
        adminBankCost: tx.adminBankCost,
        adminStoreFee: tx.adminStoreFee,
        totalCustomerPaid: tx.totalCustomerPaid,
        profit: tx.profit,
        paymentMethod: tx.paymentMethod || 'cash',
        referenceNumber: tx.referenceNumber || null,
        status: tx.status,
        notes: tx.notes || null,
      });
      console.log(`+ Inserted Digital Tx: ${tx.referenceNumber} (${tx.provider})`);
    }
  }

  // 5. Seed Service Software Orders (7 Orders)
  console.log('Seeding 7 Service Software Orders...');
  for (const srv of INITIAL_MOCK_SERVICE_ORDERS) {
    const existingSrv = await db
      .select()
      .from(serviceSoftwareOrders)
      .where(eq(serviceSoftwareOrders.orderNumber, srv.orderNumber));

    if (existingSrv.length === 0) {
      await db.insert(serviceSoftwareOrders).values({
        orderNumber: srv.orderNumber,
        customerName: srv.customerName,
        customerPhone: srv.customerPhone,
        deviceModel: srv.deviceModel,
        deviceImei: srv.deviceImei || null,
        deviceColor: srv.deviceColor || null,
        issueType: srv.issueType,
        issueDetails: srv.issueDetails || null,
        toolsUsed: srv.toolsUsed || null,
        toolCost: srv.toolCost,
        estimatedCost: srv.estimatedCost,
        finalCost: srv.finalCost,
        downPayment: srv.downPayment,
        balanceDue: srv.balanceDue,
        status: srv.status,
        technicianNotes: srv.technicianNotes || null,
      });
      console.log(`+ Inserted Service Order: ${srv.orderNumber} - ${srv.deviceModel}`);
    }
  }

  console.log('--- Seeding Completed Successfully! ---');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
