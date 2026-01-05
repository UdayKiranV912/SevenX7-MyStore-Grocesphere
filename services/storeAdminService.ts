
import { supabase } from './supabaseClient';
import { Store, Order, InventoryItem, Payout, OrderStatus, MasterProduct, ProductCategory } from '../types';

export const getMyStore = async (ownerId: string): Promise<Store | null> => {
  const { data } = await supabase.from('stores').select('*').eq('owner_id', ownerId).single();
  return data as Store;
};

export const fetchOrders = async (storeId: string): Promise<Order[]> => {
  const { data } = await supabase
    .from('orders')
    .select('*, profiles!orders_customer_id_fkey(name, phone)')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });
  
  return (data || []).map((row: any) => ({
    ...row,
    customer_name: row.profiles?.name,
    customer_phone: row.profiles?.phone
  }));
};

export const fetchInventory = async (storeId: string): Promise<InventoryItem[]> => {
  const { data } = await supabase.from('store_inventory').select('*').eq('store_id', storeId).order('product_name', { ascending: true });
  return data || [];
};

export const fetchMasterProducts = async (type: string): Promise<MasterProduct[]> => {
  const { data } = await supabase.from('master_products').select('*').eq('store_type', type);
  return data || [];
};

export const fetchCategories = async (type: string): Promise<ProductCategory[]> => {
  const { data } = await supabase.from('product_categories').select('*').eq('store_type', type);
  return data || [];
};

export const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
  await supabase.from('orders').update({ status }).eq('id', orderId);
};

export const updateInventoryItem = async (itemId: string, updates: Partial<InventoryItem>) => {
  const { error } = await supabase.from('store_inventory').update(updates).eq('id', itemId);
  if (error) throw error;
};

export const addItemToInventory = async (storeId: string, item: Omit<InventoryItem, 'id' | 'store_id'>) => {
  const { data, error } = await supabase.from('store_inventory').insert({
    store_id: storeId,
    ...item
  }).select().single();
  if (error) throw error;
  return data;
};

export const fetchServiceFees = async (storeId: string) => {
  const { data } = await supabase.from('store_service_fees').select('*').eq('store_id', storeId).order('paid_at', { ascending: false });
  return data || [];
};

export const updateStoreProfile = async (storeId: string, updates: any) => {
  await supabase.from('stores').update(updates).eq('id', storeId);
};

export const getDemoData = () => {
    // Return mock data matching new status and types
    const store: Store = { id: 's1', owner_id: 'd1', store_name: 'Demo Mart', store_type: 'MINI_MART', emoji: '🏪', address: 'Bangalore', lat: 12, lng: 77, upi_id: 'd@upi', approved: true, active: true };
    const orders: Order[] = [{ id: 'o1', customer_id: 'c1', store_id: 's1', order_type: 'DELIVERY', status: 'PLACED', total_amount: 500, delivery_fee: 40, handling_fee: 10, payment_status: 'PAID', created_at: new Date().toISOString() }];
    const inventory: InventoryItem[] = [{ id: 'i1', store_id: 's1', master_product_id: 'm1', product_name: 'Milk', brand_name: 'Nandini', emoji: '🥛', mrp: 30, offer_price: 28, stock: 50, active: true }];
    return { store, orders, inventory, payouts: [] };
};
