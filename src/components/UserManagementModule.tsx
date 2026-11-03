import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  Plus,
  Trash2,
  KeyRound,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  User,
  RefreshCw,
  X,
  Pencil,
  AlertTriangle,
  ShieldAlert,
  Save,
  Check,
} from 'lucide-react';
import { AppUser, UserRole } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { syncUserToFirestore, deleteUserFromFirestore } from '../services/cloudUserService.ts';

export const UserManagementModule: React.FC = () => {
  const { currentRole, switchRole } = useAuth();
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State: Add Staff
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('cashier');
  const [pin, setPin] = useState('1234');
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Modal: Change Staff PIN Quick Modal
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [selectedStaffForPin, setSelectedStaffForPin] = useState<AppUser | null>(null);
  const [newPin, setNewPin] = useState('');
  const [updatingPin, setUpdatingPin] = useState(false);

  // Modal: Edit Full User Data
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<AppUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('cashier');
  const [editPin, setEditPin] = useState('');
  const [showEditPin, setShowEditPin] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal: Confirm Delete User
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUserForDelete, setSelectedUserForDelete] = useState<AppUser | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // Toggle show/hide PIN in table
  const [showPins, setShowPins] = useState<Record<number, boolean>>({});

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setUsersList(list);

      // Sinkronkan ke Cloud Firestore di latar belakang
      list.forEach((u: AppUser) => {
        syncUserToFirestore(u).catch(() => {});
      });
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      showToast('Nama dan email staff wajib diisi');
      return;
    }
    if (pin.length < 4) {
      showToast('PIN minimal 4 digit');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          role,
          pin: pin.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menambahkan staff');
      }

      const createdUser: AppUser = await res.json();

      // Sinkronkan ke Cloud Firestore
      await syncUserToFirestore(createdUser);

      setName('');
      setEmail('');
      setPin('1234');
      showToast('Berhasil menambahkan akun staf baru!');
      loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  // Buka Modal Edit Pengguna
  const handleOpenEditModal = (usr: AppUser) => {
    setSelectedUserForEdit(usr);
    setEditName(usr.name);
    setEditRole(usr.role);
    setEditPin(''); // Kosong secara default agar jika tidak diisi tetap mempertahankan PIN lama
    setShowEditPin(false);
    setEditModalOpen(true);
  };

  // Simpan Perubahan Edit Pengguna
  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;

    if (!editName.trim()) {
      showToast('Nama staf tidak boleh kosong');
      return;
    }

    if (editPin.trim() !== '' && editPin.trim().length < 4) {
      showToast('PIN baru harus minimal 4 digit angka');
      return;
    }

    setSavingEdit(true);
    try {
      const payload: { name: string; role: UserRole; pin?: string } = {
        name: editName.trim(),
        role: editRole,
      };

      if (editPin.trim() !== '') {
        payload.pin = editPin.trim();
      }

      const res = await fetch(`/api/users/${selectedUserForEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal memperbarui data pengguna');
      }

      const updatedUser: AppUser = await res.json();

      // Sinkronkan ke Cloud Firestore secara real-time
      await syncUserToFirestore(updatedUser);

      // Perbarui state lokal
      setUsersList((prev) =>
        prev.map((u) => (u.id === selectedUserForEdit.id ? updatedUser : u))
      );

      setEditModalOpen(false);
      setSelectedUserForEdit(null);
      showToast(`Data staf "${updatedUser.name}" berhasil diperbarui!`);
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan perubahan pengguna');
    } finally {
      setSavingEdit(false);
    }
  };

  // Buka Modal Konfirmasi Hapus
  const handleOpenDeleteModal = (usr: AppUser) => {
    setSelectedUserForDelete(usr);
    setDeleteModalOpen(true);
  };

  // Konfirmasi Eksekusi Hapus
  const handleConfirmDeleteUser = async () => {
    if (!selectedUserForDelete) return;

    // Validasi pengaman: Akun Owner tidak boleh dihapus
    if (selectedUserForDelete.role === 'owner') {
      showToast('Akun Pemilik Utama (Owner) dilindungi dan tidak dapat dihapus');
      return;
    }

    setDeletingUser(true);
    try {
      const res = await fetch(`/api/users/${selectedUserForDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menghapus pengguna');
      }

      // Hapus dari Cloud Firestore
      await deleteUserFromFirestore(selectedUserForDelete.id);

      // Perbarui state lokal
      setUsersList((prev) => prev.filter((u) => u.id !== selectedUserForDelete.id));
      setDeleteModalOpen(false);
      showToast(`Akun staf "${selectedUserForDelete.name}" berhasil dihapus dari sistem`);
      setSelectedUserForDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus pengguna');
    } finally {
      setDeletingUser(false);
    }
  };

  const handleOpenPinModal = (usr: AppUser) => {
    setSelectedStaffForPin(usr);
    setNewPin(usr.pin || '1234');
    setPinModalOpen(true);
  };

  const handleSaveNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffForPin) return;
    if (newPin.length < 4) {
      showToast('PIN harus minimal 4 digit angka');
      return;
    }

    setUpdatingPin(true);
    try {
      const res = await fetch(`/api/users/${selectedStaffForPin.id}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal mengubah PIN');
      }

      const updatedUser: AppUser = {
        ...selectedStaffForPin,
        pin: newPin,
      };

      // Sinkronkan ke Cloud Firestore
      await syncUserToFirestore(updatedUser);

      setUsersList((prev) =>
        prev.map((u) => (u.id === selectedStaffForPin.id ? updatedUser : u))
      );
      setPinModalOpen(false);
      showToast(`PIN ${selectedStaffForPin.name} berhasil diperbarui!`);
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui PIN');
    } finally {
      setUpdatingPin(false);
    }
  };

  const toggleShowPin = (id: number) => {
    setShowPins((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const roleInfo: Record<
    UserRole,
    { label: string; badge: string; color: string; desc: string; defaultPin: string }
  > = {
    owner: {
      label: 'Owner / Pemilik',
      badge: 'bg-purple-100 text-purple-800 border-purple-200',
      color: 'text-purple-600',
      desc: 'Akses penuh ke semua modul, laporan laba bersih, manajemen user, dan HPP modal.',
      defaultPin: '8888',
    },
    manager: {
      label: 'Kepala Toko / Manager',
      badge: 'bg-blue-100 text-blue-800 border-blue-200',
      color: 'text-blue-600',
      desc: 'Akses kulakan stok IMEI, edit produk, beban pengeluaran, ringkasan kas, dan POS.',
      defaultPin: '2222',
    },
    cashier: {
      label: 'Kasir / Frontliner',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      color: 'text-emerald-600',
      desc: 'Transaksi POS kasir, jual pulsa/token, transfer agen BRILink/E-wallet, cetak nota. HPP disembunyikan.',
      defaultPin: '1234',
    },
    technician: {
      label: 'Teknisi Software HP',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      color: 'text-amber-600',
      desc: 'Meja kerja servis software (FRP, Flashing, Unbrick), log modal tool kredit, dan update status servis.',
      defaultPin: '3333',
    },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-1.5 pb-6 sm:pb-8 space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-white text-slate-800 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border border-slate-200 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900 text-lg">
              Manajemen Pengguna & Pembagian Role (RBAC)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Atur hak akses staf toko (Owner, Kepala Toko, Kasir, dan Teknisi) untuk melindungi privasi laba margin HPP dan keamanan operasional terminal POS.
          </p>
        </div>

        {/* Live Simulator Role Switcher */}
        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-100 border border-slate-200 text-xs">
          <span className="text-slate-500 font-medium">Mode Simulasi:</span>
          <select
            value={currentRole}
            onChange={(e) => switchRole(e.target.value as UserRole)}
            className="font-bold text-xs bg-white py-1 px-2.5 rounded-lg border border-slate-300 text-indigo-700 focus:outline-none"
          >
            <option value="owner">👑 Owner (Akses Penuh)</option>
            <option value="manager">👔 Kepala Toko</option>
            <option value="cashier">🛒 Kasir (HPP Tersembunyi)</option>
            <option value="technician">🔧 Teknisi Software</option>
          </select>
        </div>
      </div>

      {/* Role Cards Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(roleInfo) as UserRole[]).map((r) => {
          const info = roleInfo[r];
          const isCurrent = currentRole === r;
          return (
            <div
              key={r}
              className={`p-4 rounded-2xl border transition relative ${
                isCurrent
                  ? 'bg-indigo-50/50 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${info.badge}`}>
                  {info.label}
                </span>
                {isCurrent && (
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                    Aktif
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">{info.desc}</p>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>PIN Standar: {info.defaultPin}</span>
              </div>
              <button
                onClick={() => switchRole(r)}
                className="mt-2 w-full py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                Uji Coba Shift Sebagai Ini
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Tambah Staff Baru (4 cols) */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>Tambah Akun Staff / Karyawan</span>
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nama Lengkap Karyawan
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Rian Anggara"
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Email / Username Login
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rian.kasir@konterpos.id"
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Pilih Role / Jabatan
                </label>
                <select
                  value={role}
                  onChange={(e) => {
                    const nextR = e.target.value as UserRole;
                    setRole(nextR);
                    setPin(roleInfo[nextR].defaultPin);
                  }}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                >
                  <option value="cashier">Kasir / Frontliner</option>
                  <option value="technician">Teknisi Software HP</option>
                  <option value="manager">Kepala Toko / Manager</option>
                  <option value="owner">Owner (Super Admin)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  PIN Buka Shift (4 Digit Angka)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234"
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-mono tracking-widest text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  PIN digunakan staf saat membuka layar kunci terminal kasir.
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700">Catatan Keamanan:</div>
                <div>• Kasir tidak bisa melihat harga modal kulak (HPP).</div>
                <div>• Hanya Owner yang dapat mengakses Laporan Laba Bersih.</div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Simpan Akun Staff</span>
              </button>
            </form>
          </div>
        </div>

        {/* Tabel & Daftar Pengguna (8 cols) */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">
                  Daftar Staf & Hak Akses Aktif ({usersList.length})
                </h3>
              </div>
              <button
                onClick={loadUsers}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="Segarkan daftar"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mobile View: Stacked Card Layout */}
            <div className="md:hidden space-y-3">
              {loading ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Memuat data pengguna...
                </div>
              ) : usersList.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Belum ada staf terdaftar
                </div>
              ) : (
                usersList.map((usr) => (
                  <div
                    key={usr.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {usr.name.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{usr.name}</div>
                          <div className="text-xs text-slate-500 font-medium">{usr.email}</div>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                          roleInfo[usr.role]?.badge || 'bg-slate-100'
                        }`}
                      >
                        {roleInfo[usr.role]?.label || usr.role}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[11px]">PIN Shift:</span>
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
                          {showPins[usr.id] ? usr.pin : '••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleShowPin(usr.id)}
                          className="text-slate-400 hover:text-slate-600 p-1"
                          title={showPins[usr.id] ? 'Sembunyikan PIN' : 'Lihat PIN'}
                        >
                          {showPins[usr.id] ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {usr.role === 'owner' ? (
                        <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 font-medium flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Pemilik
                        </span>
                      ) : null}
                    </div>

                    {/* Tombol Aksi Mobile */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleOpenEditModal(usr)}
                        className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit Data</span>
                      </button>

                      <button
                        onClick={() => handleOpenDeleteModal(usr)}
                        disabled={usr.role === 'owner'}
                        className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          usr.role === 'owner'
                            ? 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                        }`}
                        title={usr.role === 'owner' ? 'Akun Pemilik Utama dilindungi' : 'Hapus Staff'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop View: Clean Table Layout */}
            <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Nama Staff</th>
                    <th className="px-3 py-3">Email / ID</th>
                    <th className="px-3 py-3">Role Akses</th>
                    <th className="px-3 py-3">PIN Shift</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400">
                        Memuat data pengguna...
                      </td>
                    </tr>
                  ) : usersList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400">
                        Belum ada staf terdaftar
                      </td>
                    </tr>
                  ) : (
                    usersList.map((usr) => (
                      <tr key={usr.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{usr.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            UID: {usr.uid.slice(0, 16)}...
                          </div>
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-600">{usr.email}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              roleInfo[usr.role]?.badge || 'bg-slate-100'
                            }`}
                          >
                            {roleInfo[usr.role]?.label || usr.role}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="text-slate-800 font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {showPins[usr.id] ? usr.pin : '••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleShowPin(usr.id)}
                              className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                              title={showPins[usr.id] ? 'Sembunyikan PIN' : 'Lihat PIN'}
                            >
                              {showPins[usr.id] ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenPinModal(usr)}
                              className="text-indigo-600 hover:text-indigo-800 p-0.5 cursor-pointer ml-0.5"
                              title="Ganti Cepat PIN Shift"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Tombol Edit Pengguna */}
                            <button
                              onClick={() => handleOpenEditModal(usr)}
                              title="Edit Data & Ganti PIN"
                              className="p-1.5 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            {/* Tombol Hapus Pengguna */}
                            {usr.role === 'owner' ? (
                              <button
                                disabled
                                title="Akun Pemilik Utama dilindungi dan tidak dapat dihapus"
                                className="p-1.5 rounded-lg text-slate-300 cursor-not-allowed opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenDeleteModal(usr)}
                                title="Hapus Staff"
                                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
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

      {/* Modal Edit Pengguna (Nama, Role, PIN Baru) */}
      {editModalOpen && selectedUserForEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 text-slate-900 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Edit Data & Hak Akses Pengguna
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    ID: #{selectedUserForEdit.id} • {selectedUserForEdit.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-4 mt-4">
              {/* Nama Pengguna */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nama Lengkap Karyawan
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Contoh: Rian Anggara"
                  className="w-full text-xs py-2.5 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Role / Hak Akses */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Role / Tingkat Akses
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full text-xs py-2.5 px-3 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="owner">👑 Owner / Pemilik (Akses Penuh)</option>
                  <option value="manager">👔 Kepala Toko / Manager</option>
                  <option value="cashier">🛒 Kasir / Frontliner</option>
                  <option value="technician">🔧 Teknisi Software HP</option>
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {roleInfo[editRole]?.desc}
                </span>
              </div>

              {/* Ganti PIN Baru */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    PIN Baru Shift Kasir
                  </label>
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Opsional
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showEditPin ? 'text' : 'password'}
                    maxLength={6}
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Kosongkan jika tetap PIN lama"
                    className="w-full text-xs py-2.5 pl-3 pr-10 rounded-xl border border-slate-200 font-mono tracking-wider focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPin(!showEditPin)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title={showEditPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                  >
                    {showEditPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                  💡 <em>Kosongkan jika tidak ingin mengubah PIN saat ini.</em> Jika diisi, minimal 4 digit angka.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end items-center gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan Perubahan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Pengguna */}
      {deleteModalOpen && selectedUserForDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-200 text-slate-900 animate-in zoom-in-95 duration-200">
            {selectedUserForDelete.role === 'owner' ? (
              // Tampilan Akun Owner Terlindungi
              <div className="text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 border border-purple-200 text-purple-700 mx-auto flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Akun Pemilik Utama Dilindungi
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Akun <strong>{selectedUserForDelete.name}</strong> memiliki hak akses sebagai <strong>Owner</strong>. Demi keamanan dan integritas sistem kasir, akun Owner tidak dapat dihapus.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setDeleteModalOpen(false)}
                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            ) : (
              // Tampilan Konfirmasi Hapus Staf Reguler
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      Hapus Akun Pengguna?
                    </h3>
                    <p className="text-xs text-slate-500">
                      Konfirmasi penghapusan akses staf toko
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nama:</span>
                    <span className="font-semibold text-slate-800">{selectedUserForDelete.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email:</span>
                    <span className="font-medium text-slate-700">{selectedUserForDelete.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Role:</span>
                    <span className="font-semibold text-indigo-700 capitalize">
                      {roleInfo[selectedUserForDelete.role]?.label || selectedUserForDelete.role}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-rose-600 leading-relaxed">
                  ⚠️ Tindakan ini permanen. Akun staf ini tidak akan dapat login atau membuka shift di terminal kasir lagi.
                </p>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setDeleteModalOpen(false)}
                    disabled={deletingUser}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteUser}
                    disabled={deletingUser}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 cursor-pointer shadow-sm transition disabled:opacity-50"
                  >
                    {deletingUser ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Menghapus...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Pengguna</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Ubah PIN Cepat */}
      {pinModalOpen && selectedStaffForPin && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 border border-slate-200 text-slate-900 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-800">
                  Ubah PIN Shift Staf
                </h3>
              </div>
              <button
                onClick={() => setPinModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 my-3">
              Ubah 4 digit PIN kasir untuk <strong>{selectedStaffForPin.name}</strong>.
            </p>

            <form onSubmit={handleSaveNewPin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  PIN Baru (4-6 Digit Angka)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Contoh: 1234"
                  className="w-full text-center text-lg font-mono font-bold tracking-widest py-2 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPinModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={updatingPin}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer disabled:opacity-50"
                >
                  {updatingPin ? 'Menyimpan...' : 'Simpan PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
