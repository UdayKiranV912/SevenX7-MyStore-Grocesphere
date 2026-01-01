
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
    const { data: authData, error: authError } = await (supabase.auth as any).signUp({
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

    const { error: profileError } = await supabase
        .from('profiles')
        .insert({
            id: authData.user.id,
            email: email,
            full_name: fullName,
            phone_number: phone,
            role: role,
            upi_id: upiId,
            verification_status: 'pending'
        });

    if (profileError) throw profileError;

    if (role === 'store_owner' && storeName) {
        await supabase
            .from('stores')
            .insert({
                owner_id: authData.user.id,
                name: storeName,
                address: storeAddress || 'Address Pending',
                upi_id: upiId,
                is_open: false,
                verification_status: 'pending',
                type: 'Local Mart',
                rating: 5.0,
                lat: 12.9716, 
                lng: 77.5946
            });
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
        upiId: upiId,
        verification_status: 'pending'
    };
};

export const loginUser = async (email: string, password: string): Promise<UserState> => {
    const { data: authData, error: authError } = await (supabase.auth as any).signInWithPassword({
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
        throw new Error("Profile not found.");
    }

    // We return the user even if pending so the App can listen for real-time verification status changes
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
        verification_status: profileData.verification_status as any,
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
