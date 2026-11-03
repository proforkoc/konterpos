import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Printer,
  Search,
  Trash2,
  AlertTriangle,
  X,
  CheckCircle2,
  ShieldAlert,
  ShoppingCart,
  CreditCard,
  Wrench,
  Layers,
  Eye,
  RefreshCw,
  FileText,
  Smartphone,
  Calendar,
  Check,
  TrendingUp,
  Receipt,
  User,
  Phone,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { Sale, DigitalTransaction, ServiceSoftwareOrder } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  executeUnifiedDelete,
  getStoredSales,
  saveStoredSales,
  getStoredDigitalTransactions,
  saveStoredDigitalTransactions,
  getStoredServiceOrders,
  saveStoredServiceOrders,
  onTransactionDeleted,
  onDataUpdated,
} from '../utils/transactionSync.ts';

export type UnifiedCategory = 'all' | 'pos' | 'digital' | 'service';

export interface UnifiedTransactionItem {
  id: string; // unique string key: e.g. pos-1, digital-2, service-3
  rawId: number;
  category: 'pos' | 'digital' | 'service';
  categoryLabel: string;
  invoiceNumber: string;
  timestamp: number;
  dateFormatted: string;
  customerName: string;
  customerPhone?: string;
  summary: string;
  paymentMethod: string;
  totalAmount: number;
  profit: number;
  statusText: string;
  statusVariant: 'emerald' | 'blue' | 'amber' | 'purple' | 'rose' | 'slate';
  rawSale?: Sale;
  rawDigital?: DigitalTransaction;
  rawService?: ServiceSoftwareOrder;
}

interface SalesHistoryModuleProps {
  onReprintSale: (sale: Sale) => void;
  onReprintDigital?: (tx: DigitalTransaction) => void;
  onReprintService?: (order: ServiceSoftwareOrder) => void;
}

