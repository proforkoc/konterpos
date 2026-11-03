-- =====================================================================
-- SKEMA BASIS DATA POSTGRESQL LENGKAP: POS & MANAJEMEN USAHA KONTER HP
-- Mendukung 6 Pilar: Penjualan HP & IMEI, Aksesoris, Agen BRILink/Bank,
-- E-Wallet, PPOB & Pulsa, Servis Software HP, dan Laba/Rugi Otomatis
-- =====================================================================

-- 1. Tabel Kategori Usaha
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE, -- 'hp', 'aksesoris', 'ppob_pulsa', 'ppob_tagihan', 'digital_money', 'service_software'
    description TEXT,
    icon VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabel Produk (HP, Aksesoris, Sparepart, Paket Data)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
    code VARCHAR(100) NOT NULL UNIQUE, -- Barcode / SKU
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    variant VARCHAR(150),
    cost_price INT NOT NULL DEFAULT 0, -- Harga Modal Pokok (HPP)
    selling_price INT NOT NULL DEFAULT 0, -- Harga Jual Konsumen
    stock INT NOT NULL DEFAULT 0, -- Jumlah stok fisik tersedia
    min_stock_alert INT NOT NULL DEFAULT 3, -- Ambang batas peringatan stok menipis
    is_imei_tracked BOOLEAN DEFAULT FALSE, -- Wajib pelacakan IMEI jika produk HP
    unit VARCHAR(20) DEFAULT 'pcs',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index untuk pencarian cepat barcode/SKU & kategori
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);

