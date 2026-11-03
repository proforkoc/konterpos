import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  Printer,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlayCircle,
  FileCheck,
  XCircle,
  Cpu,
  Layers,
  Eye,
  Trash2,
  X,
  FileText,
  Smartphone,
  Phone,
} from 'lucide-react';
import { ServiceSoftwareOrder } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  getStoredServiceOrders,
  saveStoredServiceOrders,
  executeUnifiedDelete,
  onTransactionDeleted,
  onDataUpdated,
  notifyDataUpdated,
} from '../utils/transactionSync.ts';

interface SoftwareServiceModuleProps {
  onPrintReceipt: (order: ServiceSoftwareOrder) => void;
}

export const SoftwareServiceModule: React.FC<SoftwareServiceModuleProps> = ({
  onPrintReceipt,
}) => {
  const { currentRole } = useAuth();
  const isOwner = currentRole === 'owner';

  const [orders, setOrders] = useState<ServiceSoftwareOrder[]>(() => {
    return getStoredServiceOrders() || [];
  });
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Modal: New Service Order
  const [newOrderModal, setNewOrderModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [deviceImei, setDeviceImei] = useState('');
  const [deviceColor, setDeviceColor] = useState('');
  const [issueType, setIssueType] = useState('Lupa Pola / FRP Google');
  const [issueDetails, setIssueDetails] = useState('');
  const [toolsUsed, setToolsUsed] = useState('UnlockTool');
  const [toolCost, setToolCost] = useState(25000); // 1 credit modal
  const [estimatedCost, setEstimatedCost] = useState(150000);
  const [downPayment, setDownPayment] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Modal: Update Status / Finish Service
  const [statusModal, setStatusModal] = useState<ServiceSoftwareOrder | null>(null);
  const [newStatus, setNewStatus] = useState<string>('in_progress');
  const [updatedTools, setUpdatedTools] = useState('');
  const [updatedToolCost, setUpdatedToolCost] = useState(0);
  const [updatedFinalCost, setUpdatedFinalCost] = useState(0);
  const [technicianNotes, setTechnicianNotes] = useState('');

  // Modal: Detail Service Order
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<ServiceSoftwareOrder | null>(null);

  // Modal: Delete Confirmation
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<ServiceSoftwareOrder | null>(null);
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

  const handleOpenDetail = (order: ServiceSoftwareOrder) => {
    setSelectedOrderForDetail(order);
    setDetailModalOpen(true);
  };

  const handleOpenDelete = (order: ServiceSoftwareOrder) => {
    setOrderToDelete(order);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    setDeleting(true);
    try {
      const res = await executeUnifiedDelete({
        category: 'service',
        rawId: orderToDelete.id,
        invoiceNumber: orderToDelete.orderNumber,
      });
      if (res.success) {
        setOrders((prev) => prev.filter((o) => o.id !== orderToDelete.id));
        setDeleteModalOpen(false);
        setOrderToDelete(null);
        setToastMessage(`Nota servis ${orderToDelete.orderNumber} berhasil dihapus`);
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        alert(res.message || 'Gagal menghapus nota servis');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus nota servis');
    } finally {
      setDeleting(false);
    }
  };

  const loadOrders = async () => {
    try {
      const res = await fetch('/api/services?limit=100');
      const data = await res.json();
      if (Array.isArray(data)) {
        setOrders(data);
        saveStoredServiceOrders(data);
      } else {
        const stored = getStoredServiceOrders();
        setOrders(stored || []);
      }
    } catch (err) {
      console.error('Failed to load service orders:', err);
      const stored = getStoredServiceOrders();
      setOrders(stored || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();

    // Reaktif: Dengarkan event penghapusan transaksi dari Riwayat Struk
    const unsubscribeDelete = onTransactionDeleted((payload) => {
      if (payload.category === 'service' || payload.category === ('all' as any)) {
        setOrders((prev) => {
          const updated = prev.filter(
            (o) => o.id !== payload.rawId && o.orderNumber !== payload.invoiceNumber
          );
          saveStoredServiceOrders(updated);
          return updated;
        });
      }
    });

    const unsubscribeUpdate = onDataUpdated((payload) => {
      if (payload.category === 'service' || payload.category === 'all') {
        loadOrders();
      }
    });

    return () => {
      unsubscribeDelete();
      unsubscribeUpdate();
    };
  }, []);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone || !deviceModel) {
      alert('Nama pelanggan, no WhatsApp, dan tipe model HP wajib diisi');
      return;
    }

    const estCost = Math.max(0, Number(estimatedCost) || 0);
    const dp = Math.max(0, Number(downPayment) || 0);
    if (dp > estCost && estCost > 0) {
      alert('Uang muka (DP) tidak boleh melebihi estimasi biaya servis');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          deviceModel: deviceModel.trim(),
          deviceImei: deviceImei.trim() || undefined,
          deviceColor: deviceColor.trim() || undefined,
          issueType,
          issueDetails: issueDetails.trim() || undefined,
          toolsUsed,
          toolCost,
          estimatedCost,
          downPayment,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal membuat tanda terima servis');
      }

      const createdOrder: ServiceSoftwareOrder = await res.json();

      setNewOrderModal(false);
      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setDeviceModel('');
      setDeviceImei('');
      setIssueDetails('');
      setDownPayment(0);

      // Sinkronisasi state lokal & localStorage
      setOrders((prev) => {
        const nextList = [createdOrder, ...prev.filter((o) => o.id !== createdOrder.id && o.orderNumber !== createdOrder.orderNumber)];
        saveStoredServiceOrders(nextList);
        return nextList;
      });
      notifyDataUpdated('service');
      loadOrders();

      // Print Tanda Terima Masuk Servis
      onPrintReceipt(createdOrder);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenStatusModal = (order: ServiceSoftwareOrder) => {
    setStatusModal(order);
    setNewStatus(order.status);
    setUpdatedTools(order.toolsUsed || 'UnlockTool');
    setUpdatedToolCost(order.toolCost || 0);
    setUpdatedFinalCost(order.finalCost || order.estimatedCost);
    setTechnicianNotes(order.technicianNotes || '');
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModal) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/services/${statusModal.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          toolsUsed: updatedTools,
          toolCost: updatedToolCost,
          finalCost: updatedFinalCost,
          technicianNotes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal memperbarui status servis');
      }

      const updated = await res.json();
      setStatusModal(null);

      // Sinkronisasi state lokal & localStorage
      setOrders((prev) => {
        const nextList = prev.map((o) =>
          o.id === updated.id || o.orderNumber === updated.orderNumber ? updated : o
        );
        saveStoredServiceOrders(nextList);
        return nextList;
      });
      notifyDataUpdated('service');
      loadOrders();

      if (newStatus === 'completed' || newStatus === 'picked_up') {
        onPrintReceipt(updated);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerPhone.toLowerCase().includes(q) ||
      o.deviceModel.toLowerCase().includes(q) ||
      (o.deviceImei && o.deviceImei.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 whitespace-nowrap">
            <Clock className="w-3 h-3 text-slate-500 shrink-0" />
            <span>Diterima</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">
            <PlayCircle className="w-3 h-3 text-amber-600 shrink-0" />
            <span>Flashing / Bypass</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>Selesai (Siap)</span>
          </span>
        );
      case 'picked_up':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 whitespace-nowrap">
            <FileCheck className="w-3 h-3 text-indigo-600 shrink-0" />
            <span>Diambil (Lunas)</span>
          </span>
        );
      case 'cancelled_failed':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 whitespace-nowrap">
            <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
            <span>Batal / Gagal</span>
          </span>
        );
      default:
        return <span className="whitespace-nowrap">{status}</span>;
    }
  };

  const activeCount = orders.filter((o) => o.status === 'received' || o.status === 'in_progress').length;
  const readyPickupCount = orders.filter((o) => o.status === 'completed').length;
  const receivedCount = orders.filter((o) => o.status === 'received').length;
  const inProgressCount = orders.filter((o) => o.status === 'in_progress').length;
  const completedCount = orders.filter((o) => o.status === 'completed').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-1.5 pb-6 sm:pb-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900 text-lg">
              Pilar 5: Modul Khusus Servis Software HP & Log Digital Tools
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pencatatan unit masuk, keluhan kerusakan (FRP, Bootloop, Bypass MiCloud, Unbrick), biaya modal tool credit server, dan status garansi.
          </p>
        </div>

        <button
          onClick={() => setNewOrderModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Terima Unit Servis Baru</span>
        </button>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Antrean Servis Aktif</div>
            <div className="text-xl font-bold text-amber-600 mt-1">{activeCount} Unit di Meja Kerja</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Siap Diambil Pelanggan</div>
            <div className="text-xl font-bold text-emerald-600 mt-1">{readyPickupCount} Unit Selesai</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Total Riwayat Servis</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{orders.length} Order Masuk</div>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
            <Cpu className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4 overflow-visible" style={{ overflow: 'visible' }}>
        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 overflow-visible" style={{ overflow: 'visible' }}>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto py-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors duration-150 cursor-pointer shadow-2xs ${
                statusFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:text-indigo-600 hover:bg-slate-50'
              }`}
            >
              <span>Semua</span>
              {orders.length > 0 && (
                <span
                  className={`min-w-[20px] h-[20px] px-1 aspect-square rounded-full text-[10px] font-extrabold inline-flex items-center justify-center leading-none transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  {orders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setStatusFilter('received')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors duration-150 cursor-pointer shadow-2xs ${
                statusFilter === 'received'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:text-indigo-600 hover:bg-slate-50'
              }`}
            >
              <span>Diterima</span>
              {receivedCount > 0 && (
                <span
                  className={`min-w-[20px] h-[20px] px-1 aspect-square rounded-full text-[10px] font-extrabold inline-flex items-center justify-center leading-none transition-colors ${
                    statusFilter === 'received'
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  {receivedCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors duration-150 cursor-pointer shadow-2xs ${
                statusFilter === 'in_progress'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:text-indigo-600 hover:bg-slate-50'
              }`}
            >
              <span>Proses Pengerjaan</span>
              {inProgressCount > 0 && (
                <span
                  className={`min-w-[20px] h-[20px] px-1 aspect-square rounded-full text-[10px] font-extrabold inline-flex items-center justify-center leading-none transition-colors ${
                    statusFilter === 'in_progress'
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  {inProgressCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors duration-150 cursor-pointer shadow-2xs ${
                statusFilter === 'completed'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:text-indigo-600 hover:bg-slate-50'
              }`}
            >
              <span>Selesai</span>
              {completedCount > 0 && (
                <span
                  className={`min-w-[20px] h-[20px] px-1 aspect-square rounded-full text-[10px] font-extrabold inline-flex items-center justify-center leading-none transition-colors ${
                    statusFilter === 'completed'
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  {completedCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setStatusFilter('picked_up')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors duration-150 cursor-pointer shadow-2xs ${
                statusFilter === 'picked_up'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:text-indigo-600 hover:bg-slate-50'
              }`}
            >
              <span>Sudah Diambil</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari no servis, model HP, nama..."
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
              Memuat antrean servis...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              Tidak ada data servis yang sesuai filter
            </div>
          ) : (
            filtered.map((order) => {
              const totalCost = order.finalCost || order.estimatedCost;
              const estimatedProfit = Math.max(0, totalCost - order.toolCost);
              return (
                <div
                  key={order.id}
                  className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2.5 transition hover:shadow-xs"
                >
                  {/* Baris Atas: Nomor Nota & Badge di sisi kiri, serta Nominal Total dan Laba di sisi kanan */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-900 tracking-tight">
                          {order.orderNumber}
                        </span>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {formatDateTime(order.receivedAt)}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-extrabold text-slate-900">
                        {formatRupiah(totalCost)}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-bold">
                        +{formatRupiah(estimatedProfit)}
                      </div>
                    </div>
                  </div>

                  {/* Baris Tengah: Nama Pelanggan, jenis perangkat/layanan, informasi metode/status pembayaran */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-slate-800 truncate">
                          {order.customerName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono truncate">
                          ({order.customerPhone})
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                          order.balanceDue <= 0
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {order.balanceDue <= 0 ? 'LUNAS' : `SISA ${formatRupiah(order.balanceDue)}`}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/60">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Smartphone className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="font-semibold text-slate-800 truncate">
                          {order.deviceModel}
                        </span>
                        {order.deviceImei && (
                          <span className="text-[10px] text-slate-400 font-mono truncate">
                            • {order.deviceImei.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/60 truncate ml-2">
                        {order.issueType}
                      </span>
                    </div>
                  </div>

                  {/* Baris Bawah: Tombol aksi yang rapi dan mudah di-tap: Detail, Cetak Struk, dan Hapus */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenDetail(order)}
                      className="flex-1 min-h-[42px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs transition-colors duration-150 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>Detail</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onPrintReceipt(order)}
                      className="flex-1 min-h-[42px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-xs transition-colors duration-150 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Cetak Struk</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenDelete(order)}
                      title="Hapus Nota Servis"
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
                <th style={{ width: '15%' }} className="px-2.5 py-2.5">
                  No. Servis & Tanggal
                </th>
                <th style={{ width: '13%' }} className="px-2 py-2.5">
                  Pelanggan
                </th>
                <th style={{ width: '16%' }} className="px-2 py-2.5">
                  Tipe HP & IMEI
                </th>
                <th style={{ width: '17%' }} className="px-2 py-2.5">
                  Kerusakan / Tindakan
                </th>
                <th style={{ width: '10%' }} className="px-2 py-2.5">
                  Tool Kredit
                </th>
                <th style={{ width: '12%' }} className="px-2 py-2.5">
                  Biaya & Sisa Tagihan
                </th>
                <th style={{ width: '6%' }} className="px-2 py-2.5">
                  Status
                </th>
                <th style={{ width: '11%' }} className="px-2.5 py-2.5 text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    Memuat antrean servis...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    Tidak ada data servis yang sesuai filter
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-2.5 py-2 overflow-hidden">
                      <div className="font-mono text-xs font-bold text-slate-900 truncate">
                        {order.orderNumber}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {new Date(order.receivedAt).toLocaleDateString('id-ID')}
                      </div>
                    </td>
                    <td className="px-2 py-2 overflow-hidden">
                      <div className="font-semibold text-slate-900 truncate" title={order.customerName}>
                        {order.customerName}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">
                        {order.customerPhone}
                      </div>
                    </td>
                    <td className="px-2 py-2 overflow-hidden">
                      <div className="font-semibold text-slate-800 truncate" title={order.deviceModel}>
                        {order.deviceModel}
                      </div>
                      {order.deviceImei ? (
                        <div className="font-mono text-[10px] text-slate-500 truncate" title={`IMEI: ${order.deviceImei}`}>
                          IMEI: {order.deviceImei}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400">Tanpa IMEI</div>
                      )}
                    </td>
                    <td className="px-2 py-2 overflow-hidden">
                      <span className="inline-block max-w-full font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded truncate" title={order.issueType}>
                        {order.issueType}
                      </span>
                      {order.issueDetails && (
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate" title={order.issueDetails}>
                          {order.issueDetails}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-2 overflow-hidden">
                      <div className="font-medium text-slate-800 truncate" title={order.toolsUsed || '-'}>
                        {order.toolsUsed || '-'}
                      </div>
                      <div className="text-[10px] text-rose-600 font-semibold whitespace-nowrap">
                        Modal: {formatRupiah(order.toolCost)}
                      </div>
                    </td>
                    <td className="px-2 py-2 overflow-hidden">
                      <div className="font-bold text-slate-900 whitespace-nowrap">
                        {formatRupiah(order.finalCost || order.estimatedCost)}
                      </div>
                      <div className="text-[10px] text-slate-500 whitespace-nowrap truncate">
                        DP: {formatRupiah(order.downPayment)} | Sisa:{' '}
                        <strong className="text-indigo-700">{formatRupiah(order.balanceDue)}</strong>
                      </div>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap overflow-hidden">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-2.5 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <button
                          onClick={() => handleOpenDetail(order)}
                          title="Lihat Detail Lengkap Servis"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[10px] shadow-2xs transition-colors cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span>Detail</span>
                        </button>
                        <button
                          onClick={() => handleOpenStatusModal(order)}
                          title="Update Status Servis"
                          className="inline-flex items-center px-2 py-1 text-[10px] font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 transition cursor-pointer"
                        >
                          Update
                        </button>
                        <button
                          onClick={() => onPrintReceipt(order)}
                          title="Cetak Tanda Terima Servis"
                          className="inline-flex items-center p-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-200/90 text-indigo-700 font-bold text-[10px] shadow-2xs transition-colors cursor-pointer"
                        >
                          <Printer className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(order)}
                          title="Hapus Nota Servis"
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

      {/* MODAL: Input Unit Servis Baru */}
      {newOrderModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Penerimaan Unit Servis Software HP</h3>
              <button
                onClick={() => setNewOrderModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-3.5 my-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Nama Pemilik / Pelanggan
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Bambang Sutrisno"
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Nomor WhatsApp / HP
                  </label>
                  <input
                    type="text"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="08129876xxxx"
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Tipe Model Handphone
                  </label>
                  <input
                    type="text"
                    required
                    value={deviceModel}
                    onChange={(e) => setDeviceModel(e.target.value)}
                    placeholder="Xiaomi Redmi Note 11, Samsung A52..."
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Nomor IMEI / SN (Jika Ada)
                  </label>
                  <input
                    type="text"
                    value={deviceImei}
                    onChange={(e) => setDeviceImei(e.target.value)}
                    placeholder="8642190xxxx / Belakang Casing"
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Kategori Kerusakan Software
                </label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white font-semibold"
                >
                  <option value="Lupa Pola / FRP Google">Lupa Pola / Kunci Layar / FRP Google Account</option>
                  <option value="Bootloop / Stuck Logo">Bootloop / Restart Terus / Stuck Logo Vendor</option>
                  <option value="Flash Firmware Official">Flash Firmware Resmi (Upgrade / Downgrade OS)</option>
                  <option value="Bypass MiCloud / ID Akun">Bypass MiCloud Xiaomi / Akun Huawei / Realme ID</option>
                  <option value="Unbrick / Mati Total EDL">Unbrick Qualcomm 9008 EDL / Mediatek Auth Port</option>
                  <option value="IMEI Repair / Sinyal Hilang">Sinyal Hilang / Baseband Unknown / IMEI Null</option>
                  <option value="Root / UBL / Custom ROM">Unlock Bootloader (UBL) & Custom ROM</option>
                  <option value="Lainnya">Kerusakan Software Lainnya</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Catatan Rincian Keluhan
                </label>
                <textarea
                  rows={2}
                  value={issueDetails}
                  onChange={(e) => setIssueDetails(e.target.value)}
                  placeholder="Misal: Lupa email setelah reset 3 jari, baterai masih terisi..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Tool / Box yang Digunakan
                  </label>
                  <select
                    value={toolsUsed}
                    onChange={(e) => setToolsUsed(e.target.value)}
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="UnlockTool">UnlockTool</option>
                    <option value="Pandora Box">Pandora Box</option>
                    <option value="Miracle Box">Miracle Box Thunder</option>
                    <option value="AMT Dongle">AMT (Android Multi Tool)</option>
                    <option value="Hydra Tool">Hydra Tool Dongle</option>
                    <option value="Odin / Mi Flash Official">Odin Samsung / Mi Flash (Gratis)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Modal Kredit Tool (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={toolCost || ''}
                    onChange={(e) => setToolCost(Number(e.target.value) || 0)}
                    placeholder="25000"
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white font-medium"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Biaya sewa/kredit server</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Estimasi Biaya Total (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    required
                    value={estimatedCost || ''}
                    onChange={(e) => setEstimatedCost(Number(e.target.value) || 0)}
                    placeholder="150000"
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Uang Muka / DP (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={downPayment || ''}
                    onChange={(e) => setDownPayment(Number(e.target.value) || 0)}
                    placeholder="50000"
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-semibold text-emerald-700"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewOrderModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan & Cetak Tanda Terima'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Update Status Servis */}
      {statusModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Update Status Pengerjaan Servis</h3>
                <p className="text-xs text-indigo-600 font-mono font-bold">{statusModal.orderNumber}</p>
              </div>
              <button
                onClick={() => setStatusModal(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-3.5 my-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Pilih Status Baru
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white font-bold"
                >
                  <option value="received">Diterima (Menunggu Antrean)</option>
                  <option value="in_progress">Sedang Dikerjakan (Flashing / Bypass)</option>
                  <option value="completed">Selesai Berhasil (Siap Diambil)</option>
                  <option value="picked_up">Unit Sudah Diambil Pelanggan (Lunas)</option>
                  <option value="cancelled_failed">Gagal / Dibatalkan (Kembalikan Unit)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Modal Kredit Tool (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={updatedToolCost || ''}
                    onChange={(e) => setUpdatedToolCost(Number(e.target.value) || 0)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Biaya Final Disepakati (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={updatedFinalCost || ''}
                    onChange={(e) => setUpdatedFinalCost(Number(e.target.value) || 0)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Catatan Teknisi
                </label>
                <textarea
                  rows={2}
                  value={technicianNotes}
                  onChange={(e) => setTechnicianNotes(e.target.value)}
                  placeholder="Bypass sukses via Testpoint EDL Qualcomm, rom global stabil..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Detail Lengkap Nota Servis */}
      {detailModalOpen && selectedOrderForDetail && (
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
                    Rincian Servis Software HP
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs font-bold text-indigo-700">
                      {selectedOrderForDetail.orderNumber}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      • {formatDateTime(selectedOrderForDetail.receivedAt)}
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
              {/* Customer & Unit Info */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">Pemilik / Pelanggan</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {selectedOrderForDetail.customerName}
                  </span>
                  <span className="text-slate-500 font-mono text-[11px] block mt-0.5">
                    {selectedOrderForDetail.customerPhone}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block">Status Pengerjaan</span>
                  <div className="mt-1 flex justify-end">
                    {getStatusBadge(selectedOrderForDetail.status)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Unit Handphone</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                    {selectedOrderForDetail.deviceModel}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block">Nomor IMEI / SN</span>
                  <span className="font-mono font-medium text-slate-700 text-xs">
                    {selectedOrderForDetail.deviceImei || 'Tanpa IMEI'}
                  </span>
                </div>
              </div>

              {/* Keluhan & Tool */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white text-xs space-y-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">Kategori Masalah:</span>
                  <span className="font-bold text-indigo-700 text-xs mt-0.5 inline-block">
                    {selectedOrderForDetail.issueType}
                  </span>
                  {selectedOrderForDetail.issueDetails && (
                    <p className="text-slate-600 mt-1 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {selectedOrderForDetail.issueDetails}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[11px]">
                  <span className="text-slate-500">Tool / Dongle Digunakan:</span>
                  <span className="font-semibold text-slate-800">{selectedOrderForDetail.toolsUsed || '-'}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500">Modal Sewa Kredit Tool:</span>
                  <span className="font-bold text-rose-600 font-mono">{formatRupiah(selectedOrderForDetail.toolCost)}</span>
                </div>
              </div>

              {/* Rincian Biaya Servis */}
              <div className="space-y-1.5 p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Estimasi Biaya:</span>
                  <span className="font-mono">{formatRupiah(selectedOrderForDetail.estimatedCost)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Uang Muka (DP):</span>
                  <span className="font-mono">{formatRupiah(selectedOrderForDetail.downPayment)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm">
                  <span className="font-bold text-slate-900">Total Biaya Final:</span>
                  <span className="font-extrabold text-indigo-700 font-mono text-base">
                    {formatRupiah(selectedOrderForDetail.finalCost || selectedOrderForDetail.estimatedCost)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700">Sisa Tagihan Konsumen:</span>
                  <span className={`font-bold font-mono ${selectedOrderForDetail.balanceDue <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {selectedOrderForDetail.balanceDue <= 0 ? 'LUNAS' : formatRupiah(selectedOrderForDetail.balanceDue)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200 text-xs">
                  <span className="font-medium text-emerald-700">Estimasi Laba Servis:</span>
                  <span className="font-bold text-emerald-700 font-mono">
                    +{formatRupiah((selectedOrderForDetail.finalCost || selectedOrderForDetail.estimatedCost) - selectedOrderForDetail.toolCost)}
                  </span>
                </div>
              </div>

              {selectedOrderForDetail.technicianNotes && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
                  <span className="text-[10px] text-slate-400 block mb-0.5">Catatan Teknisi:</span>
                  {selectedOrderForDetail.technicianNotes}
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
                  setDetailModalOpen(false);
                  handleOpenStatusModal(selectedOrderForDetail);
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200/60 transition-colors cursor-pointer"
              >
                Update Status
              </button>
              <button
                type="button"
                onClick={() => {
                  onPrintReceipt(selectedOrderForDetail);
                  setDetailModalOpen(false);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Nota</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Hapus Nota Servis */}
      {deleteModalOpen && orderToDelete && (
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
                Hapus Nota Servis?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Tindakan ini permanen dan akan menghapus antrean servis{' '}
                <strong className="text-slate-800 font-mono">{orderToDelete.orderNumber}</strong> dari database kasir.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-left text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Pelanggan:</span>
                <span className="font-semibold text-slate-800">{orderToDelete.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Unit:</span>
                <span className="font-medium text-slate-800">{orderToDelete.deviceModel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Biaya:</span>
                <span className="font-bold text-indigo-700">
                  {formatRupiah(orderToDelete.finalCost || orderToDelete.estimatedCost)}
                </span>
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
