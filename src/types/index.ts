export type UserRole = 'owner' | 'manager' | 'cashier' | 'technician';

export interface AppUser {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  pin?: string;
  createdAt?: string;
}

export interface Category {
  id: number;
  name: string;
  code: string;
  description?: string;
  icon?: string;
}

export interface Product {
  id: number;
  categoryId: number;
  categoryName?: string;
  categoryCode?: string;
  code: string;
  name: string;
  brand?: string;
  model?: string;
  variant?: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStockAlert: number;
  isImeiTracked: boolean;
  unit: string;
  createdAt?: string;
}

export interface ProductSerial {
  id: number;
  productId: number;
  imei1: string;
  imei2?: string;
  serialNumber?: string;
  color?: string;
  ramStorage?: string;
  status: 'available' | 'sold' | 'transferred' | 'returned';
  purchasePrice: number;
  saleId?: number;
  notes?: string;
  createdAt?: string;
  soldAt?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedSerial?: ProductSerial;
  customPrice?: number;
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  productName: string;
  productCategory: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  subtotal: number;
  profit: number;
  imeiOrSerial?: string;
  productSerialId?: number;
}

export interface Sale {
  id: number;
  invoiceNumber: string;
  customerName: string;
  customerPhone?: string;
  subtotal: number;
  discount: number;
  grandTotal: number;
  totalCost: number;
  totalProfit: number;
  paymentMethod: string;
  amountPaid: number;
  changeAmount: number;
  cashierUid?: string;
  status: string;
  notes?: string;
  createdAt: string;
  items?: SaleItem[];
}

export interface DigitalTransaction {
  id: number;
  type: string;
  provider: string;
  targetAccount: string;
  customerName?: string;
  nominal: number;
  adminBankCost: number;
  adminStoreFee: number;
  totalCustomerPaid: number;
  profit: number;
  paymentMethod: string;
  referenceNumber: string;
  status: string;
  cashierUid?: string;
  notes?: string;
  createdAt: string;
}

export interface ServiceSoftwareOrder {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deviceModel: string;
  deviceImei?: string;
  deviceColor?: string;
  issueType: string;
  issueDetails?: string;
  toolsUsed?: string;
  toolCost: number;
  estimatedCost: number;
  finalCost: number;
  downPayment: number;
  balanceDue: number;
  status: 'received' | 'in_progress' | 'completed' | 'picked_up' | 'cancelled_failed';
  technicianUid?: string;
  technicianNotes?: string;
  receivedAt: string;
  completedAt?: string;
  pickedUpAt?: string;
}

export interface StoreExpense {
  id: number;
  category: string;
  title: string;
  amount: number;
  expenseDate: string;
  paidBy: string;
  notes?: string;
  createdAt: string;
}

export interface FinancialSummary {
  period: string;
  selectedPeriodInfo?: {
    label: string;
    startDate?: string | null;
    endDate?: string | null;
    month?: number;
    year?: number;
  };
  availableYears?: number[];
  totalGrossOmset: number;
  totalGrossProfit: number;
  totalExpenses: number;
  netProfit: number;
  summary: {
    salesOmset: number;
    salesTotalCost: number;
    salesTotalProfit: number;
    omsetDigi: number;
    digiTotalProfit: number;
    serviceOmset: number;
    serviceToolCost: number;
    serviceNetMargin: number;
  };
  pillarBreakdown: {
    hp: { omset: number; profit: number };
    aksesoris: { omset: number; profit: number };
    brilinkBank: { profit: number };
    ewallet: { profit: number };
    ppobPulsa: { profit: number };
    serviceSoftware: { omset: number; toolCost: number; profit: number };
  };
  expensesByCategory: Record<string, number>;
  paymentMethodBreakdown?: {
    cash: { count: number; total: number };
    qris: { count: number; total: number };
    transfer: { count: number; total: number };
  };
  indicators: {
    transactionCount: number;
    salesCount: number;
    digitalCount: number;
    serviceCount: number;
    lowStockCount: number;
    activeServiceCount: number;
  };
}
