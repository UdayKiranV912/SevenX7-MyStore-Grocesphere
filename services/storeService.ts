import { supabase } from './supabaseClient';
import { Store, Product } from '../types';

const mapStoreTypeToFrontend = (type: string): any => {
    if (type === 'vegetables') return 'Vegetables/Fruits';
    if (type === 'dairy') return 'Daily Needs / Milk Booth';
    if (type === 'mini_mart') return 'General Store';
    if (type === 'big_mart') return 'Local Mart';
    return 'General Store';
};

export const fetchLiveStores = async (lat: number, lng: number): Promise<Store[]> => {
  try {
    // Basic select since the RPC definition wasn't provided in the SQL
    const { data: dbStores, error } = await supabase
      .from('stores')
      .select('*')
      .eq('approved', true);

    if (error) throw error;
    if (!dbStores) return [];

    return dbStores.map(store => ({
        id: store.id,
        name: store.name,
        address: store.address || '',
        rating: 4.5,
        distance: 'Local', 
        lat: store.lat,
        lng: store.lng,
        isOpen: store.approved,
        type: mapStoreTypeToFrontend(store.store_type),
        availableProductIds: [],
        verificationStatus: 'verified'
    }));

  } catch (error) {
    console.error("Error fetching live stores:", error);
    return [];
  }
};

export const fetchStoreProducts = async (storeId: string): Promise<Product[]> => {
  try {
    const { data: inventoryData, error: invError } = await supabase
      .from('inventory')
      .select('*, products(*)')
      .eq('store_id', storeId)
      .eq('active', true);

    if (invError) throw invError;
    if (!inventoryData) return [];

    return inventoryData.map((item: any) => ({
        ...item.products,
        price: parseFloat(item.price),
        mrp: parseFloat(item.price) * 1.2
    }));

  } catch (error) {
    console.error("Error fetching store inventory:", error);
    return [];
  }
};

export const subscribeToStoreInventory = (storeId: string, onUpdate: () => void) => {
    return supabase
        .channel(`inventory-updates-${storeId}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'inventory', filter: `store_id=eq.${storeId}` },
            () => onUpdate()
        )
        .subscribe();
};