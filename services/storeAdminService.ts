
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
      
      const mockOrders: Order[] = [
        {
          id: 'demo-ord-live-1',
          date: new Date().toISOString(),
          items: [
            { ...INITIAL_PRODUCTS[0], quantity: 2, selectedBrand: 'Generic', originalProductId: '1', storeId, storeName: 'Demo Mart', storeType: 'Local Mart' }
          ],
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
        },
        {
            id: 'demo-ord-live-2',
            date: new Date(Date.now() - 3600000).toISOString(),
            items: [
              { ...INITIAL_PRODUCTS[5], quantity: 1, selectedBrand: 'Generic', originalProductId: '6', storeId, storeName: 'Demo Mart', storeType: 'Local Mart' }
            ],
            total: 45,
            status: 'placed',
            paymentStatus: 'PAID',
            paymentMethod: 'ONLINE',
            mode: 'DELIVERY',
            deliveryType: 'INSTANT',
            storeName: 'Grocesphere Demo Mart',
            customerName: 'Sonia Sharma',
            userLocation: { lat: 12.9650, lng: 77.6350 },
            storeLocation: { lat: 12.9716, lng: 77.6410 }
        }
      ];
      localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(mockOrders));
      return mockOrders;
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
    storeLocation: row.stores ? { lat: row.stores.lat, lng: row.stores.lng } : undefined,
    driverLocation: row.driver_lat && row.driver_lng ? { lat: row.driver_lat, lng: row.driver_lng } : undefined
  }));
};

export const getStoreInventory = async (storeId: string): Promise<InventoryItem[]> => {
  if (storeId === 'demo-store-id') {
      const saved = localStorage.getItem(DEMO_INVENTORY_KEY);
      if (saved) return JSON.parse(saved);
      
      // Initial mock data for Demo Store
      const mockInventory: InventoryItem[] = INITIAL_PRODUCTS.slice(0, 15).map(p => ({
          ...p,
          inStock: true,
          stock: Math.floor(Math.random() * 50) + 10,
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
    inStock: row.in_stock,
    stock: row.stock || 0,
    storePrice: parseFloat(row.price),
    isActive: true,
    brandDetails: row.brand_data || {}
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
    await supabase.from('orders').update({ status }).eq('id', orderId);
};

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
  if (storeId === 'demo-store-id') {
      const saved = localStorage.getItem(DEMO_INVENTORY_KEY);
      if (saved) {
          const inventory: InventoryItem[] = JSON.parse(saved);
          const updated = inventory.map(item => {
              if (item.id === productId) {
                  return { ...item, storePrice: price, inStock, stock, mrp: mrp || item.mrp, costPrice: costPrice || item.costPrice };
              }
              return item;
          });
          localStorage.setItem(DEMO_INVENTORY_KEY, JSON.stringify(updated));
      }
      return;
  }
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
    if (storeId === 'demo-store-id') {
        const saved = localStorage.getItem(DEMO_INVENTORY_KEY);
        const inventory: InventoryItem[] = saved ? JSON.parse(saved) : [];
        inventory.push(product);
        localStorage.setItem(DEMO_INVENTORY_KEY, JSON.stringify(inventory));
        return;
    }
    
    await supabase.from('products').upsert({ 
        id: product.id, 
        name: product.name, 
        category: product.category, 
        emoji: product.emoji, 
        mrp: product.mrp || product.price 
    });

    await supabase.from('inventory').insert({
        store_id: storeId,
        product_id: product.id,
        price: product.storePrice,
        stock: product.stock,
        in_stock: product.inStock
    });
};

export const getSettlements = async (storeId: string): Promise<Settlement[]> => {
  if (storeId === 'demo-store-id') {
      const saved = localStorage.getItem(DEMO_SETTLEMENTS_KEY);
      if (saved) return JSON.parse(saved);

      const mockSettlements: Settlement[] = [
          {
              id: 'STL-DEMO-001',
              orderId: 'demo-ord-live-1',
              amount: 114.00,
              fromUpi: 'admin@okgroce',
              transactionId: 'TXN_GSPHERE_8892',
              date: new Date(Date.now() - 86400000).toISOString(),
              status: 'COMPLETED'
          },
          {
              id: 'STL-DEMO-002',
              orderId: 'demo-ord-live-2',
              amount: 42.75,
              fromUpi: 'admin@okgroce',
              transactionId: 'TXN_GSPHERE_9104',
              date: new Date(Date.now() - 172800000).toISOString(),
              status: 'COMPLETED'
          },
          {
              id: 'STL-DEMO-003',
              orderId: 'prev-ord-123',
              amount: 540.20,
              fromUpi: 'admin@okgroce',
              transactionId: 'TXN_GSPHERE_7621',
              date: new Date(Date.now() - 259200000).toISOString(),
              status: 'COMPLETED'
          }
      ];
      localStorage.setItem(DEMO_SETTLEMENTS_KEY, JSON.stringify(mockSettlements));
      return mockSettlements;
  }

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
    if (storeId === 'demo-store-id') {
        const saved = localStorage.getItem(DEMO_STORE_KEY);
        if (saved) {
            const store = JSON.parse(saved);
            const updated = { ...store, ...updates };
            localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(updated));
        }
        return;
    }
    const dbPayload: any = {};
    if (updates.name) dbPayload.name = updates.name;
    if (updates.address) dbPayload.address = updates.address;
    if (updates.type) dbPayload.type = updates.type;
    if (updates.upiId) dbPayload.upi_id = updates.upiId;
    if (updates.lat) dbPayload.lat = updates.lat;
    if (updates.lng) dbPayload.lng = updates.lng;
    
    await supabase.from('stores').update(dbPayload).eq('id', storeId);
};