-- 3. Tabel Pelacakan Serial Number & Nomor IMEI (Khusus Handphone)
CREATE TABLE IF NOT EXISTS product_serials (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE RESTRICT,
    imei1 VARCHAR(30) NOT NULL,
    imei2 VARCHAR(30),
    serial_number VARCHAR(100),
    color VARCHAR(50),
    ram_storage VARCHAR(50),
    status VARCHAR(30) NOT NULL DEFAULT 'available', -- 'available', 'sold', 'transferred', 'returned'
    purchase_price INT NOT NULL DEFAULT 0,
    sale_id INTEGER, -- Terhubung saat unit terjual
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sold_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_serials_imei1 ON product_serials(imei1);
CREATE INDEX IF NOT EXISTS idx_serials_status ON product_serials(status);
CREATE INDEX IF NOT EXISTS idx_serials_product ON product_serials(product_id);

-- 4. Tabel Transaksi Keuangan Digital & Agen (BRILink, Transfer Bank, E-Wallet, PPOB)
CREATE TABLE IF NOT EXISTS digital_financial_transactions (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- 'brilink_transfer', 'brilink_tarik_tunai', 'topup_ewallet', 'ppob_pulsa', 'ppob_token_pln', 'ppob_tagihan'
    provider VARCHAR(50) NOT NULL, -- 'BRI', 'BCA', 'DANA', 'OVO', 'GOPAY', 'SHOPEEPAY', 'PLN', 'TELKOMSEL', dll.
    target_account VARCHAR(100) NOT NULL, -- No Rekening / No HP E-wallet / ID Pelanggan PLN
    customer_name VARCHAR(150),
    nominal INT NOT NULL, -- Nilai transfer / top-up
    admin_bank_cost INT NOT NULL DEFAULT 0, -- Modal potong admin dari Bank/Aplikasi ke saldo agen
    admin_store_fee INT NOT NULL DEFAULT 0, -- Biaya admin jasa konter yang dibebankan ke pembeli
    total_customer_paid INT NOT NULL, -- Total yang diserahkan pelanggan (nominal + admin_store_fee)
    profit INT NOT NULL, -- Laba bersih transaksi = (admin_store_fee - admin_bank_cost)
    payment_method VARCHAR(30) DEFAULT 'cash', -- 'cash', 'transfer'
    reference_number VARCHAR(100), -- No Referensi Bank / Serial Number struk
    status VARCHAR(30) NOT NULL DEFAULT 'success', -- 'success', 'pending', 'failed'
    cashier_uid TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_digifin_created ON digital_financial_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_digifin_type ON digital_financial_transactions(type);

-- 5. Tabel Pesanan Servis Software HP & Log Pemakaian Tool/Kredit
CREATE TABLE IF NOT EXISTS service_software_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE, -- e.g. SRV-20261019-001
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    device_model VARCHAR(150) NOT NULL, -- e.g. 'Redmi Note 12', 'Samsung A54 5G'
    device_imei VARCHAR(50),
    device_color VARCHAR(50),
    issue_type VARCHAR(100) NOT NULL, -- 'Lupa Pola / FRP', 'Bootloop / Stuck Logo', 'Flash Firmware Official', 'Bypass MiCloud / ID', dll.
    issue_details TEXT,
    tools_used VARCHAR(255), -- 'UnlockTool (1 Credit EDL)', 'Pandora Box', 'AMT', 'Miracle Box', 'Hydra'
    tool_cost INT NOT NULL DEFAULT 0, -- Modal biaya kredit/token server yang dipakai teknisi
    estimated_cost INT NOT NULL DEFAULT 0, -- Estimasi total biaya servis
    final_cost INT NOT NULL DEFAULT 0, -- Biaya final yang disepakati
    down_payment INT NOT NULL DEFAULT 0, -- Uang muka (DP)
    balance_due INT NOT NULL DEFAULT 0, -- Sisa yang harus dilunasi
    status VARCHAR(30) NOT NULL DEFAULT 'received', -- 'received', 'in_progress', 'completed', 'picked_up', 'cancelled_failed'
    technician_uid TEXT,
    technician_notes TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    picked_up_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_service_order_no ON service_software_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_service_status ON service_software_orders(status);
CREATE INDEX IF NOT EXISTS idx_service_received ON service_software_orders(received_at);

-- 6. Tabel Pengeluaran Operasional Toko (Rekap Kas Keluar Toko)
CREATE TABLE IF NOT EXISTS store_expenses (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL, -- 'sewa_tempat', 'listrik_air', 'koneksi_internet', 'gaji_karyawan', 'atk_nota_kertas', 'kredit_tool_server', 'operasional_harian', 'lainnya'
    title VARCHAR(255) NOT NULL,
    amount INT NOT NULL,
    expense_date DATE NOT NULL,
    paid_by VARCHAR(50) DEFAULT 'cash',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON store_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON store_expenses(category);

-- 7. Tabel Transaksi Penjualan Kasir POS (Sales Header)
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL UNIQUE, -- e.g. INV-20261019-0001
    customer_name VARCHAR(150) DEFAULT 'Umum',
    customer_phone VARCHAR(50),
    subtotal INT NOT NULL,
    discount INT NOT NULL DEFAULT 0,
    grand_total INT NOT NULL,
    total_cost INT NOT NULL DEFAULT 0, -- Total Modal HPP seluruh item
    total_profit INT NOT NULL DEFAULT 0, -- Total Margin Laba Kotor = grand_total - total_cost
    payment_method VARCHAR(50) NOT NULL DEFAULT 'cash', -- 'cash', 'qris', 'transfer', 'split'
    amount_paid INT NOT NULL,
    change_amount INT NOT NULL DEFAULT 0,
    cashier_uid TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'completed', -- 'completed', 'cancelled'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);

-- 8. Tabel Item Penjualan (Sale Items Detail)
CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE RESTRICT,
    product_name VARCHAR(255) NOT NULL,
    product_category VARCHAR(100) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    cost_price INT NOT NULL DEFAULT 0,
    selling_price INT NOT NULL DEFAULT 0,
    subtotal INT NOT NULL DEFAULT 0,
    profit INT NOT NULL DEFAULT 0, -- (selling_price - cost_price) * quantity
    imei_or_serial VARCHAR(255), -- Mencatat nomor IMEI/SN jika barang HP
    product_serial_id INTEGER REFERENCES product_serials(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

-- =====================================================================
-- QUERY AGREGASI LAPORAN KEUANGAN & ANALISIS LABA/RUGI (P&L) OTOMATIS
-- =====================================================================

-- Contoh View / Query: Agregasi Omset & Laba Bersih Harian
-- Menghitung gabungan: Penjualan Fisik + Transaksi Digital/Agen + Jasa Servis - Beban Toko
/*
SELECT 
    CURRENT_DATE AS tanggal,
    COALESCE(s.sales_omset, 0) + COALESCE(d.digital_omset, 0) + COALESCE(srv.service_omset, 0) AS total_omset_bruto,
    COALESCE(s.sales_margin, 0) AS laba_kotor_produk,
    COALESCE(d.digital_fee_margin, 0) AS laba_agen_digital,
    COALESCE(srv.service_net_margin, 0) AS laba_jasa_servis,
    COALESCE(e.total_beban, 0) AS total_pengeluaran_operasional,
    (COALESCE(s.sales_margin, 0) + COALESCE(d.digital_fee_margin, 0) + COALESCE(srv.service_net_margin, 0)) - COALESCE(e.total_beban, 0) AS laba_bersih_netto
FROM (
    SELECT SUM(grand_total) AS sales_omset, SUM(total_profit) AS sales_margin 
    FROM sales WHERE DATE(created_at) = CURRENT_DATE AND status = 'completed'
) s
CROSS JOIN (
    SELECT SUM(total_customer_paid) AS digital_omset, SUM(profit) AS digital_fee_margin 
    FROM digital_financial_transactions WHERE DATE(created_at) = CURRENT_DATE AND status = 'success'
) d
CROSS JOIN (
    SELECT SUM(final_cost) AS service_omset, SUM(final_cost - tool_cost) AS service_net_margin 
    FROM service_software_orders WHERE DATE(completed_at) = CURRENT_DATE AND status IN ('completed', 'picked_up')
) srv
CROSS JOIN (
    SELECT SUM(amount) AS total_beban 
    FROM store_expenses WHERE expense_date = CURRENT_DATE
) e;
*/
