import express, { Request, Response } from 'express';
import { getAllCategories } from '../db/services/categoryService.ts';
import {
  getProducts,
  getProductById,
  getAvailableSerials,
  getAllSerialsForProduct,
  createProduct,
  addImeiToProduct,
  updateProduct,
  deleteProduct,
} from '../db/services/productService.ts';
import {
  processCheckout,
  getSalesHistory,
  getSaleWithItems,
  deleteSale,
} from '../db/services/posService.ts';
import {
  createDigitalTransaction,
  getDigitalTransactions,
  getDigitalTransactionById,
  deleteDigitalTransaction,
} from '../db/services/digitalFinanceService.ts';
import {
  createServiceOrder,
  getServiceOrders,
  getServiceOrderById,
  updateServiceStatus,
  deleteServiceOrder,
} from '../db/services/softwareService.ts';
import {
  createExpense,
  getExpenses,
  deleteExpense,
} from '../db/services/expenseService.ts';
import { getFinancialSummary } from '../db/services/analyticsService.ts';
import { optionalAuth, AuthRequest } from '../middleware/auth.ts';
import {
  getOrCreateUser,
  getAllUsers,
  createUser,
  updateUserRole,
  deleteUser,
  verifyUserPin,
  updateUserPin,
  authenticateUser,
  updateUser,
} from '../db/users.ts';

export const apiRouter = express.Router();

apiRouter.use(express.json());
apiRouter.use(optionalAuth);

// Health check
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Standard User Login (Username / Email & Password / PIN)
apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username / Email dan Password wajib diisi' });
    }
    const result = await authenticateUser(String(identifier), String(password));
    if (!result.success) {
      return res.status(401).json({ error: result.message });
    }
    res.json({ success: true, user: result.user });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memproses login' });
  }
});

// Sync User from Firebase
apiRouter.post('/auth/sync', async (req: AuthRequest, res: Response) => {
  try {
    const { uid, email, name } = req.body;
    if (!uid || !email) {
      return res.status(400).json({ error: 'UID dan email wajib dikirim' });
    }
    const user = await getOrCreateUser(uid, email, name);
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal sinkronisasi user' });
  }
});

// PIN Quick Shift Login
apiRouter.post('/auth/pin-login', async (req: Request, res: Response) => {
  try {
    const { userId, pin } = req.body;
    if (!userId || !pin) {
      return res.status(400).json({ error: 'User ID dan PIN wajib diisi' });
    }
    const result = await verifyUserPin(Number(userId), String(pin));
    if (!result.success) {
      return res.status(401).json({ error: result.message });
    }
    res.json({ success: true, user: result.user });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal verifikasi PIN' });
  }
});

// Staff & User Management (RBAC)
apiRouter.get('/users', async (_req: Request, res: Response) => {
  try {
    const list = await getAllUsers();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat daftar staff pengguna' });
  }
});

apiRouter.post('/users', async (req: Request, res: Response) => {
  try {
    const { email, name, role, pin } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: 'Nama dan email staff wajib diisi' });
    }
    const created = await createUser({
      email,
      name,
      role: role || 'cashier',
      pin: pin || '1234',
    });
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal menambahkan staff' });
  }
});

apiRouter.patch('/users/:id/pin', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { pin } = req.body;
    if (!pin || String(pin).length < 4) {
      return res.status(400).json({ error: 'PIN minimal 4 digit' });
    }
    const updated = await updateUserPin(id, String(pin));
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memperbarui PIN' });
  }
});

apiRouter.patch('/users/:id/role', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ error: 'Role hak akses wajib dipilih' });
    }
    const updated = await updateUserRole(id, role);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memperbarui hak akses peran' });
  }
});

apiRouter.put('/users/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, role, pin } = req.body;
    if (pin !== undefined && String(pin).trim() !== '' && String(pin).trim().length < 4) {
      return res.status(400).json({ error: 'PIN baru harus minimal 4 digit angka' });
    }
    const updated = await updateUser(id, { name, role, pin });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memperbarui data staf pengguna' });
  }
});

