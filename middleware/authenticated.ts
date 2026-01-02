// middleware/authenticated.ts
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return;

  const { $supabase } = useNuxtApp();
  const {
    data: { session },
  } = await $supabase.auth.getSession();
  if (!session?.user) {
    return navigateTo({
      path: "/login",
      query: { redirect: to.fullPath || "/userInfo" },
    });
  }
});
