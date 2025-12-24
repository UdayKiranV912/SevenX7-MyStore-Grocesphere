
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
          // 1. Update Profile status
          await supabase.from('profiles').update({ verification_status: 'verified' }).eq('id', store.ownerId);
          // 2. Update Store status
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
      <header className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50 backdrop-blur-xl">
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
          {/* Sidebar */}
          <nav className="w-64 border-r border-white/5 p-6 space-y-2 hidden md:block">
              <button onClick={() => setActiveTab('STORES')} className={`w-full text-left p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'STORES' ? 'bg-white text-slate-900' : 'text-slate-500 hover:text-white'}`}>Merchant Audit</button>
              <button onClick={() => setActiveTab('ANALYTICS')} className={`w-full text-left p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ANALYTICS' ? 'bg-white text-slate-900' : 'text-slate-500 hover:text-white'}`}>Global Stats</button>
          </nav>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-8">
              {activeTab === 'STORES' && (
                  <div className="space-y-6 max-w-5xl">
                      <div className="flex justify-between items-end">
                          <h2 className="text-2xl font-black tracking-tight">Pending Approval Queue</h2>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stores.filter(s => s.verificationStatus === 'pending').length} Awaiting Audit</p>
                      </div>

                      {loading ? (
                          <div className="py-20 text-center animate-pulse text-[10px] font-black uppercase tracking-widest text-slate-500">Querying Merchant Layer...</div>
                      ) : (
                          <div className="grid grid-cols-1 gap-4">
                              {stores.map(store => (
                                  <div key={store.id} className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex items-center justify-between group hover:bg-white/10 transition-all animate-slide-up">
                                      <div className="flex items-center gap-6">
                                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${store.verificationStatus === 'verified' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-orange-500/20 text-orange-500'}`}>
                                              {store.verificationStatus === 'verified' ? '✓' : '!'}
                                          </div>
                                          <div>
                                              <h3 className="font-bold text-lg leading-none mb-1">{store.name || 'Unnamed Mart'}</h3>
                                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">{store.address}</p>
                                              <div className="flex gap-4 mt-3">
                                                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">UPI: <span className="text-white">{store.upiId || 'Not Linked'}</span></div>
                                                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status: <span className={store.verificationStatus === 'verified' ? 'text-emerald-400' : 'text-orange-400'}>{store.verificationStatus?.toUpperCase()}</span></div>
                                              </div>
                                          </div>
                                      </div>

                                      <div className="flex gap-3">
                                          {store.verificationStatus !== 'verified' && (
                                              <button 
                                                onClick={() => handleApprove(store)}
                                                className="px-6 py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                                              >
                                                  Approve
                                              </button>
                                          )}
                                          <button 
                                            onClick={() => handleReject(store)}
                                            className="px-6 py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
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
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                      <div className="text-6xl mb-6">📊</div>
                      <p className="text-[10px] font-black uppercase tracking-widest">Analytics Module Loading...</p>
                  </div>
              )}
          </main>
      </div>
    </div>
  );
};
