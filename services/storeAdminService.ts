
import { supabase } from './supabaseClient';
import { Store, Order, InventoryItem, BrandInventoryInfo, Settlement } from '../types';
import { INITIAL_PRODUCTS } from '../constants';

const DEMO_STORE_KEY = 'grocesphere_demo_store';
const DEMO_INVENTORY_KEY = 'grocesphere_demo_inventory';
const DEMO_ORDERS_KEY = 'grocesphere_orders';
const DEMO_SETTLEMENTS_KEY = 'grocesphere_settlements';

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
      upiId: 'merchant@okgroce',
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
      rating: 4.5, // Fixed mock rating as it's not in the SQL provided
      distance: '', 
      lat: data.lat,
      lng: data.lng,
      isOpen: data.approved, // Maps to approved in SQL
      type: (data.category as any) || 'Local Mart', // category used for store type
      availableProductIds: [],
      upiId: data.upi_id,
      ownerId: data.owner_id,
      gstNumber: data.gst_number || '',
      verificationStatus: data.approved ? 'verified' : 'pending'
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
      
      const mockOrders: Order[] = [
        {
          id: 'demo-ord-1',
          date: new Date().toISOString(),
          items: [{ ...INITIAL_PRODUCTS[0], quantity: 2, selectedBrand: 'Generic', originalProductId: '1', storeId, storeName: 'Demo Mart', storeType: 'Local Mart' }],
          total: 120,
          status: 'packing',
          paymentStatus: 'PAID',
          paymentMethod: 'ONLINE',
          mode: 'DELIVERY',
          deliveryType: 'INSTANT',
          storeName: 'Grocesphere Demo Mart',
          customerName: 'Rahul Khanna',
          userLocation: { lat: 12.9780, lng: 77.6450 },
          storeLocation: { lat: 12.9716, lng: 77.6410 }
        }
      ];
      localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(mockOrders));
      return mockOrders;
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('*, profiles!orders_customer_id_fkey(full_name, phone)')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  return (orders || []).map((row: any) => ({
    id: row.id, 
    date: row.created_at, 
    items: [], // Items need to be fetched from order_items
    total: parseFloat(row.total_amount), 
    status: row.status as any, 
    paymentStatus: row.payment_status === 'paid' ? 'PAID' : 'PENDING', 
    paymentMethod: 'ONLINE', 
    mode: row.mode?.toUpperCase() || 'DELIVERY', 
    deliveryType: 'INSTANT', 
    storeName: 'Partner Hub', 
    customerName: row.profiles?.full_name || 'Customer',
    userLocation: { lat: row.delivery_lat, lng: row.delivery_lng }
  }));
};

export const getStoreInventory = async (storeId: string): Promise<InventoryItem[]> => {
  if (storeId === 'demo-store-id') {
      const saved = localStorage.getItem(DEMO_INVENTORY_KEY);
      if (saved) return JSON.parse(saved);
      
      const mockInventory: InventoryItem[] = INITIAL_PRODUCTS.slice(0, 15).map(p => ({
          ...p,
          inStock: true,
          stock: 50,
          storePrice: p.price,
          isActive: true
      }));
      localStorage.setItem(DEMO_INVENTORY_KEY, JSON.stringify(mockInventory));
      return mockInventory;
  }

  const { data: dbInv } = await supabase
    .from('inventory')
    .select('*, products(*)')
    .eq('store_id', storeId);

  return (dbInv || []).map((row: any) => ({
    ...row.products,
    inStock: row.active,
    stock: row.stock || 0,
    storePrice: parseFloat(row.price),
    isActive: row.active
  }));
};

export const updateStoreOrderStatus = async (orderId: string, status: Order['status']) => {
    if (orderId.startsWith('demo-')) {
        const saved = localStorage.getItem(DEMO_ORDERS_KEY);
        if (saved) {
            const orders = JSON.parse(saved);
            const updated = orders.map((o: any) => o.id === orderId ? { ...o, status } : o);
            localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(updated));
        }
        return;
    }
    // Mapping app statuses to SQL enum order_status: 
    // placed, accepted, packed, ready, on_way, delivered, cancelled
    let sqlStatus = status;
    if (status === 'packing') sqlStatus = 'packed' as any;
    
    await supabase.from('orders').update({ status: sqlStatus }).eq('id', orderId);
};

