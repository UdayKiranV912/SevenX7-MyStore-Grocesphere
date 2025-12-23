
import React, { useEffect, useState, useMemo } from 'react';
import { UserState, Store, Order, InventoryItem, BrandInventoryInfo, Settlement } from '../../types';
import { getMyStore, getStoreInventory, getIncomingOrders, updateStoreOrderStatus, updateInventoryItem, createCustomProduct, getSettlements } from '../../services/storeAdminService';
import SevenX7Logo from '../SevenX7Logo';
import { getBrowserLocation, watchLocation, clearWatch } from '../../services/locationService';
import { UserProfile } from '../UserProfile';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const EMOJI_GRID = ['🍎', '🥦', '🥚', '🍞', '🥛', '🥩', '🍗', '🐟', '🥤', '🧃', '🍫', '🍪', '🧊', '🧼', '🧻', '🧹', '📦', '🧴', '🦟', '🧂', '🍬', '🥘', '🥣', '🍇', '🍉', '🍍', '🥭', '🧅', '🧄'];

interface StoreAppProps {
  user: UserState;
  onLogout: () => void;
}

export const StoreApp: React.FC<StoreAppProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'ORDERS' | 'INVENTORY' | 'SETTLEMENTS' | 'PROFILE'>('DASHBOARD');
  const [myStore, setMyStore] = useState<Store | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('All');

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [addMode, setAddMode] = useState<'GLOBAL' | 'CUSTOM'>('CUSTOM');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '', emoji: '📦', category: 'General', price: '', stock: '10', mrp: '', cost: '', isNewCategory: false
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

  const handleUpdateItem = async (updates: Partial<InventoryItem>) => {
    if (!myStore || !editingItem) return;
    const finalItem = { ...editingItem, ...updates };
    setInventory(prev => prev.map(i => i.id === editingItem.id ? finalItem : i));
    await updateInventoryItem(myStore.id, editingItem.id, finalItem.storePrice, finalItem.stock > 0, finalItem.stock, finalItem.brandDetails, finalItem.mrp, finalItem.costPrice);
    setEditingItem(null);
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

    const inventoryStartY = (doc as any).lastAutoTable.finalY + 20;
    doc.text('HUB INVENTORY AUDIT', 15, inventoryStartY);
    
    autoTable(doc, {
      startY: inventoryStartY + 5,
      head: [['ITEM', 'CATEGORY', 'STOCK', 'MRP (INR)', 'OFFER (INR)']],
      body: inventory.filter(i => i.isActive).map(i => [
        i.name, i.category, i.stock, (i.mrp || i.price).toFixed(2), i.storePrice.toFixed(2)
      ]),
      headStyles: { fillColor: primaryColor, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      theme: 'striped'
    });

    doc.save(`Grocesphere_${myStore?.name?.replace(/\s+/g, '_')}_BI_Report.pdf`);
  };

  const generateCSV = () => {
    const headers = ['Settlement_Date', 'Settlement_ID', 'Transaction_ID', 'Admin_UPI_Source', 'Payout_Amount_INR', 'Payout_Status'];
    const rows = settlements.map(s => [
      new Date(s.date).toISOString().replace(/T/, ' ').replace(/\..+/, ''),
      s.id,
      s.transactionId,
      s.fromUpi,
      s.amount.toFixed(2),
      s.status
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Grocesphere_Payout_Ledger_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddProduct = async () => {
    if (!myStore || !newItem.name || !newItem.price || !newItem.category) return;
    setLoading(true);
    try {
      const product: InventoryItem = {
        id: `custom-${Date.now()}`, name: newItem.name, emoji: newItem.emoji, category: newItem.category, price: parseFloat(newItem.price), mrp: newItem.mrp ? parseFloat(newItem.mrp) : parseFloat(newItem.price) * 1.15, costPrice: newItem.cost ? parseFloat(newItem.cost) : parseFloat(newItem.price) * 0.8,
        storePrice: parseFloat(newItem.price), stock: parseInt(newItem.stock), inStock: parseInt(newItem.stock) > 0, isActive: true
      };
      await createCustomProduct(myStore.id, product);
      setIsAddingNew(false);
      setNewItem({ name: '', emoji: '📦', category: 'General', price: '', stock: '10', mrp: '', cost: '', isNewCategory: false });
      await loadData();
    } catch (e) { alert("Error adding product."); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col overflow-hidden">
      {/* Absolute Centered Header */}
      <header className="bg-white px-6 py-4 shadow-sm z-20 shrink-0 border-b border-slate-100 flex items-center justify-between relative h-28 sm:h-24">
         <div className="z-10 mt-1">
           <SevenX7Logo size="xs" hideBrandName={false} />
         </div>
         
         <div className="absolute left-1/2 -translate-x-1/2 text-center w-full max-w-[40%]">
           <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter leading-none truncate">{myStore?.name || 'Mart Hub'}</h1>
           <p className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.3em] mt-2">Active Cluster Terminal</p>
         </div>

         <button onClick={() => setActiveTab('PROFILE')} className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-xl shadow-inner active:scale-90 transition-transform z-10">
            ⚙️
         </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 pb-32 hide-scrollbar relative">
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-6 animate-fade-in max-w-lg mx-auto">
            {/* Revenue Highlights Card */}
            <div className="bg-[#0F172A] p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-3">Today's Settlement</p>
              <h2 className="text-5xl font-black text-white tracking-tighter leading-none mb-10">₹{analytics.chart[6].value.toLocaleString()}</h2>
              
              <div className="grid grid-cols-2 gap-4 pt-8 border-t border-white/5">
                  <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Weekly Profitability</p>
                      <p className="text-base font-black text-emerald-400">₹{analytics.totalProfit.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Weekly Orders</p>
                      <p className="text-base font-black text-blue-400">{analytics.totalOrders}</p>
                  </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
                <button onClick={generatePDF} className="bg-white p-8 rounded-[3rem] border border-slate-100 flex flex-col items-center gap-4 shadow-sm active:scale-95 transition-all">
                    <span className="text-4xl">📊</span>
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">BI PDF AUDIT</span>
                </button>
                <button onClick={generateCSV} className="bg-white p-8 rounded-[3rem] border border-slate-100 flex flex-col items-center gap-4 shadow-sm active:scale-95 transition-all">
                    <span className="text-4xl">📁</span>
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">EXPORT CSV</span>
                </button>
            </div>

            {/* 7-Day Performance Trends Chart */}
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm animate-slide-up">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight">Performance Trends</h3>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Revenue Analytics (Last 7 Days)</p>
                    </div>
                    <div className="text-right">
                        <span className="text-[8px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg uppercase">Live Sync</span>
                    </div>
                </div>

                <div className="flex items-end justify-between gap-3 h-32 mb-6">
                    {analytics.chart.map((day, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative h-full">
                            <div className="flex-1 w-full flex flex-col justify-end">
                                <div 
                                    className="w-full bg-slate-900 rounded-t-xl transition-all relative duration-1000 group-hover:bg-emerald-500" 
                                    style={{ height: `${(day.value / (analytics.maxVal || 1)) * 100}%` }}
                                >
                                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[7px] px-2 py-1 rounded-lg font-black whitespace-nowrap shadow-xl z-30">
                                        ₹{day.value}
                                    </div>
                                </div>
                            </div>
                            <span className="text-[7px] font-black text-slate-400 tracking-tighter">{day.label}</span>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        )}

        {activeTab === 'ORDERS' && (
          <div className="space-y-6 max-w-lg mx-auto">
              <div className="flex justify-between items-end px-4">
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Queue</h2>
                  <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Node</span>
                  </div>
              </div>
              
              <div className="space-y-4">
                  {orders.length === 0 ? (
                      <div className="text-center py-20 bg-white rounded-[3rem] border border-slate-100 shadow-sm">
                          <div className="text-6xl mb-6 opacity-20">🧾</div>
                          <h3 className="text-xl font-black text-slate-400">Queue is Clear</h3>
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-2">Awaiting incoming customer nodes</p>
                      </div>
                  ) : orders.filter(o => o.status === 'placed' || o.status === 'packing' || o.status === 'ready').map(order => (
                      <div key={order.id} className="bg-white p-6 rounded-[3.5rem] border border-slate-100 shadow-soft-xl animate-slide-up space-y-6">
                          <div className="flex justify-between items-start">
                              <div>
                                  <h3 className="text-xl font-black text-slate-900 leading-none mb-1">{order.customerName}</h3>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                      {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ₹{order.total}
                                  </p>
                              </div>
                              <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                  order.status === 'placed' ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                                  order.status === 'packing' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                                  'bg-emerald-50 text-emerald-600 border-emerald-100'
                              }`}>
                                  {order.status}
                              </span>
                          </div>

                          <div className="bg-slate-50/50 p-6 rounded-[2.5rem] space-y-3">
                              {order.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-center">
                                      <span className="text-[12px] font-bold text-slate-600">{item.quantity}x {item.name}</span>
                                      <span className="text-[12px] font-black text-slate-900">₹{item.price * item.quantity}</span>
                                  </div>
                              ))}
                          </div>

                          <div className="space-y-3">
                              {order.status === 'placed' && (
                                  <button onClick={() => handleUpdateStatus(order.id, 'packing')} className="w-full bg-emerald-500 text-white py-5 rounded-[2rem] font-black uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all">Accept Order</button>
                              )}
                              {order.status === 'packing' && (
                                  <button onClick={() => handleUpdateStatus(order.id, 'ready')} className="w-full bg-[#0F172A] text-white py-5 rounded-[2rem] font-black uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all">Mark Ready</button>
                              )}
                              <button onClick={() => handleUpdateStatus(order.id, 'rejected')} className="w-full py-4 text-[9px] font-black text-red-300 uppercase tracking-widest hover:text-red-500 transition-colors">Reject</button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
        )}

        {activeTab === 'INVENTORY' && (
          <div className="space-y-6 animate-fade-in max-w-lg mx-auto pb-10">
             {isAddingNew ? (
                 <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-4 animate-slide-up">
                    <button onClick={() => setIsAddingNew(false)} className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-xl shadow-inner mb-2">←</button>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Add Products</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grow your digital shelf</p>

                    <div className="flex bg-slate-100 p-1.5 rounded-2xl mt-8">
                        <button onClick={() => setAddMode('GLOBAL')} className={`flex-1 py-4 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${addMode === 'GLOBAL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Global Catalog</button>
                        <button onClick={() => setAddMode('CUSTOM')} className={`flex-1 py-4 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${addMode === 'CUSTOM' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Custom Item</button>
                    </div>

                    <div className="space-y-6 pt-6 animate-fade-in">
                        <div className="flex gap-4">
                            <div className="flex-1 space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2">Product Name</label>
                                <input placeholder="e.g. Handmade Sourdough" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full bg-slate-50/80 p-5 rounded-3xl font-bold shadow-inner border-none outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500" />
                            </div>
                            <div className="w-24 space-y-2 relative">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1 text-center block">Icon</label>
                                <div className="w-full aspect-square bg-slate-50 rounded-[2rem] border-2 border-slate-100 flex items-center justify-center text-4xl shadow-inner cursor-pointer hover:bg-white transition-all" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                                    {newItem.emoji}
                                </div>
                                {showEmojiPicker && (
                                    <div className="absolute top-full right-0 mt-4 bg-white p-6 rounded-[3rem] shadow-2xl border border-slate-100 z-[100] w-64 animate-scale-in">
                                        <div className="grid grid-cols-5 gap-3 max-h-60 overflow-y-auto hide-scrollbar">
                                            {EMOJI_GRID.map(e => (
                                                <button key={e} onClick={() => { setNewItem({...newItem, emoji: e}); setShowEmojiPicker(false); }} className="text-2xl hover:scale-125 transition-transform p-1">{e}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2">Category</label>
                             <div className="flex gap-2 overflow-x-auto py-1 hide-scrollbar">
                                 {categories.map(cat => (
                                     <button key={cat} onClick={() => setNewItem({...newItem, category: cat, isNewCategory: false})} className={`px-5 py-3 rounded-2xl text-[9px] font-black uppercase transition-all whitespace-nowrap border ${newItem.category === cat && !newItem.isNewCategory ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>{cat}</button>
                                 ))}
                                 <button onClick={() => setNewItem({...newItem, isNewCategory: true, category: ''})} className={`px-5 py-3 rounded-2xl text-[9px] font-black uppercase border whitespace-nowrap ${newItem.isNewCategory ? 'bg-[#0F172A] text-white' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>+ New</button>
                             </div>
                             {newItem.isNewCategory && (
                                 <input placeholder="Enter Category Name" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full bg-emerald-50/30 p-5 rounded-3xl font-bold border-emerald-100 border outline-none animate-slide-up mt-2" />
                             )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2">Cost Price (₹)</label>
                                <input type="number" placeholder="Wholesale" value={newItem.cost} onChange={e => setNewItem({...newItem, cost: e.target.value})} className="w-full bg-slate-50 p-5 rounded-3xl font-bold shadow-inner" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-2">Initial Stock</label>
                                <input type="number" value={newItem.stock} onChange={e => setNewItem({...newItem, stock: e.target.value})} className="w-full bg-slate-50 p-5 rounded-3xl font-bold shadow-inner" />
                            </div>
                        </div>

                        <button onClick={handleAddProduct} className="w-full bg-[#0F172A] text-white py-6 rounded-[2.5rem] font-black uppercase text-[11px] tracking-widest shadow-2xl active:scale-[0.98] transition-all">Deploy to Terminal</button>
                    </div>
                 </div>
             ) : (
                <div className="space-y-6">
                    <div className="flex justify-between items-center px-4">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Stock Console</h2>
                        <button onClick={() => setIsAddingNew(true)} className="bg-[#0F172A] text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-xl active:scale-95 transition-all">Add Item +</button>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-4 hide-scrollbar px-4">
                        <button onClick={() => setCategoryFilter('All')} className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase transition-all whitespace-nowrap border ${categoryFilter === 'All' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-400 border-slate-100'}`}>All</button>
                        {categories.map(cat => (
                            <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase transition-all whitespace-nowrap border ${categoryFilter === cat ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-slate-400 border-slate-100'}`}>{cat}</button>
                        ))}
                    </div>

                    <div className="space-y-3 px-4">
                        {inventory.filter(i => (categoryFilter === 'All' || i.category === categoryFilter) && i.isActive).map(item => (
                            <div key={item.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center gap-5 transition-all hover:border-emerald-200 shadow-sm">
                                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner">{item.emoji}</div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-black text-slate-900 text-sm truncate leading-none mb-1">{item.name}</h4>
                                    <div className="flex gap-2 mt-2">
                                        <span className="text-[8px] font-black text-slate-300 uppercase">MRP: ₹{item.mrp || item.price}</span>
                                        <span className="text-[8px] font-black text-emerald-500 uppercase">OFFER: ₹{item.storePrice}</span>
                                    </div>
                                </div>
                                <button onClick={() => setEditingItem(item)} className="px-5 py-3 bg-slate-50 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-100 transition-colors">Edit</button>
                            </div>
                        ))}
                    </div>
                </div>
             )}
          </div>
        )}

        {activeTab === 'SETTLEMENTS' && (
          <div className="space-y-6 max-w-lg mx-auto pb-10 px-4">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Settlements</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Incoming Payout Ledger</p>
              </div>
              <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase border border-emerald-100">
                Verified Terminal
              </div>
            </div>

            <div className="space-y-4">
              {settlements.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[3rem] border border-slate-100 shadow-sm">
                  <div className="text-6xl mb-6 opacity-20">💰</div>
                  <h3 className="text-xl font-black text-slate-400">No Settlements Yet</h3>
                </div>
              ) : settlements.map(st => (
                <div key={st.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4 animate-slide-up">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-slate-900 text-lg">₹{st.amount.toLocaleString()}</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Received from platform</p>
                    </div>
                    <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[8px] font-black">COMPLETED</span>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl space-y-2 border border-slate-100/50">
                    <div className="flex justify-between">
                      <span className="text-[8px] font-black text-slate-400 uppercase">Admin UPI</span>
                      <span className="text-[9px] font-mono text-slate-800">{st.fromUpi}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[8px] font-black text-slate-400 uppercase">Transaction ID</span>
                      <span className="text-[9px] font-mono text-slate-800">{st.transactionId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[8px] font-black text-slate-400 uppercase">Date</span>
                      <span className="text-[9px] font-black text-slate-500">{new Date(st.date).toLocaleDateString()} {new Date(st.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'PROFILE' && (
          <div className="fixed inset-0 z-[100] bg-white">
              <header className="px-8 py-8 bg-white/90 backdrop-blur-xl flex justify-between items-center z-[110] border-b border-slate-50">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="w-14 h-14 flex items-center justify-center text-2xl font-black bg-slate-50 rounded-2xl shadow-inner active:scale-90 transition-all">✕</button>
                  <h2 className="font-black uppercase tracking-[0.3em] text-[10px] text-slate-400">Hub Settings</h2>
                  <div className="w-14"></div>
              </header>
              <div className="h-full overflow-y-auto hide-scrollbar"><UserProfile user={user} onUpdateUser={loadData} onLogout={onLogout} /></div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-slate-100 px-6 py-6 flex justify-between z-40 max-w-lg mx-auto rounded-t-[4rem] shadow-float">
           {[
             { id: 'DASHBOARD', icon: '📈', label: 'Stats' }, 
             { id: 'ORDERS', icon: '🔔', label: 'Orders' }, 
             { id: 'INVENTORY', icon: '📦', label: 'Stock' },
             { id: 'SETTLEMENTS', icon: '💰', label: 'Payouts' }
           ].map(item => (
             <button key={item.id} onClick={() => { setActiveTab(item.id as any); setIsAddingNew(false); }} className={`flex flex-col items-center gap-2 transition-all ${activeTab === item.id ? 'text-slate-900 scale-110' : 'text-slate-300'}`}>
                 <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl transition-all ${activeTab === item.id ? 'bg-[#0F172A] text-white shadow-xl' : 'bg-transparent text-slate-400'}`}>
                    {item.id === 'DASHBOARD' ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"></path></svg>
                    ) : item.id === 'ORDERS' ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"></path></svg>
                    ) : item.id === 'INVENTORY' ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM5.884 6.68a1 1 0 10-1.415-1.414l.707-.707a1 1 0 001.415 1.414l-.707.707zm11.312 0l-.707-.707a1 1 0 00-1.415 1.414l.707.707a1 1 0 001.415-1.414zM5 11a1 1 0 011-1h2a1 1 0 110 2H6a1 1 0 01-1-1zm11 0a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1zM10 11a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1zM2.993 15.291a1 1 0 011.414 0l.708.707a1 1 0 01-1.414 1.415l-.708-.708a1 1 0 010-1.414zm15.601 0a1 1 0 010 1.414l-.708.708a1 1 0 11-1.414-1.415l.708-.707a1 1 0 011.414 0zM10 16a1 1 0 100-2 1 1 0 000 2z"></path></svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    )}
                 </div>
                 <span className="text-[8px] font-black uppercase tracking-[0.3em] leading-none">{item.label}</span>
             </button>
           ))}
      </nav>
    </div>
  );
};
