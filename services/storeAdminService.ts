
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
      owner_id: data.owner_id,
      gstNumber: data.gst_number || '',
      bankDetails: data.bank_details,
      verificationStatus: data.is_verified ? 'verified' : 'pending' 
    } as any;
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
        upi_id: updates.upiId,
        bank_details: updates.bankDetails,
        lat: updates.lat,
        lng: updates.lng
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
          inStock: idx < 40,
          stock: idx < 40 ? 100 : 0,
          storePrice: p.price,
          costPrice: Math.floor(p.price * 0.8),
          mrp: p.mrp || Math.floor(p.price * 1.2),
          isActive: true
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
      isActive: !!dbItem,
      brandDetails: dbItem?.brand_data || {} 
    };
  });
  return catalogInventory;
};

export const getIncomingOrders = async (storeId: string): Promise<Order[]> => {
  if (storeId === 'demo-store-id') {
      const saved = localStorage.getItem(DEMO_ORDERS_KEY);
      if (saved) return JSON.parse(saved);

      const mockOrders: Order[] = [];
      const customers = ['Priya Kapoor', 'Amit Verma', 'Rahul Sen', 'Sonia Nair', 'Vikram Rao'];
      
      mockOrders.push({
          id: `demo-track-1`,
          date: new Date().toISOString(),
          items: [
              { ...INITIAL_PRODUCTS[0], quantity: 1, selectedBrand: 'Generic', originalProductId: '1', storeId, storeName: 'Demo Mart', storeType: 'Local Mart' }
          ],
          total: 850,
          status: 'packing',
          paymentStatus: 'PAID',
          paymentMethod: 'ONLINE',
          mode: 'DELIVERY',
          deliveryType: 'INSTANT',
          storeName: 'Grocesphere Demo Mart',
          customerName: 'Rohit Sharma',
          storeLocation: { lat: 12.9716, lng: 77.6410 },
          userLocation: { lat: 12.9800, lng: 77.6500 }
      });

      for(let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dailyCount = Math.floor(Math.random() * 3) + 1;
        for(let j = 0; j < dailyCount; j++) {
            mockOrders.push({
                id: `demo-ord-${i}-${j}`,
                date: date.toISOString(),
                items: [
                    { ...INITIAL_PRODUCTS[Math.floor(Math.random() * 10)], quantity: 2, selectedBrand: 'Generic', originalProductId: '1', storeId, storeName: 'Demo Mart', storeType: 'Local Mart' }
                ],
                total: 500 + Math.floor(Math.random() * 2000),
                status: i === 0 ? 'placed' : 'delivered',
                paymentStatus: 'PAID',
                paymentMethod: 'ONLINE',
                mode: 'DELIVERY',
                deliveryType: 'INSTANT',
                storeName: 'Grocesphere Demo Mart',
                customerName: customers[Math.floor(Math.random() * customers.length)],
                storeLocation: { lat: 12.9716, lng: 77.6410 },
                userLocation: { lat: 12.9800, lng: 77.6500 }
            });
        }
      }

      localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(mockOrders));
      return mockOrders;
  }

  const { data: orders } = await supabase.from('orders').select('*, profiles(full_name, phone_number)').eq('store_id', storeId).order('created_at', { ascending: false });
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
    customerName: row.profiles?.full_name || 'Customer'
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

export const updateInventoryItem = async (storeId: string, productId: string, price: number, inStock: boolean, stock: number, brandDetails?: Record<string, BrandInventoryInfo>, mrp?: number, costPrice?: number) => {
  if (storeId === 'demo-store-id') {
    const inv = await getStoreInventory(storeId);
    const updated = inv.map(i => i.id === productId ? { ...i, storePrice: price, inStock, stock, isActive: true } : i);
    localStorage.setItem(DEMO_INVENTORY_KEY, JSON.stringify(updated));
    return;
  }
  await supabase.from('inventory').upsert({ store_id: storeId, product_id: productId, price, in_stock: inStock, stock, brand_data: brandDetails }, { onConflict: 'store_id, product_id' });
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

export const getSettlements = async (storeId: string): Promise<Settlement[]> => {
    if (storeId === 'demo-store-id') {
        const saved = localStorage.getItem(DEMO_SETTLEMENTS_KEY);
        if (saved) return JSON.parse(saved);

        const mockSettlements: Settlement[] = [
            {
                id: 'STL-1001',
                orderId: 'demo-ord-1',
                amount: 1450.00,
                fromUpi: 'grocesphere.admin@upi',
                transactionId: 'TXN-ABC-123456',
                date: new Date().toISOString(),
                status: 'COMPLETED'
            }
        ];
        localStorage.setItem(DEMO_SETTLEMENTS_KEY, JSON.stringify(mockSettlements));
        return mockSettlements;
    }

    const { data: dbSplits } = await supabase
        .from('payment_splits')
        .select('*')
        .order('created_at', { ascending: false });

    return (dbSplits || []).map((row: any) => ({
        id: `STL-${row.id}`,
        orderId: row.order_id,
        amount: parseFloat(row.store_amount),
        fromUpi: row.admin_upi || 'grocesphere.admin@upi',
        transactionId: row.transaction_id,
        date: row.created_at,
        status: row.is_settled ? 'COMPLETED' : 'PENDING'
    }));
};
