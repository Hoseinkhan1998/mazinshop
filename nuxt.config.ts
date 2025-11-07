// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxt/image", "@pinia/nuxt", "vuetify-nuxt-module"],
  css: ["@/assets/css/main.css"],
  vite: {
    plugins: [tailwindcss()],
  },
  typescript: {
    strict: true,
    shim: false,
  },
  runtimeConfig: {
    smsirApiKey: process.env.SMSIR_API_KEY,
    smsirTemplateId: process.env.SMSIR_TEMPLATE_ID, // مثلاً: 123456
    smsirParamName: process.env.SMSIR_PARAM_NAME || "CODE", // نام پارامتر در قالب تایید
    otpPepper: process.env.OTP_PEPPER, // یک رشته تصادفی قوی
    supabaseServiceRole: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    // for sandbox mode
    smsirSandbox: process.env.SMSIR_SANDBOX === "1",

    authAliasDomain: process.env.AUTH_ALIAS_DOMAIN || "auth.mazinshop.local", // برای ایمیل مصنوعی

    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY,
    },
  },

  vuetify: {
    vuetifyOptions: "./vuetify.config.ts",
  },
});
