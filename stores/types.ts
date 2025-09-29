// stores/types.ts

import { defineStore } from "pinia";
import axios from "axios";
import type { Attribute } from "./attributes";

// اینترفیس را با خروجی دقیق تابع RPC هماهنگ می‌کنیم
export interface ProductType {
  id: number;
  created_at: string;
  typename: string;
  attributes: Attribute[] | null; // ویژگی‌ها می‌توانند null باشند
}

export const useTypesStore = defineStore("types", {
  state: () => ({
    types: [] as ProductType[],
  }),
  actions: {
    // ۱. واکشی انواع با استفاده از تابع سفارشی دیتابیس (RPC)
    async fetchTypes(force: boolean = false) {
      if (!force && this.types.length > 0) return;

      const { $supabase } = useNuxtApp();
      try {
        const { data, error } = await $supabase.rpc("get_types_with_details");
        if (error) throw error;
        // خروجی تابع RPC ممکن است null باشد، آن را به آرایه خالی تبدیل می‌کنیم
        this.types = data || [];
      } catch (error) {
        console.error("Error fetching types:", error);
      }
    },

    // ۲. افزودن یک نوع جدید به همراه ویژگی‌های متصل به آن
    async addTypeWithAttributes(typename: string, attributeIds: number[]) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      try {
        // ابتدا خود "نوع" را می‌سازیم
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

        // سپس ویژگی‌ها را به آن متصل می‌کنیم
        if (attributeIds.length > 0) {
          const linkUrl = `${config.public.supabaseUrl}/rest/v1/type_attributes`;
          const links = attributeIds.map((attrId) => ({ type_id: newType.id, attribute_id: attrId }));
          await axios.post(linkUrl, links, {
            headers: {
              apikey: config.public.supabaseKey,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });
        }

        // در نهایت لیست را دوباره واکشی می‌کنیم تا UI هماهنگ شود
        await this.fetchTypes(true);
      } catch (error) {
        console.error("Error adding type with attributes:", error);
        throw error;
      }
    },

    // ۳. ویرایش یک نوع و ویژگی‌های متصل به آن
    async updateTypeWithAttributes(typeId: number, newTypename: string, newAttributeIds: number[]) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      try {
        // از تابع RPC سفارشی که ساختیم استفاده می‌کنیم
        const { error } = await $supabase.rpc("update_type_and_cleanup_attributes", {
          type_id_to_update: typeId,
          new_typename: newTypename,
          new_attribute_ids: newAttributeIds,
        });
        if (error) throw error;

        // بعد از عملیات موفق، داده‌ها را دوباره واکشی می‌کنیم
        await this.fetchTypes(true);

        // ویژگی‌ها را هم واکشی می‌کنیم چون ممکن است چیزی حذف شده باشد
        const attributesStore = useAttributesStore();
        await attributesStore.fetchAttributes(true);
      } catch (error) {
        console.error("Error updating type with attributes:", error);
        throw error;
      }
    },

    // ۴. حذف یک نوع و ویژگی‌های یتیم شده آن
    async deleteType(typeId: number) {
      const { $supabase } = useNuxtApp();
      const attributesStore = useAttributesStore();
      try {
        const { data: deletedAttributes, error } = await $supabase.rpc("delete_type_and_cleanup_attributes", {
          type_id_to_delete: typeId,
        });
        if (error) throw error;

        this.types = this.types.filter((t) => t.id !== typeId);

        if (deletedAttributes && deletedAttributes.length > 0) {
          const idsToRemove = deletedAttributes.map((a: any) => a.deleted_attribute_id);
          attributesStore.removeAttributesByIds(idsToRemove);
        }
      } catch (error: any) {
        if (error.code === "23503") {
          throw new Error("این نوع توسط حداقل یک محصول استفاده شده و قابل حذف نیست.");
        }
        console.error("Error deleting type:", error);
        throw error;
      }
    },
    // این اکشن تمام آپشن‌های تعریف شده برای یک نوع خاص را برمی‌گرداند
    async fetchOptionsForType(typeId: number) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const url = `${config.public.supabaseUrl}/rest/v1/type_attribute_options?type_id=eq.${typeId}&select=attribute_id,value`;
      try {
        const response = await axios.get(url, { headers: { apikey: config.public.supabaseKey } });
        // داده‌ها را به صورت گروه‌بندی شده بر اساس attribute_id برمی‌گردانیم
        const groupedOptions = response.data.reduce((acc: any, option: any) => {
          if (!acc[option.attribute_id]) {
            acc[option.attribute_id] = [];
          }
          acc[option.attribute_id].push(option.value);
          return acc;
        }, {});
        return groupedOptions;
      } catch (error) {
        console.error("Error fetching options for type:", error);
        return {};
      }
    },
  },
});
