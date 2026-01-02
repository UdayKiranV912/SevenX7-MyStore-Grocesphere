import { supabase } from './supabaseClient';
import { Store, Order, InventoryItem, Settlement } from '../types';
import { INITIAL_PRODUCTS } from '../constants';

const DEMO_STORE_KEY = 'grocesphere_demo_store';
const DEMO_INVENTORY_KEY = 'grocesphere_demo_inventory';
const DEMO_ORDERS_KEY = 'grocesphere_demo_orders';
const DEMO_SETTLEMENTS_KEY = 'grocesphere_demo_settlements';

// Helper to initialize demo data if missing
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
      type: 'Local Mart',
      availableProductIds: INITIAL_PRODUCTS.slice(0, 30).map(p => p.id),
      upiId: 'merchant@okgroce',
      ownerId: 'demo-store_owner',
      verificationStatus: 'verified'
    };
    localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(defaultStore));
  }

  if (!localStorage.getItem(DEMO_INVENTORY_KEY)) {
    const mockInventory: InventoryItem[] = INITIAL_PRODUCTS.slice(0, 20).map(p => ({
      ...p,
      inStock: true,
      stock: Math.floor(Math.random() * 50) + 10,
      storePrice: p.price,
      isActive: true,
      mrp: p.price * 1.2
    }));
    localStorage.setItem(DEMO_INVENTORY_KEY, JSON.stringify(mockInventory));
  }

  if (!localStorage.getItem(DEMO_ORDERS_KEY)) {
    const mockOrders: Order[] = [
      {
        id: 'demo-ord-101',
        date: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
        items: [
          { ...INITIAL_PRODUCTS[0], quantity: 2, selectedBrand: 'Generic', originalProductId: '1', storeId: 'demo-store-id', storeName: 'Demo Mart', storeType: 'Local Mart' },
          { ...INITIAL_PRODUCTS[41], quantity: 1, selectedBrand: 'Generic', originalProductId: '41', storeId: 'demo-store-id', storeName: 'Demo Mart', storeType: 'Local Mart' }
        ],
        total: 154,
        status: 'packing',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
        mode: 'DELIVERY',
        deliveryType: 'INSTANT',
        storeName: 'Grocesphere Demo Mart',
        customerName: 'Rahul Khanna',
        customerPhone: '9876543210',
        userLocation: { lat: 12.9780, lng: 77.6450 },
        storeLocation: { lat: 12.9716, lng: 77.6410 }
      },
      {
        id: 'demo-ord-102',
        date: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
        items: [
          { ...INITIAL_PRODUCTS[5], quantity: 5, selectedBrand: 'Generic', originalProductId: '6', storeId: 'demo-store-id', storeName: 'Demo Mart', storeType: 'Local Mart' }
        ],
        total: 225,
        status: 'placed',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
        mode: 'DELIVERY',
        deliveryType: 'INSTANT',
        storeName: 'Grocesphere Demo Mart',
        customerName: 'Priya Sharma',
        customerPhone: '9988776655',
        userLocation: { lat: 12.9650, lng: 77.6350 },
        storeLocation: { lat: 12.9716, lng: 77.6410 }
      }
    ];
    localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(mockOrders));
  }

  if (!localStorage.getItem(DEMO_SETTLEMENTS_KEY)) {
    const mockSettlements: Settlement[] = [
      { id: 'STL-001', orderId: 'demo-ord-099', amount: 450.00, fromUpi: 'admin@okgroce', transactionId: 'TXN_GSP_101', date: new Date(Date.now() - 86400000).toISOString(), status: 'COMPLETED' },
      { id: 'STL-002', orderId: 'demo-ord-098', amount: 125.50, fromUpi: 'admin@okgroce', transactionId: 'TXN_GSP_102', date: new Date(Date.now() - 172800000).toISOString(), status: 'COMPLETED' }
    ];
    localStorage.setItem(DEMO_SETTLEMENTS_KEY, JSON.stringify(mockSettlements));
  }
};

// Helper to map FE store types to BE store_type enum
const mapStoreTypeToBackend = (type: string): any => {
    if (type === 'Vegetables/Fruits') return 'vegetables';
    if (type === 'Daily Needs / Milk Booth') return 'dairy';
    if (type === 'General Store') return 'mini_mart';
    if (type === 'Local Mart') return 'big_mart';
    return 'mini_mart';
};

// Helper to map BE store_type to FE
const mapStoreTypeToFrontend = (type: string): any => {
    if (type === 'vegetables') return 'Vegetables/Fruits';
    if (type === 'dairy') return 'Daily Needs / Milk Booth';
    if (type === 'mini_mart') return 'General Store';
    if (type === 'big_mart') return 'Local Mart';
    return 'General Store';
};

