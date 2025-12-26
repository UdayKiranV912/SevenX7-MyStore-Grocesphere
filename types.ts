
export interface BrandOption {
  name: string;
  price: number; 
  imageUrl?: string;
}

export interface BrandInventoryInfo {
  price: number; 
  mrp: number;   
  stock: number; 
  inStock: boolean;
  imageUrl?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number; 
  mrp?: number; 
  costPrice?: number;
  emoji: string;
  imageUrl?: string;
  category: string;
  description?: string;
  ingredients?: string;
  nutrition?: string;
  brands?: BrandOption[]; 
}

export type StoreType = 'Vegetables/Fruits' | 'Daily Needs / Milk Booth' | 'General Store' | 'Local Mart';

export interface BankDetails {
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  accountHolder: string;
}

export interface AdCampaign {
  id: string;
  title: string;
  description: string;
  productId?: string;
  status: 'active' | 'scheduled' | 'expired';
}

export interface Store {
  id: string;
  name: string;
  address: string;
  rating: number;
  distance: string; 
  lat: number;
  lng: number;
  isOpen: boolean;
  type: StoreType; 
  availableProductIds: string[]; 
  upiId?: string; 
  ownerId?: string; 
  openingTime?: string; 
  closingTime?: string; 
  gstNumber?: string;
  bankDetails?: BankDetails;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  ads?: AdCampaign[];
}

export interface InventoryItem extends Product {
  inStock: boolean;
  stock: number; 
  storePrice: number; 
  isActive: boolean; 
  brandDetails?: Record<string, BrandInventoryInfo>; 
}

export interface CartItem extends Product {
  quantity: number;
  selectedBrand: string;     
  originalProductId: string; 
  storeId: string;
  storeName: string;
  storeType: Store['type'];
  costPrice?: number;
}

export type OrderMode = 'DELIVERY' | 'PICKUP';
export type DeliveryType = 'INSTANT' | 'SCHEDULED';
export type PaymentMethod = 'ONLINE' | 'DIRECT';

export interface SavedCard {
  id: string;
  type: 'VISA' | 'MASTERCARD' | 'UPI';
  last4?: string; 
  upiId?: string; 
  label: string;
}

export interface UserState {
  isAuthenticated: boolean;
  id?: string;
  phone: string;
  email?: string;
  name?: string;
  address?: string;
  location: { lat: number; lng: number } | null;
  savedCards?: SavedCard[];
  role?: 'customer' | 'store_owner' | 'delivery_partner' | 'admin' | 'super_admin';
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  gstNumber?: string;
  licenseNumber?: string;
  upiId?: string;
  bankDetails?: BankDetails;
}

export interface LocationResult {
  latitude: number;
  longitude: number;
}

export interface PaymentSplit {
  storeAmount: number;
  storeUpi?: string;
  handlingFee?: number; 
  adminUpi?: string;
  deliveryFee: number; 
  driverUpi?: string;
  transactionId?: string;
}

export interface Order {
  id: string;
  date: string;
  items: CartItem[];
  total: number;
  status: 'placed' | 'accepted' | 'packing' | 'ready' | 'on_way' | 'delivered' | 'picked_up' | 'cancelled' | 'rejected';
  paymentStatus: 'PAID' | 'PENDING';
  paymentMethod: PaymentMethod;
  paymentDeadline?: string; 
  mode: OrderMode;
  deliveryType: DeliveryType;
  scheduledTime?: string;
  deliveryAddress?: string;
  storeName: string;
  storeLocation?: { lat: number; lng: number };
  userLocation?: { lat: number; lng: number };
  splits?: PaymentSplit;
  customerName?: string;
  customerPhone?: string;
  transactionId?: string;
}

export interface Settlement {
  id: string;
  orderId: string;
  amount: number;
  fromUpi: string;
  transactionId: string;
  date: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
}
