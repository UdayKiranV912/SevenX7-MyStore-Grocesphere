
import React, { useState } from 'react';
import { registerUser, loginUser } from '../services/userService';
import { UserState } from '../types';
import SevenX7Logo from './SevenX7Logo';

interface AuthProps {
  onLoginSuccess: (user: UserState) => void;
  onDemoLogin: () => void;
  onCustomerDemoLogin: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLoginSuccess, onDemoLogin, onCustomerDemoLogin }) => {
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'VERIFY'>('LOGIN');
  const [formData, setFormData] = useState({ 
    fullName: '', 
    email: '', 
    phone: '', 
    password: '', 
    adminCode: '',
    upiId: '',
    storeName: '',
    storeAddress: '',
    role: 'customer' as UserState['role']
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg('');
      setLoading(true);
      try {
          await registerUser(
              formData.email, 
              formData.password, 
              formData.fullName, 
              formData.phone, 
              formData.upiId, 
              formData.role,
              formData.role === 'store_owner' ? formData.storeName : undefined,
              formData.role === 'store_owner' ? formData.storeAddress : undefined
          );
          setLoading(false);
          setAuthMode('VERIFY'); 
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

  const isPartner = formData.role === 'store_owner';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="mb-10 animate-fade-in flex flex-col items-center text-center">
            <SevenX7Logo size="medium" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-3">The Hyperlocal Terminal</p>
        </div>

        <div className="w-full bg-white border border-slate-100 p-8 rounded-[3.5rem] shadow-soft-xl animate-slide-up relative">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8 relative z-10">
                <button onClick={() => setAuthMode('LOGIN')} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${authMode === 'LOGIN' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Sign In</button>
                <button onClick={() => setAuthMode('REGISTER')} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${authMode === 'REGISTER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Join Us</button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center py-10 relative z-10">
                    <div className="w-10 h-10 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                    <p className="font-bold text-slate-400 text-[10px] uppercase tracking-widest animate-pulse">Establishing Node...</p>
                </div>
            ) : (
                <div className="space-y-6 relative z-10">
                    {authMode === 'LOGIN' && (
                        <form onSubmit={handleStandardLogin} className="space-y-4">
                            <input type="email" placeholder="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" required />
                            <input type="password" placeholder="Password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" required />
                            {errorMsg && <p className="text-[10px] text-red-500 font-black text-center">{errorMsg}</p>}
                            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-xl">Enter Terminal</button>
                        </form>
                    )}

                    {authMode === 'REGISTER' && (
                        <form onSubmit={handleRegister} className="space-y-4 max-h-[55vh] overflow-y-auto pr-2 hide-scrollbar">
                            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-6">
                                <button type="button" onClick={() => setFormData({...formData, role: 'customer'})} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${formData.role === 'customer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Customer</button>
                                <button type="button" onClick={() => setFormData({...formData, role: 'store_owner'})} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${formData.role === 'store_owner' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400'}`}>Partner / Mart</button>
                            </div>

                            <div className="space-y-3">
                                <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] pl-2">Personal Credentials</p>
                                <input placeholder="Full Name" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" required />
                                <input placeholder="Phone Number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" required />
                                <input placeholder="Email Address" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" required />
                                <input placeholder="Create Password" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" required />
                            </div>

                            {isPartner && (
                                <div className="space-y-3 pt-4 border-t border-slate-100 animate-slide-up">
                                    <div className="flex justify-between items-center pl-2">
                                        <p className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.2em]">Settlement Details</p>
                                        <span className="text-[7px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-black">ENFORCED</span>
                                    </div>
                                    <input placeholder="Store / Mart Name" value={formData.storeName} onChange={e => setFormData({...formData, storeName: e.target.value})} className="w-full bg-emerald-50/30 border border-emerald-100 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none" required={isPartner} />
                                    
                                    <div className="space-y-1">
                                        <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest pl-2">Payment Receiving UPI ID</label>
                                        <div className="relative">
                                            <input placeholder="e.g. store@okaxis" value={formData.upiId} onChange={e => setFormData({...formData, upiId: e.target.value})} className="w-full bg-emerald-500 text-white placeholder-emerald-200 border-none rounded-2xl p-4 text-sm font-black shadow-xl outline-none" required={isPartner} />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-black bg-white/20 px-2 py-1 rounded text-white tracking-widest uppercase">Verified</div>
                                        </div>
                                    </div>

                                    <textarea placeholder="Hub Physical Address" value={formData.storeAddress} onChange={e => setFormData({...formData, storeAddress: e.target.value})} className="w-full bg-emerald-50/30 border border-emerald-100 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none resize-none" rows={2} required={isPartner} />
                                </div>
                            )}

                            {errorMsg && <p className="text-[10px] text-red-500 font-black text-center animate-pulse">{errorMsg}</p>}
                            
                            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-xl mt-4 active:scale-95 transition-all">
                                {isPartner ? 'Establish Business Hub' : 'Create Account'}
                            </button>
                        </form>
                    )}

                    {authMode === 'VERIFY' && (
                        <div className="text-center space-y-6">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Verification Node Active.<br/>Setup pending final cluster sync.</p>
                            <input placeholder="0000" maxLength={4} className="w-full text-center text-4xl font-black bg-slate-50 rounded-3xl p-6 shadow-inner outline-none" />
                            <button onClick={() => onLoginSuccess({ isAuthenticated: true, phone: formData.phone, role: formData.role, upiId: formData.upiId, name: formData.fullName })} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest">Activate Terminal</button>
                        </div>
                    )}
                </div>
            )}
        </div>

        <div className="mt-12 flex flex-col gap-4 w-full">
            <button onClick={onDemoLogin} className="w-full py-5 bg-white border-2 border-slate-100 rounded-[2rem] text-[9px] font-black text-slate-400 uppercase tracking-widest hover:border-emerald-500 hover:text-emerald-500 transition-all">Launch Partner Demo</button>
            <button onClick={onCustomerDemoLogin} className="w-full py-4 bg-transparent text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">Explore as Customer</button>
        </div>
      </div>
    </div>
  );
};
