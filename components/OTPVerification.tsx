import React, { useState, useEffect } from 'react';
import { registerUser, loginUser } from '../services/userService';
import { UserState } from '../types';
import SevenX7Logo from './SevenX7Logo';
import { supabase } from '../services/supabaseClient';

interface AuthProps {
  onLoginSuccess: (user: UserState) => void;
  onDemoStore: () => void;
}

export const Auth: React.FC<AuthProps> = ({ 
  onLoginSuccess, 
  onDemoStore
}) => {
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'VERIFY' | 'PENDING' | 'UNLOCKED'>('LOGIN');
  const [verificationCode, setVerificationCode] = useState('');
  const [formData, setFormData] = useState({ 
    fullName: '', 
    email: '', 
    phone: '', 
    password: '', 
    upiId: '',
    storeName: '',
    storeAddress: '',
    role: 'store_owner' as UserState['role']
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [tempUserId, setTempUserId] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg('');
      setLoading(true);
      try {
          const user = await registerUser(
              formData.email, 
              formData.password, 
              formData.fullName, 
              formData.phone, 
              formData.upiId, 
              'store_owner',
              formData.storeName,
              formData.storeAddress
          );
          setTempUserId(user.id || null);
          setLoading(false);
          // Directly trigger login success to enter the "Audit In Progress" state (App.tsx handles this)
          onLoginSuccess(user);
      } catch (err: any) {
          setErrorMsg(err.message || 'Registration failed');
          setLoading(false);
      }
  };

  const handleStandardLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg('');
      setLoading(true);
      try {
          const user = await loginUser(formData.email, formData.password);
          onLoginSuccess(user);
      } catch (err: any) {
          setErrorMsg(err.message || 'Invalid Credentials');
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="mb-10 animate-fade-in flex flex-col items-center text-center">
            <SevenX7Logo size="medium" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-3">Partner Terminal Portal</p>
        </div>

        <div className="w-full bg-white border border-slate-100 p-8 rounded-[3.5rem] shadow-soft-xl animate-slide-up relative overflow-hidden">
            {(authMode === 'LOGIN' || authMode === 'REGISTER') && (
                <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8 relative z-10">
                    <button onClick={() => setAuthMode('LOGIN')} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${authMode === 'LOGIN' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Sign In</button>
                    <button onClick={() => setAuthMode('REGISTER')} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${authMode === 'REGISTER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Partner Signup</button>
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center py-10 relative z-10">
                    <div className="w-10 h-10 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                    <p className="font-bold text-slate-400 text-[10px] uppercase tracking-widest animate-pulse">Establishing Peer Link...</p>
                </div>
            ) : (
                <div className="space-y-6 relative z-10">
                    {authMode === 'LOGIN' && (
                        <form onSubmit={handleStandardLogin} className="space-y-4">
                            {/* Comment: Cast e.target to access value */}
                            <input type="email" placeholder="Business Email" value={formData.email} onChange={e => setFormData({...formData, email: (e.target as HTMLInputElement).value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" required />
                            <input type="password" placeholder="Terminal Password" value={formData.password} onChange={e => setFormData({...formData, password: (e.target as HTMLInputElement).value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" required />
                            {errorMsg && <p className="text-[10px] text-red-500 font-black text-center">{errorMsg}</p>}
                            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-transform">Enter Terminal</button>
                        </form>
                    )}

                    {authMode === 'REGISTER' && (
                        <form onSubmit={handleRegister} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 hide-scrollbar">
                            <div className="space-y-3">
                                <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] pl-2">Merchant Identity</p>
                                {/* Comment: Cast e.target to access value */}
                                <input placeholder="Owner Full Name" value={formData.fullName} onChange={e => setFormData({...formData, fullName: (e.target as HTMLInputElement).value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" required />
                                <input placeholder="Business Contact No" value={formData.phone} onChange={e => setFormData({...formData, phone: (e.target as HTMLInputElement).value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" required />
                                <input placeholder="Merchant Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: (e.target as HTMLInputElement).value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" required />
                                <input placeholder="Set Terminal Password" type="password" value={formData.password} onChange={e => setFormData({...formData, password: (e.target as HTMLInputElement).value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" required />
                            </div>

                            <div className="space-y-3 pt-4 border-t border-slate-100">
                                <p className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.2em] pl-2">Mart Configuration</p>
                                {/* Comment: Cast e.target to access value */}
                                <input placeholder="Mart / Store Name" value={formData.storeName} onChange={e => setFormData({...formData, storeName: (e.target as HTMLInputElement).value})} className="w-full bg-emerald-50/30 border border-emerald-100 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" required />
                                <input placeholder="Settlement UPI ID" value={formData.upiId} onChange={e => setFormData({...formData, upiId: (e.target as HTMLInputElement).value})} className="w-full bg-emerald-50/30 border border-emerald-100 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" required />
                                <textarea placeholder="Full Physical Address" value={formData.storeAddress} onChange={e => setFormData({...formData, storeAddress: (e.target as HTMLTextAreaElement).value})} className="w-full bg-emerald-50/30 border border-emerald-100 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none resize-none" rows={2} required />
                            </div>

                            {errorMsg && <p className="text-[10px] text-red-500 font-black text-center">{errorMsg}</p>}
                            
                            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Submit for Onboarding</button>
                        </form>
                    )}
                </div>
            )}
        </div>

        {(authMode === 'LOGIN' || authMode === 'REGISTER') && (
            <div className="mt-8 flex flex-col gap-4 w-full animate-fade-in">
                <button onClick={onDemoStore} className="w-full py-5 bg-white border-2 border-slate-100 rounded-[2rem] text-[9px] font-black text-slate-400 uppercase tracking-widest hover:border-emerald-500 hover:text-emerald-500 transition-all shadow-sm">Explore Demo Terminal</button>
                <div className="pt-4 text-center">
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em]">© SevenX7 Innovations</p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};