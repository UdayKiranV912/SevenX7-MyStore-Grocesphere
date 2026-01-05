
import React, { useEffect, useState } from 'react';
import { supabase } from './services/supabaseClient';
import { Profile } from './types';
import { Auth } from './components/OTPVerification';
import { StoreApp } from './components/store/StoreApp';

const App: React.FC = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data as Profile);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) fetchProfile(session.user.id);
      setLoading(false);
    });

    const authSub = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) fetchProfile(session.user.id);
      else if (!isDemo) setProfile(null);
    });

    return () => {
      authSub.data.subscription.unsubscribe();
    };
  }, [isDemo]);

  const handleDemo = () => {
    setIsDemo(true);
    setProfile({
      id: 'demo-merchant',
      email: 'demo@mart.com',
      name: 'Demo Merchant',
      phone: '9999988888',
      role: 'store',
      admin_approved: true,
      active: true,
      upi_id: 'demo@okaxis',
      created_at: new Date().toISOString()
    });
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="w-14 h-14 border-4 border-slate-800 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] animate-pulse">Syncing Hub...</p>
      </div>
    </div>
  );

  if (!profile) return <Auth onLoginSuccess={(u) => fetchProfile(u.id)} onDemoStore={handleDemo} />;

  // 1. APPROVAL GATE
  if (!profile.admin_approved) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="w-full max-w-sm bg-white p-12 rounded-[4.5rem] shadow-soft-xl border border-slate-100 text-center space-y-8">
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center text-5xl mx-auto border border-emerald-100">⚖️</div>
          <div className="space-y-4">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Audit Pending</h2>
            <p className="text-slate-400 text-sm font-medium leading-relaxed">
              System governance is reviewing your registration. Terminal access will be granted once your credentials (GST, UPI, Address) are verified.
            </p>
          </div>
          <button onClick={() => { supabase.auth.signOut(); setProfile(null); }} className="text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-red-500 transition-all">Sign Out</button>
        </div>
      </div>
    );
  }

  // 2. ACTIVE GATE
  if (!profile.active) {
    return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-8">
          <div className="w-full max-w-sm bg-white p-12 rounded-[4.5rem] shadow-2xl border border-red-100 text-center space-y-8">
            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center text-5xl mx-auto border border-red-100">🚫</div>
            <div className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Account Deactivated</h2>
              <p className="text-slate-400 text-sm font-medium leading-relaxed">Your account has been suspended due to non-payment of service fees or policy violation. Contact support.</p>
            </div>
            <button onClick={() => { supabase.auth.signOut(); setProfile(null); }} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest text-[10px] shadow-xl">Back to Login</button>
          </div>
        </div>
      );
  }

  return <StoreApp user={profile} isDemo={isDemo} onLogout={() => { supabase.auth.signOut(); setProfile(null); setIsDemo(false); }} />;
};

export default App;
