import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// Elimina automáticamente sufijos accidentales como /rest/v1 o barras al final
const supabaseUrl = rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

