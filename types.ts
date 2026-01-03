
export type StoreType = 'dairy' | 'vegetables' | 'mini_mart' | 'big_mart' | 'Vegetables/Fruits' | 'Daily Needs / Milk Booth' | 'General Store' | 'Local Mart';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type OrderStatus = 'placed' | 'accepted' | 'packing' | 'ready' | 'on_way' | 'delivered' | 'cancelled' | 'picked_up';
export type OrderMode = 'delivery' | 'pickup' | 'DELIVERY' | 'PICKUP';
export type DeliveryType = 'INSTANT' | 'SCHEDULED';
export type PaymentMethod = 'ONLINE' | 'DIRECT';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: 'store' | 'delivery' | 'admin' | 'store_owner' | 'delivery_partner';
  status: ApprovalStatus;
  fee_paid_until: string; // ISO date
  upi_id: string;
  is_active: boolean;
  address?: string;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountHolder: string;
}

export interface Store {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  store_type: StoreType;
  // Comment: Added 'type' and 'upiId' to support both snake_case (DB) and camelCase (UI) naming conventions
  type?: StoreType;
  upiId?: string;
  lat: number;
  lng: number;
  upi_id: string;
  // Comment: Added 'rating' and other optional metadata for map and list visualizations
  rating: number;
  isOpen?: boolean;
  availableProductIds?: string[];
  verificationStatus?: 'verified' | 'pending';
  openingTime?: string;
  closingTime?: string;
  gstNumber?: string;
  bankDetails?: BankDetails;
}

// Comment: Added missing Product interface required for inventory and cart management
export interface Product {
  id: string;
  name: string;
  price: number;
  emoji: string;
  category: string;
  brands?: Brand[];
  mrp?: number;
  description?: string;
  ingredients?: string;
  nutrition?: string;
  imageUrl?: string;
}

// Comment: Added missing Brand interface for multi-brand product selection
export interface Brand {
  name: string;
  price: number;
  imageUrl?: string;
}

// Comment: Added missing CartItem interface for order processing
export interface CartItem extends Product {
  quantity: number;
  originalProductId: string;
  selectedBrand: string;
  storeId: string;
  storeName: string;
  storeType: StoreType;
}

export interface Order {
  id: string;
  created_at: string;
  // Comment: Expanded Order interface with all properties used by MyOrders, CartSheet, and orderService
  date?: string;
  total_amount: number;
  total?: number;
  status: OrderStatus;
  mode: OrderMode;
  customer_name: string;
  customer_phone: string;
  delivery_lat?: number;
  delivery_lng?: number;
  delivery_partner_id?: string;
  items: CartItem[];
  userLocation?: { lat: number; lng: number };
  storeLocation?: { lat: number; lng: number };
  storeName?: string;
  transactionId?: string;
  splits?: any;
  paymentStatus?: string;
  paymentMethod?: PaymentMethod;
  deliveryType?: DeliveryType;
  scheduledTime?: string;
  deliveryAddress?: string;
  driverLocation?: { lat: number; lng: number };
  customerName?: string;
  customerPhone?: string;
}

// Comment: Added missing UserState interface for application authentication state
export interface UserState {
  isAuthenticated: boolean;
  id: string;
  phone: string;
  email: string;
  name: string;
  address: string;
  savedCards: SavedCard[];
  location: { lat: number; lng: number } | null;
  role: 'store_owner' | 'delivery_partner' | 'admin' | 'store' | 'delivery';
  upiId: string;
  verification_status: string;
  verificationStatus?: string;
  bankDetails?: Partial<BankDetails>;
}

// Comment: Added missing SavedCard interface for payment method management
export interface SavedCard {
  id: string;
  type: 'VISA' | 'MASTERCARD' | 'UPI';
  last4?: string;
  upiId?: string;
  label: string;
}

export interface Payout {
  id: string;
  amount: number;
  order_id: string;
  transaction_ref: string;
  created_at: string;
  status: 'SUCCESS' | 'PENDING';
}

export interface LiveLocation {
  user_id: string;
  lat: number;
  lng: number;
  updated_at: string;
}