apiRouter.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await deleteUser(id);
    res.json({ success: true, message: 'Akun staf berhasil dihapus' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Gagal menghapus pengguna' });
  }
});

// 1. Categories
apiRouter.get('/categories', async (_req: Request, res: Response) => {
  try {
    const cats = await getAllCategories();
    res.json(cats);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat kategori' });
  }
});

// 2. Products & IMEI
apiRouter.get('/products', async (req: Request, res: Response) => {
  try {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const lowStockOnly = req.query.lowStockOnly === 'true';

    const prods = await getProducts({ categoryId, search, lowStockOnly });
    res.json(prods);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat produk' });
  }
});

apiRouter.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || !Number.isInteger(id) || id <= 0 || id > 2147483647) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }
    const prod = await getProductById(id);
    if (!prod) return res.status(404).json({ error: 'Produk tidak ditemukan' });
    res.json(prod);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat detail produk' });
  }
});

apiRouter.get('/products/:id/serials', async (req: Request, res: Response) => {
  try {
    const productId = Number(req.params.id);
    if (isNaN(productId) || !Number.isInteger(productId) || productId <= 0 || productId > 2147483647) {
      return res.json([]);
    }
    const status = req.query.status as string;
    const serials = status === 'available'
      ? await getAvailableSerials(productId)
      : await getAllSerialsForProduct(productId);
    res.json(serials);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat serial number/IMEI' });
  }
});

apiRouter.post('/products', async (req: Request, res: Response) => {
  try {
    const created = await createProduct(req.body);
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal membuat produk' });
  }
});

apiRouter.post('/products/:id/serials', async (req: Request, res: Response) => {
  try {
    const productId = Number(req.params.id);
    if (isNaN(productId) || !Number.isInteger(productId) || productId <= 0 || productId > 2147483647) {
      return res.status(400).json({ error: 'ID produk tidak valid untuk PostgreSQL' });
    }
    const serial = await addImeiToProduct(productId, req.body);
    res.status(201).json(serial);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal menambahkan nomor IMEI' });
  }
});

apiRouter.put('/products/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || !Number.isInteger(id) || id <= 0 || id > 2147483647) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }
    const updated = await updateProduct(id, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengupdate produk' });
  }
});

apiRouter.delete('/products/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || !Number.isInteger(id) || id <= 0 || id > 2147483647) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }
    await deleteProduct(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal menghapus produk' });
  }
});

// 3. POS Checkout & Sales
apiRouter.post('/pos/checkout', async (req: AuthRequest, res: Response) => {
  try {
    const payload = req.body;
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      return res.status(400).json({ error: 'Keranjang belanja tidak boleh kosong' });
    }
    const result = await processCheckout({
      ...payload,
      cashierUid: req.user?.uid || payload.cashierUid,
    });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memproses checkout kasir' });
  }
});

apiRouter.get('/sales', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const history = await getSalesHistory(limit);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat riwayat penjualan' });
  }
});

apiRouter.get('/sales/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || !Number.isInteger(id) || id <= 0 || id > 2147483647) {
      return res.status(404).json({ error: 'Data penjualan tidak ditemukan' });
    }
    const sale = await getSaleWithItems(id);
    if (!sale) return res.status(404).json({ error: 'Data penjualan tidak ditemukan' });
    res.json(sale);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat rincian transaksi' });
  }
});

