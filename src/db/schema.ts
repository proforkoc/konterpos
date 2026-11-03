import { pgTable, serial, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Users Table (Integrated with Firebase Auth)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  role: text('role').notNull().default('cashier'), // owner, manager, cashier, technician
  pin: text('pin').default('1234'), // 4-digit POS Cashier PIN
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Categories Table
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(), // hp, aksesoris, ppob_pulsa, digital_money, service_software, other
  description: text('description'),
  icon: text('icon'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 3. Products Table (HP, Aksesoris, Voucher, Pulsa/PPOB)
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id),
  code: text('code').notNull().unique(), // Barcode / SKU
  name: text('name').notNull(),
  brand: text('brand'),
  model: text('model'),
  variant: text('variant'), // e.g. "8/256GB Black", "Type-C 65W"
  costPrice: integer('cost_price').notNull().default(0), // Harga Modal
  sellingPrice: integer('selling_price').notNull().default(0), // Harga Jual
  stock: integer('stock').notNull().default(0), // Total stok fisik
  minStockAlert: integer('min_stock_alert').notNull().default(3), // Batas stok minimum
  isImeiTracked: boolean('is_imei_tracked').default(false), // True untuk HP
  unit: text('unit').default('pcs'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. Product Serials / IMEI Table (Pelacakan IMEI HP Barang Masuk & Terjual)
export const productSerials = pgTable('product_serials', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id),
  imei1: text('imei1').notNull(),
  imei2: text('imei2'),
  serialNumber: text('serial_number'),
  color: text('color'),
  ramStorage: text('ram_storage'),
  status: text('status').notNull().default('available'), // 'available', 'sold', 'transferred', 'returned'
  purchasePrice: integer('purchase_price').notNull().default(0),
  saleId: integer('sale_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  soldAt: timestamp('sold_at'),
});

// 5. Digital Financial Transactions (Agen BRILink, Transfer Bank, E-Wallet & PPOB)
export const digitalFinancialTransactions = pgTable('digital_financial_transactions', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), // 'brilink_transfer', 'brilink_tarik_tunai', 'topup_ewallet', 'ppob_pulsa', 'ppob_token_pln', 'ppob_tagihan'
  provider: text('provider').notNull(), // BRI, BCA, Mandiri, BNI, DANA, OVO, GOPAY, SHOPEEPAY, LINKAJA, PLN, TELKOMSEL, dll.
  targetAccount: text('target_account').notNull(), // No Rekening / No HP / ID Pelanggan
  customerName: text('customer_name'),
  nominal: integer('nominal').notNull(), // Nominal uang yang dikirim / ditopup
  adminBankCost: integer('admin_bank_cost').notNull().default(0), // Modal biaya admin dari bank / aplikasi
  adminStoreFee: integer('admin_store_fee').notNull().default(0), // Biaya admin toko yang ditagihkan ke pelanggan
  totalCustomerPaid: integer('total_customer_paid').notNull(), // nominal + adminStoreFee
  profit: integer('profit').notNull(), // adminStoreFee - adminBankCost
  paymentMethod: text('payment_method').default('cash'), // cash / transfer
  referenceNumber: text('reference_number'), // No Bukti / Reff / SN
  status: text('status').notNull().default('success'), // success, pending, failed
  cashierUid: text('cashier_uid'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 6. Service Software Orders (Modul Khusus Servis Software HP & Digital Tools Credit)
export const serviceSoftwareOrders = pgTable('service_software_orders', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(), // e.g. SRV-20261019-001
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  deviceModel: text('device_model').notNull(), // e.g. Redmi Note 11, Samsung A52
  deviceImei: text('device_imei'),
  deviceColor: text('device_color'),
  issueType: text('issue_type').notNull(), // Lupa Pola / FRP, Bootloop, Flash Firmware, Bypass MiCloud, Unbrick, dll.
  issueDetails: text('issue_details'),
  toolsUsed: text('tools_used'), // e.g. UnlockTool, Miracle Box, Pandora, AMT, Hydra
  toolCost: integer('tool_cost').notNull().default(0), // Biaya modal kredit server tool
  estimatedCost: integer('estimated_cost').notNull().default(0),
  finalCost: integer('final_cost').notNull().default(0),
  downPayment: integer('down_payment').notNull().default(0), // DP awal
  balanceDue: integer('balance_due').notNull().default(0), // Sisa yang harus dibayar
  status: text('status').notNull().default('received'), // received, in_progress, completed, picked_up, cancelled_failed
  technicianUid: text('technician_uid'),
  technicianNotes: text('technician_notes'),
  receivedAt: timestamp('received_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  pickedUpAt: timestamp('picked_up_at'),
});

// 7. Store Expenses (Beban Operasional Toko)
export const storeExpenses = pgTable('store_expenses', {
  id: serial('id').primaryKey(),
  category: text('category').notNull(), // sewa_tempat, listrik_air, internet, gaji, atk_nota, kredit_tool, operasional_harian, lainnya
  title: text('title').notNull(),
  amount: integer('amount').notNull(),
  expenseDate: text('expense_date').notNull(), // Format YYYY-MM-DD
  paidBy: text('paid_by').default('cash'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 8. Sales Table (Transaksi Penjualan POS Kasir)
export const sales = pgTable('sales', {
  id: serial('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(), // e.g. INV-20261019-0001
  customerName: text('customer_name').default('Umum'),
  customerPhone: text('customer_phone'),
  subtotal: integer('subtotal').notNull(),
  discount: integer('discount').notNull().default(0),
  grandTotal: integer('grand_total').notNull(),
  totalCost: integer('total_cost').notNull().default(0), // Total Modal Pokok (COGS)
  totalProfit: integer('total_profit').notNull().default(0), // grandTotal - totalCost
  paymentMethod: text('payment_method').notNull().default('cash'), // cash, qris, transfer, split
  amountPaid: integer('amount_paid').notNull(),
  changeAmount: integer('change_amount').notNull().default(0),
  cashierUid: text('cashier_uid'),
  status: text('status').notNull().default('completed'), // completed, cancelled
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 9. Sale Items Table
export const saleItems = pgTable('sale_items', {
  id: serial('id').primaryKey(),
  saleId: integer('sale_id').references(() => sales.id),
  productId: integer('product_id'),
  productName: text('product_name').notNull(),
  productCategory: text('product_category').notNull(),
  quantity: integer('quantity').notNull().default(1),
  costPrice: integer('cost_price').notNull().default(0),
  sellingPrice: integer('selling_price').notNull().default(0),
  subtotal: integer('subtotal').notNull().default(0),
  profit: integer('profit').notNull().default(0),
  imeiOrSerial: text('imei_or_serial'), // Catatan IMEI jika HP
  productSerialId: integer('product_serial_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  serials: many(productSerials),
  saleItems: many(saleItems),
}));

export const productSerialsRelations = relations(productSerials, ({ one }) => ({
  product: one(products, {
    fields: [productSerials.productId],
    references: [products.id],
  }),
}));

export const salesRelations = relations(sales, ({ many }) => ({
  items: many(saleItems),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
}));
