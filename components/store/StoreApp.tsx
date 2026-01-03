
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Order, InventoryItem, Payout, Store, Profile, LiveLocation } from '../../types';
import SevenX7Logo from '../SevenX7Logo';
import { MapVisualizer } from '../MapVisualizer';
import { fetchStoreData, updateOrderStatus, updateStock, subscribeToOrders } from '../../services/storeAdminService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const CAT_EMOJIS: Record<string, string> = {
  'Dairy': '🥛',
  'Vegetables & Fruits': '🥬',
  'Mini Mart': '🏪',
  'Big Mart': '🏬'
};

export const StoreApp: React.FC<{user: Profile, onLogout: () => void, isDemo?: boolean}> = ({ user, onLogout, isDemo = false }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'ORDERS' | 'INVENTORY' | 'PAYMENTS' | 'REPORTS' | 'PROFILE'>('DASHBOARD');
  const [store, setStore] = useState<Store | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [driverLocations, setDriverLocations] = useState<Record<string, LiveLocation>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { store: s, orders: o, inventory: i, payouts: p } = await fetchStoreData(user.id, isDemo);
      setStore(s); setOrders(o); setInventory(i); setPayouts(p);
      setLoading(false);
    };
    load();

    if (!isDemo && store) {
      const orderSub = subscribeToOrders(store.id, (newOrder) => {
        setOrders(prev => {
          const exists = prev.find(o => o.id === newOrder.id);
          if (exists) return prev.map(o => o.id === newOrder.id ? newOrder : o);
          return [newOrder, ...prev];
        });
      });

      const locSub = supabase.channel('tracking')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'live_locations' }, payload => {
          setDriverLocations(prev => ({ ...prev, [payload.new.user_id]: payload.new as LiveLocation }));
        }).subscribe();

      return () => { supabase.removeChannel(orderSub); supabase.removeChannel(locSub); };
    }
  }, [user.id, store?.id]);

  const stats = useMemo(() => {
    const revenue = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + o.total_amount, 0);
    return {
      revenue,
      pending: orders.filter(o => o.status === 'placed').length,
      active: orders.filter(o => ['accepted', 'packing', 'ready'].includes(o.status)).length,
      today: orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).length
    };
  }, [orders]);

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255); doc.setFontSize(22); doc.text(store?.name?.toUpperCase() || "STORE BI", 15, 20);
    doc.setFontSize(9); doc.text(`TERMINAL: ${store?.id} | GEN: ${new Date().toLocaleString()}`, 15, 30);
    
    doc.setTextColor(15, 23, 42); doc.setFontSize(14); doc.text("OPERATIONAL SUMMARY", 15, 55);
    autoTable(doc, {
      startY: 65,
      head: [['METRIC', 'VALUE']],
      body: [['Total Realized Revenue', `INR ${stats.revenue}`], ['Successful Fulfillments', orders.filter(o => o.status === 'delivered').length], ['Inventory SKU Count', inventory.length]],
      theme: 'grid', headStyles: { fillColor: [15, 23, 42] }
    });
    doc.save(`Store_Report_${store?.name}.pdf`);
  };

  const generateCSV = () => {
    const headers = ['Order ID', 'Date', 'Customer', 'Amount', 'Status'];
    const rows = orders.map(o => [o.id, o.created_at, o.customer_name, o.total_amount, o.status]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sales_report.csv'; a.click();
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8">
      <div className="w-16 h-16 border-4 border-white/5 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
      <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">Establishing Peer Link...</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#F8FAFC] flex flex-col overflow-hidden text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-100 px-8 py-5 flex justify-between items-center shrink-0 z-50">
          <div className="flex items-center gap-4">
              <SevenX7Logo size="xs" hideGrocesphere={true} />
              <div className="h-6 w-px bg-slate-100"></div>
              <h1 className="text-sm font-black tracking-tight text-slate-900 uppercase">{store?.name}</h1>
          </div>
          <div className="flex items-center gap-4">
              <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[9px] font-black uppercase border border-emerald-100">● Live Sync</div>
              <button onClick={() => setActiveTab('PROFILE')} className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg active:scale-90 transition-all">👤</button>
          </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 pb-32 hide-scrollbar">
        {activeTab === 'DASHBOARD' && (
          <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { label: 'Revenue', val: `₹${stats.revenue.toLocaleString()}`, color: 'text-emerald-600', icon: '💸' },
                    { label: 'Active Jobs', val: stats.active, color: 'text-blue-600', icon: '⚡' },
                    { label: 'Today Orders', val: stats.today, color: 'text-slate-900', icon: '📦' },
                    { label: 'Pending Audit', val: stats.pending, color: 'text-amber-600', icon: '⚖️' }
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

              <div className="bg-slate-900 p-12 rounded-[4rem] text-white shadow-2xl relative overflow-hidden group">
                   <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] -mr-48 -mt-48 transition-transform group-hover:scale-125"></div>
                   <div className="relative z-10 space-y-8">
                        <div>
                           <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-4">Community Network Stats</p>
                           <h3 className="text-4xl font-black tracking-tight leading-tight">Hub Performance<br/>Terminal ID: {store?.id.slice(0,8)}</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                           <button onClick={generatePDF} className="bg-white/10 hover:bg-white/20 p-6 rounded-3xl border border-white/10 transition-all flex items-center gap-5">
                               <span className="text-2xl">📄</span>
                               <div className="text-left">
                                   <p className="text-[11px] font-black uppercase text-white">Export BI PDF</p>
                                   <p className="text-[8px] text-white/40 uppercase">Power-BI Layout</p>
                               </div>
                           </button>
                           <button onClick={generateCSV} className="bg-white/10 hover:bg-white/20 p-6 rounded-3xl border border-white/10 transition-all flex items-center gap-5">
                               <span className="text-2xl">📊</span>
                               <div className="text-left">
                                   <p className="text-[11px] font-black uppercase text-white">Data Stream CSV</p>
                                   <p className="text-[8px] text-white/40 uppercase">Raw Transaction Log</p>
                               </div>
                           </button>
                        </div>
                   </div>
              </div>
          </div>
        )}

        {activeTab === 'ORDERS' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
              <div className="flex justify-between items-end px-4">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Job Queue</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Realtime Fulfillment Pipeline</p>
                  </div>
              </div>

              {orders.length === 0 ? (
                <div className="py-32 text-center opacity-10 grayscale"><SevenX7Logo size="large" hideGrocesphere /></div>
              ) : (
                <div className="space-y-6">
                  {orders.map(order => (
                    <div key={order.id} className="bg-white border border-slate-100 p-8 rounded-[4rem] shadow-sm hover:shadow-xl transition-all space-y-8">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div>
                                <h4 className="font-black text-slate-900 text-2xl mb-1">{order.customer_name}</h4>
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em]">Order {order.id} • {order.mode.toUpperCase()}</p>
                            </div>
                            <div className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border ${order.status === 'placed' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                {order.status}
                            </div>
                        </div>

                        {order.mode === 'delivery' && order.status !== 'delivered' && (
                           <div className="h-48 rounded-[2.5rem] overflow-hidden border border-slate-100 relative shadow-inner">
                               <MapVisualizer
                                  stores={[]}
                                  userLat={order.delivery_lat || 12.9716}
                                  userLng={order.delivery_lng || 77.5946}
                                  selectedStore={null}
                                  onSelectStore={() => {}}
                                  mode="delivery"
                                  driverLocation={order.delivery_partner_id ? driverLocations[order.delivery_partner_id] : null}
                               />
                               <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl text-[10px] font-black shadow-xl">Tracking Link Active</div>
                           </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           {order.status === 'placed' && <button onClick={() => updateOrderStatus(order.id, 'accepted', isDemo)} className="py-5 bg-emerald-500 text-white rounded-3xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Accept Job</button>}
                           {order.status === 'accepted' && <button onClick={() => updateOrderStatus(order.id, 'packing', isDemo)} className="py-5 bg-slate-900 text-white rounded-3xl text-[11px] font-black uppercase tracking-widest shadow-xl">Move to Preparation</button>}
                           {order.status === 'packing' && <button onClick={() => updateOrderStatus(order.id, order.mode === 'delivery' ? 'ready' : 'delivered', isDemo)} className="py-5 bg-blue-600 text-white rounded-3xl text-[11px] font-black uppercase tracking-widest shadow-xl">Payload Ready</button>}
                           {order.mode === 'delivery' && !order.delivery_partner_id && order.status !== 'delivered' && (
                             <button className="py-5 bg-slate-100 text-slate-500 rounded-3xl text-[11px] font-black uppercase tracking-widest">Assign Partner 🛵</button>
                           )}
                        </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}

        {activeTab === 'INVENTORY' && (
          <div className="max-w-5xl mx-auto space-y-10 animate-fade-in">
              <div className="flex justify-between items-center px-4">
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Stock Hub</h2>
                  <button className="bg-slate-900 text-white px-8 py-4 rounded-[2rem] text-[11px] font-black uppercase tracking-widest shadow-2xl">+ New Catalog Entry</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {inventory.map(item => (
                    <div key={item.id} className="bg-white border border-slate-100 p-8 rounded-[3.5rem] shadow-sm flex flex-col gap-6 group hover:shadow-xl transition-all">
                        <div className="flex items-center gap-6">
                            <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-5xl shadow-inner group-hover:scale-110 transition-transform duration-500">
                                {CAT_EMOJIS[item.category] || '📦'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-black text-slate-900 text-xl leading-none mb-2 truncate">{item.name}</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.category}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                                <p className="text-[9px] font-black text-slate-300 uppercase mb-2">Live Stock</p>
                                <div className="flex items-center gap-3">
                                   <input 
                                      type="number" 
                                      value={item.stock} 
                                      onChange={(e) => updateStock(item.id, parseInt(e.target.value), isDemo)}
                                      className="w-full bg-transparent text-2xl font-black text-slate-900 border-none outline-none focus:ring-0 p-0"
                                   />
                                </div>
                            </div>
                            <div className="bg-emerald-50/50 p-5 rounded-3xl border border-emerald-100">
                                <p className="text-[9px] font-black text-emerald-400 uppercase mb-2">Offer (₹)</p>
                                <p className="text-2xl font-black text-emerald-600">₹{item.offer_price}</p>
                            </div>
                        </div>
                    </div>
                  ))}
              </div>
          </div>
        )}

        {activeTab === 'PAYMENTS' && (
           <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight px-4">Payout Ledger</h2>
              <div className="space-y-4">
                 {payouts.map(p => (
                   <div key={p.id} className="bg-white border border-slate-100 p-8 rounded-[3.5rem] shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center text-2xl font-black">₹</div>
                            <div>
                                <h4 className="font-black text-slate-900 text-xl tracking-tight">₹{p.amount.toLocaleString()}</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.transaction_ref}</p>
                            </div>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-4 py-2 rounded-2xl ${p.status === 'SUCCESS' ? 'text-emerald-500 bg-emerald-50 border border-emerald-100' : 'text-amber-500 bg-amber-50 border border-amber-100'}`}>
                            {p.status}
                        </span>
                   </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'PROFILE' && (
          <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
              <div className="bg-white p-12 rounded-[4.5rem] shadow-soft-xl border border-slate-100 text-center flex flex-col items-center">
                  <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center text-3xl font-black text-white mb-8 border-8 border-slate-50 shadow-2xl">
                    {store?.name?.charAt(0)}
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-2">{store?.name}</h3>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Operational Node: {store?.id.slice(0,12)}</p>
                  
                  <div className="mt-12 w-full space-y-4">
                      <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 text-left">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Terminal Address</p>
                          <p className="font-bold text-slate-700 text-base leading-relaxed">{store?.address}</p>
                      </div>
                      <div className="bg-emerald-50 p-8 rounded-[2.5rem] border border-emerald-100 text-left flex justify-between items-center">
                          <div>
                            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Service Subscription</p>
                            <p className="font-bold text-slate-900 text-base">Verified Node ✓</p>
                            <p className="text-[10px] text-emerald-400 font-bold mt-1">Next Payment: {new Date(user.fee_paid_until).toLocaleDateString()}</p>
                          </div>
                          <span className="text-3xl">🛡️</span>
                      </div>
                  </div>
                  
                  <button onClick={onLogout} className="w-full py-6 bg-red-50 text-red-500 rounded-[2.5rem] font-black uppercase text-[11px] tracking-[0.4em] border border-red-100 mt-10 hover:bg-red-500 hover:text-white transition-all shadow-sm">Terminate Terminal Session</button>
              </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-slate-100 px-10 py-6 flex justify-between z-50 max-w-lg mx-auto rounded-t-[4rem] shadow-float">
           {[
             { id: 'DASHBOARD', icon: '📊', label: 'Terminal' }, 
             { id: 'ORDERS', icon: '📦', label: 'Queue' }, 
             { id: 'INVENTORY', icon: '💎', label: 'Hub' },
             { id: 'PAYMENTS', icon: '💸', label: 'Payouts' }
           ].map(item => (
             <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`flex flex-col items-center gap-2 transition-all ${activeTab === item.id ? 'text-blue-600 scale-110' : 'text-slate-300'}`}>
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all ${activeTab === item.id ? 'bg-slate-900 text-white shadow-lg' : 'bg-transparent text-slate-400'}`}>{item.icon}</div>
                 <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
             </button>
           ))}
      </nav>
    </div>
  );
};
