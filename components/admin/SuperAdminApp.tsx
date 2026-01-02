
import React, { useState, useEffect } from 'react';
import { UserState, Store } from '../../types';
import { supabase } from '../../services/supabaseClient';
import SevenX7Logo from '../SevenX7Logo';

interface SuperAdminAppProps {
  user: UserState;
  onLogout: () => void;
}

export const SuperAdminApp: React.FC<SuperAdminAppProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'STORES' | 'ANALYTICS' | 'SETTINGS'>('STORES');
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStores();
    
    const sub = supabase
        .channel('admin-stores-sync')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'stores' 
        }, () => loadStores())
        .subscribe();

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
            verificationStatus: row.verification_status,
            upiId: row.upi_id,
            type: row.type,
            lat: row.lat,
            lng: row.lng,
            rating: row.rating,
            isOpen: row.is_open,
            ownerId: row.owner_id,
            availableProductIds: []
        } as Store)));
    }
    setLoading(false);
  };

  const handleApprove = async (store: Store) => {
      setLoading(true);
      try {
          await supabase.from('profiles').update({ verification_status: 'verified' }).eq('id', store.ownerId);
          await supabase.from('stores').update({ verification_status: 'verified', is_open: true }).eq('id', store.id);
          await loadStores();
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleReject = async (store: Store) => {
      setLoading(true);
      try {
          await supabase.from('profiles').update({ verification_status: 'rejected' }).eq('id', store.ownerId);
          await supabase.from('stores').update({ verification_status: 'rejected', is_open: false }).eq('id', store.id);
          await loadStores();
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col">
      <header className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="flex items-center gap-4">
              <div className="bg-white p-2 rounded-xl">
                  <SevenX7Logo size="xs" hideGrocesphere={true} />
              </div>
              <div>
                  <h1 className="text-sm font-black uppercase tracking-widest text-white/90">Platform Governance</h1>
                  <p className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.3em]">Super Admin Active</p>
              </div>
          </div>
          <button onClick={onLogout} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Terminate Admin</button>
      </header>

      <div className="flex-1 flex overflow-hidden">
          <nav className="w-64 border-r border-white/5 p-6 space-y-2 hidden md:block shrink-0">
              <button onClick={() => setActiveTab('STORES')} className={`w-full text-left p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'STORES' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-500 hover:text-white'}`}>Merchant Audit</button>
              <button onClick={() => setActiveTab('ANALYTICS')} className={`w-full text-left p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ANALYTICS' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-500 hover:text-white'}`}>Global Stats</button>
          </nav>

          <main className="flex-1 overflow-y-auto p-8">
              {activeTab === 'STORES' && (
                  <div className="space-y-6 max-w-5xl">
                      <div className="flex justify-between items-end mb-8 border-b border-white/5 pb-6">
                          <div>
                            <h2 className="text-3xl font-black tracking-tight">Merchant Audit Queue</h2>
                            <p className="text-slate-500 text-xs mt-1">Review and verify community hub nodes for network access.</p>
                          </div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/10">{stores.filter(s => s.verificationStatus === 'pending').length} Awaiting Audit</p>
                      </div>

                      {loading ? (
                          <div className="py-20 text-center animate-pulse text-[10px] font-black uppercase tracking-widest text-slate-500">Querying Merchant Layer...</div>
                      ) : stores.length === 0 ? (
                          <div className="py-40 text-center opacity-30 font-black uppercase tracking-[0.3em] text-xs">Zero Pending Records</div>
                      ) : (
                          <div className="grid grid-cols-1 gap-4">
                              {stores.map(store => (
                                  <div key={store.id} className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex items-center justify-between group hover:bg-white/10 transition-all animate-slide-up hover:border-white/20 shadow-inner">
                                      <div className="flex items-center gap-8">
                                          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-3xl shadow-2xl ${store.verificationStatus === 'verified' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-orange-500/20 text-orange-500'}`}>
                                              {store.verificationStatus === 'verified' ? '✓' : '!'}
                                          </div>
                                          <div>
                                              <h3 className="font-black text-xl leading-none mb-2 text-white">{store.name || 'Unnamed Mart'}</h3>
                                              <p className="text-xs text-slate-400 font-bold uppercase tracking-wide max-w-md">{store.address}</p>
                                              <div className="flex flex-wrap gap-4 mt-5">
                                                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-black/40 px-3 py-1.5 rounded-lg">UPI: <span className="text-emerald-400 font-mono ml-1">{store.upiId || 'Not Linked'}</span></div>
                                                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-black/40 px-3 py-1.5 rounded-lg">Status: <span className={store.verificationStatus === 'verified' ? 'text-emerald-400' : 'text-orange-400'}>{store.verificationStatus?.toUpperCase()}</span></div>
                                                  {store.verificationStatus === 'pending' && (
                                                      <div className="text-[9px] font-black text-slate-100 uppercase tracking-[0.2em] bg-blue-600 px-3 py-1.5 rounded-lg animate-pulse shadow-lg shadow-blue-600/20">Handshake: 7777</div>
                                                  )}
                                              </div>
                                          </div>
                                      </div>

                                      <div className="flex gap-3">
                                          {store.verificationStatus !== 'verified' && (
                                              <button 
                                                onClick={() => handleApprove(store)}
                                                className="px-8 py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all hover:bg-emerald-400"
                                              >
                                                  Approve
                                              </button>
                                          )}
                                          <button 
                                            onClick={() => handleReject(store)}
                                            className="px-8 py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all active:scale-95"
                                          >
                                              {store.verificationStatus === 'verified' ? 'Suspend' : 'Reject'}
                                          </button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              )}

              {activeTab === 'ANALYTICS' && (
                  <div className="flex flex-col items-center justify-center h-[70vh] text-slate-500 animate-fade-in">
                      <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center text-6xl mb-8 border border-white/5 shadow-inner">📊</div>
                      <h3 className="text-xl font-black text-white mb-2">Network Insights</h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Module deploying in next epoch...</p>
                  </div>
              )}
          </main>
      </div>
    </div>
  );
};
