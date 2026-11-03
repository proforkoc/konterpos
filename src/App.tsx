import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar, ActiveTab } from './components/Navbar.tsx';
import { LockScreen } from './components/LockScreen.tsx';
import { POSModule } from './components/POSModule.tsx';
import { PhoneImeiModule } from './components/PhoneImeiModule.tsx';
import { AccessoriesModule } from './components/AccessoriesModule.tsx';
import { DigitalFinanceModule } from './components/DigitalFinanceModule.tsx';
import { SoftwareServiceModule } from './components/SoftwareServiceModule.tsx';
import { AnalyticsModule } from './components/AnalyticsModule.tsx';
import { SalesHistoryModule } from './components/SalesHistoryModule.tsx';
import { ExpensesModule } from './components/ExpensesModule.tsx';
import { UserManagementModule } from './components/UserManagementModule.tsx';
import { ThermalReceipt, ReceiptType } from './components/ThermalReceipt.tsx';
import { CartItem, Sale, DigitalTransaction, ServiceSoftwareOrder, AppUser } from './types/index.ts';
import { onTransactionDeleted, onDataUpdated, getStoredServiceOrders } from './utils/transactionSync.ts';
import { subscribeAccessories, ensureCloudInventorySeeded } from './services/cloudInventoryService.ts';

