import React, { useState, useEffect } from 'react';
import {
  Headphones,
  Plus,
  Search,
  AlertTriangle,
  Package,
  Layers,
  ArrowUpDown,
  CheckCircle,
  Cloud,
  Edit3,
  PackagePlus,
  X,
  Coins,
  TrendingUp,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Product } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { onTransactionDeleted, onDataUpdated, notifyDataUpdated } from '../utils/transactionSync.ts';
import {
  subscribeAccessories,
  createAccessoryCloud,
  updateAccessoryStockCloud,
  restockAccessoryCloud,
  deleteAccessoryCloud,
} from '../services/cloudInventoryService.ts';

export const AccessoriesModule: React.FC = () => {
  const { canViewCostPrice, canManageInventory } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(true);

  // Modal: Add Accessory
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [brand, setBrand] = useState('Baseus');
  const [variant, setVariant] = useState('');
  const [costPrice, setCostPrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [stock, setStock] = useState(10);
  const [minStockAlert, setMinStockAlert] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  // Modal: Custom Restock & Update Cost Price
  const [customRestockModalOpen, setCustomRestockModalOpen] = useState(false);
  const [selectedProductForRestock, setSelectedProductForRestock] = useState<(Product & { docId?: string }) | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(10);
  const [customCostPrice, setCustomCostPrice] = useState<number>(0);
  const [customSellingPrice, setCustomSellingPrice] = useState<number>(0);
  const [submittingRestock, setSubmittingRestock] = useState(false);

  // Modal: Delete Accessory Confirmation
  const [itemToDelete, setItemToDelete] = useState<(Product & { docId?: string }) | null>(null);
  const [deleting, setDeleting] = useState(false);

  const formatRupiah = (val: number) => 'Rp ' + Number(val || 0).toLocaleString('id-ID');

  const loadApiFallback = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      const accList = Array.isArray(data) ? data.filter((p: Product) => !p.isImeiTracked) : [];
      if (accList.length > 0) {
        setItems(accList);
      }
    } catch {
      // quiet fail
    }
  };

  useEffect(() => {
    setLoading(true);

    // 1. Sinkronisasi Real-Time dengan Cloud Firestore (Primary Source of Truth)
    const unsubscribeFirestore = subscribeAccessories(
      (cloudItems) => {
        setItems(cloudItems);
        setCloudSynced(true);
        setLoading(false);
      },
      (err) => {
        console.error('Firestore sync notice, fallback to local cache:', err);
        setCloudSynced(false);
        loadApiFallback().finally(() => setLoading(false));
      }
    );

    // 2. Listener event transaksi
    const unsubDelete = onTransactionDeleted((payload) => {
      if (payload.category === 'pos' || payload.category === ('all' as any)) {
        loadApiFallback();
      }
    });

    const unsubUpdate = onDataUpdated((payload) => {
      if (payload.category === 'pos' || payload.category === 'all') {
        loadApiFallback();
      }
    });

    return () => {
      unsubscribeFirestore();
      unsubDelete();
      unsubUpdate();
    };
  }, []);

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      if (itemToDelete.docId) {
        await deleteAccessoryCloud(itemToDelete.docId, itemToDelete.id);
      } else {
        await fetch(`/api/products/${itemToDelete.id}`, { method: 'DELETE' });
      }
      setItems((prev) => prev.filter((item) => item.id !== itemToDelete.id));
      notifyDataUpdated('pos');
      setItemToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete accessory:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenCustomRestock = (product: Product & { docId?: string }) => {
    setSelectedProductForRestock(product);
    setRestockAmount(10);
    setCustomCostPrice(Number(product.costPrice || 0));
    setCustomSellingPrice(Number(product.sellingPrice || 0));
    setCustomRestockModalOpen(true);
  };

  const handleSaveCustomRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForRestock) return;

    const addQty = Number(restockAmount) || 0;
    const newCost = Number(customCostPrice) || 0;
    const newSell = Number(customSellingPrice) || 0;

    if (addQty < 0) {
      alert('Jumlah tambahan stok tidak boleh bernilai negatif');
      return;
    }
    if (newCost < 0) {
      alert('Harga modal kulakan tidak boleh kurang dari 0');
      return;
    }
    if (newSell <= 0) {
      alert('Harga jual konsumen harus lebih dari 0');
      return;
    }

    setSubmittingRestock(true);
    try {
      const newStock = selectedProductForRestock.stock + addQty;

      if (selectedProductForRestock.docId) {
        await restockAccessoryCloud(
          selectedProductForRestock.docId,
          newStock,
          newCost,
          newSell,
          selectedProductForRestock.id
        );
      } else {
        await fetch(`/api/products/${selectedProductForRestock.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stock: newStock,
            costPrice: newCost,
            sellingPrice: newSell,
          }),
        });
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedProductForRestock.id
            ? {
                ...item,
                stock: newStock,
                costPrice: newCost,
                sellingPrice: newSell,
              }
            : item
        )
      );

      notifyDataUpdated('pos');
      setCustomRestockModalOpen(false);
      setSelectedProductForRestock(null);
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui stok dan harga modal');
    } finally {
      setSubmittingRestock(false);
    }
  };

  const handleSaveAccessory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code || sellingPrice <= 0) {
      alert('Nama aksesoris, kode/SKU, dan harga jual wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      // Simpan langsung ke Cloud Firestore (dan auto-sinkron ke backend)
      await createAccessoryCloud({
        categoryId: 2,
        categoryName: 'Aksesoris & Sparepart',
        categoryCode: 'aksesoris',
        code: code.trim(),
        name: name.trim(),
        brand: brand.trim(),
        model: name.trim(),
        variant: variant.trim() || undefined,
        costPrice,
        sellingPrice,
        stock,
        minStockAlert,
        isImeiTracked: false,
        unit: 'pcs',
      });

      setModalOpen(false);
      setName('');
      setCode('');
      setCostPrice(0);
      setSellingPrice(0);
      setStock(10);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan aksesoris');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      (item.brand && item.brand.toLowerCase().includes(q));
    const matchLowStock = !filterLowStock || item.stock <= item.minStockAlert;
    return matchSearch && matchLowStock;
  });

  const lowStockCount = items.filter((p) => p.stock <= p.minStockAlert).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-1.5 pb-6 sm:pb-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Headphones className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900 text-lg">Pilar 2: Penjualan Aksesoris & Peringatan Stok Minimum</h2>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs text-slate-500">
              Manajemen stok fisik aksesoris dengan sistem peringatan otomatis.
            </p>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <Cloud className="w-3 h-3" />
              <span>{cloudSynced ? 'Cloud Firestore Realtime' : 'Database Sinkron'}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Aksesoris Baru</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Total Varian Aksesoris</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{items.length} SKU</div>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Total Fisik Unit Stok</div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {items.reduce((acc, cur) => acc + cur.stock, 0)} Pcs
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => setFilterLowStock(!filterLowStock)}
          className={`p-4 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
            filterLowStock
              ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
              : 'bg-white border-slate-200 hover:border-amber-400'
          }`}
        >
          <div>
            <div className={`text-xs ${filterLowStock ? 'text-amber-100' : 'text-slate-500'}`}>
              Peringatan Stok Menipis
            </div>
            <div className="text-xl font-bold mt-1">
              {lowStockCount} Item Perlu Kulak
            </div>
          </div>
          <div
            className={`p-2.5 rounded-xl ${
              filterLowStock ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        {/* Table Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama aksesoris, merk, barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterLowStock(!filterLowStock)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                filterLowStock
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Hanya Stok Menipis ({lowStockCount})</span>
            </button>
          </div>
        </div>

        {/* Desktop & Tablet Table View (>= 768px) */}
        <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl">
          <table
            className="w-full text-left text-xs table-fixed"
            style={{ tableLayout: 'fixed', width: '100%' }}
          >
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th style={{ width: '11%' }} className="px-2 py-2.5">Kode / SKU</th>
                <th style={{ width: '26%' }} className="px-2 py-2.5">Nama Produk & Varian</th>
                <th style={{ width: '9%' }} className="px-2 py-2.5">Merek</th>
                <th style={{ width: '11%' }} className="px-2 py-2.5">Harga Modal</th>
                <th style={{ width: '11%' }} className="px-2 py-2.5">Harga Jual</th>
                <th style={{ width: '10%' }} className="px-2 py-2.5">Margin Laba</th>
                <th style={{ width: '10%' }} className="px-2 py-2.5">Stok Fisik</th>
                <th style={{ width: '12%' }} className="px-2 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    Memuat inventaris aksesoris...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    Tidak ada aksesoris yang sesuai filter
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isOutOfStock = item.stock <= 0;
                  const isLow = !isOutOfStock && item.stock <= item.minStockAlert;
                  const margin = item.sellingPrice - item.costPrice;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-2 py-2 font-mono font-medium text-slate-600 truncate" title={item.code}>
                        {item.code}
                      </td>
                      <td className="px-2 py-2 overflow-hidden">
                        <div className="font-semibold text-slate-900 truncate" title={item.name}>{item.name}</div>
                        {item.variant && (
                          <div className="text-[11px] text-slate-500 truncate" title={item.variant}>{item.variant}</div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-slate-700 font-medium truncate" title={item.brand || '-'}>{item.brand || '-'}</td>
                      <td className="px-2 py-2 font-medium text-slate-500 whitespace-nowrap">
                        {canViewCostPrice ? formatRupiah(item.costPrice) : 'Rp ***'}
                      </td>
                      <td className="px-2 py-2 font-bold text-slate-900 whitespace-nowrap">
                        {formatRupiah(item.sellingPrice)}
                      </td>
                      <td className="px-2 py-2 text-emerald-700 font-semibold whitespace-nowrap">
                        {canViewCostPrice ? `+${formatRupiah(margin)}` : '***'}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                              isOutOfStock
                                ? 'bg-rose-100 text-rose-800'
                                : isLow
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {item.stock} {item.unit || 'pcs'}
                          </span>
                          {isLow && (
                            <span title="Stok di bawah batas minimum!" className="text-amber-500">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenCustomRestock(item)}
                            title="Restock stok & update harga modal"
                            className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 active:bg-indigo-700 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 text-[10.5px] font-bold flex items-center gap-1 shadow-2xs hover:shadow-xs transition-colors duration-150 cursor-pointer"
                          >
                            <PackagePlus className="w-3 h-3" />
                            <span>Restock</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemToDelete(item)}
                            title={`Hapus ${item.name}`}
                            className="p-1 rounded-lg bg-slate-50 hover:bg-rose-50 active:bg-rose-100 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-colors duration-150 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List View (< 768px) */}
        <div className="md:hidden space-y-2.5">
          {loading ? (
            <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              Memuat inventaris aksesoris...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              Tidak ada aksesoris yang sesuai filter
            </div>
          ) : (
            filteredItems.map((item) => {
              const isOutOfStock = item.stock <= 0;
              const isLow = !isOutOfStock && item.stock <= item.minStockAlert;
              const margin = item.sellingPrice - item.costPrice;

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2.5"
                >
                  {/* Baris Atas: Nama Produk & Varian (bold) beserta Kode/SKU dan Merek */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {item.code}
                        </span>
                        {item.brand && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {item.brand}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug">
                        {item.name}
                      </h4>
                      {item.variant && (
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Varian: <span className="text-slate-700">{item.variant}</span>
                        </p>
                      )}
                    </div>

                    {/* Status Stok Fisik di Sudut Kanan Atas */}
                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-flex items-center gap-1 font-extrabold px-2.5 py-1 rounded-full text-[10px] shadow-2xs ${
                          isOutOfStock
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : isLow
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {isLow && <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />}
                        <span>{isOutOfStock ? 'Habis (0)' : `Stok: ${item.stock} ${item.unit || 'pcs'}`}</span>
                      </span>
                      {isLow && (
                        <div className="text-[9px] text-amber-600 font-bold mt-0.5">
                          Perlu Kulak
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Baris Tengah: Informasi Harga Modal, Harga Jual, dan Margin Laba */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Harga Modal</div>
                      <div className="font-semibold text-slate-700 text-xs truncate mt-0.5">
                        {canViewCostPrice ? formatRupiah(item.costPrice) : 'Rp ***'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Harga Jual</div>
                      <div className="font-extrabold text-indigo-700 text-xs truncate mt-0.5">
                        {formatRupiah(item.sellingPrice)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Margin Laba</div>
                      <div className="font-bold text-emerald-600 text-xs truncate mt-0.5">
                        {canViewCostPrice ? `+${formatRupiah(margin)}` : '***'}
                      </div>
                    </div>
                  </div>

                  {/* Baris Bawah: Tombol Aksi (Restok & Hapus) Touch-Friendly */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenCustomRestock(item)}
                      className="flex-1 min-h-[42px] flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-xs transition-colors duration-150 cursor-pointer"
                    >
                      <PackagePlus className="w-4 h-4" />
                      <span>Restok & Update Modal</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      title={`Hapus ${item.name}`}
                      className="min-h-[42px] px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-600 hover:text-white active:bg-rose-700 border border-rose-200 text-rose-700 font-bold text-xs transition-colors duration-150 cursor-pointer flex items-center justify-center shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL: Tambah Aksesoris */}
      {modalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Tambah Aksesoris / Sparepart Baru</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAccessory} className="space-y-3.5 my-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Merek / Brand</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Robot, Vention, Baseus, dll."
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Kode / Barcode SKU</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="ACC-CHG-65W"
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Nama Aksesoris</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Charger GaN 65W Fast Charging"
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Varian / Warna / Tipe Port</label>
                <input
                  type="text"
                  value={variant}
                  onChange={(e) => setVariant(e.target.value)}
                  placeholder="Hitam, Kabel Type-C 1 Meter, dll."
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Harga Modal Kulak (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={costPrice || ''}
                    onChange={(e) => setCostPrice(Number(e.target.value) || 0)}
                    placeholder="50000"
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Harga Jual Konsumen (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={sellingPrice || ''}
                    onChange={(e) => setSellingPrice(Number(e.target.value) || 0)}
                    placeholder="85000"
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-semibold text-indigo-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Stok Awal (Pcs)</label>
                  <input
                    type="number"
                    min="0"
                    value={stock || ''}
                    onChange={(e) => setStock(Number(e.target.value) || 0)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Ambang Peringatan Stok Minimum</label>
                  <input
                    type="number"
                    min="1"
                    value={minStockAlert || ''}
                    onChange={(e) => setMinStockAlert(Number(e.target.value) || 3)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Aksesoris'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Custom Restock & Update Harga Modal */}
      {customRestockModalOpen && selectedProductForRestock && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">
                    Restock & Update Harga Modal
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-mono text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                      {selectedProductForRestock.code}
                    </span>
                    <span className="text-xs text-slate-700 font-medium truncate max-w-[240px]">
                      {selectedProductForRestock.name}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomRestockModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Status Strip */}
            <div className="grid grid-cols-3 gap-2 my-3.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Stok Saat Ini</span>
                <span className="text-xs font-bold text-slate-800">
                  {selectedProductForRestock.stock} {selectedProductForRestock.unit || 'pcs'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Modal Lama</span>
                <span className="text-xs font-bold text-slate-600">
                  {formatRupiah(selectedProductForRestock.costPrice)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Jual Saat Ini</span>
                <span className="text-xs font-bold text-slate-900">
                  {formatRupiah(selectedProductForRestock.sellingPrice)}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveCustomRestock} className="space-y-3.5">
              {/* Jumlah Tambahan Stok */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Jumlah Penambahan Stok <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                    Total Menjadi: {(selectedProductForRestock.stock || 0) + (Number(restockAmount) || 0)} {selectedProductForRestock.unit || 'pcs'}
                  </span>
                </div>
                <input
                  type="number"
                  min="1"
                  required
                  value={restockAmount === 0 ? '' : restockAmount}
                  onChange={(e) => setRestockAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="Contoh: 37, 50, 100..."
                  className="w-full text-sm font-semibold py-2 px-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />

                {/* Quick Add Buttons */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] font-semibold text-slate-400 mr-1">Cepat:</span>
                  {[5, 10, 25, 50, 100].map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => setRestockAmount((prev) => prev + inc)}
                      className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-indigo-50 active:bg-indigo-100 text-slate-700 hover:text-indigo-700 border border-slate-200 transition-colors duration-150 cursor-pointer"
                    >
                      +{inc}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setRestockAmount(0)}
                    title="Reset ke 0"
                    className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 flex items-center gap-1 transition-colors duration-150 cursor-pointer"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    Reset
                  </button>
                </div>
              </div>

              {/* Harga Modal Baru & Harga Jual Baru */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Harga Modal Baru (Kulakan)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      min="0"
                      required
                      value={customCostPrice === 0 ? '' : customCostPrice}
                      onChange={(e) => setCustomCostPrice(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full text-xs font-semibold py-2 pl-9 pr-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Bisa diperbarui jika harga suplier berubah
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Harga Jual Toko
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      min="0"
                      required
                      value={customSellingPrice === 0 ? '' : customSellingPrice}
                      onChange={(e) => setCustomSellingPrice(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full text-xs font-semibold py-2 pl-9 pr-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Harga jual eceran ke pelanggan
                  </span>
                </div>
              </div>

              {/* Live Preview Ringkasan Modal & Laba */}
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-indigo-600" />
                    Total Biaya Kulakan ({restockAmount} pcs):
                  </span>
                  <span className="font-bold text-slate-900">
                    {formatRupiah((Number(restockAmount) || 0) * (Number(customCostPrice) || 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    Estimasi Margin Baru / Unit:
                  </span>
                  <span className="font-bold text-emerald-700">
                    +{formatRupiah((Number(customSellingPrice) || 0) - (Number(customCostPrice) || 0))}
                    {customSellingPrice > 0 && customCostPrice > 0 && (
                      <span className="ml-1 text-[10px] font-normal text-emerald-600">
                        ({Math.round(((customSellingPrice - customCostPrice) / customSellingPrice) * 100)}%)
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCustomRestockModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingRestock || restockAmount <= 0}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm transition-colors duration-150 cursor-pointer"
                >
                  {submittingRestock ? 'Menyimpan...' : `Tambah +${restockAmount} Stok`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Hapus Aksesoris */}
      {itemToDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Hapus Aksesoris</h3>
                <p className="text-xs text-slate-500">Konfirmasi penghapusan data fisik</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 mb-4 text-xs space-y-1">
              <div className="font-bold text-slate-800">{itemToDelete.name}</div>
              <div className="text-slate-500 font-mono text-[11px]">SKU: {itemToDelete.code}</div>
              <div className="text-slate-600 text-[11px]">
                Sisa Stok: <span className="font-bold text-slate-900">{itemToDelete.stock} {itemToDelete.unit || 'pcs'}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Apakah Anda yakin ingin menghapus data aksesoris ini? Data akan dihapus secara permanen dari Cloud database.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={deleting}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white shadow-sm transition-colors duration-150 cursor-pointer"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


