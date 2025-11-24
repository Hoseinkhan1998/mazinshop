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
    attributesLastFetchedAt: null as number | null,
    attributesCacheHydrated: false,
  }),
  actions: {
    // این اکشن لیست مقادیر را برای یک زوج نوع-ویژگی به صورت کامل سینک می‌کند
    async syncAttributeOptions(typeId: number, attributeId: number, newValues: string[]) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      try {
        // ۱. حذف تمام مقادیر قدیمی مربوط به این زوج
        const deleteUrl = `${config.public.supabaseUrl}/rest/v1/type_attribute_options?type_id=eq.${typeId}&attribute_id=eq.${attributeId}`;
        await axios.delete(deleteUrl, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
          },
        });

        // ۲. افزودن لیست جدید مقادیر (اگر لیستی وجود داشت)
        if (newValues.length > 0) {
          const insertUrl = `${config.public.supabaseUrl}/rest/v1/type_attribute_options`;
          const payload = newValues.map((value) => ({
            type_id: typeId,
            attribute_id: attributeId,
            value,
          }));
          await axios.post(insertUrl, payload, {
            headers: {
              apikey: config.public.supabaseKey,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });
        }
      } catch (error) {
        console.error("Error syncing attribute options:", error);
        throw error;
      }
    },
    // این اکشن جدید، مقادیر مربوط به یک ویژگی خاص را واکشی می‌کند
    async fetchAttributeValues(attributeId: number): Promise<string[]> {
      const config = useRuntimeConfig();
      const url = `${config.public.supabaseUrl}/rest/v1/attribute_values?attribute_id=eq.${attributeId}&select=value`;
      try {
        const response = await axios.get(url, {
          headers: { apikey: config.public.supabaseKey },
        });
        return response.data.map((item: { value: string }) => item.value);
      } catch (error) {
        console.error("Error fetching attribute values:", error);
        return [];
      }
    },
    // این اکشن قدرتمند، لیست مقادیر یک ویژگی را به صورت کامل سینک می‌کند
    async syncAttributeValues(attributeId: number, newValues: string[]) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      try {
        // ۱. حذف تمام مقادیر قدیمی مربوط به این ویژگی
        const deleteUrl = `${config.public.supabaseUrl}/rest/v1/attribute_values?attribute_id=eq.${attributeId}`;
        await axios.delete(deleteUrl, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
          },
        });

        // ۲. افزودن لیست جدید مقادیر (اگر لیستی وجود داشت)
        if (newValues.length > 0) {
          const insertUrl = `${config.public.supabaseUrl}/rest/v1/attribute_values`;
          const payload = newValues.map((value) => ({ attribute_id: attributeId, value }));
          await axios.post(insertUrl, payload, {
            headers: {
              apikey: config.public.supabaseKey,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });
        }
      } catch (error) {
        console.error("Error syncing attribute values:", error);
        throw error;
      }
    },
    // واکشی تمام ویژگی‌ها
    async fetchAttributes(force: boolean = false) {
      const config = useRuntimeConfig();
      const CACHE_KEY = "mazin_attributes_cache_v1";
      const CACHE_TTL = 1000 * 60 * 60 * 24; // مثلا ۱ روز – خیلی کم عوض میشن
      const now = Date.now();

      // ۱) هیدرات از localStorage
      if (import.meta.client && !this.attributesCacheHydrated) {
        this.attributesCacheHydrated = true;
        try {
          const raw = localStorage.getItem(CACHE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.data)) {
              this.attributes = parsed.data;
              this.attributesLastFetchedAt = parsed.ts || null;
            }
          }
        } catch (e) {
          console.warn("Failed to read attributes cache:", e);
          localStorage.removeItem(CACHE_KEY);
        }
      }

      const hasFreshEnough = !force && this.attributes.length > 0 && this.attributesLastFetchedAt !== null && now - this.attributesLastFetchedAt < CACHE_TTL;

      const fetchFromNetwork = async () => {
        try {
          const url = `${config.public.supabaseUrl}/rest/v1/attributes?select=*`;
          const response = await axios.get(url, {
            headers: { apikey: config.public.supabaseKey },
          });
          this.attributes = response.data;
          this.attributesLastFetchedAt = Date.now();

          if (import.meta.client) {
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify({ data: this.attributes, ts: this.attributesLastFetchedAt }));
            } catch (e) {
              console.warn("Failed to write attributes cache:", e);
            }
          }
        } catch (error) {
          console.error("Error fetching attributes:", error);
        }
      };

      if (hasFreshEnough && !force) {
        fetchFromNetwork().catch((err) => console.error("Background fetchAttributes error:", err));
        return;
      }

      await fetchFromNetwork();
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
