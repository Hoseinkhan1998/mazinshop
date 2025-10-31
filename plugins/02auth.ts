// plugins/auth.ts
import { useAuthStore } from "~/stores/auth";
import { useCartStore } from "~/stores/cart";

export default defineNuxtPlugin(async () => {
  if (import.meta.server) return; // ← فقط کلاینت

  const authStore = useAuthStore();
  const cartStore = useCartStore();

  await authStore.fetchUser();
  await cartStore.initializeCart();   // ← حالا مطمئنیم روی کلاینت اجرا شده

  authStore.listenToAuthState();
});
