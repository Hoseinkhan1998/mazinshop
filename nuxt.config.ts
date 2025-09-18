// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@nuxt/image',
    '@pinia/nuxt',
    'vuetify-nuxt-module'
  ], 
  css: ['@/assets/css/main.css'],
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
    typescript: {
    strict: true,
    shim: false,
  },
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY
    }
  },

  vuetify: {
  vuetifyOptions: './vuetify.config.ts'
}

})