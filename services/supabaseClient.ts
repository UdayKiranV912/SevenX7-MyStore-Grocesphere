
import { createClient } from '@supabase/supabase-js';

// Project credentials provided by the user
const supabaseUrl = 'https://rnighfnynhhfpwofyynk.supabase.co';
const supabaseKey = 'sb_publishable_jvx4O50FZyffYVzLbh9YJg_ngh1p-19';

export const supabase = createClient(supabaseUrl, supabaseKey);
