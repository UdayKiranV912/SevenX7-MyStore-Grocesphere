
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
    'Vegetables/Fruits',
    'Daily Needs / Milk Booth',
    'General Store',
    'Local Mart'
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
    type: 'Local Mart' as StoreType,
    gstNumber: '',
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
                      type: store.type as StoreType,
                      gstNumber: store.gstNumber || '',
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
            type: formData.type,
            gstNumber: formData.gstNumber,
            lat: formData.lat,
            lng: formData.lng
          });
      }

      onUpdateUser({ 
        name: formData.ownerName, 
        email: formData.email, 
        phone: formData.phone,
        address: formData.address
      });
      
      setIsEditing(false);
    } catch (e) { 
      alert('Update failed. Check connection.'); 
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-32 px-5 pt-8 space-y-8 animate-fade-in flex flex-col items-center w-full">
      <div className="flex flex-col items-center gap-4 w-full text-center">
          <SevenX7Logo size="medium" />
          <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center text-3xl font-black text-white border-[6px] border-white shadow-xl relative mt-2 overflow-hidden">
              {formData.ownerName?.charAt(0).toUpperCase() || '👤'}
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">{formData.storeName || 'My Mart'}</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest -mt-2">Merchant Dashboard Profile</p>
      </div>
      
      <div className="w-full bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-soft-xl">
        <div className="flex justify-between items-center mb-10">
            <h4 className="font-black text-slate-900 text-sm uppercase tracking-widest">Business Identity</h4>
            {!isEditing && (
                <button onClick={() => setIsEditing(true)} className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-5 py-2.5 rounded-full uppercase tracking-widest border border-emerald-100 shadow-sm">
                    Edit Profile
                </button>
            )}
        </div>

        {isEditing ? (
            <div className="space-y-6">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Store / Mart Name</label>
                    <input value={formData.storeName} onChange={e => setFormData({...formData, storeName: e.target.value})} className="w-full bg-slate-50 p-5 rounded-[2rem] font-bold shadow-inner border-none outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Mart Name" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Store Category</label>
                    <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as StoreType})} className="w-full bg-slate-50 p-5 rounded-[2rem] font-bold shadow-inner border-none outline-none focus:ring-1 focus:ring-emerald-500">
                        {STORE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">GST Number</label>
                    <input value={formData.gstNumber} onChange={e => setFormData({...formData, gstNumber: e.target.value})} className="w-full bg-slate-50 p-5 rounded-[2rem] font-bold shadow-inner border-none outline-none focus:ring-1 focus:ring-emerald-500" placeholder="GSTIN" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Owner Full Name</label>
                    <input value={formData.ownerName} onChange={e => setFormData({...formData, ownerName: e.target.value})} className="w-full bg-slate-50 p-5 rounded-[2rem] font-bold shadow-inner border-none outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Owner Name" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Mart Location</label>
                    <AddressAutocomplete 
                        value={formData.address} 
                        onChange={(val) => setFormData({...formData, address: val})}
                        onSelect={(lat, lng, addr) => setFormData({...formData, address: addr, lat, lng})}
                        placeholder="Search for store address..."
                    />
                </div>
                <div className="grid grid-cols-1 gap-5 pt-2">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Contact Phone</label>
                        <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-50 p-5 rounded-[2rem] font-bold shadow-inner border-none outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Phone Number" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Business Email</label>
                        <input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 p-5 rounded-[2rem] font-bold shadow-inner border-none outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Email Address" />
                    </div>
                </div>
                
                <div className="flex gap-4 pt-6">
                    <button onClick={handleSave} disabled={loading} className="flex-1 py-5 bg-slate-900 text-white font-black uppercase tracking-widest text-[11px] rounded-[2rem] shadow-2xl active:scale-95 transition-all">
                        {loading ? 'Saving...' : 'Update Details'}
                    </button>
                    <button onClick={() => setIsEditing(false)} className="px-8 py-5 bg-slate-100 text-slate-400 font-black uppercase tracking-widest text-[11px] rounded-[2rem]">Cancel</button>
                </div>
            </div>
        ) : (
            <div className="space-y-6">
                <div className="grid grid-cols-1 gap-5">
                    <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-50 shadow-inner">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Store Category</p>
                        <p className="font-bold text-slate-800 text-sm leading-relaxed">{formData.type}</p>
                    </div>
                    <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-50 shadow-inner">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">GST Number</p>
                        <p className="font-bold text-slate-800 text-sm leading-relaxed">{formData.gstNumber || 'Not Registered'}</p>
                    </div>
                    <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-50 shadow-inner">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Store Address</p>
                        <p className="font-bold text-slate-800 text-sm leading-relaxed">{formData.address || 'Address not set.'}</p>
                    </div>
                    <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-50 shadow-inner">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Administrator</p>
                        <p className="font-bold text-slate-800 text-sm leading-relaxed">{formData.ownerName}</p>
                    </div>
                    <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-50 shadow-inner">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Contact Phone</p>
                        <p className="font-bold text-slate-800 text-sm leading-relaxed">{formData.phone}</p>
                    </div>
                </div>
            </div>
        )}
      </div>

      <div className="w-full pt-6 border-t border-slate-100">
          <button onClick={onLogout} className="w-full py-6 bg-red-50 text-red-500 font-black uppercase tracking-[0.4em] text-[11px] rounded-[2.5rem] border border-red-100 active:bg-red-500 active:text-white transition-all shadow-sm">Sign Out Mart Session</button>
      </div>
    </div>
  );
};
