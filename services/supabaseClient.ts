
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tvywzlolrjukfkukxjpr.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'sb_publishable_LdempZ18AsyBTVrBI8wkHw_E-sq5GQb';

export const supabase = createClient(supabaseUrl, supabaseKey);
