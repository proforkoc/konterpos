import React, { useState, useEffect } from 'react';
import { Receipt, Plus, Trash2, Calendar, DollarSign, Tag } from 'lucide-react';
import { StoreExpense } from '../types/index.ts';

export const ExpensesModule: React.FC = () => {
  const [expenses, setExpenses] = useState<StoreExpense[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [category, setCategory] = useState('listrik_air');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [paidBy, setPaidBy] = useState('cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const formatRupiah = (val: number) => 'Rp ' + Number(val || 0).toLocaleString('id-ID');

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/expenses');
      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || amount <= 0) {
      alert('Keterangan pengeluaran dan jumlah biaya wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title: title.trim(),
          amount,
          expenseDate,
          paidBy,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan pengeluaran');
      }

      setTitle('');
      setAmount(0);
      setNotes('');
      loadExpenses();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus pencatatan pengeluaran ini?')) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setExpenses((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete expense:', err);
    }
  };

  const totalExpenses = expenses.reduce((acc, cur) => acc + cur.amount, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-1.5 pb-6 sm:pb-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900 text-lg">Pencatatan Rekap Beban & Pengeluaran Toko</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Mencatat pengeluaran sewa ruko, token listrik, tagihan internet, ATK kertas thermal, kredit server tool, dan konsumsi.
          </p>
        </div>

        <div className="px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-right">
          <div className="text-[10px] text-rose-600 font-medium">Total Beban Operasional</div>
          <div className="font-bold text-rose-800 text-sm">-{formatRupiah(totalExpenses)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Form (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100">
              Input Pengeluaran Kas Toko
            </h3>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Kategori Pengeluaran
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white font-semibold"
                >
                  <option value="listrik_air">Listrik & Air Toko</option>
                  <option value="koneksi_internet">Internet WiFi & Pulsa Operasional</option>
                  <option value="atk_nota_kertas">ATK, Kertas Roll Kasir Thermal</option>
                  <option value="kredit_tool_server">Kredit Server Software Tool (UnlockTool, dll.)</option>
                  <option value="sewa_tempat">Sewa Ruko / Tempat Usaha</option>
                  <option value="gaji_karyawan">Gaji Karyawan / Komisi</option>
                  <option value="operasional_harian">Konsumsi & Operasional Harian</option>
                  <option value="lainnya">Pengeluaran Lainnya</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Keterangan / Judul Pengeluaran
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Beli kertas thermal 58mm 10 roll..."
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Nominal Biaya (Rp)
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    required
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value) || 0)}
                    placeholder="150000"
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-bold text-rose-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Tanggal Pengeluaran
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Sumber Dana Pembayaran
                </label>
                <select
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="cash">Kas Tunai Toko (Laci Kasir)</option>
                  <option value="transfer">Rekening Bank Operasional</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Nomor nota toko, supplier..."
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Simpan Pengeluaran</span>
              </button>
            </form>
          </div>
        </div>

        {/* Expenses List Table (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Riwayat Rekap Kas Keluar</h3>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table
                className="w-full text-left text-xs table-fixed"
                style={{ tableLayout: 'fixed', width: '100%' }}
              >
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th style={{ width: '16%' }} className="px-2.5 py-2.5">Tanggal</th>
                    <th style={{ width: '18%' }} className="px-2 py-2.5">Kategori</th>
                    <th style={{ width: '30%' }} className="px-2 py-2.5">Keterangan</th>
                    <th style={{ width: '14%' }} className="px-2 py-2.5">Sumber Dana</th>
                    <th style={{ width: '14%' }} className="px-2 py-2.5">Jumlah Biaya</th>
                    <th style={{ width: '8%' }} className="px-2.5 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        Memuat data pengeluaran...
                      </td>
                    </tr>
                  ) : expenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        Belum ada catatan pengeluaran
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-2.5 py-2 font-medium text-slate-700 truncate">{exp.expenseDate}</td>
                        <td className="px-2 py-2 overflow-hidden">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-semibold uppercase text-slate-700 truncate inline-block max-w-full">
                            {exp.category.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-2 py-2 overflow-hidden">
                          <div className="font-semibold text-slate-900 truncate" title={exp.title}>{exp.title}</div>
                          {exp.notes && (
                            <div className="text-[10px] text-slate-400 truncate" title={exp.notes}>{exp.notes}</div>
                          )}
                        </td>
                        <td className="px-2 py-2 uppercase text-[11px] text-slate-500 truncate">
                          {exp.paidBy}
                        </td>
                        <td className="px-2 py-2 font-bold text-rose-600 whitespace-nowrap">
                          -{formatRupiah(exp.amount)}
                        </td>
                        <td className="px-2.5 py-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleDelete(exp.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
    </div>
  );
};
