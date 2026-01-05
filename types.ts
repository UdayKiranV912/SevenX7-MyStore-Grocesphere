
export type StoreTypeCode = 'DAIRY' | 'VEG_FRUIT' | 'MINI_MART' | 'BIG_MART' | 'General Store' | 'Vegetables/Fruits' | 'Daily Needs / Milk Booth' | 'Local Mart' | 'Local Store' | 'mini_mart' | 'big_mart' | 'vegetables' | 'dairy';
export type StoreType = StoreTypeCode;
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type OrderStatus = 'PLACED' | 'CONFIRMED' | 'PACKING' | 'READY' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED' | 'placed' | 'packing' | 'ready' | 'on_way' | 'delivered' | 'cancelled' | 'picked_up';
export type OrderType = 'DELIVERY' | 'PICKUP' | 'delivery' | 'pickup';
export type OrderMode = OrderType;
export type DeliveryType = 'INSTANT' | 'SCHEDULED';
export type PaymentMethod = 'ONLINE' | 'DIRECT';

export interface BankDetails {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountHolder?: string;
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
  imageUrl?: string;
  mrp?: number;
}

export interface CartItem extends Product {
  originalProductId: string;
  quantity: number;
  selectedBrand: string;
  storeId: string;
  storeName: string;
  storeType: StoreTypeCode;
}

export interface UserState {
  isAuthenticated: boolean;
  id: string;
  phone: string;
  email: string;
  name: string;
  address: string;
  role: 'super_admin' | 'customer' | 'store' | 'delivery';
  upiId?: string;
  admin_approved: boolean;
  location?: { lat: number; lng: number };
  bankDetails?: BankDetails;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'super_admin' | 'customer' | 'store' | 'delivery';
  admin_approved: boolean;
  active: boolean;
  upi_id: string;
  created_at: string;
}

export interface Store {
  id: string;
  owner_id: string;
  store_name: string;
  name?: string;
  store_type: StoreTypeCode;
  type?: StoreTypeCode;
  emoji: string;
  address: string;
  lat: number;
  lng: number;
  upi_id: string;
  upiId?: string;
  approved: boolean;
  active: boolean;
  gst_number?: string;
  gstNumber?: string;
  rating: number;
  distance: string;
  isOpen: boolean;
  status: string;
  availableProductIds: string[];
  openingTime: string;
  closingTime: string;
  verificationStatus?: 'verified' | 'pending';
  bankDetails?: BankDetails;
}

export interface InventoryItem {
  id: string;
  store_id: string;
  master_product_id: string;
  product_name: string;
  brand_name: string;
  emoji: string;
  mrp: number;
  offer_price: number;
  stock: number;
  active: boolean;
}

export interface MasterProduct {
  id: string;
  store_type: StoreTypeCode;
  category_id: string;
  brand_name: string;
  product_name: string;
  emoji: string;
  unit: string;
}

export interface ProductCategory {
  id: string;
  store_type: StoreTypeCode;
  category_name: string;
  emoji: string;
}

export interface Order {
  id: string;
  customer_id: string;
  store_id: string;
  order_type: OrderType;
  status: OrderStatus;
  total_amount: number;
  delivery_fee: number;
  handling_fee: number;
  payment_status: 'PENDING' | 'PAID' | 'FAILED';
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  items: CartItem[];
  total: number;
  mode: OrderMode;
  userLocation?: { lat: number; lng: number };
  transactionId?: string;
  splits?: any;
  driverLocation?: { lat: number; lng: number };
  storeLocation?: { lat: number; lng: number };
  deliveryType?: DeliveryType;
  scheduledTime?: string;
  deliveryAddress?: string;
  storeName?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: string;
  date?: string;
}

export interface Payout {
  id: string;
  order_id: string;
  amount: number;
  transaction_id: string;
  status: string;
  created_at: string;
}

export interface LiveLocation {
  user_id: string;
  lat: number;
  lng: number;
  role: string;
  updated_at: string;
}
