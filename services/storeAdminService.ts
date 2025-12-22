
import { supabase } from './supabaseClient';
import { Store, Order, InventoryItem, BrandInventoryInfo } from '../types';
import { INITIAL_PRODUCTS } from '../constants';

const DEMO_STORE_KEY = 'grocesphere_demo_store';
const DEMO_INVENTORY_KEY = 'grocesphere_demo_inventory';
const DEMO_ORDERS_KEY = 'grocesphere_orders';

export const getMyStore = async (ownerId: string): Promise<Store | null> => {
  if (ownerId === 'demo-user') {
    const saved = localStorage.getItem(DEMO_STORE_KEY);
    if (saved) return JSON.parse(saved);
    
    const defaultStore: Store = {
      id: 'demo-store-id',
      name: 'My store Grocesphere Demo Mart',
      address: 'Indiranagar, Bengaluru',
      rating: 4.9,
      distance: '0 km',
      lat: 12.9716, 
      lng: 77.5946,
      isOpen: true,
      type: 'Local Mart',
      availableProductIds: INITIAL_PRODUCTS.slice(0, 30).map(p => p.id),
      upiId: 'demo@upi',
      ownerId: 'demo-user',
      gstNumber: '29DEMO0000A1Z5'
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
      gstNumber: data.gst_number || ''
    };
  } catch (e) {
    return null;
  }
};

/**
 * Updates store profile information in both Demo (local) and Production (DB) environments.
 */
export const updateStoreProfile = async (storeId: string, updates: Partial<Store>) => {
  if (storeId === 'demo-store-id') {
    const saved = localStorage.getItem(DEMO_STORE_KEY);
    if (saved) {
      const store = JSON.parse(saved);
      const updated = { ...store, ...updates };
      localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(updated));
    }
    return;
  }
  
  const dbPayload: any = { 
    name: updates.name,
    address: updates.address,
    type: updates.type,
    gst_number: updates.gstNumber,
    lat: updates.lat,
    lng: updates.lng,
    is_open: updates.isOpen,
    upi_id: updates.upiId
  };
  
  const { error } = await supabase.from('stores').update(dbPayload).eq('id', storeId);
  if (error) throw error;
};

export const getStoreInventory = async (storeId: string): Promise<InventoryItem[]> => {
  if (storeId === 'demo-store-id') {
      const saved = localStorage.getItem(DEMO_INVENTORY_KEY);
      if (saved) return JSON.parse(saved);

      const defaultInv = INITIAL_PRODUCTS.map((p, idx) => ({
          ...p,
          inStock: idx < 30,
          stock: idx < 30 ? 50 : 0,
          storePrice: p.price,
          costPrice: Math.floor(p.price * 0.8),
          mrp: p.mrp || Math.floor(p.price * 1.2),
          isActive: idx < 30 
      }));
      localStorage.setItem(DEMO_INVENTORY_KEY, JSON.stringify(defaultInv));
      return defaultInv;
  }

  const { data: dbInv } = await supabase.from('inventory').select('*, products(*)').eq('store_id', storeId);
  const catalogInventory = INITIAL_PRODUCTS.map(catalogItem => {
    const dbItem = dbInv?.find((i: any) => i.product_id === catalogItem.id);
    return {
      ...catalogItem,
      inStock: dbItem ? dbItem.in_stock : false,
      stock: dbItem ? (dbItem.stock || 0) : 0,
      storePrice: dbItem ? parseFloat(dbItem.price) : catalogItem.price,
      costPrice: dbItem ? parseFloat(dbItem.cost_price || dbItem.price * 0.8) : catalogItem.price * 0.8,
      mrp: dbItem?.mrp ? parseFloat(dbItem.mrp) : catalogItem.mrp || catalogItem.price,
      isActive: !!dbItem,
      brandDetails: dbItem?.brand_data || {} 
    };
  });
  return catalogInventory;
};