export const getMyStore = async (ownerId: string): Promise<Store | null> => {
  if (ownerId.includes('demo')) {
    initDemoData();
    const saved = localStorage.getItem(DEMO_STORE_KEY);
    return saved ? JSON.parse(saved) : null;
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
      rating: 4.5,
      distance: '', 
      lat: data.lat,
      lng: data.lng,
      isOpen: data.approved,
      type: mapStoreTypeToFrontend(data.store_type),
      availableProductIds: [],
      upiId: data.upi_id,
      ownerId: data.owner_id,
      verificationStatus: data.approved ? 'verified' : 'pending'
    };
  } catch (e) {
    return null;
  }
};

export const subscribeToStoreOrders = (storeId: string, onUpdate: () => void) => {
    if (storeId === 'demo-store-id') {
      // Return a dummy object for demo mode
      return { unsubscribe: () => {} };
    }
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
    if (storeId === 'demo-store-id') {
      return { unsubscribe: () => {} };
    }
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
      initDemoData();
      const saved = localStorage.getItem(DEMO_ORDERS_KEY);
      return saved ? JSON.parse(saved) : [];
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('*, profiles!orders_customer_id_fkey(full_name, phone)')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  return (orders || []).map((row: any) => ({
    id: row.id, 
    date: row.created_at, 
    items: [], 
    total: parseFloat(row.total_amount), 
    status: row.status as any, 
    paymentStatus: row.payment_status === 'paid' ? 'PAID' : 'PENDING', 
    paymentMethod: 'ONLINE', 
    mode: row.mode?.toUpperCase() || 'DELIVERY', 
    deliveryType: 'INSTANT', 
    storeName: 'Partner Hub', 
    customerName: row.profiles?.full_name || 'Customer',
    customerPhone: row.profiles?.phone || '',
    userLocation: { lat: row.delivery_lat, lng: row.delivery_lng }
  }));
};

export const getStoreInventory = async (storeId: string): Promise<InventoryItem[]> => {
  if (storeId === 'demo-store-id') {
      initDemoData();
      const saved = localStorage.getItem(DEMO_INVENTORY_KEY);
      return saved ? JSON.parse(saved) : [];
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
            const updated = orders.map((o: any) => {
                if (o.id === orderId) {
                    // Add simulation for settlement on delivery
                    if (status === 'delivered' || status === 'picked_up') {
                        const settlements = JSON.parse(localStorage.getItem(DEMO_SETTLEMENTS_KEY) || '[]');
                        settlements.unshift({
                            id: `STL-${Date.now()}`,
                            orderId: o.id,
                            amount: o.total * 0.95, // 5% fee
                            fromUpi: 'admin@okgroce',
                            transactionId: `TXN_GSP_${Math.floor(Math.random()*900)+100}`,
                            date: new Date().toISOString(),
                            status: 'COMPLETED'
                        });
                        localStorage.setItem(DEMO_SETTLEMENTS_KEY, JSON.stringify(settlements));
                    }
                    return { ...o, status };
                }
                return o;
            });
            localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(updated));
        }
        return;
    }
    
    let sqlStatus = status as string;
    if (status === 'packing') sqlStatus = 'packed';
    
    await supabase.from('orders').update({ status: sqlStatus }).eq('id', orderId);
};

export const updateInventoryItem = async (storeId: string, productId: string, price: number, inStock: boolean, stock: number) => {
  if (storeId === 'demo-store-id') {
    const saved = localStorage.getItem(DEMO_INVENTORY_KEY);
    if (saved) {
        const inv = JSON.parse(saved);
        const updated = inv.map((i: any) => i.id === productId ? { ...i, storePrice: price, inStock, stock, isActive: inStock } : i);
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
      inv.push({ ...product, isActive: true, inStock: true });
      localStorage.setItem(DEMO_INVENTORY_KEY, JSON.stringify(inv));
      return;
    }
    const { data: pData } = await supabase.from('products').insert({
        id: product.id,
        name: product.name,
        category: product.category,
        emoji: product.emoji
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

export const getSettlements = async (storeId: string): Promise<Settlement[]> => {
    if (storeId === 'demo-store-id') {
        initDemoData();
        const saved = localStorage.getItem(DEMO_SETTLEMENTS_KEY);
        return saved ? JSON.parse(saved) : [];
    }
    
    const { data } = await supabase.from('payments').select('*').eq('order_id', storeId);
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
    if (updates.type) dbPayload.store_type = mapStoreTypeToBackend(updates.type);
    if (updates.upiId) dbPayload.upi_id = updates.upiId;
    if (updates.lat) dbPayload.lat = updates.lat;
    if (updates.lng) dbPayload.lng = updates.lng;
    
    await supabase.from('stores').update(dbPayload).eq('id', storeId);
};