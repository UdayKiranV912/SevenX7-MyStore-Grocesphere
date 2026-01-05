
import React, { useState, useEffect } from 'react';
import { UserState, Store } from '../../types';
import { supabase } from '../../services/supabaseClient';
import SevenX7Logo from '../SevenX7Logo';

interface SuperAdminAppProps {
  user: UserState;
  onLogout: () => void;
}

const mapStoreTypeToFrontend = (type: string): any => {
    if (type === 'vegetables') return 'Vegetables/Fruits';
    if (type === 'dairy') return 'Daily Needs / Milk Booth';
    if (type === 'mini_mart') return 'General Store';
    if (type === 'big_mart') return 'Local Mart';
    return 'General Store';
};

export const SuperAdminApp: React.FC<SuperAdminAppProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'STORES' | 'ANALYTICS'>('STORES');
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStores();
    const sub = supabase.channel('admin-stores-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => loadStores()).subscribe();
    return () => { sub.unsubscribe(); };
  }, []);

  const loadStores = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('stores').select('*').order('created_at', { ascending: false });
    if (!error && data) {
        setStores(data.map((row: any) => ({
            id: row.id,
            name: row.name,
            address: row.address,
            distance: '0.0 km',
            verificationStatus: row.approved ? 'verified' : 'pending',
            upi_id: row.upi_id,
            store_type: row.store_type,
            lat: row.lat,
            lng: row.lng,
            rating: 4.5,
            isOpen: row.approved,
            status: row.approved ? 'active' : 'inactive',
            owner_id: row.owner_id,
            availableProductIds: []
        } as Store)));
    }
    setLoading(false);
  };

  const handleApprove = async (store: Store) => {
      setLoading(true);
      try {
          await supabase.from('profiles').update({ approval_status: 'approved' }).eq('id', store.owner_id);
          await supabase.from('stores').update({ approved: true }).eq('id', store.id);
          await loadStores();
      } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleReject = async (store: Store) => {
      setLoading(true);
      try {
          await supabase.from('profiles').update({ approval_status: 'rejected' }).eq('id', store.owner_id);
          await supabase.from('stores').update({ approved: false }).eq('id', store.id);
          await loadStores();
      } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col">
      <header className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="flex items-center gap-4">
              <div className="bg-white p-2 rounded-xl"><SevenX7Logo size="xs" hideGrocesphere={true} /></div>
              <div>
                  <h1 className="text-sm font-black uppercase tracking-widest text-white/90">Governance Console</h1>
                  <p className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.3em]">System Level: {user.role}</p>
              </div>
          </div>
          <button onClick={onLogout} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Terminate Session</button>
      </header>

      <div className="flex-1 flex overflow-hidden">
          <nav className="w-64 border-r border-white/5 p-6 space-y-2 hidden md:block shrink-0">
              <button onClick={() => setActiveTab('STORES')} className={`w-full text-left p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'STORES' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-500 hover:text-white'}`}>Merchant Audit</button>
          </nav>

          <main className="flex-1 overflow-y-auto p-8">
              {activeTab === 'STORES' && (
                  <div className="space-y-6 max-w-5xl">
                      <div className="flex justify-between items-end mb-8 border-b border-white/5 pb-6">
                          <div>
                            <h2 className="text-3xl font-black tracking-tight text-white">Merchant Audit</h2>
                            <p className="text-slate-500 text-xs mt-1">Reviewing community nodes for network access.</p>
                          </div>
                      </div>

                      {loading ? (
                          <div className="py-20 text-center animate-pulse text-[10px] font-black uppercase text-slate-500">Querying Network...</div>
                      ) : (
                          <div className="grid grid-cols-1 gap-4">
                              {stores.map(store => (
                                  <div key={store.id} className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex items-center justify-between group hover:bg-white/10 transition-all">
                                      <div className="flex items-center gap-8">
                                          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-3xl shadow-2xl ${store.verificationStatus === 'verified' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-orange-500/20 text-orange-500'}`}>
                                              {store.verificationStatus === 'verified' ? '✓' : '!'}
                                          </div>
                                          <div>
                                              <h3 className="font-black text-xl text-white">{store.name}</h3>
                                              <p className="text-xs text-slate-400 font-bold uppercase">{store.address}</p>
                                          </div>
                                      </div>
                                      <div className="flex gap-3">
                                          {store.verificationStatus !== 'verified' && (
                                              <button onClick={() => handleApprove(store)} className="px-8 py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-400 active:scale-95 transition-all">Approve</button>
                                          )}
                                          <button onClick={() => handleReject(store)} className="px-8 py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white active:scale-95 transition-all">
                                              {store.verificationStatus === 'verified' ? 'Suspend' : 'Reject'}
                                          </button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              )}
          </main>
      </div>
    </div>
  );
};
