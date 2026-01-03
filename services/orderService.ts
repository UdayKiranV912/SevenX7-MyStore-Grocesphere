
import { supabase } from './supabaseClient';
import { Order } from '../types';

export const saveOrder = async (userId: string, order: Order) => {
  try {
    const { data: orderData, error } = await supabase
      .from('orders')
      .insert({
        customer_id: userId,
        store_id: order.items[0].storeId, 
        status: 'placed',
        // Comment: Support both total and total_amount for interface compatibility
        total_amount: order.total || order.total_amount,
        mode: order.mode.toLowerCase(), 
        delivery_lat: order.userLocation?.lat,
        delivery_lng: order.userLocation?.lng,
        transaction_ref: order.transactionId,
        payment_status: 'paid',
        delivery_fee: order.splits?.deliveryFee || 0,
        service_fee: order.splits?.handlingFee || 0
      })
      .select()
      .single();

    if (error) throw error;

    const orderItemsPayload = order.items.map(item => ({
        order_id: orderData.id,
        product_id: item.originalProductId,
        quantity: item.quantity,
        price: item.price
    }));

    await supabase.from('order_items').insert(orderItemsPayload);

    if (order.splits) {
        await supabase.from('payments').insert({
            order_id: orderData.id,
            store_upi: order.splits.storeUpi,
            admin_upi: 'grocesphere.admin@upi', 
            store_amount: order.splits.storeAmount,
            admin_amount: order.splits.handlingFee || 0,
            delivery_amount: order.splits.deliveryFee || 0,
            settled: false
        });
    }

  } catch (err) {
    console.error('Supabase save failed:', err);
    throw err;
  }
};

export const getUserOrders = async (userId: string): Promise<Order[]> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, stores(name, lat, lng)')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
        id: row.id,
        created_at: row.created_at,
        date: row.created_at,
        items: [], // Requires follow-up query to order_items for full item details
        total_amount: parseFloat(row.total_amount),
        total: parseFloat(row.total_amount),
        status: row.status as any,
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
        mode: row.mode?.toUpperCase() || 'DELIVERY',
        deliveryType: 'INSTANT',
        storeName: row.stores?.name || 'Community Mart',
        storeLocation: row.stores ? { lat: row.stores.lat, lng: row.stores.lng } : undefined,
        userLocation: { lat: row.delivery_lat, lng: row.delivery_lng },
        transactionId: row.transaction_ref
    } as Order));
  } catch (err) {
    console.error('Supabase fetch failed:', err);
    return [];
  }
};

export const subscribeToUserOrders = (userId: string, onUpdate: (payload: any) => void) => {
    return supabase
        .channel(`user-orders-live-${userId}`)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'orders', 
            filter: `customer_id=eq.${userId}` 
        }, (payload) => onUpdate(payload.new))
        .subscribe();
};
