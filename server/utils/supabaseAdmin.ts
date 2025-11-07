import { createClient } from '@supabase/supabase-js';

export const getAdminClient = () => {
  const config = useRuntimeConfig();
  const url = config.public.supabaseUrl;
  const serviceRole = config.supabaseServiceRole;
  if (!url || !serviceRole) throw new Error('Supabase admin config missing.');
  return createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
};
