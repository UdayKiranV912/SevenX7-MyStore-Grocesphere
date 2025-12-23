
import { supabase } from './supabaseClient';
import { UserState, SavedCard } from '../types';

const MOCK_CARDS: SavedCard[] = [
    { id: 'c1', type: 'VISA', last4: '4242', label: 'Personal Card' },
    { id: 'u1', type: 'UPI', upiId: 'user@okaxis', label: 'Primary UPI' }
];

export const registerUser = async (
    email: string, 
    password: string, 
    fullName: string, 
    phone: string, 
    upiId: string, 
    role: UserState['role'] = 'store_owner',
    storeName?: string,
    storeAddress?: string
): Promise<UserState> => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
                phone: phone
            }
        }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Registration failed.");

    // 1. Create the Profile (Triggers usually depend on this being first)
    const { error: profileError } = await supabase
        .from('profiles')
        .insert({
            id: authData.user.id,
            email: email,
            full_name: fullName,
            phone_number: phone,
            role: role,
            upi_id: upiId 
        });

    if (profileError) throw profileError;

    // 2. If Partner, initialize their Store immediately
    if (role === 'store_owner' && storeName) {
        const { error: storeError } = await supabase
            .from('stores')
            .insert({
                owner_id: authData.user.id,
                name: storeName,
                address: storeAddress || 'Address Pending',
                upi_id: upiId,
                is_open: true,
                is_verified: false, // Pending admin audit
                type: 'Local Mart',
                rating: 5.0,
                lat: 12.9716, // Default Bangalore center, can be updated later
                lng: 77.5946
            });
            
        if (storeError) {
            console.error("Store Creation Error:", storeError);
            // We don't throw here to avoid blocking registration if profile was successful, 
            // but the store can be created manually in the app later.
        }
    }

    return {
        isAuthenticated: true,
        id: authData.user.id,
        phone: phone,
        email: email,
        name: fullName,
        address: storeAddress || '',
        savedCards: [],
        location: null,
        role: role,
        upiId: upiId
    };
};

export const loginUser = async (email: string, password: string): Promise<UserState> => {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Login failed");

    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

    if (profileError || !profileData) {
        const metadata = authData.user.user_metadata;
        const newProfile = {
            id: authData.user.id,
            email: authData.user.email,
            full_name: metadata?.full_name || 'Merchant',
            phone_number: metadata?.phone || '',
            role: 'store_owner'
        };
        await supabase.from('profiles').upsert(newProfile);
        
        return {
            isAuthenticated: true,
            id: authData.user.id,
            phone: newProfile.phone_number,
            email: newProfile.email || '',
            name: newProfile.full_name,
            address: '',
            savedCards: MOCK_CARDS,
            location: null,
            role: 'store_owner'
        };
    }

    return {
        isAuthenticated: true,
        id: profileData.id,
        phone: profileData.phone_number || '',
        email: profileData.email || '',
        name: profileData.full_name || '',
        address: profileData.address || '',
        savedCards: MOCK_CARDS,
        location: null,
        role: profileData.role as any,
        upiId: profileData.upi_id,
        gstNumber: profileData.gst_number || '',
        licenseNumber: profileData.license_number || ''
    };
};

export const updateUserProfile = async (id: string, updates: any) => {
  const dbPayload: any = { ...updates };
  if (updates.name) {
      dbPayload.full_name = updates.name;
      delete dbPayload.name;
  }
  if (updates.phone) {
      dbPayload.phone_number = updates.phone;
      delete dbPayload.phone;
  }
  if (updates.upiId) {
      dbPayload.upi_id = updates.upiId;
      delete dbPayload.upiId;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(dbPayload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};
