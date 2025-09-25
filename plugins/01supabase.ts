// plugins/supabase.ts
import { createClient } from '@supabase/supabase-js'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()

  const supabaseUrl = config.public.supabaseUrl
  const supabaseKey = config.public.supabaseKey

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL or Key is missing from runtime config.')
  }

  // کلاینت سوپابیس فقط یک بار در اینجا ساخته می‌شود
  const supabase = createClient(supabaseUrl, supabaseKey)

  // ما این نمونه را در کل اپلیکیشن با نام $supabase در دسترس قرار می‌دهیم
  nuxtApp.provide('supabase', supabase)
})