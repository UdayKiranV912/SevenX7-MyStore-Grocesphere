
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
     1️⃣ LOAD REAL USER FROM SUPABASE
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
     2️⃣ REALTIME PROFILE UPDATES (ONLY FOR REAL USERS)
  ============================================================ */
  useEffect(() => {
    if (!user?.id || user.isDemo) return;

    const channel = supabase
      .channel('profile-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        payload => {
          if (payload.new.id === user.id) {
            setUser(prev => ({ 
                ...prev!, 
                ...payload.new,
                name: payload.new.full_name,
                phone: payload.new.phone_number 
            }));
          }
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
      await supabase.auth.signOut();
    }
    setUser(null);
  };

  /* ============================================================
     4️⃣ DEMO LOGIN HELPER (STORE ONLY)
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
     5️⃣ AUTH SCREEN
  ============================================================ */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
    </div>
  );

  if (!user?.isAuthenticated) {
    return (
      <Auth
        onLoginSuccess={handleLoginSuccess}
        onDemoStore={handleDemoStoreLogin}
      />
    );
  }

  /* ============================================================
     6️⃣ VERIFICATION GATE (REAL USERS ONLY)
  ============================================================ */
  if (!user.isDemo && user.verification_status !== 'verified') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center text-3xl mb-6 shadow-sm">⏳</div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Verification Pending</h2>
        <p className="text-slate-500 max-w-xs text-sm leading-relaxed mb-8">Your account is under review by Super Admin. You will be logged in automatically once approved.</p>
        <button onClick={handleLogout} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Logout</button>
      </div>
    );
  }

  /* ============================================================
     7️⃣ ROLE-BASED ROUTING
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

  // Merchants (Real and Demo) land here
  return <StoreApp user={user} onLogout={handleLogout} />;
};

export default App;
