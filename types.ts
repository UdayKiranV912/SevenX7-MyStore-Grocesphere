
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
  offerPrice?: number;
  emoji: string;
  imageUrl?: string;
  category: string;
  description?: string;
  // Added properties to resolve errors in constants.ts and geminiService.ts
  brands?: BrandOption[];
  ingredients?: string;
  nutrition?: string;
}

// Backend Enum: 'dairy', 'vegetables', 'mini_mart', 'big_mart'
// Expanded with human-readable types used in the frontend and OSM mapping
export type StoreType = 'dairy' | 'vegetables' | 'mini_mart' | 'big_mart' | 'Daily Needs / Milk Booth' | 'Vegetables/Fruits' | 'General Store' | 'Local Mart';

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
  upiId?: string; 
  ownerId?: string; 
  verificationStatus: 'pending' | 'verified' | 'rejected';
  serviceFeePaidUntil?: string; // 15-day service fee check
  // Added properties for UserProfile.tsx
  gstNumber?: string;
  bankDetails?: any;
}

export interface InventoryItem extends Product {
  inStock: boolean;
  stock: number; 
  storePrice: number; 
  isActive: boolean; 
}

export type OrderMode = 'delivery' | 'pickup' | 'DELIVERY' | 'PICKUP';
export type OrderStatus = 'placed' | 'accepted' | 'packed' | 'ready' | 'on_way' | 'delivered' | 'cancelled' | 'packing' | 'picked_up';

export interface SavedCard {
    id: string;
    type: 'VISA' | 'MASTERCARD' | 'UPI';
    last4?: string;
    upiId?: string;
    label: string;
}

export interface UserState {
  isAuthenticated: boolean;
  isDemo?: boolean;
  id?: string;
  phone: string;
  email?: string;
  name?: string;
  address?: string;
  location: { lat: number; lng: number } | null;
  role?: 'customer' | 'store' | 'delivery' | 'admin' | 'super_admin' | 'store_owner' | 'delivery_partner';
  verification_status?: 'pending' | 'verified' | 'rejected';
  // Added for compatibility with userService.ts and login logic
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  upiId?: string;
  savedCards?: SavedCard[];
  bankDetails?: any;
}

// Types for Cart and Payments used in CartSheet and CustomerApp
export type DeliveryType = 'INSTANT' | 'SCHEDULED';
export type PaymentMethod = 'ONLINE' | 'DIRECT';

export interface CartItem extends Product {
  quantity: number;
  storeId: string;
  storeName: string;
  storeType: StoreType;
  originalProductId: string;
  selectedBrand?: string;
}

export interface Order {
  id: string;
  date: string;
  items: any[];
  total: number;
  status: OrderStatus;
  paymentStatus: 'PAID' | 'PENDING';
  paymentMethod?: PaymentMethod;
  mode: OrderMode;
  storeName: string;
  customerName?: string;
  customerPhone?: string;
  deliveryPartnerId?: string;
  storeLocation?: { lat: number; lng: number };
  userLocation?: { lat: number; lng: number };
  driverLocation?: { lat: number; lng: number };
  transactionId?: string;
  // Added properties for MyOrders.tsx and order saving logic
  deliveryAddress?: string;
  scheduledTime?: string;
  splits?: any;
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
