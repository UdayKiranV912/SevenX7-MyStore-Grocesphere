
import React, { useState } from 'react';
import { UserState } from '../types';
import { updateUserProfile } from '../services/userService';
import { reverseGeocode, getBrowserLocation } from '../services/locationService';
import { MapVisualizer } from './MapVisualizer';
import { AddressAutocomplete } from './AddressAutocomplete';
import SevenX7Logo from './SevenX7Logo';

interface UserProfileProps {
  user: UserState;
  onUpdateUser: (updatedData: Partial<UserState>) => void;
  onLogout: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, onUpdateUser, onLogout }) => {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({ 
    name: user.name || '', 
    email: user.email || '', 
    phone: user.phone || '', 
    address: user.address || '',
    gstNumber: user.gstNumber || '',
    licenseNumber: user.licenseNumber || ''
  });
  
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number} | null>(user.location);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Full name is required";
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    if (!formData.gstNumber.trim()) newErrors.gstNumber = "GST Number is mandatory";
    if (!formData.licenseNumber.trim()) newErrors.licenseNumber = "License Number is mandatory";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!user.id) return;
    
    if (!validate()) return;

    try {
      await updateUserProfile(user.id, { 
        full_name: formData.name, 
        email: formData.email, 
        phone_number: formData.phone,
        gst_number: formData.gstNumber,
        license_number: formData.licenseNumber
      });
      onUpdateUser({ 
        name: formData.name, 
        email: formData.email, 
        phone: formData.phone,
        gstNumber: formData.gstNumber,
        licenseNumber: formData.licenseNumber
      });
      setIsEditingProfile(false);
      setErrors({});
    } catch (e) { 
      alert('Failed to update details. Please check your internet connection.'); 
    }
  };

  const handleSaveAddress = async () => {
    if (!user.id) return;
    try {
      await updateUserProfile(user.id, { address: formData.address });
      if (mapCenter) onUpdateUser({ address: formData.address, location: mapCenter });
      else onUpdateUser({ address: formData.address });
      setIsEditingAddress(false);
    } catch (e) { alert('Failed to update address'); }
  };

  const handleMapSelection = async (lat: number, lng: number) => {
      setMapCenter({ lat, lng });
      setIsGeocoding(true);
      try {
          const address = await reverseGeocode(lat, lng);
          if (address) setFormData(prev => ({ ...prev, address }));
      } catch (error) {} finally { setIsGeocoding(false); }
  };

  const isMissingMandatory = !user.gstNumber || !user.licenseNumber;

  return (
    <div className="pb-32 px-5 pt-8 space-y-8 animate-fade-in flex flex-col items-center w-full">
      {isMissingMandatory && !isEditingProfile && (
        <div className="w-full bg-orange-50 border border-orange-200 p-5 rounded-[2rem] text-orange-800 text-xs font-bold animate-pulse flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <p>Verification Required: Update your GST and License details to unlock mart services.</p>
        </div>
      )}

      <div className="flex flex-col items-center gap-4 w-full text-center">
          <SevenX7Logo size="medium" />
          <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center text-3xl font-black text-white border-[6px] border-white shadow-xl relative overflow-hidden mt-2">
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-transparent"></div>
              {user.name?.charAt(0).toUpperCase() || '👤'}
          </div>
      </div>
      
      <div className="w-full bg-slate-50/50 p-8 rounded-[3.5rem] border border-slate-100 shadow-card">
        {isEditingProfile ? (
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Name *</label>
                    <input 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})} 
                      className={`w-full bg-white p-4 rounded-2xl font-bold shadow-inner border-none outline-none focus:ring-1 transition-all ${errors.name ? 'ring-2 ring-red-500 bg-red-50' : 'focus:ring-slate-100'}`} 
                      placeholder="Full Name" 
                    />
                    {errors.name && <p className="text-[8px] text-red-500 font-bold ml-2 uppercase">{errors.name}</p>}
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Phone *</label>
                    <input 
                      value={formData.phone} 
                      onChange={e => setFormData({...formData, phone: e.target.value})} 
                      className={`w-full bg-white p-4 rounded-2xl font-bold shadow-inner border-none outline-none focus:ring-1 transition-all ${errors.phone ? 'ring-2 ring-red-500 bg-red-50' : 'focus:ring-slate-100'}`} 
                      placeholder="Phone" 
                    />
                    {errors.phone && <p className="text-[8px] text-red-500 font-bold ml-2 uppercase">{errors.phone}</p>}
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">GST Number *</label>
                    <input 
                      value={formData.gstNumber} 
                      onChange={e => setFormData({...formData, gstNumber: e.target.value})} 
                      className={`w-full bg-white p-4 rounded-2xl font-bold shadow-inner border-none outline-none focus:ring-1 transition-all ${errors.gstNumber ? 'ring-2 ring-red-500 bg-red-50' : 'focus:ring-slate-100'}`} 
                      placeholder="GST Number" 
                    />
                    {errors.gstNumber && <p className="text-[8px] text-red-500 font-bold ml-2 uppercase">{errors.gstNumber}</p>}
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">License Number *</label>
                    <input 
                      value={formData.licenseNumber} 
                      onChange={e => setFormData({...formData, licenseNumber: e.target.value})} 
                      className={`w-full bg-white p-4 rounded-2xl font-bold shadow-inner border-none outline-none focus:ring-1 transition-all ${errors.licenseNumber ? 'ring-2 ring-red-500 bg-red-50' : 'focus:ring-slate-100'}`} 
                      placeholder="License Number" 
                    />
                    {errors.licenseNumber && <p className="text-[8px] text-red-500 font-bold ml-2 uppercase">{errors.licenseNumber}</p>}
                </div>
                
                <div className="flex gap-2 pt-4">
                    {!isMissingMandatory && (
                      <button onClick={() => { setIsEditingProfile(false); setErrors({}); }} className="flex-1 py-4 bg-white text-slate-400 font-black uppercase text-[10px] rounded-2xl border border-slate-200">Cancel</button>
                    )}
                    <button onClick={handleSaveProfile} className="flex-1 py-4 bg-slate-900 text-white font-black uppercase text-[10px] rounded-2xl shadow-lg active:scale-[0.98] transition-all">Save Profile</button>
                </div>
            </div>
        ) : (
            <div className="text-center">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{user.name || 'Resident'}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{user.phone}</p>
                
                <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-slate-400 font-black uppercase mb-1">GST ID</p>
                        <p className="font-black text-slate-800 truncate">{user.gstNumber || 'Pending'}</p>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-slate-400 font-black uppercase mb-1">License</p>
                        <p className="font-black text-slate-800 truncate">{user.licenseNumber || 'Pending'}</p>
                    </div>
                </div>

                <button onClick={() => setIsEditingProfile(true)} className="text-[10px] font-black uppercase text-slate-900 bg-white border border-slate-200 px-6 py-3 rounded-full mt-6 shadow-sm hover:bg-slate-50 active:scale-95 transition-all">
                    {isMissingMandatory ? 'Complete Setup' : 'Edit Identity'}
                </button>
            </div>
        )}
      </div>

      <div className="w-full bg-white rounded-[3.5rem] p-6 shadow-soft-xl border border-slate-100 overflow-hidden">
          <div className="flex justify-between items-center mb-6 px-3"><h4 className="font-black text-slate-900 text-sm uppercase tracking-widest">Saved Mart Address</h4>{!isEditingAddress && <button onClick={() => setIsEditingAddress(true)} className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full uppercase tracking-wider">Edit</button>}</div>
          {isEditingAddress ? (
              <div className="space-y-4">
                  <div className="h-48 rounded-[2.5rem] overflow-hidden relative shadow-inner border border-slate-100">
                      <MapVisualizer stores={[]} userLat={mapCenter?.lat || 12.9716} userLng={mapCenter?.lng || 77.5946} selectedStore={null} onSelectStore={() => {}} mode="DELIVERY" isSelectionMode={true} onMapClick={handleMapSelection} className="h-full" forcedCenter={mapCenter} />
                      {isGeocoding && <div className="absolute inset-0 bg-white/60 flex items-center justify-center font-black text-[10px] uppercase backdrop-blur-sm">Locating...</div>}
                  </div>
                  <AddressAutocomplete value={formData.address} onChange={v => setFormData({...formData, address: v})} onSelect={(lat, lng, addr) => { setFormData({...formData, address: addr}); setMapCenter({ lat, lng }); }} className="mt-4" />
                  <div className="flex gap-3 pt-2"><button onClick={() => setIsEditingAddress(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black uppercase text-[10px] rounded-[2rem]">Cancel</button><button onClick={handleSaveAddress} className="flex-1 py-4 bg-slate-900 text-white font-black uppercase text-[10px] rounded-[2rem] shadow-xl active:scale-95 transition-all">Lock Location</button></div>
              </div>
          ) : (
              <div className="flex gap-4 items-center p-5 bg-slate-50/80 rounded-[2.5rem] border border-slate-100"><div className="w-12 h-12 bg-white text-emerald-600 rounded-2xl flex items-center justify-center text-2xl shadow-sm flex-shrink-0">📍</div><p className="text-xs font-bold text-slate-600 leading-relaxed truncate">{user.address || 'No location set yet.'}</p></div>
          )}
      </div>

      <div className="w-full pt-6 border-t border-slate-100">
          <button onClick={onLogout} className="w-full py-5 bg-red-50 text-red-500 font-black uppercase tracking-[0.2em] text-[10px] rounded-[2rem] border border-red-100 hover:bg-red-500 hover:text-white transition-all shadow-sm">Sign Out Mart Account</button>
      </div>
      
      <div className="flex justify-center pb-4 grayscale opacity-20 w-full">
          <SevenX7Logo size="xs" />
      </div>
    </div>
  );
};
