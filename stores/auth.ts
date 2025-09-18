// stores/auth.ts
import { defineStore } from "pinia";
import { getSupabaseClient } from "~/utils/supabase";
import type { User } from "@supabase/supabase-js";

// یک اینترفیس جدید برای پروفایل تعریف می‌کنیم
interface Profile {
  role: string;
  // ... any other profile data
}

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null as User | null,
    profile: null as Profile | null, // استیت جدید برای نگهداری پروفایل
  }),
  getters: {
    isLoggedIn: (state) => !!state.user,
    // getter ما حالا نقش را از پروفایل چک می‌کند
    isAdmin: (state) => state.profile?.role === "admin",
    displayName: (state) => {
      // همچنان از metadata برای نام استفاده می‌کنیم
      return state.user?.user_metadata?.full_name || state.user?.email;
    },
  },
  actions: {
    async signIn(email: string, password: string) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
      if (error) throw error;

      // اگر ورود موفق بود، بلافاصله پروفایل کاربر را واکشی می‌کنیم
      if (data.user) {
        await this.fetchUser();
      }
    },
    async fetchUser() {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      this.user = user;

      // اگر کاربر وجود داشت، پروفایل او را هم می‌خوانیم
      if (user) {
        const { data: profileData, error } = await supabase.from("profiles").select("role").eq("id", user.id).single();

        if (error) console.error("Error fetching profile:", error);
        this.profile = profileData;
      }
    },
    listenToAuthState() {
      // ... این تابع بدون تغییر باقی می‌ماند
    },
    async signOut() {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      // stateها را به صورت دستی پاک می‌کنیم تا اپلیکیشن سریع واکنش نشان دهد
      this.user = null;
      this.profile = null;
    },
  },
});
