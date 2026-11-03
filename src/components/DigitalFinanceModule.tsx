import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Printer,
  Search,
  ArrowRightLeft,
  Smartphone,
  Zap,
  ShieldCheck,
  Send,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Eye,
  Trash2,
  AlertTriangle,
  X,
  FileText,
} from 'lucide-react';
import { DigitalTransaction } from '../types/index.ts';
import {
  getStoredDigitalTransactions,
  saveStoredDigitalTransactions,
  executeUnifiedDelete,
  onTransactionDeleted,
  onDataUpdated,
  notifyDataUpdated,
} from '../utils/transactionSync.ts';

interface DigitalFinanceModuleProps {
  onPrintReceipt: (tx: DigitalTransaction) => void;
}

export const DigitalFinanceModule: React.FC<DigitalFinanceModuleProps> = ({ onPrintReceipt }) => {
  const [transactions, setTransactions] = useState<DigitalTransaction[]>(() => {
    return getStoredDigitalTransactions() || [];
  });
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all');
  const [search, setSearch] = useState('');

  // Form State for New Transaction
  const [transType, setTransType] = useState<string>('brilink_transfer');
  const [provider, setProvider] = useState<string>('BRI');
  const [targetAccount, setTargetAccount] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [nominal, setNominal] = useState<number>(100000);
  const [adminBankCost, setAdminBankCost] = useState<number>(3000); // modal potong sistem
  const [adminStoreFee, setAdminStoreFee] = useState<number>(6000); // tagihan ke konsumen
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<DigitalTransaction | null>(null);

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<DigitalTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const formatRupiah = (val: number) => 'Rp ' + Number(val || 0).toLocaleString('id-ID');

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} • ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return dateStr;
    }
  };

  const getServiceBadge = (type: string) => {
    if (type.startsWith('brilink') || type.includes('bank')) {
      return {
        label: 'BRILink / Bank',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    }
    if (type.includes('ewallet')) {
      return {
        label: 'E-Wallet',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }
    if (type.startsWith('ppob') || type.includes('pulsa')) {
      return {
        label: 'PPOB & Pulsa',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }
    return {
      label: type.replace(/_/g, ' ').toUpperCase(),
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    };
  };

  const loadTransactions = async () => {
    try {
      const res = await fetch('/api/digital-finance?limit=100');
      const data = await res.json();
      if (Array.isArray(data)) {
        setTransactions(data);
        saveStoredDigitalTransactions(data);
      } else {
        const stored = getStoredDigitalTransactions();
        setTransactions(stored || []);
      }
    } catch (err) {
      console.error('Failed to load digital transactions:', err);
      const stored = getStoredDigitalTransactions();
      setTransactions(stored || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();

    // Reaktif: Dengarkan event penghapusan transaksi dari Riwayat Struk
    const unsubscribeDelete = onTransactionDeleted((payload) => {
      if (payload.category === 'digital' || payload.category === ('all' as any)) {
        setTransactions((prev) => {
          const updated = prev.filter(
            (tx) => tx.id !== payload.rawId && tx.referenceNumber !== payload.invoiceNumber
          );
          saveStoredDigitalTransactions(updated);
          return updated;
        });
      }
    });

    const unsubscribeUpdate = onDataUpdated((payload) => {
      if (payload.category === 'digital' || payload.category === 'all') {
        loadTransactions();
      }
    });

    return () => {
      unsubscribeDelete();
      unsubscribeUpdate();
    };
  }, []);

  // Preset providers & admin fee recommendations when changing transaction type
  const handleTypeChange = (newType: string) => {
    setTransType(newType);
    if (newType === 'brilink_transfer') {
      setProvider('BRI');
      setAdminBankCost(3000);
      setAdminStoreFee(7000);
    } else if (newType === 'brilink_tarik_tunai') {
      setProvider('BRI');
      setAdminBankCost(0);
      setAdminStoreFee(5000);
    } else if (newType === 'topup_ewallet') {
      setProvider('DANA');
      setAdminBankCost(1000);
      setAdminStoreFee(3500);
    } else if (newType === 'ppob_token_pln') {
      setProvider('PLN');
      setAdminBankCost(1500);
      setAdminStoreFee(4000);
    } else if (newType === 'ppob_pulsa') {
      setProvider('TELKOMSEL');
      setAdminBankCost(1000);
      setAdminStoreFee(3000);
    } else if (newType === 'ppob_tagihan') {
      setProvider('BPJS');
      setAdminBankCost(2000);
      setAdminStoreFee(5000);
    }
  };

  const totalCustomerPaid = (Number(nominal) || 0) + (Number(adminStoreFee) || 0);
  const netProfit = (Number(adminStoreFee) || 0) - (Number(adminBankCost) || 0);

  const handleOpenDetail = (tx: DigitalTransaction) => {
    setSelectedTxForDetail(tx);
    setDetailModalOpen(true);
  };

  const handleOpenDelete = (tx: DigitalTransaction) => {
    setTxToDelete(tx);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!txToDelete) return;
    setDeleting(true);
    try {
      const res = await executeUnifiedDelete({
        category: 'digital',
        rawId: txToDelete.id,
        invoiceNumber: txToDelete.referenceNumber,
      });
      if (res.success) {
        setTransactions((prev) => prev.filter((t) => t.id !== txToDelete.id));
        setDeleteModalOpen(false);
        setTxToDelete(null);
        setToastMessage(`Transaksi ${txToDelete.referenceNumber} berhasil dihapus`);
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        alert(res.message || 'Gagal menghapus transaksi');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus transaksi');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAccount.trim() || nominal <= 0) {
      alert('Nomor tujuan (rekening/no hp/ID) dan nominal wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/digital-finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: transType,
          provider: provider.toUpperCase(),
          targetAccount: targetAccount.trim(),
          customerName: customerName.trim() || 'Pelanggan',
          nominal,
          adminBankCost: adminBankCost || 0,
          adminStoreFee: adminStoreFee || 0,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan transaksi');
      }

      const savedTx: DigitalTransaction = await res.json();

      // Reset form fields
      setTargetAccount('');
      setCustomerName('');
      setNotes('');

      // Update state & localStorage secara reaktif
      setTransactions((prev) => {
        const updated = [savedTx, ...prev];
        saveStoredDigitalTransactions(updated);
        return updated;
      });
      notifyDataUpdated('digital');

      // Offer instant print
      onPrintReceipt(savedTx);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Hitung jumlah data per kategori secara dinamis untuk badge filter tab
  const allCount = transactions.length;
  const bankCount = transactions.filter(
    (tx) => tx.type === 'brilink_transfer' || tx.type === 'brilink_tarik_tunai' || tx.type.startsWith('brilink')
  ).length;
  const ewalletCount = transactions.filter(
    (tx) => tx.type === 'topup_ewallet' || tx.type.includes('ewallet')
  ).length;
  const ppobCount = transactions.filter((tx) => tx.type.startsWith('ppob')).length;

  const filtered = transactions.filter((tx) => {
    let matchType = false;
    if (typeFilter === 'all') {
      matchType = true;
    } else if (typeFilter === 'brilink_transfer') {
      matchType =
        tx.type === 'brilink_transfer' ||
        tx.type === 'brilink_tarik_tunai' ||
        tx.type.startsWith('brilink');
    } else if (typeFilter === 'topup_ewallet') {
      matchType = tx.type === 'topup_ewallet' || tx.type.includes('ewallet');
    } else if (typeFilter === 'ppob') {
      matchType = tx.type.startsWith('ppob');
    } else {
      matchType = tx.type === typeFilter;
    }

    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      tx.targetAccount.toLowerCase().includes(q) ||
      (tx.customerName && tx.customerName.toLowerCase().includes(q)) ||
      tx.provider.toLowerCase().includes(q) ||
      tx.referenceNumber.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  const totalDigitalVolume = transactions.reduce((acc, cur) => acc + cur.totalCustomerPaid, 0);
  const totalDigitalMargin = transactions.reduce((acc, cur) => acc + cur.profit, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-1.5 pb-6 sm:pb-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900 text-lg">
              Pilar 3 & 4: Layanan Keuangan Digital, Agen Bank & PPOB
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pencatatan Agen BRILink, Transfer Bank, Top Up E-Wallet (Dana, OVO, Gopay), Pulsa & Token PLN dengan kalkulasi laba admin otomatis.
          </p>
        </div>

        <div className="flex gap-4">
          <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-right">
            <div className="text-[10px] text-slate-500 font-medium">Total Perputaran Uang</div>
            <div className="font-bold text-slate-900 text-xs">{formatRupiah(totalDigitalVolume)}</div>
          </div>
          <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-right">
            <div className="text-[10px] text-emerald-700 font-medium">Total Margin Fee Toko</div>
            <div className="font-bold text-emerald-800 text-xs">+{formatRupiah(totalDigitalMargin)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Terminal Transaksi Cepat (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Input Transaksi Baru</h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                Kalkulasi Margin Otomatis
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Jenis Layanan */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Pilih Pilar Layanan
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('brilink_transfer')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition ${
                      transType === 'brilink_transfer'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Transfer Bank / BRILink</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTypeChange('topup_ewallet')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition ${
                      transType === 'topup_ewallet'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Top Up E-Wallet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTypeChange('ppob_token_pln')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition ${
                      transType === 'ppob_token_pln'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Token & Listrik PLN</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTypeChange('ppob_pulsa')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition ${
                      transType === 'ppob_pulsa'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Pulsa & Paket Data</span>
                  </button>
                </div>
              </div>

              {/* Bank / Provider Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Bank / Provider
                  </label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white font-semibold"
                  >
                    <optgroup label="Bank Transfer">
                      <option value="BRI">Bank BRI</option>
                      <option value="BCA">Bank BCA</option>
                      <option value="MANDIRI">Bank Mandiri</option>
                      <option value="BNI">Bank BNI</option>
                      <option value="BSI">Bank Syariah BSI</option>
                      <option value="JAGO">Bank Jago / Neo</option>
                    </optgroup>
                    <optgroup label="E-Wallet">
                      <option value="DANA">DANA</option>
                      <option value="GOPAY">GoPay Customer / Driver</option>
                      <option value="OVO">OVO</option>
                      <option value="SHOPEEPAY">ShopeePay</option>
                      <option value="LINKAJA">LinkAja</option>
                    </optgroup>
                    <optgroup label="PPOB & Operator">
                      <option value="PLN">PLN (Token / Tagihan)</option>
                      <option value="TELKOMSEL">Telkomsel</option>
                      <option value="INDOSAT">Indosat Ooredoo</option>
                      <option value="XL">XL / Axis</option>
                      <option value="TRI">Tri (3)</option>
                      <option value="BPJS">BPJS Kesehatan</option>
                      <option value="PDAM">PDAM Air</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Nama Pelanggan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Bpk. Hendra"
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              {/* No Rekening / No HP */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  No Rekening / No HP / ID Pelanggan
                </label>
                <input
                  type="text"
                  required
                  value={targetAccount}
                  onChange={(e) => setTargetAccount(e.target.value)}
                  placeholder="Contoh: 0019010xxxx / 0812xxxx / ID Meter"
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-mono font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Nominal & Quick Buttons */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nominal Transaksi (Rp)
                </label>
                <input
                  type="number"
                  min="5000"
                  step="5000"
                  required
                  value={nominal || ''}
                  onChange={(e) => setNominal(Number(e.target.value) || 0)}
                  className="w-full text-sm py-2 px-3 rounded-xl border border-slate-200 font-bold text-slate-900"
                />

                <div className="flex gap-1 mt-1.5 overflow-x-auto no-scrollbar">
                  {[50000, 100000, 200000, 500000, 1000000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setNominal(val)}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold whitespace-nowrap"
                    >
                      {formatRupiah(val)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fee Admin Matrix */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">
                    Modal Admin Bank (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={adminBankCost || ''}
                    onChange={(e) => setAdminBankCost(Number(e.target.value) || 0)}
                    placeholder="3000"
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white font-medium"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Potongan saldo agen</span>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">
                    Biaya Admin Toko (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={adminStoreFee || ''}
                    onChange={(e) => setAdminStoreFee(Number(e.target.value) || 0)}
                    placeholder="7000"
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white font-bold text-indigo-700"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Dibayar konsumen</span>
                </div>
              </div>

              {/* Kalkulasi Ringkas - Eye-friendly light theme */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-medium">Total Tagihan Pelanggan:</span>
                  <span className="font-extrabold text-sm text-indigo-700">
                    {formatRupiah(totalCustomerPaid)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 text-[11px]">
                  <span className="text-slate-500 font-medium">Margin Laba Bersih Toko:</span>
                  <span className="font-extrabold text-emerald-600">+{formatRupiah(netProfit)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs hover:shadow-md hover:shadow-indigo-500/20 transition-colors duration-150 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>Simpan Transaksi & Cetak Struk</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Table: Riwayat Mutasi Agen & Cetak Struk Ulang (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4 overflow-visible" style={{ overflow: 'visible' }}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 overflow-visible" style={{ overflow: 'visible' }}>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto py-1">
                <button
                  onClick={() => setTypeFilter('all')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors duration-150 cursor-pointer shadow-2xs ${
                    typeFilter === 'all'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:text-indigo-600 hover:bg-slate-50'
                  }`}
                >
                  <span>Semua</span>
                  {allCount > 0 && (
                    <span
                      className={`min-w-[20px] h-[20px] px-1 aspect-square rounded-full text-[10px] font-extrabold inline-flex items-center justify-center leading-none transition-colors ${
                        typeFilter === 'all'
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                      }`}
                    >
                      {allCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setTypeFilter('brilink_transfer')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors duration-150 cursor-pointer shadow-2xs ${
                    typeFilter === 'brilink_transfer'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:text-indigo-600 hover:bg-slate-50'
                  }`}
                >
                  <span>BRILink / Bank</span>
                  {bankCount > 0 && (
                    <span
                      className={`min-w-[20px] h-[20px] px-1 aspect-square rounded-full text-[10px] font-extrabold inline-flex items-center justify-center leading-none transition-colors ${
                        typeFilter === 'brilink_transfer'
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                      }`}
                    >
                      {bankCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setTypeFilter('topup_ewallet')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors duration-150 cursor-pointer shadow-2xs ${
                    typeFilter === 'topup_ewallet'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:text-indigo-600 hover:bg-slate-50'
                  }`}
                >
                  <span>E-Wallet</span>
                  {ewalletCount > 0 && (
                    <span
                      className={`min-w-[20px] h-[20px] px-1 aspect-square rounded-full text-[10px] font-extrabold inline-flex items-center justify-center leading-none transition-colors ${
                        typeFilter === 'topup_ewallet'
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                      }`}
                    >
                      {ewalletCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setTypeFilter('ppob')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors duration-150 cursor-pointer shadow-2xs ${
                    typeFilter === 'ppob'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:text-indigo-600 hover:bg-slate-50'
                  }`}
                >
                  <span>PPOB & Pulsa</span>
                  {ppobCount > 0 && (
                    <span
                      className={`min-w-[20px] h-[20px] px-1 aspect-square rounded-full text-[10px] font-extrabold inline-flex items-center justify-center leading-none transition-colors ${
                        typeFilter === 'ppob'
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                      }`}
                    >
                      {ppobCount}
                    </span>
                  )}
                </button>
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari no rekening / SN..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>
            </div>

            {/* Mobile View: Vertical Card Layout (block md:hidden) */}
            <div className="block md:hidden space-y-3">
              {loading ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Memuat data transaksi digital...
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Belum ada riwayat transaksi digital
                </div>
              ) : (
                filtered.map((tx) => {
                  const badge = getServiceBadge(tx.type);
                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2.5 transition hover:shadow-xs"
                    >
                      {/* Baris Atas: Nomor Referensi & Badge di sisi kiri, serta Nominal Total dan Laba di sisi kanan */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-900 tracking-tight">
                              {tx.referenceNumber}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${badge.badgeClass}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {formatDateTime(tx.createdAt)}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-extrabold text-slate-900">
                            {formatRupiah(tx.totalCustomerPaid)}
                          </div>
                          <div className="text-[10px] text-emerald-700 font-bold">
                            +{formatRupiah(tx.profit)}
                          </div>
                        </div>
                      </div>

                      {/* Baris Tengah: Nama Pelanggan, nomor tujuan/rekening, layanan/provider, informasi metode pembayaran */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-semibold text-slate-800 truncate">
                            {tx.customerName || 'Pelanggan Umum'}
                          </span>
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-white rounded border border-slate-200 text-slate-600 shrink-0">
                            {tx.paymentMethod || 'TUNAI'}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/60">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-slate-800 uppercase px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] shadow-2xs shrink-0">
                              {tx.provider}
                            </span>
                            <span className="text-[11px] font-medium text-slate-600 truncate capitalize">
                              {tx.type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="font-mono font-semibold text-slate-900 text-xs truncate ml-2">
                            {tx.targetAccount}
                          </div>
                        </div>
                      </div>

                      {/* Baris Bawah: Tombol aksi yang rapi dan mudah di-tap: Detail, Cetak Struk, dan Hapus */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(tx)}
                          className="flex-1 min-h-[42px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs transition-colors duration-150 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>Detail</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onPrintReceipt(tx)}
                          className="flex-1 min-h-[42px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-xs transition-colors duration-150 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Cetak Struk</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDelete(tx)}
                          title="Hapus Transaksi"
                          className="min-h-[42px] px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 text-rose-700 font-bold text-xs transition-colors duration-150 cursor-pointer flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop View: Standar Table Layout (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl">
              <table
                className="w-full text-left text-xs table-fixed"
                style={{ tableLayout: 'fixed', width: '100%' }}
              >
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th style={{ width: '18%' }} className="px-2.5 py-2.5">
                      Waktu & Ref/SN
                    </th>
                    <th style={{ width: '15%' }} className="px-2 py-2.5">
                      Layanan / Provider
                    </th>
                    <th style={{ width: '22%' }} className="px-2 py-2.5">
                      No. Tujuan
                    </th>
                    <th style={{ width: '11%' }} className="px-2 py-2.5">
                      Nominal
                    </th>
                    <th style={{ width: '11%' }} className="px-2 py-2.5">
                      Total Bayar
                    </th>
                    <th style={{ width: '10%' }} className="px-2 py-2.5">
                      Laba Toko
                    </th>
                    <th style={{ width: '13%' }} className="px-2 py-2.5 text-right">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        Memuat data transaksi digital...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        Belum ada riwayat transaksi digital
                      </td>
                    </tr>
                  ) : (
                    filtered.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-2.5 py-2 overflow-hidden">
                          <div className="font-mono text-[11px] font-bold text-slate-800 truncate" title={tx.referenceNumber}>
                            {tx.referenceNumber}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {new Date(tx.createdAt).toLocaleDateString('id-ID')}
                          </div>
                        </td>
                        <td className="px-2 py-2 overflow-hidden">
                          <span className="inline-block max-w-full font-semibold text-slate-800 uppercase px-1.5 py-0.5 rounded bg-slate-100 truncate" title={tx.provider}>
                            {tx.provider}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate capitalize" title={tx.type.replace('_', ' ')}>
                            {tx.type.replace('_', ' ')}
                          </div>
                        </td>
                        <td className="px-2 py-2 font-mono overflow-hidden">
                          <div className="font-medium text-slate-900 truncate" title={tx.targetAccount}>
                            {tx.targetAccount}
                          </div>
                          {tx.customerName && (
                            <div className="text-[10px] text-slate-500 font-sans truncate" title={tx.customerName}>
                              {tx.customerName}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 font-medium text-slate-700 whitespace-nowrap overflow-hidden">
                          {formatRupiah(tx.nominal)}
                        </td>
                        <td className="px-2 py-2 font-bold text-slate-900 whitespace-nowrap overflow-hidden">
                          {formatRupiah(tx.totalCustomerPaid)}
                        </td>
                        <td className="px-2 py-2 text-emerald-700 font-bold whitespace-nowrap overflow-hidden">
                          +{formatRupiah(tx.profit)}
                        </td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <button
                              onClick={() => handleOpenDetail(tx)}
                              title="Lihat Detail Transaksi"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[10px] shadow-2xs transition-colors cursor-pointer"
                            >
                              <Eye className="w-3 h-3 text-slate-500" />
                              <span>Detail</span>
                            </button>
                            <button
                              onClick={() => onPrintReceipt(tx)}
                              title="Cetak Struk Thermal"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-200/90 text-indigo-700 font-bold text-[10px] shadow-2xs transition-colors cursor-pointer"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Struk</span>
                            </button>
                            <button
                              onClick={() => handleOpenDelete(tx)}
                              title="Hapus Transaksi"
                              className="inline-flex items-center justify-center p-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 shadow-2xs transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Detail Transaksi Digital */}
      {detailModalOpen && selectedTxForDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6 border border-slate-200 animate-in fade-in zoom-in-95 my-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Rincian Transaksi Digital
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs font-bold text-indigo-700">
                      {selectedTxForDetail.referenceNumber}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      • {formatDateTime(selectedTxForDetail.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 my-4">
              {/* Info Pelanggan & Layanan */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">Pelanggan</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {selectedTxForDetail.customerName || 'Pelanggan Umum'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block">Metode Pembayaran</span>
                  <span className="font-bold text-slate-800 uppercase px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] inline-block">
                    {selectedTxForDetail.paymentMethod || 'TUNAI'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Provider & Layanan</span>
                  <span className="font-semibold text-slate-800">
                    {selectedTxForDetail.provider} • {selectedTxForDetail.type.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block">No. Tujuan / Rekening</span>
                  <span className="font-mono font-bold text-slate-900 text-xs">
                    {selectedTxForDetail.targetAccount}
                  </span>
                </div>
              </div>

              {/* Rincian Finansial Transaksi */}
              <div className="space-y-2 p-3.5 rounded-xl border border-slate-200 bg-white text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Nominal Transaksi:</span>
                  <span className="font-semibold font-mono">{formatRupiah(selectedTxForDetail.nominal)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Biaya Admin Toko:</span>
                  <span className="font-semibold font-mono">{formatRupiah(selectedTxForDetail.adminStoreFee)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 text-[11px]">
                  <span>Biaya Modal Admin Bank:</span>
                  <span className="font-mono">{formatRupiah(selectedTxForDetail.adminBankCost)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-sm">
                  <span className="font-bold text-slate-900">Total Bayar Pelanggan:</span>
                  <span className="font-extrabold text-indigo-700 font-mono text-base">
                    {formatRupiah(selectedTxForDetail.totalCustomerPaid)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-xs">
                  <span className="font-medium text-emerald-700">Estimasi Laba Toko:</span>
                  <span className="font-bold text-emerald-700 font-mono">
                    +{formatRupiah(selectedTxForDetail.profit)}
                  </span>
                </div>
              </div>

              {selectedTxForDetail.notes && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
                  <span className="text-[10px] text-slate-400 block mb-0.5">Catatan:</span>
                  {selectedTxForDetail.notes}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  onPrintReceipt(selectedTxForDetail);
                  setDetailModalOpen(false);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Ulang Struk</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Transaksi */}
      {deleteModalOpen && txToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 sm:p-6 border border-slate-200 animate-in fade-in zoom-in-95 my-auto text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-base text-slate-900">
                Hapus Transaksi Digital?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Tindakan ini permanen dan akan menghapus transaksi{' '}
                <strong className="text-slate-800 font-mono">{txToDelete.referenceNumber}</strong> dari database kasir.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-left text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Layanan:</span>
                <span className="font-semibold text-slate-800">{txToDelete.provider} - {txToDelete.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">No. Tujuan:</span>
                <span className="font-mono font-medium text-slate-800">{txToDelete.targetAccount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Bayar:</span>
                <span className="font-bold text-indigo-700">{formatRupiah(txToDelete.totalCustomerPaid)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border border-slate-700 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
