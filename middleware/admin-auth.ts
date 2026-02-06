// middleware/admin-auth.ts
// import { useAuthStore } from "~/stores/auth";

// export default defineNuxtRouteMiddleware((to, from) => {
//   const authStore = useAuthStore();
//   // اگر کاربر لاگین نکرده یا ادمین نیست، به صفحه اصلی هدایتش کن
//   if (!authStore.isAdmin) {
//     return navigateTo("/");
//   }
// });

// middleware/admin-auth.ts
import { useAuthStore } from "~/stores/auth";

export default defineNuxtRouteMiddleware(async (to, from) => {
  const authStore = useAuthStore();

  // در سمت سرور (SSR) بررسی دقیق سشن دشوار است، پس اجازه می‌دهیم کلاینت تصمیم بگیرد
  if (import.meta.server) return;

  // اگر پروفایل هنوز بارگذاری نشده (مثلاً موقع رفرش صفحه)، یکبار تلاش می‌کنیم آن را واکشی کنیم
  if (!authStore.profile) {
    await authStore.fetchUser();
  }

  // حالا با اطمینان وضعیت ادمین بودن را چک می‌کنیم
  if (!authStore.isAdmin) {
    console.warn("دسترسی غیرمجاز: کاربر ادمین نیست یا پروفایل بارگذاری نشده است.");
    return navigateTo("/");
  }
});
