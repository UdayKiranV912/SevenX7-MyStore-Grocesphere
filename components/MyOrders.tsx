
import React, { useEffect, useState } from 'react';
import { Order, Store, OrderMode } from '../types';
import { MapVisualizer } from './MapVisualizer';
import { getUserOrders, subscribeToUserOrders } from '../services/orderService';
import { getBrowserLocation } from '../services/locationService';

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
  const [realTimeUserLoc, setRealTimeUserLoc] = useState<{lat: number, lng: number} | null>(null);

  // Animation Tick for Live Driver Movement
  useEffect(() => {
      const interval = setInterval(() => setTick(t => t + 1), 1000);
      return () => clearInterval(interval);
  }, []);

  // Attempt to get real browser location for Demo simulation accuracy
  useEffect(() => {
      if (userId?.includes('demo')) {
          getBrowserLocation().then(loc => setRealTimeUserLoc({ lat: loc.lat, lng: loc.lng }))
                             .catch(() => {}); // Fallback handled in simulation
      }
  }, [userId]);

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
                    let appStatus: Order['status'] = updatedOrderDb.status;
                    return { 
                      ...o, 
                      status: appStatus,
                      driverLocation: updatedOrderDb.driver_lat && updatedOrderDb.driver_lng 
                        ? { lat: updatedOrderDb.driver_lat, lng: updatedOrderDb.driver_lng } 
                        : o.driverLocation
                    };
                }
                return o;
            }));
        });
    }

    return () => {
        if (subscription) subscription.unsubscribe();
    };

  }, [userId]);

  const getStatusInfo = (status: string, mode: OrderMode) => {
      const deliverySteps = ['PLACED', 'PACKING', 'ON_THE_WAY', 'DELIVERED'];
      const pickupSteps = ['PLACED', 'PACKING', 'READY', 'picked_up'];
      
      const normalizedStatus = status.toUpperCase();
      const steps = (mode.toUpperCase() === 'DELIVERY' || mode === 'delivery') ? deliverySteps : pickupSteps;
      const currentIndex = steps.indexOf(normalizedStatus);
      const progress = currentIndex === -1 ? 0 : ((currentIndex) / (steps.length - 1)) * 100;

      const getLabel = (step: string) => {
          if (step === 'PLACED') return 'Placed';
          if (step === 'PACKING') return 'Packing';
          if (step === 'ON_THE_WAY') return 'On Way';
          if (step === 'READY') return 'Ready';
          if (step === 'picked_up' || step === 'PICKED_UP') return 'Picked Up';
          if (step === 'DELIVERED') return 'Delivered';
          return step;
      };

      const getIcon = (step: string) => {
          if (step === 'PLACED') return '📝';
          if (step === 'PACKING') return '🥡';
          if (step === 'ON_THE_WAY') return '🛵';
          if (step === 'READY') return '🛍️';
          if (step === 'DELIVERED' || step === 'picked_up' || step === 'PICKED_UP') return '🏠';
          return '•';
      };

      return { steps, currentIndex, progress, getLabel, getIcon };
  };

  const getSimulatedDriverPos = (order: Order) => {
      // 1. FOR REAL USERS: USE REAL TIME DATA ONLY
      if (userId && !userId.includes('demo')) {
          return order.driverLocation;
      }

      // 2. FOR DEMO MODE: MOCK SIMULATION WITH REAL-TIME ANCHOR
      const normalizedStatus = order.status.toUpperCase();
      const isLiveTracking = normalizedStatus === 'ON_THE_WAY' || normalizedStatus === 'PACKING';
      if (!isLiveTracking || !order.storeLocation) return undefined;
      
      // Use real browser location as destination if available, otherwise fallback to store offset
      const destination = realTimeUserLoc || order.userLocation || { lat: order.storeLocation.lat + 0.01, lng: order.storeLocation.lng + 0.01 };

      if (!isValidCoord(order.storeLocation.lat) || !isValidCoord(order.storeLocation.lng) ||
          !isValidCoord(destination.lat) || !isValidCoord(destination.lng)) return undefined;

      const loopDuration = 60; 
      const offset = order.id.length * 2; 
      const t = (tick + offset) % loopDuration;
      const progress = t / loopDuration;

      // Phase 1: Rider -> Store (Pickup)
      if (normalizedStatus === 'PACKING') {
          const startLat = order.storeLocation.lat + 0.005;
          const startLng = order.storeLocation.lng + 0.005;
          return {
              lat: startLat + (order.storeLocation.lat - startLat) * progress,
              lng: startLng + (order.storeLocation.lng - startLng) * progress
          };
      }

      // Phase 2: Store -> User (Delivery)
      const lat = order.storeLocation.lat + (destination.lat - order.storeLocation.lat) * progress;
      const lng = order.storeLocation.lng + (destination.lng - order.storeLocation.lng) * progress;
      
      return { lat, lng };
  };

  return (
    <div className="pb-32 px-5 space-y-6 pt-4">
      <div className="flex items-center justify-between">
         <h2 className="font-black text-slate-800 text-2xl">History</h2>
         {userId?.includes('demo') && <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100 animate-pulse">Live Demo Tracking</span>}
         {userId && !userId.includes('demo') && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded animate-pulse">● Live Updates</span>}
      </div>
      
      {orders.map((order, idx) => {
        const isExpanded = expandedOrderId === order.id;
        const normalizedStatus = order.status.toUpperCase();
        const isCompleted = normalizedStatus === 'DELIVERED' || normalizedStatus === 'PICKED_UP';
        const isCancelled = normalizedStatus === 'CANCELLED';
        const isPaymentPending = order.paymentStatus === 'PENDING';
        
        const { steps, currentIndex, progress, getLabel, getIcon } = getStatusInfo(order.status, order.mode);

        let statusColor = 'bg-blue-50 text-blue-700';
        if (isCompleted) statusColor = 'bg-green-50 text-green-700';
        if (isCancelled) statusColor = 'bg-red-50 text-red-700';
        if (normalizedStatus === 'PLACED') statusColor = 'bg-yellow-50 text-yellow-700';
        if (isPaymentPending) statusColor = 'bg-orange-50 text-orange-700';

        const mapStore: Store = {
            id: `order-store-${order.id}`,
            owner_id: order.store_id || 'store',
            store_name: order.storeName || 'Store',
            name: order.storeName || 'Store',
            lat: isValidCoord(order.storeLocation?.lat) ? order.storeLocation!.lat : 12.9716,
            lng: isValidCoord(order.storeLocation?.lng) ? order.storeLocation!.lng : 77.5946,
            address: '',
            rating: 0,
            distance: '',
            isOpen: true,
            status: 'active',
            upi_id: 'store@upi',
            store_type: 'General Store',
            availableProductIds: [],
            verificationStatus: 'verified',
            approved: true,
            active: true,
            emoji: '🏪',
            openingTime: '08:00 AM',
            closingTime: '09:00 PM'
        };
        
        const driverPos = getSimulatedDriverPos(order);
        const isRealUser = userId && !userId.includes('demo');
        const showMap = !isCancelled && !isCompleted && order.storeLocation && !isPaymentPending && (isRealUser ? (!!order.driverLocation || normalizedStatus === 'ON_THE_WAY' || normalizedStatus === 'PACKING') : true);

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
                          {new Date(order.created_at).toLocaleDateString()}
                      </span>
                      <span className="text-xs font-black text-slate-300">•</span>
                      <span className="text-xs font-bold text-slate-800">₹{order.total_amount}</span>
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
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                 </div>
            )}

            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-slate-50 animate-fade-in">
                    {showMap && (
                        <div className="h-44 rounded-[2.5rem] overflow-hidden mb-6 border-4 border-slate-50 shadow-inner relative z-0" onClick={(e) => e.stopPropagation()}>
                            <MapVisualizer
                                stores={[mapStore]}
                                selectedStore={mapStore}
                                userLat={realTimeUserLoc?.lat || (isValidCoord(userLocation?.lat) ? userLocation!.lat : 12.9716)}
                                userLng={realTimeUserLoc?.lng || (isValidCoord(userLocation?.lng) ? userLocation!.lng : 77.5946)}
                                mode={order.mode}
                                onSelectStore={() => {}}
                                showRoute={true}
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
