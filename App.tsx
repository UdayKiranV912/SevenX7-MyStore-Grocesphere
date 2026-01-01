
import React, { useEffect, useState } from 'react';
import { supabase } from './services/supabaseClient';
import { UserState } from './types';

import { Auth } from './components/OTPVerification';
import { StoreApp } from './components/store/StoreApp';
import { CustomerApp } from './components/customer/CustomerApp';
import { SuperAdminApp } from './components/admin/SuperAdminApp';
import { DeliveryApp } from './components/delivery/DeliveryApp';

const App: React.FC = () => {
  const [user, setUser] = useState<UserState | null>(null);
  const [loading, setLoading] = useState(true);

  /* ============================================================
     1️⃣ INITIAL AUTH LOAD
  ============================================================ */
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profile) {
          setUser({
            ...profile,
            name: profile.full_name,
            phone: profile.phone_number,
            isAuthenticated: true,
            isDemo: false,
            location: null
          });
      }

      setLoading(false);
    });
  }, []);

  /* ============================================================
     2️⃣ REAL-TIME VERIFICATION LISTENER
     This reacts instantly when Super Admin approves the user
  ============================================================ */
  useEffect(() => {
    if (!user?.id || user.isDemo) return;

    console.log("Establishing Real-Time Verification Link for:", user.id);
    
    const channel = supabase
      .channel(`user-profile-${user.id}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles', 
          filter: `id=eq.${user.id}` 
        },
        payload => {
          console.log("Profile Update Detected:", payload.new.verification_status);
          setUser(prev => {
            if (!prev) return null;
            return { 
                ...prev, 
                ...payload.new,
                name: payload.new.full_name,
                phone: payload.new.phone_number 
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.isDemo]);

  /* ============================================================
     3️⃣ LOGOUT
  ============================================================ */
  const handleLogout = async () => {
    if (!user?.isDemo) {
      await (supabase.auth as any).signOut();
    }
    setUser(null);
  };

  /* ============================================================
     4️⃣ LOGIN HANDLERS
  ============================================================ */
  const handleDemoStoreLogin = () => {
    setUser({
      id: `demo-store_owner`,
      name: `Demo Merchant Terminal`,
      phone: '9999999999',
      role: 'store_owner',
      verification_status: 'verified',
      isAuthenticated: true,
      isDemo: true,
      location: null
    });
  };

  const handleLoginSuccess = (userData: UserState) => {
    setUser({
        ...userData,
        isAuthenticated: true,
        isDemo: false
    });
  };

  /* ============================================================
     5️⃣ LOADING STATE
  ============================================================ */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Initializing Hub...</p>
        </div>
    </div>
  );

  /* ============================================================
     6️⃣ AUTH GATE
  ============================================================ */
  if (!user?.isAuthenticated) {
    return (
      <Auth
        onLoginSuccess={handleLoginSuccess}
        onDemoStore={handleDemoStoreLogin}
      />
    );
  }

  /* ============================================================
     7️⃣ VERIFICATION GATE (REAL USERS ONLY)
     This screen waits for the Real-Time Listener to change status
  ============================================================ */
  if (!user.isDemo && user.verification_status !== 'verified') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
        <div className="w-full max-w-sm bg-white p-10 rounded-[3.5rem] shadow-soft-xl border border-slate-100 flex flex-col items-center gap-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500/10 overflow-hidden">
                <div className="h-full bg-emerald-500 w-1/3 animate-[slide_2s_infinite_linear]"></div>
            </div>
            
            <style>{`
                @keyframes slide {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(300%); }
                }
            `}</style>

            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center text-5xl shadow-inner border border-emerald-100 animate-pulse">⚖️</div>
            
            <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">Verification Pending</h2>
                <p className="text-slate-400 text-sm leading-relaxed font-medium">Your merchant profile is being audited by the Super Admin. The terminal will activate automatically upon approval.</p>
            </div>

            <div className="w-full bg-slate-50 p-4 rounded-2xl flex items-center justify-center gap-3 border border-slate-100">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Awaiting Live Handshake...</span>
            </div>

            <button onClick={handleLogout} className="text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-red-500 transition-colors">Cancel & Logout</button>
        </div>
      </div>
    );
  }

  /* ============================================================
     8️⃣ FINAL ROUTING
  ============================================================ */
  if (user.role === 'super_admin') {
    return <SuperAdminApp user={user} onLogout={handleLogout} />;
  }

  if (user.role === 'customer') {
    return <CustomerApp user={user} onLogout={handleLogout} />;
  }

  if (user.role === 'delivery_partner') {
    return <DeliveryApp user={user} onLogout={handleLogout} />;
  }

  // Merchants (Real and Demo)
  return <StoreApp user={user} onLogout={handleLogout} />;
};

export default App;
