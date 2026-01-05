
// Comment: Unified type definitions for the application
export type StoreType = 'dairy' | 'vegetables' | 'mini_mart' | 'big_mart' | 'Daily Needs / Milk Booth' | 'Vegetables/Fruits' | 'General Store' | 'Local Mart';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type OrderStatus = 'placed' | 'accepted' | 'packing' | 'ready' | 'on_way' | 'delivered' | 'picked_up' | 'cancelled';
export type OrderMode = 'delivery' | 'pickup';
export type DeliveryType = 'INSTANT' | 'SCHEDULED';
export type PaymentMethod = 'ONLINE' | 'DIRECT';

export interface UserState {
  isAuthenticated: boolean;
  id: string;
  phone: string;
  email: string;
  name: string;
  address: string;
  savedCards: SavedCard[];
  location: { lat: number; lng: number } | null;
  role: 'customer' | 'store_owner' | 'delivery_partner' | 'admin';
  upiId?: string;
  verification_status?: string;
  verificationStatus?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountHolder: string;
  };
}

export interface SavedCard {
    id: string;
    type: 'VISA' | 'MASTERCARD' | 'UPI';
    last4?: string;
    upiId?: string;
    label: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: 'store' | 'customer' | 'delivery' | 'admin';
  status: ApprovalStatus;
  fee_paid_until: string; // ISO date for 15-day check
  upi_id: string;
  is_active: boolean;
  approval_status?: string;
}

export interface Store {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  store_type: StoreType;
  lat: number;
  lng: number;
  upi_id: string;
  status: 'active' | 'inactive';
  rating: number;
  distance: string;
  isOpen: boolean;
  availableProductIds: string[];
  verificationStatus?: string;
  openingTime?: string;
  closingTime?: string;
  gstNumber?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountHolder: string;
  };
}

export interface Product {
  id: string;
  name: string;
  price: number;
  emoji: string;
  category: string;
  brands?: { name: string; price: number; imageUrl?: string }[];
  description?: string;
  ingredients?: string;
  nutrition?: string;
  mrp?: number;
  imageUrl?: string;
}

// Comment: Added missing InventoryItem interface
export interface InventoryItem {
  id: string;
  store_id: string;
  name: string;
  category: string;
  emoji: string;
  mrp: number;
  offer_price: number;
  stock: number;
  active: boolean;
}

export interface CartItem extends Product {
    originalProductId: string;
    quantity: number;
    selectedBrand: string;
    storeId: string;
    storeName: string;
    storeType: string;
}

export interface Order {
  id: string;
  created_at: string;
  date: string;
  store_id: string;
  customer_id: string;
  total_amount: number;
  total: number;
  status: OrderStatus;
  mode: OrderMode;
  delivery_lat?: number;
  delivery_lng?: number;
  delivery_partner_id?: string;
  customer_name?: string;
  customer_phone?: string;
  items: CartItem[];
  paymentStatus?: string;
  paymentMethod?: PaymentMethod;
  deliveryType?: string;
  scheduledTime?: string;
  deliveryAddress?: string;
  storeName?: string;
  storeLocation?: { lat: number; lng: number };
  userLocation?: { lat: number; lng: number };
  transactionId?: string;
  splits?: any;
  driverLocation?: { lat: number; lng: number };
}

export interface Payout {
  id: string;
  order_id: string;
  store_amount: number;
  amount?: number; // Added for compatibility with storeAdminService
  transaction_ref: string;
  created_at: string;
  settled: boolean;
}

export interface LiveLocation {
  user_id: string;
  lat: number;
  lng: number;
  updated_at: string;
}
