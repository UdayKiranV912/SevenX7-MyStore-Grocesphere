
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Profile, Store, Order, InventoryItem, Payout, LiveLocation } from '../../types';
import SevenX7Logo from '../SevenX7Logo';
import { MapVisualizer } from '../MapVisualizer';
import { fetchOrders, fetchInventory, fetchPayouts, getMyStore, updateOrderStatus, updateInventoryItem, addItemToInventory, getDemoData } from '../../services/storeAdminService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PREDEFINED_CATEGORIES = [
  { label: 'Dairy', emoji: '🥛' },
  { label: 'Vegetables & Fruits', emoji: '🥬' },
  { label: 'Mini Mart', emoji: '🏪' },
  { label: 'Big Mart', emoji: '🏬' },
  { label: 'Home Care', emoji: '🧼' },
  { label: 'Snacks & Drinks', emoji: '🥤' }
];

export const StoreApp: React.FC<{user: Profile, onLogout: () => void, isDemo?: boolean}> = ({ user, onLogout, isDemo = false }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'ORDERS' | 'INVENTORY' | 'PAYMENTS' | 'REPORTS' | 'PROFILE'>('DASHBOARD');
  const [store, setStore] = useState<Store | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [riderLocations, setRiderLocations] = useState<Record<string, LiveLocation>>({});
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItem, setNewItem] = useState<Omit<InventoryItem, 'id' | 'store_id'>>({
    name: '',
    category: 'Mini Mart',
    emoji: '🏪',
    mrp: 0,
    offer_price: 0,
    stock: 0,
    active: true
  });

  const loadData = async () => {
    if (isDemo) {
      const demo = getDemoData();
      setStore(demo.store); setOrders(demo.orders); setInventory(demo.inventory); setPayouts(demo.payouts);
      setLoading(false);
      return;
    }
    const s = await getMyStore(user.id);
    if (!s) return;
    setStore(s);
    const [o, i, p] = await Promise.all([fetchOrders(s.id), fetchInventory(s.id), fetchPayouts(s.upi_id)]);
    setOrders(o); setInventory(i); setPayouts(p);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    if (!isDemo && store) {
      const orderChannel = supabase.channel(`store-orders-${store.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${store.id}` }, () => fetchOrders(store.id).then(setOrders))
        .subscribe();

      const invChannel = supabase.channel(`store-inv-${store.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory', filter: `store_id=eq.${store.id}` }, () => fetchInventory(store.id).then(setInventory))
        .subscribe();

      const payChannel = supabase.channel(`store-pay-${store.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `store_upi=eq.${store.upi_id}` }, () => fetchPayouts(store.upi_id).then(setPayouts))
        .subscribe();

      const locChannel = supabase.channel('rider-tracking')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'live_locations' }, payload => {
          setRiderLocations(prev => ({ ...prev, [payload.new.user_id]: payload.new as LiveLocation }));
        }).subscribe();

      return () => {
        supabase.removeChannel(orderChannel);
        supabase.removeChannel(invChannel);
        supabase.removeChannel(payChannel);
        supabase.removeChannel(locChannel);
      };
    }
  }, [user.id, store?.id, isDemo]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today);
    const revenue = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.total_amount, 0);
    const outOfStock = inventory.filter(i => i.stock <= 0).length;
    return {
      revenue,
      total: orders.length,
      today: todayOrders.length,
      pending: orders.filter(o => o.status === 'placed').length,
      outOfStock
    };
  }, [orders, inventory]);

  const generateReport = (format: 'PDF' | 'CSV') => {
    if (format === 'CSV') {
      const headers = ['Order ID', 'Date', 'Amount', 'Status', 'Mode'];
      const rows = orders.map(o => [o.id, new Date(o.created_at).toLocaleString(), o.total_amount, o.status, o.mode]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Advanced_BI_${store?.name}.csv`; a.click();
    } else {
      const doc = new jsPDF();
      
      // Power BI Style Header
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 45, 'F');
      
      doc.setTextColor(255);
      doc.setFontSize(26);
      doc.text(store?.name?.toUpperCase() || 'HUB TERMINAL', 15, 25);
      
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`OPERATIONAL INTELLIGENCE REPORT | CLUSTER NODE: ${store?.id.slice(0, 16)}`, 15, 35);
      doc.text(`GENERATED AT: ${new Date().toLocaleString()}`, 135, 35);

      // KPI Boxes (Simulated boxes)
      doc.setFillColor(30, 41, 59); // slate-800
      doc.roundedRect(15, 50, 45, 25, 3, 3, 'F');
      doc.roundedRect(65, 50, 45, 25, 3, 3, 'F');
      doc.roundedRect(115, 50, 45, 25, 3, 3, 'F');
      doc.roundedRect(165, 50, 30, 25, 3, 3, 'F');

      doc.setFontSize(8);
      doc.setTextColor(255);
      doc.text('TOTAL REVENUE', 20, 58);
      doc.text('ORDER VOLUME', 70, 58);
      doc.text('AVG ORDER VAL', 120, 58);
      doc.text('OOS SKUs', 170, 58);

      doc.setFontSize(14);
      doc.text(`INR ${stats.revenue}`, 20, 68);
      doc.text(`${stats.total}`, 70, 68);
      doc.text(`INR ${(stats.revenue/stats.total || 0).toFixed(1)}`, 120, 68);
      doc.text(`${stats.outOfStock}`, 170, 68);

      // Main Table
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.text("TRANSACTION LEDGER", 15, 90);
      
      autoTable(doc, {
        startY: 95,
        head: [['Order Ref', 'Timestamp', 'Customer', 'Mode', 'Amount (INR)', 'Status']],
        body: orders.map(o => [
          `#${o.id.slice(-6)}`, 
          new Date(o.created_at).toLocaleDateString(), 
          o.customer_name || 'N/A', 
          o.mode.toUpperCase(), 
          o.total_amount, 
          o.status.toUpperCase()
        ]),
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${pageCount} | SevenX7 Innovations - Secure Node Network`, 15, 285);
      }

      doc.save(`Advanced_BI_Report_${store?.name}.pdf`);
    }
  };

  const handleUpdateItem = async (itemId: string, field: string, val: string | number | boolean) => {
    const updated = inventory.map(i => i.id === itemId ? { ...i, [field]: val } : i);
    setInventory(updated);
    if (!isDemo) {
      try {
        await updateInventoryItem(itemId, { [field]: val });
      } catch (e) {
        console.error("Update failed", e);
      }
    }
  };

  const handleAddProduct = async () => {
    if (!store) return;
    try {
      if (isDemo) {
        setInventory([...inventory, { ...newItem, id: Math.random().toString(), store_id: store.id }]);
      } else {
        const added = await addItemToInventory(store.id, newItem);
        setInventory([...inventory, added]);
      }
      setIsAddModalOpen(false);
      setNewItem({ name: '', category: 'Mini Mart', emoji: '🏪', mrp: 0, offer_price: 0, stock: 0, active: true });
    } catch (e) {
      alert("Failed to add product. Ensure fields are valid.");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
      <div className="w-14 h-14 border-4 border-white/5 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
      <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">Establishing Peer Connection...</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#F8FAFC] flex flex-col text-slate-900 overflow-hidden font-sans">
      <header className="bg-white border-b border-slate-100 px-8 py-5 flex justify-between items-center shrink-0 z-50">
          <div className="flex items-center gap-4">
              <SevenX7Logo size="xs" hideGrocesphere={true} />
              <div className="h-6 w-px bg-slate-100 hidden sm:block"></div>
              <h1 className="text-sm font-black text-slate-900 truncate uppercase hidden sm:block">{store?.name}</h1>
          </div>
          <div className="flex items-center gap-4">
              <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100 hidden sm:block">● Operational Live</div>
              <button onClick={() => setActiveTab('PROFILE')} className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg active:scale-90 transition-all">👤</button>
          </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 pb-32 hide-scrollbar">
        {activeTab === 'DASHBOARD' && (
          <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { label: 'Realized Revenue', val: `₹${stats.revenue.toLocaleString()}`, color: 'text-emerald-600', icon: '💸' },
                    { label: 'Daily Volume', val: stats.today, color: 'text-slate-900', icon: '📦' },
                    { label: 'Unfulfilled', val: stats.pending, color: 'text-amber-500', icon: '🕒' },
                    { label: 'Low Stock SKU', val: stats.outOfStock, color: 'text-red-500', icon: '⚠️' }
                  ].map((k, i) => (
                    <div key={i} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-xl transition-all">
                        <div className="text-3xl mb-4">{k.icon}</div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{k.label}</p>
                            <h2 className={`text-4xl font-black tracking-tighter ${k.color}`}>{k.val}</h2>
                        </div>
                    </div>
                  ))}
              </div>

              <div className="bg-slate-900 p-12 rounded-[4.5rem] text-white shadow-2xl relative overflow-hidden group">
                   <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] -mr-48 -mt-48 transition-transform duration-1000 group-hover:scale-125"></div>
                   <div className="relative z-10 space-y-10">
                        <div>
                           <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-4">Enterprise Insights</p>
                           <h3 className="text-5xl font-black tracking-tighter leading-none">Hub Visualizer<br/><span className="text-slate-500">BI Analytics Node</span></h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                           <button onClick={() => generateReport('PDF')} className="bg-white/10 hover:bg-white/20 p-8 rounded-[2.5rem] border border-white/10 transition-all flex items-center gap-6 group">
                               <span className="text-3xl group-hover:scale-110 transition-transform">📄</span>
                               <div className="text-left">
                                   <p className="text-[11px] font-black uppercase text-white">Power BI Report (PDF)</p>
                                   <p className="text-[8px] text-white/40 uppercase tracking-widest">Executive Summary</p>
                               </div>
                           </button>
                           <button onClick={() => generateReport('CSV')} className="bg-white/10 hover:bg-white/20 p-8 rounded-[2.5rem] border border-white/10 transition-all flex items-center gap-6 group">
                               <span className="text-3xl group-hover:scale-110 transition-transform">📊</span>
                               <div className="text-left">
                                   <p className="text-[11px] font-black uppercase text-white">Data Lake Export (CSV)</p>
                                   <p className="text-[8px] text-white/40 uppercase tracking-widest">Raw Data Stream</p>
                               </div>
                           </button>
                        </div>
                   </div>
              </div>
          </div>
        )}

        {activeTab === 'ORDERS' && (
          <div className="max-w-4xl mx-auto space-y-10 animate-fade-in">
              <div className="flex justify-between items-end px-4">
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">Job Queue</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-3 tracking-[0.2em]">Fulfillment Pipeline</p>
                  </div>
              </div>

              {orders.length === 0 ? (
                <div className="py-32 text-center opacity-10 font-black uppercase text-4xl tracking-[0.5em]">No Pending Jobs</div>
              ) : (
                <div className="space-y-6">
                  {orders.map(order => {
                    const rider = order.delivery_partner_id ? riderLocations[order.delivery_partner_id] : null;
                    return (
                      <div key={order.id} className="bg-white border border-slate-100 p-10 rounded-[4rem] shadow-soft-xl space-y-8 hover:shadow-2xl transition-all group">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
                              <div>
                                  <h4 className="font-black text-slate-900 text-3xl mb-1">{order.customer_name || 'Anonymous Peer'}</h4>
                                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em]">Order #{order.id.slice(-6)} • {order.mode.toUpperCase()}</p>
                              </div>
                              <div className={`px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] border ${order.status === 'placed' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                  {order.status}
                              </div>
                          </div>

                          {order.mode === 'delivery' && order.status !== 'delivered' && (
                             <div className="h-64 rounded-[3rem] overflow-hidden border border-slate-100 relative shadow-inner">
                                 <MapVisualizer
                                    stores={[]}
                                    userLat={order.delivery_lat || 12.9716}
                                    userLng={order.delivery_lng || 77.5946}
                                    selectedStore={null}
                                    onSelectStore={() => {}}
                                    mode="delivery"
                                    driverLocation={rider ? { lat: rider.lat, lng: rider.lng } : null}
                                 />
                                 <div className="absolute top-6 right-6 bg-white/90 backdrop-blur-md px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl border border-white">Tracking Link: {rider ? 'LIVE' : 'PENDING'}</div>
                             </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             {order.status === 'placed' && <button onClick={() => updateOrderStatus(order.id, 'accepted')} className="py-6 bg-emerald-500 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-xl hover:bg-emerald-400 active:scale-95 transition-all">Accept Job</button>}
                             {order.status === 'accepted' && <button onClick={() => updateOrderStatus(order.id, 'packing')} className="py-6 bg-slate-900 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-xl hover:bg-slate-800 active:scale-95 transition-all">Start Packing</button>}
                             {order.status === 'packing' && <button onClick={() => updateOrderStatus(order.id, order.mode === 'delivery' ? 'ready' : 'delivered')} className="py-6 bg-blue-600 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-xl hover:bg-blue-500 active:scale-95 transition-all">Mark Ready</button>}
                          </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        )}

        {activeTab === 'INVENTORY' && (
          <div className="max-w-6xl mx-auto space-y-12 animate-fade-in">
              <div className="flex justify-between items-center px-4">
                  <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">Catalog Hub</h2>
                  <button onClick={() => setIsAddModalOpen(true)} className="bg-slate-900 text-white px-10 py-5 rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl active:scale-95 transition-all">+ New Catalog Node</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {inventory.map(item => (
                    <div key={item.id} className="bg-white border border-slate-100 p-10 rounded-[4.5rem] shadow-sm flex flex-col gap-8 group hover:shadow-2xl transition-all">
                        <div className="flex items-center gap-6">
                            <div className="w-24 h-24 bg-slate-50 rounded-[3rem] flex items-center justify-center text-6xl shadow-inner group-hover:scale-110 transition-transform duration-500">
                                {item.emoji || '📦'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-black text-slate-900 text-2xl leading-none mb-2 truncate">{item.name}</h4>
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{item.category}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
                                <p className="text-[10px] font-black text-slate-300 uppercase mb-2 tracking-widest">Live Stock Units</p>
                                <input 
                                  type="number" 
                                  value={item.stock} 
                                  onChange={(e) => handleUpdateItem(item.id, 'stock', parseInt(e.target.value) || 0)}
                                  className="w-full bg-transparent text-2xl font-black text-slate-900 border-none outline-none focus:ring-0 p-0"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-300 uppercase mb-2 tracking-widest">MRP (₹)</p>
                                    <input 
                                      type="number" 
                                      value={item.mrp} 
                                      onChange={(e) => handleUpdateItem(item.id, 'mrp', parseFloat(e.target.value) || 0)}
                                      className="w-full bg-transparent text-xl font-black text-slate-900 border-none outline-none focus:ring-0 p-0"
                                    />
                                </div>
                                <div className="bg-emerald-50/50 p-5 rounded-[2rem] border border-emerald-100">
                                    <p className="text-[9px] font-black text-emerald-400 uppercase mb-2 tracking-widest">OFFER (₹)</p>
                                    <input 
                                      type="number" 
                                      value={item.offer_price} 
                                      onChange={(e) => handleUpdateItem(item.id, 'offer_price', parseFloat(e.target.value) || 0)}
                                      className="w-full bg-transparent text-xl font-black text-emerald-600 border-none outline-none focus:ring-0 p-0"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                  ))}
              </div>
          </div>
        )}

        {activeTab === 'PAYMENTS' && (
           <div className="max-w-2xl mx-auto space-y-10 animate-fade-in">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight px-6 leading-none">Settlement Ledger</h2>
              <div className="space-y-4">
                 {payouts.length === 0 ? (
                   <div className="py-32 text-center opacity-10 font-black uppercase text-3xl tracking-[0.5em]">Awaiting Peer Data</div>
                 ) : payouts.map(p => (
                   <div key={p.id} className="bg-white border border-slate-100 p-10 rounded-[4rem] shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                        <div className="flex items-center gap-8">
                            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-[2.5rem] flex items-center justify-center text-3xl font-black shadow-inner">₹</div>
                            <div>
                                <h4 className="font-black text-slate-900 text-2xl tracking-tight">₹{p.store_amount.toLocaleString()}</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.transaction_ref || 'PENDING SETTLEMENT'}</p>
                            </div>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-5 py-2.5 rounded-2xl ${p.settled ? 'text-emerald-500 bg-emerald-50 border border-emerald-100' : 'text-amber-500 bg-amber-50 border border-amber-100'}`}>
                            {p.settled ? 'SETTLED' : 'PROCESSING'}
                        </span>
                   </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'PROFILE' && (
          <div className="max-w-2xl mx-auto space-y-10 animate-fade-in">
              <div className="bg-white p-14 rounded-[5rem] shadow-soft-xl border border-slate-100 text-center flex flex-col items-center">
                  <div className="w-28 h-28 bg-slate-900 rounded-[3rem] flex items-center justify-center text-4xl font-black text-white mb-8 border-8 border-slate-50 shadow-2xl">
                    {store?.name?.charAt(0)}
                  </div>
                  <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">{store?.name}</h3>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Hub Node: {store?.id.slice(0,16)}</p>
                  
                  <div className="mt-14 w-full space-y-4">
                      <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 text-left">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Address Descriptor</p>
                          <p className="font-bold text-slate-700 text-lg leading-relaxed">{store?.address}</p>
                      </div>
                      <div className="bg-emerald-50 p-10 rounded-[3rem] border border-emerald-100 text-left flex justify-between items-center">
                          <div>
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Operational Governance</p>
                            <p className="font-bold text-slate-900 text-lg">Verified Active Node ✓</p>
                            <p className="text-[11px] text-emerald-400 font-bold mt-2">Cycle End: {new Date(user.fee_paid_until).toLocaleDateString()}</p>
                          </div>
                          <span className="text-4xl">💎</span>
                      </div>
                  </div>
                  
                  <button onClick={onLogout} className="w-full py-7 bg-red-50 text-red-500 rounded-[3rem] font-black uppercase text-[11px] tracking-[0.5em] border border-red-100 mt-12 hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95">Terminate Terminal Session</button>
              </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-3xl border-t border-slate-100 px-10 py-6 flex justify-between z-50 max-w-xl mx-auto rounded-t-[4.5rem] shadow-float">
           {[
             { id: 'DASHBOARD', icon: '📊', label: 'Terminal' }, 
             { id: 'ORDERS', icon: '📦', label: 'Orders' }, 
             { id: 'INVENTORY', icon: '💎', label: 'Inventory' },
             { id: 'PAYMENTS', icon: '💸', label: 'Ledger' }
           ].map(item => (
             <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`flex flex-col items-center gap-2 transition-all ${activeTab === item.id ? 'text-blue-600 scale-110' : 'text-slate-300'}`}>
                 <div className={`w-14 h-14 rounded-3xl flex items-center justify-center text-3xl transition-all ${activeTab === item.id ? 'bg-slate-900 text-white shadow-xl' : 'bg-transparent text-slate-400'}`}>{item.icon}</div>
                 <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
             </button>
           ))}
      </nav>

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-[4rem] p-10 w-full max-w-md shadow-2xl animate-scale-in relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-2 bg-slate-900"></div>
               <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-8">New Catalog Node</h3>
               
               <div className="space-y-5">
                  <div className="flex gap-4">
                     <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-4xl shadow-inner border border-slate-100 overflow-hidden">
                        <input 
                           type="text" 
                           value={newItem.emoji} 
                           onChange={e => setNewItem({...newItem, emoji: e.target.value})} 
                           className="w-full h-full text-center bg-transparent border-none outline-none focus:ring-0 font-bold"
                           placeholder="🎁"
                        />
                     </div>
                     <div className="flex-1 space-y-2">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest pl-1">Product Name</p>
                        <input 
                           type="text" 
                           placeholder="Enter item name..." 
                           value={newItem.name} 
                           onChange={e => setNewItem({...newItem, name: e.target.value})}
                           className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner outline-none focus:ring-1 focus:ring-slate-900" 
                        />
                     </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                     <div>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest pl-1 mb-2">Category Mapping</p>
                        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                           {PREDEFINED_CATEGORIES.map(cat => (
                              <button 
                                 key={cat.label} 
                                 onClick={() => setNewItem({...newItem, category: cat.label, emoji: cat.emoji})}
                                 className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase whitespace-nowrap border transition-all ${newItem.category === cat.label ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                              >
                                 {cat.label}
                              </button>
                           ))}
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest pl-1">MRP (₹)</p>
                        <input 
                           type="number" 
                           value={newItem.mrp} 
                           onChange={e => setNewItem({...newItem, mrp: parseFloat(e.target.value) || 0})}
                           className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" 
                        />
                     </div>
                     <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest pl-1">OFFER (₹)</p>
                        <input 
                           type="number" 
                           value={newItem.offer_price} 
                           onChange={e => setNewItem({...newItem, offer_price: parseFloat(e.target.value) || 0})}
                           className="w-full bg-emerald-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" 
                        />
                     </div>
                  </div>

                  <div className="space-y-2">
                     <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest pl-1">Initial Reserve Stock</p>
                     <input 
                        type="number" 
                        value={newItem.stock} 
                        onChange={e => setNewItem({...newItem, stock: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" 
                     />
                  </div>
               </div>

               <div className="flex gap-4 mt-10">
                  <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-[2rem] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">Cancel</button>
                  <button onClick={handleAddProduct} className="flex-[2] py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-[0.3em] shadow-2xl active:scale-95 transition-all">Provision Item</button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
};