apiRouter.delete('/sales/:id', async (req: Request, res: Response) => {
  try {
    const rawId = Number(req.params.id);
    const id = (!isNaN(rawId) && Number.isInteger(rawId) && rawId > 0 && rawId <= 2147483647) ? rawId : 0;
    const invoice = (req.query.invoice as string) || undefined;
    const result = await deleteSale(id, invoice);
    res.json({
      success: true,
      message: 'Faktur penjualan berhasil dihapus dan stok barang dikembalikan',
      restoredItems: result.restoredItems || [],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal menghapus faktur penjualan' });
  }
});

// 4. Digital Finance & Agen (BRILink, Transfer Bank, E-Wallet, PPOB)
apiRouter.get('/digital-finance', async (req: Request, res: Response) => {
  try {
    const { type, provider, search, limit } = req.query;
    const list = await getDigitalTransactions({
      type: type as string,
      provider: provider as string,
      search: search as string,
      limit: limit ? Number(limit) : 50,
    });
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat transaksi keagenan' });
  }
});

apiRouter.get('/digital-finance/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || !Number.isInteger(id) || id <= 0 || id > 2147483647) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }
    const item = await getDigitalTransactionById(id);
    if (!item) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat transaksi' });
  }
});

apiRouter.post('/digital-finance', async (req: AuthRequest, res: Response) => {
  try {
    const payload = req.body;
    if (!payload.type || !payload.provider || !payload.targetAccount || !payload.nominal) {
      return res.status(400).json({ error: 'Data transaksi keagenan tidak lengkap' });
    }
    const record = await createDigitalTransaction({
      ...payload,
      cashierUid: req.user?.uid || payload.cashierUid,
    });
    res.status(201).json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mencatat transaksi digital' });
  }
});

apiRouter.delete('/digital-finance/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const ref = (req.query.ref as string) || undefined;
    const deleted = await deleteDigitalTransaction(id, ref);
    res.json({ success: true, message: 'Transaksi digital berhasil dihapus', deleted });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal menghapus transaksi digital' });
  }
});

// 5. Service Software Orders
apiRouter.get('/services', async (req: Request, res: Response) => {
  try {
    const { status, search, limit } = req.query;
    const list = await getServiceOrders({
      status: status as string,
      search: search as string,
      limit: limit ? Number(limit) : 50,
    });
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat daftar servis' });
  }
});

apiRouter.get('/services/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const order = await getServiceOrderById(id);
    if (!order) return res.status(404).json({ error: 'Order servis tidak ditemukan' });
    res.json(order);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat detail servis' });
  }
});

apiRouter.post('/services', async (req: AuthRequest, res: Response) => {
  try {
    const payload = req.body;
    if (!payload.customerName || !payload.customerPhone || !payload.deviceModel || !payload.issueType) {
      return res.status(400).json({ error: 'Informasi pelanggan dan unit servis wajib diisi' });
    }
    const created = await createServiceOrder({
      ...payload,
      technicianUid: req.user?.uid || payload.technicianUid,
    });
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mendaftarkan servis baru' });
  }
});

apiRouter.patch('/services/:id/status', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const updated = await updateServiceStatus(id, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengupdate status servis' });
  }
});

apiRouter.delete('/services/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const orderNumber = (req.query.orderNumber as string) || undefined;
    const deleted = await deleteServiceOrder(id, orderNumber);
    res.json({ success: true, message: 'Nota servis berhasil dihapus', deleted });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal menghapus nota servis' });
  }
});

// 6. Store Expenses
apiRouter.get('/expenses', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, category } = req.query;
    const list = await getExpenses({
      startDate: startDate as string,
      endDate: endDate as string,
      category: category as string,
    });
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat data pengeluaran' });
  }
});

apiRouter.post('/expenses', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    if (!payload.category || !payload.title || !payload.amount || !payload.expenseDate) {
      return res.status(400).json({ error: 'Data pengeluaran tidak lengkap' });
    }
    const created = await createExpense(payload);
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mencatat pengeluaran' });
  }
});

apiRouter.delete('/expenses/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await deleteExpense(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal menghapus pengeluaran' });
  }
});

// 7. Analytics & Financial Summary
apiRouter.get('/analytics/summary', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as any) || 'this_month';
    const month = req.query.month ? Number(req.query.month) : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const date = req.query.date as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const summary = await getFinancialSummary(period, {
      month,
      year,
      date,
      startDate,
      endDate,
    });
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal memuat ringkasan keuangan' });
  }
});
