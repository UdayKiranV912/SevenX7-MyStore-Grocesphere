
import React, { useEffect, useState } from 'react';

interface PaymentGatewayProps {
  amount: number;
  onSuccess: (txnId: string) => void;
  onCancel: () => void;
  isDemo: boolean;
  splits?: {
      storeAmount: number;
      storeUpi: string;
      handlingFee: number;
      adminUpi: string;
      deliveryFee: number;
      driverUpi: string;
  };
}

export const PaymentGateway: React.FC<PaymentGatewayProps> = ({ amount, onSuccess, onCancel, isDemo, splits }) => {
  const [step, setStep] = useState<'CONNECTING' | 'CONFIRM' | 'PROCESSING' | 'SUCCESS' | 'FAILURE'>('CONNECTING');
  const [txnId, setTxnId] = useState('');

  useEffect(() => {
    setTxnId('TXN' + Math.random().toString(36).substr(2, 9).toUpperCase());
    const timer = setTimeout(() => setStep('CONFIRM'), 1200);
    return () => clearTimeout(timer);
  }, []);

  const handlePay = () => {
    setStep('PROCESSING');
    setTimeout(() => {
        setStep('SUCCESS');
        setTimeout(() => onSuccess(txnId), 2000);
    }, isDemo ? 1500 : 3000);
  };

  const targetUpi = splits?.storeUpi || 'grocesphere.admin@upi';

  if (step === 'SUCCESS') {
    return (
      <div className="fixed inset-0 z-[2000] bg-emerald-500 flex flex-col items-center justify-center text-white animate-fade-in p-8">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-8 animate-bounce shadow-2xl">
          <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-black mb-2 tracking-tight">Payment Completed</h2>
        <p className="text-white/80 font-bold text-center mb-8 uppercase tracking-widest text-[9px]">Verified by Merchant Terminal</p>
        <div className="bg-white/10 backdrop-blur-md p-5 rounded-3xl border border-white/20 w-full max-w-xs text-center">
            <p className="text-white/60 text-[8px] font-black uppercase tracking-widest mb-1">Transaction Reference</p>
            <p className="font-mono font-bold text-xs tracking-wider">{txnId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-50 flex flex-col animate-fade-in">
      <div className="bg-white px-6 py-10 flex flex-col gap-1 border-b border-slate-100 shadow-sm shrink-0">
          <div className="flex justify-between items-center mb-4">
              <button onClick={onCancel} className="text-slate-300 font-black uppercase text-[10px] tracking-widest">← Back</button>
              <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Secure UPI Handshake</span>
              </div>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Settlement Amount</p>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter">₹{amount.toFixed(2)}</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start p-6 space-y-6 overflow-y-auto">
        {step === 'CONNECTING' && (
           <div className="text-center py-20 animate-pulse">
             <div className="w-10 h-10 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6"></div>
             <p className="text-slate-300 font-black uppercase tracking-widest text-[9px]">Syncing with Peer Node...</p>
           </div>
        )}

        {step === 'CONFIRM' && (
             <div className="w-full max-w-sm space-y-6 animate-slide-up">
                <div className="bg-white p-8 rounded-[3.5rem] shadow-soft-xl border border-slate-100 relative overflow-hidden">
                    <div className="space-y-8 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-emerald-500 rounded-3xl flex items-center justify-center text-xl shadow-xl shadow-emerald-500/10 text-white font-black">₹</div>
                            <div className="flex-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Direct To Merchant</p>
                                <p className="font-black text-slate-900 text-base leading-none">Mart Direct Settlement</p>
                                <p className="text-[10px] text-slate-300 font-mono mt-1 truncate max-w-[150px]">{targetUpi}</p>
                            </div>
                        </div>

                        <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/50 space-y-3">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                                <span>Cart Value</span>
                                <span className="text-slate-900 font-black">₹{splits?.storeAmount}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                                <span>Handling & Delivery</span>
                                <span className="text-slate-900 font-black">₹{splits?.deliveryFee}</span>
                            </div>
                            <div className="pt-4 border-t border-slate-100 flex justify-between items-end">
                                <span className="font-black text-slate-900 text-[10px] uppercase tracking-widest">Total Pay</span>
                                <span className="font-black text-slate-900 text-2xl tracking-tighter">₹{amount}</span>
                            </div>
                        </div>

                        <button 
                            onClick={handlePay}
                            className="w-full bg-slate-900 text-white font-black py-6 rounded-[2rem] shadow-2xl active:scale-[0.97] transition-all flex items-center justify-center gap-3 uppercase text-[10px] tracking-[0.3em]"
                        >
                            Authorize UPI
                        </button>
                    </div>
                </div>
             </div>
        )}

        {step === 'PROCESSING' && (
             <div className="text-center py-20 w-full max-w-xs animate-fade-in mx-auto">
                <div className="relative w-20 h-20 mx-auto mb-10">
                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
                    <div className="relative w-full h-full bg-white rounded-full flex items-center justify-center text-3xl shadow-xl border-2 border-emerald-50">🔒</div>
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">Awaiting PIN...</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Opening your secure banking application for PIN entry.</p>
             </div>
        )}
      </div>
    </div>
  );
};