export const updateInventoryItem = async (storeId: string, productId: string, price: number, inStock: boolean, stock: number, brandDetails?: Record<string, BrandInventoryInfo>, mrp?: number, costPrice?: number) => {
  if (storeId === 'demo-store-id') {
    const inv = await getStoreInventory(storeId);
    const updated = inv.map(i => i.id === productId ? { ...i, storePrice: price, inStock, stock, mrp: mrp || i.mrp || price, costPrice: costPrice || i.costPrice, isActive: true } : i);
    localStorage.setItem(DEMO_INVENTORY_KEY, JSON.stringify(updated));
    return;
  }
  await supabase.from('inventory').upsert({ store_id: storeId, product_id: productId, price: price, cost_price: costPrice, in_stock: inStock, stock: stock, mrp: mrp || price, brand_data: brandDetails }, { onConflict: 'store_id, product_id' });
};

export const getIncomingOrders = async (storeId: string): Promise<Order[]> => {
  if (storeId === 'demo-store-id') {
      const saved = localStorage.getItem(DEMO_ORDERS_KEY);
      if (saved) return JSON.parse(saved);

      const demoOrders: Order[] = [
          {
              id: 'demo-order-1',
              date: new Date().toISOString(),
              items: [{ ...INITIAL_PRODUCTS[0], quantity: 2, originalProductId: INITIAL_PRODUCTS[0].id, storeId: 'demo-store-id', storeName: 'Demo Mart', storeType: 'General Store', selectedBrand: 'Generic', price: 60 }],
              total: 120,
              status: 'placed',
              paymentStatus: 'PAID',
              paymentMethod: 'ONLINE',
              mode: 'DELIVERY',
              deliveryType: 'INSTANT',
              storeName: 'Demo Mart',
              customerName: 'Rahul Sharma'
          },
          {
              id: 'demo-order-2',
              date: new Date().toISOString(),
              items: [{ ...INITIAL_PRODUCTS[5], quantity: 1, originalProductId: INITIAL_PRODUCTS[5].id, storeId: 'demo-store-id', storeName: 'Demo Mart', storeType: 'General Store', selectedBrand: 'Generic', price: 40 }],
              total: 40,
              status: 'placed',
              paymentStatus: 'PENDING',
              paymentMethod: 'DIRECT',
              mode: 'PICKUP',
              deliveryType: 'INSTANT',
              storeName: 'Demo Mart',
              customerName: 'Priya Kapoor'
          }
      ];
      localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(demoOrders));
      return demoOrders;
  }

  const { data: orders } = await supabase.from('orders').select('*, profiles(full_name, phone_number)').eq('store_id', storeId).order('created_at', { ascending: false });
  return (orders || []).map((row: any) => ({
    id: row.id, date: row.created_at, items: row.items, total: parseFloat(row.total_amount), status: row.status as any, paymentStatus: row.payment_status || 'PAID', paymentMethod: row.payment_method || 'ONLINE', mode: row.type || 'DELIVERY', deliveryType: 'INSTANT', storeName: 'My store Grocesphere Mart', deliveryAddress: row.delivery_address, customerName: row.profiles?.full_name || 'Customer'
  }));
};

export const updateStoreOrderStatus = async (orderId: string, status: Order['status']) => {
    if (orderId.startsWith('demo-')) {
        const stored = localStorage.getItem(DEMO_ORDERS_KEY);
        if (stored) {
            const list = JSON.parse(stored);
            const updated = list.map((o: any) => o.id === orderId ? { ...o, status } : o);
            localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(updated));
        }
        return;
    }
    await supabase.from('orders').update({ status }).eq('id', orderId);
};

export const createCustomProduct = async (storeId: string, product: InventoryItem) => {
    if (storeId === 'demo-store-id') {
        const inv = await getStoreInventory(storeId);
        localStorage.setItem(DEMO_INVENTORY_KEY, JSON.stringify([product, ...inv]));
        return;
    }
    await supabase.from('products').upsert({ id: product.id, name: product.name, category: product.category, emoji: product.emoji, mrp: product.mrp || product.price });
    await updateInventoryItem(storeId, product.id, product.storePrice, product.inStock, product.stock, product.brandDetails, product.mrp, product.costPrice);
};
