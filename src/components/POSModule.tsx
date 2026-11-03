import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  CreditCard,
  Banknote,
  QrCode,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Copy,
  Check,
  Maximize2,
  Building2,
  Info,
  ExternalLink,
  Cloud,
  Edit3,
  Upload,
  Image as ImageIcon,
  RefreshCw,
  SlidersHorizontal,
  Settings,
} from 'lucide-react';
import { Product, ProductSerial, CartItem, Sale } from '../types/index.ts';
import {
  onTransactionDeleted,
  onDataUpdated,
  notifyDataUpdated,
  getStoredSales,
  saveStoredSales,
} from '../utils/transactionSync.ts';
import {
  syncCheckoutToFirestore,
  subscribeAccessories,
  subscribePhones,
  fetchAvailableSerialsCloud,
  ensureCloudInventorySeeded,
} from '../services/cloudInventoryService.ts';
import {
  StoreQrisConfig,
  DEFAULT_QRIS_CONFIG,
  getStoredQrisConfig,
  saveQrisConfigCloud,
  subscribeQrisConfig,
  resizeImageToDataUrl,
  EVENT_QRIS_UPDATED,
} from '../services/qrisSettingsService.ts';

export interface StoreBankAccount {
  id: string;
  name: string;
  accNo: string;
  holder: string;
  badgeColor?: string;
}

export const DEFAULT_BANK_ACCOUNTS: StoreBankAccount[] = [
  { id: 'bca', name: 'BCA', accNo: '8820-3948-112', holder: 'Konter Nusantara Cell', badgeColor: 'bg-blue-600' },
  { id: 'bri', name: 'BRI', accNo: '0123-0100-2948-501', holder: 'Konter Nusantara Cell', badgeColor: 'bg-blue-700' },
  { id: 'mandiri', name: 'Mandiri', accNo: '137-00-1928374-1', holder: 'Konter Nusantara Cell', badgeColor: 'bg-amber-600' },
  { id: 'bni', name: 'BNI', accNo: '0849-2819-20', holder: 'Konter Nusantara Cell', badgeColor: 'bg-teal-700' },
];

interface POSModuleProps {
  onSaleComplete: (sale: Sale) => void;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
}

