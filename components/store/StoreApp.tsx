
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Profile, Store, Order, InventoryItem, Payout, LiveLocation, MasterProduct, ProductCategory } from '../../types';
import SevenX7Logo from '../SevenX7Logo';
import { MapVisualizer } from '../MapVisualizer';
import { fetchOrders, fetchInventory, fetchMasterProducts, fetchCategories, getMyStore, updateOrderStatus, updateInventoryItem, addItemToInventory, getDemoData, fetchServiceFees } from '../../services/storeAdminService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const StoreApp: React.FC<{user: Profile, onLogout: () => void, isDemo?: boolean}> = ({ user, onLogout, isDemo = false }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'ORDERS' | 'INVENTORY' | 'PAYMENTS' | 'PROFILE' | 'FEE'>('DASHBOARD');
  const [store, setStore] = useState<Store | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [riderLocations, setRiderLocations] = useState<Record<string, LiveLocation>>({});
  const [serviceFees, setServiceFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newItem, setNewItem] = useState<Omit<InventoryItem, 'id' | 'store_id'>>({
    master_product_id: '',
    product_name: '',
    brand_name: '',
    emoji: '📦',
    mrp: 0,
    offer_price: 0,
    stock: 0,
    active: true
  });

  const loadData = async () => {
    if (isDemo) {
      const demo = getDemoData();
      setStore(demo.store); setOrders(demo.orders); setInventory(demo.inventory);
      setLoading(false); return;
    }
    const s = await getMyStore(user.id);
    if (!s) return;
    setStore(s);
    const [o, i, m, c, f] = await Promise.all([
        fetchOrders(s.id), 
        fetchInventory(s.id), 
        fetchMasterProducts(s.store_type),
        fetchCategories(s.store_type),
        fetchServiceFees(s.id)
    ]);
    setOrders(o); setInventory(i); setMasterProducts(m); setCategories(c); setServiceFees(f);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    if (!isDemo && store) {
      const orderChannel = supabase.channel(`store-orders-${store.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${store.id}` }, () => fetchOrders(store.id).then(setOrders))
        .subscribe();

      const invChannel = supabase.channel(`store-inv-${store.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'store_inventory', filter: `store_id=eq.${store.id}` }, () => fetchInventory(store.id).then(setInventory))
        .subscribe();

      return () => {
        supabase.removeChannel(orderChannel);
        supabase.removeChannel(invChannel);
      };
    }
  }, [user.id, store?.id]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today);
    const revenue = orders.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + Number(o.total_amount), 0);
    const outOfStock = inventory.filter(i => i.stock <= 0).length;
    return {
      revenue,
      total: orders.length,
      today: todayOrders.length,
      pending: orders.filter(o => o.status === 'PLACED').length,
      outOfStock
    };
  }, [orders, inventory]);

  const masterSuggestions = useMemo(() => {
    if (!searchQuery) return [];
    return masterProducts.filter(p => 
        p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.brand_name.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5);
  }, [searchQuery, masterProducts]);

  const generateReport = (format: 'PDF' | 'CSV') => {
    if (format === 'CSV') {
      const headers = ['Order Ref', 'Date', 'Amount', 'Status', 'Type'];
      const rows = orders.map(o => [o.id.slice(-6), new Date(o.created_at).toLocaleString(), o.total_amount, o.status, o.order_type]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Advanced_BI_${store?.store_name}.csv`; a.click();
    } else {
      const doc = new jsPDF();
      doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 45, 'F');
      doc.setTextColor(255); doc.setFontSize(26); doc.text(store?.store_name?.toUpperCase() || 'HUB TERMINAL', 15, 25);
      doc.setFontSize(9); doc.setTextColor(148, 163, 184); doc.text(`BI VISUAL REPORT | CLUSTER: ${store?.id.slice(0, 8)}`, 15, 35);
      
      doc.setFillColor(30, 41, 59); doc.roundedRect(15, 50, 45, 25, 3, 3, 'F');
      doc.roundedRect(65, 50, 45, 25, 3, 3, 'F'); doc.roundedRect(115, 50, 45, 25, 3, 3, 'F');
      
      doc.setFontSize(8); doc.setTextColor(255);
      doc.text('TOTAL REVENUE', 20, 58); doc.text('ORDER VOLUME', 70, 58); doc.text('STOCK ALERTS', 120, 58);
      doc.setFontSize(14); doc.text(`INR ${stats.revenue}`, 20, 68); doc.text(`${stats.total}`, 70, 68); doc.text(`${stats.outOfStock}`, 120, 68);

      autoTable(doc, {
        startY: 85,
        head: [['Ref', 'Timestamp', 'Customer', 'Type', 'Amount (INR)', 'Status']],
        body: orders.map(o => [`#${o.id.slice(-6)}`, new Date(o.created_at).toLocaleDateString(), o.customer_name || 'Anonymous', o.order_type, o.total_amount, o.status]),
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], fontSize: 9 }
      });
      doc.save(`BI_Analytics_${store?.store_name}.pdf`);
    }
  };

  const handleUpdateItem = async (itemId: string, field: string, val: any) => {
    const updated = inventory.map(i => i.id === itemId ? { ...i, [field]: val } : i);
    setInventory(updated);
    if (!isDemo) await updateInventoryItem(itemId, { [field]: val });
  };

  const handleAddProduct = async () => {
    if (!store) return;
    try {
      if (isDemo) {
        setInventory([...inventory, { ...newItem, id: Math.random().toString(), store_id: store.id } as any]);
      } else {
        const added = await addItemToInventory(store.id, newItem);
        setInventory([...inventory, added]);
      }
      setIsAddModalOpen(false); setSearchQuery('');
      setNewItem({ master_product_id: '', product_name: '', brand_name: '', emoji: '📦', mrp: 0, offer_price: 0, stock: 0, active: true });
    } catch (e) { alert("Catalog sync failed."); }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
      <div className="w-14 h-14 border-4 border-white/5 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
      <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">Calibrating Hub Terminal...</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#F8FAFC] flex flex-col text-slate-900 overflow-hidden font-sans">
      <header className="bg-white border-b border-slate-100 px-8 py-5 flex justify-between items-center shrink-0 z-50">
          <div className="flex items-center gap-4">
              <SevenX7Logo size="xs" hideGrocesphere={true} />
              <div className="h-6 w-px bg-slate-100 hidden sm:block"></div>
              <h1 className="text-sm font-black text-slate-900 truncate uppercase hidden sm:block">{store?.store_name}</h1>
          </div>
          <div className="flex items-center gap-4">
              <button onClick={() => setActiveTab('FEE')} className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100">Service Active</button>
              <button onClick={() => setActiveTab('PROFILE')} className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg active:scale-90 transition-all">👤</button>
          </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 pb-32 hide-scrollbar">
        {activeTab === 'DASHBOARD' && (
          <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { label: 'Total Sales', val: `₹${stats.revenue.toLocaleString()}`, color: 'text-emerald-600', icon: '💸' },
                    { label: 'Daily Load', val: stats.today, color: 'text-slate-900', icon: '📦' },
                    { label: 'Active Jobs', val: stats.pending, color: 'text-amber-500', icon: '🕒' },
                    { label: 'Low Reserves', val: stats.outOfStock, color: 'text-red-500', icon: '⚠️' }
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
                           <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-4">Enterprise Visuals</p>
                           <h3 className="text-5xl font-black tracking-tighter leading-none">BI Intelligence<br/><span className="text-slate-500">Operational Data Lake</span></h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                           <button onClick={() => generateReport('PDF')} className="bg-white/10 hover:bg-white/20 p-8 rounded-[2.5rem] border border-white/10 transition-all flex items-center gap-6 group">
                               <span className="text-3xl">📄</span>
                               <div className="text-left">
                                   <p className="text-[11px] font-black uppercase text-white">Advanced BI (PDF)</p>
                                   <p className="text-[8px] text-white/40 uppercase tracking-widest">Power Visuals</p>
                               </div>
                           </button>
                           <button onClick={() => generateReport('CSV')} className="bg-white/10 hover:bg-white/20 p-8 rounded-[2.5rem] border border-white/10 transition-all flex items-center gap-6 group">
                               <span className="text-3xl">📊</span>
                               <div className="text-left">
                                   <p className="text-[11px] font-black uppercase text-white">Master Export (CSV)</p>
                                   <p className="text-[8px] text-white/40 uppercase tracking-widest">Raw Peer Data</p>
                               </div>
                           </button>
                        </div>
                   </div>
              </div>
          </div>
        )}

        {activeTab === 'ORDERS' && (
          <div className="max-w-4xl mx-auto space-y-10 animate-fade-in">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none px-4">Incoming Stream</h2>
              {orders.length === 0 ? (
                <div className="py-32 text-center opacity-10 font-black uppercase text-4xl tracking-[0.5em]">No Data Stream</div>
              ) : (
                <div className="space-y-6">
                  {orders.map(order => (
                      <div key={order.id} className="bg-white border border-slate-100 p-10 rounded-[4rem] shadow-soft-xl space-y-8 hover:shadow-2xl transition-all">
                          <div className="flex justify-between items-start">
                              <div>
                                  <h4 className="font-black text-slate-900 text-3xl mb-1">{order.customer_name || 'Anonymous'}</h4>
                                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em]">Job #{order.id.slice(-6)} • {order.order_type}</p>
                              </div>
                              <div className={`px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] border ${order.status === 'PLACED' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                  {order.status}
                              </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             {order.status === 'PLACED' && <button onClick={() => updateOrderStatus(order.id, 'CONFIRMED')} className="py-6 bg-emerald-500 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-xl hover:bg-emerald-400 transition-all">Confirm Job</button>}
                             {order.status === 'CONFIRMED' && <button onClick={() => updateOrderStatus(order.id, 'PACKING')} className="py-6 bg-slate-900 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-xl hover:bg-slate-800 transition-all">Start Packing</button>}
                             {order.status === 'PACKING' && <button onClick={() => updateOrderStatus(order.id, order.order_type === 'DELIVERY' ? 'READY' : 'DELIVERED')} className="py-6 bg-blue-600 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-xl hover:bg-blue-500 transition-all">Mark Prepared</button>}
                          </div>
                      </div>
                  ))}
                </div>
              )}
          </div>
        )}

        {activeTab === 'INVENTORY' && (
          <div className="max-w-6xl mx-auto space-y-12 animate-fade-in">
              <div className="flex justify-between items-center px-4">
                  <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">Catalog Hub</h2>
                  <button onClick={() => setIsAddModalOpen(true)} className="bg-slate-900 text-white px-10 py-5 rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl active:scale-95 transition-all">+ Add Product</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {inventory.map(item => (
                    <div key={item.id} className="bg-white border border-slate-100 p-10 rounded-[4.5rem] shadow-sm flex flex-col gap-8 group hover:shadow-2xl transition-all">
                        <div className="flex items-center gap-6">
                            <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-5xl shadow-inner group-hover:scale-110 transition-transform">{item.emoji}</div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-black text-slate-900 text-2xl truncate">{item.product_name}</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.brand_name}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Stock Units</span>
                                <input type="number" value={item.stock} onChange={(e) => handleUpdateItem(item.id, 'stock', parseInt(e.target.value) || 0)} className="w-20 bg-transparent text-right text-xl font-black text-slate-900 border-none outline-none focus:ring-0 p-0" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100">
                                    <p className="text-[9px] font-black text-slate-300 uppercase mb-2 tracking-widest">MRP</p>
                                    <input type="number" value={item.mrp} onChange={(e) => handleUpdateItem(item.id, 'mrp', parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-lg font-black text-slate-900 border-none outline-none focus:ring-0 p-0" />
                                </div>
                                <div className="bg-emerald-50/50 p-5 rounded-[2rem] border border-emerald-100">
                                    <p className="text-[9px] font-black text-emerald-400 uppercase mb-2 tracking-widest">OFFER</p>
                                    <input type="number" value={item.offer_price} onChange={(e) => handleUpdateItem(item.id, 'offer_price', parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-lg font-black text-emerald-600 border-none outline-none focus:ring-0 p-0" />
                                </div>
                            </div>
                        </div>
                    </div>
                  ))}
              </div>
          </div>
        )}

        {activeTab === 'FEE' && (
            <div className="max-w-2xl mx-auto space-y-10 animate-fade-in">
                 <div className="bg-white p-14 rounded-[5rem] shadow-soft-xl border border-slate-100 text-center">
                    <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center text-5xl mx-auto mb-8 animate-bounce-soft">💳</div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">Service License</h2>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed mb-10">Pay ₹250 every 15 days to maintain your operational slot in the Grocesphere node network.</p>
                    <div className="bg-slate-900 p-10 rounded-[3rem] text-white text-left mb-12 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Admin Terminal UPI</p>
                        <p className="text-2xl font-black tracking-tight mb-1">grocesphere.admin@okaxis</p>
                    </div>
                    <button onClick={() => window.open(`upi://pay?pa=grocesphere.admin@okaxis&pn=SevenX7&am=250&cu=INR`)} className="w-full py-7 bg-emerald-500 text-white rounded-[3rem] font-black uppercase text-[11px] tracking-[0.5em] shadow-2xl active:scale-95 transition-all">Pay License Fee</button>
                 </div>
            </div>
        )}

        {activeTab === 'PROFILE' && (
          <div className="max-w-2xl mx-auto space-y-10 animate-fade-in">
              <div className="bg-white p-14 rounded-[5rem] shadow-soft-xl border border-slate-100 text-center flex flex-col items-center">
                  <div className="w-28 h-28 bg-slate-900 rounded-[3rem] flex items-center justify-center text-4xl font-black text-white mb-8 border-8 border-slate-50 shadow-2xl">{store?.store_name?.charAt(0)}</div>
                  <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">{store?.store_name}</h3>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Node Cluster: {store?.id.slice(0,16)}</p>
                  <div className="mt-14 w-full space-y-4">
                      <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 text-left">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Service Address</p>
                          <p className="font-bold text-slate-700 text-lg leading-relaxed">{store?.address}</p>
                      </div>
                  </div>
                  <button onClick={onLogout} className="w-full py-7 bg-red-50 text-red-500 rounded-[3rem] font-black uppercase text-[11px] tracking-[0.5em] border border-red-100 mt-12 hover:bg-red-500 hover:text-white transition-all">Terminate Session</button>
              </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-3xl border-t border-slate-100 px-10 py-6 flex justify-between z-50 max-w-xl mx-auto rounded-t-[4.5rem] shadow-float">
           {[
             { id: 'DASHBOARD', icon: '📊', label: 'Terminal' }, 
             { id: 'ORDERS', icon: '📦', label: 'Stream' }, 
             { id: 'INVENTORY', icon: '💎', label: 'Catalog' },
             { id: 'PAYMENTS', icon: '💸', label: 'History' }
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
               <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-8">Catalog Mapping</h3>
               
               <div className="space-y-5">
                  <div className="relative">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest pl-1 mb-2">Master Product Lookup</p>
                      <input 
                         type="text" 
                         placeholder="Search master catalog..." 
                         value={searchQuery} 
                         onChange={e => setSearchQuery(e.target.value)}
                         className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner outline-none focus:ring-1 focus:ring-slate-900" 
                      />
                      {masterSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-[1100]">
                              {masterSuggestions.map(p => (
                                  <button key={p.id} onClick={() => { setNewItem({...newItem, master_product_id: p.id, product_name: p.product_name, brand_name: p.brand_name, emoji: p.emoji}); setSearchQuery(''); }} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 text-left border-b border-slate-50 last:border-none">
                                      <span className="text-2xl">{p.emoji}</span>
                                      <div><p className="font-bold text-slate-800 text-sm">{p.product_name}</p><p className="text-[10px] text-slate-400 uppercase font-black">{p.brand_name}</p></div>
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>
                  {newItem.product_name && (
                      <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex items-center gap-4 animate-scale-in">
                          <span className="text-4xl">{newItem.emoji}</span>
                          <div>
                              <p className="font-black text-slate-900 text-sm">{newItem.product_name}</p>
                              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{newItem.brand_name}</p>
                          </div>
                      </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest pl-1">MRP (₹)</p>
                        <input type="number" value={newItem.mrp} onChange={e => setNewItem({...newItem, mrp: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" />
                     </div>
                     <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest pl-1">Offer (₹)</p>
                        <input type="number" value={newItem.offer_price} onChange={e => setNewItem({...newItem, offer_price: parseFloat(e.target.value) || 0})} className="w-full bg-emerald-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" />
                     </div>
                  </div>
                  <div className="space-y-2">
                     <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest pl-1">Initial Reserve</p>
                     <input type="number" value={newItem.stock} onChange={e => setNewItem({...newItem, stock: parseInt(e.target.value) || 0})} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" />
                  </div>
               </div>

               <div className="flex gap-4 mt-10">
                  <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-[2rem] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">Cancel</button>
                  <button onClick={handleAddProduct} className="flex-[2] py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-[0.3em] shadow-2xl active:scale-95 transition-all">Add to Store</button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
};
