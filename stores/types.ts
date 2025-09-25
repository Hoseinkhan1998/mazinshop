// stores/types.ts
import { defineStore } from "pinia";
// import { getSupabaseClient } from "~/utils/supabase";
import axios from "axios";

export interface ProductType {
  id: number;
  created_at: string;
  typename: string;
}

export const useTypesStore = defineStore("types", {
  state: () => ({
    types: [] as ProductType[],
  }),
  actions: {
    async fetchTypes() {
      const config = useRuntimeConfig();
      const url = `${config.public.supabaseUrl}/rest/v1/types?select=*`;
      try {
        const response = await axios.get(url, {
          headers: { apikey: config.public.supabaseKey },
        });
        this.types = response.data;
      } catch (error) {
        console.error("Error fetching types:", error);
      }
    },
    async addType(typename: string) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      const url = `${config.public.supabaseUrl}/rest/v1/types`;
      try {
        const response = await axios.post(
          url,
          { typename },
          {
            headers: {
              apikey: config.public.supabaseKey,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
          }
        );
        this.types.push(response.data[0]);
      } catch (error) {
        console.error("Error adding type:", error);
        throw error;
      }
    },
    async updateType(id: number, typename: string) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      const url = `${config.public.supabaseUrl}/rest/v1/types?id=eq.${id}`;
      try {
        const response = await axios.patch(
          url,
          { typename },
          {
            headers: {
              apikey: config.public.supabaseKey,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
          }
        );
        const updatedItem = response.data[0];
        const index = this.types.findIndex((t) => t.id === id);
        if (index !== -1) {
          this.types[index] = updatedItem;
        }
      } catch (error) {
        console.error("Error updating type:", error);
        throw error;
      }
    },
    async deleteType(typeId: number) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      const url = `${config.public.supabaseUrl}/rest/v1/types?id=eq.${typeId}`;
      try {
        await axios.delete(url, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
          },
        });
        // اگر حذف موفق بود، از state هم پاک می‌کنیم
        this.types = this.types.filter((t) => t.id !== typeId);
      } catch (error: any) {
        // اگر خطا به خاطر foreign key بود، یعنی نوع در حال استفاده است
        if (error.response?.data?.code === "23503") {
          throw new Error("این نوع توسط حداقل یک محصول استفاده شده و قابل حذف نیست.");
        }
        console.error("Error deleting type:", error);
        throw error;
      }
    },
  },
});
