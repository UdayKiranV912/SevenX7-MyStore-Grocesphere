
import { supabase } from './supabaseClient';
import { Store, Order, InventoryItem, BrandInventoryInfo } from '../types';
import { INITIAL_PRODUCTS } from '../constants';

const DEMO_STORE_KEY = 'grocesphere_demo_store';
const DEMO_INVENTORY_KEY = 'grocesphere_demo_inventory';
const DEMO_ORDERS_KEY = 'grocesphere_demo_orders';

// Deterministic Demo Data
const FIXED_REVENUE_POINTS = [2450, 3120, 2100, 4580, 3890, 5200, 4900];

export const getMyStore = async (ownerId: string): Promise<Store | null> => {
  if (ownerId === 'demo-user') {
    const saved = localStorage.getItem(DEMO_STORE_KEY);
    if (saved) return JSON.parse(saved);
    
    const defaultStore: Store = {
      id: 'demo-store-id',
      name: 'Grocesphere Demo Mart',
      address: 'Live Community Hub',
      rating: 4.9,
      distance: '0 km',
      lat: 12.9716, 
      lng: 77.5946,
      isOpen: true,
      type: 'general',
      availableProductIds: INITIAL_PRODUCTS.slice(0, 20).map(p => p.id),
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

    const { data: invData } = await supabase
        .from('inventory')
        .select('product_id')
        .eq('store_id', data.id)
        .eq('in_stock', true);

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
      availableProductIds: invData ? invData.map((i: any) => i.product_id) : [],
      upiId: data.upi_id,
      ownerId: data.owner_id,
      gstNumber: data.gst_number || ''
    };
  } catch (e) {
    return null;
  }
};

export const updateStoreProfile = async (storeId: string, updates: Partial<Store>) => {
  if (storeId === 'demo-store-id') {
    const current = await getMyStore('demo-user');
    if (current) {
        const updated = { ...current, ...updates };
        localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(updated));
    }
    return;
  }

  const dbUpdates: any = {};
  if (updates.name) dbUpdates.name = updates.name;
  if (updates.address) dbUpdates.address = updates.address;
  if (updates.upiId) dbUpdates.upi_id = updates.upiId;
  if (updates.lat !== undefined) dbUpdates.lat = updates.lat;
  if (updates.lng !== undefined) dbUpdates.lng = updates.lng;
  if (updates.isOpen !== undefined) dbUpdates.is_open = updates.isOpen;
  if (updates.gstNumber !== undefined) dbUpdates.gst_number = updates.gstNumber;

  await supabase.from('stores').update(dbUpdates).eq('id', storeId);
};

