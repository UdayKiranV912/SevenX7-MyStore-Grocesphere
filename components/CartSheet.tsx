
import React, { useState, useEffect, useRef } from 'react';
import { CartItem, DeliveryType, Store, Product, PaymentMethod } from '../types';
import { MapVisualizer } from './MapVisualizer';
import { INITIAL_PRODUCTS, MOCK_STORES } from '../constants';
import { reverseGeocode } from '../services/locationService';
import { AddressAutocomplete } from './AddressAutocomplete';

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (id: string, delta: number) => void;
  index: number;
}

const CartItemRow: React.FC<CartItemRowProps> = ({ item, onUpdateQuantity, index }) => {
  const [isHighlighted, setIsHighlighted] = useState(false);
  const prevQty = useRef(item.quantity);
  const mrp = item.mrp || item.price;
  const savings = (mrp - item.price) * item.quantity;

  useEffect(() => {
    if (prevQty.current !== item.quantity) {
      setIsHighlighted(true);
      const timer = setTimeout(() => setIsHighlighted(false), 300);
      prevQty.current = item.quantity;
      return () => clearTimeout(timer);
    }
  }, [item.quantity]);

  return (
    <div 
       className={`p-3 pr-4 rounded-2xl shadow-sm flex items-center gap-4 animate-slide-up border transition-all duration-300 ${
           isHighlighted 
             ? 'bg-brand-light border-brand-DEFAULT/30 scale-[1.02] shadow-md' 
             : 'bg-white border-slate-100/50 hover:shadow-md'
       }`}
       style={{ animationDelay: `${index * 50}ms` }}
     >
        <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center text-3xl shrink-0 transition-transform duration-300 group-hover:scale-110">
            {item.emoji}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
           <h3 className="font-bold text-slate-800 text-sm truncate leading-tight">{item.name}</h3>
           {item.selectedBrand && item.selectedBrand !== 'Generic' && (
               <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded w-fit">{item.selectedBrand}</span>
           )}
           <div className="flex items-center gap-2 mt-0.5">
               <span className="text-xs font-bold text-slate-800">₹{item.price}</span>
               {mrp > item.price && (
                   <span className="text-[10px] text-slate-400 line-through">₹{mrp}</span>
               )}
           </div>
           {savings > 0 && (
               <span className="text-[9px] font-bold text-green-600">Saved ₹{savings}</span>
           )}
        </div>
        <div className="flex items-center gap-2 bg-slate-100/50 p-1 rounded-xl">
            <button 
              onClick={() => onUpdateQuantity(item.id, -1)}
              className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-600 hover:text-red-500 font-bold transition-all active:scale-90"
            >−</button>
            <span className={`w-6 text-center text-sm font-black text-slate-800`}>{item.quantity}</span>
            <button 
              onClick={() => onUpdateQuantity(item.id, 1)}
              className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-600 hover:text-brand-DEFAULT font-bold transition-all active:scale-90"
            >+</button>
        </div>
     </div>
  );
};

interface SuggestionsProps {
    suggestions: Product[];
    onAddProduct: (p: Product) => void;
}

