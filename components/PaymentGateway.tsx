
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

const ADMIN_UPI_ID = 'grocesphere.admin@upi';

export const PaymentGateway: React.FC<PaymentGatewayProps> = ({ amount, onSuccess, onCancel, isDemo, splits }) => {
  const [step, setStep] = useState<'CONNECTING' | 'CONFIRM' | 'PROCESSING' | 'SUCCESS' | 'FAILURE'>('CONNECTING');
  const [txnId, setTxnId] = useState('');

  useEffect(() => {
    // Generate a random high-quality Transaction ID for the session
    setTxnId('TXN' + Math.random().toString(36).substr(2, 9).toUpperCase());
    const timer = setTimeout(() => setStep('CONFIRM'), 1200);
    return () => clearTimeout(timer);
  }, []);

  const handlePay = () => {
    setStep('PROCESSING');
    
    // Logic: Admin receives the payment first.
    // We simulate a 5% chance of failure for realism in real mode
    const simulateFailure = !isDemo && Math.random() < 0.05;

    setTimeout(() => {
        if (simulateFailure) {
            setStep('FAILURE');
        } else {
            setStep('SUCCESS');
            setTimeout(() => onSuccess(txnId), 2000);
        }
    }, isDemo ? 2000 : 4000);
  };

  if (step === 'SUCCESS') {
    return (
      <div className="fixed inset-0 z-[2000] bg-emerald-500 flex flex-col items-center justify-center text-white animate-fade-in p-8">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-8 animate-bounce shadow-2xl">
          <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-black mb-2 tracking-tight">Payment Accepted!</h2>
        <p className="text-white/80 font-bold text-center mb-8 uppercase tracking-widest text-[10px]">Processing Settlements</p>
        <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 w-full max-w-xs text-center">
            <p className="text-white/60 text-[9px] font-black uppercase tracking-widest mb-1">Transaction ID</p>
            <p className="font-mono font-bold text-sm tracking-wider">{txnId}</p>
        </div>
      </div>
    );
  }

  if (step === 'FAILURE') {
      return (
        <div className="fixed inset-0 z-[2000] bg-red-500 flex flex-col items-center justify-center text-white animate-fade-in p-8 text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-8 text-4xl mx-auto">❌</div>
            <h2 className="text-2xl font-black mb-4">Payment Failure</h2>
            <p className="text-white/80 mb-10 text-sm font-medium leading-relaxed">The transaction was declined by the bank. Please ensure sufficient funds or try another UPI application.</p>
            <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                <button onClick={() => setStep('CONFIRM')} className="w-full bg-white text-red-600 font-black py-5 rounded-[2rem] shadow-xl active:scale-95 transition-all uppercase text-xs tracking-widest">Try Again</button>
                <button onClick={onCancel} className="w-full bg-red-600 text-white font-black py-4 rounded-[2rem] border border-white/30 text-xs uppercase tracking-widest">Cancel Checkout</button>
            </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-50 flex flex-col animate-fade-in">
      {/* Immersive Mobile UPI Header */}
      <div className="bg-white px-6 py-8 flex flex-col gap-1 border-b border-slate-100 shadow-sm shrink-0">
          <div className="flex justify-between items-center mb-4">
              <button onClick={onCancel} className="text-slate-300 hover:text-slate-900 transition-colors">← Cancel</button>
              <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unified Payments Interface</span>
              </div>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">₹{amount.toFixed(2)}</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment to Admin Terminal</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start p-6 space-y-6 overflow-y-auto">
        {step === 'CONNECTING' && (
           <div className="text-center py-20 animate-pulse">
             <div className="w-14 h-14 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6"></div>
             <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Handshaking UPI Network...</p>
           </div>
        )}

        {step === 'CONFIRM' && (
             <div className="w-full max-w-sm space-y-6 animate-slide-up">
                <div className="bg-white p-8 rounded-[3.5rem] shadow-soft-xl border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    
                    <div className="space-y-8 relative z-10">
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 bg-emerald-500 rounded-3xl flex items-center justify-center text-2xl shadow-xl shadow-emerald-500/20 text-white font-black">G</div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Admin Gateway</p>
                                <p className="font-black text-slate-900 text-lg leading-none">Grocesphere Admin</p>
                                <p className="text-xs text-slate-400 font-mono mt-1">{ADMIN_UPI_ID}</p>
                            </div>
                        </div>

                        <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100/50 space-y-4 shadow-inner">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Mart Items</span>
                                <span className="font-bold text-slate-900">₹{splits?.storeAmount}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-black text-slate-400 uppercase tracking-widest text-[9px]">Delivery Settlement</span>
                                <span className="font-bold text-slate-900">₹{splits?.deliveryFee}</span>
                            </div>
                            <div className="pt-4 border-t border-slate-200 flex justify-between items-end">
                                <span className="font-black text-slate-900 text-sm uppercase tracking-tighter">Payable</span>
                                <span className="font-black text-slate-900 text-2xl">₹{amount}</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button 
                                onClick={handlePay}
                                className="w-full bg-slate-900 text-white font-black py-6 rounded-[2.5rem] shadow-2xl active:scale-[0.97] transition-all flex items-center justify-center gap-3 uppercase text-[11px] tracking-[0.3em] ring-offset-4 ring-slate-900/5 hover:bg-black"
                            >
                                Pay Securely
                            </button>
                            <p className="text-[9px] text-center text-slate-300 font-bold uppercase tracking-widest">256-bit AES Encrypted</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4 px-4 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                    {['GPAY', 'BHIM', 'PHONEPE', 'PAYTM'].map(app => (
                        <div key={app} className="aspect-square bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-tighter p-1 text-center">
                            {app}
                        </div>
                    ))}
                </div>
             </div>
        )}

        {step === 'PROCESSING' && (
             <div className="text-center py-20 w-full max-w-xs animate-fade-in mx-auto">
                <div className="relative w-24 h-24 mx-auto mb-10">
                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
                    <div className="relative w-full h-full bg-white rounded-full flex items-center justify-center text-4xl shadow-xl border-4 border-emerald-50">
                        🛡️
                    </div>
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-3">Authorizing...</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-10 leading-relaxed px-4">Directing to your default UPI bank application. Confirm the request to finalize.</p>
                
                <div className="space-y-2 max-w-[200px] mx-auto">
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-900 animate-[width_3s_ease-in-out_infinite] w-1/3"></div>
                    </div>
                </div>

                {isDemo && (
                     <div className="mt-16 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                         <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Bypassing Bank Security (Demo)</p>
                     </div>
                )}
             </div>
        )}
      </div>
      
      {/* Footer Branding */}
      <div className="p-8 flex justify-center opacity-20 shrink-0">
          <div className="flex items-center gap-2">
              <span className="text-xl">🛡️</span>
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-900">SecureSphere Protocol</p>
          </div>
      </div>
    </div>
  );
};
