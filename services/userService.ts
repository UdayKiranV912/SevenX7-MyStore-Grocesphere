
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
    // Comment: Bypass SupabaseAuthClient type resolution error for signUp method
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

    // 1. Create the Profile with 'pending' status
    const { error: profileError } = await supabase
        .from('profiles')
        .insert({
            id: authData.user.id,
            email: email,
            full_name: fullName,
            phone_number: phone,
            role: role,
            upi_id: upiId,
            verification_status: 'pending' // Enforce pending status
        });

    if (profileError) throw profileError;

    // 2. If Partner, initialize their Store immediately with 'pending' status
    if (role === 'store_owner' && storeName) {
        await supabase
            .from('stores')
            .insert({
                owner_id: authData.user.id,
                name: storeName,
                address: storeAddress || 'Address Pending',
                upi_id: upiId,
                is_open: false, // Keep closed until approved
                verification_status: 'pending',
                type: 'Local Mart',
                rating: 5.0,
                lat: 12.9716, 
                lng: 77.5946
            });
    }

    return {
        isAuthenticated: false, // Do not authenticate yet
        id: authData.user.id,
        phone: phone,
        email: email,
        name: fullName,
        address: storeAddress || '',
        savedCards: [],
        location: null,
        role: role,
        upiId: upiId,
        verificationStatus: 'pending'
    };
};

export const loginUser = async (email: string, password: string): Promise<UserState> => {
    // Comment: Bypass SupabaseAuthClient type resolution error for signInWithPassword method
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

    // CHECK FOR ADMIN APPROVAL
    if (profileData.verification_status !== 'verified') {
        const error: any = new Error("Your account is awaiting Super Admin approval.");
        error.status = profileData.verification_status;
        throw error;
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
        verificationStatus: profileData.verification_status as any,
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
