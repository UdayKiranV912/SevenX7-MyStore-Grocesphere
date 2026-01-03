
import { supabase } from './supabaseClient';
import { Store, Order, InventoryItem, Payout, Profile } from '../types';

const MOCK_ORDERS: Order[] = [
  { id: 'ORD-7712', created_at: new Date().toISOString(), total_amount: 450, status: 'placed', mode: 'delivery', customer_name: 'Rahul Sharma', customer_phone: '9876543210', delivery_lat: 12.9716, delivery_lng: 77.5946, items: [], total: 450, date: new Date().toISOString() },
  { id: 'ORD-8821', created_at: new Date().toISOString(), total_amount: 120, status: 'packing', mode: 'pickup', customer_name: 'Anjali Gupta', customer_phone: '9988776655', items: [], total: 120, date: new Date().toISOString() }
];

const MOCK_INVENTORY: InventoryItem[] = [
  { id: '1', name: 'Fresh Milk 1L', category: 'Dairy', emoji: '🥛', mrp: 60, offer_price: 54, stock: 24, is_active: true },
  { id: '2', name: 'Organic Spinach', category: 'Vegetables & Fruits', emoji: '🥬', mrp: 30, offer_price: 25, stock: 15, is_active: true }
];

export const getStoreProfile = async (userId: string, isDemo: boolean): Promise<Profile | null> => {
  if (isDemo) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    return {
      id: 'demo-id',
      email: 'merchant@demo.com',
      full_name: 'Demo Merchant',
      phone: '9999988888',
      role: 'store',
      status: 'approved',
      fee_paid_until: futureDate.toISOString(),
      upi_id: 'merchant@okaxis',
      is_active: true
    };
  }
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return data;
};

// Comment: Added missing getMyStore method for UserProfile.tsx and other business contexts
export const getMyStore = async (userId: string): Promise<Store | null> => {
  if (userId.includes('demo')) {
    return {
      id: 's1',
      owner_id: userId,
      name: 'Demo Local Mart',
      address: 'Indiranagar, Bangalore',
      store_type: 'mini_mart',
      type: 'General Store',
      lat: 12.9716,
      lng: 77.6410,
      upi_id: 'merchant@upi',
      upiId: 'merchant@upi',
      rating: 4.5
    } as Store;
  }
  const { data, error } = await supabase.from('stores').select('*').eq('owner_id', userId).single();
  if (error || !data) return null;
  return {
    ...data,
    type: data.store_type === 'vegetables' ? 'Vegetables/Fruits' : data.store_type === 'dairy' ? 'Daily Needs / Milk Booth' : 'General Store',
    upiId: data.upi_id
  } as Store;
};

// Comment: Added missing updateStoreProfile method for profile editing functionality
export const updateStoreProfile = async (storeId: string, updates: Partial<Store>) => {
  if (storeId.includes('demo') || storeId === 's1') return;
  const { error } = await supabase.from('stores').update(updates).eq('id', storeId);
  if (error) throw error;
};

export const fetchStoreData = async (storeId: string, isDemo: boolean) => {
  if (isDemo) {
    return {
      store: { id: 's1', name: 'Demo Local Mart', address: 'Indiranagar, Bangalore', store_type: 'mini_mart', type: 'General Store', lat: 12.9716, lng: 77.6410, upi_id: 'merchant@upi', upiId: 'merchant@upi', rating: 4.5 } as Store,
      orders: MOCK_ORDERS,
      inventory: MOCK_INVENTORY,
      payouts: [{ id: 'p1', amount: 5000, order_id: 'multiple', transaction_ref: 'TXN99128', created_at: new Date().toISOString(), status: 'SUCCESS' }] as Payout[]
    };
  }

  const [s, o, i, p] = await Promise.all([
    supabase.from('stores').select('*').eq('id', storeId).single(),
    supabase.from('orders').select('*').eq('store_id', storeId).order('created_at', { ascending: false }),
    supabase.from('inventory').select('*').eq('store_id', storeId),
    supabase.from('payments').select('*').eq('store_id', storeId)
  ]);

  return { store: s.data, orders: o.data || [], inventory: i.data || [], payouts: p.data || [] };
};

export const updateOrderStatus = async (orderId: string, status: Order['status'], isDemo: boolean) => {
  if (isDemo) return;
  await supabase.from('orders').update({ status }).eq('id', orderId);
};

export const updateStock = async (itemId: string, stock: number, isDemo: boolean) => {
  if (isDemo) return;
  await supabase.from('inventory').update({ stock }).eq('id', itemId);
};

export const subscribeToOrders = (storeId: string, callback: (order: Order) => void) => {
  return supabase.channel(`orders-${storeId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` }, 
    payload => callback(payload.new as Order))
    .subscribe();
};