export const getSettlements = async (storeId: string): Promise<Settlement[]> => {
  if (storeId === 'demo-store-id') {
      const saved = localStorage.getItem(DEMO_SETTLEMENTS_KEY);
      if (saved) return JSON.parse(saved);
      const mock = [{ id: 'S-1', orderId: 'O-1', amount: 100, fromUpi: 'admin@upi', transactionId: 'TXN-1', date: new Date().toISOString(), status: 'COMPLETED' as any }];
      localStorage.setItem(DEMO_SETTLEMENTS_KEY, JSON.stringify(mock));
      return mock;
  }

  // SQL schema uses 'payments' table
  const { data: storeInfo } = await supabase.from('stores').select('upi_id').eq('id', storeId).single();
  const upi = storeInfo?.upi_id || '';

  const { data } = await supabase.from('payments').select('*').eq('store_upi', upi);
  return (data || []).map((row: any) => ({
      id: row.id,
      orderId: row.order_id,
      amount: parseFloat(row.store_amount),
      fromUpi: row.admin_upi || 'admin@upi',
      transactionId: 'REF-' + row.id.slice(0, 8),
      date: row.created_at,
      status: row.settled ? 'COMPLETED' : 'PENDING'
  }));
};

export const updateInventoryItem = async (storeId: string, productId: string, price: number, inStock: boolean, stock: number) => {
  if (storeId === 'demo-store-id') {
      const saved = localStorage.getItem(DEMO_INVENTORY_KEY);
      if (saved) {
          const inv = JSON.parse(saved);
          const updated = inv.map((i: any) => i.id === productId ? { ...i, storePrice: price, inStock, stock } : i);
          localStorage.setItem(DEMO_INVENTORY_KEY, JSON.stringify(updated));
      }
      return;
  }
  await supabase.from('inventory').upsert({ 
    store_id: storeId, 
    product_id: productId, 
    price, 
    active: inStock, 
    stock 
  }, { onConflict: 'store_id, product_id' });
};

export const createCustomProduct = async (storeId: string, product: InventoryItem) => {
    if (storeId === 'demo-store-id') {
        const saved = localStorage.getItem(DEMO_INVENTORY_KEY);
        const inv = saved ? JSON.parse(saved) : [];
        inv.push(product);
        localStorage.setItem(DEMO_INVENTORY_KEY, JSON.stringify(inv));
        return;
    }
    const { data: pData } = await supabase.from('products').insert({
        id: product.id,
        name: product.name,
        category: product.category,
        emoji: product.emoji,
        mrp: product.mrp || product.price
    }).select().single();

    if (pData) {
        await supabase.from('inventory').insert({
            store_id: storeId,
            product_id: pData.id,
            price: product.storePrice,
            stock: product.stock,
            active: true
        });
    }
};

export const updateStoreProfile = async (storeId: string, updates: Partial<Store>) => {
    if (storeId === 'demo-store-id') {
        const saved = localStorage.getItem(DEMO_STORE_KEY);
        if (saved) {
            const store = JSON.parse(saved);
            localStorage.setItem(DEMO_STORE_KEY, JSON.stringify({ ...store, ...updates }));
        }
        return;
    }
    const dbPayload: any = {};
    if (updates.name) dbPayload.name = updates.name;
    if (updates.address) dbPayload.address = updates.address;
    if (updates.type) dbPayload.category = updates.type; // category column in SQL
    if (updates.upiId) dbPayload.upi_id = updates.upiId;
    if (updates.lat) dbPayload.lat = updates.lat;
    if (updates.lng) dbPayload.lng = updates.lng;
    
    await supabase.from('stores').update(dbPayload).eq('id', storeId);
};
