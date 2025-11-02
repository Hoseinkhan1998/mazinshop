// middleware/authenticated.ts
export default defineNuxtRouteMiddleware(async (to) => {
  // فقط روی کلاینت چک می‌کنیم چون session Supabase در localStorage ذخیره میشه
  if (import.meta.server) return;

  const { $supabase } = useNuxtApp();
  // این فراخوانی session فعلی از کلاینت می‌گیره
  const {
    data: { session },
  } = await $supabase.auth.getSession();

  // اگر سشن وجود نداشت => هدایت به صفحه لاگین با redirect به مسیر فعلی یا مقصد دلخواه
  if (!session?.user) {
    // redirect to login with redirect param
    return navigateTo({
      path: "/login",
      query: { redirect: to.fullPath || "/userInfo" },
    });
  }

  // در غیر اینصورت اجازه ورود می‌دهیم (هیچی بازنمی‌گردانیم)
});
