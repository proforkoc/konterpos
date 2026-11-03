import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Lock,
  User,
  KeyRound,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Store,
  Layers,
  CreditCard,
  Wrench,
  ShieldCheck,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { AppUser } from '../types/index.ts';
import { authenticateWithFirestore } from '../services/cloudUserService.ts';

interface LockScreenProps {
  onUnlockSuccess: (user: AppUser) => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlockSuccess }) => {
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [verifying, setVerifying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMsg('Masukkan username atau email');
      return;
    }
    if (!password.trim()) {
      setErrorMsg('Masukkan password atau PIN');
      return;
    }

    setVerifying(true);
    setErrorMsg('');

    try {
      // 1. Coba request login ke backend PostgreSQL API
      let res: Response | null = null;
      let primaryNetworkError: any = null;

      try {
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: identifier.trim(),
            password: password.trim(),
          }),
        });
      } catch (err: any) {
        primaryNetworkError = err;
      }

      // Jika backend merespon HTTP
      if (res) {
        const text = await res.text();
        let result: any = null;
        try {
          result = JSON.parse(text);
        } catch {
          // Respons bukan JSON (misal HTML 502/504 dari reverse proxy server hosting)
          throw new Error(`Server hosting merespons format tidak valid (${res.status}): ${res.statusText}`);
        }

        // Login sukses via backend
        if (res.ok && result?.success && result?.user) {
          onUnlockSuccess(result.user);
          return;
        }

        // Kredensial tidak valid (status 400 atau 401)
        if (res.status === 400 || res.status === 401) {
          setErrorMsg(result?.error || 'Username atau Password salah. Silakan coba lagi.');
          return;
        }

        // Jika respons 500+, lemparkan error agar fallback ke Firestore dicoba
        if (!res.ok) {
          throw new Error(result?.error || `Server API error (${res.status})`);
        }
      } else if (primaryNetworkError) {
        throw primaryNetworkError;
      }
    } catch (primaryErr: any) {
      console.warn('Backend login gagal, beralih ke Cloud Firestore fallback:', primaryErr);

      // 2. Fallback Arsitektur Hybrid: Autentikasi langsung via Cloud Firestore
      try {
        const fsResult = await authenticateWithFirestore(identifier, password);
        if (fsResult.success && fsResult.user) {
          onUnlockSuccess(fsResult.user);
          return;
        } else if (fsResult.message) {
          setErrorMsg(fsResult.message);
          return;
        }
      } catch (fsErr: any) {
        console.warn('Cloud Firestore fallback juga gagal:', fsErr);

        // 3. Deteksi & Diagnosis Error Spesifik
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setErrorMsg('Perangkat Anda sedang offline. Mohon periksa koneksi internet.');
          return;
        }

        const fsCode = fsErr?.code || '';
        const fsMsg = fsErr?.message || '';

        if (fsCode === 'permission-denied') {
          setErrorMsg('Akses Cloud Firestore ditolak (Permission Denied). Periksa konfigurasi firestore.rules.');
          return;
        }

        if (fsCode === 'unavailable' || fsMsg.includes('offline') || fsMsg.includes('unavailable')) {
          setErrorMsg('Koneksi Cloud Firestore tidak tersedia / offline.');
          return;
        }

        if (
          primaryErr?.message?.includes('Failed to fetch') ||
          primaryErr?.name === 'TypeError' ||
          primaryErr?.message?.includes('NetworkError')
        ) {
          setErrorMsg('Kendala Jaringan / CORS: Gagal menghubungi server backend API hosting.');
          return;
        }

        setErrorMsg(primaryErr?.message || 'Gagal memverifikasi login dengan server. Cek koneksi Anda.');
        return;
      }

      setErrorMsg('Gagal memverifikasi login dengan server. Cek koneksi Anda.');
    } finally {
      setVerifying(false);
    }
  };

  const handleQuickFill = (demoId: string, demoPass: string) => {
    setIdentifier(demoId);
    setPassword(demoPass);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen md:h-screen md:max-h-screen w-full overflow-y-auto md:overflow-hidden flex flex-col md:flex-row bg-[#f8fafc] text-slate-900 select-none">
      {/* SISI KIRI: BRANDING & DESKRIPSI
          - Desktop (>= 1024px, lg): 7/12 (~58%) split screen fit 100vh tanpa scrollbar
          - Tablet (768px - 1023px, md): 5/12 (~41%) proporsi kompak dengan font & padding disesuaikan agar fit 100vh tanpa scrollbar
          - Mobile (< 768px): Sembunyi (hidden), digantikan header ringkas di sisi kanan */}
      <div className="hidden md:flex w-full md:w-5/12 lg:w-7/12 h-full bg-gradient-to-br from-indigo-50/80 via-slate-50 to-sky-50/50 p-4 md:p-6 lg:p-10 xl:p-12 flex-col justify-between border-r border-slate-200/90 relative overflow-hidden">
        {/* Soft subtle ambient background lightings */}
        <div className="absolute -top-24 -left-24 w-88 h-88 bg-indigo-200/35 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-88 h-88 bg-sky-200/30 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header / Store Brand & Live Clock */}
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 lg:gap-3.5">
              <div className="w-9 h-9 lg:w-11 lg:h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25 border border-indigo-400/30 shrink-0">
                <Smartphone className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 lg:gap-2">
                  <h1 className="text-lg lg:text-xl font-black tracking-tight text-slate-900">
                    KonterPOS
                  </h1>
                  <span className="text-[9px] lg:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100/80 text-indigo-700 border border-indigo-200/70 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                    POS
                  </span>
                </div>
                <p className="text-[11px] lg:text-xs text-slate-600 font-medium line-clamp-1">
                  Sistem Kasir & Toko HP Terintegrasi
                </p>
              </div>
            </div>

            {/* Realtime Digital Clock */}
            <div className="text-right shrink-0">
              <div className="font-mono text-xs lg:text-sm font-bold text-slate-800 tracking-wider bg-white/90 px-2.5 lg:px-3 py-1 rounded-xl border border-slate-200 shadow-xs inline-block">
                {currentTime.toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </div>
              <div className="text-[10px] lg:text-[11px] text-slate-500 mt-0.5 font-medium hidden lg:block">
                {currentTime.toLocaleDateString('id-ID', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>

          {/* Description & Value Proposition */}
          <div className="mt-4 lg:mt-7 max-w-xl">
            <h2 className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-slate-900 leading-snug tracking-tight">
              Aplikasi Kasir Modern, Cepat & Handal untuk Konter Anda
            </h2>
            <p className="mt-1.5 lg:mt-2 text-xs lg:text-sm text-slate-600 leading-relaxed font-normal line-clamp-2 lg:line-clamp-none">
              Kelola kasir retail, pelacakan nomor IMEI smartphone, transfer BRILink & PPOB,
              nota perbaikan software HP, serta pembukuan laba rugi otomatis.
            </p>
          </div>
        </div>

        {/* Middle: Feature Highlights (Majoo Style 4 Pillar Cards - Responsive Grid for Tablet/Desktop) */}
        <div className="grid grid-cols-2 gap-2.5 lg:gap-3.5 my-2.5 lg:my-4 relative z-10">
          <div className="p-2.5 lg:p-3.5 rounded-2xl bg-white/90 border border-slate-200/90 shadow-xs hover:border-indigo-300 hover:shadow-md transition-colors duration-200 group">
            <div className="flex items-center gap-1.5 lg:gap-2 mb-1">
              <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-xl bg-indigo-100/80 text-indigo-600 flex items-center justify-center shrink-0">
                <Store className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              </div>
              <h3 className="font-bold text-[11px] lg:text-xs text-slate-800">
                Kasir POS Cepat
              </h3>
            </div>
            <p className="text-[10px] lg:text-[11px] text-slate-500 leading-normal line-clamp-2">
              Struk thermal 58/80mm, multi pembayaran Tunai & QRIS.
            </p>
          </div>

          <div className="p-2.5 lg:p-3.5 rounded-2xl bg-white/90 border border-slate-200/90 shadow-xs hover:border-violet-300 hover:shadow-md transition-colors duration-200 group">
            <div className="flex items-center gap-1.5 lg:gap-2 mb-1">
              <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-xl bg-violet-100/80 text-violet-600 flex items-center justify-center shrink-0">
                <Layers className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              </div>
              <h3 className="font-bold text-[11px] lg:text-xs text-slate-800">
                Pelacakan IMEI
              </h3>
            </div>
            <p className="text-[10px] lg:text-[11px] text-slate-500 leading-normal line-clamp-2">
              Audit nomor IMEI 1 & 2 unit smartphone saat checkout.
            </p>
          </div>

          <div className="p-2.5 lg:p-3.5 rounded-2xl bg-white/90 border border-slate-200/90 shadow-xs hover:border-emerald-300 hover:shadow-md transition-colors duration-200 group">
            <div className="flex items-center gap-1.5 lg:gap-2 mb-1">
              <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center shrink-0">
                <CreditCard className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              </div>
              <h3 className="font-bold text-[11px] lg:text-xs text-slate-800">
                BRILink & E-Wallet
              </h3>
            </div>
            <p className="text-[10px] lg:text-[11px] text-slate-500 leading-normal line-clamp-2">
              PPOB, top-up e-wallet & transfer dengan margin otomatis.
            </p>
          </div>

          <div className="p-2.5 lg:p-3.5 rounded-2xl bg-white/90 border border-slate-200/90 shadow-xs hover:border-amber-300 hover:shadow-md transition-colors duration-200 group">
            <div className="flex items-center gap-1.5 lg:gap-2 mb-1">
              <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-xl bg-amber-100/80 text-amber-600 flex items-center justify-center shrink-0">
                <Wrench className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              </div>
              <h3 className="font-bold text-[11px] lg:text-xs text-slate-800">
                Servis Software
              </h3>
            </div>
            <p className="text-[10px] lg:text-[11px] text-slate-500 leading-normal line-clamp-2">
              Nota flash HP, unlock FRP, bootloop nota servis perbaikan.
            </p>
          </div>
        </div>

        {/* Bottom Banner Status */}
        <div className="pt-2 lg:pt-3 border-t border-slate-200/90 flex items-center justify-between text-[10px] lg:text-[11px] text-slate-500 relative z-10 font-medium">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-emerald-600 shrink-0" />
            <span className="truncate">PostgreSQL Active &bull; Role-Based Access</span>
          </div>
          <span className="font-mono text-slate-400 text-[9px] lg:text-[10px] bg-slate-200/60 px-1.5 lg:px-2 py-0.5 rounded shrink-0">v2.4 Pro</span>
        </div>
      </div>

      {/* SISI KANAN: FORM LOGIN STANDAR & RESPONSIF
          - Desktop (>= 1024px): 5/12
          - Tablet (768px - 1023px): 7/12 (proporsi lebih lapang untuk sentuhan)
          - Mobile (< 768px): 100% full width terpusat vertikal tanpa scroll berlebih */}
      <div className="w-full md:w-7/12 lg:w-5/12 min-h-screen md:min-h-0 md:h-full bg-white flex flex-col justify-between md:justify-center items-center p-4 sm:p-6 md:p-8 lg:p-12 relative overflow-y-auto md:overflow-hidden">
        {/* Soft background ambient light */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 lg:w-96 h-80 lg:h-96 bg-indigo-50/50 rounded-full blur-3xl pointer-events-none" />

        {/* Mobile-only compact brand header (Smartphone only < 768px) */}
        <div className="md:hidden w-full max-w-sm pt-2 pb-3 mb-2 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-xs">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base text-slate-900">KonterPOS</span>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700">POS</span>
              </div>
              <p className="text-[10px] text-slate-500">Sistem Kasir Toko Handphone</p>
            </div>
          </div>
          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Centered Form Wrapper */}
        <div className="w-full max-w-sm sm:max-w-md my-auto relative z-10 py-2 sm:py-4">
          {/* Form Header */}
          <div className="mb-4 sm:mb-6">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full mb-2 sm:mb-3">
              <Lock className="w-3.5 h-3.5" />
              <span>Otorisasi Pengguna Kasir</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              Masuk ke Sistem
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 sm:mt-1.5 leading-relaxed font-normal">
              Silakan masukkan username/email dan kata sandi Anda.
            </p>
          </div>

          {/* Standard Login Form with touch-friendly inputs (min 44px) */}
          <form onSubmit={handleLoginSubmit} className="space-y-3.5 sm:space-y-4">
            {/* Input 1: Username / Email */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Username / Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="Contoh: kasir, owner, atau hendra"
                  autoFocus
                  required
                  className="w-full pl-10 pr-4 h-11 sm:h-12 rounded-xl bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 text-sm font-medium transition duration-150"
                />
              </div>
            </div>

            {/* Input 2: Password / PIN */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Password / PIN
                </label>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="Masukkan password atau PIN..."
                  required
                  className="w-full pl-10 pr-12 h-11 sm:h-12 rounded-xl bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 text-sm font-medium tracking-wider transition duration-150"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}

            {/* Tombol Masuk Utama (Touch friendly min 46px) */}
            <button
              type="submit"
              disabled={verifying || !identifier.trim() || !password.trim()}
              className="w-full min-h-[46px] py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:shadow-indigo-500/20 transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed mt-2"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <span>Masuk</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Helper */}
          <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-100">
            <div className="text-[11px] text-slate-500 mb-2 flex items-center justify-between font-medium">
              <span>Bantuan Akun Demo:</span>
              <span className="text-slate-400">Klik isi otomatis</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickFill('kasir', '1234')}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50/60 active:bg-indigo-100/70 border border-slate-200 hover:border-indigo-300 text-left transition-colors duration-150 cursor-pointer flex flex-col justify-center group"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-slate-800 group-hover:text-indigo-700 text-xs">Kasir</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-1 py-0.2 rounded font-mono font-bold">1234</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 truncate">Siti (Kasir)</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('owner', '8888')}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50/60 active:bg-indigo-100/70 border border-slate-200 hover:border-indigo-300 text-left transition-colors duration-150 cursor-pointer flex flex-col justify-center group"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-slate-800 group-hover:text-indigo-700 text-xs">Owner</span>
                  <span className="text-[10px] text-purple-700 bg-purple-100/70 border border-purple-200 px-1 py-0.2 rounded font-mono font-bold">8888</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 truncate">Hendra (Owner)</span>
              </button>
            </div>
          </div>

          {/* Security note */}
          <div className="mt-4 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sesi kasir terlindungi & terenkripsi</span>
          </div>
        </div>

        {/* Mobile footer padding guard */}
        <div className="md:hidden py-1" />
      </div>
    </div>
  );
};
