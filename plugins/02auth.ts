// plugins/auth.ts
import { useAuthStore } from "~/stores/auth";

export default defineNuxtPlugin(async (nuxtApp) => {
  const authStore = useAuthStore();

  // اگر کاربر از قبل لاگین کرده باشد، اطلاعاتش را در store قرار می‌دهیم
  await authStore.fetchUser();

  // همچنین به تغییرات وضعیت لاگین گوش می‌دهیم تا در صورت خروج، store آپدیت شود
  authStore.listenToAuthState();
});