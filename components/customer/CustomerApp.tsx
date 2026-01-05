
import React, { useState, useEffect, useMemo } from 'react';
import { UserState, Store, Product, CartItem, Order } from '../../types';
import { MapVisualizer } from '../MapVisualizer';
import { StickerProduct } from '../StickerProduct';
import { CartDetails } from '../CartSheet';
import { ProductDetailsModal } from '../ProductDetailsModal';
import { MyOrders } from '../MyOrders';
import { UserProfile } from '../UserProfile';
import { PaymentGateway } from '../PaymentGateway';
import { fetchLiveStores, fetchStoreProducts, subscribeToStoreInventory } from '../../services/storeService';
import { saveOrder } from '../../services/orderService';
import { findNearbyStores } from '../../services/geminiService';
import SevenX7Logo from '../SevenX7Logo';
import { MOCK_STORES } from '../../constants';
import { watchLocation, clearWatch, getBrowserLocation, reverseGeocode } from '../../services/locationService';

interface CustomerAppProps {
  user: UserState;
  onLogout: () => void;
  onUpdateUser?: (updatedData: Partial<UserState>) => void;
}

export const CustomerApp: React.FC<CustomerAppProps> = ({ user, onLogout, onUpdateUser }) => {
  const [activeView, setActiveView] = useState<'HOME' | 'STORE' | 'ORDERS' | 'PROFILE' | 'CART'>('HOME');
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | Store['store_type']>('ALL');
  const [sortBy, setSortBy] = useState<'DISTANCE' | 'RATING'>('DISTANCE');
  const [currentAddress, setCurrentAddress] = useState<string>(user.address || 'Locating...');
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(user.location);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [pendingOrderDetails, setPendingOrderDetails] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isMapExpanded, setIsMapExpanded] = useState(true);

  // Dynamic Categories from store inventory
  const availableCategories = useMemo(() => {
    if (!storeProducts.length) return ['All'];
    const cats = new Set(storeProducts.map(p => p.category));
    return ['All', ...Array.from(cats).sort()];
  }, [storeProducts]);

  useEffect(() => {
    const initLocation = async () => {
        try {
            const loc = await getBrowserLocation();
            setCurrentLocation({ lat: loc.lat, lng: loc.lng });
            const address = await reverseGeocode(loc.lat, loc.lng);
            if (address) setCurrentAddress(address);
        } catch (e) {
            if (!user.location) {
                 setCurrentLocation({ lat: 12.9716, lng: 77.5946 }); 
                 setCurrentAddress("Indiranagar, Bangalore");
            }
        }
    };
    initLocation();
    const watchId = watchLocation((loc) => {
        setCurrentLocation({ lat: loc.lat, lng: loc.lng });
    }, (err) => {});
    
    return () => { if (watchId !== -1) clearWatch(watchId); };
  }, []);

  useEffect(() => {
    const lat = currentLocation?.lat || 12.9716;
    const lng = currentLocation?.lng || 77.5946;
    const loadStores = async () => {
        setIsLoading(true);
        try {
            let liveStores = await fetchLiveStores(lat, lng);
            if (liveStores.length === 0) liveStores = await findNearbyStores(lat, lng);
            if (liveStores.length === 0) {
                liveStores = MOCK_STORES.map(s => {
                    const d = Math.sqrt(Math.pow(s.lat - lat, 2) + Math.pow(s.lng - lng, 2)) * 111;
                    return { ...s, distance: `${d.toFixed(1)} km` };
                });
            }
            setStores(liveStores);
        } catch (e) { setStores(MOCK_STORES); } finally { setIsLoading(false); }
    };
    loadStores();
  }, [currentLocation]); 

  useEffect(() => {
      if (!selectedStore) return;
      const loadProducts = async () => {
          setIsLoading(true);
          try {
              const products = await fetchStoreProducts(selectedStore.id);
              setStoreProducts(products);
              setSelectedCategory('All');
              subscribeToStoreInventory(selectedStore.id, () => fetchStoreProducts(selectedStore.id).then(setStoreProducts));
          } catch (e) {} finally { setIsLoading(false); }
      };
      loadProducts();
  }, [selectedStore]);

  const processedStores = useMemo(() => {
    let filtered = stores;
    if (filterType !== 'ALL') filtered = stores.filter(s => s.store_type === filterType);
    return [...filtered].sort((a, b) => {
        if (sortBy === 'RATING') return b.rating - a.rating;
        return parseFloat(a.distance) - parseFloat(b.distance);
    });
  }, [stores, filterType, sortBy]);

  const addToCart = (product: Product, quantity: number = 1, brandName: string = 'Generic', price?: number) => {
    if (!selectedStore) return;
    const finalPrice = price || product.price;
    setCart(prev => {
        const existingIdx = prev.findIndex(item => item.originalProductId === product.id && item.selectedBrand === brandName);
        if (existingIdx > -1) {
            const newCart = [...prev];
            newCart[existingIdx].quantity += quantity;
            return newCart;
        }
        return [...prev, {
            ...product,
            id: `${product.id}-${brandName}-${Date.now()}`,
            originalProductId: product.id,
            price: finalPrice, 
            quantity,
            selectedBrand: brandName,
            storeId: selectedStore.id,
            storeName: selectedStore.name,
            storeType: selectedStore.store_type
        }];
    });
  };

  const handlePaymentSuccess = async (txnId: string) => {
      if (!pendingOrderDetails) return;
      
      const newOrder: Order = {
          id: `ord-${Date.now()}`, 
          created_at: new Date().toISOString(),
          date: new Date().toISOString(), 
          items: cart, 
          store_id: cart[0].storeId,
          customer_id: user.id,
          total_amount: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + (pendingOrderDetails.splits.deliveryFee || 0),
          total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + (pendingOrderDetails.splits.deliveryFee || 0),
          status: 'placed', 
          paymentStatus: 'PAID',
          paymentMethod: pendingOrderDetails.paymentMethod,
          mode: 'delivery', 
          deliveryType: pendingOrderDetails.deliveryType, 
          scheduledTime: pendingOrderDetails.scheduledTime,
          deliveryAddress: currentAddress, 
          storeName: cart[0].storeName, 
          storeLocation: selectedStore ? { lat: selectedStore.lat, lng: selectedStore.lng } : undefined,
          userLocation: currentLocation || undefined, 
          splits: { ...pendingOrderDetails.splits, transactionId: txnId },
          // Comment: Corrected customer fields to snake_case
          customer_name: user.name, 
          customer_phone: user.phone,
          transactionId: txnId
      };

      if (user.id && !user.id.includes('demo')) await saveOrder(user.id, newOrder);
      else {
          const existing = JSON.parse(localStorage.getItem('grocesphere_orders') || '[]');
          localStorage.setItem('grocesphere_orders', JSON.stringify([newOrder, ...existing]));
      }
      setCart([]); 
      setShowPayment(false); 
      setActiveView('ORDERS');
  };

  return (
    <div className="min-h-screen bg-white pb-24 overflow-x-hidden">
        <header className="fixed top-0 left-0 right-0 z-[1000] px-5 py-4 pointer-events-none">
             <div className="flex items-center justify-between">
                 <div onClick={() => setActiveView('HOME')} className="pointer-events-auto bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-float cursor-pointer active:scale-95 transition-transform">
                     <SevenX7Logo size="small" hideGrocesphere={true} />
                 </div>
                 <div className="flex items-center gap-3 pointer-events-auto">
                     <div className="bg-white/90 backdrop-blur-md border border-white rounded-full px-4 py-2.5 flex items-center gap-2 shadow-float cursor-pointer hover:bg-white" onClick={() => setActiveView('PROFILE')}>
                         <span className="text-emerald-500 animate-pulse text-xs">📍</span>
                         <span className="text-[10px] font-black text-slate-700 truncate max-w-[120px] uppercase tracking-wide">{currentAddress}</span>
                     </div>
                     <button onClick={() => setActiveView('CART')} className="relative p-3.5 bg-slate-900 rounded-2xl text-white shadow-xl active:scale-90 transition-transform">
                         <span className="text-xl leading-none">🛒</span>
                         {cart.length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">{cart.length}</span>}
                     </button>
                 </div>
             </div>
        </header>

        <main className="h-screen w-full relative">
            {activeView === 'HOME' && (
                <div className="h-full w-full relative">
                     <MapVisualizer stores={processedStores} userLat={currentLocation?.lat || null} userLng={currentLocation?.lng || null} selectedStore={selectedStore} onSelectStore={(s) => { setSelectedStore(s); }} mode="delivery" enableLiveTracking={true} />

                     <div className={`absolute bottom-0 left-0 right-0 z-[500] bg-white rounded-t-[3.5rem] shadow-2xl transition-all duration-500 ${isMapExpanded ? 'h-[45vh]' : 'h-[85vh]'} flex flex-col border-t border-slate-100`}>
                         <div className="w-full h-10 flex items-center justify-center shrink-0 cursor-pointer" onClick={() => setIsMapExpanded(!isMapExpanded)}>
                             <div className="w-16 h-1.5 bg-slate-200 rounded-full"></div>
                         </div>
                         
                         <div className="flex-1 overflow-y-auto px-6 pb-24 hide-scrollbar">
                             <div className="flex items-center justify-between mb-8">
                                 <div>
                                     <h2 className="font-black text-slate-900 text-2xl tracking-tight">Active Hubs</h2>
                                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{processedStores.length} stores serving your cluster</p>
                                 </div>
                                 <button onClick={() => setSortBy(prev => prev === 'DISTANCE' ? 'RATING' : 'DISTANCE')} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-lg shadow-sm active:scale-90 transition-transform">
                                     {sortBy === 'DISTANCE' ? '📍' : '⭐'}
                                 </button>
                             </div>

                             <div className="flex items-center gap-2 overflow-x-auto pb-6 hide-scrollbar">
                                 {[{ id: 'ALL', label: 'All Clusters' }, { id: 'General Store', label: 'Marts' }, { id: 'Vegetables/Fruits', label: 'Fresh Hubs' }].map((type) => (
                                     <button key={type.id} onClick={() => setFilterType(type.id as any)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all whitespace-nowrap border ${filterType === type.id ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>{type.label}</button>
                                 ))}
                             </div>

                             <div className="space-y-5">
                                 {processedStores.map(store => (
                                     <div key={store.id} onClick={() => { setSelectedStore(store); setActiveView('STORE'); }} className="bg-slate-50/50 p-6 rounded-[3rem] border border-slate-100 flex items-center gap-6 cursor-pointer hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all active:scale-[0.98]">
                                         <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-4xl text-white shadow-lg ${store.store_type === 'Vegetables/Fruits' ? 'bg-emerald-500' : store.store_type === 'Daily Needs / Milk Booth' ? 'bg-blue-500' : 'bg-orange-500'}`}>🏪</div>
                                         <div className="flex-1 min-w-0">
                                             <h3 className="font-black text-slate-900 text-lg truncate mb-1">{store.name}</h3>
                                             <div className="flex items-center gap-3 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                                 <span className="text-emerald-600">{store.distance}</span>
                                                 <span className="text-slate-200">|</span>
                                                 <span className="text-amber-500">⭐ {store.rating.toFixed(1)}</span>
                                             </div>
                                         </div>
                                         <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md text-slate-300">→</div>
                                     </div>
                                 ))}
                             </div>
                         </div>
                     </div>
                </div>
            )}
            
            {activeView === 'STORE' && selectedStore && (
                <div className="h-full bg-white overflow-y-auto animate-slide-up pb-32">
                    <div className="p-8 border-b border-slate-50 sticky top-0 bg-white/95 backdrop-blur-xl z-20 flex flex-col gap-8">
                        <div className="flex items-center gap-6">
                            <button onClick={() => setActiveView('HOME')} className="w-14 h-14 bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-2xl shadow-sm active:scale-90 transition-transform">←</button>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-3xl font-black text-slate-900 truncate leading-none mb-2">{selectedStore.name}</h1>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.1em]">{selectedStore.address}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto py-1 hide-scrollbar">
                            {availableCategories.map(cat => (
                                <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase whitespace-nowrap border transition-all ${selectedCategory === cat ? 'bg-emerald-500 text-white border-emerald-500 shadow-xl scale-105' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>{cat}</button>
                            ))}
                        </div>
                    </div>
                    <div className="p-6 grid grid-cols-2 gap-6">
                         {isLoading ? <div className="col-span-2 py-40 text-center opacity-20 animate-pulse font-black text-[12px] uppercase tracking-[0.3em]">Querying Verified Stock...</div> : storeProducts.filter(p => selectedCategory === 'All' || p.category === selectedCategory).map(product => (
                             <StickerProduct key={product.id} product={product} count={cart.filter(c => c.originalProductId === product.id).reduce((sum, c) => sum + c.quantity, 0)} onAdd={(p) => addToCart(p, 1, 'Generic', p.price)} onUpdateQuantity={(pid, delta) => { const cartItem = cart.find(c => c.originalProductId === pid); if(cartItem) { setCart(prev => prev.map(item => item.id === cartItem.id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter(item => item.quantity > 0)); } }} onClick={(p) => setSelectedProduct(p)} />
                         ))}
                    </div>
                </div>
            )}
            
            {activeView === 'ORDERS' && <div className="h-full bg-white overflow-y-auto pt-24"><MyOrders userLocation={currentLocation} userId={user.id} /></div>}
            {activeView === 'PROFILE' && <div className="h-full bg-white overflow-y-auto pt-24"><UserProfile user={{...user, location: currentLocation, address: currentAddress}} onUpdateUser={(d) => onUpdateUser?.(d)} onLogout={onLogout} /></div>}
            {activeView === 'CART' && <div className="absolute inset-0 z-[2000] bg-white"><CartDetails cart={cart} onProceedToPay={(d) => { setPendingOrderDetails(d); setShowPayment(true); }} onUpdateQuantity={(cid, d) => setCart(prev => prev.map(item => item.id === cid ? { ...item, quantity: Math.max(0, item.quantity + d) } : item).filter(item => item.quantity > 0))} onAddProduct={(p) => addToCart(p, 1, 'Generic', p.price)} mode="DELIVERY" onModeChange={() => {}} deliveryAddress={currentAddress} onAddressChange={setCurrentAddress} activeStore={selectedStore} stores={stores} userLocation={currentLocation} isPage={true} onClose={() => setActiveView('HOME')} /></div>}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-slate-100 px-10 py-6 flex justify-between z-[1000] max-w-lg mx-auto rounded-t-[3.5rem] shadow-float">
           {[{ id: 'HOME', icon: '🏠', label: 'Preview' }, { id: 'ORDERS', icon: '🧾', label: 'History' }, { id: 'PROFILE', icon: '👤', label: 'Profile' }].map(item => (
             // Comment: Corrected setActiveTab to setActiveView
             <button key={item.id} onClick={() => setActiveView(item.id as any)} className={`flex flex-col items-center gap-2 transition-all ${activeView === item.id ? 'text-slate-900 scale-110' : 'text-slate-300'}`}>
                <span className="text-2xl">{item.icon}</span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] leading-none">{item.label}</span>
            </button>
           ))}
        </nav>

        {selectedProduct && <ProductDetailsModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={(p, qty, brand, price) => addToCart(p, qty, brand, price)} />}
        {showPayment && pendingOrderDetails && <PaymentGateway amount={pendingOrderDetails.splits.storeAmount + (pendingOrderDetails.splits.deliveryFee || 0)} onSuccess={handlePaymentSuccess} onCancel={() => setShowPayment(false)} isDemo={user.id?.includes('demo') || false} splits={pendingOrderDetails.splits} />}
    </div>
  );
};
