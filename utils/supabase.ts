// utils/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const getSupabaseClient = () => {
  const config = useRuntimeConfig();
  const supabaseUrl = config.public.supabaseUrl;
  const supabaseKey = config.public.supabaseKey;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL or Key is missing.');
  }

  return createClient(supabaseUrl, supabaseKey);
}