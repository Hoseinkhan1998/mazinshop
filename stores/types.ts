import { defineStore } from "pinia";
// import { getSupabaseClient } from "~/utils/supabase";
import axios from "axios";

export interface ProductType {
  id: number;
  created_at: string;
  typename: string;
  attributes: Attribute[];
}

export const useTypesStore = defineStore("types", {
  state: () => ({
    types: [] as ProductType[],
  }),
  actions: {
    async fetchTypes() {
      const config = useRuntimeConfig();
      const url = `${config.public.supabaseUrl}/rest/v1/types?select=*,attributes(*)`;
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
      const { $supabase } = useNuxtApp();
      const attributesStore = useAttributesStore(); // store ویژگی‌ها را وارد می‌کنیم
      try {
        // تابع RPC حالا لیستی از ID های حذف شده را برمی‌گرداند
        const { data: deletedAttributes, error } = await $supabase.rpc("delete_type_and_cleanup_attributes", {
          type_id_to_delete: typeId,
        });

        if (error) throw error;

        // state تایپ‌ها را آپدیت می‌کنیم
        this.types = this.types.filter((t) => t.id !== typeId);

        // به attributesStore دستور می‌دهیم تا state خودش را آپدیت کند
        if (deletedAttributes && deletedAttributes.length > 0) {
          const idsToRemove = deletedAttributes.map((a) => a.deleted_attribute_id);
          attributesStore.removeAttributesByIds(idsToRemove);
        }
      } catch (error: any) {
        // ... (بخش catch بدون تغییر)
      }
    },
    async linkAttributeToType(typeId: number, attributeId: number) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      const url = `${config.public.supabaseUrl}/rest/v1/type_attributes`;
      const payload = {
        type_id: typeId,
        attribute_id: attributeId,
      };

      try {
        // این اکشن فقط ارتباط را برقرار می‌کند و نیازی به آپدیت state ندارد
        await axios.post(url, payload, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
      } catch (error) {
        console.error("Error linking attribute to type:", error);
        throw error;
      }
    },

    async addTypeWithAttributes(typename: string, attributeIds: number[]) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      try {
        const typeUrl = `${config.public.supabaseUrl}/rest/v1/types`;
        const typeResponse = await axios.post(
          typeUrl,
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
        const newType = typeResponse.data[0];

        // به جای ارسال گروهی، لینک‌ها را تک به تک ایجاد می‌کنیم
        if (attributeIds.length > 0) {
          const linkUrl = `${config.public.supabaseUrl}/rest/v1/type_attributes`;
          for (const attrId of attributeIds) {
            const linkPayload = { type_id: newType.id, attribute_id: attrId };
            await axios.post(linkUrl, linkPayload, {
              headers: {
                apikey: config.public.supabaseKey,
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            });
          }
        }

        this.types = [];
        await this.fetchTypes();
      } catch (error) {
        console.error("Error adding type with attributes:", error);
        throw error;
      }
    },

    async updateTypeWithAttributes(typeId: number, newTypename: string, newAttributeIds: number[]) {
      const { $supabase } = useNuxtApp();
      try {
        const { error } = await $supabase.rpc("update_type_and_cleanup_attributes", {
          type_id_to_update: typeId,
          new_typename: newTypename,
          new_attribute_ids: newAttributeIds,
        });
        if (error) throw error;

        // بعد از عملیات موفق، داده‌ها را دوباره واکشی می‌کنیم تا UI هماهنگ شود
        await this.fetchTypes();
        // ویژگی‌ها را هم واکشی می‌کنیم چون ممکن است چیزی حذف شده باشد
        const attributesStore = useAttributesStore();
        await attributesStore.fetchAttributes(true);
      } catch (error) {
        console.error("Error updating type with attributes:", error);
        throw error;
      }
    },
  },
});
