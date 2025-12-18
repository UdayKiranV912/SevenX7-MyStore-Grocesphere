
export interface BrandOption {
  name: string;
  price: number; 
}

export interface BrandInventoryInfo {
  price: number; 
  mrp: number;   
  stock: number; 
  inStock: boolean;
}

export interface Product {
  id: string;
  name: string;
  price: number; 
  mrp?: number; 
  costPrice?: number; // New: For profit calculation
  emoji: string;
  category: string;
  description?: string;
  ingredients?: string;
  nutrition?: string;
  brands?: BrandOption[]; 
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
  type: 'general' | 'produce' | 'dairy'; 
  availableProductIds: string[]; 
  upiId?: string; 
  ownerId?: string; 
  openingTime?: string; 
  closingTime?: string; 
  gstNumber?: string; // New: Mandatory field
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
}

export type OrderMode = 'DELIVERY' | 'PICKUP';
export type DeliveryType = 'INSTANT' | 'SCHEDULED';

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
}

export interface Order {
  id: string;
  date: string;
  items: CartItem[];
  total: number;
  status: 'placed' | 'accepted' | 'packing' | 'ready' | 'on_way' | 'delivered' | 'picked_up' | 'cancelled' | 'rejected';
  paymentStatus: 'PAID' | 'PENDING';
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
}
