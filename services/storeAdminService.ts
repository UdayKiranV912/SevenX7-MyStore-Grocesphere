
import { supabase } from './supabaseClient';
import { Store, Order, InventoryItem, Payout, Profile, OrderStatus } from '../types';

export const getMyStore = async (ownerId: string): Promise<Store | null> => {
  const { data } = await supabase.from('stores').select('*').eq('owner_id', ownerId).single();
  return data as Store;
};

export const fetchOrders = async (storeId: string): Promise<Order[]> => {
  const { data } = await supabase
    .from('orders')
    .select('*, profiles(full_name, phone)')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });
  
  return (data || []).map((row: any) => ({
    ...row,
    customer_name: row.profiles?.full_name,
    customer_phone: row.profiles?.phone
  }));
};

export const fetchInventory = async (storeId: string): Promise<InventoryItem[]> => {
  const { data } = await supabase.from('inventory').select('*').eq('store_id', storeId).order('category', { ascending: true });
  return data || [];
};

export const fetchPayouts = async (upiId: string): Promise<Payout[]> => {
  const { data } = await supabase.from('payments').select('*').eq('store_upi', upiId).order('created_at', { ascending: false });
  return data || [];
};

export const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
  await supabase.from('orders').update({ status }).eq('id', orderId);
};

export const updateInventoryItem = async (itemId: string, updates: Partial<InventoryItem>) => {
  const { error } = await supabase.from('inventory').update(updates).eq('id', itemId);
  if (error) throw error;
};

export const addItemToInventory = async (storeId: string, item: Omit<InventoryItem, 'id' | 'store_id'>) => {
  const { data, error } = await supabase.from('inventory').insert({
    store_id: storeId,
    ...item
  }).select().single();
  if (error) throw error;
  return data;
};

export const updateStoreProfile = async (storeId: string, updates: any) => {
  await supabase.from('stores').update(updates).eq('id', storeId);
};

// --- DEMO DATA GENERATORS ---
export const getDemoData = () => {
  const store: Store = { 
    id: 's1', 
    owner_id: 'demo', 
    name: 'Demo Local Mart', 
    address: 'Indiranagar, Bangalore', 
    store_type: 'mini_mart', 
    lat: 12.9716, 
    lng: 77.6410, 
    upi_id: 'demo@okaxis', 
    status: 'active',
    rating: 4.8,
    distance: '0.5 km',
    isOpen: true,
    availableProductIds: []
  };
  
  const orders: Order[] = [
    { id: 'ORD-7712', created_at: new Date().toISOString(), date: new Date().toISOString(), store_id: 's1', customer_id: 'c1', total_amount: 450, total: 450, status: 'placed', mode: 'delivery', customer_name: 'Rahul Sharma', customer_phone: '9876543210', delivery_lat: 12.9716, delivery_lng: 77.5946, items: [] },
    { id: 'ORD-8821', created_at: new Date().toISOString(), date: new Date().toISOString(), store_id: 's1', customer_id: 'c2', total_amount: 120, total: 120, status: 'packing', mode: 'pickup', customer_name: 'Anjali Gupta', customer_phone: '9988776655', items: [] }
  ];

  const inventory: InventoryItem[] = [
    { id: '1', store_id: 's1', name: 'Fresh Milk 1L', category: 'Dairy', emoji: '🥛', mrp: 60, offer_price: 54, stock: 24, active: true },
    { id: '2', store_id: 's1', name: 'Organic Spinach', category: 'Vegetables & Fruits', emoji: '🥬', mrp: 30, offer_price: 25, stock: 15, active: true },
    { id: '3', store_id: 's1', name: 'Basmati Rice 5kg', category: 'Mini Mart', emoji: '🏪', mrp: 600, offer_price: 550, stock: 10, active: true }
  ];

  const payouts: Payout[] = [
    { id: 'p1', store_amount: 5000, amount: 5000, order_id: 'multiple', transaction_ref: 'TXN991283', created_at: new Date().toISOString(), settled: true }
  ];

  return { store, orders, inventory, payouts };
};
