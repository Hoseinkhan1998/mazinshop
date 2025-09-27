import { defineStore } from "pinia";
// import { getSupabaseClient } from '~/utils/supabase';
import axios from "axios";

// اینترفیس برای تعریف ساختار یک ویژگی
export interface Attribute {
  id: number;
  created_at: string;
  name: string;
}

export const useAttributesStore = defineStore("attributes", {
  state: () => ({
    attributes: [] as Attribute[],
  }),
  actions: {
    // واکشی تمام ویژگی‌ها
    async fetchAttributes(force: boolean = false) {
      if (!force && this.attributes.length > 0) return;
      if (this.attributes.length > 0) return;
      const config = useRuntimeConfig();
      const url = `${config.public.supabaseUrl}/rest/v1/attributes?select=*`;
      try {
        const response = await axios.get(url, {
          headers: { apikey: config.public.supabaseKey },
        });
        this.attributes = response.data;
      } catch (error) {
        console.error("Error fetching attributes:", error);
      }
    },

    // افزودن یک ویژگی جدید
    async addAttribute(name: string) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      const url = `${config.public.supabaseUrl}/rest/v1/attributes`;
      try {
        const response = await axios.post(
          url,
          { name },
          {
            headers: {
              apikey: config.public.supabaseKey,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
          }
        );
        const newAttribute = response.data[0];
        this.attributes.push(newAttribute);

        return newAttribute;
      } catch (error) {
        console.error("Error adding attribute:", error);
        throw error;
      }
    },

    // ویرایش نام یک ویژگی
    async updateAttribute(id: number, name: string) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      const url = `${config.public.supabaseUrl}/rest/v1/attributes?id=eq.${id}`;
      try {
        const response = await axios.patch(
          url,
          { name },
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
        const index = this.attributes.findIndex((a) => a.id === id);
        if (index !== -1) {
          this.attributes[index] = updatedItem;
        }
      } catch (error) {
        console.error("Error updating attribute:", error);
        throw error;
      }
    },

    // حذف یک ویژگی
    async deleteAttribute(attributeId: number) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      const url = `${config.public.supabaseUrl}/rest/v1/attributes?id=eq.${attributeId}`;
      try {
        await axios.delete(url, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
          },
        });
        this.attributes = this.attributes.filter((a) => a.id !== attributeId);
      } catch (error: any) {
        // در آینده اگر ویژگی‌ها به جایی متصل شوند، این خطا مهم می‌شود
        if (error.response?.data?.code === "23503") {
          throw new Error("این ویژگی در حال استفاده است و قابل حذف نیست.");
        }
        console.error("Error deleting attribute:", error);
        throw error;
      }
    },

    async addAttributeValue(attributeId: number, value: string) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      const url = `${config.public.supabaseUrl}/rest/v1/attribute_values`;
      const payload = {
        attribute_id: attributeId,
        value: value,
      };

      try {
        // ما فقط مقدار را اضافه می‌کنیم و نیازی به آپدیت state در اینجا نداریم
        await axios.post(url, payload, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
      } catch (error) {
        console.error("Error adding attribute value:", error);
        throw error;
      }
    },

    removeAttributesByIds(ids: number[]) {
      this.attributes = this.attributes.filter((attr) => !ids.includes(attr.id));
    },
  },
});
