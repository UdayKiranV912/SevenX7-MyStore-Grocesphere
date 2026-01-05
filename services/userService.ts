
import { supabase } from './supabaseClient';
import { UserState, Profile } from '../types';

export const registerUser = async (
    email: string, 
    password: string, 
    fullName: string, 
    phone: string, 
    upiId: string, 
    role: 'customer' | 'store' | 'delivery' = 'store',
    storeName?: string,
    storeAddress?: string,
    storeType?: string
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

    // Initial profile setup - Admin approval mandatory (set to false)
    const { error: profileError } = await supabase
        .from('profiles')
        .insert({
            id: authData.user.id,
            email: email,
            name: fullName,
            phone: phone,
            role: role,
            upi_id: upiId,
            admin_approved: false,
            active: true
        });

    if (profileError) throw profileError;

    if (role === 'store' && storeName) {
        // Map common emojis for auto-assignment based on store type
        const typeEmojis: Record<string, string> = {
            'DAIRY': '🥛',
            'VEG_FRUIT': '🥦',
            'MINI_MART': '🏪',
            'BIG_MART': '🛒'
        };

        await supabase
            .from('stores')
            .insert({
                owner_id: authData.user.id,
                store_name: storeName,
                address: storeAddress || 'Address Pending',
                upi_id: upiId,
                store_type: storeType || 'MINI_MART',
                emoji: typeEmojis[storeType || 'MINI_MART'] || '🏬',
                approved: false,
                active: true,
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
        role: role,
        upiId: upiId,
        admin_approved: false
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
        throw new Error("Profile not found.");
    }

    return {
        isAuthenticated: true,
        id: profileData.id,
        phone: profileData.phone || '',
        email: profileData.email || '',
        name: profileData.name || '',
        address: '',
        role: profileData.role,
        upiId: profileData.upi_id,
        admin_approved: profileData.admin_approved
    };
};

export const updateUserProfile = async (userId: string, updates: Partial<Profile>) => {
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (error) throw error;
};
