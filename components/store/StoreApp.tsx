
import React, { useEffect, useState, useMemo } from 'react';
import { UserState, Store, Order, InventoryItem, BrandInventoryInfo } from '../../types';
import { getMyStore, getStoreInventory, getIncomingOrders, updateStoreOrderStatus, updateInventoryItem, createCustomProduct, updateStoreProfile } from '../../services/storeAdminService';
import { supabase } from '../../services/supabaseClient';
import SevenX7Logo from '../SevenX7Logo';
import { MapVisualizer } from '../MapVisualizer';
import { getBrowserLocation, watchLocation, clearWatch } from '../../services/locationService';
import { UserProfile } from '../UserProfile';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StoreAppProps {
  user: UserState;
  onLogout: () => void;
}

export const StoreApp: React.FC<StoreAppProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'ORDERS' | 'TRANSACTIONS' | 'INVENTORY' | 'PROFILE'>('DASHBOARD');
  const [myStore, setMyStore] = useState<Store | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('All');

  const [showAddOverlay, setShowAddOverlay] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '', emoji: '📦', category: 'General', cost: '', price: '', stock: '10', mrp: ''
  });

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
        const [inv, ords] = await Promise.all([getStoreInventory(store.id), getIncomingOrders(store.id)]);
        setInventory(inv);
        setOrders(ords);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [user.id]);

  const analytics = useMemo(() => {
    const validOrders = orders.filter(o => !['cancelled', 'rejected'].includes(o.status));
    const totalRevenue = validOrders.reduce((sum, o) => sum + (o.paymentMethod === 'ONLINE' ? (o.splits?.storeAmount || o.total) : o.total), 0);
    const totalProfit = validOrders.reduce((sum, o) => sum + o.items.reduce((pSum, item) => pSum + (item.price - (item.costPrice || item.price * 0.75)) * item.quantity, 0), 0);
    
    const now = new Date();
    const chart = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(now.getDate() - (6 - i));
        const dayRevenue = validOrders.filter(o => new Date(o.date).toDateString() === d.toDateString()).reduce((sum, o) => sum + (o.paymentMethod === 'ONLINE' ? (o.splits?.storeAmount || o.total) : o.total), 0);
        return { label: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(), value: dayRevenue };
    });

    return { totalRevenue, totalProfit, totalOrders: validOrders.length, chart };
  }, [orders]);

  const generatePDF = () => {
    const doc = new jsPDF();
    const darkSlate = [15, 23, 42];

    doc.setFillColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.rect(0, 0, 210, 45, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(`${myStore?.name || 'Mart'} Analytics`, 15, 22);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Business Intelligence Dashboard • ${new Date().toLocaleDateString()}`, 15, 32);

    const drawKpi = (label: string, value: string, x: number) => {
        doc.setFillColor(245, 248, 250);
        doc.roundedRect(x, 55, 58, 35, 3, 3, 'F');
        doc.setDrawColor(220, 225, 230);
        doc.roundedRect(x, 55, 58, 35, 3, 3, 'D');
        
        doc.setTextColor(100, 110, 120);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(label.toUpperCase(), x + 5, 65);
        
        doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
        doc.setFontSize(16);
        doc.text(value, x + 5, 80);
    };

    drawKpi('NET REVENUE', `INR ${analytics.totalRevenue.toLocaleString()}`, 15);
    drawKpi('GROSS MARGIN', `INR ${analytics.totalProfit.toLocaleString()}`, 76);
    drawKpi('ORDERS FULFILLED', `${analytics.totalOrders}`, 137);

    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.setFontSize(12);
    doc.text('Itemized Transaction Feed', 15, 110);
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(1);
    doc.line(15, 112, 35, 112);

    autoTable(doc, {
      startY: 118,
      head: [['REF ID', 'DATE', 'MODE', 'PAYMENT', 'AMOUNT']],
      body: orders.map(o => [
        o.transactionId?.slice(-8) || o.id.slice(-8),
        new Date(o.date).toLocaleDateString(),
        o.mode,
        o.paymentMethod === 'ONLINE' ? 'DIGITAL' : 'DIRECT',
        `INR ${o.total}`
      ]),
      headStyles: { fillColor: darkSlate, fontSize: 9, cellPadding: 4 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      theme: 'grid'
    });

    const pages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setTextColor(180);
        doc.setFontSize(8);
        doc.text('Generated via My store Grocesphere Merchant Terminal • Internal Data', 105, 290, { align: 'center' });
    }

    doc.save(`${myStore?.name || 'Mart'}_Intelligence_Report.pdf`);
  };

  const generateCSV = () => {
    const headers = ['Txn ID', 'Timestamp', 'Customer', 'Items Total', 'Delivery', 'Final Total', 'Payment Type', 'Status'];
    const rows = orders.map(o => [
      o.transactionId || o.id,
      new Date(o.date).toISOString(),
      o.customerName || 'Anonymous',
      o.splits?.storeAmount || o.total,
      o.splits?.deliveryFee || 0,
      o.total,
      o.paymentMethod,
      o.status
    ]);
    const blob = new Blob([[headers, ...rows].map(e => e.join(",")).join("\n")], { type: 'text/csv' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${myStore?.name || 'Mart'}_Settlement_Data.csv`;
    link.click();
  };

  const handleUpdateStock = async (productId: string, updates: Partial<InventoryItem>) => {
    if (!myStore) return;
    const item = inventory.find(i => i.id === productId);
    if (!item) return;
    const updatedItem = { ...item, ...updates };
    setInventory(prev => prev.map(i => i.id === productId ? updatedItem : i));
    await updateInventoryItem(myStore.id, productId, updatedItem.storePrice, updatedItem.inStock, updatedItem.stock, item.brandDetails, updatedItem.mrp, updatedItem.costPrice);
  };

  const handleOrderStatusUpdate = async (orderId: string, currentStatus: string) => {
    const nextMap: any = { 'placed': 'accepted', 'accepted': 'packing', 'packing': 'on_way', 'on_way': 'delivered', 'ready': 'picked_up' };
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    let next = nextMap[currentStatus] || 'delivered';
    if (order.mode === 'PICKUP' && currentStatus === 'packing') next = 'ready';
    await updateStoreOrderStatus(orderId, next);
    await loadData();
  };

  const handleAddProduct = async () => {
    if (!myStore || !newItem.name || !newItem.price) return;
    setLoading(true);
    try {
      const product: InventoryItem = {
        id: `custom-${Date.now()}`, name: newItem.name, emoji: newItem.emoji, category: newItem.category, price: parseFloat(newItem.price), mrp: newItem.mrp ? parseFloat(newItem.mrp) : parseFloat(newItem.price) * 1.2, costPrice: parseFloat(newItem.cost || '0') || parseFloat(newItem.price) * 0.8,
        storePrice: parseFloat(newItem.price), stock: parseInt(newItem.stock), inStock: parseInt(newItem.stock) > 0, isActive: true
      };
      await createCustomProduct(myStore.id, product);
      setShowAddOverlay(false);
      setNewItem({ name: '', emoji: '📦', category: 'General', cost: '', price: '', stock: '10', mrp: '' });
      await loadData();
    } catch (e) { alert("Error adding product."); } finally { setLoading(false); }
  };

  if (loading && inventory.length === 0) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
      <SevenX7Logo size="medium" />
      <div className="mt-8 flex flex-col items-center gap-2">
          <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 w-1/2 animate-[width_2s_infinite]"></div></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mart Cloud Console...</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col overflow-hidden">
      <header className="bg-white px-6 py-4 shadow-sm z-20 shrink-0 border-b border-slate-100 flex justify-between items-center">
         <div className="flex items-center gap-4">
           <SevenX7Logo size="xs" hideBrandName={true} />
           <div className="h-6 w-px bg-slate-100"></div>
           <h1 className="text-base font-black text-slate-900 tracking-tighter leading-none">{myStore?.name}</h1>
         </div>
         <button onClick={() => setActiveTab('PROFILE')} className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-lg shadow-sm active:scale-90 transition-transform">⚙️</button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-28 hide-scrollbar">
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-4 animate-fade-in max-w-lg mx-auto">
            {/* 1. Map View (Reduced) */}
            <div className="h-32 rounded-3xl overflow-hidden shadow-sm border border-slate-100 relative group">
                <MapVisualizer stores={myStore ? [myStore] : []} userLat={userLocation?.lat || null} userLng={userLocation?.lng || null} selectedStore={myStore} onSelectStore={() => {}} mode="DELIVERY" className="h-full transition-transform duration-700 group-hover:scale-105" />
            </div>

            {/* 2. Total Revenue (Reduced) */}
            <div className="bg-[#0F172A] p-5 rounded-[1.75rem] text-white shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-[40px] -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <p className="text-[7px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Mart Settlement Value</p>
                        <h2 className="text-2xl font-black text-emerald-400 tracking-tighter leading-none">₹{analytics.totalRevenue.toLocaleString()}</h2>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full text-center">
                        <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none">14% GP</p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/5">
                    <div className="space-y-0.5"><p className="text-[6px] font-black text-slate-500 uppercase tracking-widest">Margin</p><p className="text-xs font-black">₹{analytics.totalProfit.toLocaleString()}</p></div>
                    <div className="space-y-0.5"><p className="text-[6px] font-black text-slate-500 uppercase tracking-widest">Orders</p><p className="text-xs font-black">{analytics.totalOrders}</p></div>
                    <div className="space-y-0.5"><p className="text-[6px] font-black text-slate-500 uppercase tracking-widest">Status</p><p className="text-xs font-black text-emerald-400">LIVE</p></div>
                </div>
              </div>
            </div>

            {/* 3. Export Buttons */}
            <div className="grid grid-cols-2 gap-3">
                <button onClick={generatePDF} className="bg-white px-4 py-5 rounded-[1.5rem] border border-slate-100 flex flex-col items-center gap-1 shadow-sm active:scale-95 transition-all group">
                    <span className="text-xl group-hover:scale-110 transition-transform">📄</span>
                    <span className="text-[8px] font-black text-slate-900 uppercase tracking-[0.1em]">BI Terminal PDF</span>
                </button>
                <button onClick={generateCSV} className="bg-white px-4 py-5 rounded-[1.5rem] border border-slate-100 flex flex-col items-center gap-1 shadow-sm active:scale-95 transition-all group">
                    <span className="text-xl group-hover:scale-110 transition-transform">📊</span>
                    <span className="text-[8px] font-black text-slate-900 uppercase tracking-[0.1em]">Settlement CSV</span>
                </button>
            </div>

            {/* 4. Weekly Trend (7 Days) */}
            <div className="bg-white p-5 rounded-[1.75rem] shadow-sm border border-slate-100">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[8px] font-black text-slate-900 uppercase tracking-[0.2em]">Revenue Velocity (7 Days)</h3>
               </div>
               <div className="flex items-end justify-between h-24 gap-1.5">
                 {analytics.chart.map((day, idx) => {
                   const maxVal = Math.max(...analytics.chart.map(v => v.value), 100);
                   const heightPercent = (day.value / maxVal) * 100;
                   return (
                     <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full group">
                        <div className="w-full bg-slate-50 rounded-full flex flex-col justify-end h-full overflow-hidden border border-slate-50/50 shadow-inner group-hover:bg-slate-100 transition-colors">
                          <div className="bg-gradient-to-t from-emerald-600 to-emerald-400 w-full transition-all duration-700 ease-out rounded-full shadow-lg" style={{ height: `${Math.max(heightPercent, 4)}%` }}></div>
                        </div>
                        <span className="text-[5px] font-black text-slate-400 tracking-tighter uppercase">{day.label}</span>
                     </div>
                   );
                 })}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'ORDERS' && (
          <div className="space-y-4 animate-fade-in max-w-lg mx-auto">
             <div className="px-2 flex justify-between items-end">
                <div><h2 className="text-xl font-black text-slate-900 tracking-tighter">Queue</h2></div>
                <div className="bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1 border border-emerald-100"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /><span className="text-[8px] font-black text-emerald-600 tracking-widest">LIVE</span></div>
             </div>
             <div className="space-y-3">
                {orders.filter(o => !['delivered', 'picked_up', 'cancelled', 'rejected'].includes(o.status)).map(order => (
                    <div key={order.id} className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-slate-100">
                        <div className="flex justify-between items-start mb-4">
                            <div><h3 className="font-black text-slate-900 text-base leading-tight">{order.customerName}</h3><p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">INR {order.total} • {order.paymentMethod}</p></div>
                            <div className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border border-orange-100">{order.status}</div>
                        </div>
                        <button onClick={() => handleOrderStatusUpdate(order.id, order.status)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all">Update Workflow</button>
                    </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'TRANSACTIONS' && (
          <div className="space-y-4 animate-fade-in max-w-lg mx-auto">
             <div className="px-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tighter">Settlements</h2>
             </div>
             <div className="space-y-2">
                {orders.filter(o => o.paymentStatus === 'PAID' || o.paymentMethod === 'DIRECT').map(txn => (
                    <div key={txn.id} className="bg-white p-4 rounded-[1.25rem] shadow-sm border border-slate-100 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shadow-inner ${txn.paymentMethod === 'ONLINE' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                            {txn.paymentMethod === 'ONLINE' ? '💸' : '🏪'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start"><h4 className="font-black text-slate-900 text-[10px] truncate uppercase">Ref: {txn.transactionId?.slice(-8) || 'CASH'}</h4><span className="text-[10px] font-black text-slate-900">INR {txn.total}</span></div>
                            <p className="text-[7px] font-bold text-slate-300 uppercase tracking-widest mt-1">{new Date(txn.date).toLocaleDateString()}</p>
                        </div>
                    </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'INVENTORY' && (
          <div className="space-y-4 animate-fade-in max-w-lg mx-auto">
             <div className="flex justify-between items-center px-2 mb-2">
                <div className="flex flex-col"><h2 className="text-xl font-black text-slate-900 tracking-tighter">Inventory</h2></div>
                <button onClick={() => setShowAddOverlay(true)} className="bg-slate-900 text-white px-4 py-2.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Add +</button>
             </div>
             <div className="grid grid-cols-1 gap-3">
                {inventory.filter(i => (categoryFilter === 'All' || i.category === categoryFilter) && i.isActive).map(item => (
                    <div key={item.id} className={`bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center gap-4 ${!item.inStock ? 'grayscale opacity-50' : ''}`}>
                        <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-2xl shadow-inner">{item.emoji}</div>
                        <div className="flex-1 min-w-0"><h4 className="font-black text-slate-900 text-sm truncate leading-tight">{item.name}</h4><p className="text-[8px] text-slate-400 font-black uppercase">{item.category}</p></div>
                        <button onClick={() => handleUpdateStock(item.id, { inStock: !item.inStock })} className={`relative w-10 h-6 rounded-full transition-all ${item.inStock ? 'bg-emerald-500' : 'bg-slate-200'}`}><div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${item.inStock ? 'right-0.5' : 'left-0.5'}`} /></button>
                    </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'PROFILE' && (
            <div className="fixed inset-0 z-[100] bg-white pt-16">
                <header className="fixed top-0 left-0 right-0 px-6 py-4 bg-white flex justify-between items-center z-[110] border-b border-slate-100">
                    <button onClick={() => setActiveTab('DASHBOARD')} className="w-8 h-8 flex items-center justify-center text-xl font-black bg-slate-50 rounded-lg shadow-sm">✕</button>
                    <h2 className="font-black uppercase tracking-[0.2em] text-[9px] text-slate-400">Merchant Settings</h2><div className="w-8"></div>
                </header>
                <div className="h-full overflow-y-auto"><UserProfile user={user} onUpdateUser={loadData} onLogout={onLogout} /></div>
            </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-slate-100 px-6 py-4 flex justify-between z-40 max-w-lg mx-auto rounded-t-[2rem] shadow-float">
           {[
             { id: 'DASHBOARD', icon: '📈', label: 'Stats' }, 
             { id: 'ORDERS', icon: '🔔', label: 'Queue' }, 
             { id: 'TRANSACTIONS', icon: '💸', label: 'Txns' }, 
             { id: 'INVENTORY', icon: '📦', label: 'Stock' }
           ].map(item => (
             <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`flex flex-col items-center gap-1 transition-all ${activeTab === item.id ? 'text-slate-900 scale-105' : 'text-slate-300 hover:text-slate-600'}`}>
                 <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all ${activeTab === item.id ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-300'}`}>{item.icon}</div>
                 <span className="text-[6px] font-black uppercase tracking-[0.1em] leading-none">{item.label}</span>
             </button>
           ))}
      </nav>

      {showAddOverlay && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-end justify-center">
              <div className="bg-white w-full max-w-lg rounded-t-[2rem] p-6 animate-slide-up shadow-2xl relative overflow-y-auto max-h-[80vh] hide-scrollbar">
                  <div className="flex justify-between items-center mb-6">
                      <div className="flex flex-col"><h3 className="text-xl font-black text-slate-900 tracking-tighter leading-none">Add Product</h3></div>
                      <button onClick={() => { setShowAddOverlay(false); }} className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-lg text-slate-300">✕</button>
                  </div>
                  <div className="space-y-4 pb-12">
                      <input placeholder="Product Name" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl font-bold border-none outline-none focus:ring-1 focus:ring-emerald-500 shadow-inner" />
                      <div className="grid grid-cols-2 gap-3">
                          <input type="number" placeholder="Price INR" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl font-bold outline-none shadow-inner" />
                          <input type="number" placeholder="Stock" value={newItem.stock} onChange={e => setNewItem({...newItem, stock: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl font-bold outline-none shadow-inner" />
                      </div>
                      <button onClick={handleAddProduct} className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-[9px] rounded-xl shadow-xl active:scale-95 transition-all mt-4">Publish Item</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
