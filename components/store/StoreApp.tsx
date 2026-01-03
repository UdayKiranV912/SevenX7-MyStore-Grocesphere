
import React, { useEffect, useState, useMemo } from 'react';
import { UserState, Store, Order, InventoryItem, Settlement, StoreType } from '../../types';
import { getMyStore, getStoreInventory, getIncomingOrders, updateStoreOrderStatus, updateInventoryItem, createCustomProduct, getSettlements, updateStoreProfile, subscribeToStoreOrders, subscribeToStoreInventory, assignDeliveryPartner } from '../../services/storeAdminService';
import SevenX7Logo from '../SevenX7Logo';
import { getBrowserLocation, reverseGeocode } from '../../services/locationService';
import { MapVisualizer } from '../MapVisualizer';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PREDEFINED_EMOJIS = ['🥛', '🥬', '🍎', '🏪', '🏬', '🍞', '🥩', '🥤', '🧴', '🥚', '🧂', '🧼', '📦', '🧹'];

export const StoreApp: React.FC<{user: UserState, onLogout: () => void}> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'ORDERS' | 'INVENTORY' | 'TRANSACTIONS' | 'PROFILE'>('DASHBOARD');
  const [myStore, setMyStore] = useState<Store | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // Forms
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: 'General', emoji: '📦', price: '', offerPrice: '', stock: '10' });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', address: '', type: 'mini_mart' as StoreType });

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const store = await getMyStore(user.id || '');
      setMyStore(store);
      if (store) {
        setProfileForm({ name: store.name, address: store.address, type: store.type });
        const [inv, ords, stls] = await Promise.all([getStoreInventory(store.id), getIncomingOrders(store.id), getSettlements(store.id)]);
        setInventory(inv);
        setOrders(ords);
        setSettlements(stls);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [user.id]);

  useEffect(() => {
    if (myStore && !user.isDemo) {
        const orderSub = subscribeToStoreOrders(myStore.id, () => getIncomingOrders(myStore.id).then(setOrders));
        const invSub = subscribeToStoreInventory(myStore.id, () => getStoreInventory(myStore.id).then(setInventory));
        return () => { orderSub.unsubscribe(); invSub.unsubscribe(); };
    }
  }, [myStore?.id]);

  const analytics = useMemo(() => {
    const revenue = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + o.total, 0);
    const dailyData = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        const val = orders.filter(o => o.status === 'delivered' && new Date(o.date).toDateString() === d.toDateString()).reduce((s, o) => s + o.total, 0);
        return { label: d.toLocaleDateString('en-US', { weekday: 'short' }), value: val };
    });
    return { revenue, orders: orders.length, chart: dailyData, max: Math.max(...dailyData.map(d => d.value), 100) };
  }, [orders]);

  const exportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255); doc.setFontSize(22); doc.text(myStore?.name.toUpperCase() || "STORE BI", 15, 20);
    doc.setFontSize(9); doc.text(`NETWORK NODE ID: ${myStore?.id || 'D-01'} | GEN: ${new Date().toLocaleString()}`, 15, 30);
    
    doc.setTextColor(15, 23, 42); doc.setFontSize(12); doc.text("PERFORMANCE SUMMARY", 15, 55);
    autoTable(doc, {
        startY: 65,
        head: [['TOTAL REVENUE (INR)', 'FULFILLED ORDERS', 'ACTIVE STOCK']],
        body: [[`Rs. ${analytics.revenue.toLocaleString()}`, analytics.orders, inventory.length]],
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] }
    });
    doc.save(`BI_Report_${myStore?.name}.pdf`);
  };

  const exportCSV = () => {
    const headers = ['Order ID', 'Customer', 'Total', 'Status', 'Date'];
    const rows = orders.map(o => [o.id, o.customerName, o.total, o.status, o.date]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sales.csv'; a.click();
  };

  const handleUpdateInv = (item: InventoryItem, updates: Partial<InventoryItem>) => {
      const updated = { ...item, ...updates };
      setInventory(prev => prev.map(i => i.id === item.id ? updated : i));
      updateInventoryItem(myStore!.id, item.id, updated.storePrice, updated.offerPrice || updated.storePrice, updated.stock, updated.isActive);
  };

  return (
    <div className="fixed inset-0 bg-[#F8FAFC] flex flex-col text-slate-900 overflow-hidden">
      <header className="bg-white px-8 py-6 border-b border-slate-100 flex justify-between items-center shrink-0">
          <SevenX7Logo size="xs" hideGrocesphere={true} />
          <div className="hidden md:flex flex-col items-center">
              <h1 className="text-sm font-black text-slate-900 tracking-tight uppercase">{myStore?.name || 'Local Mart'}</h1>
              <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Operational Terminal Active</p>
          </div>
          <button onClick={() => setIsEditingProfile(true)} className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-900/20 active:scale-90 transition-all">👤</button>
      </header>

      <main className="flex-1 overflow-y-auto p-6 pb-32 hide-scrollbar">
        {activeTab === 'DASHBOARD' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Revenue</p>
                      <h2 className="text-4xl font-black tracking-tighter">₹{analytics.revenue.toLocaleString()}</h2>
                      <div className="mt-8 flex gap-1 h-12 items-end">
                          {analytics.chart.map((d, i) => <div key={i} className="flex-1 bg-blue-500/20 rounded-sm" style={{ height: `${(d.value / analytics.max) * 100}%` }} />)}
                      </div>
                  </div>
                  <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Orders Processed</p>
                      <h2 className="text-4xl font-black tracking-tighter text-slate-900">{analytics.orders}</h2>
                      <div className="text-[9px] font-black text-emerald-500 uppercase mt-4">Verified Hub Success Rate: 100%</div>
                  </div>
                  <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-4">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">BI Exports</p>
                      <div className="grid grid-cols-2 gap-2">
                          <button onClick={exportPDF} className="bg-slate-50 p-4 rounded-2xl flex flex-col items-center gap-1 active:scale-95 transition-all">
                              <span className="text-xl">📄</span><span className="text-[8px] font-black uppercase">PDF</span>
                          </button>
                          <button onClick={exportCSV} className="bg-slate-50 p-4 rounded-2xl flex flex-col items-center gap-1 active:scale-95 transition-all">
                              <span className="text-xl">📊</span><span className="text-[8px] font-black uppercase">CSV</span>
                          </button>
                      </div>
                  </div>
              </div>
          </div>
        )}

        {activeTab === 'ORDERS' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Active Queue</h2>
                    <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full animate-pulse">Live Peer Sync</span>
                </div>
                {orders.length === 0 ? (
                    <div className="py-20 text-center opacity-20 font-black uppercase tracking-widest text-[10px]">No orders in vicinity</div>
                ) : orders.map(order => (
                    <div key={order.id} className="bg-white border border-slate-100 p-8 rounded-[3.5rem] shadow-sm space-y-6 group hover:shadow-md transition-all">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-black text-slate-900 text-lg">{order.customerName || 'Hub User'}</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Order #{order.id.slice(-6)} • ₹{order.total} • {order.mode.toUpperCase()}</p>
                            </div>
                            <span className="px-4 py-1.5 rounded-2xl bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest border border-blue-100">{order.status}</span>
                        </div>
                        <div className="flex gap-2">
                            {order.status === 'placed' && (
                                <button onClick={() => updateStoreOrderStatus(order.id, 'accepted')} className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Accept Job</button>
                            )}
                            {order.status === 'accepted' && (
                                <button onClick={() => updateStoreOrderStatus(order.id, 'packed')} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Handover to Prep</button>
                            )}
                            {order.status === 'packed' && (
                                <button onClick={() => updateStoreOrderStatus(order.id, order.mode === 'delivery' ? 'ready' : 'delivered')} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Order Ready</button>
                            )}
                            {order.mode === 'delivery' && !order.deliveryPartnerId && order.status !== 'delivered' && (
                                <button onClick={() => assignDeliveryPartner(order.id, 'mock-rider')} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest">Assign Rider 🛵</button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )}

        {activeTab === 'INVENTORY' && (
            <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Stock Terminal</h2>
                    <button onClick={() => setIsAddingItem(true)} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95">+ Add Catalog Entry</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {inventory.map(item => (
                        <div key={item.id} className="bg-white border border-slate-100 p-8 rounded-[3.5rem] shadow-sm flex items-center gap-8 group hover:shadow-xl transition-all">
                            <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform">{item.emoji}</div>
                            <div className="flex-1 space-y-4">
                                <div>
                                    <h4 className="font-black text-slate-900 text-lg">{item.name}</h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{item.category}</p>
                                </div>
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <p className="text-[8px] font-black text-slate-300 uppercase mb-1">MRP</p>
                                        <input type="number" value={item.mrp || item.storePrice} onChange={e => handleUpdateInv(item, { mrp: parseFloat(e.target.value) })} className="w-full bg-slate-50 p-2 rounded-lg text-xs font-bold border-none outline-none" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[8px] font-black text-emerald-400 uppercase mb-1">Offer</p>
                                        <input type="number" value={item.offerPrice || item.storePrice} onChange={e => handleUpdateInv(item, { offerPrice: parseFloat(e.target.value) })} className="w-full bg-emerald-50 p-2 rounded-lg text-xs font-bold text-emerald-600 border-none outline-none" />
                                    </div>
                                    <div className="w-16">
                                        <p className="text-[8px] font-black text-slate-300 uppercase mb-1">Stock</p>
                                        <input type="number" value={item.stock} onChange={e => handleUpdateInv(item, { stock: parseInt(e.target.value) })} className="w-full bg-slate-50 p-2 rounded-lg text-xs font-bold border-none outline-none" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'TRANSACTIONS' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Payout Ledger</h2>
                <div className="space-y-4">
                    {settlements.length === 0 ? (
                        <div className="py-20 text-center opacity-20 font-black uppercase tracking-widest text-[10px]">Awaiting settlement data from admin node</div>
                    ) : settlements.map(stl => (
                        <div key={stl.id} className="bg-white border border-slate-100 p-8 rounded-[3rem] shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center text-xl font-black shadow-inner">₹</div>
                                <div>
                                    <h4 className="font-black text-slate-900 text-base">₹{stl.amount.toLocaleString()}</h4>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">TXN: {stl.transactionId}</p>
                                </div>
                            </div>
                            <span className="text-[9px] font-black text-emerald-500 uppercase bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">{stl.status}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-2xl border-t border-slate-100 px-10 py-6 flex justify-between z-40 max-w-lg mx-auto rounded-t-[4rem] shadow-float">
           {[
             { id: 'DASHBOARD', icon: '📊', label: 'BI Terminal' }, 
             { id: 'ORDERS', icon: '📦', label: 'Queue' }, 
             { id: 'INVENTORY', icon: '💎', label: 'Catalog' },
             { id: 'TRANSACTIONS', icon: '💸', label: 'Ledger' }
           ].map(item => (
             <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`flex flex-col items-center gap-2 transition-all ${activeTab === item.id ? 'text-blue-600 scale-110' : 'text-slate-300'}`}>
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all ${activeTab === item.id ? 'bg-slate-900 text-white shadow-lg' : 'bg-transparent text-slate-400'}`}>{item.icon}</div>
                 <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
             </button>
           ))}
      </nav>

      {/* Item Modal */}
      {isAddingItem && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsAddingItem(false)}>
              <div className="bg-white w-full max-w-sm p-10 rounded-[4rem] shadow-2xl space-y-8" onClick={e => e.stopPropagation()}>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Catalog Entry</h3>
                  <div className="space-y-4">
                      <div className="flex gap-2 flex-wrap mb-4 bg-slate-50 p-4 rounded-3xl">
                          {PREDEFINED_EMOJIS.map(e => <button key={e} onClick={() => setNewItem({...newItem, emoji: e})} className={`text-2xl p-2 rounded-xl transition-all ${newItem.emoji === e ? 'bg-white shadow-md scale-110' : 'opacity-40 hover:opacity-100'}`}>{e}</button>)}
                      </div>
                      <input placeholder="Product Title" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold shadow-inner border-none outline-none" />
                      <div className="grid grid-cols-2 gap-4">
                          <input type="number" placeholder="MRP" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold shadow-inner border-none outline-none" />
                          <input type="number" placeholder="Stock" value={newItem.stock} onChange={e => setNewItem({...newItem, stock: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold shadow-inner border-none outline-none" />
                      </div>
                  </div>
                  <button onClick={() => { createCustomProduct(myStore!.id, { ...newItem, price: parseFloat(newItem.price), offerPrice: parseFloat(newItem.offerPrice || newItem.price), stock: parseInt(newItem.stock) }); setIsAddingItem(false); loadData(); }} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Push to Catalog</button>
              </div>
          </div>
      )}

      {/* Profile Modal */}
      {isEditingProfile && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsEditingProfile(false)}>
              <div className="bg-white w-full max-w-sm p-10 rounded-[4rem] shadow-2xl space-y-8" onClick={e => e.stopPropagation()}>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight text-center">Hub Configuration</h3>
                  <div className="space-y-4">
                      <input placeholder="Store Name" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold shadow-inner border-none outline-none" />
                      <textarea placeholder="Physical Address" value={profileForm.address} onChange={e => setProfileForm({...profileForm, address: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold shadow-inner border-none outline-none resize-none" rows={2} />
                      <select value={profileForm.type} onChange={e => setProfileForm({...profileForm, type: e.target.value as StoreType})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold shadow-inner border-none outline-none">
                          <option value="mini_mart">Mini Mart</option>
                          <option value="big_mart">Big Mart</option>
                          <option value="dairy">Dairy / Milk Booth</option>
                          <option value="vegetables">Fresh Hub (Veg/Fruits)</option>
                      </select>
                  </div>
                  <div className="bg-emerald-50/50 p-5 rounded-3xl border border-emerald-100">
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Service Fee Billing</p>
                      <p className="text-xs font-bold text-slate-600">Verified until: {myStore?.serviceFeePaidUntil || 'Pending'}</p>
                      <p className="text-[8px] font-bold text-slate-400 mt-2">Next Payout: Rs. 250 in 12 days</p>
                  </div>
                  <div className="space-y-3">
                    <button onClick={() => { updateStoreProfile(myStore!.id, profileForm); setIsEditingProfile(false); loadData(); }} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl">Apply Changes</button>
                    <button onClick={onLogout} className="w-full py-5 text-red-500 font-black uppercase text-[9px] tracking-widest">Terminate Session</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
