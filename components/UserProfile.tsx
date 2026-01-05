
import React, { useState, useEffect } from 'react';
import { UserState, Store, StoreType } from '../types';
import { updateUserProfile } from '../services/userService';
import { updateStoreProfile, getMyStore } from '../services/storeAdminService';
import { AddressAutocomplete } from './AddressAutocomplete';
import SevenX7Logo from './SevenX7Logo';

interface UserProfileProps {
  user: UserState;
  onUpdateUser: (updatedData: Partial<UserState>) => void;
  onLogout: () => void;
}

const STORE_TYPES: StoreType[] = [
    'vegetables',
    'dairy',
    'mini_mart',
    'big_mart'
];

export const UserProfile: React.FC<UserProfileProps> = ({ user, onUpdateUser, onLogout }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [storeData, setStoreData] = useState<Store | null>(null);
  
  const [formData, setFormData] = useState({ 
    ownerName: user.name || '', 
    email: user.email || '', 
    phone: user.phone || '', 
    storeName: '',
    address: user.address || '',
    type: 'big_mart' as StoreType,
    gstNumber: '',
    upiId: user.upiId || '',
    bankName: user.bankDetails?.bankName || '',
    accNo: user.bankDetails?.accountNumber || '',
    ifsc: user.bankDetails?.ifscCode || '',
    lat: 12.9716,
    lng: 77.5946
  });

  useEffect(() => {
      if (user.id) {
          getMyStore(user.id).then(store => {
              if (store) {
                  setStoreData(store);
                  setFormData(prev => ({ 
                      ...prev, 
                      storeName: store.name, 
                      address: store.address,
                      type: store.store_type as StoreType,
                      gstNumber: store.gstNumber || '',
                      upiId: store.upi_id || '',
                      bankName: store.bankDetails?.bankName || '',
                      accNo: store.bankDetails?.accountNumber || '',
                      ifsc: store.bankDetails?.ifscCode || '',
                      lat: store.lat,
                      lng: store.lng
                  }));
              }
          });
      }
  }, [user.id]);

  const handleSave = async () => {
    if (!user.id) return;
    setLoading(true);
    try {
      if (!user.id.includes('demo')) {
          await updateUserProfile(user.id, { 
            name: formData.ownerName, 
            email: formData.email, 
            phone: formData.phone 
          });
      }

      if (storeData) {
          await updateStoreProfile(storeData.id, { 
            name: formData.storeName, 
            address: formData.address,
            store_type: formData.type,
            gstNumber: formData.gstNumber,
            upi_id: formData.upiId,
            bankDetails: {
                bankName: formData.bankName,
                accountNumber: formData.accNo,
                ifscCode: formData.ifsc,
                accountHolder: formData.ownerName
            },
            lat: formData.lat,
            lng: formData.lng
          });
      }

      onUpdateUser({ 
        name: formData.ownerName, 
        email: formData.email, 
        phone: formData.phone,
        address: formData.address,
        upiId: formData.upiId,
        bankDetails: {
            bankName: formData.bankName,
            accountNumber: formData.accNo,
            ifscCode: formData.ifsc,
            accountHolder: formData.ownerName
        }
      });
      
      setIsEditing(false);
    } catch (e) { 
      // Comment: Cast window to any to access alert in environments where it might be missing from Window type
      (window as any).alert('Update failed. Check connection.'); 
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-32 px-5 pt-8 space-y-8 animate-fade-in flex flex-col items-center w-full">
      <div className="flex flex-col items-center gap-4 w-full text-center">
          <SevenX7Logo size="medium" />
          <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center text-2xl font-black text-white border-[4px] border-white shadow-xl relative mt-2 overflow-hidden">
              {formData.ownerName?.charAt(0).toUpperCase() || '👤'}
          </div>
          <div className="space-y-1">
             <h2 className="text-xl font-black text-slate-900 tracking-tight">{formData.storeName || 'My Mart'}</h2>
             {storeData?.verificationStatus === 'verified' ? (
                <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">Verified Account ✓</span>
             ) : (
                <span className="bg-orange-100 text-orange-700 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">Pending Admin Approval</span>
             )}
          </div>
      </div>
      
      <div className="w-full bg-white p-8 rounded-[3rem] border border-slate-100 shadow-soft-xl">
        <div className="flex justify-between items-center mb-10">
            <h4 className="font-black text-slate-900 text-[10px] uppercase tracking-[0.2em]">Business Terminal</h4>
            {!isEditing && (
                <button onClick={() => setIsEditing(true)} className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl uppercase tracking-widest border border-emerald-100 shadow-sm">
                    Edit
                </button>
            )}
        </div>

        {isEditing ? (
            <div className="space-y-6">
                <div className="space-y-4">
                   <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest border-b pb-1">Basic Info</p>
                   {/* Comment: Cast e.target to any to bypass potential environment type mismatch */}
                   <input value={formData.storeName} onChange={e => setFormData({...formData, storeName: (e.target as any).value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold shadow-inner border-none outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Mart Name" />
                   <select value={formData.type} onChange={e => setFormData({...formData, type: (e.target as any).value as StoreType})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold shadow-inner border-none outline-none">
                        {STORE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                <div className="space-y-4">
                   <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest border-b pb-1">Financial Details (KYC)</p>
                   {/* Comment: Cast e.target to any to bypass potential environment type mismatch */}
                   <input value={formData.upiId} onChange={e => setFormData({...formData, upiId: (e.target as any).value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold shadow-inner border-none outline-none focus:ring-1 focus:ring-emerald-500" placeholder="UPI ID (e.g. owner@okaxis)" />
                   <div className="grid grid-cols-2 gap-2">
                       <input value={formData.bankName} onChange={e => setFormData({...formData, bankName: (e.target as any).value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold shadow-inner border-none outline-none" placeholder="Bank Name" />
                       <input value={formData.ifsc} onChange={e => setFormData({...formData, ifsc: (e.target as any).value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold shadow-inner border-none outline-none" placeholder="IFSC Code" />
                   </div>
                   <input value={formData.accNo} onChange={e => setFormData({...formData, accNo: (e.target as any).value})} className="w-full bg-slate-50 p-4 rounded-2xl font-bold shadow-inner border-none outline-none" placeholder="Account Number" />
                </div>
                
                <div className="flex gap-4 pt-6">
                    <button onClick={handleSave} disabled={loading} className="flex-1 py-5 bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] rounded-[2rem] shadow-2xl active:scale-95 transition-all">
                        {loading ? 'Processing...' : 'Save Updates'}
                    </button>
                    <button onClick={() => setIsEditing(false)} className="px-6 py-5 bg-slate-100 text-slate-400 font-black uppercase tracking-widest text-[10px] rounded-[2rem]">Back</button>
                </div>
            </div>
        ) : (
            <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                    <div className="bg-slate-50/50 p-5 rounded-[2rem] border border-slate-50">
                        <p className="text-[8px] font-black text-slate-300 uppercase mb-2 tracking-widest">Active UPI Settlement</p>
                        <p className="font-bold text-slate-800 text-sm tracking-tight">{formData.upiId || 'Not Set'}</p>
                    </div>
                    <div className="bg-slate-50/50 p-5 rounded-[2rem] border border-slate-50">
                        <p className="text-[8px] font-black text-slate-300 uppercase mb-2 tracking-widest">Bank Beneficiary</p>
                        <p className="font-bold text-slate-800 text-[10px] leading-relaxed">
                           {formData.bankName} • {formData.ifsc}<br/>
                           Acc: {formData.accNo}
                        </p>
                    </div>
                    <div className="bg-slate-50/50 p-5 rounded-[2rem] border border-slate-50">
                        <p className="text-[8px] font-black text-slate-300 uppercase mb-2 tracking-widest">Store Address</p>
                        <p className="font-bold text-slate-800 text-[10px] leading-relaxed">{formData.address}</p>
                    </div>
                </div>
            </div>
        )}
      </div>

      <div className="w-full pt-6 border-t border-slate-100">
          <button onClick={onLogout} className="w-full py-6 bg-red-50 text-red-500 font-black uppercase tracking-[0.4em] text-[10px] rounded-[2.5rem] border border-red-100 active:bg-red-500 active:text-white transition-all shadow-sm">Terminate Session</button>
      </div>
    </div>
  );
};
