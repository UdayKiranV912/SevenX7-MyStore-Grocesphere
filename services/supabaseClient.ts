
import { createClient } from '@supabase/supabase-js';

// Project credentials provided by the user
const supabaseUrl = 'https://xhfmqktjfhgvvdouafsm.supabase.co';
const supabaseKey = 'sb_publishable_8bI-iu52FZyuNRygZFkRJA_FwbwdTk4';

export const supabase = createClient(supabaseUrl, supabaseKey);
