
import { supabase } from './supabaseClient';
import { Store, Product, BrandOption } from '../types';
import { INITIAL_PRODUCTS, MOCK_STORES } from '../constants';

// --- Database Types (matching SQL) ---
interface DBStore {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: 'general' | 'produce' | 'dairy';
  is_open: boolean;
  rating: number;
}

/**
 * Fetch nearby stores from Supabase.
 */
export const fetchLiveStores = async (lat: number, lng: number): Promise<Store[]> => {
  try {
    const { data: dbStores, error } = await supabase.rpc('get_nearby_stores', {
      lat,
      long: lng,
      radius_km: 10 
    });

    if (error) throw error;

    if (!dbStores || dbStores.length === 0) {
      return []; 
    }

    const storesWithInventory = await Promise.all(dbStores.map(async (store: DBStore) => {
      const { data: invData } = await supabase
        .from('inventory')
        .select('product_id')
        .eq('store_id', store.id)
        .eq('in_stock', true);

      const productIds = invData ? invData.map((i: any) => i.product_id) : [];

      return {
        id: store.id,
        name: store.name,
        address: store.address || '',
        rating: store.rating || 4.5,
        distance: `${calculateDistance(lat, lng, store.lat, store.lng).toFixed(1)} km`,
        lat: store.lat,
        lng: store.lng,
        isOpen: store.is_open,
        type: store.type,
        availableProductIds: productIds,
        openingTime: '08:00 AM', 
        closingTime: '10:00 PM'  
      };
    }));

    return storesWithInventory;

  } catch (error) {
    console.error("Error fetching live stores:", error);
    return [];
  }
};

/**
 * Fetch products for a specific store.
 */
export const fetchStoreProducts = async (storeId: string): Promise<Product[]> => {
  try {
    const { data: inventoryData, error: invError } = await supabase
      .from('inventory')
      .select('product_id, price, in_stock, mrp, brand_data')
      .eq('store_id', storeId)
      .eq('in_stock', true);

    if (invError) throw invError;
    
    const inventory = inventoryData as any[] | null;
    if (!inventory || inventory.length === 0) return [];

    const inventoryMap = new Map(inventory.map(i => [i.product_id, i]));
    const allIds = inventory.map(i => i.product_id);
    
    const { data: dbProducts, error: prodError } = await supabase
        .from('products')
        .select('*')
        .in('id', allIds);
    
    const dbProductMap = new Map();
    if (!prodError && dbProducts) {
        dbProducts.forEach((p: any) => {
            dbProductMap.set(p.id, {
                id: p.id,
                name: p.name,
                category: p.category,
                emoji: p.emoji || '📦', 
                price: p.mrp || 0,   
                mrp: p.mrp || 0
            });
        });
    }

    const finalProducts: Product[] = allIds.map((id: string) => {
        const invItem = inventoryMap.get(id);
        if (!invItem) return null;

        let baseProduct = dbProductMap.get(id);
        if (!baseProduct) {
            baseProduct = INITIAL_PRODUCTS.find(p => p.id === id);
        }

        if (baseProduct) {
            // Map brand_data JSONB to brands array for the UI
            const brands: BrandOption[] = [];
            if (invItem.brand_data) {
                Object.entries(invItem.brand_data).forEach(([name, details]: [string, any]) => {
                    brands.push({
                        name: name,
                        price: details.price || invItem.price
                    });
                });
            }

            return {
                ...baseProduct,
                price: parseFloat(invItem.price), 
                mrp: invItem.mrp ? parseFloat(invItem.mrp) : (baseProduct.mrp || baseProduct.price),
                brands: brands.length > 0 ? brands : baseProduct.brands
            };
        }
        return null;
    }).filter(Boolean) as Product[];

    return finalProducts;

  } catch (error) {
    console.error("Error fetching store inventory:", error);
    return [];
  }
};

/**
 * Real-time Subscription to Inventory Changes
 */
export const subscribeToStoreInventory = (storeId: string, onUpdate: () => void) => {
    return supabase
        .channel(`inventory-updates-${storeId}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'inventory', filter: `store_id=eq.${storeId}` },
            (payload) => onUpdate()
        )
        .subscribe();
};

// Helper
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI/180);
  const dLon = (lon2 - lon1) * (Math.PI/180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}
