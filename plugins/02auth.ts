// plugins/auth.ts
import { useAuthStore } from "~/stores/auth";
import { useCartStore } from "~/stores/cart";

export default defineNuxtPlugin(async (nuxtApp) => {
  const authStore = useAuthStore();
  const cartStore = useCartStore();

  // اگر کاربر از قبل لاگین کرده باشد، اطلاعاتش را در store قرار می‌دهیم
  await authStore.fetchUser();
  await cartStore.initializeCart();

  // همچنین به تغییرات وضعیت لاگین گوش می‌دهیم تا در صورت خروج، store آپدیت شود
  authStore.listenToAuthState();
});