
import { createClient } from '@supabase/supabase-js';

// Project credentials provided by user
const supabaseUrl = 'https://tsadkqjvcdhjdqrwurbx.supabase.co';
const supabaseKey = 'sb_publishable_CZnad3HNfL14Ov2bKpu7nQ_bGyh7jmr';

export const supabase = createClient(supabaseUrl, supabaseKey);
