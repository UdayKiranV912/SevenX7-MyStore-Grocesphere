import { createClient } from '@supabase/supabase-js';

// Project credentials provided by the user
const supabaseUrl = 'https://bgavgglaktkwncibfelu.supabase.co';
const supabaseKey = 'sb_publishable_7xzUVmYovc_w_I4baegEYg_bUQkvQwy';

export const supabase = createClient(supabaseUrl, supabaseKey);