
import React, { useEffect, useState, useMemo } from 'react';
import { UserState, Store, Order, InventoryItem, Product, BrandInventoryInfo } from '../../types';
import { getMyStore, getStoreInventory, updateInventoryItem, getIncomingOrders, updateStoreOrderStatus, updateStoreProfile, createCustomProduct } from '../../services/storeAdminService';
import { supabase } from '../../services/supabaseClient';
import SevenX7Logo from '../SevenX7Logo';
import { MapVisualizer } from '../MapVisualizer';
import { INITIAL_PRODUCTS } from '../../constants';
import { reverseGeocode, getBrowserLocation, watchLocation, clearWatch } from '../../services/locationService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StoreAppProps {
  user: UserState;
  onLogout: () => void;
}

const CATEGORIES = [
  'Staples', 'Oils & Spices', 'Dairy & Breakfast', 'Veg & Fruits', 
  'Snacks & Drinks', 'Home Care', 'Personal Care', 'Meat & Seafood', 
  'Bakery', 'Baby Care', 'General'
];

const EMOJI_OPTIONS = [
  '🍎', '🥦', '🥚', '🍞', '🥛', '🥩', '🍗', '🐟', '🥤', '🧃', 
  '🍫', '🍪', '🧊', '🧼', '🧻', '🧹', '📦', '🧴', '🦟', '🧂', 
  '🍚', '🌾', '🌻', '🥓', '🧀', '🍓', '🥑', '🍜', '🍱', '🧺'
];

