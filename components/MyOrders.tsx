
import React, { useEffect, useState } from 'react';
import { Order, Store, OrderMode } from '../types';
import { MapVisualizer } from './MapVisualizer';
import { getUserOrders, subscribeToUserOrders } from '../services/orderService';

interface MyOrdersProps {
  userLocation: { lat: number; lng: number } | null;
  onPayNow?: (order: Order) => void;
  userId?: string;
}

const isValidCoord = (num: any): num is number => {
  return typeof num === 'number' && !isNaN(num) && isFinite(num);
};

export const MyOrders: React.FC<MyOrdersProps> = ({ userLocation, onPayNow, userId }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  // Animation Tick for Live Driver Movement
  useEffect(() => {
      const interval = setInterval(() => setTick(t => t + 1), 1000);
      return () => clearInterval(interval);
  }, []);

  // Fetch Orders on Mount or userId change
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        if (userId === 'demo-user' || (userId && userId.includes('demo'))) {
          // Demo Mode: Load from Local Storage
          const savedOrders = localStorage.getItem('grocesphere_orders');
          if (savedOrders) {
              setOrders(JSON.parse(savedOrders));
          } else {
              setOrders([]);
          }
        } else if (userId) {
          // Registered Mode: Load from Supabase DB
          const dbOrders = await getUserOrders(userId);
          setOrders(dbOrders);
        }
      } catch (error) {
        console.error("Failed to load orders:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();

    // REAL-TIME SUBSCRIPTION
    let subscription: any = null;
    if (userId && !userId.includes('demo')) {
        subscription = subscribeToUserOrders(userId, (updatedOrderDb) => {
            setOrders(prev => prev.map(o => {
                if (o.id === updatedOrderDb.id) {
                    let appStatus: Order['status'] = 'placed';
                    if (updatedOrderDb.status === 'packing') appStatus = 'packing';
                    if (updatedOrderDb.status === 'ready') appStatus = 'ready';
                    if (updatedOrderDb.status === 'on_way') appStatus = 'on_way';
                    if (updatedOrderDb.status === 'delivered') appStatus = 'delivered';
                    if (updatedOrderDb.status === 'picked_up') appStatus = 'picked_up';
                    if (updatedOrderDb.status === 'cancelled') appStatus = 'cancelled';
                    
                    return { ...o, status: appStatus };
                }
                return o;
            }));
        });
    }

    return () => {
        if (subscription) subscription.unsubscribe();
    };

  }, [userId]);

  // Simulator for status updates (ONLY for Demo Mode)
  useEffect(() => {
    if (!userId || !userId.includes('demo')) return;

    const interval = setInterval(() => {
      setOrders(prevOrders => {
        const updatedOrders = prevOrders.map((o): Order => {
            if (o.deliveryType === 'SCHEDULED' && o.paymentStatus === 'PENDING') return o;
            if (o.status === 'cancelled' || o.status === 'delivered' || o.status === 'picked_up') return o;

            if (o.status === 'placed') return { ...o, status: 'packing' };
            if (o.status === 'packing') return { ...o, status: o.mode === 'DELIVERY' ? 'on_way' : 'ready' };
            if (o.status === 'on_way') return { ...o, status: 'delivered' };
            if (o.status === 'ready') return { ...o, status: 'picked_up' };
            return o;
        });
        localStorage.setItem('grocesphere_orders', JSON.stringify(updatedOrders));
        return updatedOrders;
      });
    }, 15000); 

    return () => clearInterval(interval);
  }, [userId]);

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-fade-in">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-DEFAULT rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-bold text-sm">Loading History...</p>
        </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6 animate-fade-in">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-5xl mb-6 shadow-soft text-slate-300 border border-slate-100">
           🧾
        </div>
        <h3 className="text-xl font-black text-slate-800">No Past Orders</h3>
        <p className="text-slate-400 mt-2 font-medium max-w-[200px] mx-auto">Your order history will appear here once you make a purchase.</p>
      </div>
    );
  }

  const getStatusInfo = (status: string, mode: OrderMode) => {
      const deliverySteps = ['placed', 'packing', 'on_way', 'delivered'];
      const pickupSteps = ['placed', 'packing', 'ready', 'picked_up'];
      
      const steps = mode === 'DELIVERY' ? deliverySteps : pickupSteps;
      const currentIndex = steps.indexOf(status);
      const progress = ((currentIndex) / (steps.length - 1)) * 100;

      const getLabel = (step: string) => {
          if (step === 'placed') return 'Placed';
          if (step === 'packing') return 'Packing';
          if (step === 'on_way') return 'On Way';
          if (step === 'ready') return 'Ready';
          if (step === 'picked_up') return 'Picked Up';
          if (step === 'delivered') return 'Delivered';
          return step;
      };

      const getIcon = (step: string) => {
          if (step === 'placed') return '📝';
          if (step === 'packing') return '🥡';
          if (step === 'on_way') return '🛵';
          if (step === 'ready') return '🛍️';
          if (step === 'delivered' || step === 'picked_up') return '🏠';
          return '•';
      };

      return { steps, currentIndex, progress, getLabel, getIcon };
  };

  const getSimulatedDriverPos = (order: Order) => {
      if (order.status !== 'on_way' || !order.storeLocation || !order.userLocation) return undefined;
      
      if (!isValidCoord(order.storeLocation.lat) || !isValidCoord(order.storeLocation.lng) ||
          !isValidCoord(order.userLocation.lat) || !isValidCoord(order.userLocation.lng)) return undefined;

      const loopDuration = 30; 
      const offset = order.id.length; 
      const t = (tick + offset) % loopDuration;
      const progress = t / loopDuration;

      const lat = order.storeLocation.lat + (order.userLocation.lat - order.storeLocation.lat) * progress;
      const lng = order.storeLocation.lng + (order.userLocation.lng - order.storeLocation.lng) * progress;
      
      return { lat, lng };
  };

  return (
    <div className="pb-32 px-5 space-y-6 pt-4">
      <div className="flex items-center justify-between">
         <h2 className="font-black text-slate-800 text-2xl">History</h2>
         {userId?.includes('demo') && <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded text-slate-500">Demo Mode</span>}
         {userId && !userId.includes('demo') && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded animate-pulse">● Live Updates</span>}
      </div>
      
      {orders.map((order, idx) => {
        const isExpanded = expandedOrderId === order.id;
        const isCompleted = order.status === 'delivered' || order.status === 'picked_up';
        const isCancelled = order.status === 'cancelled';
        const isPickup = order.mode === 'PICKUP';
        const isPaymentPending = order.paymentStatus === 'PENDING';
        
        const { steps, currentIndex, progress, getLabel, getIcon } = getStatusInfo(order.status, order.mode);

        let statusColor = 'bg-blue-50 text-blue-700';
        if (isCompleted) statusColor = 'bg-green-50 text-green-700';
        if (isCancelled) statusColor = 'bg-red-50 text-red-700';
        if (order.status === 'placed') statusColor = 'bg-yellow-50 text-yellow-700';
        if (isPaymentPending) statusColor = 'bg-orange-50 text-orange-700';

        // Comment: Added verificationStatus to satisfy Store type definition
        const mapStore: Store = {
            id: `order-store-${order.id}`,
            name: order.storeName || 'Store',
            lat: isValidCoord(order.storeLocation?.lat) ? order.storeLocation!.lat : 12.9716,
            lng: isValidCoord(order.storeLocation?.lng) ? order.storeLocation!.lng : 77.5946,
            address: '',
            rating: 0,
            distance: '',
            isOpen: true,
            type: 'General Store',
            availableProductIds: [],
            verificationStatus: 'verified'
        };
        
        const driverPos = getSimulatedDriverPos(order);

        return (
          <div 
            key={order.id} 
            className={`bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 transition-all cursor-pointer hover:shadow-md animate-slide-up ${isExpanded ? 'ring-2 ring-slate-100' : ''}`}
            style={{ animationDelay: `${idx * 100}ms` }}
            onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
          >
            <div className="flex justify-between items-start mb-4">
               <div>
                  <h3 className="font-black text-slate-900 text-lg leading-tight">{order.storeName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-slate-400 uppercase">
                          {new Date(order.date).toLocaleDateString()}
                      </span>
                      <span className="text-xs font-black text-slate-300">•</span>
                      <span className="text-xs font-bold text-slate-800">₹{order.total}</span>
                  </div>
               </div>
               <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border border-transparent ${statusColor}`}>
                   {isPaymentPending ? 'Payment Pending' : order.status}
               </div>
            </div>

            {!isCancelled && !isPaymentPending && (
                 <div className="mb-6 px-2 pt-2 pb-2">
                    <div className="relative">
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 rounded-full -translate-y-1/2 z-0"></div>
                        <div 
                            className="absolute top-1/2 left-0 h-1 bg-brand-DEFAULT rounded-full -translate-y-1/2 z-0 transition-all duration-1000 ease-out"
                            style={{ width: `${progress}%` }}
                        ></div>
                        <div className="flex justify-between relative z-10 w-full">
                            {steps.map((step, i) => {
                                const isActive = i === currentIndex;
                                const isDone = i < currentIndex;
                                const isFuture = i > currentIndex;
                                return (
                                    <div key={step} className="flex flex-col items-center">
                                        <div 
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all duration-300 border-4 
                                            ${isDone ? 'bg-brand-DEFAULT border-brand-DEFAULT text-white scale-90' : ''}
                                            ${isActive ? 'bg-white border-brand-DEFAULT text-brand-DEFAULT scale-110 shadow-lg' : ''}
                                            ${isFuture ? 'bg-slate-50 border-slate-100 text-slate-300' : ''}
                                            `}
                                        >
                                            {isDone ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            ) : (
                                                <span>{getIcon(step)}</span>
                                            )}
                                        </div>
                                        <div className={`text-[9px] font-bold uppercase mt-2 transition-colors ${isActive ? 'text-brand-dark' : isDone ? 'text-brand-DEFAULT' : 'text-slate-300'}`}>
                                            {getLabel(step)}
                                        </div>
                                        {isActive && (
                                            <div className="absolute top-0 w-8 h-8 bg-brand-DEFAULT rounded-full animate-ping -z-10 opacity-30"></div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                 </div>
            )}

            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-slate-50 animate-fade-in">
                    {!isCancelled && !isCompleted && order.storeLocation && !isPaymentPending && (
                        <div className="h-40 rounded-2xl overflow-hidden mb-6 border border-slate-100 shadow-inner relative z-0" onClick={(e) => e.stopPropagation()}>
                            <MapVisualizer
                                stores={[mapStore]}
                                selectedStore={mapStore}
                                userLat={isValidCoord(userLocation?.lat) ? userLocation!.lat : 12.9716}
                                userLng={isValidCoord(userLocation?.lng) ? userLocation!.lng : 77.5946}
                                mode={order.mode}
                                onSelectStore={() => {}}
                                showRoute={true}
                                enableExternalNavigation={isPickup}
                                className="h-full"
                                driverLocation={driverPos}
                            />
                        </div>
                    )}
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 pl-1">Order Items</h4>
                    <div className="space-y-3 mb-5">
                        {order.items.map((item, i) => (
                            <div key={i} className="flex justify-between items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="text-xl bg-white w-10 h-10 flex items-center justify-center rounded-xl shadow-sm border border-slate-50">
                                        {item.emoji}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                            {item.quantity} unit{item.quantity > 1 ? 's' : ''} × ₹{item.price}
                                        </div>
                                    </div>
                                </div>
                                <div className="font-black text-slate-900 text-sm">
                                    ₹{item.price * item.quantity}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