export const SalesHistoryModule: React.FC<SalesHistoryModuleProps> = ({
  onReprintSale,
  onReprintDigital,
  onReprintService,
}) => {
  const { currentRole } = useAuth();
  const isOwner = currentRole === 'owner';

  // State
  const [activeCategory, setActiveCategory] = useState<UnifiedCategory>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Raw data with local storage (clean empty array default)
  const [salesList, setSalesList] = useState<Sale[]>(() => {
    return getStoredSales() || [];
  });
  const [digitalList, setDigitalList] = useState<DigitalTransaction[]>(() => {
    return getStoredDigitalTransactions() || [];
  });
  const [serviceList, setServiceList] = useState<ServiceSoftwareOrder[]>(() => {
    return getStoredServiceOrders() || [];
  });

  // Modals state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<UnifiedTransactionItem | null>(null);
  const [loadingDetailItems, setLoadingDetailItems] = useState(false);
  const [detailedSale, setDetailedSale] = useState<Sale | null>(null);

  // Delete modal state (Owner only)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<UnifiedTransactionItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const formatRupiah = (val: number) => 'Rp ' + Number(val || 0).toLocaleString('id-ID');

  // Load all transactions across POS, BRIlink/PPOB, and Service Software
  const loadAllTransactions = async () => {
    try {
      const [salesRes, digitalRes, serviceRes] = await Promise.all([
        fetch('/api/sales?limit=150').catch(() => null),
        fetch('/api/digital-finance?limit=150').catch(() => null),
        fetch('/api/services?limit=150').catch(() => null),
      ]);

      if (salesRes && salesRes.ok) {
        const salesData = await salesRes.json();
        if (Array.isArray(salesData)) {
          setSalesList(salesData);
          saveStoredSales(salesData);
        }
      } else {
        const stored = getStoredSales();
        setSalesList(stored || []);
      }

      if (digitalRes && digitalRes.ok) {
        const digitalData = await digitalRes.json();
        if (Array.isArray(digitalData)) {
          setDigitalList(digitalData);
          saveStoredDigitalTransactions(digitalData);
        }
      } else {
        const stored = getStoredDigitalTransactions();
        setDigitalList(stored || []);
      }

      if (serviceRes && serviceRes.ok) {
        const serviceData = await serviceRes.json();
        if (Array.isArray(serviceData)) {
          setServiceList(serviceData);
          saveStoredServiceOrders(serviceData);
        }
      } else {
        const stored = getStoredServiceOrders();
        setServiceList(stored || []);
      }
    } catch (err) {
      console.error('Failed to load unified transaction history:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllTransactions();

    // Reaktif: dengarkan event penghapusan transaksi lintas modul
    const unsubDelete = onTransactionDeleted((payload) => {
      if (payload.category === 'pos') {
        setSalesList((prev) =>
          prev.filter((s) => s.id !== payload.rawId && s.invoiceNumber !== payload.invoiceNumber)
        );
      } else if (payload.category === 'digital') {
        setDigitalList((prev) =>
          prev.filter((d) => d.id !== payload.rawId && d.referenceNumber !== payload.invoiceNumber)
        );
      } else if (payload.category === 'service') {
        setServiceList((prev) =>
          prev.filter((srv) => srv.id !== payload.rawId && srv.orderNumber !== payload.invoiceNumber)
        );
      }
    });

    const unsubUpdate = onDataUpdated(() => {
      loadAllTransactions();
    });

    return () => {
      unsubDelete();
      unsubUpdate();
    };
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadAllTransactions();
  };

  // Convert raw records into a unified chronological list
  const unifiedTransactions = useMemo<UnifiedTransactionItem[]>(() => {
    const list: UnifiedTransactionItem[] = [];

    // 1. Penjualan POS
    salesList.forEach((s) => {
      const date = new Date(s.createdAt);
      const itemsCount = s.items?.length || 0;
      const itemsSummary = s.items && s.items.length > 0
        ? s.items.map((i) => i.productName).slice(0, 2).join(', ') + (s.items.length > 2 ? ` (+${s.items.length - 2})` : '')
        : 'Penjualan Kasir POS';

      list.push({
        id: `pos-${s.id}`,
        rawId: s.id,
        category: 'pos',
        categoryLabel: 'Penjualan POS',
        invoiceNumber: s.invoiceNumber,
        timestamp: date.getTime() || 0,
        dateFormatted: date.toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        customerName: s.customerName || 'Pelanggan Umum',
        customerPhone: s.customerPhone,
        summary: itemsSummary,
        paymentMethod: s.paymentMethod ? s.paymentMethod.toUpperCase() : 'TUNAI',
        totalAmount: Number(s.grandTotal || 0),
        profit: Number(s.totalProfit || 0),
        statusText: 'Selesai / Lunas',
        statusVariant: 'emerald',
        rawSale: s,
      });
    });

    // 2. BRIlink, E-Wallet dan PPOB
    digitalList.forEach((d) => {
      const date = new Date(d.createdAt);
      const cleanType = d.type
        .replace(/_/g, ' ')
        .replace(/brilink/gi, 'BRIlink')
        .replace(/ppob/gi, 'PPOB')
        .toUpperCase();

      list.push({
        id: `digital-${d.id}`,
        rawId: d.id,
        category: 'digital',
        categoryLabel: 'Agen Digital',
        invoiceNumber: d.referenceNumber,
        timestamp: date.getTime() || 0,
        dateFormatted: date.toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        customerName: d.customerName || 'Pelanggan Agen',
        customerPhone: d.targetAccount,
        summary: `${d.provider} - ${cleanType} (Rek/No: ${d.targetAccount})`,
        paymentMethod: d.paymentMethod ? d.paymentMethod.toUpperCase() : 'TUNAI',
        totalAmount: Number(d.totalCustomerPaid || (d.nominal + d.adminStoreFee) || 0),
        profit: Number(d.profit || 0),
        statusText: d.status === 'success' ? 'Sukses' : d.status || 'Sukses',
        statusVariant: 'blue',
        rawDigital: d,
      });
    });

    // 3. Service Software
    serviceList.forEach((srv) => {
      const date = new Date(srv.receivedAt || (srv as any).createdAt || Date.now());
      const serviceCost = Number(srv.finalCost || srv.estimatedCost || 0);
      const toolCost = Number(srv.toolCost || 0);
      const profit = Math.max(0, serviceCost - toolCost);

      let statusLabel = 'Diterima';
      let statusColor: 'emerald' | 'blue' | 'amber' | 'purple' | 'rose' | 'slate' = 'amber';

      switch (srv.status) {
        case 'received':
          statusLabel = 'Diterima';
          statusColor = 'amber';
          break;
        case 'in_progress':
          statusLabel = 'Dikerjakan';
          statusColor = 'blue';
          break;
        case 'completed':
          statusLabel = 'Selesai Servis';
          statusColor = 'purple';
          break;
        case 'picked_up':
          statusLabel = 'Sudah Diambil';
          statusColor = 'emerald';
          break;
        case 'cancelled_failed':
          statusLabel = 'Batal / Gagal';
          statusColor = 'rose';
          break;
      }

      list.push({
        id: `service-${srv.id}`,
        rawId: srv.id,
        category: 'service',
        categoryLabel: 'Service Software',
        invoiceNumber: srv.orderNumber,
        timestamp: date.getTime() || 0,
        dateFormatted: date.toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        customerName: srv.customerName || 'Pelanggan Servis',
        customerPhone: srv.customerPhone,
        summary: `${srv.deviceModel} - ${srv.issueType}${srv.issueDetails ? ` (${srv.issueDetails})` : ''}`,
        paymentMethod: srv.downPayment > 0 ? `DP: ${formatRupiah(srv.downPayment)}` : 'TUNAI',
        totalAmount: serviceCost,
        profit: profit,
        statusText: statusLabel,
        statusVariant: statusColor,
        rawService: srv,
      });
    });

    // Urutan Kronologis: Transaksi TERBARU berada di posisi paling atas
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [salesList, digitalList, serviceList]);

  // Counts for Category Badges
  const counts = useMemo(() => {
    return {
      all: unifiedTransactions.length,
      pos: salesList.length,
      digital: digitalList.length,
      service: serviceList.length,
    };
  }, [unifiedTransactions.length, salesList.length, digitalList.length, serviceList.length]);

  // Filtered list based on category & search query
  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unifiedTransactions.filter((item) => {
      // Category filter
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }

      // Search filter
      if (!q) return true;
      return (
        item.invoiceNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        (item.customerPhone && item.customerPhone.toLowerCase().includes(q)) ||
        item.summary.toLowerCase().includes(q) ||
        item.paymentMethod.toLowerCase().includes(q)
      );
    });
  }, [unifiedTransactions, activeCategory, search]);

  // Quick KPI calculation
  const summaryKPI = useMemo(() => {
    const totalTransactions = filteredTransactions.length;
    const totalTurnover = filteredTransactions.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const totalProfit = filteredTransactions.reduce((acc, curr) => acc + curr.profit, 0);
    return { totalTransactions, totalTurnover, totalProfit };
  }, [filteredTransactions]);

  // Open Detail Modal
  const handleOpenDetail = async (item: UnifiedTransactionItem) => {
    setSelectedTransaction(item);
    setDetailedSale(null);
    setDetailModalOpen(true);

    if (item.category === 'pos') {
      setLoadingDetailItems(true);
      try {
        const res = await fetch(`/api/sales/${item.rawId}`);
        if (res.ok) {
          const saleWithItems = await res.json();
          setDetailedSale(saleWithItems);
        }
      } catch (err) {
        console.error('Failed to load full sale items:', err);
      } finally {
        setLoadingDetailItems(false);
      }
    }
  };

  // Direct Print Action
  const handleDirectPrint = async (item: UnifiedTransactionItem) => {
    if (item.category === 'pos') {
      try {
        const res = await fetch(`/api/sales/${item.rawId}`);
        const saleWithItems = await res.json();
        if (saleWithItems) {
          onReprintSale(saleWithItems);
        } else if (item.rawSale) {
          onReprintSale(item.rawSale);
        }
      } catch (err) {
        console.error('Failed to load sale for reprint:', err);
        if (item.rawSale) onReprintSale(item.rawSale);
      }
    } else if (item.category === 'digital' && item.rawDigital && onReprintDigital) {
      onReprintDigital(item.rawDigital);
    } else if (item.category === 'service' && item.rawService && onReprintService) {
      onReprintService(item.rawService);
    }
  };

  // Open Delete Confirmation Modal (Owner Only)
  const handleOpenDelete = (item: UnifiedTransactionItem) => {
    if (!isOwner) return;
    setTransactionToDelete(item);
    setDeleteModalOpen(true);
  };

  // Confirm Delete Operation (Owner Only)
  const handleConfirmDelete = async () => {
    if (!isOwner || !transactionToDelete) return;
    setDeleting(true);

    try {
      const invoice = transactionToDelete.invoiceNumber;
      const targetCategory = transactionToDelete.category;
      const targetRawId = transactionToDelete.rawId;

      // Ambil detail items transaksi POS jika belum ada di rawSale
      let itemsToPass = transactionToDelete.rawSale?.items;
      if (targetCategory === 'pos' && (!itemsToPass || itemsToPass.length === 0)) {
        try {
          const detailRes = await fetch(`/api/sales/${targetRawId}`);
          if (detailRes.ok) {
            const fullSale = await detailRes.json();
            if (fullSale?.items && Array.isArray(fullSale.items)) {
              itemsToPass = fullSale.items;
            }
          }
        } catch (fetchErr) {
          console.warn('Could not prefetch sale items for restock:', fetchErr);
        }
      }

      // Jalankan fungsi hapus terpadu (Server REST API + LocalStorage + Event Broadcast + Cloud Firestore Restock)
      const res = await executeUnifiedDelete({
        category: targetCategory,
        rawId: targetRawId,
        invoiceNumber: invoice,
        items: itemsToPass,
      });

      // Update state lokal secara instan (tanpa tunggu fetch ulang)
      if (targetCategory === 'pos') {
        setSalesList((prev) =>
          prev.filter((s) => s.id !== targetRawId && s.invoiceNumber !== invoice)
        );
      } else if (targetCategory === 'digital') {
        setDigitalList((prev) =>
          prev.filter((d) => d.id !== targetRawId && d.referenceNumber !== invoice)
        );
      } else if (targetCategory === 'service') {
        setServiceList((prev) =>
          prev.filter((srv) => srv.id !== targetRawId && srv.orderNumber !== invoice)
        );
      }

      setDeleteModalOpen(false);
      setToastMessage(
        targetCategory === 'pos'
          ? `Transaksi ${invoice} berhasil dihapus dan stok barang berhasil dikembalikan ke inventaris toko.`
          : res.message || `Struk / Nota ${invoice} berhasil dihapus.`
      );
      setTimeout(() => setToastMessage(null), 5000);
      setTransactionToDelete(null);

      // Refresh unified data dari server bila tersambung
      loadAllTransactions();
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat menghapus struk');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-1.5 pb-6 sm:pb-8 space-y-6 w-full">
      {/* Toast Feedback Notification */}
      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5 shadow-xs transition-all">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-auto text-emerald-600 hover:text-emerald-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  Riwayat Struk Terpadu
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Semua Divisi Transaksi
                </span>
                {isOwner && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-purple-600" />
                    Owner: Hak Hapus Aktif
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Arsip seluruh transaksi toko handphone (Penjualan Retail HP/Aksesoris, BRIlink & PPOB, dan Nota Servis Software) dalam satu log kronologis.
              </p>
            </div>
          </div>

          {/* Action & Refresh */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              title="Perbarui Riwayat Data"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition-colors duration-150 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Cards (Eye-friendly Light Palette) */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5 pt-1">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-800 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>Total Transaksi Sesuai Filter</span>
              <Receipt className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="text-base sm:text-lg font-extrabold text-slate-900">
              {summaryKPI.totalTransactions}{' '}
              <span className="text-xs font-medium text-slate-500">Struk</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 text-slate-800 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-700">
              <span>Total Nilai / Perputaran</span>
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="text-base sm:text-lg font-extrabold text-indigo-900 truncate">
              {formatRupiah(summaryKPI.totalTurnover)}
            </div>
          </div>

          <div className="col-span-2 lg:col-span-1 p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 text-slate-800 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700">
              <span>Total Estimasi Laba Bersih</span>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-base sm:text-lg font-extrabold text-emerald-800 truncate">
              +{formatRupiah(summaryKPI.totalProfit)}
            </div>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1 border-t border-slate-100">
          {/* Tombol Filter Kategori Sesuai Spesifikasi: [Semua Transaksi] [Penjualan POS] [Agen Digital] [Service Software] */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap py-1">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`flex items-center gap-2 px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap shadow-2xs ${
                activeCategory === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>Semua Transaksi</span>
              {counts.all > 0 && (
                <span
                  className={`min-w-[20px] h-[20px] px-1 aspect-square rounded-full text-[10px] font-extrabold inline-flex items-center justify-center leading-none transition-colors ${
                    activeCategory === 'all'
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  {counts.all}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('pos')}
              className={`flex items-center gap-2 px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap shadow-2xs ${
                activeCategory === 'pos'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
              <span>Penjualan POS</span>
              {counts.pos > 0 && (
                <span
                  className={`min-w-[20px] h-[20px] px-1 aspect-square rounded-full text-[10px] font-extrabold inline-flex items-center justify-center leading-none transition-colors ${
                    activeCategory === 'pos'
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  {counts.pos}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('digital')}
              className={`flex items-center gap-2 px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap shadow-2xs ${
                activeCategory === 'digital'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 shrink-0" />
              <span>Agen Digital</span>
              {counts.digital > 0 && (
                <span
                  className={`min-w-[20px] h-[20px] px-1 aspect-square rounded-full text-[10px] font-extrabold inline-flex items-center justify-center leading-none transition-colors ${
                    activeCategory === 'digital'
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  {counts.digital}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('service')}
              className={`flex items-center gap-2 px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap shadow-2xs ${
                activeCategory === 'service'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 shrink-0" />
              <span>Service Software</span>
              {counts.service > 0 && (
                <span
                  className={`min-w-[20px] h-[20px] px-1 aspect-square rounded-full text-[10px] font-extrabold inline-flex items-center justify-center leading-none transition-colors ${
                    activeCategory === 'service'
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  {counts.service}
                </span>
              )}
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari no faktur, nama, no HP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-slate-800 font-medium placeholder:text-slate-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Unified Transaction List / Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
            <p className="text-xs font-semibold">Memuat riwayat transaksi terpadu...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-16 px-4 text-slate-400 space-y-2">
            <FileText className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-700">Tidak ada riwayat transaksi ditemukan</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {search
                ? `Tidak ditemukan transaksi dengan kata kunci "${search}" pada kategori ${activeCategory === 'all' ? 'semua' : activeCategory}.`
                : 'Belum ada transaksi pada kategori ini.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop & Tablet Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table
                className="w-full text-left text-xs table-fixed"
                style={{ tableLayout: 'fixed', width: '100%' }}
              >
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th style={{ width: '14%' }} className="px-2 py-2">
                      Faktur & Waktu
                    </th>
                    <th style={{ width: '26%' }} className="px-2 py-2">
                      Kategori & Rincian
                    </th>
                    <th style={{ width: '16%' }} className="px-2 py-2">
                      Pelanggan
                    </th>
                    <th style={{ width: '9%' }} className="px-2 py-2">
                      Metode
                    </th>
                    <th style={{ width: '11%' }} className="px-2 py-2 text-right">
                      Grand Total
                    </th>
                    <th style={{ width: '11%' }} className="px-2 py-2 text-right">
                      Laba
                    </th>
                    <th style={{ width: '13%' }} className="px-2 py-2 text-right">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredTransactions.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Faktur & Waktu */}
                      <td className="px-2 py-2 overflow-hidden">
                        <div className="font-mono text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate" title={item.invoiceNumber}>
                          {item.invoiceNumber}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{item.dateFormatted}</span>
                        </div>
                      </td>

                      {/* Kategori & Rincian */}
                      <td className="px-2 py-2 overflow-hidden">
                        <div className="flex items-center gap-1 mb-1 flex-wrap">
                          {item.category === 'pos' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                              <ShoppingCart className="w-2.5 h-2.5" />
                              POS
                            </span>
                          )}
                          {item.category === 'digital' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-sky-50 text-sky-700 border border-sky-200 shrink-0">
                              <CreditCard className="w-2.5 h-2.5" />
                              Digital
                            </span>
                          )}
                          {item.category === 'service' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                              <Wrench className="w-2.5 h-2.5" />
                              Servis
                            </span>
                          )}

                          <span className={`text-[9.5px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                            item.statusVariant === 'emerald' ? 'bg-emerald-50 text-emerald-700' :
                            item.statusVariant === 'blue' ? 'bg-blue-50 text-blue-700' :
                            item.statusVariant === 'purple' ? 'bg-purple-50 text-purple-700' :
                            item.statusVariant === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {item.statusText}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 font-medium truncate" title={item.summary}>
                          {item.summary}
                        </p>
                      </td>

                      {/* Pelanggan */}
                      <td className="px-2 py-2 overflow-hidden">
                        <div className="text-xs font-semibold text-slate-900 truncate" title={item.customerName}>
                          {item.customerName}
                        </div>
                        {item.customerPhone && (
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5 truncate">
                            <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span className="truncate">{item.customerPhone}</span>
                          </div>
                        )}
                      </td>

                      {/* Metode Bayar */}
                      <td className="px-2 py-2 overflow-hidden">
                        <span className={`inline-block max-w-full truncate px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.paymentMethod.includes('QRIS')
                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                            : item.paymentMethod.includes('TRANSFER')
                            ? 'bg-sky-100 text-sky-700 border border-sky-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {item.paymentMethod}
                        </span>
                      </td>

                      {/* Grand Total */}
                      <td className="px-2 py-2 text-right font-extrabold text-slate-900 text-xs whitespace-nowrap overflow-hidden">
                        {formatRupiah(item.totalAmount)}
                      </td>

                      {/* Estimasi Laba */}
                      <td className="px-2 py-2 text-right text-emerald-700 font-bold text-xs whitespace-nowrap overflow-hidden">
                        +{formatRupiah(item.profit)}
                      </td>

                      {/* Aksi (Detail, Cetak Struk, dan Hapus Struk Khusus Owner) */}
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 justify-end">
                          {/* Tombol Detail - Tersedia untuk Kasir & Owner */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(item)}
                            title="Lihat detail lengkap transaksi"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-[10px] shadow-2xs hover:shadow-xs transition-colors duration-150 cursor-pointer"
                          >
                            <Eye className="w-3 h-3 text-slate-500" />
                            <span>Detail</span>
                          </button>

                          {/* Tombol Cetak Struk - Tersedia untuk Kasir & Owner */}
                          <button
                            type="button"
                            onClick={() => handleDirectPrint(item)}
                            title="Cetak struk thermal kasir"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 hover:text-white active:bg-indigo-700 border border-indigo-200/90 text-indigo-700 font-bold text-[10px] shadow-2xs hover:shadow-xs transition-colors duration-150 cursor-pointer"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Struk</span>
                          </button>

                          {/* Hak Akses Khusus: Tombol Hapus (Ikon Saja) HANYA untuk Role Owner */}
                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(item)}
                              title="Hapus Struk (Khusus Role Owner)"
                              aria-label="Hapus Struk"
                              className="inline-flex items-center justify-center p-1 rounded-lg bg-rose-50 hover:bg-rose-100 active:bg-rose-200 hover:text-rose-700 border border-rose-200 text-rose-600 shadow-2xs hover:shadow-xs transition-colors duration-150 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (< 768px) - Touch-friendly without layout overflow */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredTransactions.map((item) => (
                <div key={item.id} className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {item.invoiceNumber}
                        </span>
                        {item.category === 'pos' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            POS
                          </span>
                        )}
                        {item.category === 'digital' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                            PPOB
                          </span>
                        )}
                        {item.category === 'service' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            Servis
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {item.dateFormatted}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-extrabold text-slate-900">
                        {formatRupiah(item.totalAmount)}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-bold">
                        +{formatRupiah(item.profit)}
                      </div>
                    </div>
                  </div>

                  {/* Summary & Customer */}
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-slate-800">{item.customerName}</span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 bg-white rounded border border-slate-200 text-slate-600">
                        {item.paymentMethod}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-1">{item.summary}</p>
                  </div>

                  {/* Mobile Action Buttons (Min height 42px touch-friendly) */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenDetail(item)}
                      className="flex-1 min-h-[42px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs transition-colors duration-150 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detail</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDirectPrint(item)}
                      className="flex-1 min-h-[42px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-xs transition-colors duration-150 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Cetak Struk</span>
                    </button>

                    {/* Role Owner Hapus Struk Button in Mobile */}
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleOpenDelete(item)}
                        title="Hapus Struk (Khusus Owner)"
                        className="min-h-[42px] px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-600 hover:text-white active:bg-rose-700 border border-rose-200 text-rose-700 font-bold text-xs transition-colors duration-150 cursor-pointer flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal Detail Transaksi (Bisa Diakses Kasir & Owner) */}
      {detailModalOpen && selectedTransaction && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6 border border-slate-200 animate-in fade-in zoom-in-95 my-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                    Rincian Transaksi
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                    <span>{selectedTransaction.invoiceNumber}</span>
                    <span>&bull;</span>
                    <span className="capitalize">{selectedTransaction.categoryLabel}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content based on category */}
            <div className="py-4 space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              {/* Info Pelanggan & Waktu */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Waktu Transaksi:</span>
                  <span className="font-semibold text-slate-800">{selectedTransaction.dateFormatted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nama Pelanggan:</span>
                  <span className="font-bold text-slate-800">{selectedTransaction.customerName}</span>
                </div>
                {selectedTransaction.customerPhone && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">No. Telepon / Akun:</span>
                    <span className="font-mono font-semibold text-slate-800">{selectedTransaction.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Metode Pembayaran:</span>
                  <span className="font-semibold text-indigo-700 uppercase">{selectedTransaction.paymentMethod}</span>
                </div>
                {selectedTransaction.rawSale?.notes && (
                  <div className="pt-2 border-t border-slate-200 text-xs bg-indigo-50/60 p-2.5 rounded-lg text-slate-700">
                    <span className="font-bold text-indigo-900 block mb-0.5">Catatan / Bukti Referensi:</span>
                    <span className="font-mono text-[11px] text-slate-800 break-words">{selectedTransaction.rawSale.notes}</span>
                  </div>
                )}
              </div>

              {/* Detail Kategori 1: Penjualan POS HP / Aksesoris */}
              {selectedTransaction.category === 'pos' && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShoppingCart className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Daftar Produk yang Dibeli</span>
                  </h4>

                  {loadingDetailItems ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Memuat rincian item produk...
                    </div>
                  ) : detailedSale?.items && detailedSale.items.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                      {detailedSale.items.map((item, idx) => (
                        <div key={idx} className="p-2.5 flex items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold text-slate-900">{item.productName}</div>
                            {item.imeiOrSerial && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                IMEI/SN: {item.imeiOrSerial}
                              </div>
                            )}
                            <div className="text-[10px] text-slate-400">
                              {item.quantity} x {formatRupiah(item.sellingPrice)}
                            </div>
                          </div>
                          <div className="font-bold text-slate-900">
                            {formatRupiah(item.subtotal)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic p-2">
                      {selectedTransaction.summary}
                    </p>
                  )}
                </div>
              )}

              {/* Detail Kategori 2: BRIlink & PPOB */}
              {selectedTransaction.category === 'digital' && selectedTransaction.rawDigital && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-sky-600" />
                    <span>Rincian Transaksi Keagenan & PPOB</span>
                  </h4>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Provider:</span>
                      <span className="font-bold text-slate-800">{selectedTransaction.rawDigital.provider}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Nomor Rekening / Tujuan:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {selectedTransaction.rawDigital.targetAccount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Nominal Transaksi:</span>
                      <span className="font-semibold text-slate-800">
                        {formatRupiah(selectedTransaction.rawDigital.nominal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Biaya Admin Toko:</span>
                      <span className="font-semibold text-slate-800">
                        {formatRupiah(selectedTransaction.rawDigital.adminStoreFee)}
                      </span>
                    </div>
                    {selectedTransaction.rawDigital.notes && (
                      <div className="pt-1.5 border-t border-slate-200 text-slate-600 text-[11px]">
                        Catatan: {selectedTransaction.rawDigital.notes}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Detail Kategori 3: Service Software */}
              {selectedTransaction.category === 'service' && selectedTransaction.rawService && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-purple-600" />
                    <span>Rincian Servis & Kerusakan HP</span>
                  </h4>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Model Unit:</span>
                      <span className="font-bold text-slate-800">{selectedTransaction.rawService.deviceModel}</span>
                    </div>
                    {selectedTransaction.rawService.deviceImei && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Nomor IMEI:</span>
                        <span className="font-mono text-slate-800">
                          {selectedTransaction.rawService.deviceImei}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Jenis Kerusakan:</span>
                      <span className="font-semibold text-purple-700">
                        {selectedTransaction.rawService.issueType}
                      </span>
                    </div>
                    {selectedTransaction.rawService.issueDetails && (
                      <div className="text-[11px] text-slate-600">
                        Detail: {selectedTransaction.rawService.issueDetails}
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-slate-200">
                      <span className="text-slate-500">Status Servis:</span>
                      <span className="font-bold text-slate-800">{selectedTransaction.statusText}</span>
                    </div>
                    {selectedTransaction.rawService.downPayment > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Uang Muka (DP):</span>
                        <span className="font-semibold text-emerald-700">
                          {formatRupiah(selectedTransaction.rawService.downPayment)}
                        </span>
                      </div>
                    )}
                    {selectedTransaction.rawService.balanceDue > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Sisa Tagihan Pelunasan:</span>
                        <span className="font-bold text-rose-600">
                          {formatRupiah(selectedTransaction.rawService.balanceDue)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Total & Estimasi Keuntungan Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-semibold">Total Tagihan / Pembayaran:</span>
                  <span className="font-extrabold text-base text-slate-900">
                    {formatRupiah(selectedTransaction.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-emerald-700 font-semibold pt-1 border-t border-slate-200">
                  <span>Estimasi Laba Kotor Toko:</span>
                  <span className="font-bold">+{formatRupiah(selectedTransaction.profit)}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={() => {
                  setDetailModalOpen(false);
                  handleDirectPrint(selectedTransaction);
                }}
                className="px-4 py-2 min-h-[40px] rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Struk Thermal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Faktur / Struk (KHUSUS ROLE OWNER) */}
      {deleteModalOpen && transactionToDelete && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/15 backdrop-blur-sm p-4 animate-in fade-in duration-200 no-print"
          style={{ zIndex: 9999, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) setDeleteModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 sm:p-6 border border-slate-200/80 ring-1 ring-black/5 animate-in fade-in zoom-in-95 relative z-[10000]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-slate-900 text-base">Hapus Struk & Kembalikan Stok?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Aksi ini hanya dapat dilakukan oleh <strong>Role Owner</strong>. Transaksi penjualan akan dihapus dari riwayat faktur.
                </p>

                <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Kategori:</span>
                    <span className="font-bold text-slate-800">{transactionToDelete.categoryLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">No. Faktur:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {transactionToDelete.invoiceNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pelanggan:</span>
                    <span className="font-semibold text-slate-800">
                      {transactionToDelete.customerName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Transaksi:</span>
                    <span className="font-bold text-indigo-700">
                      {formatRupiah(transactionToDelete.totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Specific Warning & Restock per Category */}
                <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-emerald-900 block">
                      {transactionToDelete.category === 'pos'
                        ? 'Pengembalian Stok Otomatis (Restock):'
                        : 'Konfirmasi Penghapusan:'}
                    </span>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      {transactionToDelete.category === 'pos'
                        ? 'Jumlah stok barang fisik (Aksesoris & Sparepart) akan otomatis dikembalikan ke inventaris toko dan status unit HP/IMEI akan diaktifkan kembali menjadi Tersedia (Available).'
                        : transactionToDelete.category === 'digital'
                        ? 'Catatan mutasi saldo agen dan komisi laba toko akan dihapus dari buku kas.'
                        : 'Data pendaftaran order servis HP dan log teknisi akan dihapus permanen.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-5">
                  <button
                    type="button"
                    onClick={() => setDeleteModalOpen(false)}
                    disabled={deleting}
                    className="px-4 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={deleting}
                    className="px-4 py-2 min-h-[40px] rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{deleting ? 'Mengembalikan Stok & Menghapus...' : 'Ya, Hapus & Kembalikan Stok'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
