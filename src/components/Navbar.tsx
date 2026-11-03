import React, { useState, useRef, useEffect } from 'react';
import {
  Smartphone,
  ShoppingCart,
  Headphones,
  CreditCard,
  Wrench,
  BarChart3,
  History,
  Receipt,
  LogOut,
  User,
  Users,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { UserRole } from '../types/index.ts';

export type ActiveTab =
  | 'pos'
  | 'digital_finance'
  | 'service_software'
  | 'sales_history'
  | 'phones'
  | 'accessories'
  | 'analytics'
  | 'expenses'
  | 'users';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  cartCount: number;
  accessoriesCount?: number;
  lowStockCount?: number;
  activeServiceCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  accessoriesCount = 0,
  lowStockCount = 0,
  activeServiceCount = 0,
}) => {
  const {
    operatorName,
    currentRole,
    activeStaff,
    lockTerminal,
  } = useAuth();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setProfileDropdownOpen(false);
      }
    };
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [profileDropdownOpen]);

  // Fixed Body Scroll Lock: Metode ampuh mengunci scroll latar belakang dengan position fixed & restore window.scrollY
  useEffect(() => {
    if (mobileDrawerOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        const savedTop = document.body.style.top;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        if (savedTop) {
          window.scrollTo(0, parseInt(savedTop, 10) * -1);
        }
      };
    }
  }, [mobileDrawerOpen]);

  const getCleanRoleName = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return 'Owner';
      case 'manager':
        return 'Kepala Toko';
      case 'cashier':
        return 'Kasir';
      case 'technician':
        return 'Teknisi';
      default:
        return role;
    }
  };

  // Format Nama Pengguna: [Nama User] ([Role]), contoh: Budi (Kasir)
  const rawName = activeStaff?.name || operatorName || 'Kasir';
  const cleanName = rawName.replace(/\s*\(.*?\)\s*/g, '').trim() || 'Kasir';
  const roleName = getCleanRoleName(currentRole);
  const userHeaderDisplay = `${cleanName} (${roleName})`;

  // Urutan Tab Sesuai Spesifikasi:
  // 1. Kasir POS | 2. Agen Digital | 3. Service Software | 4. Riwayat Struk | 5. Menu tambahan lainnya
  const allNavItems = [
    {
      id: 'pos' as ActiveTab,
      label: 'Kasir POS',
      category: 'transaksi',
      icon: ShoppingCart,
      visible: currentRole === 'owner' || currentRole === 'cashier' || currentRole === 'manager',
      badge: cartCount > 0 ? cartCount : undefined,
      description: 'Penjualan retail, scan barcode & checkout',
    },
    {
      id: 'digital_finance' as ActiveTab,
      label: 'Agen Digital',
      category: 'transaksi',
      icon: CreditCard,
      visible: currentRole === 'owner' || currentRole === 'cashier' || currentRole === 'manager',
      description: 'Transfer bank, top-up saldo & token PLN',
    },
    {
      id: 'service_software' as ActiveTab,
      label: 'Service Software',
      category: 'transaksi',
      icon: Wrench,
      visible: currentRole === 'owner' || currentRole === 'cashier' || currentRole === 'manager' || currentRole === 'technician',
      badge: activeServiceCount > 0 ? activeServiceCount : undefined,
      description: 'Pesanan flash HP, unlock FRP & nota servis',
    },
    {
      id: 'sales_history' as ActiveTab,
      label: 'Riwayat Struk',
      category: 'transaksi',
      icon: History,
      visible: currentRole === 'owner' || currentRole === 'cashier' || currentRole === 'manager' || currentRole === 'technician',
      description: 'Arsip terpadu faktur POS, BRIlink & nota servis',
    },
    // Menu tambahan lainnya (Hanya untuk Owner / Manajemen, disembunyikan dari Kasir)
    {
      id: 'phones' as ActiveTab,
      label: 'HP & IMEI',
      category: 'manajemen',
      icon: Smartphone,
      visible: currentRole === 'owner' || currentRole === 'manager',
      description: 'Stok unit smartphone & pelacakan IMEI',
    },
    {
      id: 'accessories' as ActiveTab,
      label: 'Stok Aksesoris',
      category: 'manajemen',
      icon: Headphones,
      visible: currentRole === 'owner' || currentRole === 'manager',
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      description: 'Katalog aksesoris & inventaris produk',
    },
    {
      id: 'analytics' as ActiveTab,
      label: 'Laporan Keuangan',
      category: 'manajemen',
      icon: BarChart3,
      visible: currentRole === 'owner' || currentRole === 'manager',
      description: 'Analitik omset & margin laba rugi (P&L)',
    },
    {
      id: 'expenses' as ActiveTab,
      label: 'Beban Toko',
      category: 'manajemen',
      icon: Receipt,
      visible: currentRole === 'owner' || currentRole === 'manager',
      description: 'Biaya operasional toko & kredit tools',
    },
    {
      id: 'users' as ActiveTab,
      label: 'Kelola Pengguna',
      category: 'manajemen',
      icon: Users,
      visible: currentRole === 'owner',
      description: 'Manajemen akun staf & hak akses role',
    },
  ];

  const visibleNavItems = allNavItems.filter((item) => item.visible);
  const currentActiveItem = visibleNavItems.find((item) => item.id === activeTab) || visibleNavItems[0];
  const CurrentIcon = currentActiveItem?.icon || ShoppingCart;

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileDrawerOpen(false);
  };

  return (
    <>
      <header
        className="sticky-header-navbar w-full max-w-full text-slate-800 border-b border-slate-200/90"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
      >
        {/* Top Header Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-2 bg-white">
          {/* Left: Hamburger Button (Compact Icon-Only) + Brand */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Tombol Hamburger Menu (Hanya Ikon Garis Tiga, Tanpa Teks) */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-slate-100 active:bg-slate-200/80 border border-slate-200/90 shadow-2xs transition-colors cursor-pointer shrink-0"
              aria-label="Buka Menu Navigasi"
              title="Buka Menu Navigasi"
            >
              <Menu className="w-5 h-5 text-indigo-600" />
            </button>

            {/* Logo & Judul Toko */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-sm shadow-indigo-500/20 text-white shrink-0">
                <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>

              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900">KonterPOS</span>
                  <span className="text-[9px] sm:text-[10px] font-bold tracking-wider uppercase px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hidden sm:inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live POS
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium hidden md:block">
                  Sistem POS & Manajemen Toko Handphone Terintegrasi
                </p>
              </div>
            </div>

            {/* Indikator Halaman Aktif di HP/Tab (Ketuk untuk Buka Drawer Menu) */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50/90 hover:bg-indigo-100 border border-indigo-200/80 text-indigo-700 text-xs font-bold max-w-[130px] xs:max-w-[180px] sm:max-w-none truncate cursor-pointer transition-colors active:bg-indigo-200/80"
              title="Ketuk untuk ganti menu"
            >
              <CurrentIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{currentActiveItem?.label}</span>
              <ChevronRight className="w-3 h-3 text-indigo-400 shrink-0" />
            </button>
          </div>

          {/* Right side: Responsive User Profile Dropdown (inline-block container, right: 0, mt-[6px], match parent width on desktop, min-w 120px on mobile) */}
          <div
            className="relative inline-block shrink-0"
            ref={profileDropdownRef}
            style={{ position: 'relative', display: 'inline-block' }}
          >
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center justify-center sm:justify-between gap-1.5 sm:gap-2 w-9 h-9 sm:w-auto sm:min-w-[150px] sm:max-w-[200px] p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200/80 border border-slate-200/90 shadow-2xs transition-all cursor-pointer select-none text-left shrink-0"
              aria-expanded={profileDropdownOpen}
              aria-haspopup="true"
              aria-label="Menu Profil Pengguna"
            >
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 hidden sm:block">
                  <span className="text-xs font-bold text-slate-800 block truncate">{userHeaderDisplay}</span>
                </div>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 hidden sm:block ${
                  profileDropdownOpen ? 'rotate-180 text-indigo-600' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu Profil - match parent width on desktop, responsive max-content on mobile, margin-top: 6px */}
            {profileDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  boxSizing: 'border-box',
                }}
                className="absolute top-full right-0 mt-[6px] w-max min-w-[120px] max-w-[calc(100vw-16px)] sm:w-full sm:min-w-full sm:max-w-full bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden box-border animate-in fade-in-50 zoom-in-95 duration-100"
              >
                {/* Header Info Pengguna Ringkas */}
                <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-100">
                  <div className="text-[11px] font-bold text-slate-900 truncate">
                    {cleanName}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium truncate">
                    {roleName}
                  </div>
                </div>

                {/* Tombol Aksi Keluar */}
                <div className="p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      lockTerminal();
                    }}
                    className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 active:bg-rose-100 transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="truncate">Keluar</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs Bar - Khusus Desktop (Hidden on Mobile & Tablet <= 1024px, Centered on Desktop >= 1025px) */}
        <nav
          className="desktop-navbar-tabs hidden lg:flex w-full bg-white border-t border-slate-200/80 justify-center items-center py-2 px-3 sm:px-4 lg:px-6 overflow-x-auto no-scrollbar"
          style={{ backgroundColor: '#ffffff', overflowX: 'auto', flexWrap: 'nowrap' }}
          aria-label="Navigasi Menu Utama KonterPOS (Desktop)"
        >
          <div className="flex items-center justify-start xl:justify-center gap-1.5 xl:gap-2.5 flex-nowrap min-w-max mx-auto py-0.5">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const hasBadge = item.badge !== undefined && item.badge > 0;
              const badgeText = item.badge! > 99 ? '99+' : `${item.badge}`;
              const isMultiDigit = badgeText.length > 1;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`relative flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-xl text-[11px] xl:text-xs font-bold whitespace-nowrap transition-colors duration-150 cursor-pointer border shrink-0 select-none ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs shadow-indigo-600/25 active:bg-indigo-700'
                      : 'bg-white/80 text-slate-700 border-slate-200/90 hover:text-indigo-600 hover:bg-slate-50 hover:border-slate-300 hover:shadow-2xs active:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span className="whitespace-nowrap">{item.label}</span>
                  {hasBadge && (
                    <span
                      className={`absolute -top-1 -right-1 h-5 min-w-5 px-1 inline-flex items-center justify-center shrink-0 rounded-full font-semibold leading-none bg-white border border-indigo-500 text-indigo-600 shadow-2xs pointer-events-none select-none transition-transform ${
                        isMultiDigit ? 'text-[9px] tracking-tighter' : 'text-[10px]'
                      }`}
                    >
                      {badgeText}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Menu Drawer / Slide-Over Vertikal untuk HP & Tablet (< 1024px) */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex overscroll-none select-none">
          {/* Backdrop Blur Overlay dengan proteksi event propagation, wheel & touchmove */}
          <div
            className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 cursor-pointer touch-none"
            onClick={(e) => {
              e.stopPropagation();
              setMobileDrawerOpen(false);
            }}
            onWheel={(e) => {
              e.stopPropagation();
            }}
            onTouchMove={(e) => {
              e.stopPropagation();
            }}
            aria-label="Tutup Menu"
          />

          {/* Drawer Panel Vertikal dari samping kiri (Full Viewport Fit Tanpa Scroll) */}
          <div
            data-drawer-panel="true"
            className="relative w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200 border-r border-slate-200"
            style={{ height: '100vh', maxHeight: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            {/* Drawer Header */}
            <div className="py-2.5 px-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/70 via-slate-50 to-white shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xs">
                  <Smartphone className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xs text-slate-900 leading-tight">Navigasi KonterPOS</h3>
                  <p className="text-[9px] text-slate-500 font-medium leading-tight">Sistem Kasir Terpadu</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Tutup Menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Daftar Menu Vertikal Lengkap & Terkategori Rapi (Compact Sizing Fit Viewport) */}
            <div className="flex-1 py-2 px-2.5 flex flex-col justify-start space-y-2 overflow-hidden">
              {/* 1. Menu Utama Transaksi & Kasir */}
              <div>
                <div className="px-1.5 pb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Menu Transaksi & Kasir
                </div>
                <div className="space-y-1">
                  {visibleNavItems
                    .filter((item) => item.category === 'transaksi')
                    .map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectTab(item.id)}
                          className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-xl text-left transition-colors cursor-pointer border ${
                            isActive
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs shadow-indigo-600/20 active:bg-indigo-700'
                              : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isActive
                                  ? 'bg-white/20 text-white'
                                  : 'bg-indigo-50 text-indigo-600'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <div className={`font-bold text-xs truncate leading-tight ${isActive ? 'text-white' : 'text-slate-800'}`}>
                                {item.label}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 ml-1.5">
                            {item.badge !== undefined && item.badge > 0 && (
                              <span
                                className={`h-5 min-w-5 px-1 inline-flex items-center justify-center shrink-0 rounded-full font-semibold leading-none bg-white border border-indigo-500 text-indigo-600 shadow-2xs ${
                                  item.badge > 9 ? 'text-[9px] tracking-tighter' : 'text-[10px]'
                                }`}
                              >
                                {item.badge > 99 ? '99+' : item.badge}
                              </span>
                            )}
                            <ChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`} />
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* 2. Menu Manajemen & Toko (Hanya untuk Owner / Manager) */}
              {visibleNavItems.some((item) => item.category === 'manajemen') && (
                <div>
                  <div className="px-1.5 pt-1 pb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Menu Manajemen & Toko
                  </div>
                  <div className="space-y-1">
                    {visibleNavItems
                      .filter((item) => item.category === 'manajemen')
                      .map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelectTab(item.id)}
                            className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-xl text-left transition-colors cursor-pointer border ${
                              isActive
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs shadow-indigo-600/20 active:bg-indigo-700'
                                : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border-slate-100 hover:border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  isActive
                                    ? 'bg-white/20 text-white'
                                    : 'bg-indigo-50 text-indigo-600'
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <div className={`font-bold text-xs truncate leading-tight ${isActive ? 'text-white' : 'text-slate-800'}`}>
                                  {item.label}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 ml-1.5">
                              {item.badge !== undefined && item.badge > 0 && (
                                <span
                                  className={`h-5 min-w-5 px-1 inline-flex items-center justify-center shrink-0 rounded-full font-semibold leading-none bg-white border border-indigo-500 text-indigo-600 shadow-2xs ${
                                    item.badge > 9 ? 'text-[9px] tracking-tighter' : 'text-[10px]'
                                  }`}
                                >
                                  {item.badge > 99 ? '99+' : item.badge}
                                </span>
                              )}
                              <ChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`} />
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Bottom Status Footer */}
            <div className="py-2 px-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-center gap-1.5 text-[9px] text-slate-400 font-medium shrink-0">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span>Sistem Kasir Konter &bull; PostgreSQL Active</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
