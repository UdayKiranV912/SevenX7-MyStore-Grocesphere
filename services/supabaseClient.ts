
import { createClient } from '@supabase/supabase-js';

// Project credentials provided by user
const supabaseUrl = 'https://tobdllelnheqtnnmaxxr.supabase.co';
const supabaseKey = 'sb_publishable_Bgj45OANboOHclsXDeDpEA_6D_YLpIR';

export const supabase = createClient(supabaseUrl, supabaseKey);