function AppContent() {
  const { isLocked, unlockTerminal, currentRole } = useAuth();

  const getInitialTab = (): ActiveTab => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '') as ActiveTab;
      const validTabs: ActiveTab[] = [
        'pos',
        'phones',
        'accessories',
        'digital_finance',
        'service_software',
        'sales_history',
        'expenses',
        'analytics',
        'users',
      ];
      if (validTabs.includes(hash)) return hash;
    }
    return 'pos';
  };

  const [activeTab, setActiveTabState] = useState<ActiveTab>(getInitialTab);

  const setActiveTab = (tab: ActiveTab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      window.location.hash = tab;
    }
  };

  // Dengarkan perubahan hash browser (Back / Forward button di GitHub Pages)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as ActiveTab;
      const validTabs: ActiveTab[] = [
        'pos',
        'phones',
        'accessories',
        'digital_finance',
        'service_software',
        'sales_history',
        'expenses',
        'analytics',
        'users',
      ];
      if (validTabs.includes(hash)) {
        setActiveTabState(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [cart, setCart] = useState<CartItem[]>([]);

  // Inisialisasi seeding otomatis ke Cloud Firestore jika database cloud masih kosong saat aplikasi pertama kali deploy
  useEffect(() => {
    ensureCloudInventorySeeded();
  }, []);

  // Receipt Modal State
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptType, setReceiptType] = useState<ReceiptType>('sale');
  const [saleReceiptData, setSaleReceiptData] = useState<Sale | null>(null);
  const [digitalReceiptData, setDigitalReceiptData] = useState<DigitalTransaction | null>(null);
  const [serviceReceiptData, setServiceReceiptData] = useState<ServiceSoftwareOrder | null>(null);

  // Indicators for badges
  const [accessoriesCount, setAccessoriesCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [activeServiceCount, setActiveServiceCount] = useState(0);

  // Role Access Guard: Kasir hanya boleh mengakses 4 tab ini
  useEffect(() => {
    if (currentRole === 'cashier') {
      const allowedCashierTabs: ActiveTab[] = [
        'pos',
        'digital_finance',
        'service_software',
        'sales_history',
      ];
      if (!allowedCashierTabs.includes(activeTab)) {
        setActiveTab('pos');
      }
    }
  }, [currentRole, activeTab]);

  const fetchBadgeCounts = async () => {
    try {
      const srvRes = await fetch('/api/services').catch(() => null);

      let activeCount = 0;
      if (srvRes && srvRes.ok) {
        const srvs = await srvRes.json();
        if (Array.isArray(srvs)) {
          activeCount = srvs.filter(
            (s: any) => s.status === 'received' || s.status === 'in_progress'
          ).length;
        }
      } else {
        const stored = getStoredServiceOrders();
        activeCount = stored.filter(
          (s: any) => s.status === 'received' || s.status === 'in_progress'
        ).length;
      }
      setActiveServiceCount(activeCount);

      // Sinkronisasi data stok aksesoris menipis (Item Perlu Kulak)
      const prodRes = await fetch('/api/products').catch(() => null);
      if (prodRes && prodRes.ok) {
        const prods = await prodRes.json();
        if (Array.isArray(prods)) {
          const accs = prods.filter((p: any) => !p.isImeiTracked);
          setAccessoriesCount(accs.length);
          const low = accs.filter((p: any) => Number(p.stock) <= Number(p.minStockAlert ?? 5)).length;
          setLowStockCount(low);
        }
      }
    } catch {
      // quiet fail for badges
    }
  };

  // 1. Sinkronisasi Real-Time Badge Stok Aksesoris Menipis (Item Perlu Kulak) dengan Cloud Firestore
  useEffect(() => {
    const calculateLowStock = (items: any[]) => {
      return items.filter((p) => Number(p.stock) <= Number(p.minStockAlert ?? 5)).length;
    };

    const unsubAccessories = subscribeAccessories(
      (items) => {
        setAccessoriesCount(items.length);
        setLowStockCount(calculateLowStock(items));
      },
      () => {
        // Fallback jika offline
        fetch('/api/products')
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data)) {
              const accs = data.filter((p: any) => !p.isImeiTracked);
              setAccessoriesCount(accs.length);
              setLowStockCount(calculateLowStock(accs));
            }
          })
          .catch(() => {});
      }
    );

    return () => {
      unsubAccessories();
    };
  }, []);

  // 2. Refresh badge servis & transaksi
  useEffect(() => {
    if (!isLocked) {
      fetchBadgeCounts();
    }

    // Reaktif: Segarkan badge saat transaksi dihapus atau data dimodifikasi
    const unsubDelete = onTransactionDeleted(() => {
      fetchBadgeCounts();
    });

    const unsubUpdate = onDataUpdated(() => {
      fetchBadgeCounts();
    });

    return () => {
      unsubDelete();
      unsubUpdate();
    };
  }, [activeTab, isLocked]);

  const handleSaleComplete = (sale: Sale) => {
    setSaleReceiptData(sale);
    setReceiptType('sale');
    setReceiptOpen(true);
    fetchBadgeCounts();
  };

  const handlePrintDigital = (tx: DigitalTransaction) => {
    setDigitalReceiptData(tx);
    setReceiptType('digital');
    setReceiptOpen(true);
  };

  const handlePrintService = (order: ServiceSoftwareOrder) => {
    setServiceReceiptData(order);
    setReceiptType('service');
    setReceiptOpen(true);
  };

  const handleReprintSale = (sale: Sale) => {
    setSaleReceiptData(sale);
    setReceiptType('sale');
    setReceiptOpen(true);
  };

  const handleUnlockTerminal = (staff: AppUser) => {
    unlockTerminal(staff);
    // Saat pengguna (Kasir atau Owner) berhasil login, halaman utama yang pertama kali ditampilkan secara otomatis adalah Kasir POS
    setActiveTab('pos');
  };

  // If Terminal is Locked & Awaiting Cashier PIN Login (Majoo Split-Screen Style)
  if (isLocked) {
    return <LockScreen onUnlockSuccess={handleUnlockTerminal} />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col text-slate-900 antialiased selection:bg-indigo-100 selection:text-indigo-900 w-full max-w-full">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={cart.reduce((acc, item) => acc + item.quantity, 0)}
        accessoriesCount={accessoriesCount}
        lowStockCount={lowStockCount}
        activeServiceCount={activeServiceCount}
      />

      {/* Main Container with compact top spacing below sticky navbar (8px - 12px) */}
      <main className="flex-1 pt-2 sm:pt-2.5 lg:pt-3 pb-16 lg:pb-12 min-h-[calc(100vh-65px)] lg:min-h-[calc(100vh-125px)] w-full max-w-full">
        <div key={activeTab} className="tab-transition w-full max-w-full">
          {activeTab === 'pos' && (
            <POSModule
              onSaleComplete={handleSaleComplete}
              cart={cart}
              setCart={setCart}
            />
          )}

          {activeTab === 'digital_finance' && (
            <DigitalFinanceModule onPrintReceipt={handlePrintDigital} />
          )}

          {activeTab === 'service_software' && (
            <SoftwareServiceModule onPrintReceipt={handlePrintService} />
          )}

          {activeTab === 'sales_history' && (
            <SalesHistoryModule
              onReprintSale={handleReprintSale}
              onReprintDigital={handlePrintDigital}
              onReprintService={handlePrintService}
            />
          )}

          {/* Menu tambahan lainnya (Owner / Manager) */}
          {activeTab === 'phones' && <PhoneImeiModule />}

          {activeTab === 'accessories' && <AccessoriesModule />}

          {activeTab === 'analytics' && <AnalyticsModule />}

          {activeTab === 'expenses' && <ExpensesModule />}

          {activeTab === 'users' && <UserManagementModule />}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500 no-print">
        <p>
          KonterPOS &bull; Sistem POS & Manajemen 6 Pilar Toko Handphone Terintegrasi PostgreSQL
        </p>
      </footer>

      {/* Thermal Receipt Modal (58mm / 80mm) */}
      {receiptOpen && (
        <ThermalReceipt
          type={receiptType}
          saleData={saleReceiptData}
          digitalData={digitalReceiptData}
          serviceData={serviceReceiptData}
          onClose={() => setReceiptOpen(false)}
        />
      )}
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