const SuggestionsList: React.FC<SuggestionsProps> = ({ suggestions, onAddProduct }) => {
    if (suggestions.length === 0) return null;
    return (
        <div className="mt-4 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wide mb-3 px-1">You might have missed</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar -mx-2 px-2 snap-x">
                {(suggestions as Product[]).map((product) => (
                    <div key={product.id} className="min-w-[130px] bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col snap-start flex-shrink-0">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-2xl self-center mb-2 shadow-sm">{product.emoji}</div>
                        <div className="font-bold text-slate-800 text-xs truncate mb-1">{product.name}</div>
                        <div className="flex justify-between items-center mt-auto pt-2">
                            <span className="text-xs font-bold text-slate-500">₹{product.price}</span>
                            <button onClick={() => onAddProduct(product)} className="w-6 h-6 bg-white text-brand-DEFAULT rounded-lg flex items-center justify-center font-bold shadow-sm">+</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export interface CartDetailsProps {
  cart: CartItem[];
  onProceedToPay: (details: { deliveryType: DeliveryType; scheduledTime?: string; paymentMethod: PaymentMethod; splits: any }) => void;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onAddProduct: (product: Product) => void;
  mode: 'DELIVERY' | 'PICKUP';
  onModeChange: (mode: 'DELIVERY' | 'PICKUP') => void;
  deliveryAddress: string;
  onAddressChange: (address: string) => void;
  activeStore: Store | null;
  stores: Store[]; 
  userLocation: { lat: number; lng: number } | null;
  isPage?: boolean;
  onClose?: () => void;
}

export const CartDetails: React.FC<CartDetailsProps> = ({
  cart,
  onProceedToPay,
  onUpdateQuantity,
  onAddProduct,
  mode,
  onModeChange,
  deliveryAddress,
  onAddressChange,
  activeStore,
  stores,
  userLocation,
  isPage = false,
  onClose
}) => {
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('INSTANT');
  const [scheduledTime, setScheduledTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ONLINE');
  const [isLocatingAddress, setIsLocatingAddress] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number} | null>(userLocation);
  
  const MINIMUM_ORDER_VALUE = 1000; 
  const BASE_DELIVERY_FEE = 30;

  useEffect(() => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    setScheduledTime(now.toISOString().slice(0, 16));
  }, []);

  const groupedItems = React.useMemo(() => {
    const groups: Record<string, CartItem[]> = {};
    cart.forEach(item => {
        if (!groups[item.storeId]) groups[item.storeId] = [];
        groups[item.storeId].push(item);
    });
    return groups;
  }, [cart]);

  const itemsTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const itemsTotalMrp = cart.reduce((acc, item) => acc + ((item.mrp || item.price) * item.quantity), 0);
  const totalSavings = itemsTotalMrp - itemsTotal;
  const isMovMet = itemsTotal >= MINIMUM_ORDER_VALUE;
  const deliveryFee = mode === 'DELIVERY' ? (isMovMet ? 0 : BASE_DELIVERY_FEE * Object.keys(groupedItems).length) : 0;
  const total = itemsTotal + deliveryFee;

  const handlePay = () => {
    onProceedToPay({
      deliveryType,
      scheduledTime,
      paymentMethod,
      splits: {
        storeAmount: itemsTotal,
        deliveryFee: deliveryFee,
        storeUpi: activeStore?.upiId || 'store@upi'
      }
    });
  };

  if (cart.length === 0 && isPage) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6 animate-fade-in">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-5xl mb-6 shadow-soft text-slate-300 border border-slate-100">🛒</div>
        <h3 className="text-2xl font-black text-slate-800">Empty Cart</h3>
        <button onClick={onClose} className="mt-8 bg-slate-900 text-white font-bold py-4 px-10 rounded-2xl shadow-lg">Start Shopping</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      <div className={`px-6 pb-6 bg-white/90 backdrop-blur-md flex justify-between items-end sticky top-0 z-10 border-b border-slate-100 ${isPage ? 'pt-8' : ''}`}>
         <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Checkout</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{mode}</p>
         </div>
         <div className="bg-slate-100 text-slate-600 px-4 py-1.5 rounded-full text-xs font-black">{cart.length} items</div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 hide-scrollbar space-y-6 pb-48">
         <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-6">
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded-2xl">
                <button onClick={() => onModeChange('DELIVERY')} className={`py-3 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${mode === 'DELIVERY' ? 'bg-white text-brand-DEFAULT shadow-sm' : 'text-slate-400'}`}>Delivery</button>
                <button onClick={() => onModeChange('PICKUP')} className={`py-3 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${mode === 'PICKUP' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>Pickup</button>
            </div>

            {mode === 'DELIVERY' ? (
                <AddressAutocomplete value={deliveryAddress} onChange={onAddressChange} onSelect={(lat, lng, addr) => onAddressChange(addr)} placeholder="Delivery Address..." />
            ) : (
                <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Payment Method</p>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setPaymentMethod('ONLINE')} className={`p-4 rounded-2xl border-2 text-left transition-all ${paymentMethod === 'ONLINE' ? 'border-brand-DEFAULT bg-brand-light' : 'border-slate-100 bg-white'}`}>
                            <div className="text-xl mb-1">🛡️</div>
                            <div className="font-bold text-xs">Online Pay</div>
                        </button>
                        <button onClick={() => setPaymentMethod('DIRECT')} className={`p-4 rounded-2xl border-2 text-left transition-all ${paymentMethod === 'DIRECT' ? 'border-brand-DEFAULT bg-brand-light' : 'border-slate-100 bg-white'}`}>
                            <div className="text-xl mb-1">🏪</div>
                            <div className="font-bold text-xs">Pay at Mart</div>
                        </button>
                    </div>
                </div>
            )}
         </div>

         {/* Comment: Casting items to any or CartItem[] explicitly to avoid 'unknown' error in certain environments */}
         {(Object.entries(groupedItems) as [string, CartItem[]][]).map(([storeId, items]) => (
              <div key={storeId} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-4"><h3 className="font-black text-slate-800 text-sm">{items[0].storeName}</h3></div>
                  <div className="space-y-3">{(items as CartItem[]).map((item, idx) => <CartItemRow key={item.id} item={item} index={idx} onUpdateQuantity={onUpdateQuantity} />)}</div>
              </div>
         ))}
      </div>

      <div className="fixed bottom-24 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 p-6 pb-8 z-30 rounded-t-[2.5rem] shadow-float">
         <div className="flex justify-between items-end mb-6">
            <div><p className="text-[10px] font-bold text-slate-400 uppercase">Total Payable</p><div className="text-3xl font-black text-slate-900">₹{total}</div></div>
            {totalSavings > 0 && <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg">Saving ₹{totalSavings}</span>}
         </div>
         <button onClick={handlePay} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl flex justify-between px-6 items-center">
            <span>{paymentMethod === 'DIRECT' && mode === 'PICKUP' ? 'Confirm Pickup' : `Pay ₹${total}`}</span>
            <span className="text-xl">→</span>
         </button>
      </div>
    </div>
  );
};
