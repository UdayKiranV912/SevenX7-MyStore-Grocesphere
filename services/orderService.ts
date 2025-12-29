
import { supabase } from './supabaseClient';
import { Order } from '../types';

export const saveOrder = async (userId: string, order: Order) => {
  try {
    const { data: orderData, error } = await supabase
      .from('orders')
      .insert({
        customer_id: userId,
        store_id: order.items[0].storeId, 
        status: order.status || 'placed',
        items: order.items, 
        total_amount: order.total,
        type: order.mode,
        delivery_address: order.deliveryAddress,
        delivery_lat: order.userLocation?.lat,
        delivery_lng: order.userLocation?.lng,
        transaction_id: order.transactionId,
        payment_method: order.paymentMethod,
        payment_status: order.paymentStatus
      })
      .select()
      .single();

    if (error) throw error;

    const orderItemsPayload = order.items.map(item => ({
        order_id: orderData.id,
        product_id: item.originalProductId,
        store_id: item.storeId,
        unit_price: item.price,
        quantity: item.quantity
    }));

    await supabase
        .from('order_items')
        .insert(orderItemsPayload);

    if (order.splits && order.paymentMethod === 'ONLINE') {
        await supabase
            .from('payment_splits')
            .insert({
                order_id: orderData.id,
                store_amount: order.splits.storeAmount,
                store_upi: order.splits.storeUpi,
                handling_fee: order.splits.handlingFee || 0,
                admin_upi: 'grocesphere.admin@upi', 
                delivery_fee: order.splits.deliveryFee,
                driver_upi: order.splits.driverUpi,
                total_paid_by_customer: order.total,
                is_settled: false,
                transaction_id: order.transactionId
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
        date: row.created_at,
        items: row.items,
        total: parseFloat(row.total_amount),
        status: row.status as any,
        paymentStatus: row.payment_status || 'PAID',
        paymentMethod: row.payment_method || 'ONLINE',
        mode: row.type || 'DELIVERY',
        deliveryType: 'INSTANT',
        storeName: row.stores?.name || 'My store Grocesphere Store',
        storeLocation: row.stores ? { lat: row.stores.lat, lng: row.stores.lng } : undefined,
        userLocation: { lat: row.delivery_lat, lng: row.delivery_lng },
        driverLocation: row.driver_lat && row.driver_lng ? { lat: row.driver_lat, lng: row.driver_lng } : undefined,
        transactionId: row.transaction_id
    }));
  } catch (err) {
    console.error('Supabase fetch failed:', err);
    return [];
  }
};

export const subscribeToUserOrders = (userId: string, onUpdate: (payload: any) => void) => {
    // Ensuring the subscription captures GPS updates (driver_lat, driver_lng)
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
