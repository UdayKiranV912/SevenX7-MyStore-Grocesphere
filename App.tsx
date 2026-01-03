
import React, { useEffect, useState } from 'react';
import { supabase } from './services/supabaseClient';
import { UserState } from './types';

import { Auth } from './components/OTPVerification';
import { StoreApp } from './components/store/StoreApp';
import { SuperAdminApp } from './components/admin/SuperAdminApp';

const App: React.FC = () => {
  const [user, setUser] = useState<UserState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profile) {
          setUser({
            ...profile,
            name: profile.full_name,
            phone: profile.phone,
            isAuthenticated: true,
            isDemo: false,
            location: null,
            verification_status: profile.approval_status === 'approved' ? 'verified' : (profile.approval_status as any)
          });
      }
      setLoading(false);
    });
  }, []);

  // Real-time listener for profile updates (approval status)
  useEffect(() => {
    if (!user?.id || user.isDemo) return;

    const channel = supabase
      .channel(`profile-sync-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        payload => {
          setUser(prev => {
            if (!prev) return null;
            return { 
                ...prev, 
                ...payload.new,
                name: payload.new.full_name,
                phone: payload.new.phone,
                verification_status: payload.new.approval_status === 'approved' ? 'verified' : payload.new.approval_status
            };
          });
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, user?.isDemo]);

  const handleLogout = async () => {
    if (!user?.isDemo) await supabase.auth.signOut();
    setUser(null);
  };

  const handleLoginSuccess = (userData: UserState) => {
    setUser({ ...userData, isAuthenticated: true, isDemo: false });
  };

  const handleDemoStoreLogin = () => {
    setUser({
      id: `demo-store_owner`,
      name: `Demo Merchant`,
      phone: '9999999999',
      role: 'store',
      verification_status: 'verified',
      isAuthenticated: true,
      isDemo: true,
      location: null
    });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-6">
            <div className="w-14 h-14 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Establishing Peer Network...</p>
        </div>
    </div>
  );

  if (!user?.isAuthenticated) return <Auth onLoginSuccess={handleLoginSuccess} onDemoStore={handleDemoStoreLogin} />;

  // 1. Approval Gate
  if (!user.isDemo && user.verification_status !== 'verified' && user.role !== 'super_admin' && user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="w-full max-w-sm bg-white p-12 rounded-[4.5rem] shadow-soft-xl border border-slate-100 flex flex-col items-center gap-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-50"><div className="h-full bg-emerald-500 w-1/4 animate-[audit-slide_2s_infinite_linear]"></div></div>
            <style>{`@keyframes audit-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }`}</style>
            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center text-5xl shadow-inner border border-emerald-100">⚖️</div>
            <div className="space-y-4">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">Terminal Audit <br/> In Progress</h2>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">System identity is being verified by governance. The terminal will automatically unlock upon approval.</p>
            </div>
            <button onClick={handleLogout} className="text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-red-500 transition-colors">Abort & Logout</button>
        </div>
      </div>
    );
  }

  // 2. Main Routing
  if (user.role === 'super_admin' || user.role === 'admin') return <SuperAdminApp user={user} onLogout={handleLogout} />;
  
  return <StoreApp user={user} onLogout={handleLogout} />;
};

export default App;
