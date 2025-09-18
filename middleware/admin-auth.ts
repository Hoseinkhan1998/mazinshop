// middleware/admin-auth.ts
import { useAuthStore } from "~/stores/auth";

export default defineNuxtRouteMiddleware((to, from) => {
  const authStore = useAuthStore();
  // اگر کاربر لاگین نکرده یا ادمین نیست، به صفحه اصلی هدایتش کن
  if (!authStore.isAdmin) {
    return navigateTo('/');
  }
});