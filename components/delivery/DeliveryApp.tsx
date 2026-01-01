
import React, { useState, useEffect } from 'react';
import { UserState, Order } from '../../types';
import SevenX7Logo from '../SevenX7Logo';
import { MapVisualizer } from '../MapVisualizer';
import { watchLocation, clearWatch } from '../../services/locationService';

interface DeliveryAppProps {
  user: UserState;
  onLogout: () => void;
}

export const DeliveryApp: React.FC<DeliveryAppProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'TASKS' | 'WALLET' | 'PROFILE'>('TASKS');
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    const watchId = watchLocation(
      (loc) => setCurrentLocation({ lat: loc.lat, lng: loc.lng }),
      (err) => console.error(err)
    );
    return () => clearWatch(watchId);
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col overflow-hidden text-slate-900">
      <header className="bg-white px-6 shadow-sm z-20 shrink-0 border-b border-slate-100 flex items-center justify-between h-16 sm:h-20">
         <SevenX7Logo size="xs" hideGrocesphere={true} />
         <div className="hidden md:block text-center">
           <h1 className="text-sm font-black text-slate-900 truncate tracking-tight">Delivery Fleet</h1>
           <p className="text-[7px] font-black text-emerald-500 uppercase tracking-widest">Active Partner: {user.name}</p>
         </div>
         <button onClick={onLogout} className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exit</button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-32 hide-scrollbar">
        {activeTab === 'TASKS' && (
            <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
                <div className="px-2">
                    <h2 className="text-2xl font-black tracking-tight text-slate-900">Pending Deliveries</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nearby Assignments</p>
                </div>

                <div className="h-64 rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-inner relative">
                    <MapVisualizer 
                        stores={[]} 
                        userLat={currentLocation?.lat || 12.9716} 
                        userLng={currentLocation?.lng || 77.5946} 
                        selectedStore={null} 
                        onSelectStore={() => {}} 
                        mode="DELIVERY" 
                    />
                </div>

                <div className="space-y-4">
                    <div className="text-center py-20 opacity-20 font-black uppercase tracking-widest text-[10px]">Searching for high-priority tasks...</div>
                </div>
            </div>
        )}

        {activeTab === 'WALLET' && (
            <div className="max-w-lg mx-auto p-6 space-y-6">
                 <div className="bg-slate-900 p-8 rounded-[3.5rem] text-white shadow-2xl">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Earnings Balance</p>
                     <h2 className="text-4xl font-black tracking-tighter mb-1">₹0.00</h2>
                     <p className="text-[10px] text-emerald-400 font-bold uppercase mt-4">Next Payout: Monday</p>
                 </div>
            </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-slate-100 px-6 py-6 flex justify-between z-40 max-w-lg mx-auto rounded-t-[4rem] shadow-float">
           {[
             { id: 'TASKS', icon: '🛵', label: 'Tasks' }, 
             { id: 'WALLET', icon: '💳', label: 'Wallet' }, 
             { id: 'PROFILE', icon: '👤', label: 'Profile' }
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