export const getStoreInventory = async (storeId: string): Promise<InventoryItem[]> => {
  if (storeId === 'demo-store-id') {
      const saved = localStorage.getItem(DEMO_INVENTORY_KEY);
      if (saved) return JSON.parse(saved);

      // Return all products, but only mark some as active by default for the demo
      const defaultInv = INITIAL_PRODUCTS.map((p, idx) => ({
          ...p,
          inStock: idx < 30,
          stock: idx < 30 ? 50 : 0,
          storePrice: p.price,
          costPrice: Math.floor(p.price * 0.8),
          isActive: idx < 30 // First 30 items are already in store
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
      costPrice: dbItem ? (parseFloat(dbItem.cost_price || dbItem.price * 0.8)) : catalogItem.price * 0.8,
      mrp: dbItem?.mrp ? parseFloat(dbItem.mrp) : catalogItem.mrp || catalogItem.price,
      isActive: !!dbItem,
      brandDetails: dbItem?.brand_data || {} 
    };
  });

  const existingIds = new Set(INITIAL_PRODUCTS.map(p => p.id));
  const customInventory = (dbInv || [])
    .filter((i: any) => !existingIds.has(i.product_id))
    .map((i: any) => ({
      id: i.product_id,
      name: i.products?.name || 'Unknown',
      price: parseFloat(i.price),
      mrp: i.mrp ? parseFloat(i.mrp) : parseFloat(i.price),
      emoji: i.products?.emoji || '📦',
      category: i.products?.category || 'General',
      inStock: i.in_stock,
      stock: i.stock || 0,
      storePrice: parseFloat(i.price),
      costPrice: parseFloat(i.cost_price || i.price * 0.8),
      isActive: true,
      brandDetails: i.brand_data || {}
    }));

  return [...customInventory, ...catalogInventory];
};

export const updateInventoryItem = async (
    storeId: string, 
    productId: string, 
    price: number, 
    inStock: boolean, 
    stock: number, 
    brandDetails?: Record<string, BrandInventoryInfo>, 
    mrp?: number,
    costPrice?: number
) => {
  if (storeId === 'demo-store-id') {
    const inv = await getStoreInventory(storeId);
    const updated = inv.map(i => i.id === productId ? { ...i, storePrice: price, inStock, stock, mrp: mrp || price, costPrice: costPrice || i.costPrice, isActive: true } : i);
    localStorage.setItem(DEMO_INVENTORY_KEY, JSON.stringify(updated));
    return;
  }

  await supabase.from('inventory').upsert({
      store_id: storeId,
      product_id: productId,
      price: price,
      cost_price: costPrice,
      in_stock: inStock,
      stock: stock,
      mrp: mrp || price,
      brand_data: brandDetails 
  }, { onConflict: 'store_id, product_id' });
};

export const getIncomingOrders = async (storeId: string): Promise<Order[]> => {
  if (storeId === 'demo-store-id') {
      const demoOrders: Order[] = [];
      const now = new Date();
      
      FIXED_REVENUE_POINTS.forEach((rev, daysAgo) => {
          const orderDate = new Date();
          orderDate.setDate(now.getDate() - (6 - daysAgo));
          
          const customers = ['Rahul Sharma', 'Priya Kapoor', 'Amit Verma', 'Sonia Gupta', 'Vikram Singh'];
          const ordersPerDay = 3;
          
          for(let k = 0; k < ordersPerDay; k++) {
              const amount = Math.floor(rev / ordersPerDay);
              const isToday = daysAgo === 6;
              const status: Order['status'] = isToday && k === 0 ? 'placed' : isToday && k === 1 ? 'packing' : 'delivered';

              demoOrders.push({
                  id: `demo-order-${daysAgo}-${k}`,
                  date: orderDate.toISOString(),
                  items: [
                      { ...INITIAL_PRODUCTS[k % 10], quantity: 2, originalProductId: INITIAL_PRODUCTS[k % 10].id, storeId: 'demo-store-id', storeName: 'Demo Mart', storeType: 'general', selectedBrand: 'Generic', price: amount / 2, costPrice: (amount / 2) * 0.8 },
                      { ...INITIAL_PRODUCTS[(k + 5) % 10], quantity: 1, originalProductId: INITIAL_PRODUCTS[(k + 5) % 10].id, storeId: 'demo-store-id', storeName: 'Demo Mart', storeType: 'general', selectedBrand: 'Generic', price: amount / 2, costPrice: (amount / 2) * 0.8 }
                  ],
                  total: amount,
                  status: status,
                  paymentStatus: 'PAID',
                  mode: 'DELIVERY',
                  deliveryType: 'INSTANT',
                  storeName: 'Demo Mart',
                  customerName: customers[(daysAgo + k) % customers.length],
                  customerPhone: '9876543210'
              });
          }
      });

      return demoOrders.reverse();
  }

  const { data: orders } = await supabase.from('orders').select('*, profiles(full_name, phone_number)').eq('store_id', storeId).order('created_at', { ascending: false });
  return (orders || []).map((row: any) => ({
    id: row.id,
    date: row.created_at,
    items: row.items,
    total: parseFloat(row.total_amount),
    status: row.status as any,
    paymentStatus: 'PAID', 
    mode: row.type || 'DELIVERY',
    deliveryType: 'INSTANT',
    storeName: 'My Store',
    userLocation: { lat: row.delivery_lat, lng: row.delivery_lng },
    deliveryAddress: row.delivery_address,
    customerName: row.profiles?.full_name || 'Customer',
    customerPhone: row.profiles?.phone_number || ''
  }));
};

export const updateStoreOrderStatus = async (orderId: string, status: Order['status']) => {
    if (orderId.startsWith('demo-')) return;
    await supabase.from('orders').update({ status }).eq('id', orderId);
};

export const createCustomProduct = async (storeId: string, product: InventoryItem) => {
    if (storeId === 'demo-store-id') {
        const inv = await getStoreInventory(storeId);
        localStorage.setItem(DEMO_INVENTORY_KEY, JSON.stringify([product, ...inv]));
        return;
    }
    // Check if product exists in global table first
    const { data: existing } = await supabase.from('products').select('id').eq('id', product.id).single();
    if (!existing) {
        await supabase.from('products').insert({ 
            id: product.id, 
            name: product.name, 
            category: product.category, 
            emoji: product.emoji, 
            mrp: product.mrp || product.price 
        });
    }
    await updateInventoryItem(storeId, product.id, product.storePrice, product.inStock, product.stock, product.brandDetails, product.mrp, product.costPrice);
};
