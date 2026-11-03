import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  ArrowDownLeft,
  X,
  AlertCircle,
  Cloud,
  Edit3,
  Trash2,
} from 'lucide-react';
import { Product, ProductSerial } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { onTransactionDeleted, onDataUpdated } from '../utils/transactionSync.ts';
import {
  subscribePhones,
  subscribePhoneSerials,
  createPhoneCloud,
  updatePhoneCloud,
  deletePhoneCloud,
  addSingleImeiCloud,
  deleteSerialCloud,
  updateSerialStatusCloud,
  CloudPhoneItem,
  CloudSerialItem,
} from '../services/cloudInventoryService.ts';

export const PhoneImeiModule: React.FC = () => {
  const { canViewCostPrice, canManageInventory } = useAuth();
  const [phones, setPhones] = useState<CloudPhoneItem[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<CloudPhoneItem | null>(null);
  const [serials, setSerials] = useState<CloudSerialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSerials, setLoadingSerials] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'sold'>('all');
  const [cloudSynced, setCloudSynced] = useState(true);

  // Modal: Add New Phone Product
  const [addPhoneModalOpen, setAddPhoneModalOpen] = useState(false);
  const [newBrand, setNewBrand] = useState('Xiaomi');
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newVariant, setNewVariant] = useState('8GB/256GB');
  const [newCostPrice, setNewCostPrice] = useState(0);
  const [newSellingPrice, setNewSellingPrice] = useState(0);
  const [initialImeis, setInitialImeis] = useState<Array<{ imei1: string; imei2: string; color: string }>>([
    { imei1: '', imei2: '', color: 'Black' },
  ]);

  // Modal: Add Single IMEI to Existing Phone
  const [addImeiModalOpen, setAddImeiModalOpen] = useState(false);
  const [singleImei1, setSingleImei1] = useState('');
  const [singleImei2, setSingleImei2] = useState('');
  const [singleSerial, setSingleSerial] = useState('');
  const [singleColor, setSingleColor] = useState('Black');
  const [singleRam, setSingleRam] = useState('');
  const [singleCost, setSingleCost] = useState(0);

  // Modal: Edit Tipe HP
  const [editPhoneModalOpen, setEditPhoneModalOpen] = useState(false);
  const [editBrand, setEditBrand] = useState('');
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editVariant, setEditVariant] = useState('');
  const [editCostPrice, setEditCostPrice] = useState(0);
  const [editSellingPrice, setEditSellingPrice] = useState(0);
  const [editMinStock, setEditMinStock] = useState(1);
  const [submittingEditPhone, setSubmittingEditPhone] = useState(false);

  // Modal: Konfirmasi Hapus Tipe HP
  const [phoneToDelete, setPhoneToDelete] = useState<CloudPhoneItem | null>(null);
  const [deletingPhone, setDeletingPhone] = useState(false);

  const formatRupiah = (val: number) => 'Rp ' + Number(val || 0).toLocaleString('id-ID');

  const handleOpenEditPhone = () => {
    if (!selectedPhone) return;
    setEditBrand(selectedPhone.brand || '');
    setEditName(selectedPhone.name || '');
    setEditCode(selectedPhone.code || '');
    setEditVariant(selectedPhone.variant || '');
    setEditCostPrice(selectedPhone.costPrice || 0);
    setEditSellingPrice(selectedPhone.sellingPrice || 0);
    setEditMinStock(selectedPhone.minStockAlert || 1);
    setEditPhoneModalOpen(true);
  };

  const handleSaveEditPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPhone || !editName.trim() || editSellingPrice <= 0) {
      alert('Nama HP dan Harga Jual wajib diisi!');
      return;
    }
    setSubmittingEditPhone(true);
    try {
      const phoneDocId = selectedPhone.docId || String(selectedPhone.id);
      await updatePhoneCloud(
        phoneDocId,
        {
          name: editName.trim(),
          brand: editBrand.trim(),
          code: editCode.trim(),
          variant: editVariant.trim(),
          costPrice: editCostPrice,
          sellingPrice: editSellingPrice,
          minStockAlert: editMinStock,
        },
        selectedPhone.id
      );
      setEditPhoneModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui data smartphone di cloud');
    } finally {
      setSubmittingEditPhone(false);
    }
  };

  const handleConfirmDeletePhone = async () => {
    if (!phoneToDelete) return;
    setDeletingPhone(true);
    try {
      const phoneDocId = phoneToDelete.docId || String(phoneToDelete.id);
      await deletePhoneCloud(phoneDocId, phoneToDelete.id);
      setPhoneToDelete(null);
      if (selectedPhone?.id === phoneToDelete.id || selectedPhone?.docId === phoneToDelete.docId) {
        setSelectedPhone(null);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus tipe smartphone dari cloud');
    } finally {
      setDeletingPhone(false);
    }
  };

  const loadApiFallback = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      const phoneList = Array.isArray(data) ? data.filter((p: Product) => p.isImeiTracked) : [];
      if (phoneList.length > 0) {
        setPhones(phoneList);
        if (!selectedPhone || !phoneList.some((p: Product) => p.id === selectedPhone.id)) {
          setSelectedPhone(phoneList[0]);
        }
      }
    } catch {
      // quiet fail
    }
  };

  const loadSerialsFallback = async (productId: number | string) => {
    setLoadingSerials(true);
    try {
      const res = await fetch(`/api/products/${productId}/serials`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSerials(data);
      }
    } catch {
      // quiet fail
    } finally {
      setLoadingSerials(false);
    }
  };

  // 1. Sinkronisasi Real-Time Daftar Handphone dari Cloud Firestore
  useEffect(() => {
    setLoading(true);
    const unsubscribePhones = subscribePhones(
      (cloudPhones) => {
        setPhones(cloudPhones);
        setCloudSynced(true);
        setLoading(false);

        if (cloudPhones.length > 0) {
          setSelectedPhone((prev) => {
            if (!prev) return cloudPhones[0];
            const found = cloudPhones.find((p) => p.docId === prev.docId || p.id === prev.id);
            return found || cloudPhones[0];
          });
        } else {
          // Jika cloud masih kosong, cek apakah ada data di API lokal
          loadApiFallback();
        }
      },
      (err) => {
        console.error('Firestore phones listener error, fallback to REST API:', err);
        setCloudSynced(false);
        loadApiFallback().finally(() => setLoading(false));
      }
    );

    const unsubDelete = onTransactionDeleted(() => {
      loadApiFallback();
    });

    const unsubUpdate = onDataUpdated(() => {
      loadApiFallback();
    });

    return () => {
      unsubscribePhones();
      unsubDelete();
      unsubUpdate();
    };
  }, []);

  // 2. Sinkronisasi Real-Time Daftar Nomor IMEI/Serial dari HP yang Dipilih
  useEffect(() => {
    if (!selectedPhone) {
      setSerials([]);
      return;
    }

    setLoadingSerials(true);
    const phoneIdentifier = selectedPhone.docId || String(selectedPhone.id);

    const unsubscribeSerials = subscribePhoneSerials(
      phoneIdentifier,
      (cloudSerials) => {
        setSerials(cloudSerials);
        setLoadingSerials(false);
        // Jika serial di Firestore kosong tapi ada ID numerik, cek API fallback
        if (cloudSerials.length === 0 && typeof selectedPhone.id === 'number') {
          loadSerialsFallback(selectedPhone.id);
        }
      },
      () => {
        if (typeof selectedPhone.id === 'number') {
          loadSerialsFallback(selectedPhone.id);
        } else {
          setLoadingSerials(false);
        }
      }
    );

    return () => {
      unsubscribeSerials();
    };
  }, [selectedPhone?.docId, selectedPhone?.id]);

  const filteredSerials = serials.filter((s) => {
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      s.imei1.toLowerCase().includes(q) ||
      (s.imei2 && s.imei2.toLowerCase().includes(q)) ||
      (s.color && s.color.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  });

  const allCount = serials.length;
  const availableCount = serials.filter((s) => s.status === 'available').length;
  const soldCount = serials.filter((s) => s.status === 'sold').length;

  const handleAddInitialImeiRow = () => {
    setInitialImeis((prev) => [...prev, { imei1: '', imei2: '', color: 'Black' }]);
  };

  const handleSaveNewPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newCode || newSellingPrice <= 0) {
      alert('Nama, SKU/Kode, dan Harga Jual wajib diisi');
      return;
    }

    // Filter valid IMEIs
    const validImeis = initialImeis
      .filter((row) => row.imei1.trim().length > 0)
      .map((row) => ({
        imei1: row.imei1.trim(),
        imei2: row.imei2.trim() || undefined,
        color: row.color.trim() || undefined,
        ramStorage: newVariant,
        purchasePrice: newCostPrice,
      }));

    // Cek duplikasi nomor IMEI dalam daftar input awal
    const imeiSet = new Set<string>();
    for (const item of validImeis) {
      if (item.imei1.length < 8) {
        alert(`Nomor IMEI "${item.imei1}" terlalu pendek (minimal 8 karakter).`);
        return;
      }
      if (imeiSet.has(item.imei1.toLowerCase())) {
        alert(`Ditemukan duplikasi nomor IMEI 1: "${item.imei1}". Setiap unit harus memiliki IMEI unik.`);
        return;
      }
      imeiSet.add(item.imei1.toLowerCase());
    }

    try {
      // Simpan langsung ke Cloud Firestore (dan auto-sinkron ke backend)
      await createPhoneCloud(
        {
          categoryId: 1,
          categoryName: 'Handphone & Gadget',
          categoryCode: 'hp',
          code: newCode.trim(),
          name: newName.trim(),
          brand: newBrand.trim(),
          model: newName.trim(),
          variant: newVariant.trim(),
          costPrice: newCostPrice,
          sellingPrice: newSellingPrice,
          stock: validImeis.length,
          minStockAlert: 2,
          isImeiTracked: true,
          unit: 'unit',
        },
        validImeis
      );

      setAddPhoneModalOpen(false);
      setNewName('');
      setNewCode('');
      setInitialImeis([{ imei1: '', imei2: '', color: 'Black' }]);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan data HP ke cloud');
    }
  };

  const handleSaveSingleImei = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanImei = singleImei1.trim();
    if (!selectedPhone || !cleanImei) {
      alert('Nomor IMEI 1 wajib diisi');
      return;
    }

    if (cleanImei.length < 8) {
      alert('Nomor IMEI 1 terlalu pendek (minimal 8 karakter)');
      return;
    }

    // Cek apakah nomor IMEI sudah ada pada daftar serials HP ini
    const isDuplicate = serials.some(
      (s) => s.imei1.toLowerCase() === cleanImei.toLowerCase()
    );
    if (isDuplicate) {
      alert(`Nomor IMEI 1 "${cleanImei}" sudah pernah didaftarkan pada tipe HP ini!`);
      return;
    }

    try {
      const phoneDocId = selectedPhone.docId || String(selectedPhone.id);

      // Simpan unit IMEI ke Cloud Firestore (dan auto-sinkron ke backend)
      await addSingleImeiCloud(phoneDocId, selectedPhone.id, {
        imei1: cleanImei,
        imei2: singleImei2.trim() || undefined,
        serialNumber: singleSerial.trim() || undefined,
        color: singleColor.trim() || undefined,
        ramStorage: singleRam.trim() || selectedPhone.variant,
        purchasePrice: singleCost || selectedPhone.costPrice,
      });

      setAddImeiModalOpen(false);
      setSingleImei1('');
      setSingleImei2('');
      setSingleSerial('');
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan unit IMEI ke cloud');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-1.5 pb-6 sm:pb-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900 text-lg">Pilar 1: Manajemen Penjualan HP & Pelacakan IMEI</h2>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs text-slate-500">
              Pantau silsilah nomor IMEI / Serial Number unit barang masuk (kulakan) dan barang keluar (penjualan).
            </p>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <Cloud className="w-3 h-3" />
              <span>{cloudSynced ? 'Cloud Firestore Realtime' : 'Database Sinkron'}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setAddPhoneModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Tipe HP Baru</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Phone Model Catalog List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3">
              Daftar Model Handphone ({phones.length})
            </h3>

            {loading ? (
              <div className="text-center py-8 text-xs text-slate-400">Memuat data smartphone...</div>
            ) : phones.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">Belum ada data smartphone</div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1">
                {phones.map((p) => {
                  const isSelected = selectedPhone?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPhone(p)}
                      className={`rounded-xl border transition cursor-pointer flex flex-col justify-between overflow-hidden ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '16px 16px 18px 16px',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 min-w-0 pb-1.5">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-semibold uppercase text-indigo-600 block truncate">
                            {p.brand}
                          </span>
                          <h4 className="font-bold text-slate-900 text-xs truncate">{p.name}</h4>
                          <p className="text-[11px] text-slate-500 truncate">{p.variant}</p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${
                            p.stock > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {p.stock} Unit
                        </span>
                      </div>

                      <div className="mt-auto pt-2 border-t border-slate-100 flex justify-between items-center w-full flex-wrap gap-2 text-[11px]">
                        <span className="text-slate-600 font-semibold truncate whitespace-nowrap">Jual: {formatRupiah(p.sellingPrice)}</span>
                        <span className="text-slate-400 truncate whitespace-nowrap">Modal: {canViewCostPrice ? formatRupiah(p.costPrice) : 'Rp ***'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: IMEI Inventory Details for Selected Phone (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedPhone ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              {/* Selected Phone Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                      SKU: {selectedPhone.code}
                    </span>
                    <span className="text-xs text-slate-500">{selectedPhone.brand}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mt-1">{selectedPhone.name}</h3>
                  <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                    <span>Varian: {selectedPhone.variant}</span>
                    <span>•</span>
                    <span>Harga Jual: <strong className="text-indigo-700">{formatRupiah(selectedPhone.sellingPrice)}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {canManageInventory && (
                    <>
                      <button
                        type="button"
                        onClick={handleOpenEditPhone}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                        title="Edit data tipe smartphone"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit HP</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhoneToDelete(selectedPhone)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition cursor-pointer"
                        title="Hapus tipe smartphone ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus HP</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setSingleCost(selectedPhone.costPrice);
                      setSingleRam(selectedPhone.variant || '');
                      setAddImeiModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold shadow-xs hover:shadow-md hover:shadow-indigo-500/20 transition-colors duration-150 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Input Unit Masuk (IMEI)</span>
                  </button>
                </div>
              </div>

              {/* Filters & Search */}
              <div
                className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 overflow-visible"
                style={{ overflow: 'visible' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Status:</span>
                  <div className="flex items-center gap-2 py-1">
                    <button
                      type="button"
                      onClick={() => setStatusFilter('all')}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 cursor-pointer shadow-2xs ${
                        statusFilter === 'all'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:text-indigo-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>Semua</span>
                      {allCount > 0 && (
                        <span
                          className={`min-w-[20px] h-[20px] px-1 aspect-square rounded-full text-[10px] font-extrabold inline-flex items-center justify-center leading-none transition-colors ${
                            statusFilter === 'all'
                              ? 'bg-white/20 text-white border border-white/30'
                              : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                          }`}
                        >
                          {allCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setStatusFilter('available')}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 cursor-pointer shadow-2xs ${
                        statusFilter === 'available'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:text-indigo-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>Tersedia</span>
                      {availableCount > 0 && (
                        <span
                          className={`min-w-[20px] h-[20px] px-1 aspect-square rounded-full text-[10px] font-extrabold inline-flex items-center justify-center leading-none transition-colors ${
                            statusFilter === 'available'
                              ? 'bg-white/20 text-white border border-white/30'
                              : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                          }`}
                        >
                          {availableCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setStatusFilter('sold')}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 cursor-pointer shadow-2xs ${
                        statusFilter === 'sold'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:text-indigo-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>Terjual</span>
                      {soldCount > 0 && (
                        <span
                          className={`min-w-[20px] h-[20px] px-1 aspect-square rounded-full text-[10px] font-extrabold inline-flex items-center justify-center leading-none transition-colors ${
                            statusFilter === 'sold'
                              ? 'bg-white/20 text-white border border-white/30'
                              : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                          }`}
                        >
                          {soldCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari nomor IMEI / warna..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* IMEI Table - Compact View */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table
                  className="w-full text-left text-xs table-fixed"
                  style={{ tableLayout: 'fixed', width: '100%' }}
                >
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                    <tr>
                      <th style={{ width: '24%' }} className="px-2.5 py-2">
                        Nomor IMEI 1 & 2
                      </th>
                      <th style={{ width: '14%' }} className="px-2 py-2">
                        Serial No
                      </th>
                      <th style={{ width: '18%' }} className="px-2 py-2">
                        Warna / Spek
                      </th>
                      <th style={{ width: '15%' }} className="px-2 py-2">
                        Harga Kulak
                      </th>
                      <th style={{ width: '11%' }} className="px-2 py-2">
                        Status
                      </th>
                      <th style={{ width: '18%' }} className="px-2.5 py-2 text-right">
                        Tanggal Masuk / Terjual
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {loadingSerials ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-slate-400 text-xs">
                          Memuat data nomor IMEI...
                        </td>
                      </tr>
                    ) : filteredSerials.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-slate-400 text-xs">
                          Tidak ada catatan IMEI yang sesuai filter
                        </td>
                      </tr>
                    ) : (
                      filteredSerials.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-2.5 py-2 font-mono overflow-hidden">
                            <div className="font-bold text-slate-900 text-[11px] truncate" title={s.imei1}>
                              {s.imei1}
                            </div>
                            {s.imei2 && (
                              <div className="text-[10px] text-slate-500 truncate" title={`SIM 2: ${s.imei2}`}>
                                SIM 2: {s.imei2}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2 font-mono text-[10px] text-slate-600 overflow-hidden">
                            <div className="truncate" title={s.serialNumber || '-'}>
                              {s.serialNumber || '-'}
                            </div>
                          </td>
                          <td className="px-2 py-2 overflow-hidden">
                            <div className="font-medium text-slate-800 text-[11px] truncate" title={s.color || '-'}>
                              {s.color || '-'}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate" title={s.ramStorage || '-'}>
                              {s.ramStorage || '-'}
                            </div>
                          </td>
                          <td className="px-2 py-2 font-medium text-slate-700 text-[11px] whitespace-nowrap overflow-hidden">
                            <span className="truncate block" title={canViewCostPrice ? formatRupiah(s.purchasePrice) : 'Rp ***'}>
                              {canViewCostPrice ? formatRupiah(s.purchasePrice) : 'Rp ***'}
                            </span>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap overflow-hidden">
                            <span
                              className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                                s.status === 'available'
                                   ? 'bg-emerald-100 text-emerald-800'
                                   : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {s.status === 'available' ? 'Tersedia' : 'Terjual'}
                            </span>
                          </td>
                          <td className="px-2.5 py-2 text-right text-[10px] text-slate-500 whitespace-nowrap overflow-hidden">
                            <span className="truncate block">
                              {s.soldAt
                                ? `Keluar: ${new Date(s.soldAt).toLocaleDateString('id-ID')}`
                                : s.createdAt
                                ? `Masuk: ${new Date(s.createdAt).toLocaleDateString('id-ID')}`
                                : '-'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
              Pilih model handphone di sebelah kiri untuk melihat daftar nomor IMEI
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Tambah Model HP Baru */}
      {addPhoneModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Tambah Tipe HP Baru ke Inventaris</h3>
              <button
                onClick={() => setAddPhoneModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewPhone} className="space-y-4 my-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Merek / Brand</label>
                  <input
                    type="text"
                    required
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    placeholder="Xiaomi, Samsung, Oppo, dll."
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Nama Model HP</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Redmi Note 13 4G"
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Kode / Barcode SKU</label>
                  <input
                    type="text"
                    required
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="HP-RN13-8-256"
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Varian RAM / ROM</label>
                  <input
                    type="text"
                    value={newVariant}
                    onChange={(e) => setNewVariant(e.target.value)}
                    placeholder="8GB / 256GB"
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Harga Modal Kulak (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={newCostPrice || ''}
                    onChange={(e) => setNewCostPrice(Number(e.target.value) || 0)}
                    placeholder="2000000"
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
                    value={newSellingPrice || ''}
                    onChange={(e) => setNewSellingPrice(Number(e.target.value) || 0)}
                    placeholder="2250000"
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-semibold text-indigo-700"
                  />
                </div>
              </div>

              {/* Initial IMEI Rows */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">
                    Input Nomor IMEI Unit Awal (Kulakan)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddInitialImeiRow}
                    className="text-[11px] text-indigo-600 font-bold hover:underline flex items-center gap-1"
                  >
                    + Tambah Baris IMEI
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {initialImeis.map((row, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-2">
                      <div>
                        <input
                          type="text"
                          placeholder="Nomor IMEI 1 (Wajib)"
                          value={row.imei1}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInitialImeis((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, imei1: val } : r))
                            );
                          }}
                          className="w-full text-[11px] font-mono py-1 px-2 rounded-lg border border-slate-200 bg-white"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Nomor IMEI 2"
                          value={row.imei2}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInitialImeis((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, imei2: val } : r))
                            );
                          }}
                          className="w-full text-[11px] font-mono py-1 px-2 rounded-lg border border-slate-200 bg-white"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Warna Unit"
                          value={row.color}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInitialImeis((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, color: val } : r))
                            );
                          }}
                          className="w-full text-[11px] py-1 px-2 rounded-lg border border-slate-200 bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddPhoneModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Simpan Tipe HP & Stok IMEI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tambah Single IMEI ke HP yang Dipilih */}
      {addImeiModalOpen && selectedPhone && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Input Unit Masuk (IMEI Baru)</h3>
                <p className="text-xs text-indigo-600 font-semibold">{selectedPhone.name}</p>
              </div>
              <button
                onClick={() => setAddImeiModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSingleImei} className="space-y-3 my-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nomor IMEI 1 (Wajib)
                </label>
                <input
                  type="text"
                  required
                  value={singleImei1}
                  onChange={(e) => setSingleImei1(e.target.value)}
                  placeholder="86421906xxxxxxx"
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nomor IMEI 2 (Opsional Dual SIM)
                </label>
                <input
                  type="text"
                  value={singleImei2}
                  onChange={(e) => setSingleImei2(e.target.value)}
                  placeholder="86421906xxxxxxx"
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Warna Unit</label>
                  <input
                    type="text"
                    value={singleColor}
                    onChange={(e) => setSingleColor(e.target.value)}
                    placeholder="Hitam, Biru, dll."
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Serial Number (SN)</label>
                  <input
                    type="text"
                    value={singleSerial}
                    onChange={(e) => setSingleSerial(e.target.value)}
                    placeholder="SN-XXXX"
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Harga Kulak Masuk (Rp)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={singleCost || ''}
                  onChange={(e) => setSingleCost(Number(e.target.value) || 0)}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-semibold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddImeiModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Daftarkan IMEI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Tipe Smartphone */}
      {editPhoneModalOpen && selectedPhone && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Edit Data Tipe Smartphone</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditPhoneModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditPhone} className="space-y-3.5 my-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Merek / Brand</label>
                  <input
                    type="text"
                    required
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Nama Model HP</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Kode / Barcode SKU</label>
                  <input
                    type="text"
                    required
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Varian RAM / ROM</label>
                  <input
                    type="text"
                    value={editVariant}
                    onChange={(e) => setEditVariant(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Harga Modal Kulak (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={editCostPrice || ''}
                    onChange={(e) => setEditCostPrice(Number(e.target.value) || 0)}
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
                    value={editSellingPrice || ''}
                    onChange={(e) => setEditSellingPrice(Number(e.target.value) || 0)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-semibold text-indigo-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Batas Peringatan Stok Minimum</label>
                <input
                  type="number"
                  min="0"
                  value={editMinStock || 1}
                  onChange={(e) => setEditMinStock(Number(e.target.value) || 1)}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submittingEditPhone}
                  onClick={() => setEditPhoneModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingEditPhone}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                >
                  {submittingEditPhone ? 'Menyimpan...' : 'Perbarui di Cloud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Hapus Tipe Smartphone */}
      {phoneToDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 rounded-full bg-rose-100">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Hapus Model Smartphone?</h3>
                <p className="text-xs text-slate-500">Tindakan ini permanen di database cloud.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1 mb-4">
              <div className="font-bold text-slate-900">{phoneToDelete.name}</div>
              <div className="text-slate-500">
                Brand: {phoneToDelete.brand} • SKU: {phoneToDelete.code} • Stok: {phoneToDelete.stock} Unit
              </div>
              <div className="text-rose-600 text-[11px] font-semibold mt-1">
                ⚠️ Seluruh nomor IMEI terdaftar pada model ini juga akan dihapus.
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={deletingPhone}
                onClick={() => setPhoneToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deletingPhone}
                onClick={handleConfirmDeletePhone}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5"
              >
                {deletingPhone ? 'Menghapus...' : 'Ya, Hapus Smartphone'}
              </button>
            </div>
          </div>
        </div>
      )}    </div>
  );
};

