
import React, { useEffect, useState, useMemo } from 'react';
import { UserState, Store, Order, InventoryItem, BrandInventoryInfo, Settlement, AdCampaign } from '../../types';
import { getMyStore, getStoreInventory, getIncomingOrders, updateStoreOrderStatus, updateInventoryItem, createCustomProduct, getSettlements, updateStoreProfile } from '../../services/storeAdminService';
import SevenX7Logo from '../SevenX7Logo';
import { getBrowserLocation, watchLocation, clearWatch } from '../../services/locationService';
import { UserProfile } from '../UserProfile';
import { MapVisualizer } from '../MapVisualizer';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const EMOJI_GRID = ['🍎', '🥦', '🥚', '🍞', '🥛', '🥩', '🍗', '🐟', '🥤', '🧃', '🍫', '🍪', '🧊', '🧼', '🧻', '🧹', '📦', '🧴', '🦟', '🧂', '🍬', '🥘', '🥣', '🍇', '🍉', '🍍', '🥭', '🧅', '🧄'];

interface StoreAppProps {
  user: UserState;
  onLogout: () => void;
}

export const StoreApp: React.FC<StoreAppProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'ORDERS' | 'INVENTORY' | 'SETTLEMENTS' | 'ADS' | 'LOCATION' | 'PROFILE'>('DASHBOARD');
  const [myStore, setMyStore] = useState<Store | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Ad State
  const [isCreatingAd, setIsCreatingAd] = useState(false);
  const [newAd, setNewAd] = useState({ title: '', description: '', productId: '' });

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [addMode, setAddMode] = useState<'GLOBAL' | 'CUSTOM'>('CUSTOM');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '', emoji: '📦', imageUrl: '', category: 'General', price: '', stock: '10', mrp: '', cost: '', isNewCategory: false
  });

  const categories = useMemo(() => {
    const cats = new Set(inventory.filter(i => i.isActive).map(i => i.category));
    return Array.from(cats).sort();
  }, [inventory]);

  useEffect(() => {
    let watchId: number;
    getBrowserLocation().then(loc => setUserLocation({ lat: loc.lat, lng: loc.lng })).catch(() => {});
    watchId = watchLocation((loc) => setUserLocation({ lat: loc.lat, lng: loc.lng }), () => {});
    return () => { if (watchId) clearWatch(watchId); };
  }, []);

  const loadData = async () => {
    try {
      const store = await getMyStore(user.id || '');
      setMyStore(store);
      if (store) {
        const [inv, ords, stls] = await Promise.all([
          getStoreInventory(store.id), 
          getIncomingOrders(store.id),
          getSettlements(store.id)
        ]);
        setInventory(inv);
        setOrders(ords);
        setSettlements(stls);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [user.id]);

  const analytics = useMemo(() => {
    const validOrders = orders.filter(o => !['cancelled', 'rejected'].includes(o.status));
    const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);
    const totalProfit = validOrders.reduce((sum, o) => {
        const itemsProfit = o.items.reduce((pSum, item) => pSum + (item.price - (item.costPrice || item.price * 0.7)) * item.quantity, 0);
        return sum + itemsProfit;
    }, 0);
    
    const chart = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(new Date().getDate() - (6 - i));
        const dayRevenue = validOrders.filter(o => new Date(o.date).toDateString() === d.toDateString()).reduce((sum, o) => sum + o.total, 0);
        return { label: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(), value: dayRevenue };
    });

    const maxVal = Math.max(...chart.map(c => c.value), 100);
    return { totalRevenue, totalProfit, totalOrders: validOrders.length, chart, maxVal };
  }, [orders]);

  const handleUpdateStatus = async (orderId: string, status: Order['status']) => {
      await updateStoreOrderStatus(orderId, status);
      loadData();
  };

  const detectAndSetLocation = async () => {
      setLoading(true);
      try {
          const loc = await getBrowserLocation();
          handleUpdateLocation(loc.lat, loc.lng);
      } catch (e: any) {
          alert("Could not detect location: " + e.message);
      } finally {
          setLoading(false);
      }
  };

  const handleUpdateLocation = async (lat: number, lng: number) => {
      if (!myStore) return;
      setLoading(true);
      try {
          await updateStoreProfile(myStore.id, { lat, lng });
          await loadData();
          alert("Location calibrated successfully!");
          setActiveTab('DASHBOARD');
      } catch (e) {
          alert("Calibration failed.");
      } finally {
          setLoading(false);
      }
  };

  const handleCreateAd = async () => {
      if (!myStore || !newAd.title) return;
      setLoading(true);
      try {
          const campaign: AdCampaign = {
              id: `ad-${Date.now()}`,
              ...newAd,
              status: 'active'
          };
          const updatedAds = [...(myStore.ads || []), campaign];
          await updateStoreProfile(myStore.id, { ...myStore, ads: updatedAds } as any);
          setIsCreatingAd(false);
          setNewAd({ title: '', description: '', productId: '' });
          await loadData();
      } finally {
          setLoading(false);
      }
  };

  const handleUpdateItem = async (updates: Partial<InventoryItem>) => {
    if (!myStore || !editingItem) return;
    const finalItem = { ...editingItem, ...updates };
    setInventory(prev => prev.map(i => i.id === editingItem.id ? finalItem : i));
    await updateInventoryItem(myStore.id, editingItem.id, finalItem.storePrice, finalItem.stock > 0, finalItem.stock, finalItem.brandDetails, finalItem.mrp, finalItem.costPrice);
    setEditingItem(null);
  };

  const handleAddProduct = async () => {
    if (!myStore || !newItem.name || !newItem.price || !newItem.category) return;
    setLoading(true);
    try {
      const product: InventoryItem = {
        id: `custom-${Date.now()}`, name: newItem.name, emoji: newItem.emoji, imageUrl: newItem.imageUrl, category: newItem.category, price: parseFloat(newItem.price), mrp: newItem.mrp ? parseFloat(newItem.mrp) : parseFloat(newItem.price) * 1.15, costPrice: newItem.cost ? parseFloat(newItem.cost) : parseFloat(newItem.price) * 0.8,
        storePrice: parseFloat(newItem.price), stock: parseInt(newItem.stock), inStock: parseInt(newItem.stock) > 0, isActive: true
      };
      await createCustomProduct(myStore.id, product);
      setIsAddingNew(false);
      setNewItem({ name: '', emoji: '📦', imageUrl: '', category: 'General', price: '', stock: '10', mrp: '', cost: '', isNewCategory: false });
      await loadData();
    } catch (e) { alert("Error adding product."); } finally { setLoading(false); }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const primaryColor = [15, 23, 42]; 
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('BI PERFORMANCE DASHBOARD', 15, 25);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`PARTNER: ${myStore?.name?.toUpperCase() || 'HUB TERMINAL'}`, 15, 35);
    doc.text(`GENERATED: ${new Date().toLocaleString().toUpperCase()}`, 140, 35);

    const tiles = [
      { label: 'GROSS SETTLEMENT', value: `INR ${analytics.totalRevenue.toLocaleString()}`, color: [255, 255, 255] },
      { label: 'EST. NET PROFIT', value: `INR ${analytics.totalProfit.toLocaleString()}`, color: [16, 185, 129] },
      { label: 'TOTAL TRAFFIC', value: `${analytics.totalOrders} NODES`, color: [59, 130, 246] },
      { label: 'HUB STATUS', value: 'VERIFIED', color: [255, 255, 255] }
    ];

    tiles.forEach((tile, i) => {
      const x = 15 + (i * 48);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240); 
      doc.roundedRect(x, 55, 43, 30, 3, 3, 'FD');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139); 
      doc.text(tile.label, x + 5, 65);
      doc.setFontSize(10); 
      doc.setTextColor(tile.color[0], tile.color[1], tile.color[2]);
      if (tile.color[0] === 255) doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(tile.value, x + 5, 75);
    });

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('FINANCIAL SETTLEMENT LOG (INCOMING)', 15, 100);
    
    autoTable(doc, {
      startY: 105,
      head: [['DATE', 'TRANSACTION ID', 'ADMIN SOURCE', 'AMOUNT (INR)', 'STATUS']],
      body: settlements.map(s => [
        new Date(s.date).toLocaleDateString(),
        s.transactionId,
        s.fromUpi,
        s.amount.toFixed(2),
        s.status
      ]),
      headStyles: { fillColor: [51, 65, 85], fontSize: 8 }, 
      bodyStyles: { fontSize: 8 },
      theme: 'grid'
    });

    doc.save(`Grocesphere_${myStore?.name?.replace(/\s+/g, '_')}_BI_Report.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col overflow-hidden">
      <header className="bg-white px-6 shadow-sm z-20 shrink-0 border-b border-slate-100 flex items-center justify-between relative h-16 sm:h-20">
         <div className="z-10">
           <SevenX7Logo size="xs" hideGrocesphere={true} />
         </div>
         
         <div className="absolute left-1/2 -translate-x-1/2 text-center w-full max-w-[40%]">
           <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tighter leading-none truncate">{myStore?.name || 'Mart Hub'}</h1>
           <p className="text-[7px] font-black text-emerald-500 uppercase tracking-[0.3em] mt-1">Live Cluster Node</p>
         </div>

         <div className="flex gap-2 z-10">
            <button onClick={() => setActiveTab('LOCATION')} className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg shadow-inner active:scale-90 transition-transform">
                📍
            </button>
            <button onClick={() => setActiveTab('PROFILE')} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg shadow-inner active:scale-90 transition-transform">
                ⚙️
            </button>
         </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-32 hide-scrollbar relative">
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-6 animate-fade-in max-w-lg mx-auto">
            <div className="bg-[#0F172A] p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-3">Today's Settlement</p>
              <h2 className="text-5xl font-black text-white tracking-tighter leading-none mb-10">₹{analytics.chart[6].value.toLocaleString()}</h2>
              <div className="grid grid-cols-2 gap-4 pt-8 border-t border-white/5">
                  <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Weekly Profit</p>
                      <p className="text-base font-black text-emerald-400">₹{analytics.totalProfit.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Weekly Nodes</p>
                      <p className="text-base font-black text-blue-400">{analytics.totalOrders}</p>
                  </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setActiveTab('ADS')} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex flex-col items-center gap-3 shadow-sm active:scale-95 transition-all">
                    <span className="text-3xl">📢</span>
                    <span className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">Create Ads</span>
                </button>
                <button onClick={generatePDF} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex flex-col items-center gap-3 shadow-sm active:scale-95 transition-all">
                    <span className="text-3xl">📊</span>
                    <span className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">PDF Audit</span>
                </button>
            </div>
          </div>
        )}

        {activeTab === 'ADS' && (
          <div className="space-y-6 max-w-lg mx-auto">
             <div className="flex justify-between items-end px-4">
                 <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Ad Manager</h2>
                 <button onClick={() => setIsCreatingAd(true)} className="bg-emerald-500 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95">Create New Ad</button>
             </div>

             {isCreatingAd && (
                 <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-xl space-y-6 animate-slide-up">
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">Campaign Title</label>
                        <input placeholder="e.g. Weekend Flash Sale" value={newAd.title} onChange={e => setNewAd({...newAd, title: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold shadow-inner border-none outline-none" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">Promotion Text</label>
                        <textarea placeholder="Tell your customers what's special..." value={newAd.description} onChange={e => setNewAd({...newAd, description: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold shadow-inner border-none outline-none h-24 resize-none" />
                    </div>
                    <div className="flex gap-4">
                        <button onClick={handleCreateAd} className="flex-1 bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-widest">Launch Campaign</button>
                        <button onClick={() => setIsCreatingAd(false)} className="px-6 bg-slate-100 text-slate-400 py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-widest">Cancel</button>
                    </div>
                 </div>
             )}

             <div className="space-y-4">
                 {myStore?.ads?.map(ad => (
                     <div key={ad.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
                         <div>
                             <h4 className="font-black text-slate-900 text-base">{ad.title}</h4>
                             <p className="text-[10px] text-slate-400 font-bold">{ad.description}</p>
                         </div>
                         <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-[8px] font-black uppercase">Active</span>
                     </div>
                 )) || (
                    <div className="text-center py-20 bg-white rounded-[3rem] border border-slate-100 opacity-30 font-black uppercase tracking-widest text-[10px]">No Active Campaigns</div>
                 )}
             </div>
          </div>
        )}

        {activeTab === 'LOCATION' && (
          <div className="h-full flex flex-col animate-fade-in max-w-lg mx-auto">
             <div className="px-4 mb-6 flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Calibrate GPS</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Ensure your mart appears exactly where it is.</p>
                </div>
                <button onClick={detectAndSetLocation} className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg active:scale-95 animate-bounce-soft">
                   Detect Live Location
                </button>
             </div>
             <div className="flex-1 relative rounded-[3rem] overflow-hidden border-4 border-white shadow-soft-xl">
                <MapVisualizer 
                   stores={[]} 
                   userLat={myStore?.lat || 12.9716} 
                   userLng={myStore?.lng || 77.5946} 
                   selectedStore={null} 
                   onSelectStore={() => {}} 
                   mode="PICKUP" 
                   isSelectionMode={true}
                   onMapClick={handleUpdateLocation}
                   forcedCenter={{ lat: myStore?.lat || 12.9716, lng: myStore?.lng || 77.5946 }}
                />
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl z-[1000]">
                   Touch Map To Move Mart
                </div>
             </div>
             <button onClick={() => setActiveTab('DASHBOARD')} className="mt-6 w-full py-5 bg-white border border-slate-100 rounded-[2rem] text-slate-400 font-black uppercase text-[10px] tracking-widest">Return to Dashboard</button>
          </div>
        )}

        {activeTab === 'INVENTORY' && (
          <div className="space-y-6 animate-fade-in max-w-lg mx-auto pb-10">
             {isAddingNew ? (
                 <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-4 animate-slide-up overflow-y-auto max-h-[80vh] hide-scrollbar">
                    <button onClick={() => setIsAddingNew(false)} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-xl shadow-inner mb-2">←</button>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Add Products</h2>
                    
                    <div className="space-y-6 pt-6">
                        <div className="flex gap-4">
                            <div className="flex-1 space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">Product Name</label>
                                <input placeholder="e.g. Handmade Sourdough" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full bg-slate-50 p-5 rounded-3xl font-bold shadow-inner border-none outline-none" />
                            </div>
                            <div className="w-24 space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase text-center block tracking-widest">Icon</label>
                                <div className="w-full aspect-square bg-slate-50 rounded-[2rem] border-2 border-slate-100 flex items-center justify-center text-4xl shadow-inner cursor-pointer" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                                    {newItem.emoji}
                                </div>
                                {showEmojiPicker && (
                                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-black/20 backdrop-blur-sm" onClick={() => setShowEmojiPicker(false)}>
                                        <div className="bg-white p-8 rounded-[3rem] shadow-2xl max-w-xs grid grid-cols-5 gap-3" onClick={e => e.stopPropagation()}>
                                            {EMOJI_GRID.map(e => <button key={e} onClick={() => { setNewItem({...newItem, emoji: e}); setShowEmojiPicker(false); }} className="text-2xl hover:scale-125 transition-transform">{e}</button>)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">Product Image Link (Google Drive)</label>
                            <input placeholder="Paste Drive Sharing Link Here" value={newItem.imageUrl} onChange={e => setNewItem({...newItem, imageUrl: e.target.value})} className="w-full bg-emerald-50/20 p-5 rounded-3xl font-bold border border-emerald-100/50 shadow-inner" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">Offer Price (₹)</label>
                                <input type="number" placeholder="Customer Pays" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} className="w-full bg-slate-50 p-5 rounded-3xl font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">Stock Level</label>
                                <input type="number" value={newItem.stock} onChange={e => setNewItem({...newItem, stock: e.target.value})} className="w-full bg-slate-50 p-5 rounded-3xl font-bold" />
                            </div>
                        </div>

                        <button onClick={handleAddProduct} className="w-full bg-[#0F172A] text-white py-6 rounded-[2.5rem] font-black uppercase text-[11px] tracking-widest shadow-2xl">Deploy to Mart</button>
                    </div>
                 </div>
             ) : (
                <div className="space-y-6">
                    <div className="flex justify-between items-center px-4">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Stock Console</h2>
                        <button onClick={() => setIsAddingNew(true)} className="bg-[#0F172A] text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-xl">Add Item +</button>
                    </div>

                    <div className="space-y-3 px-4">
                        {inventory.filter(i => (categoryFilter === 'All' || i.category === categoryFilter) && i.isActive).map(item => (
                            <div key={item.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center gap-5 shadow-sm">
                                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner overflow-hidden">
                                    {item.imageUrl ? <img src={item.imageUrl.replace('/d/', '/uc?id=').split('/')[0] === 'https:' ? item.imageUrl : `https://drive.google.com/uc?id=${item.imageUrl.split('id=')[1]}`} className="w-full h-full object-cover" /> : item.emoji}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-black text-slate-900 text-sm truncate mb-1">{item.name}</h4>
                                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">₹{item.storePrice}</span>
                                </div>
                                <button onClick={() => setEditingItem(item)} className="px-5 py-3 bg-slate-50 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-sm">Edit</button>
                            </div>
                        ))}
                    </div>
                </div>
             )}
          </div>
        )}
        {/* Other tabs omitted for brevity, same as previous version */}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-slate-100 px-6 py-6 flex justify-between z-40 max-w-lg mx-auto rounded-t-[4rem] shadow-float">
           {[
             { id: 'DASHBOARD', icon: '📈', label: 'Stats' }, 
             { id: 'ORDERS', icon: '🔔', label: 'Queue' }, 
             { id: 'INVENTORY', icon: '📦', label: 'Stock' },
             { id: 'SETTLEMENTS', icon: '💰', label: 'Payouts' }
           ].map(item => (
             <button key={item.id} onClick={() => { setActiveTab(item.id as any); setIsAddingNew(false); }} className={`flex flex-col items-center gap-2 transition-all ${activeTab === item.id ? 'text-slate-900 scale-110' : 'text-slate-300'}`}>
                 <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl transition-all ${activeTab === item.id ? 'bg-[#0F172A] text-white shadow-xl' : 'bg-transparent text-slate-400'}`}>
                    {item.icon}
                 </div>
                 <span className="text-[8px] font-black uppercase tracking-[0.3em] leading-none">{item.label}</span>
             </button>
           ))}
      </nav>
    </div>
  );
};