export const POSModule: React.FC<POSModuleProps> = ({
  onSaleComplete,
  cart,
  setCart,
}) => {
  // 1. Data Inventaris Real-Time dari Cloud Firestore (Single Source of Truth)
  const [cloudPhones, setCloudPhones] = useState<Product[]>([]);
  const [cloudAccessories, setCloudAccessories] = useState<Product[]>([]);
  const [loadingPhones, setLoadingPhones] = useState(true);
  const [loadingAccessories, setLoadingAccessories] = useState(true);
  const [cloudSynced, setCloudSynced] = useState(true);

  // Kategori Retail Kasir POS (Pilar 1: Handphone & Pilar 2: Aksesoris)
  const categories = useMemo(
    () => [
      { id: 1, code: 'hp', name: 'Handphone & Gadget' },
      { id: 2, code: 'aksesoris', name: 'Aksesoris & Sparepart' },
    ],
    []
  );

  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');

  // IMEI selection modal state for smartphone products
  const [imeiModalOpen, setImeiModalOpen] = useState(false);
  const [pendingPhoneProduct, setPendingPhoneProduct] = useState<Product | null>(null);
  const [availableSerials, setAvailableSerials] = useState<ProductSerial[]>([]);
  const [loadingSerials, setLoadingSerials] = useState(false);

  // Checkout modal
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('Pelanggan Umum');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer'>('cash');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Dedicated QRIS Modal & verification state
  const [qrisModalOpen, setQrisModalOpen] = useState(false);
  const [qrisVerified, setQrisVerified] = useState(false);

  // Store QRIS Configuration state (Real-Time from Firestore + localStorage)
  const [qrisConfig, setQrisConfig] = useState<StoreQrisConfig>(getStoredQrisConfig);
  const [manageQrisModalOpen, setManageQrisModalOpen] = useState(false);
  const [qrisFormMerchant, setQrisFormMerchant] = useState('');
  const [qrisFormNmid, setQrisFormNmid] = useState('');
  const [qrisFormImage, setQrisFormImage] = useState('');
  const [qrisSaving, setQrisSaving] = useState(false);
  const [qrisSaveSuccess, setQrisSaveSuccess] = useState(false);

  const openManageQrisModal = () => {
    setQrisFormMerchant(qrisConfig.merchantName);
    setQrisFormNmid(qrisConfig.nmid);
    setQrisFormImage(qrisConfig.imageUrl || '');
    setQrisSaveSuccess(false);
    setManageQrisModalOpen(true);
  };

  const handleQrisImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Silakan pilih file gambar (JPG, PNG, atau WEBP)');
      return;
    }

    try {
      const dataUrl = await resizeImageToDataUrl(file, 600);
      setQrisFormImage(dataUrl);
    } catch (err: any) {
      alert(err.message || 'Gagal memproses gambar QRIS');
    }
  };

  const handleSaveQrisConfig = async () => {
    if (!qrisFormMerchant.trim()) {
      alert('Nama Merchant / Toko tidak boleh kosong');
      return;
    }
    if (!qrisFormNmid.trim()) {
      alert('NMID tidak boleh kosong');
      return;
    }

    setQrisSaving(true);
    try {
      const updated: StoreQrisConfig = {
        merchantName: qrisFormMerchant.trim().toUpperCase(),
        nmid: qrisFormNmid.trim(),
        subCode: 'A01',
        imageUrl: qrisFormImage || '',
      };
      await saveQrisConfigCloud(updated);
      setQrisConfig(updated);
      setQrisSaveSuccess(true);
      setTimeout(() => {
        setQrisSaveSuccess(false);
        setManageQrisModalOpen(false);
      }, 700);
    } catch (err) {
      console.error('Failed to save QRIS config:', err);
      alert('Terjadi kesalahan saat menyimpan pengaturan QRIS');
    } finally {
      setQrisSaving(false);
    }
  };

  const handleResetQrisConfig = () => {
    if (confirm('Kembalikan profil QRIS ke pengaturan awal standar toko?')) {
      setQrisFormMerchant(DEFAULT_QRIS_CONFIG.merchantName);
      setQrisFormNmid(DEFAULT_QRIS_CONFIG.nmid);
      setQrisFormImage('');
    }
  };

  // Bank Transfer state & persistent store accounts
  const [storeBankAccounts, setStoreBankAccounts] = useState<StoreBankAccount[]>(() => {
    try {
      const saved = localStorage.getItem('konter_store_bank_accounts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // quiet fail
    }
    return DEFAULT_BANK_ACCOUNTS;
  });

  const [selectedBankId, setSelectedBankId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('konter_store_bank_accounts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0].id;
      }
    } catch {
      // quiet fail
    }
    return 'bca';
  });

  const [senderInfo, setSenderInfo] = useState('');
  const [transferRefNumber, setTransferRefNumber] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [copiedAcc, setCopiedAcc] = useState(false);

  // Modal: Pop-up Pengaturan Nomor Rekening Toko
  const [manageBankModalOpen, setManageBankModalOpen] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [editBankName, setEditBankName] = useState('');
  const [editBankAccNo, setEditBankAccNo] = useState('');
  const [editBankHolder, setEditBankHolder] = useState('');

  // Form Tambah Rekening Baru
  const [newBankName, setNewBankName] = useState('BCA');
  const [newBankAccNo, setNewBankAccNo] = useState('');
  const [newBankHolder, setNewBankHolder] = useState('Konter Nusantara Cell');
  const [showAddForm, setShowAddForm] = useState(false);

  const saveBankAccountsToStorage = (accounts: StoreBankAccount[]) => {
    setStoreBankAccounts(accounts);
    try {
      localStorage.setItem('konter_store_bank_accounts', JSON.stringify(accounts));
    } catch {
      // quiet fail
    }
  };

  const handleStartEditBank = (bank: StoreBankAccount) => {
    setEditingBankId(bank.id);
    setEditBankName(bank.name);
    setEditBankAccNo(bank.accNo);
    setEditBankHolder(bank.holder);
  };

  const handleSaveEditBank = (bankId: string) => {
    if (!editBankName.trim() || !editBankAccNo.trim()) {
      alert('Nama Bank dan Nomor Rekening tidak boleh kosong');
      return;
    }
    const updated = storeBankAccounts.map((b) =>
      b.id === bankId
        ? {
            ...b,
            name: editBankName.trim().toUpperCase(),
            accNo: editBankAccNo.trim(),
            holder: editBankHolder.trim() || 'Konter Nusantara Cell',
          }
        : b
    );
    saveBankAccountsToStorage(updated);
    setEditingBankId(null);
  };

  const handleDeleteBank = (bankId: string) => {
    if (storeBankAccounts.length <= 1) {
      alert('Minimal harus ada 1 nomor rekening tujuan toko!');
      return;
    }
    if (confirm('Hapus nomor rekening bank ini dari daftar tujuan transfer?')) {
      const updated = storeBankAccounts.filter((b) => b.id !== bankId);
      saveBankAccountsToStorage(updated);
      if (selectedBankId === bankId && updated.length > 0) {
        setSelectedBankId(updated[0].id);
      }
    }
  };

  const handleAddNewBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim() || !newBankAccNo.trim()) {
      alert('Nama Bank dan Nomor Rekening wajib diisi');
      return;
    }
    const newId = `bank_${Date.now()}`;
    const newAcc: StoreBankAccount = {
      id: newId,
      name: newBankName.trim().toUpperCase(),
      accNo: newBankAccNo.trim(),
      holder: newBankHolder.trim() || 'Konter Nusantara Cell',
      badgeColor: 'bg-indigo-600',
    };
    const updated = [...storeBankAccounts, newAcc];
    saveBankAccountsToStorage(updated);
    setSelectedBankId(newId);
    setNewBankAccNo('');
    setShowAddForm(false);
  };

  const handleResetBankAccounts = () => {
    if (confirm('Kembalikan daftar rekening ke pengaturan awal bawaan toko?')) {
      saveBankAccountsToStorage(DEFAULT_BANK_ACCOUNTS);
      setSelectedBankId('bca');
      setEditingBankId(null);
      setShowAddForm(false);
    }
  };

  const formatRupiah = (val: number) => {
    return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
  };

  // 2. Sinkronisasi Real-Time dengan Cloud Firestore
  useEffect(() => {
    // Pastikan database cloud ter-seed jika masih kosong saat deploy
    ensureCloudInventorySeeded().catch(() => {});

    // Real-Time Listener: Koleksi Stok Aksesoris (Firestore collection 'stok_aksesoris')
    const unsubAccessories = subscribeAccessories(
      (items) => {
        setCloudAccessories(items);
        setLoadingAccessories(false);
        setCloudSynced(true);
      },
      (err) => {
        console.warn('Accessories firestore error:', err);
        setLoadingAccessories(false);
        setCloudSynced(false);
      }
    );

    // Real-Time Listener: Koleksi Handphone & Gadget (Firestore collection 'hp_imei')
    const unsubPhones = subscribePhones(
      (phones) => {
        setCloudPhones(phones);
        setLoadingPhones(false);
        setCloudSynced(true);
      },
      (err) => {
        console.warn('Phones firestore error:', err);
        setLoadingPhones(false);
        setCloudSynced(false);
      }
    );

    // Real-Time Listener: Pengaturan QRIS Toko (Firestore collection 'settings', doc 'qris_profile')
    const unsubQris = subscribeQrisConfig((newConfig) => {
      setQrisConfig(newConfig);
    });

    const handleLocalQrisUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<StoreQrisConfig>;
      if (customEvent.detail) {
        setQrisConfig(customEvent.detail);
      }
    };
    window.addEventListener(EVENT_QRIS_UPDATED, handleLocalQrisUpdate);

    return () => {
      unsubAccessories();
      unsubPhones();
      unsubQris();
      window.removeEventListener(EVENT_QRIS_UPDATED, handleLocalQrisUpdate);
    };
  }, []);

  // 3. Gabungkan seluruh produk dari kedua koleksi Cloud Firestore
  const products: Product[] = useMemo(() => {
    const formattedPhones = cloudPhones.map((p) => ({
      ...p,
      categoryId: 1,
      categoryName: p.categoryName || 'Handphone & Gadget',
      categoryCode: 'hp',
      isImeiTracked: true,
      unit: p.unit || 'unit',
    }));

    const formattedAccessories = cloudAccessories.map((a) => ({
      ...a,
      categoryId: 2,
      categoryName: a.categoryName || 'Aksesoris & Sparepart',
      categoryCode: 'aksesoris',
      isImeiTracked: false,
      unit: a.unit || 'pcs',
    }));

    return [...formattedPhones, ...formattedAccessories];
  }, [cloudPhones, cloudAccessories]);

  const loading = (loadingPhones || loadingAccessories) && products.length === 0;

  // 4. Filter Pencarian dan Kategori Produk
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Filter Kategori (Semua, Handphone, atau Aksesoris)
      if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) {
        return false;
      }

      // Filter Pencarian Teks (Barcode, SKU, Tipe HP, Merek, Nama Aksesoris, Varian)
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      const matchName = p.name ? p.name.toLowerCase().includes(q) : false;
      const matchCode = p.code ? p.code.toLowerCase().includes(q) : false;
      const matchBrand = p.brand ? p.brand.toLowerCase().includes(q) : false;
      const matchVariant = p.variant ? p.variant.toLowerCase().includes(q) : false;

      return matchName || matchCode || matchBrand || matchVariant;
    });
  }, [products, selectedCategory, searchQuery]);

  // Handle adding product to cart
  const handleAddToCart = async (product: Product) => {
    if (product.stock <= 0) {
      alert(`Stok produk "${product.name}" habis!`);
      return;
    }

    if (product.isImeiTracked) {
      // Must select a specific IMEI unit from inventory
      setPendingPhoneProduct(product);
      setLoadingSerials(true);
      setImeiModalOpen(true);
      try {
        let serialsList: ProductSerial[] = [];
        const phoneDocId = (product as any).docId || String(product.id);
        serialsList = await fetchAvailableSerialsCloud(phoneDocId);

        // Fallback ke REST API jika cloud belum berisi serial dan id bertipe number
        if (serialsList.length === 0 && typeof product.id === 'number') {
          const res = await fetch(`/api/products/${product.id}/serials?status=available`);
          const data = await res.json();
          if (Array.isArray(data)) serialsList = data;
        }

        // Exclude serials already in cart
        const serialsInCart = new Set(
          cart.filter(item => item.product.id === product.id && item.selectedSerial).map(item => item.selectedSerial!.id)
        );
        const filtered = serialsList.filter(s => !serialsInCart.has(s.id));
        setAvailableSerials(filtered);
      } catch (err) {
        console.error('Failed to fetch available serials:', err);
      } finally {
        setLoadingSerials(false);
      }
      return;
    }

    // Regular item (accessories, etc.)
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id && !item.selectedSerial);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert(`Jumlah melebihi stok yang tersedia (${product.stock} pcs)`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id && !item.selectedSerial
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleSelectImeiForCart = (serial: ProductSerial) => {
    if (!pendingPhoneProduct) return;

    setCart((prev) => [
      ...prev,
      {
        product: pendingPhoneProduct,
        quantity: 1, // each phone with specific IMEI is 1 unit
        selectedSerial: serial,
      },
    ]);

    setImeiModalOpen(false);
    setPendingPhoneProduct(null);
  };

  const handleUpdateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const target = prev[index];
      if (!target) return prev;

      if (target.selectedSerial) {
        // Individual phone cannot increase quantity beyond 1
        if (delta < 0) {
          return prev.filter((_, i) => i !== index);
        }
        return prev;
      }

      const newQty = target.quantity + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      if (newQty > target.product.stock) {
        alert(`Jumlah melebihi stok fisik tersedia (${target.product.stock})`);
        return prev;
      }

      return prev.map((item, i) => (i === index ? { ...item, quantity: newQty } : item));
    });
  };

  const handleRemoveItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.product.sellingPrice * item.quantity, 0);
  const grandTotal = Math.max(0, subtotal - (discount || 0));
  const changeAmount = Math.max(0, amountPaid - grandTotal);

  const handleCopyAcc = (accNumber: string) => {
    navigator.clipboard.writeText(accNumber.replace(/[^0-9]/g, ''));
    setCopiedAcc(true);
    setTimeout(() => setCopiedAcc(false), 2000);
  };

  const renderQrisSvg = (size: number = 180) => (
    <div className="relative inline-flex items-center justify-center bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
      <svg
        width={size}
        height={size}
        viewBox="0 0 180 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="rounded-lg"
      >
        <rect width="180" height="180" fill="white" />
        {/* Finder Pattern Top-Left */}
        <rect x="10" y="10" width="46" height="46" rx="6" fill="#0f172a" />
        <rect x="16" y="16" width="34" height="34" rx="4" fill="white" />
        <rect x="22" y="22" width="22" height="22" rx="3" fill="#4338ca" />

        {/* Finder Pattern Top-Right */}
        <rect x="124" y="10" width="46" height="46" rx="6" fill="#0f172a" />
        <rect x="130" y="16" width="34" height="34" rx="4" fill="white" />
        <rect x="136" y="22" width="22" height="22" rx="3" fill="#4338ca" />

        {/* Finder Pattern Bottom-Left */}
        <rect x="10" y="124" width="46" height="46" rx="6" fill="#0f172a" />
        <rect x="16" y="130" width="34" height="34" rx="4" fill="white" />
        <rect x="22" y="136" width="22" height="22" rx="3" fill="#4338ca" />

        {/* Timing Lines */}
        <line x1="58" y1="28" x2="120" y2="28" stroke="#0f172a" strokeWidth="4" strokeDasharray="5 5" />
        <line x1="28" y1="58" x2="28" y2="120" stroke="#0f172a" strokeWidth="4" strokeDasharray="5 5" />

        {/* QR Data Matrix */}
        <rect x="62" y="12" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="74" y="12" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="96" y="12" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="108" y="12" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="62" y="38" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="84" y="38" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="108" y="38" width="8" height="8" rx="1.5" fill="#1e293b" />

        <rect x="12" y="62" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="36" y="62" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="48" y="62" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="62" y="62" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="74" y="62" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="96" y="62" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="120" y="62" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="144" y="62" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="156" y="62" width="8" height="8" rx="1.5" fill="#1e293b" />

        <rect x="12" y="74" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="36" y="74" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="62" y="74" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="108" y="74" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="132" y="74" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="156" y="74" width="8" height="8" rx="1.5" fill="#1e293b" />

        <rect x="12" y="96" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="36" y="96" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="48" y="96" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="120" y="96" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="144" y="96" width="8" height="8" rx="1.5" fill="#1e293b" />

        <rect x="12" y="108" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="62" y="108" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="84" y="108" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="96" y="108" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="120" y="108" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="144" y="108" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="156" y="108" width="8" height="8" rx="1.5" fill="#1e293b" />

        {/* Alignment Pattern */}
        <rect x="124" y="124" width="26" height="26" rx="4" fill="#0f172a" />
        <rect x="128" y="128" width="18" height="18" rx="3" fill="white" />
        <rect x="132" y="132" width="10" height="10" rx="2" fill="#4338ca" />

        <rect x="62" y="132" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="74" y="144" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="84" y="132" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="96" y="144" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="108" y="132" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="156" y="132" width="8" height="8" rx="1.5" fill="#1e293b" />
        <rect x="156" y="144" width="8" height="8" rx="1.5" fill="#1e293b" />

        {/* Center Emblem */}
        <rect x="70" y="70" width="40" height="40" rx="10" fill="white" stroke="#e2e8f0" strokeWidth="2" />
        <rect x="74" y="74" width="32" height="32" rx="7" fill="#4f46e5" />
        <path d="M82 82h16v4H82zM82 88h12v4H82zM82 94h16v4H82z" fill="white" />
      </svg>
    </div>
  );

  const openCheckout = () => {
    if (cart.length === 0) return;
    setAmountPaid(grandTotal); // default exact amount
    setPaymentMethod('cash');
    setQrisVerified(false);
    setErrorMessage('');
    setCheckoutModalOpen(true);
  };

  const handleSelectPaymentMethod = (method: 'cash' | 'qris' | 'transfer') => {
    setPaymentMethod(method);
    if (method === 'qris' || method === 'transfer') {
      setAmountPaid(grandTotal);
      setQrisVerified(false);
    }
  };

  const handleProcessCheckout = async () => {
    if (amountPaid < grandTotal) {
      setErrorMessage('Nominal pembayaran kurang dari total tagihan');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      // Susun catatan rincian pembayaran untuk Transfer dan QRIS
      let notes: string | undefined = undefined;
      if (paymentMethod === 'transfer') {
        const currentBank = storeBankAccounts.find((b) => b.id === selectedBankId);
        const bankName = currentBank ? currentBank.name : 'Bank Toko';
        const accNo = currentBank ? currentBank.accNo : '';
        const parts = [
          `Transfer Bank ${bankName}${accNo ? ` (Rek Toko: ${accNo})` : ''}`,
          senderInfo.trim() ? `Pengirim: ${senderInfo.trim()}` : null,
          transferRefNumber.trim() ? `Reff: ${transferRefNumber.trim()}` : null,
          transferNotes.trim() ? `Catatan: ${transferNotes.trim()}` : null,
        ].filter(Boolean);
        notes = parts.join(' | ');
      } else if (paymentMethod === 'qris') {
        notes = `QRIS Toko (${qrisConfig.merchantName} - NMID: ${qrisConfig.nmid}) | Status: Terverifikasi Lunas`;
      }

      const payload = {
        customerName: customerName.trim() || 'Pelanggan Umum',
        customerPhone: customerPhone.trim() || undefined,
        discount: discount || 0,
        paymentMethod,
        amountPaid,
        notes,
        items: cart.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          productCategory: item.product.categoryName || 'Produk',
          quantity: item.quantity,
          costPrice: item.product.costPrice,
          sellingPrice: item.product.sellingPrice,
          isImeiTracked: item.product.isImeiTracked,
          selectedSerialId: item.selectedSerial?.id,
          imeiOrSerial: item.selectedSerial
            ? `IMEI 1: ${item.selectedSerial.imei1}${
                item.selectedSerial.serialNumber ? ` | SN: ${item.selectedSerial.serialNumber}` : ''
              }`
            : undefined,
        })),
      };

      let saleResult: any = null;
      try {
        const res = await fetch('/api/pos/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          saleResult = await res.json();
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('Backend API checkout returned error:', errData);
        }
      } catch (e) {
        console.warn('Backend API checkout notice, continuing with cloud transaction record:', e);
      }

      if (!saleResult) {
        saleResult = {
          id: Date.now(),
          invoiceNumber: `INV-${Date.now().toString().slice(-8)}`,
          customerName: payload.customerName,
          customerPhone: payload.customerPhone,
          totalAmount: grandTotal,
          discount: payload.discount,
          grandTotal: grandTotal,
          paymentMethod: payload.paymentMethod,
          amountPaid: payload.amountPaid,
          changeAmount: Math.max(0, payload.amountPaid - grandTotal),
          notes: payload.notes,
          items: payload.items,
          createdAt: new Date().toISOString(),
        };
      }

      // Sinkronisasi otomatis pengurangan stok & update serial ke Cloud Firestore
      await syncCheckoutToFirestore(cart).catch((e) => console.warn('Cloud sync error:', e));

      // Clear cart & close checkout modal
      setCart([]);
      setCheckoutModalOpen(false);
      setDiscount(0);
      setSenderInfo('');
      setTransferRefNumber('');
      setTransferNotes('');
      setQrisVerified(false);

      // Sinkronisasi data penjualan ke local storage & notifikasi event
      try {
        const currentStored = getStoredSales() || [];
        saveStoredSales([saleResult, ...currentStored]);
        notifyDataUpdated('pos');
      } catch (e) {
        console.warn('Failed to sync sale to local storage:', e);
      }

      // Trigger thermal receipt
      onSaleComplete(saleResult);
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-1.5 pb-6 sm:pb-8 w-full">
      {/* Mobile/Tablet View Switcher (< lg) */}
      <div className="lg:hidden flex items-center p-1 rounded-2xl bg-slate-200/80 mb-4 text-xs font-bold w-full">
        <button
          type="button"
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 min-h-[44px] transition-all cursor-pointer ${
            mobileTab === 'catalog'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Katalog Produk ({filteredProducts.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 min-h-[44px] transition-all cursor-pointer relative ${
            mobileTab === 'cart'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="relative">
            <CreditCard className="w-4 h-4" />
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2.5 w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                {cart.reduce((a, b) => a + b.quantity, 0)}
              </span>
            )}
          </div>
          <span>Keranjang ({cart.length})</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Product Catalog & Category Shortcuts (7 cols) */}
        <div className={`lg:col-span-7 flex flex-col space-y-4 ${mobileTab === 'catalog' ? 'flex' : 'hidden lg:flex'}`}>
          {/* Search & Header */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari barcode, SKU, tipe HP, atau nama aksesoris..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition min-h-[40px]"
              />
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <Cloud className="w-3 h-3" />
                <span>{cloudSynced ? 'Cloud Firestore Realtime' : 'Database Sinkron'}</span>
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Menampilkan <span className="text-slate-800 font-semibold">{filteredProducts.length}</span> item
              </div>
            </div>
          </div>

          {/* Category Shortcut Tabs */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors duration-150 cursor-pointer min-h-[38px] flex items-center gap-1.5 ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:text-indigo-600 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <span>Semua Produk</span>
              <span
                className={`min-w-[20px] h-[20px] px-1 aspect-square rounded-full text-[10px] font-extrabold inline-flex items-center justify-center leading-none ${
                  selectedCategory === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {products.length}
              </span>
            </button>
            {categories.map((c) => {
              const count = products.filter((p) => p.categoryId === c.id).length;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors duration-150 cursor-pointer min-h-[38px] flex items-center gap-1.5 ${
                    selectedCategory === c.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:text-indigo-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <span>{c.name}</span>
                  <span
                    className={`min-w-[20px] h-[20px] px-1 aspect-square rounded-full text-[10px] font-extrabold inline-flex items-center justify-center leading-none ${
                      selectedCategory === c.id
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Products Grid: 1 col on mobile (<640px), 2 cols on tablet (640px-1023px), 3 cols on desktop (>=1024px) */}
          {loading ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
              Memuat katalog produk konter...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
              <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-600 text-sm font-semibold">Produk tidak ditemukan</p>
              <p className="text-slate-400 text-xs mt-1">Coba sesuaikan kata kunci pencarian atau kategori</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5 overflow-y-auto max-h-[calc(100vh-250px)] pr-1">
              {filteredProducts.map((product) => {
                const isOutOfStock = product.stock <= 0;
                const isLowStock = !isOutOfStock && product.stock <= product.minStockAlert;

                return (
                  <div
                    key={product.id}
                    onClick={() => !isOutOfStock && handleAddToCart(product)}
                    className={`bg-white rounded-2xl border transition-all flex flex-col justify-between overflow-hidden h-full group min-h-[148px] ${
                      isOutOfStock
                        ? 'opacity-60 bg-slate-50 border-slate-200 cursor-not-allowed'
                        : 'border-slate-200/90 hover:border-indigo-400 hover:shadow-md cursor-pointer'
                    }`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      height: '100%',
                      padding: '16px 16px 18px 16px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div className="flex-1 min-w-0 pb-2">
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 truncate max-w-[120px]">
                          {product.code}
                        </span>

                        {product.isImeiTracked && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200 shrink-0">
                            IMEI HP
                          </span>
                        )}
                      </div>

                      <h4 className="font-semibold text-slate-800 text-xs group-hover:text-indigo-600 transition line-clamp-2 leading-snug">
                        {product.name}
                      </h4>

                      {product.variant && (
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">{product.variant}</p>
                      )}
                    </div>

                    <div
                      className="mt-auto pt-2.5 border-t border-slate-100 flex justify-between items-center w-full flex-wrap gap-2"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-slate-400 font-medium">Harga Jual</div>
                        <div
                          className="font-bold text-xs sm:text-[13px] text-indigo-700 whitespace-nowrap overflow-hidden text-ellipsis truncate"
                          style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={formatRupiah(product.sellingPrice)}
                        >
                          {formatRupiah(product.sellingPrice)}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center whitespace-nowrap shrink-0 ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-700'
                              : isLowStock
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {isOutOfStock ? 'Habis' : `Stok: ${product.stock}`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active Cart & Checkout (5 cols) */}
        <div className={`lg:col-span-5 flex flex-col ${mobileTab === 'cart' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col h-full overflow-hidden">
            {/* Cart Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-sm">Keranjang Transaksi</h3>
                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {cart.length} item
                </span>
              </div>

              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium transition"
                >
                  Kosongkan
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3 min-h-[300px] max-h-[calc(100vh-380px)]">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <ShoppingCart className="w-12 h-12 text-slate-300 mb-2 stroke-[1.5]" />
                  <p className="font-semibold text-slate-600 text-sm">Keranjang Masih Kosong</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                    Pilih produk dari katalog di sebelah kiri untuk memulai transaksi kasir
                  </p>
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 text-xs truncate">
                        {item.product.name}
                      </div>

                      {item.selectedSerial && (
                        <div className="mt-1 px-2 py-1 rounded bg-indigo-50 border border-indigo-100 text-[10px] text-indigo-700 font-mono">
                          IMEI: {item.selectedSerial.imei1}
                          {item.selectedSerial.color && ` (${item.selectedSerial.color})`}
                        </div>
                      )}

                      <div className="text-xs font-bold text-indigo-600 mt-1">
                        {formatRupiah(item.product.sellingPrice)}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Quantity Controller */}
                      {!item.selectedSerial ? (
                        <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden shadow-2xs">
                          <button
                            onClick={() => handleUpdateQuantity(idx, -1)}
                            className="p-1 hover:bg-slate-100 text-slate-600 transition"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2.5 text-xs font-semibold text-slate-800">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleUpdateQuantity(idx, 1)}
                            className="p-1 hover:bg-slate-100 text-slate-600 transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-500 px-2 py-0.5 rounded bg-white border border-slate-200">
                          1 Unit
                        </span>
                      )}

                      <div className="text-right min-w-[70px]">
                        <div className="text-xs font-bold text-slate-900">
                          {formatRupiah(item.product.sellingPrice * item.quantity)}
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Summary & Checkout Footer */}
            <div className="p-5 border-t border-slate-200/80 bg-slate-50/60 space-y-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-800">{formatRupiah(subtotal)}</span>
                </div>

                <div className="flex justify-between items-center text-slate-500">
                  <span>Diskon Toko (Rp)</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={discount || ''}
                    placeholder="0"
                    onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                    className="w-28 text-right py-1 px-2 text-xs rounded-lg border border-slate-200 bg-white font-semibold text-rose-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-200 text-slate-900">
                  <span>Total Tagihan</span>
                  <span className="text-indigo-700 text-base">{formatRupiah(grandTotal)}</span>
                </div>
              </div>

              <button
                disabled={cart.length === 0}
                onClick={openCheckout}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Banknote className="w-4 h-4" />
                <span>Bayar Transaksi ({formatRupiah(grandTotal)})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Select IMEI for Smartphone */}
      {imeiModalOpen && pendingPhoneProduct && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Pilih Nomor IMEI / Serial Unit</h3>
                <p className="text-xs text-indigo-600 font-semibold">{pendingPhoneProduct.name}</p>
              </div>
              <button
                onClick={() => setImeiModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="my-4 max-h-60 overflow-y-auto space-y-2">
              {loadingSerials ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  Memeriksa unit IMEI yang tersedia...
                </div>
              ) : availableSerials.length === 0 ? (
                <div className="text-center py-6 text-xs text-rose-600">
                  Tidak ada stok unit dengan IMEI tersedia untuk produk ini.
                </div>
              ) : (
                availableSerials.map((serial) => (
                  <div
                    key={serial.id}
                    onClick={() => handleSelectImeiForCart(serial)}
                    className="p-3 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 cursor-pointer transition flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono text-xs font-bold text-slate-900">
                        IMEI 1: {serial.imei1}
                      </div>
                      {serial.imei2 && (
                        <div className="font-mono text-[11px] text-slate-500">IMEI 2: {serial.imei2}</div>
                      )}
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {serial.color || '-'} | {serial.ramStorage || '-'}
                      </div>
                    </div>
                    <button className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg">
                      Pilih
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setImeiModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Checkout & Payment Modal (Compact & Tanpa Scroll) */}
      {checkoutModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 my-auto flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* 1. Modal Header (Fixed / Non-scrolling) */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-white shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">Pembayaran Kasir POS</h3>
                <p className="text-[11px] text-slate-500">Selesaikan transaksi penjualan toko</p>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Error Message if any */}
            {errorMessage && (
              <div className="mx-4 mt-2 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* 2. Modal Body (Compact, No Scroll) */}
            <div className="p-3.5 sm:p-4 space-y-2.5 flex flex-col">
              {/* Customer Information (Compact) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0">
                <div>
                  <label className="text-[10.5px] font-semibold text-slate-700 block mb-0.5">
                    Nama Pelanggan
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Pelanggan Umum"
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[34px]"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-semibold text-slate-700 block mb-0.5">
                    No. WhatsApp (Opsional)
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0812xxxx"
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[34px]"
                  />
                </div>
              </div>

              {/* Payment Method Selector - Compact */}
              <div className="shrink-0">
                <label className="text-[10.5px] font-semibold text-slate-700 block mb-1">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('cash')}
                    className={`py-1.5 px-2 min-h-[36px] rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-2xs ring-2 ring-indigo-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5 shrink-0" />
                    <span>Tunai (Cash)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('qris')}
                    className={`py-1.5 px-2 min-h-[36px] rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      paymentMethod === 'qris'
                        ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-2xs ring-2 ring-purple-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5 shrink-0" />
                    <span>QRIS Toko</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPaymentMethod('transfer')}
                    className={`py-1.5 px-2 min-h-[36px] rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      paymentMethod === 'transfer'
                        ? 'border-sky-600 bg-sky-50 text-sky-700 shadow-2xs ring-2 ring-sky-500/20'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5 shrink-0" />
                    <span>Transfer Bank</span>
                  </button>
                </div>
              </div>

              {/* Kontainer Detail Pembayaran (Padat & Tanpa Scroll) */}
              <div className="flex flex-col justify-start">
                {/* 1. Mode Pembayaran TUNAI (CASH) */}
                {paymentMethod === 'cash' && (
                  <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-900 space-y-2.5 animate-in fade-in-50 duration-150">
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-xs text-slate-600 font-medium pb-1.5 border-b border-slate-200/80">
                        <span>Total Tagihan Bersih:</span>
                        <span className="font-extrabold text-base text-indigo-700">{formatRupiah(grandTotal)}</span>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Uang Diterima dari Pelanggan:
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                            Rp
                          </span>
                          <input
                            type="number"
                            value={amountPaid || ''}
                            onChange={(e) => setAmountPaid(Number(e.target.value) || 0)}
                            className="w-full pl-9 pr-3 py-1.5 text-base font-extrabold rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 shadow-2xs transition"
                          />
                        </div>
                      </div>

                      {/* 5 Nominal Pasti */}
                      <div>
                        <span className="text-[10px] font-semibold text-slate-500 block mb-1">
                          Pilihan Cepat Nominal Uang:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setAmountPaid(grandTotal)}
                            className="min-h-[34px] px-2 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg text-xs font-bold text-slate-700 hover:text-indigo-700 shadow-2xs hover:shadow-xs active:bg-indigo-600 active:text-white transition-all duration-150 cursor-pointer flex items-center justify-center"
                          >
                            Uang Pas
                          </button>
                          <button
                            type="button"
                            onClick={() => setAmountPaid(50000)}
                            className="min-h-[34px] px-2 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg text-xs font-bold text-slate-700 hover:text-indigo-700 shadow-2xs hover:shadow-xs active:bg-indigo-600 active:text-white transition-all duration-150 cursor-pointer flex items-center justify-center"
                          >
                            50.000
                          </button>
                          <button
                            type="button"
                            onClick={() => setAmountPaid(100000)}
                            className="min-h-[34px] px-2 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg text-xs font-bold text-slate-700 hover:text-indigo-700 shadow-2xs hover:shadow-xs active:bg-indigo-600 active:text-white transition-all duration-150 cursor-pointer flex items-center justify-center"
                          >
                            100.000
                          </button>
                          <button
                            type="button"
                            onClick={() => setAmountPaid(500000)}
                            className="min-h-[34px] px-2 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg text-xs font-bold text-slate-700 hover:text-indigo-700 shadow-2xs hover:shadow-xs active:bg-indigo-600 active:text-white transition-all duration-150 cursor-pointer flex items-center justify-center"
                          >
                            500.000
                          </button>
                          <button
                            type="button"
                            onClick={() => setAmountPaid(1000000)}
                            className="min-h-[34px] px-2 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg text-xs font-bold text-slate-700 hover:text-indigo-700 shadow-2xs hover:shadow-xs active:bg-indigo-600 active:text-white transition-all duration-150 cursor-pointer flex items-center justify-center"
                          >
                            1.000.000
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-xs">
                      <span className="text-slate-500 font-medium">Kembalian:</span>
                      <span
                        className={`font-extrabold text-base ${
                          changeAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {formatRupiah(changeAmount)}
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. Mode Pembayaran QRIS TOKO */}
                {paymentMethod === 'qris' && (
                  <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-200 text-slate-900 space-y-2 animate-in fade-in-50 duration-150">
                    {/* QRIS Header */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-purple-200/80 shrink-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                          <QrCode className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-purple-950 flex items-center gap-1.5 truncate">
                            <span>QRIS PEMBAYARAN NASIONAL</span>
                          </div>
                          <div className="text-[9.5px] text-slate-600 font-mono truncate">
                            NMID: {qrisConfig.nmid} | {qrisConfig.merchantName}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={openManageQrisModal}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-purple-100 border border-purple-300 text-purple-700 text-[11px] font-bold shadow-2xs transition cursor-pointer"
                          title="Ubah NMID, Nama Merchant, atau Unggah Gambar QRIS Toko"
                        >
                          <Edit3 className="w-3 h-3 text-purple-600" />
                          <span>Ubah QRIS</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setQrisModalOpen(true)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold shadow-2xs transition cursor-pointer"
                          title="Perbesar tampilan QRIS ke layar penuh"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span>Pop-up QR</span>
                        </button>
                      </div>
                    </div>

                    {/* QRIS Card Body */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-2.5 rounded-xl border border-purple-100 shadow-2xs">
                      <div className="shrink-0 flex flex-col items-center">
                        {qrisConfig.imageUrl ? (
                          <div className="w-[115px] h-[115px] bg-white p-1 rounded-xl border border-purple-200 flex items-center justify-center overflow-hidden shadow-2xs">
                            <img
                              src={qrisConfig.imageUrl}
                              alt={`QRIS ${qrisConfig.merchantName}`}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          renderQrisSvg(115)
                        )}
                        <button
                          type="button"
                          onClick={openManageQrisModal}
                          className="text-[9.5px] font-bold text-purple-700 hover:text-purple-900 hover:underline mt-1 flex items-center gap-0.5 cursor-pointer"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>{qrisConfig.imageUrl ? 'Ganti QR' : 'Unggah QR'}</span>
                        </button>
                      </div>

                      <div className="flex-1 w-full space-y-1.5 text-left min-w-0">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Total Tagihan (Uang Pas):</span>
                          <div className="text-lg font-black text-purple-700 tracking-tight leading-none">
                            {formatRupiah(grandTotal)}
                          </div>
                        </div>

                        <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-600 space-y-0.5">
                          <div className="font-bold text-slate-800 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-purple-600" />
                            <span>Instruksi Scan:</span>
                          </div>
                          <p className="text-[9.5px] leading-snug text-slate-500">
                            Arahkan kamera m-Banking atau E-Wallet pelanggan ke QR <strong className="text-slate-700">{qrisConfig.merchantName}</strong>.
                          </p>
                        </div>

                        {/* Tombol Konfirmasi Verifikasi QRIS */}
                        <button
                          type="button"
                          onClick={() => setQrisVerified(!qrisVerified)}
                          className={`w-full py-1.5 px-2.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs ${
                            qrisVerified
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'bg-white hover:bg-purple-50 border-purple-200 text-purple-700'
                          }`}
                        >
                          <CheckCircle className={`w-3.5 h-3.5 ${qrisVerified ? 'text-white' : 'text-purple-600'}`} />
                          <span>
                            {qrisVerified
                              ? '✓ Pembayaran QRIS Terverifikasi Masuk'
                              : 'Klik: Verifikasi Pembayaran Berhasil'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Mode Pembayaran TRANSFER BANK (Padat & Tanpa Scroll) */}
                {paymentMethod === 'transfer' && (
                  <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-200 text-slate-900 space-y-2 animate-in fade-in-50 duration-150">
                    <div className="flex items-center justify-between pb-1.5 border-b border-sky-200/80">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-md bg-sky-600 text-white flex items-center justify-center shadow-xs">
                          <CreditCard className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-sky-950 leading-tight">
                            TRANSFER BANK TUJUAN TOKO
                          </div>
                          <div className="text-[9.5px] text-slate-500 leading-none">
                            Pilih rekening bank tujuan penerimaan transfer
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-black text-sky-800 bg-white px-2 py-0.5 rounded-md border border-sky-200">
                        {formatRupiah(grandTotal)}
                      </span>
                    </div>

                    {/* Rekening Tujuan Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-slate-700">
                          Pilih Rekening Tujuan Toko:
                        </label>
                        <button
                          type="button"
                          onClick={() => setManageBankModalOpen(true)}
                          className="text-[10px] text-sky-700 hover:text-sky-900 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>Atur Daftar Rekening</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-24 overflow-y-auto pr-0.5">
                        {storeBankAccounts.map((bank) => (
                          <button
                            key={bank.id}
                            type="button"
                            onClick={() => setSelectedBankId(bank.id)}
                            className={`py-1 px-1.5 rounded-lg border text-xs font-bold flex flex-col items-center justify-center transition cursor-pointer ${
                              selectedBankId === bank.id
                                ? 'border-sky-600 bg-sky-600 text-white shadow-2xs'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="text-[11px] font-black leading-tight truncate max-w-full">{bank.name}</span>
                            <span className={`text-[8.5px] leading-tight truncate max-w-full ${selectedBankId === bank.id ? 'text-sky-100' : 'text-slate-400'}`}>
                              {bank.accNo}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Rekening Card with Copy Button & Ubah Rek Button */}
                    {selectedBankId && (
                      <div className="px-2.5 py-1.5 bg-white rounded-lg border border-sky-200 flex items-center justify-between gap-2 shadow-2xs">
                        <div className="min-w-0 flex-1">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-tight truncate">
                            No. Rek {storeBankAccounts.find((b) => b.id === selectedBankId)?.name} (a/n {storeBankAccounts.find((b) => b.id === selectedBankId)?.holder}):
                          </div>
                          <div className="font-mono text-sm font-extrabold text-slate-900 tracking-wider leading-tight truncate">
                            {storeBankAccounts.find((b) => b.id === selectedBankId)?.accNo}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyAcc(
                                storeBankAccounts.find((b) => b.id === selectedBankId)?.accNo || ''
                              )
                            }
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition shadow-2xs cursor-pointer ${
                              copiedAcc
                                ? 'bg-emerald-600 text-white'
                                : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200'
                            }`}
                            title="Salin nomor rekening ke clipboard"
                          >
                            {copiedAcc ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedAcc ? 'Tersalin' : 'Salin Rek'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setManageBankModalOpen(true)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 hover:text-indigo-600 border border-slate-300 transition shadow-2xs cursor-pointer"
                            title="Ubah / Atur nomor rekening toko"
                          >
                            <Edit3 className="w-3 h-3 text-slate-500" />
                            <span>Ubah Rek</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Input Rincian Bukti & Pengirim */}
                    <div className="space-y-1.5 pt-0.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-700 block mb-0.5">
                            Nama & Bank Pengirim
                          </label>
                          <input
                            type="text"
                            value={senderInfo}
                            onChange={(e) => setSenderInfo(e.target.value)}
                            placeholder="Misal: BCA a/n Hendra"
                            className="w-full text-xs py-1 px-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 min-h-[30px]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-700 block mb-0.5">
                            No. Referensi / 4 Digit Rekening
                          </label>
                          <input
                            type="text"
                            value={transferRefNumber}
                            onChange={(e) => setTransferRefNumber(e.target.value)}
                            placeholder="Misal: TRX-99214 / 1234"
                            className="w-full text-xs py-1 px-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 min-h-[30px]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-slate-700 block mb-0.5">
                          Catatan Bukti Transfer (Opsional)
                        </label>
                        <input
                          type="text"
                          value={transferNotes}
                          onChange={(e) => setTransferNotes(e.target.value)}
                          placeholder="Misal: Mutasi m-banking masuk jam 14:15"
                          className="w-full text-xs py-1 px-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 min-h-[30px]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Footer Action Bar (Compact & Clean) */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 p-3 sm:px-4 sm:py-2.5 border-t border-slate-100 bg-slate-50/70 shrink-0">
              <button
                type="button"
                onClick={() => setCheckoutModalOpen(false)}
                className="min-h-[38px] px-4 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer flex items-center justify-center"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting || amountPaid < grandTotal}
                onClick={handleProcessCheckout}
                className="min-h-[38px] px-5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs hover:shadow-sm hover:shadow-indigo-500/20 transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Menyimpan Transaksi...' : 'Konfirmasi & Cetak Struk'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up QRIS Full Screen Customer Display */}
      {qrisModalOpen && (
        <div 
          className="fixed inset-0 z-[9990] flex items-center justify-center bg-slate-900/45 backdrop-blur-md p-4 animate-in fade-in duration-200 no-print"
          style={{ zIndex: 9990, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 text-center animate-in zoom-in-95 duration-150 flex flex-col">
            {/* Header Red Banner */}
            <div className="bg-red-600 text-white p-3.5 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-white" />
                <span className="font-black text-sm tracking-wide">QRIS PEMBAYARAN</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setQrisModalOpen(false);
                    openManageQrisModal();
                  }}
                  className="px-2 py-0.5 rounded-lg bg-red-700/90 hover:bg-red-800 text-[10px] font-bold text-white flex items-center gap-1 cursor-pointer transition"
                  title="Ubah info atau gambar QRIS toko"
                >
                  <Edit3 className="w-2.5 h-2.5" />
                  <span>Atur</span>
                </button>
                <button
                  type="button"
                  onClick={() => setQrisModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-red-700 hover:bg-red-800 text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-5 space-y-3.5">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 leading-tight">
                  {qrisConfig.merchantName}
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  NMID: {qrisConfig.nmid}
                </p>
              </div>

              {/* QR Image */}
              <div className="flex justify-center my-1">
                {qrisConfig.imageUrl ? (
                  <div className="w-[220px] h-[220px] bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
                    <img
                      src={qrisConfig.imageUrl}
                      alt={`QRIS ${qrisConfig.merchantName}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  renderQrisSvg(220)
                )}
              </div>

              {/* Nominal Tagihan */}
              <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-2xl">
                <div className="text-[11px] font-bold text-slate-500">Total Tagihan (Uang Pas):</div>
                <div className="text-2xl font-black text-purple-700 mt-0.5">
                  {formatRupiah(grandTotal)}
                </div>
                <div className="text-[10px] text-emerald-700 font-semibold mt-1 flex items-center justify-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Dukungan Seluruh Aplikasi Bank & E-Wallet</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 leading-relaxed px-2">
                Arahkan kamera aplikasi BCA, Mandiri, BRImo, Dana, GoPay, OVO, atau ShopeePay ke kode QR di atas.
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setQrisVerified(true);
                    setQrisModalOpen(false);
                  }}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4 text-white" />
                  <span>Verifikasi Sukses & Tutup QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setQrisModalOpen(false)}
                  className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Tutup Tanpa Verifikasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Pengaturan & Kelola Nomor Rekening Toko */}
      {manageBankModalOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/15 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          style={{ zIndex: 9999, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingBankId(null);
              setShowAddForm(false);
              setManageBankModalOpen(false);
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 border border-slate-200/80 ring-1 ring-black/5 flex flex-col max-h-[90vh] overflow-hidden relative z-[10000]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Pengaturan Rekening Tujuan Toko</h3>
                  <p className="text-[11px] text-slate-500">Kelola nomor rekening bank untuk pembayaran transfer kasir</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingBankId(null);
                  setShowAddForm(false);
                  setManageBankModalOpen(false);
                }}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold text-sm transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body - Scrollable List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
              {/* List Rekening Aktif */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Daftar Rekening Bank ({storeBankAccounts.length})</span>
                  {!showAddForm && (
                    <button
                      type="button"
                      onClick={() => setShowAddForm(true)}
                      className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Rekening Baru</span>
                    </button>
                  )}
                </div>

                {storeBankAccounts.map((bank) => {
                  const isEditing = editingBankId === bank.id;
                  const isSelected = selectedBankId === bank.id;

                  if (isEditing) {
                    return (
                      <div
                        key={bank.id}
                        className="p-3 bg-sky-50/70 rounded-xl border border-sky-300 space-y-2.5 shadow-2xs"
                      >
                        <div className="text-[11px] font-bold text-sky-950 flex items-center justify-between">
                          <span>Edit Rincian Rekening:</span>
                          <span className="text-[10px] text-slate-400">ID: {bank.id}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Nama Bank</label>
                            <input
                              type="text"
                              value={editBankName}
                              onChange={(e) => setEditBankName(e.target.value)}
                              placeholder="BCA, Mandiri, BRI, dll"
                              className="w-full text-xs py-1.5 px-2 rounded-lg bg-white border border-slate-200 uppercase font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Nomor Rekening</label>
                            <input
                              type="text"
                              value={editBankAccNo}
                              onChange={(e) => setEditBankAccNo(e.target.value)}
                              placeholder="8820-xxxx-xxx"
                              className="w-full text-xs py-1.5 px-2 rounded-lg bg-white border border-slate-200 font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Atas Nama (a/n)</label>
                            <input
                              type="text"
                              value={editBankHolder}
                              onChange={(e) => setEditBankHolder(e.target.value)}
                              placeholder="Nama Pemilik Toko"
                              className="w-full text-xs py-1.5 px-2 rounded-lg bg-white border border-slate-200"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingBankId(null)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditBank(bank.id)}
                            className="px-3 py-1 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Simpan Perubahan</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={bank.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                        isSelected
                          ? 'bg-sky-50/50 border-sky-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-black uppercase">
                            {bank.name}
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-900 tracking-wider">
                            {bank.accNo}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-700 border border-sky-200">
                              Terpilih di Kasir
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          a/n <strong className="text-slate-700 font-semibold">{bank.holder}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEditBank(bank)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 transition flex items-center gap-1 cursor-pointer"
                          title="Edit nomor rekening ini"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Ubah</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBank(bank.id)}
                          disabled={storeBankAccounts.length <= 1}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          title="Hapus rekening ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Form Tambah Rekening Baru (Collapsible) */}
              {showAddForm && (
                <form
                  onSubmit={handleAddNewBank}
                  className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-200 space-y-2.5 animate-in fade-in-50 duration-150"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Tambah Rekening Bank Baru</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-[10px] text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Nama Bank</label>
                      <input
                        type="text"
                        required
                        value={newBankName}
                        onChange={(e) => setNewBankName(e.target.value)}
                        placeholder="Contoh: BCA / JAGO"
                        className="w-full text-xs py-1.5 px-2 rounded-lg bg-white border border-slate-200 uppercase font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Nomor Rekening</label>
                      <input
                        type="text"
                        required
                        value={newBankAccNo}
                        onChange={(e) => setNewBankAccNo(e.target.value)}
                        placeholder="Contoh: 1234567890"
                        className="w-full text-xs py-1.5 px-2 rounded-lg bg-white border border-slate-200 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Atas Nama (a/n)</label>
                      <input
                        type="text"
                        required
                        value={newBankHolder}
                        onChange={(e) => setNewBankHolder(e.target.value)}
                        placeholder="Nama Pemilik Toko"
                        className="w-full text-xs py-1.5 px-2 rounded-lg bg-white border border-slate-200"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambahkan ke Rekening Toko</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleResetBankAccounts}
                className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold hover:underline cursor-pointer"
              >
                Reset Bawaan Toko
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingBankId(null);
                  setShowAddForm(false);
                  setManageBankModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                Selesai & Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Pengaturan & Kelola QRIS Toko */}
      {manageQrisModalOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/15 backdrop-blur-sm p-4 animate-in fade-in duration-200 no-print"
          style={{ zIndex: 9999, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setManageQrisModalOpen(false);
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 border border-slate-200/80 ring-1 ring-black/5 flex flex-col max-h-[92vh] overflow-hidden relative z-[10000]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Pengaturan QRIS Toko</h3>
                  <p className="text-[11px] text-slate-500">Kelola profil nama merchant, NMID, dan barcode QRIS resmi toko</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManageQrisModalOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold text-sm transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
              {/* Form Input Data QRIS */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nama Merchant / Usaha Toko:
                  </label>
                  <input
                    type="text"
                    value={qrisFormMerchant}
                    onChange={(e) => setQrisFormMerchant(e.target.value)}
                    placeholder="Contoh: KONTER NUSANTARA CELL"
                    className="w-full text-xs font-bold py-2 px-3 rounded-xl bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Nama usaha resmi yang tertera pada lembar sertifikat QRIS toko Anda.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    NMID (National Merchant Identifier):
                  </label>
                  <input
                    type="text"
                    value={qrisFormNmid}
                    onChange={(e) => setQrisFormNmid(e.target.value)}
                    placeholder="Contoh: ID1020304050607 | A01"
                    className="w-full text-xs font-mono font-bold py-2 px-3 rounded-xl bg-white border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Nomor identifikasi merchant nasional (13-16 digit) dari bank penyedia atau e-wallet.
                  </p>
                </div>

                {/* Bagian Unggah Gambar QRIS Toko */}
                <div className="pt-1">
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Gambar / Foto Barcode QRIS Toko:
                  </label>

                  <div className="flex flex-col sm:flex-row items-center gap-3.5 p-3.5 bg-purple-50/50 rounded-xl border border-purple-200/80">
                    {/* Preview Box */}
                    <div className="w-28 h-28 bg-white rounded-xl border border-purple-200 flex items-center justify-center p-1.5 shrink-0 shadow-2xs overflow-hidden relative group">
                      {qrisFormImage ? (
                        <img
                          src={qrisFormImage}
                          alt="Preview QRIS"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="text-center p-2">
                          <QrCode className="w-8 h-8 text-purple-400 mx-auto mb-1" />
                          <span className="text-[9px] text-slate-400 font-semibold block leading-tight">
                            QR Standar Sistem
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Upload & Action Controls */}
                    <div className="flex-1 w-full space-y-2 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold text-xs cursor-pointer shadow-xs transition">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{qrisFormImage ? 'Ganti Foto QR' : 'Unggah Foto QRIS'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleQrisImageUpload}
                            className="hidden"
                          />
                        </label>

                        {qrisFormImage && (
                          <button
                            type="button"
                            onClick={() => setQrisFormImage('')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold transition cursor-pointer"
                            title="Hapus foto kustom dan gunakan QR standar sistem"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Gunakan QR Standar</span>
                          </button>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        Unggah foto atau screenshot barcode QRIS resmi toko Anda (JPG, PNG, WEBP). Gambar otomatis dioptimasi agar jernih dan dapat dipindai dengan cepat oleh konsumen.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cloud Sync Status Indicator */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <Cloud className="w-3.5 h-3.5 text-sky-600" />
                    <span>Sinkronisasi Otomatis:</span>
                    <strong className="text-slate-800">Cloud Firestore & Offline</strong>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    Aktif
                  </span>
                </div>

                {qrisSaveSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Pengaturan QRIS Toko berhasil disimpan ke database cloud!</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResetQrisConfig}
                className="text-xs text-slate-500 hover:text-slate-700 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset ke Standar</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setManageQrisModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={qrisSaving}
                  onClick={handleSaveQrisConfig}
                  className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs hover:shadow-purple-500/20 transition cursor-pointer disabled:opacity-50"
                >
                  {qrisSaving ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Simpan Pengaturan QRIS</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Quick Cart Bar on Mobile when viewing Catalog */}
      {cart.length > 0 && mobileTab === 'catalog' && (
        <div className="lg:hidden fixed bottom-3 left-3 right-3 z-30 animate-in slide-in-from-bottom duration-200 no-print">
          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className="w-full min-h-[48px] py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center justify-between font-bold text-xs cursor-pointer border border-indigo-500/30 transition-colors duration-150"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-white text-indigo-700 font-extrabold flex items-center justify-center text-[11px] shadow-xs">
                {cart.reduce((a, b) => a + b.quantity, 0)}
              </span>
              <span>Total: {formatRupiah(subtotal)}</span>
            </div>
            <div className="flex items-center gap-1 font-extrabold">
              <span>Buka Keranjang & Bayar</span>
              <span className="text-sm font-black">→</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
