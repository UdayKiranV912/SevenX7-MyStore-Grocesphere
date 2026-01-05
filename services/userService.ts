
import { supabase } from './supabaseClient';
import { UserState, SavedCard } from '../types';

const MOCK_CARDS: SavedCard[] = [
    { id: 'c1', type: 'VISA', last4: '4242', label: 'Personal Card' },
    { id: 'u1', type: 'UPI', upiId: 'user@okaxis', label: 'Primary UPI' }
];

const mapRoleToBackend = (role: string): any => {
    if (role === 'store_owner') return 'store';
    if (role === 'delivery_partner') return 'delivery';
    return role;
};

const mapRoleToFrontend = (role: string): any => {
    if (role === 'store') return 'store_owner';
    if (role === 'delivery') return 'delivery_partner';
    return role;
};

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

    const backendRole = mapRoleToBackend(role);

    // Initial profile setup - explicit pending status
    const { error: profileError } = await supabase
        .from('profiles')
        .insert({
            id: authData.user.id,
            email: email,
            full_name: fullName,
            phone: phone,
            role: backendRole,
            status: 'pending', // Approval Status enum
            upi_id: upiId,
            is_active: false,
            fee_paid_until: new Date(Date.now() + 86400000).toISOString() // 1 day grace for setup
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
                store_type: 'mini_mart',
                approved: false, // Store specific approval
                status: 'inactive',
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

    return {
        isAuthenticated: true,
        id: profileData.id,
        phone: profileData.phone || '',
        email: profileData.email || '',
        name: profileData.full_name || '',
        address: profileData.address || '',
        savedCards: MOCK_CARDS,
        location: null,
        role: mapRoleToFrontend(profileData.role),
        upiId: profileData.upi_id,
        verification_status: profileData.status === 'approved' ? 'verified' : profileData.status,
        verificationStatus: profileData.status === 'approved' ? 'verified' : profileData.status
    };
};

export const updateUserProfile = async (id: string, updates: any) => {
  const dbPayload: any = {};
  if (updates.name) dbPayload.full_name = updates.name;
  if (updates.phone) dbPayload.phone = updates.phone;
  
  const { data, error } = await supabase
    .from('profiles')
    .update(dbPayload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};
