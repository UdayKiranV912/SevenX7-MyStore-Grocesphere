
import { supabase } from './supabaseClient';
import { Store, Order, InventoryItem, Settlement } from '../types';
import { INITIAL_PRODUCTS } from '../constants';

const DEMO_STORE_KEY = 'grocesphere_demo_store';
const DEMO_INVENTORY_KEY = 'grocesphere_demo_inventory';
const DEMO_ORDERS_KEY = 'grocesphere_demo_orders';
const DEMO_SETTLEMENTS_KEY = 'grocesphere_demo_settlements';

const initDemoData = () => {
  if (!localStorage.getItem(DEMO_STORE_KEY)) {
    const defaultStore: Store = {
      id: 'demo-store-id',
      name: 'Grocesphere Demo Mart',
      address: 'Indiranagar, Bengaluru',
      rating: 4.9,
      distance: '0.2 km',
      lat: 12.9716, 
      lng: 77.6410,
      isOpen: true,
      type: 'mini_mart',
      upiId: 'merchant@okgroce',
      ownerId: 'demo-store_owner',
      verificationStatus: 'verified'
    };
    localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(defaultStore));
  }
  if (!localStorage.getItem(DEMO_INVENTORY_KEY)) {
    const mockInventory: InventoryItem[] = INITIAL_PRODUCTS.slice(0, 15).map(p => ({
      ...p,
      inStock: true,
      stock: 50,
      storePrice: p.price,
      offerPrice: p.price - 5,
      isActive: true,
      mrp: p.price + 10
    }));
    localStorage.setItem(DEMO_INVENTORY_KEY, JSON.stringify(mockInventory));
  }
};

export const getMyStore = async (ownerId: string): Promise<Store | null> => {
  if (ownerId.includes('demo')) {
    initDemoData();
    return JSON.parse(localStorage.getItem(DEMO_STORE_KEY) || '{}');
  }
  const { data, error } = await supabase.from('stores').select('*').eq('owner_id', ownerId).single();
  if (error || !data) return null;
  return {
    ...data,
    isOpen: data.approved,
    type: data.store_type,
    verificationStatus: data.approved ? 'verified' : 'pending'
  };
};

export const getStoreInventory = async (storeId: string): Promise<InventoryItem[]> => {
  if (storeId === 'demo-store-id') return JSON.parse(localStorage.getItem(DEMO_INVENTORY_KEY) || '[]');
  const { data } = await supabase.from('inventory').select('*, products(*)').eq('store_id', storeId);
  return (data || []).map((row: any) => ({
    ...row.products,
    inStock: row.active,
    stock: row.stock || 0,
    storePrice: parseFloat(row.price),
    offerPrice: parseFloat(row.offer_price || row.price),
    isActive: row.active
  }));
};

export const getIncomingOrders = async (storeId: string): Promise<Order[]> => {
  if (storeId === 'demo-store-id') return JSON.parse(localStorage.getItem(DEMO_ORDERS_KEY) || '[]');
  const { data } = await supabase.from('orders').select('*, profiles!orders_customer_id_fkey(full_name, phone)').eq('store_id', storeId).order('created_at', { ascending: false });
  return (data || []).map((row: any) => ({
    id: row.id, 
    date: row.created_at, 
    items: [], 
    total: parseFloat(row.total_amount), 
    status: row.status, 
    paymentStatus: row.payment_status === 'paid' ? 'PAID' : 'PENDING', 
    mode: row.mode, 
    storeName: 'Merchant Hub', 
    customerName: row.profiles?.full_name,
    customerPhone: row.profiles?.phone,
    deliveryPartnerId: row.delivery_partner_id,
    userLocation: { lat: row.delivery_lat, lng: row.delivery_lng }
  }));
};

export const assignDeliveryPartner = async (orderId: string, partnerId: string) => {
    if (orderId.includes('demo')) return;
    await supabase.from('orders').update({ delivery_partner_id: partnerId, status: 'accepted' }).eq('id', orderId);
};

export const updateStoreOrderStatus = async (orderId: string, status: string) => {
    if (orderId.includes('demo')) {
        const orders = JSON.parse(localStorage.getItem(DEMO_ORDERS_KEY) || '[]');
        const updated = orders.map((o: any) => o.id === orderId ? { ...o, status } : o);
        localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(updated));
        return;
    }
    await supabase.from('orders').update({ status }).eq('id', orderId);
};

export const updateInventoryItem = async (storeId: string, productId: string, price: number, offerPrice: number, stock: number, active: boolean) => {
  if (storeId === 'demo-store-id') {
      const inv = JSON.parse(localStorage.getItem(DEMO_INVENTORY_KEY) || '[]');
      const updated = inv.map((i: any) => i.id === productId ? { ...i, storePrice: price, offerPrice, stock, inStock: active, isActive: active } : i);
      localStorage.setItem(DEMO_INVENTORY_KEY, JSON.stringify(updated));
      return;
  }
  await supabase.from('inventory').upsert({ store_id: storeId, product_id: productId, price, offer_price: offerPrice, stock, active }, { onConflict: 'store_id, product_id' });
};

export const createCustomProduct = async (storeId: string, item: any) => {
    if (storeId === 'demo-store-id') {
        const inv = JSON.parse(localStorage.getItem(DEMO_INVENTORY_KEY) || '[]');
        inv.push(item);
        localStorage.setItem(DEMO_INVENTORY_KEY, JSON.stringify(inv));
        return;
    }
    const { data: p } = await supabase.from('products').insert({ name: item.name, emoji: item.emoji, category: item.category }).select().single();
    if (p) await supabase.from('inventory').insert({ store_id: storeId, product_id: p.id, price: item.price, offer_price: item.offerPrice, stock: item.stock, active: true });
};

export const subscribeToStoreOrders = (storeId: string, onUpdate: () => void) => {
    if (storeId.includes('demo')) return { unsubscribe: () => {} };
    return supabase.channel(`store-orders-${storeId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` }, () => onUpdate()).subscribe();
};

export const subscribeToStoreInventory = (storeId: string, onUpdate: () => void) => {
    if (storeId.includes('demo')) return { unsubscribe: () => {} };
    return supabase.channel(`store-inv-${storeId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'inventory', filter: `store_id=eq.${storeId}` }, () => onUpdate()).subscribe();
};

export const updateStoreProfile = async (storeId: string, updates: any) => {
    if (storeId === 'demo-store-id') {
        const s = JSON.parse(localStorage.getItem(DEMO_STORE_KEY) || '{}');
        localStorage.setItem(DEMO_STORE_KEY, JSON.stringify({ ...s, ...updates }));
        return;
    }
    const dbPayload: any = {};
    if (updates.name) dbPayload.name = updates.name;
    if (updates.address) dbPayload.address = updates.address;
    if (updates.lat) dbPayload.lat = updates.lat;
    if (updates.lng) dbPayload.lng = updates.lng;
    if (updates.type) dbPayload.store_type = updates.type;
    await supabase.from('stores').update(dbPayload).eq('id', storeId);
};

export const getSettlements = async (storeId: string): Promise<Settlement[]> => {
    if (storeId === 'demo-store-id') return JSON.parse(localStorage.getItem(DEMO_SETTLEMENTS_KEY) || '[]');
    const { data } = await supabase.from('payments').select('*').eq('order_id', storeId); // Simplified join
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
