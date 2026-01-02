import React, { useEffect, useState, useMemo } from 'react';
import { UserState, Store, Order, InventoryItem, Settlement } from '../../types';
import { getMyStore, getStoreInventory, getIncomingOrders, updateStoreOrderStatus, updateInventoryItem, createCustomProduct, getSettlements, updateStoreProfile, subscribeToStoreOrders, subscribeToStoreInventory } from '../../services/storeAdminService';
import SevenX7Logo from '../SevenX7Logo';
import { getBrowserLocation, reverseGeocode } from '../../services/locationService';
import { MapVisualizer } from '../MapVisualizer';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const EMOJI_GRID = [
    '🍎', '🥦', '🥚', '🍞', '🥛', '🥩', '🍗', '🐟', '🥤', '🧃', 
    '🍫', '🍪', '🧊', '🧼', '🧻', '🧹', '📦', '🧴', '🦟', '🧂', 
    '🍬', '🥘', '🥣', '🍇', '🍉', '🍍', '🥭', '🧅', '🧄', '🥜'
];

const isValidCoord = (num: any): num is number => {
  return typeof num === 'number' && !isNaN(num) && isFinite(num);
};

export const StoreApp: React.FC<{user: UserState, onLogout: () => void}> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'ORDERS' | 'INVENTORY' | 'TRANSACTIONS' | 'LOCATION' | 'PROFILE'>('DASHBOARD');
  const [myStore, setMyStore] = useState<Store | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [orderFilter, setOrderFilter] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const [tick, setTick] = useState(0);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
      name: '',
      type: 'General Store' as Store['type'],
      address: '',
      gstNumber: '',
      licenseNumber: '',
      upiId: '',
      bankName: '',
      accNo: '',
      ifsc: ''
  });

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '', 
    emoji: '📦', 
    category: 'General', 
    price: '', 
    stock: '10', 
    mrp: '', 
    cost: '',
    isNewCategory: false,
    newCategoryName: ''
  });

  // Animation ticker for demo simulation
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(inventory.filter(i => i.isActive).map(i => i.category));
    return ['All', ...Array.from(cats).sort()];
  }, [inventory]);

  const loadInitialData = async () => {
    try {
      const store = await getMyStore(user.id || '');
      setMyStore(store);
      if (store) {
        setProfileForm({
            name: store.name || '',
            type: store.type || 'General Store',
            address: store.address || '',
            gstNumber: store.gstNumber || '',
            licenseNumber: (user as any).licenseNumber || '',
            upiId: store.upiId || '',
            bankName: store.bankDetails?.bankName || '',
            accNo: store.bankDetails?.accountNumber || '',
            ifsc: store.bankDetails?.ifscCode || ''
        });
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

  useEffect(() => { loadInitialData(); }, [user.id]);

  // LIVE REALTIME SUBSCRIPTIONS
  useEffect(() => {
    if (myStore && !user.id?.includes('demo')) {
        const orderSub = subscribeToStoreOrders(myStore.id, () => {
            getIncomingOrders(myStore.id).then(setOrders);
            getSettlements(myStore.id).then(setSettlements);
        });

        const inventorySub = subscribeToStoreInventory(myStore.id, () => {
            getStoreInventory(myStore.id).then(setInventory);
        });

        return () => { 
            orderSub.unsubscribe(); 
            inventorySub.unsubscribe();
        };
    }
  }, [myStore?.id]);

  const analytics = useMemo(() => {
    const validOrders = orders.filter(o => !['cancelled', 'rejected'].includes(o.status));
    const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);
    const chart = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(new Date().getDate() - (6 - i));
        const val = validOrders.filter(o => new Date(o.date).toDateString() === d.toDateString()).reduce((sum, o) => sum + o.total, 0);
        return { label: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(), value: val };
    });
    return { 
      totalRevenue, 
      totalOrders: validOrders.length,
      avgOrderValue: validOrders.length > 0 ? (totalRevenue / validOrders.length) : 0,
      chart, 
      maxVal: Math.max(...chart.map(c => c.value), 100) 
    };
  }, [orders]);

  const generateCSVReport = () => {
    const headers = ['Date', 'Order ID', 'Amount (INR)', 'Method', 'Status'];
    const rows = settlements.map(s => [
        `"${new Date(s.date).toLocaleDateString()}"`,
        `"${s.orderId}"`,
        `"${s.amount.toFixed(2)}"`,
        `"${s.fromUpi}"`,
        `"${s.status}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = (window as any).document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `BI_Revenue_Report_${myStore?.name || 'Mart'}_${Date.now()}.csv`);
    (window as any).document.body.appendChild(link);
    link.click();
    (window as any).document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generatePDFReport = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    // Power BI Theme Background
    doc.setFillColor(15, 23, 42); // Dark Slate 900
    doc.rect(0, 0, pageWidth, 50, 'F');

    // Title Block
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(myStore?.name?.toUpperCase() || "STORE TERMINAL", margin, 22);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(`EXECUTIVE BI DASHBOARD | GENERATED: ${new Date().toLocaleString()}`, margin, 30);
    doc.text(`NETWORK NODE ID: ${myStore?.id || 'LOCAL-D-01'}`, margin, 35);

    // KPI Section Title
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("EXECUTIVE PERFORMANCE SUMMARY", margin, 62);

    // Drawing KPI Tiles
    const tileWidth = (pageWidth - (margin * 2) - 10) / 3;
    const tileY = 68;
    const tileHeight = 28;

    const drawKPITile = (x: number, label: string, value: string, sub: string, color: [number, number, number]) => {
        doc.setDrawColor(226, 232, 240); // Slate 200
        doc.setFillColor(248, 250, 252); // Slate 50
        doc.roundedRect(x, tileY, tileWidth, tileHeight, 3, 3, 'FD');
        
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139); // Slate 500
        doc.text(label.toUpperCase(), x + 5, tileY + 7);
        
        doc.setFontSize(13);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(value, x + 5, tileY + 18);

        doc.setFontSize(6);
        doc.setTextColor(148, 163, 184);
        doc.text(sub, x + 5, tileY + 24);
    };

    drawKPITile(margin, "Total Revenue", `Rs. ${analytics.totalRevenue.toLocaleString()}`, "Across all nodes", [16, 185, 129]); // Emerald
    drawKPITile(margin + tileWidth + 5, "Total Orders", `${analytics.totalOrders}`, "Verified fulfillments", [59, 130, 246]); // Blue
    drawKPITile(margin + (tileWidth + 5) * 2, "Avg Order Val", `Rs. ${analytics.avgOrderValue.toFixed(0)}`, "Basket health", [245, 158, 11]); // Amber

    // Sales Velocity Chart
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("SALES VELOCITY (7 DAY TREND)", margin, 110);

    const chartX = margin;
    const chartY = 118;
    const chartW = pageWidth - (margin * 2);
    const chartH = 45;
    const barGap = 6;
    const barW = (chartW - (barGap * 6)) / 7;

    // Baseline
    doc.setDrawColor(226, 232, 240);
    doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);

    analytics.chart.forEach((d, i) => {
        const h = (d.value / (analytics.maxVal || 1)) * chartH;
        const bx = chartX + (i * (barW + barGap));
        
        doc.setFillColor(59, 130, 246); // Blue 500
        doc.rect(bx, chartY + chartH - h, barW, h, 'F');
        
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(d.label, bx + (barW/2), chartY + chartH + 5, { align: 'center' });
        
        if (d.value > 0) {
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(6);
            doc.text(`Rs.${d.value}`, bx + (barW/2), chartY + chartH - h - 2, { align: 'center' });
        }
    });

    // Transaction Details Table
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("RECENT SETTLEMENT LEDGER", margin, 182);

    autoTable(doc, {
        startY: 188,
        margin: { left: margin, right: margin },
        head: [['DATE', 'REFERENCE ID', 'SENDER', 'AMOUNT (INR)', 'STATUS']],
        body: settlements.slice(0, 15).map(s => [
            new Date(s.date).toLocaleDateString(), 
            s.orderId.toUpperCase(), 
            s.fromUpi, 
            `Rs. ${s.amount.toFixed(2)}`, 
            s.status
        ]),
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, textColor: [51, 65, 85] },
        columnStyles: { 3: { fontStyle: 'bold', halign: 'right' } },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid'
    });

    // Footer Branding
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225); // Slate 300
    doc.text("GROCESPHERE BI TERMINAL | SEVENX7 INNOVATIONS | CONFIDENTIAL DATA", pageWidth / 2, 288, { align: 'center' });

    doc.save(`Grocesphere_BI_${myStore?.name || 'Mart'}_${Date.now()}.pdf`);
  };

  const handleUpdateStatus = async (orderId: string, status: Order['status']) => {
    await updateStoreOrderStatus(orderId, status);
    if (user.id?.includes('demo')) {
        getIncomingOrders(myStore!.id).then(setOrders);
    }
  };

  const getSimulatedRiderPosForMerchant = (order: Order) => {
      if (user.id && !user.id.includes('demo')) return order.driverLocation;
      if (!myStore || !order.storeLocation) return undefined;
      const isLive = order.status === 'packing' || order.status === 'on_way';
      if (!isLive) return undefined;
      const loopDuration = 60; 
      const t = (tick + order.id.length) % loopDuration;
      const progress = t / loopDuration;
      if (order.status === 'packing') return { lat: myStore.lat + 0.008 * (1-progress), lng: myStore.lng + 0.008 * (1-progress) };
      if (order.status === 'on_way' && order.userLocation) return { lat: myStore.lat + (order.userLocation.lat - myStore.lat) * progress, lng: myStore.lng + (order.userLocation.lng - myStore.lng) * progress };
      return undefined;
  };

  const handleAddProduct = async () => {
    if (!myStore || !newItem.name || !newItem.price) return;
    const finalCategory = newItem.isNewCategory ? newItem.newCategoryName : newItem.category;
    setLoading(true);
    try {
      const price = parseFloat(newItem.price);
      const product: InventoryItem = {
        id: `custom-${Date.now()}`, 
        name: newItem.name, 
        emoji: newItem.emoji, 
        category: finalCategory || 'General', 
        price: price, 
        mrp: newItem.mrp ? parseFloat(newItem.mrp) : price * 1.2, 
        storePrice: price, 
        stock: parseInt(newItem.stock), 
        inStock: true, 
        isActive: true
      };
      await createCustomProduct(myStore.id, product);
      setIsAddingNew(false);
      setNewItem({ name: '', emoji: '📦', category: 'General', price: '', stock: '10', mrp: '', cost: '', isNewCategory: false, newCategoryName: '' });
      getStoreInventory(myStore.id).then(setInventory);
    } finally { setLoading(false); }
  };

  const updateInventoryQuick = async (item: InventoryItem, updates: Partial<InventoryItem>) => {
    const updated = { ...item, ...updates };
    setInventory(prev => prev.map(i => i.id === item.id ? updated : i));
    await updateInventoryItem(myStore!.id, item.id, updated.storePrice, updated.stock > 0, updated.stock);
  };

  const handleUpdateProfile = async () => {
    if (!myStore) return;
    setLoading(true);
    try {
      await updateStoreProfile(myStore.id, { name: profileForm.name, address: profileForm.address, type: profileForm.type, upiId: profileForm.upiId });
      setIsEditingProfile(false);
      getMyStore(user.id!).then(setMyStore);
    } finally { setLoading(false); }
  };

  const handleDetectLive = async () => {
    if (!myStore) return;
    setLoading(true);
    try {
      const loc = await getBrowserLocation();
      const addr = await reverseGeocode(loc.lat, loc.lng);
      await updateStoreProfile(myStore.id, { lat: loc.lat, lng: loc.lng, address: addr || myStore.address });
      getMyStore(user.id!).then(setMyStore);
    } catch (e) {
      // Comment: Cast window to any to access alert in environments where it might be missing from Window type
      (window as any).alert("Location detection failed.");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col overflow-hidden text-slate-900">
      <header className="bg-white px-6 shadow-sm z-20 shrink-0 border-b border-slate-100 flex items-center justify-between h-16 sm:h-20">
         <SevenX7Logo size="xs" hideGrocesphere={true} />
         <div className="hidden md:block text-center">
           <h1 className="text-sm font-black text-slate-900 truncate tracking-tight">{myStore?.name || 'Partner Hub'}</h1>
           <p className="text-[7px] font-black text-emerald-500 uppercase tracking-widest">Mart Operational Terminal</p>
         </div>
         <div className="flex gap-2">
            <button onClick={() => setActiveTab('LOCATION')} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center text-lg active:scale-90 transition-transform">📍</button>
            <button onClick={() => { setActiveTab('PROFILE'); setIsEditingProfile(false); }} className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-lg active:scale-90 transition-transform shadow-lg">👤</button>
         </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-32 hide-scrollbar">
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-6 animate-fade-in max-w-lg mx-auto">
            <div className="bg-slate-900 p-8 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Rolling 7-Day Performance</p>
                <h2 className="text-4xl font-black tracking-tighter mb-1">₹{analytics.totalRevenue.toLocaleString()}</h2>
                <div className="mt-10 flex gap-2 h-24 items-end">
                    {analytics.chart.map((d, i) => (
                        <div key={i} className="flex-1 group relative">
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black opacity-0 group-hover:opacity-100 transition-opacity">₹{d.value}</div>
                            <div className="w-full bg-blue-500/20 rounded-t-lg transition-all duration-700 hover:bg-blue-400" style={{ height: `${(d.value / (analytics.maxVal || 1)) * 100}%` }}></div>
                            <p className="text-[7px] text-center mt-2 font-black text-slate-500">{d.label}</p>
                        </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Power BI Reports & Export</h3>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={generatePDFReport} className="bg-blue-50/50 border border-blue-100 p-6 rounded-3xl flex flex-col items-center gap-3 active:scale-95 transition-all group">
                        <span className="text-2xl group-hover:scale-110 transition-transform">📄</span>
                        <span className="text-[9px] font-black uppercase text-blue-600">Performance PDF</span>
                    </button>
                    <button onClick={generateCSVReport} className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-3xl flex flex-col items-center gap-3 active:scale-95 transition-all group">
                        <span className="text-2xl group-hover:scale-110 transition-transform">📊</span>
                        <span className="text-[9px] font-black uppercase text-emerald-600">Revenue CSV</span>
                    </button>
                </div>
            </div>
          </div>
        )}

        {activeTab === 'ORDERS' && (
            <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
                {trackingOrder ? (
                    <div className="space-y-4 animate-slide-up">
                        <div className="flex items-center justify-between px-2">
                            <button onClick={() => setTrackingOrder(null)} className="text-[10px] font-black uppercase text-slate-400 tracking-widest">← Back to Queue</button>
                            <h2 className="text-sm font-black uppercase tracking-widest text-emerald-500">Live Rider Tracking</h2>
                        </div>
                        <div className="h-[50vh] rounded-[3.5rem] overflow-hidden border-4 border-white shadow-2xl relative">
                            <MapVisualizer stores={[]} userLat={myStore?.lat || 12.9716} userLng={myStore?.lng || 77.6410} selectedStore={myStore} onSelectStore={() => {}} mode="DELIVERY" showRoute={true} driverLocation={getSimulatedRiderPosForMerchant(trackingOrder)} forcedCenter={myStore} />
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[85%] bg-white/90 backdrop-blur-xl p-5 rounded-[2.5rem] shadow-2xl border border-white flex items-center gap-4 z-[1000]">
                                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-2xl shadow-lg animate-bounce">🛵</div>
                                <div className="flex-1">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Fleet Assignment</p>
                                    <p className="font-black text-slate-900 text-sm">{trackingOrder.status === 'packing' ? 'Rider heading to store' : 'Rider out for delivery'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center px-2">
                            <h2 className="text-2xl font-black tracking-tight text-slate-900">Order Center</h2>
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button onClick={() => setOrderFilter('ACTIVE')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${orderFilter === 'ACTIVE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Active Queue</button>
                                <button onClick={() => setOrderFilter('HISTORY')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${orderFilter === 'HISTORY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>History</button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {orders.filter(o => orderFilter === 'ACTIVE' ? !['delivered', 'picked_up', 'rejected', 'cancelled'].includes(o.status) : ['delivered', 'picked_up', 'rejected', 'cancelled'].includes(o.status)).length === 0 ? (
                                <div className="text-center py-20 opacity-20 font-black uppercase tracking-widest text-[10px]">No orders in this cluster</div>
                            ) : orders.filter(o => orderFilter === 'ACTIVE' ? !['delivered', 'picked_up', 'rejected', 'cancelled'].includes(o.status) : ['delivered', 'picked_up', 'rejected', 'cancelled'].includes(o.status)).map(order => (
                                <div key={order.id} className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm space-y-4 hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-black text-slate-900">{order.customerName || 'Anonymous Hub User'}</h4>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Order ID #{order.id.slice(-6)} • Total: ₹{order.total}</p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${order.status === 'placed' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>{order.status}</span>
                                    </div>
                                    
                                    {orderFilter === 'ACTIVE' && (
                                        <div className="flex gap-2 pt-2">
                                            {order.status === 'placed' && (
                                                <>
                                                    <button onClick={() => handleUpdateStatus(order.id, 'packing')} className="flex-1 bg-emerald-500 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Accept Order</button>
                                                    <button onClick={() => handleUpdateStatus(order.id, 'rejected')} className="flex-1 bg-red-50 text-red-500 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95">Reject</button>
                                                </>
                                            )}
                                            {order.status === 'packing' && (
                                                <>
                                                    <button onClick={() => handleUpdateStatus(order.id, order.mode === 'DELIVERY' ? 'on_way' : 'ready')} className="flex-1 bg-slate-900 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">Mark Ready</button>
                                                    <button onClick={() => setTrackingOrder(order)} className="px-4 bg-blue-50 text-blue-600 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><span>🛵</span> <span>Track</span></button>
                                                </>
                                            )}
                                            {(order.status === 'on_way' || order.status === 'ready') && (
                                                <>
                                                    <button onClick={() => handleUpdateStatus(order.id, order.mode === 'DELIVERY' ? 'delivered' : 'picked_up')} className="flex-1 bg-emerald-500 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">Finalize Order</button>
                                                    {order.mode === 'DELIVERY' && <button onClick={() => setTrackingOrder(order)} className="px-4 bg-blue-50 text-blue-600 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><span>🛵</span> <span>Track</span></button>}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        )}

        {activeTab === 'INVENTORY' && (
            <div className="max-w-lg mx-auto space-y-6 pb-20 animate-fade-in">
                {isAddingNew ? (
                    <div className="bg-white p-8 rounded-[3.5rem] shadow-xl border border-slate-100 space-y-6">
                        <div className="flex justify-between items-center mb-2">
                             <h2 className="text-2xl font-black text-slate-900 tracking-tight">Catalog Insertion</h2>
                             <button onClick={() => setIsAddingNew(false)} className="text-slate-300 p-2">✕</button>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1 space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Product Title</label>
                                {/* Comment: Cast e.target to any to bypass potential environment type mismatch */}
                                <input placeholder="e.g. Sourdough" value={newItem.name} onChange={e => setNewItem({...newItem, name: (e.target as any).value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold shadow-inner border-none outline-none" />
                            </div>
                            <div className="w-20 space-y-2 text-center">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Icon</label>
                                <button onClick={() => setShowEmojiPicker(true)} className="w-full h-14 bg-slate-50 rounded-2xl text-2xl flex items-center justify-center shadow-inner">{newItem.emoji}</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {/* Comment: Cast e.target to any to bypass potential environment type mismatch */}
                            <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase text-center block">Price</label><input type="number" value={newItem.price} onChange={e => setNewItem({...newItem, price: (e.target as any).value})} className="w-full bg-slate-50 p-3 rounded-xl text-center font-bold outline-none" /></div>
                            <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase text-center block">MRP</label><input type="number" value={newItem.mrp} onChange={e => setNewItem({...newItem, mrp: (e.target as any).value})} className="w-full bg-slate-50 p-3 rounded-xl text-center font-bold outline-none" /></div>
                            <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase text-center block">Qty</label><input type="number" value={newItem.stock} onChange={e => setNewItem({...newItem, stock: (e.target as any).value})} className="w-full bg-slate-50 p-3 rounded-xl text-center font-bold outline-none" /></div>
                        </div>
                        <button onClick={handleAddProduct} className="w-full bg-slate-900 text-white py-5 rounded-[2.5rem] font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Deploy to Terminal</button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center px-4">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Stock Console</h2>
                            <button onClick={() => setIsAddingNew(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase shadow-lg shadow-blue-500/20 active:scale-95">+ New Entry</button>
                        </div>
                        <div className="flex gap-2 overflow-x-auto px-4 pb-2 hide-scrollbar">
                            {categories.map(cat => (
                                <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase whitespace-nowrap transition-all ${categoryFilter === cat ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100 shadow-sm'}`}>{cat}</button>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 gap-4 px-2">
                            {inventory.filter(i => (categoryFilter === 'All' || i.category === categoryFilter) && i.isActive).map(item => (
                                <div key={item.id} className="bg-slate-900 border border-blue-900/30 p-6 rounded-[2.5rem] shadow-xl flex flex-col gap-5 group transition-all hover:bg-slate-800">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-3xl emoji-3d group-hover:scale-110 transition-transform">{item.emoji}</div>
                                        <div className="flex-1">
                                            <h4 className="font-black text-white text-base leading-none mb-1">{item.name}</h4>
                                            <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">{item.category}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/5">
                                        {/* Comment: Cast e.target to any to bypass potential environment type mismatch */}
                                        <div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase text-center block">Store (₹)</label><input type="number" value={item.storePrice} onChange={e => updateInventoryQuick(item, { storePrice: parseFloat((e.target as any).value) })} className="w-full bg-slate-800 text-blue-400 p-3 rounded-xl text-center font-black text-xs border-none outline-none focus:ring-1 focus:ring-blue-500" /></div>
                                        <div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase text-center block">MRP (₹)</label><input type="number" value={item.mrp || item.storePrice} onChange={e => updateInventoryQuick(item, { mrp: parseFloat((e.target as any).value) })} className="w-full bg-slate-800 text-slate-400 p-3 rounded-xl text-center font-black text-xs border-none outline-none focus:ring-1 focus:ring-blue-500" /></div>
                                        <div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase text-center block">QTY</label><input type="number" value={item.stock} onChange={e => updateInventoryQuick(item, { stock: parseInt((e.target as any).value) })} className={`w-full p-3 rounded-xl text-center font-black text-xs border-none outline-none focus:ring-1 focus:ring-blue-500 ${item.stock < 10 ? 'bg-red-900/30 text-red-400' : 'bg-slate-800 text-white'}`} /></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'TRANSACTIONS' && (
            <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
                <div className="px-2">
                    <h2 className="text-2xl font-black tracking-tight text-slate-900">Financial Ledger</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payout History & Revenue</p>
                </div>
                <div className="space-y-4">
                    {settlements.map(stl => (
                        <div key={stl.id} className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center text-xl font-black">₹</div>
                                <div>
                                    <h4 className="font-black text-slate-900 text-sm">₹{stl.amount.toLocaleString()}</h4>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Ref: #{stl.orderId.slice(-6)} • {new Date(stl.date).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <span className="block text-[8px] font-black text-emerald-500 uppercase">{stl.status === 'COMPLETED' ? 'Settled ✓' : 'Pending'}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'PROFILE' && (
            <div className="max-w-lg mx-auto p-4 animate-fade-in space-y-6">
                <div className="bg-white rounded-[3.5rem] p-10 shadow-soft-xl border border-slate-100 flex flex-col items-center">
                    <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center text-3xl font-black text-white mb-6 border-8 border-slate-50 shadow-inner">{user.name?.charAt(0)}</div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">{user.name}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{user.role?.replace('_', ' ')} • Active Session</p>
                </div>

                <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm space-y-8">
                    <div className="flex justify-between items-center px-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mart Configuration</h4>
                        {!isEditingProfile && (
                            <button onClick={() => setIsEditingProfile(true)} className="text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-xl uppercase tracking-widest border border-blue-100 shadow-sm">Edit Hub</button>
                        )}
                    </div>

                    {isEditingProfile ? (
                        <div className="space-y-5 px-1">
                            {/* Comment: Cast e.target to any to bypass potential environment type mismatch */}
                            <input value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: (e.target as any).value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="Mart Name" />
                            <textarea value={profileForm.address} onChange={e => setProfileForm({...profileForm, address: (e.target as any).value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none resize-none focus:ring-2 focus:ring-blue-500 transition-all" rows={2} placeholder="Address" />
                            <input value={profileForm.upiId} onChange={e => setProfileForm({...profileForm, upiId: (e.target as any).value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="UPI ID" />
                            <div className="grid grid-cols-2 gap-2 pt-4">
                                <button onClick={handleUpdateProfile} className="bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Save Hub</button>
                                <button onClick={() => setIsEditingProfile(false)} className="bg-slate-100 text-slate-400 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest">Back</button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex justify-between items-center">
                                <div>
                                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Hub Name</p>
                                    <p className="font-black text-slate-900 text-base">{myStore?.name}</p>
                                </div>
                                <span className="text-3xl">🏪</span>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2 pl-1">Settlement Endpoint (UPI)</p>
                                 <p className="font-bold text-slate-800 text-sm tracking-tight">{myStore?.upiId || 'Not Configured'}</p>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                                <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1 pl-1">Dispatch Node Address</p>
                                <p className="font-bold text-slate-600 text-xs leading-relaxed">{myStore?.address}</p>
                            </div>
                        </div>
                    )}
                    <button onClick={onLogout} className="w-full py-5 bg-red-50 text-red-500 rounded-[2.5rem] font-black uppercase text-[10px] tracking-widest border border-red-100 mt-4">Terminate Session</button>
                </div>
            </div>
        )}

        {activeTab === 'LOCATION' && (
            <div className="h-full flex flex-col animate-fade-in max-w-lg mx-auto relative">
                <div className="px-6 mb-8">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Hub Calibration</h2>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]">Calibrate store GPS for hyper-local discovery</p>
                </div>
                <div className="flex-1 relative rounded-[3.5rem] overflow-hidden border-4 border-white shadow-2xl mx-2">
                    <MapVisualizer stores={[]} userLat={myStore?.lat || 12.9716} userLng={myStore?.lng || 77.5946} selectedStore={null} onSelectStore={() => {}} mode="PICKUP" isSelectionMode={true} forcedCenter={{ lat: myStore?.lat || 12.9716, lng: myStore?.lng || 77.5946 }} />
                    <button 
                        onClick={handleDetectLive}
                        className="absolute bottom-10 right-10 z-[500] bg-slate-900 text-white px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-3 active:scale-95 transition-all"
                    >
                        <span className="text-2xl">⚡</span>
                        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Recalibrate GPS</span>
                    </button>
                </div>
            </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-slate-100 px-6 py-6 flex justify-between z-40 max-w-lg mx-auto rounded-t-[4rem] shadow-float">
           {[
             { id: 'DASHBOARD', icon: '📊', label: 'Terminal' }, 
             { id: 'ORDERS', icon: '📦', label: 'Queue' }, 
             { id: 'INVENTORY', icon: '💎', label: 'Inventory' },
             { id: 'TRANSACTIONS', icon: '💸', label: 'Ledger' }
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