export const StoreApp: React.FC<StoreAppProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'INVENTORY' | 'ORDERS'>('DASHBOARD');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [myStore, setMyStore] = useState<Store | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [nearbyUsers, setNearbyUsers] = useState<{lat: number, lng: number, id: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileForm, setProfileForm] = useState<Partial<Store>>({});
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
  
  // Inventory UI States
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [isCreatingCustom, setIsCreatingCustom] = useState(false); 
  const [searchTerm, setSearchTerm] = useState('');
  const [customProduct, setCustomProduct] = useState({
      name: '',
      emoji: '📦',
      category: 'General',
      costPrice: '',
      storePrice: '',
      stock: '10',
      mrp: ''
  });

  const [isVerifying, setIsVerifying] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // --- ANALYTICS CALCULATIONS ---
  const stats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(new Date().setHours(0,0,0,0));
    const startOfWeek = new Date(new Date().setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const calcForRange = (rangeStart: Date) => {
        const filtered = orders.filter(o => new Date(o.date) >= rangeStart && !['cancelled', 'rejected'].includes(o.status));
        const revenue = filtered.reduce((sum, o) => sum + o.total, 0);
        const sales = filtered.length;
        const profit = filtered.reduce((sum, o) => {
            return sum + o.items.reduce((pSum, item) => {
                const cost = item.costPrice || (item.price * 0.8);
                return pSum + ((item.price - cost) * item.quantity);
            }, 0);
        }, 0);
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        return { revenue, sales, profit, margin };
    };

    const last7Days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d);
        dayEnd.setHours(23, 59, 59, 999);
        
        const dayOrders = orders.filter(o => {
            const od = new Date(o.date);
            return od >= d && od <= dayEnd && !['cancelled', 'rejected'].includes(o.status);
        });
        
        const rev = dayOrders.reduce((sum, o) => sum + o.total, 0);
        return { 
            label: d.toLocaleDateString('en-US', { weekday: 'short' }), 
            revenue: rev,
            fullDate: d.toLocaleDateString()
        };
    });

    return {
        daily: calcForRange(startOfDay),
        weekly: calcForRange(startOfWeek),
        monthly: calcForRange(startOfMonth),
        total: calcForRange(new Date(0)),
        chart: last7Days
    };
  }, [orders]);

  useEffect(() => {
      let watchId: number;
      const initLocation = async () => {
          try {
              const loc = await getBrowserLocation();
              setUserLocation({ lat: loc.lat, lng: loc.lng });
          } catch (e) { console.warn(e); }
      };
      initLocation();
      watchId = watchLocation((loc) => setUserLocation({ lat: loc.lat, lng: loc.lng }), (err) => {});
      
      if (user.id === 'demo-user') {
          setNearbyUsers([
              { id: 'mu-1', lat: (userLocation?.lat || 12.9716) + 0.005, lng: (userLocation?.lng || 77.5946) + 0.002 },
              { id: 'mu-2', lat: (userLocation?.lat || 12.9716) - 0.003, lng: (userLocation?.lng || 77.5946) + 0.006 },
              { id: 'mu-3', lat: (userLocation?.lat || 12.9716) + 0.002, lng: (userLocation?.lng || 77.5946) - 0.004 },
          ]);
      } else {
          supabase.from('profiles').select('id, last_lat, last_lng').eq('role', 'customer').not('last_lat', 'is', null).then(({data}) => {
              if (data) setNearbyUsers(data.map(u => ({ id: u.id, lat: u.last_lat, lng: u.last_lng })));
          });
      }
      return () => { if (watchId) clearWatch(watchId); };
  }, [user.id, userLocation?.lat]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const store = await getMyStore(user.id || '');
        setMyStore(store);
        
        if (store) {
            const [inv, ords] = await Promise.all([getStoreInventory(store.id), getIncomingOrders(store.id)]);
            setInventory(inv);
            setOrders(ords);
            if (!store.gstNumber) { setProfileForm(store); setShowProfileModal(true); }
        }
      } finally { setLoading(false); }
    };
    loadData();
  }, [user.id, activeTab]);

  const handleDownloadPDF = () => {
      if (!myStore) return;
      const dateStr = new Date().toISOString().slice(0, 10);
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.text(`Store Audit Report: ${myStore.name}`, 14, 22);
      autoTable(doc, { 
          head: [["Metric", "Daily", "Weekly", "Monthly", "Total"]], 
          body: [
              ["Sales", stats.daily.sales, stats.weekly.sales, stats.monthly.sales, stats.total.sales],
              ["Revenue (₹)", stats.daily.revenue.toFixed(0), stats.weekly.revenue.toFixed(0), stats.monthly.revenue.toFixed(0), stats.total.revenue.toFixed(0)],
              ["Profit (₹)", stats.daily.profit.toFixed(0), stats.weekly.profit.toFixed(0), stats.monthly.profit.toFixed(0), stats.total.profit.toFixed(0)],
              ["Margin (%)", `${stats.daily.margin.toFixed(0)}%`, `${stats.weekly.margin.toFixed(0)}%`, `${stats.monthly.margin.toFixed(0)}%`, `${stats.total.margin.toFixed(0)}%`]
          ],
          startY: 30 
      });
      // Better for mobile: trigger separate download logic
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Grocesphere_${myStore.name.replace(/\s+/g, '_')}_${dateStr}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    if (!myStore) return;
    const headers = ["Metric", "Daily", "Weekly", "Monthly", "Total"];
    const rows = [
      ["Sales", stats.daily.sales, stats.weekly.sales, stats.monthly.sales, stats.total.sales],
      ["Revenue", stats.daily.revenue.toFixed(0), stats.weekly.revenue.toFixed(0), stats.monthly.revenue.toFixed(0), stats.total.revenue.toFixed(0)],
      ["Profit", stats.daily.profit.toFixed(0), stats.weekly.profit.toFixed(0), stats.monthly.profit.toFixed(0), stats.total.profit.toFixed(0)],
      ["Margin", `${stats.daily.margin.toFixed(0)}%`, `${stats.weekly.margin.toFixed(0)}%`, `${stats.monthly.margin.toFixed(0)}%`, `${stats.total.margin.toFixed(0)}%`]
    ];
    let csvContent = headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Grocesphere_${myStore.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleInventoryUpdate = async (item: InventoryItem, price: number, inStock: boolean, stock: number, costPrice?: number) => {
      if (!myStore) return;
      if (!myStore.gstNumber) { alert("Verification required."); setShowProfileModal(true); return; }
      
      const finalCost = costPrice ?? item.costPrice ?? (price * 0.8);
      setInventory(prev => prev.map(i => i.id === item.id ? { ...i, storePrice: price, costPrice: finalCost, inStock, stock, isActive: true } : i));
      await updateInventoryItem(myStore.id, item.id, price, inStock, stock, item.brandDetails, item.mrp, finalCost);
  };

  const handleMarginUpdate = async (item: InventoryItem, marginPercent: number) => {
    const cost = item.costPrice || (item.storePrice * 0.8);
    // Formula: Price = Cost / (1 - Margin/100)
    const newPrice = Math.round(cost / (1 - (marginPercent / 100)));
    await handleInventoryUpdate(item, newPrice, item.inStock, item.stock, cost);
  };

  const handleOrderStatus = async (orderId: string, status: Order['status']) => {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      await updateStoreOrderStatus(orderId, status);
  };

  const handleCreateCustomProduct = async () => {
    if (!myStore || !customProduct.name || !customProduct.storePrice) return;
    
    const cost = parseFloat(customProduct.costPrice) || parseFloat(customProduct.storePrice) * 0.8;
    const newProduct: InventoryItem = {
      id: `custom-${Date.now()}`,
      name: customProduct.name,
      price: parseFloat(customProduct.storePrice),
      mrp: customProduct.mrp ? parseFloat(customProduct.mrp) : parseFloat(customProduct.storePrice),
      emoji: customProduct.emoji,
      category: customProduct.category,
      inStock: true,
      stock: parseInt(customProduct.stock) || 0,
      storePrice: parseFloat(customProduct.storePrice),
      costPrice: cost,
      isActive: true
    };

    await createCustomProduct(myStore.id, newProduct);
    setInventory([newProduct, ...inventory]);
    setShowAddProduct(false);
    setIsCreatingCustom(false);
    setCustomProduct({ name: '', emoji: '📦', category: 'General', costPrice: '', storePrice: '', stock: '10', mrp: '' });
  };

  const saveProfile = async () => {
    if (!myStore) return;
    setIsVerifying(true);
    try {
      await updateStoreProfile(myStore.id, profileForm);
      const updatedStore = { ...myStore, ...profileForm } as Store;
      setMyStore(updatedStore);
      setShowProfileModal(false);
    } catch (e) {
      alert("Failed to save profile. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-white">
        <SevenX7Logo size="medium" />
        <div className="w-10 h-1 border-slate-100 bg-slate-50 rounded-full mt-8 overflow-hidden relative"><div className="absolute inset-0 bg-brand-DEFAULT w-1/3 animate-[width_2s_infinite]"></div></div>
    </div>
  );

  if (!myStore) return <div className="p-10 text-center">Store not initialized.</div>;

  const managedInventory = inventory.filter(i => i.isActive);
  const catalogItems = inventory.filter(i => !i.isActive && i.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const currentStoreCategories = Array.from(new Set(inventory.map(i => i.category)));
  const maxChartValue = Math.max(...stats.chart.map(d => d.revenue), 100);

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col overflow-hidden">
      <header className="bg-white px-6 py-4 shadow-sm z-30 shrink-0 border-b border-slate-100">
         <div className="flex justify-between items-start">
             <div className="flex flex-col gap-1.5">
                 <h1 className="text-xl font-black text-slate-900 leading-none">{myStore.name}</h1>
                 <div className="flex justify-start"><SevenX7Logo size="xs" /></div>
             </div>
             <button onClick={() => { setProfileForm(myStore); setShowProfileModal(true); }} className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-lg active:scale-90 transition-transform">⚙️</button>
         </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-32 hide-scrollbar">
        {!myStore.gstNumber && (
            <div className="mb-6 bg-red-50 border-2 border-red-100 p-5 rounded-[2.5rem] flex items-center gap-4 animate-pulse">
                <span className="text-2xl">🚨</span>
                <p className="text-xs font-black text-red-600 uppercase leading-relaxed">Compliance Alert: GST verification missing.</p>
            </div>
        )}

        {activeTab === 'DASHBOARD' && (
            <div className="space-y-6 animate-fade-in">
                <div className="bg-slate-900 p-6 rounded-[2.5rem] shadow-soft-xl relative overflow-hidden text-white">
                     <div className="absolute top-0 right-0 w-40 h-40 bg-brand-DEFAULT/10 rounded-full blur-[60px]"></div>
                     <div className="flex justify-between items-start mb-6">
                        <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Profit (Lifetime)</p><h2 className="text-4xl font-black text-emerald-400">₹{stats.total.profit.toLocaleString()}</h2></div>
                        <div className="bg-white/10 px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest">LIVE</div>
                     </div>
                     <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-5">
                        <div><p className="text-[9px] text-slate-400 font-bold uppercase">Revenue</p><p className="text-base font-black">₹{stats.total.revenue.toLocaleString()}</p></div>
                        <div><p className="text-[9px] text-slate-400 font-bold uppercase">Orders</p><p className="text-base font-black">{stats.total.sales}</p></div>
                        <div><p className="text-[9px] text-slate-400 font-bold uppercase">Margin</p><p className="text-base font-black">{stats.total.margin.toFixed(0)}%</p></div>
                     </div>
                </div>

                <div className="bg-white p-6 rounded-[2.5rem] shadow-card border border-slate-100">
                    <h3 className="font-black text-slate-800 text-xs uppercase tracking-[0.2em] mb-8 text-center">7 Day Revenue Trend</h3>
                    <div className="flex items-end justify-between h-44 gap-2 px-1">
                        {stats.chart.map((day, i) => {
                            const barHeight = (day.revenue / maxChartValue) * 100;
                            const hasRevenue = day.revenue > 0;
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-3 h-full">
                                    <div className="w-full relative flex-1 flex flex-col justify-end bg-slate-100/50 rounded-2xl overflow-hidden border border-slate-100 shadow-inner">
                                        <div 
                                            className={`w-full transition-all duration-1000 ease-out shadow-[0_-4px_10px_rgba(0,0,0,0.1)] relative
                                                ${hasRevenue ? 'bg-gradient-to-t from-brand-medium to-brand-DEFAULT border-t-2 border-white/20' : 'bg-slate-200'}`} 
                                            style={{ height: `${Math.max(barHeight, hasRevenue ? 8 : 4)}%` }}
                                        />
                                    </div>
                                    <span className={`text-[8px] font-black uppercase tracking-tighter ${hasRevenue ? 'text-slate-900' : 'text-slate-400'}`}>{day.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button onClick={handleDownloadPDF} className="flex flex-col items-center justify-center bg-white py-7 rounded-[2.5rem] border border-slate-100 hover:bg-slate-900 hover:text-white transition-all shadow-card active:scale-95 group">
                        <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">📄</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">PDF Export</span>
                    </button>
                    <button onClick={handleDownloadCSV} className="flex flex-col items-center justify-center bg-white py-7 rounded-[2.5rem] border border-slate-100 hover:bg-slate-900 hover:text-white transition-all shadow-card active:scale-95 group">
                        <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">📊</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">CSV Data</span>
                    </button>
                </div>

                <div className="h-64 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-soft-xl relative">
                    <MapVisualizer stores={[myStore]} userLat={userLocation?.lat || null} userLng={userLocation?.lng || null} selectedStore={myStore} onSelectStore={() => {}} mode="DELIVERY" className="h-full" />
                </div>
            </div>
        )}

        {activeTab === 'INVENTORY' && (
            <div className="space-y-4">
                {!showAddProduct ? (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-white p-4 rounded-[2rem] border border-slate-100">
                            <div className="pl-2"><h2 className="font-black text-slate-900 text-lg">Inventory</h2><p className="text-[9px] text-slate-400 font-black uppercase">{managedInventory.length} Items Live</p></div>
                            <button onClick={() => setShowAddProduct(true)} className="bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-slate-900/20 active:scale-95 transition-all">Add Item +</button>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            {managedInventory.map((item) => {
                                const currentMargin = item.storePrice > 0 ? (((item.storePrice - (item.costPrice || item.storePrice * 0.8)) / item.storePrice) * 100).toFixed(0) : "0";
                                return (
                                <div key={item.id} className="bg-white rounded-[2rem] border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-3xl">{item.emoji}</div>
                                        <div className="flex-1 min-w-0"><h3 className="font-black text-slate-800 text-sm truncate">{item.name}</h3><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.category}</span></div>
                                        <button onClick={() => handleInventoryUpdate(item, item.storePrice, !item.inStock, item.stock)} className={`w-12 h-6 rounded-full relative transition-all ${item.inStock ? 'bg-emerald-500' : 'bg-slate-200'}`}><div className={`absolute top-1 bg-white w-4 h-4 rounded-full shadow-sm transition-all ${item.inStock ? 'right-1' : 'left-1'}`} /></button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-slate-50 p-3 rounded-2xl">
                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Stock</p>
                                            <input type="number" value={item.stock} onChange={e => handleInventoryUpdate(item, item.storePrice, item.inStock, parseInt(e.target.value))} className="w-full bg-white rounded-xl text-xs font-black text-center py-2 outline-none border border-slate-100 focus:border-brand-DEFAULT" />
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-2xl">
                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Price</p>
                                            <input type="number" value={item.storePrice} onChange={e => handleInventoryUpdate(item, parseFloat(e.target.value), item.inStock, item.stock)} className="w-full bg-white rounded-xl text-xs font-black text-center py-2 outline-none border border-slate-100 focus:border-brand-DEFAULT" />
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-2xl">
                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Margin %</p>
                                            <input type="number" value={currentMargin} onChange={e => handleMarginUpdate(item, parseFloat(e.target.value))} className="w-full bg-white rounded-xl text-xs font-black text-center py-2 outline-none border border-slate-100 focus:border-brand-DEFAULT text-emerald-600" />
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="animate-slide-up bg-white min-h-[85vh] rounded-[2.5rem] p-6 border border-slate-100 relative z-40 overflow-y-auto">
                        <div className="flex items-center gap-4 mb-8">
                            <button onClick={() => setShowAddProduct(false)} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-xl shadow-sm">←</button>
                            <div><h2 className="text-xl font-black">Add Products</h2><p className="text-[10px] text-slate-400 font-black uppercase">Grow your digital shelf</p></div>
                        </div>
                        
                        <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
                            <button onClick={() => setIsCreatingCustom(false)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${!isCreatingCustom ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Global Catalog</button>
                            <button onClick={() => setIsCreatingCustom(true)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${isCreatingCustom ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Custom Item</button>
                        </div>

                        {isCreatingCustom ? (
                            <div className="space-y-4 animate-fade-in">
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="col-span-3 space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Product Name</label>
                                        <input value={customProduct.name} onChange={e => setCustomProduct({...customProduct, name: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-brand-DEFAULT" placeholder="e.g. Handmade Sourdough" />
                                    </div>
                                    <div className="space-y-1 relative">
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 text-center block">Icon</label>
                                        <button 
                                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                          className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-center border-none outline-none focus:ring-2 focus:ring-brand-DEFAULT"
                                        >
                                          {customProduct.emoji}
                                        </button>
                                        {showEmojiPicker && (
                                          <div className="absolute top-full right-0 mt-2 bg-white rounded-2xl shadow-xl p-3 grid grid-cols-5 gap-2 z-[60] border border-slate-100 max-h-48 overflow-y-auto w-48">
                                            {EMOJI_OPTIONS.map(e => (
                                              <button key={e} onClick={() => { setCustomProduct({...customProduct, emoji: e}); setShowEmojiPicker(false); }} className="text-2xl hover:bg-slate-50 rounded-lg p-1 transition-colors">
                                                {e}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Category</label>
                                    <div className="relative">
                                        <select 
                                            value={customProduct.category} 
                                            onChange={e => setCustomProduct({...customProduct, category: e.target.value})} 
                                            className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-brand-DEFAULT appearance-none"
                                        >
                                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Cost Price (₹)</label>
                                        <input type="number" value={customProduct.costPrice} onChange={e => setCustomProduct({...customProduct, costPrice: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-brand-DEFAULT" placeholder="Wholesale" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Selling Price (₹)</label>
                                        <input type="number" value={customProduct.storePrice} onChange={e => setCustomProduct({...customProduct, storePrice: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-brand-DEFAULT" placeholder="Market Price" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Initial Stock</label>
                                        <input type="number" value={customProduct.stock} onChange={e => setCustomProduct({...customProduct, stock: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-brand-DEFAULT" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2">MRP (Optional)</label>
                                        <input type="number" value={customProduct.mrp} onChange={e => setCustomProduct({...customProduct, mrp: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-brand-DEFAULT" placeholder="MRP" />
                                    </div>
                                </div>
                                <button onClick={handleCreateCustomProduct} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase shadow-xl active:scale-95 transition-all mt-4">List Custom Product</button>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-fade-in">
                                <input placeholder="Search global products..." className="w-full bg-slate-50 p-4 pl-6 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-brand-DEFAULT border-none" onChange={e => setSearchTerm(e.target.value)} />
                                <div className="grid grid-cols-1 gap-3 max-h-[50vh] overflow-y-auto hide-scrollbar">
                                    {catalogItems.length === 0 ? (
                                        <div className="py-20 text-center opacity-40">
                                            <p className="text-4xl mb-4">🔍</p>
                                            <p className="font-bold text-xs uppercase">No matching products in catalog</p>
                                        </div>
                                    ) : (
                                        catalogItems.map(i => (
                                            <div key={i.id} className="flex justify-between items-center bg-white border border-slate-100 p-4 rounded-3xl hover:border-brand-light transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-2xl shadow-inner">{i.emoji}</div>
                                                    <div><h4 className="font-black text-slate-800 text-sm">{i.name}</h4><p className="text-[10px] text-slate-400 font-bold uppercase">₹{i.price}</p></div>
                                                </div>
                                                <button onClick={() => handleInventoryUpdate(i, i.price, true, 10, i.price * 0.8)} className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-emerald-100 shadow-sm active:scale-95 transition-all">Add +</button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}

        {activeTab === 'ORDERS' && (
            <div className="space-y-4 animate-fade-in pt-2">
                <div className="flex justify-between items-end mb-6 px-2"><div><h2 className="text-2xl font-black text-slate-900">Queue</h2><p className="text-[9px] text-slate-400 font-black uppercase">Active Transactions</p></div><div className="bg-emerald-50 px-3 py-1.5 rounded-full flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /><span className="text-[9px] font-black text-emerald-600 uppercase">LIVE</span></div></div>
                {orders.filter(o => !['delivered', 'picked_up', 'cancelled'].includes(o.status)).length === 0 ? (
                    <div className="bg-white p-12 rounded-[2.5rem] text-center border border-slate-100 shadow-sm"><div className="text-5xl mb-4 opacity-40">😴</div><p className="text-slate-800 font-black">Quiet Time</p><p className="text-slate-400 text-xs mt-1">Waiting for next community order...</p></div>
                ) : (
                    <div className="space-y-4 pb-20">
                    {orders.filter(o => !['delivered', 'picked_up', 'cancelled'].includes(o.status)).map(order => (
                        <div key={order.id} className="bg-white p-6 rounded-[2rem] shadow-card border border-slate-100">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1 min-w-0"><h3 className="font-black text-slate-900 text-base truncate">{order.customerName}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(order.date).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} • ₹{order.total}</p></div>
                                <div className="bg-orange-50 text-orange-600 px-3 py-1 rounded-xl text-[9px] font-black uppercase border border-orange-100">{order.status}</div>
                            </div>
                            <div className="bg-slate-50/50 p-4 rounded-2xl space-y-2 mb-6">
                                {order.items.map((item, idx) => (<div key={idx} className="flex justify-between items-center text-[11px] font-bold text-slate-600"><span>{item.quantity}x {item.name}</span><span>₹{item.price * item.quantity}</span></div>))}
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {order.status === 'placed' && <button onClick={() => handleOrderStatus(order.id, 'accepted')} className="w-full bg-emerald-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">Accept Order</button>}
                                {order.status === 'accepted' && <button onClick={() => handleOrderStatus(order.id, 'packing')} className="w-full bg-blue-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-blue-500/20 active:scale-95 transition-all">Start Packing</button>}
                                {order.status === 'packing' && <button onClick={() => handleOrderStatus(order.id, 'ready')} className="w-full bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all">Mark Ready</button>}
                                {order.status === 'ready' && <button onClick={() => handleOrderStatus(order.id, 'picked_up')} className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all">Pick Up Complete</button>}
                                <button onClick={() => handleOrderStatus(order.id, 'cancelled')} className="w-full text-red-500 text-[9px] font-black uppercase py-2 opacity-50 hover:opacity-100 transition-opacity">Reject</button>
                            </div>
                        </div>
                    ))}
                    </div>
                )}
            </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 px-8 py-4 flex justify-between z-40 shadow-soft max-w-lg mx-auto rounded-t-[2.5rem]">
           {[{ id: 'DASHBOARD', icon: '📈', label: 'Stats' }, { id: 'ORDERS', icon: '🔔', label: 'Orders' }, { id: 'INVENTORY', icon: '📦', label: 'Stock' }].map(item => (
             <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === item.id ? 'text-slate-900 scale-105' : 'text-slate-400'}`}>
                 <span className="text-2xl">{item.icon}</span>
                 <span className="text-[9px] font-black uppercase tracking-[0.1em]">{item.label}</span>
             </button>
           ))}
      </nav>

      {showProfileModal && (
          <div className="absolute inset-0 z-[100] bg-white flex flex-col p-8 overflow-y-auto animate-slide-up">
              <div className="flex justify-between items-center mb-10">
                  <div className="flex flex-col gap-2"><h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{myStore.name}</h2><SevenX7Logo size="xs" /></div>
                  {!isVerifying && myStore.gstNumber && <button onClick={() => setShowProfileModal(false)} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-xl shadow-sm">✕</button>}
              </div>
              <div className="space-y-6">
                  {!myStore.gstNumber && (
                    <div className="bg-red-50 p-6 rounded-[2.5rem] border border-red-100">
                        <h4 className="font-black text-red-600 text-sm uppercase tracking-widest mb-1">Onboarding Required</h4>
                        <p className="text-[11px] text-red-500 font-bold leading-relaxed">Local regulations require a valid GST and License number for all Community Marts before trading commences.</p>
                    </div>
                  )}

                  <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-4"><div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${profileForm.isOpen ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>{profileForm.isOpen ? '🔓' : '🔒'}</div><div><h4 className="font-black text-slate-800 text-sm">Mart Status</h4><p className={`text-[10px] font-black uppercase tracking-widest ${profileForm.isOpen ? 'text-emerald-600' : 'text-red-500'}`}>{profileForm.isOpen ? 'LIVE & SELLING' : 'STORE CLOSED'}</p></div></div>
                      <button onClick={() => setProfileForm({...profileForm, isOpen: !profileForm.isOpen})} className={`relative w-16 h-9 rounded-full transition-all ${profileForm.isOpen ? 'bg-emerald-500' : 'bg-slate-300'}`}><div className={`absolute top-1 bg-white w-7 h-7 rounded-full shadow transition-all ${profileForm.isOpen ? 'right-1' : 'left-1'}`}></div></button>
                  </div>
                  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-card space-y-5">
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Store Display Name</label><input value={profileForm.name || ''} onChange={e => setProfileForm({...profileForm, name: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none focus:ring-1 focus:ring-slate-100" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">GST / License Number <span className="text-red-500">*</span></label><input value={profileForm.gstNumber || ''} onChange={e => setProfileForm({...profileForm, gstNumber: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none focus:ring-1 focus:ring-slate-100" placeholder="Mandatory for verification" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Business UPI ID</label><input value={profileForm.upiId || ''} onChange={e => setProfileForm({...profileForm, upiId: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none focus:ring-1 focus:ring-slate-100" /></div>
                    <button onClick={saveProfile} className="w-full py-5 bg-slate-900 text-white font-black uppercase tracking-widest rounded-[2rem] shadow-xl active:scale-95 transition-all mt-4">Confirm Identity</button>
                  </div>
                  <div className="pt-6 border-t border-slate-100"><button onClick={onLogout} className="w-full flex items-center justify-center gap-3 bg-red-50 py-5 rounded-[2rem] border border-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-all"><span className="text-xl">🚪</span><span className="text-[10px] font-black uppercase tracking-widest">Logout Mart Session</span></button></div>
              </div>
          </div>
      )}
    </div>
  );
};
