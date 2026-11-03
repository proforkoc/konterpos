import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  TrendingUp,
  DollarSign,
  Smartphone,
  Headphones,
  CreditCard,
  Wrench,
  Receipt,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Banknote,
  QrCode,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { FinancialSummary } from '../types/index.ts';
import { onDataUpdated, onTransactionDeleted } from '../utils/transactionSync.ts';

const INDONESIAN_MONTHS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
];

export const AnalyticsModule: React.FC = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const todayDateStr = now.toISOString().slice(0, 10);

  // Filter States
  const [periodType, setPeriodType] = useState<'monthly' | 'daily' | 'yearly' | 'all'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedDate, setSelectedDate] = useState<string>(todayDateStr);
  const [availableYears, setAvailableYears] = useState<number[]>([
    currentYear + 1,
    currentYear,
    currentYear - 1,
    currentYear - 2,
    currentYear - 3,
  ]);

  const [data, setData] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const formatRupiah = (val: number) => 'Rp ' + Number(val || 0).toLocaleString('id-ID');

  const loadSummary = async () => {
    setLoading(true);
    try {
      let url = `/api/analytics/summary?period=${periodType}`;
      if (periodType === 'monthly') {
        url += `&month=${selectedMonth}&year=${selectedYear}`;
      } else if (periodType === 'yearly') {
        url += `&year=${selectedYear}`;
      } else if (periodType === 'daily') {
        url += `&date=${selectedDate}`;
      }

      const res = await fetch(url);
      const summary = await res.json();
      setData(summary);

      if (summary.availableYears && Array.isArray(summary.availableYears)) {
        setAvailableYears((prev) => {
          const merged = Array.from(new Set([...prev, ...summary.availableYears])).sort((a, b) => b - a);
          return merged;
        });
      }
    } catch (err) {
      console.error('Failed to load financial summary:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSummary();

    const unsubUpdate = onDataUpdated(() => {
      loadSummary();
    });
    const unsubDelete = onTransactionDeleted(() => {
      loadSummary();
    });

    return () => {
      unsubUpdate();
      unsubDelete();
    };
  }, [periodType, selectedMonth, selectedYear, selectedDate]);

  // Quick navigation handlers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const handlePrevYear = () => {
    setSelectedYear((prev) => prev - 1);
  };

  const handleNextYear = () => {
    setSelectedYear((prev) => prev + 1);
  };

  const handleToday = () => {
    setSelectedDate(todayDateStr);
  };

  const handleYesterday = () => {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    setSelectedDate(yest.toISOString().slice(0, 10));
  };

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setSelectedDate(`${y}-${m}-${day}`);
    }
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setSelectedDate(`${y}-${m}-${day}`);
    }
  };

  // Label text for active period
  const getActivePeriodLabel = () => {
    if (periodType === 'monthly') {
      const monthObj = INDONESIAN_MONTHS.find((m) => m.value === selectedMonth);
      return `${monthObj ? monthObj.label : 'Bulan'} ${selectedYear}`;
    }
    if (periodType === 'yearly') {
      return `Tahun ${selectedYear}`;
    }
    if (periodType === 'daily') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
        const [y, m, d] = selectedDate.split('-');
        const monthObj = INDONESIAN_MONTHS.find((im) => im.value === parseInt(m, 10));
        return `${parseInt(d, 10)} ${monthObj ? monthObj.label : m} ${y}`;
      }
      return `Tanggal ${selectedDate}`;
    }
    return 'Semua Periode Riwayat';
  };

  const activePeriodLabel = getActivePeriodLabel();

  const handleExportCSV = () => {
    if (!data) return;

    let csv = `LAPORAN LABA RUGI & ANALITIK KONTER HP\n`;
    csv += `Periode: ${activePeriodLabel.toUpperCase()}\n`;
    if (data.selectedPeriodInfo?.startDate && data.selectedPeriodInfo?.endDate) {
      if (data.selectedPeriodInfo.startDate === data.selectedPeriodInfo.endDate) {
        csv += `Tanggal: ${data.selectedPeriodInfo.startDate} (00:00:00 s/d 23:59:59)\n`;
      } else {
        csv += `Rentang Tanggal: ${data.selectedPeriodInfo.startDate} s/d ${data.selectedPeriodInfo.endDate}\n`;
      }
    }
    csv += `Tanggal Cetak: ${new Date().toLocaleString('id-ID')}\n\n`;

    csv += `RINGKASAN TOTAL OPERASIONAL\n`;
    csv += `Total Omset Bruto (Kotor),${data.totalGrossOmset}\n`;
    csv += `Total Laba Kotor Gabungan,${data.totalGrossProfit}\n`;
    csv += `Total Beban Operasional Toko,${data.totalExpenses}\n`;
    csv += `Laba Bersih Toko (Net Profit),${data.netProfit}\n\n`;

    csv += `BREAKDOWN 6 PILAR KEUNTUNGAN\n`;
    csv += `Pilar Usaha,Omset,Modal / Beban,Margin Keuntungan Bersih\n`;
    csv += `1. Penjualan Smartphone & HP,${data.pillarBreakdown.hp.omset},-,${data.pillarBreakdown.hp.profit}\n`;
    csv += `2. Penjualan Aksesoris & Sparepart,${data.pillarBreakdown.aksesoris.omset},-,${data.pillarBreakdown.aksesoris.profit}\n`;
    csv += `3. Fee Agen BRILink & Transfer Bank,-,-,${data.pillarBreakdown.brilinkBank.profit}\n`;
    csv += `4. Fee Top Up E-Wallet,-,-,${data.pillarBreakdown.ewallet.profit}\n`;
    csv += `5. Profit PPOB Pulsa & Token PLN,-,-,${data.pillarBreakdown.ppobPulsa.profit}\n`;
    csv += `6. Jasa Servis Software HP,${data.pillarBreakdown.serviceSoftware.omset},${data.pillarBreakdown.serviceSoftware.toolCost},${data.pillarBreakdown.serviceSoftware.profit}\n\n`;

    csv += `RINCIAN PENGELUARAN OPERASIONAL TOKO\n`;
    csv += `Kategori Pengeluaran,Nominal Biaya\n`;
    for (const [cat, amt] of Object.entries(data.expensesByCategory)) {
      csv += `${cat.replace(/_/g, ' ').toUpperCase()},${amt}\n`;
    }

    if (data.paymentMethodBreakdown) {
      csv += `\nREKAPITULASI METODE PEMBAYARAN KASIR\n`;
      csv += `Metode Pembayaran,Jumlah Transaksi,Total Nilai Masuk\n`;
      csv += `Tunai (Cash),${data.paymentMethodBreakdown.cash.count},${data.paymentMethodBreakdown.cash.total}\n`;
      csv += `QRIS Toko,${data.paymentMethodBreakdown.qris.count},${data.paymentMethodBreakdown.qris.total}\n`;
      csv += `Transfer Bank,${data.paymentMethodBreakdown.transfer.count},${data.paymentMethodBreakdown.transfer.total}\n`;
    }

    const safeFilenameLabel = activePeriodLabel.replace(/[\s\(\)\/]+/g, '_');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Keuangan_Konter_${safeFilenameLabel}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isTodayActive = periodType === 'daily' && selectedDate === todayDateStr;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-1.5 pb-6 sm:pb-8 space-y-6">
      {/* Header & Controls Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        {/* Title & Cloud Sync Indicator */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <h2 className="font-bold text-slate-900 text-lg">
                Pilar 6: Laporan Keuangan Otomatis & Analitik Laba/Rugi (P&L)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Rekapitulasi komprehensif omset, margin keuntungan bersih (6 pilar), beban operasional, dan arus kas per metode pembayaran.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Cloud Database Terhubung
            </span>
            <button
              onClick={() => {
                setRefreshing(true);
                loadSummary();
              }}
              title="Segarkan data dari database cloud"
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
            <button
              onClick={handleExportCSV}
              disabled={!data || loading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar: Tab Type & Dropdown Bulan / Tahun */}
        <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Main Period Type Switcher: Harian | Bulanan | Tahunan | Semua */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-semibold shrink-0">
            <button
              onClick={() => setPeriodType('daily')}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                periodType === 'daily'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Harian
            </button>
            <button
              onClick={() => setPeriodType('monthly')}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                periodType === 'monthly'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bulanan
            </button>
            <button
              onClick={() => setPeriodType('yearly')}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                periodType === 'yearly'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tahunan
            </button>
            <button
              onClick={() => setPeriodType('all')}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                periodType === 'all'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua
            </button>
          </div>

          {/* Granular Period Selector (Month / Year / Date) */}
          <div className="flex flex-wrap items-center gap-2">
            {periodType === 'monthly' && (
              <>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="text-xs text-slate-500 font-medium">Bulan:</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer py-0.5"
                  >
                    {INDONESIAN_MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                  <span className="text-xs text-slate-500 font-medium">Tahun:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer py-0.5"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick Navigate Buttons: Bulan Lalu (<) dan Bulan Depan (>) */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevMonth}
                    title="Bulan Sebelumnya"
                    aria-label="Bulan Sebelumnya"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition bg-white shadow-2xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    title="Bulan Berikutnya"
                    aria-label="Bulan Berikutnya"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition bg-white shadow-2xs"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}

            {periodType === 'yearly' && (
              <>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="text-xs text-slate-500 font-medium">Pilih Tahun:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer py-0.5"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevYear}
                    title="Tahun Sebelumnya"
                    aria-label="Tahun Sebelumnya"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition bg-white shadow-2xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleNextYear}
                    title="Tahun Berikutnya"
                    aria-label="Tahun Berikutnya"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition bg-white shadow-2xs"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}

            {periodType === 'daily' && (
              <>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="text-xs text-slate-500 font-medium">Tanggal:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer py-0.5"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevDay}
                    title="Hari Sebelumnya"
                    aria-label="Hari Sebelumnya"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition bg-white shadow-2xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleNextDay}
                    title="Hari Berikutnya"
                    aria-label="Hari Berikutnya"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition bg-white shadow-2xs"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleYesterday}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold border bg-white border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                  >
                    Kemarin
                  </button>
                  <button
                    onClick={handleToday}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
                      isTodayActive
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Hari Ini
                  </button>
                </div>
              </>
            )}

            {periodType === 'all' && (
              <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 font-medium">
                Menampilkan seluruh data riwayat transaksi
              </span>
            )}
          </div>
        </div>

        {/* Active Filter Summary Bar */}
        <div className="pt-2 flex flex-wrap items-center justify-between text-xs bg-slate-50/80 -mx-5 -mb-5 px-5 py-2.5 rounded-b-2xl border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Periode Laporan Aktif:</span>
            <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold">
              {activePeriodLabel}
            </span>
            {data?.selectedPeriodInfo?.startDate && data?.selectedPeriodInfo?.endDate && (
              <span className="text-slate-400 hidden sm:inline">
                {data.selectedPeriodInfo.startDate === data.selectedPeriodInfo.endDate
                  ? `(${data.selectedPeriodInfo.startDate} • 00:00:00 s/d 23:59:59)`
                  : `(${data.selectedPeriodInfo.startDate} s/d ${data.selectedPeriodInfo.endDate})`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-slate-600 font-medium mt-1 sm:mt-0">
            <span>
              Total Transaksi: <strong className="text-slate-900">{data?.indicators?.transactionCount || 0}</strong>
            </span>
            <span className="text-slate-300">&bull;</span>
            <span>
              POS Retail: <strong className="text-slate-900">{data?.indicators?.salesCount || 0}</strong>
            </span>
            <span className="text-slate-300">&bull;</span>
            <span>
              Agen & Servis: <strong className="text-slate-900">{(data?.indicators?.digitalCount || 0) + (data?.indicators?.serviceCount || 0)}</strong>
            </span>
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm space-y-2">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-medium text-slate-600">Mengagregasi laporan keuangan dari database cloud...</p>
          <p className="text-xs text-slate-400">Menghitung omset, laba kotor 6 pilar, beban, dan net profit untuk periode {activePeriodLabel}</p>
        </div>
      ) : !data ? (
        <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
          Data laporan keuangan tidak tersedia untuk periode ini.
        </div>
      ) : (
        <>
          {/* Top 4 KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Omset Bruto */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2 relative overflow-hidden">
              {loading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                  <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                </div>
              )}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Total Omset Bruto</span>
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-extrabold text-slate-900">
                {formatRupiah(data.totalGrossOmset)}
              </div>
              <div className="text-[11px] text-slate-400">
                Total perputaran uang masuk pada periode {activePeriodLabel}
              </div>
            </div>

            {/* 2. Total Laba Kotor */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2 relative overflow-hidden">
              {loading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                  <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                </div>
              )}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Total Laba Kotor</span>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-extrabold text-emerald-700">
                +{formatRupiah(data.totalGrossProfit)}
              </div>
              <div className="text-[11px] text-slate-400">
                Margin gabungan produk HP, aksesoris, fee agen & servis
              </div>
            </div>

            {/* 3. Beban Operasional */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2 relative overflow-hidden">
              {loading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                  <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                </div>
              )}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Beban Operasional Toko</span>
                <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                  <ArrowDownRight className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-extrabold text-rose-600">
                -{formatRupiah(data.totalExpenses)}
              </div>
              <div className="text-[11px] text-slate-400">
                Listrik, internet, sewa, ATK kertas, kredit tool
              </div>
            </div>

            {/* 4. Laba Bersih (Net Profit) */}
            <div className="bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/70 border-2 border-emerald-200/90 p-5 rounded-2xl shadow-xs space-y-2 text-slate-900 relative overflow-hidden">
              {loading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                  <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
                </div>
              )}
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                <span>LABA BERSIH (NET PROFIT)</span>
                <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div
                className={`text-2xl font-black ${
                  data.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {formatRupiah(data.netProfit)}
              </div>
              <div className="text-[11px] text-emerald-800/80 font-medium">
                {data.totalGrossOmset > 0
                  ? `Margin Bersih: ${((data.netProfit / data.totalGrossOmset) * 100).toFixed(1)}%`
                  : 'Siap cetak laporan'}
              </div>
            </div>
          </div>

          {/* Rekapitulasi Arus Kas Metode Pembayaran Kasir (Cash, QRIS, Transfer) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Rekapitulasi Penerimaan Kasir per Metode Pembayaran
                  </h3>
                  <p className="text-xs text-slate-500">
                    Distribusi arus kas masuk dari penjualan retail POS (Tunai, QRIS Toko, dan Transfer Bank)
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                {activePeriodLabel}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Tunai / Cash */}
              <div className="p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                      <Banknote className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">Tunai (Cash / Fisik)</h4>
                      <span className="text-[10px] text-slate-500">Penerimaan kas laci</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 px-2 py-0.5 rounded-full bg-emerald-100">
                    {data.paymentMethodBreakdown?.cash.count || 0} Trx
                  </span>
                </div>
                <div className="pt-2 border-t border-emerald-200/60 flex justify-between items-baseline">
                  <span className="text-xs text-slate-500">Total Diterima:</span>
                  <span className="text-base font-extrabold text-slate-900">
                    {formatRupiah(data.paymentMethodBreakdown?.cash.total || 0)}
                  </span>
                </div>
              </div>

              {/* QRIS Toko */}
              <div className="p-4 rounded-xl border border-indigo-200/80 bg-indigo-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">QRIS Toko (Scan QR)</h4>
                      <span className="text-[10px] text-slate-500">GoPay, OVO, Dana, BCA QR</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-indigo-700 px-2 py-0.5 rounded-full bg-indigo-100">
                    {data.paymentMethodBreakdown?.qris.count || 0} Trx
                  </span>
                </div>
                <div className="pt-2 border-t border-indigo-200/60 flex justify-between items-baseline">
                  <span className="text-xs text-slate-500">Total Diterima:</span>
                  <span className="text-base font-extrabold text-slate-900">
                    {formatRupiah(data.paymentMethodBreakdown?.qris.total || 0)}
                  </span>
                </div>
              </div>

              {/* Transfer Bank */}
              <div className="p-4 rounded-xl border border-sky-200/80 bg-sky-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-sky-100 text-sky-700">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">Transfer Bank</h4>
                      <span className="text-[10px] text-slate-500">BCA, BRI, Mandiri, BNI</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-sky-700 px-2 py-0.5 rounded-full bg-sky-100">
                    {data.paymentMethodBreakdown?.transfer.count || 0} Trx
                  </span>
                </div>
                <div className="pt-2 border-t border-sky-200/60 flex justify-between items-baseline">
                  <span className="text-xs text-slate-500">Total Diterima:</span>
                  <span className="text-base font-extrabold text-slate-900">
                    {formatRupiah(data.paymentMethodBreakdown?.transfer.total || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown 6 Pilar Usaha Matrix */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Breakdown Keuntungan per Kategori Usaha (6 Pilar)
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Periode: <strong>{activePeriodLabel}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Pilar 1: HP & Smartphone */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">Pilar 1: Penjualan HP & IMEI</h4>
                      <span className="text-[10px] text-slate-500">Smartphone unit baru & second</span>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200/70 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Omset HP:</span>
                    <span className="font-semibold text-slate-800">
                      {formatRupiah(data.pillarBreakdown.hp.omset)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500 font-bold">
                    <span>Margin Bersih:</span>
                    <span className="text-emerald-700">
                      +{formatRupiah(data.pillarBreakdown.hp.profit)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pilar 2: Aksesoris */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-violet-100 text-violet-700">
                      <Headphones className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">Pilar 2: Aksesoris & Sparepart</h4>
                      <span className="text-[10px] text-slate-500">Charger, TWS, Case, TG</span>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200/70 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Omset Aksesoris:</span>
                    <span className="font-semibold text-slate-800">
                      {formatRupiah(data.pillarBreakdown.aksesoris.omset)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500 font-bold">
                    <span>Margin Bersih:</span>
                    <span className="text-emerald-700">
                      +{formatRupiah(data.pillarBreakdown.aksesoris.profit)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pilar 3: Agen BRILink / Bank */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">Pilar 3A: Agen BRILink & Transfer</h4>
                      <span className="text-[10px] text-slate-500">Transfer bank sesama/antar bank</span>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200/70 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Jenis Keuntungan:</span>
                    <span className="font-medium text-slate-700">Fee Admin Toko</span>
                  </div>
                  <div className="flex justify-between text-slate-500 font-bold">
                    <span>Margin Bersih:</span>
                    <span className="text-emerald-700">
                      +{formatRupiah(data.pillarBreakdown.brilinkBank.profit)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pilar 3B: E-Wallet */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-cyan-100 text-cyan-700">
                      <Percent className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">Pilar 3B: Top Up E-Wallet</h4>
                      <span className="text-[10px] text-slate-500">Dana, OVO, Gopay, ShopeePay</span>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200/70 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Jenis Keuntungan:</span>
                    <span className="font-medium text-slate-700">Selisih Admin Jasa</span>
                  </div>
                  <div className="flex justify-between text-slate-500 font-bold">
                    <span>Margin Bersih:</span>
                    <span className="text-emerald-700">
                      +{formatRupiah(data.pillarBreakdown.ewallet.profit)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pilar 4: PPOB & Pulsa */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">Pilar 4: PPOB Pulsa & Token PLN</h4>
                      <span className="text-[10px] text-slate-500">Paket kuota, tagihan BPJS/PDAM</span>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200/70 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Jenis Keuntungan:</span>
                    <span className="font-medium text-slate-700">Admin Toko</span>
                  </div>
                  <div className="flex justify-between text-slate-500 font-bold">
                    <span>Margin Bersih:</span>
                    <span className="text-emerald-700">
                      +{formatRupiah(data.pillarBreakdown.ppobPulsa.profit)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pilar 5: Servis Software */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-rose-100 text-rose-700">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">Pilar 5: Servis Software HP</h4>
                      <span className="text-[10px] text-slate-500">Flashing, FRP, UnlockTool</span>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200/70 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Biaya Servis:</span>
                    <span className="font-semibold text-slate-800">
                      {formatRupiah(data.pillarBreakdown.serviceSoftware.omset)}
                    </span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>Modal Tool Kredit:</span>
                    <span>-{formatRupiah(data.pillarBreakdown.serviceSoftware.toolCost)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 font-bold pt-1 border-t border-slate-200">
                    <span>Laba Bersih Jasa:</span>
                    <span className="text-emerald-700">
                      +{formatRupiah(data.pillarBreakdown.serviceSoftware.profit)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rincian Beban Operasional Toko */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Rekapitulasi Beban Operasional Toko (Total: {formatRupiah(data.totalExpenses)})
              </h3>
              <span className="text-xs text-slate-500">
                Periode: <strong>{activePeriodLabel}</strong>
              </span>
            </div>

            {Object.keys(data.expensesByCategory).length === 0 ? (
              <p className="text-xs text-slate-400 py-3">Belum ada pengeluaran toko yang tercatat pada periode ini</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(data.expensesByCategory).map(([cat, amt]) => (
                  <div key={cat} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] font-semibold text-slate-600 uppercase">
                      {cat.replace(/_/g, ' ')}
                    </div>
                    <div className="text-sm font-bold text-rose-700 mt-1">{formatRupiah(amt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
