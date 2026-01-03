
import React, { useEffect, useState } from 'react';
import { supabase } from './services/supabaseClient';
import { Profile } from './types';
import { Auth } from './components/OTPVerification';
import { StoreApp } from './components/store/StoreApp';
import { getStoreProfile } from './services/storeAdminService';

const App: React.FC = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const loadProfile = async (userId: string, demo: boolean) => {
    const data = await getStoreProfile(userId, demo);
    if (data) setProfile(data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadProfile(session.user.id, false);
      setLoading(false);
    });

    const authSub = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) loadProfile(session.user.id, false);
      else if (!isDemo) setProfile(null);
    });

    const profileChannel = supabase.channel('gating')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
        if (profile && payload.new.id === profile.id) {
          setProfile(payload.new as Profile);
        }
      }).subscribe();

    return () => {
      authSub.data.subscription.unsubscribe();
      supabase.removeChannel(profileChannel);
    };
  }, [profile?.id, isDemo]);

  const handleDemo = () => {
    setIsDemo(true);
    loadProfile('demo-id', true);
  };

  const isFeeExpired = () => {
    if (!profile?.fee_paid_until) return false;
    return new Date(profile.fee_paid_until) < new Date();
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="w-12 h-12 border-4 border-slate-800 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] animate-pulse">Syncing Peer Matrix</p>
      </div>
    </div>
  );

  if (!profile) return <Auth onLoginSuccess={() => {}} onDemoStore={handleDemo} />;

  // 1. APPROVAL GATE
  if (profile.status !== 'approved') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="w-full max-w-sm bg-white p-12 rounded-[4.5rem] shadow-soft-xl border border-slate-100 text-center space-y-8">
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center text-5xl mx-auto border border-emerald-100">⚖️</div>
          <div className="space-y-4">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Access Restricted</h2>
            <p className="text-slate-400 text-sm font-medium leading-relaxed">Your merchant profile is currently undergoing a governance audit. Access will unlock automatically upon verification.</p>
          </div>
          <button onClick={() => { supabase.auth.signOut(); setIsDemo(false); setProfile(null); }} className="text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-red-500 transition-all">Sign Out</button>
        </div>
      </div>
    );
  }

  // 2. SUBSCRIPTION GATE
  if (isFeeExpired() || !profile.is_active) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-8">
        <div className="w-full max-w-sm bg-white p-12 rounded-[4.5rem] shadow-2xl border border-red-100 text-center space-y-8">
          <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center text-5xl mx-auto border border-red-100">💳</div>
          <div className="space-y-4">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">License Expired</h2>
            <p className="text-slate-400 text-sm font-medium leading-relaxed">The 15-day operational license has ended. Please settle the ₹250 service fee to reactivate this terminal.</p>
          </div>
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">System UPI</p>
             <p className="font-bold text-slate-900">admin@grocesphere</p>
          </div>
          <button onClick={() => { supabase.auth.signOut(); setIsDemo(false); setProfile(null); }} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all">Relogin After Payment</button>
        </div>
      </div>
    );
  }

  return <StoreApp user={profile} isDemo={isDemo} onLogout={() => { supabase.auth.signOut(); setIsDemo(false); setProfile(null); }} />;
};

export default App;
