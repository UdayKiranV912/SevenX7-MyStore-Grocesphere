
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
     1️⃣ INITIAL SESSION LOAD
  ============================================================ */
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setLoading(false);
        return;
      }

      // Fetch profile to check verification status
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
     2️⃣ REAL-TIME VERIFICATION HANDSHAKE
     Listens for the 'verified' signal from the Super Admin
  ============================================================ */
  useEffect(() => {
    if (!user?.id || user.isDemo) return;

    // Establishing a private channel for this user's profile
    const channel = supabase
      .channel(`profile-handshake-${user.id}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles', 
          filter: `id=eq.${user.id}` 
        },
        payload => {
          // Trigger immediate UI refresh on status change
          if (payload.new.verification_status === 'verified') {
              console.log("Handshake successful: Terminal Unlocked");
          }
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

  const handleLogout = async () => {
    if (!user?.isDemo) {
      await (supabase.auth as any).signOut();
    }
    setUser(null);
  };

  const handleLoginSuccess = (userData: UserState) => {
    setUser({
        ...userData,
        isAuthenticated: true,
        isDemo: false
    });
  };

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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Initializing Terminal...</p>
        </div>
    </div>
  );

  // AUTHENTICATION GATE
  if (!user?.isAuthenticated) {
    return (
      <Auth
        onLoginSuccess={handleLoginSuccess}
        onDemoStore={handleDemoStoreLogin}
      />
    );
  }

  /* ============================================================
     3️⃣ VERIFICATION GATE (LIVE PENDING STATE)
     This screen blocks access until the DB status is updated
  ============================================================ */
  if (!user.isDemo && user.verification_status !== 'verified') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="w-full max-w-sm bg-white p-10 rounded-[4rem] shadow-soft-xl border border-slate-100 flex flex-col items-center gap-8 relative overflow-hidden">
            {/* Progress Bar Animation */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100">
                <div className="h-full bg-emerald-500 w-1/4 animate-[loading-slide_2s_infinite_linear]"></div>
            </div>
            
            <style>{`
                @keyframes loading-slide {
                    0% { transform: translateX(-100%); width: 20%; }
                    50% { width: 50%; }
                    100% { transform: translateX(500%); width: 20%; }
                }
            `}</style>

            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center text-5xl shadow-inner border border-emerald-100">
                <span className="animate-bounce">⚖️</span>
            </div>
            
            <div className="space-y-3">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Audit in Progress</h2>
                <p className="text-slate-400 text-sm font-medium leading-relaxed px-2">Your merchant identity is being verified by the Super Admin. This terminal will activate instantly upon approval.</p>
            </div>

            <div className="w-full bg-slate-50 p-5 rounded-[2rem] flex flex-col items-center gap-2 border border-slate-100">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Live Handshake Established</span>
                </div>
                <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Waiting for Signal...</p>
            </div>

            <button onClick={handleLogout} className="text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-slate-900 transition-colors pt-2">Exit Portal</button>
        </div>
      </div>
    );
  }

  /* ============================================================
     4️⃣ ROLE-BASED HUB ROUTING
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

  // Merchant Terminal (Real & Demo)
  return <StoreApp user={user} onLogout={handleLogout} />;
};

export default App;
