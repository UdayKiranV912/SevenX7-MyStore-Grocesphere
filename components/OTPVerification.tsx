
import React, { useState } from 'react';
import { registerUser, loginUser } from '../services/userService';
import { UserState } from '../types';
import SevenX7Logo from './SevenX7Logo';

interface AuthProps {
  onLoginSuccess: (user: UserState) => void;
  onDemoLogin: () => void;
  onCustomerDemoLogin: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLoginSuccess, onDemoLogin }) => {
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'VERIFY'>('LOGIN');
  const [formData, setFormData] = useState({ 
    fullName: '', 
    email: '', 
    phone: '', 
    password: '', 
    otp: '',
    role: 'store_owner' as UserState['role']
  });
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg('');
      setLoading(true);
      setStatusMsg('Initializing Merchant Account...');
      try {
          await registerUser(formData.email, formData.password, formData.fullName, formData.phone, 'store_owner');
          setLoading(false);
          setAuthMode('VERIFY'); 
      } catch (err: any) {
          setErrorMsg(err.message || 'Registration failed');
          setLoading(false);
      }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setErrorMsg('');
      setTimeout(() => {
          if (['1234', '0000'].includes(formData.otp)) {
             loginUser(formData.email, formData.password)
                .then(user => onLoginSuccess(user))
                .catch(err => setErrorMsg(err.message));
          } else {
             setLoading(false);
             setErrorMsg("Invalid OTP Code.");
          }
      }, 1500);
  };

  const handleStandardLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg('');
      setLoading(true);
      setStatusMsg('Verifying Merchant Identity...');
      try {
          const user = await loginUser(formData.email, formData.password);
          onLoginSuccess(user);
      } catch (err: any) {
          setErrorMsg(err.message || 'Invalid Merchant Credentials');
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="mb-12 animate-fade-in flex flex-col items-center gap-4">
            <SevenX7Logo size="large" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] ml-1">Store Admin Console</p>
        </div>

        <div className="w-full bg-white border border-slate-100 p-8 rounded-[3.5rem] shadow-soft-xl animate-slide-up">
            <div className="flex bg-slate-50 p-1 rounded-2xl mb-8 border border-slate-100 shadow-sm">
                <button onClick={() => setAuthMode('LOGIN')} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${authMode === 'LOGIN' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Login</button>
                <button onClick={() => setAuthMode('REGISTER')} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${authMode === 'REGISTER' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Signup</button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center py-10">
                    <div className="w-10 h-10 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                    <p className="font-bold text-slate-400 text-[10px] uppercase tracking-widest animate-pulse">{statusMsg}</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {authMode === 'LOGIN' && (
                        <form onSubmit={handleStandardLogin} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-3">Merchant Email</label>
                                <input type="email" placeholder="admin@mart.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner focus:ring-1 focus:ring-slate-200 outline-none" required />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-3">Secret Password</label>
                                <input type="password" placeholder="••••••••" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner focus:ring-1 focus:ring-slate-200 outline-none" required />
                            </div>
                            {errorMsg && <p className="text-[10px] text-red-500 font-black text-center uppercase tracking-widest bg-red-50 py-2 rounded-xl border border-red-100">{errorMsg}</p>}
                            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-[0.98]">Access Console</button>
                        </form>
                    )}

                    {authMode === 'REGISTER' && (
                        <form onSubmit={handleRegister} className="space-y-4">
                            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-2">
                                <p className="text-[10px] font-black text-emerald-700 uppercase text-center tracking-widest">New Mart Registration</p>
                            </div>
                            <input placeholder="Owner Full Name" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none border-none" required />
                            <input placeholder="Business Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none border-none" required />
                            <input placeholder="Secure Password" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none border-none" required />
                            <input placeholder="Merchant Contact" type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold shadow-inner outline-none border-none" required />
                            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-xl active:scale-[0.98]">Initialize Store</button>
                        </form>
                    )}

                    {authMode === 'VERIFY' && (
                        <div className="text-center space-y-6">
                            <h3 className="text-lg font-black uppercase tracking-widest text-slate-800">Verification PIN</h3>
                            <form onSubmit={handleVerifyOTP} className="space-y-6">
                                <input placeholder="0000" maxLength={4} value={formData.otp} onChange={e => setFormData({...formData, otp: e.target.value})} className="w-full text-center text-4xl font-black bg-slate-50 rounded-3xl p-6 shadow-inner border-none outline-none tracking-[0.4em] text-slate-900" required />
                                <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-xl">Complete Setup</button>
                            </form>
                        </div>
                    )}
                </div>
            )}
        </div>
        
        <div className="mt-12 flex justify-center grayscale opacity-30 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
            <button onClick={onDemoLogin} className="text-[9px] font-black uppercase tracking-[0.2em] flex flex-col items-center gap-3">
                <span className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-slate-100">🏪</span> 
                Launch Demo Mart
            </button>
        </div>
      </div>
    </div>
  );
};
