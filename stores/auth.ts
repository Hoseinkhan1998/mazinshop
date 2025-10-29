import { defineStore } from "pinia";
// import { getSupabaseClient } from "~/utils/supabase";
import type { User } from "@supabase/supabase-js";

// اینترفیس پروفایل را کامل‌تر می‌کنیم
interface Profile {
  id: string;
  full_name: string;
  phone_number: string | null;
  role: string;
}

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null as User | null,
    profile: null as Profile | null,
  }),
  getters: {
    isLoggedIn: (state) => !!state.user,
    isAdmin: (state) => state.profile?.role === "admin",
    // displayName حالا نام را از پروفایل می‌خواند
    displayName: (state) => {
      return state.profile?.full_name || state.user?.email;
    },
  },
  actions: {
    async signIn(email: string, password: string) {
      const { $supabase } = useNuxtApp();
      const { data, error } = await $supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
      if (error) throw error;
      if (data.user) {
        await this.fetchUser();
        const cartStore = useCartStore();
        await cartStore.syncOnLogin();
      }
    },

    async fetchUser() {
      const { $supabase } = useNuxtApp();
      const { data: { user } } = await $supabase.auth.getUser();
      this.user = user;

      if (user) {
        // حالا تمام اطلاعات پروفایل را با select('*') واکشی می‌کنیم
        const { data: profileData, error } = await $supabase
          .from("profiles")
          .select('*') // <-- تغییر اصلی اینجاست
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error fetching profile:", error);
          this.profile = null; // در صورت خطا پروفایل را پاک می‌کنیم
        } else {
          this.profile = profileData;
        }
      }
    },

    listenToAuthState() {
      const { $supabase } = useNuxtApp();
      $supabase.auth.onAuthStateChange((event, session) => {
        // وقتی وضعیت تغییر می‌کند (مثلا لاگین در تب دیگر)، کاربر را آپدیت می‌کنیم
        if (session?.user !== this.user) {
          this.user = session?.user ?? null;
          // و پروفایل را دوباره واکشی می‌کنیم
          if (this.user) {
            this.fetchUser();
          } else {
            this.profile = null;
          }
        }
      });
    },
    
    async signOut() {
      const cartStore = useCartStore();
      cartStore.clearOnLogout();
      const { $supabase } = useNuxtApp();
      await $supabase.auth.signOut();
      this.user = null;
      this.profile = null;
    },
  },
});