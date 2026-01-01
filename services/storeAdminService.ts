
import { supabase } from './supabaseClient';
import { Store, Order, InventoryItem, BrandInventoryInfo, Settlement } from '../types';
import { INITIAL_PRODUCTS } from '../constants';

const DEMO_STORE_KEY = 'grocesphere_demo_store';
const DEMO_INVENTORY_KEY = 'grocesphere_demo_inventory';
const DEMO_ORDERS_KEY = 'grocesphere_orders';

export const getMyStore = async (ownerId: string): Promise<Store | null> => {
  if (ownerId === 'demo-user' || ownerId.includes('demo')) {
    const saved = localStorage.getItem(DEMO_STORE_KEY);
    if (saved) return JSON.parse(saved);
    
    const defaultStore: Store = {
      id: 'demo-store-id',
      name: 'Grocesphere Demo Mart',
      address: 'Indiranagar, Bengaluru',
      rating: 4.9,
      distance: '0 km',
      lat: 12.9716, 
      lng: 77.6410,
      isOpen: true,
      type: 'Local Mart',
      availableProductIds: INITIAL_PRODUCTS.slice(0, 30).map(p => p.id),
      upiId: 'merchant@upi',
      ownerId: ownerId,
      verificationStatus: 'verified'
    };
    localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(defaultStore));
    return defaultStore;
  }

  try {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('owner_id', ownerId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      address: data.address,
      rating: parseFloat(data.rating || '4.5'),
      distance: '', 
      lat: data.lat,
      lng: data.lng,
      isOpen: data.is_open,
      type: data.type as any,
      availableProductIds: [],
      upiId: data.upi_id,
      ownerId: data.owner_id,
      gstNumber: data.gst_number || '',
      bankDetails: data.bank_details,
      verificationStatus: data.verification_status || 'pending'
    };
  } catch (e) {
    return null;
  }
};

export const subscribeToStoreOrders = (storeId: string, onUpdate: () => void) => {
    return supabase
        .channel(`store-orders-${storeId}`)
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'orders', 
            filter: `store_id=eq.${storeId}` 
        }, () => onUpdate())
        .subscribe();
};

export const subscribeToStoreInventory = (storeId: string, onUpdate: () => void) => {
    return supabase
        .channel(`store-inventory-${storeId}`)
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'inventory', 
            filter: `store_id=eq.${storeId}` 
        }, () => onUpdate())
        .subscribe();
};

export const getIncomingOrders = async (storeId: string): Promise<Order[]> => {
  if (storeId === 'demo-store-id') {
      const saved = localStorage.getItem(DEMO_ORDERS_KEY);
      if (saved) return JSON.parse(saved);
      return [];
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('*, profiles(full_name, phone_number)')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  return (orders || []).map((row: any) => ({
    id: row.id, 
    date: row.created_at, 
    items: row.items, 
    total: parseFloat(row.total_amount), 
    status: row.status as any, 
    paymentStatus: row.payment_status || 'PAID', 
    paymentMethod: row.payment_method || 'ONLINE', 
    mode: row.type || 'DELIVERY', 
    deliveryType: 'INSTANT', 
    storeName: 'Partner Hub', 
    customerName: row.profiles?.full_name || 'Customer',
    customerPhone: row.profiles?.phone_number || '',
    userLocation: { lat: row.delivery_lat, lng: row.delivery_lng },
    driverLocation: row.driver_lat && row.driver_lng ? { lat: row.driver_lat, lng: row.driver_lng } : undefined
  }));
};

export const getStoreInventory = async (storeId: string): Promise<InventoryItem[]> => {
  if (storeId === 'demo-store-id') {
      const saved = localStorage.getItem(DEMO_INVENTORY_KEY);
      if (saved) return JSON.parse(saved);
      return [];
  }

  const { data: dbInv } = await supabase
    .from('inventory')
    .select('*, products(*)')
    .eq('store_id', storeId);

  return (dbInv || []).map((row: any) => ({
    ...row.products,
    inStock: row.in_stock,
    stock: row.stock || 0,
    storePrice: parseFloat(row.price),
    isActive: true,
    brandDetails: row.brand_data || {}
  }));
};

export const updateStoreOrderStatus = async (orderId: string, status: Order['status']) => {
    if (orderId.startsWith('demo-')) return;
    await supabase.from('orders').update({ status }).eq('id', orderId);
};

// Comment: Fixed updateInventoryItem signature to accept all 8 arguments passed from components/store/StoreApp.tsx
export const updateInventoryItem = async (
  storeId: string, 
  productId: string, 
  price: number, 
  inStock: boolean, 
  stock: number,
  brandData?: any,
  mrp?: number,
  costPrice?: number
) => {
  if (storeId === 'demo-store-id') return;
  await supabase.from('inventory').upsert({ 
    store_id: storeId, 
    product_id: productId, 
    price, 
    in_stock: inStock, 
    stock,
    brand_data: brandData,
    mrp: mrp,
    cost_price: costPrice
  }, { onConflict: 'store_id, product_id' });
};

export const createCustomProduct = async (storeId: string, product: InventoryItem) => {
    if (storeId === 'demo-store-id') return;
    
    // 1. Ensure product exists in global table
    await supabase.from('products').upsert({ 
        id: product.id, 
        name: product.name, 
        category: product.category, 
        emoji: product.emoji, 
        mrp: product.mrp || product.price 
    });

    // 2. Link to store inventory
    await supabase.from('inventory').insert({
        store_id: storeId,
        product_id: product.id,
        price: product.storePrice,
        stock: product.stock,
        in_stock: product.inStock
    });
};

export const getSettlements = async (storeId: string): Promise<Settlement[]> => {
    if (storeId === 'demo-store-id') return [];
    const { data } = await supabase
        .from('payment_splits')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

    return (data || []).map((row: any) => ({
        id: `STL-${row.id}`,
        orderId: row.order_id,
        amount: parseFloat(row.store_amount),
        fromUpi: row.admin_upi || 'admin@upi',
        transactionId: row.transaction_id || 'LOCAL-TXN',
        date: row.created_at,
        status: row.is_settled ? 'COMPLETED' : 'PENDING'
    }));
};

export const updateStoreProfile = async (storeId: string, updates: Partial<Store>) => {
    if (storeId === 'demo-store-id') return;
    const dbPayload: any = {};
    if (updates.name) dbPayload.name = updates.name;
    if (updates.address) dbPayload.address = updates.address;
    if (updates.type) dbPayload.type = updates.type;
    if (updates.upiId) dbPayload.upi_id = updates.upiId;
    if (updates.lat) dbPayload.lat = updates.lat;
    if (updates.lng) dbPayload.lng = updates.lng;
    
    await supabase.from('stores').update(dbPayload).eq('id', storeId);
};
