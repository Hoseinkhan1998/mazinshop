// stores/articles.ts
import { defineStore } from "pinia";
import axios from "axios";
import { useAuthStore } from "./auth";

export interface Article {
  id: number;
  created_at: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  image_url: string | null;
  image_alt: string | null;
  is_published: boolean;
  author_id: string;
}

export const useArticlesStore = defineStore("articles", {
  state: () => ({
    articles: [] as Article[], // لیست مقالات
    currentArticle: null as Article | null, // مقاله تکی برای صفحه نمایش
    loading: false,
  }),
  actions: {
    // ۱. دریافت لیست مقالات منتشر شده (برای بخش عمومی)
    async fetchPublicArticles() {
      const config = useRuntimeConfig();
      const url = `${config.public.supabaseUrl}/rest/v1/articles?is_published=eq.true&select=*&order=created_at.desc`;

      try {
        this.loading = true;
        const response = await axios.get(url, {
          headers: { apikey: config.public.supabaseKey },
        });
        this.articles = response.data;
      } catch (error) {
        console.error("Error fetching articles:", error);
      } finally {
        this.loading = false;
      }
    },

    // ۲. دریافت یک مقاله با Slug (برای صفحه داخلی مقاله)
    async fetchArticleBySlug(slug: string) {
      const config = useRuntimeConfig();
      // ما اینجا single() استفاده نمی‌کنیم چون axios آرایه برمی‌گرداند، خودمان عنصر اول را می‌گیریم
      const url = `${config.public.supabaseUrl}/rest/v1/articles?slug=eq.${slug}&select=*`;

      try {
        this.loading = true;
        const response = await axios.get(url, {
          headers: { apikey: config.public.supabaseKey },
        });
        if (response.data && response.data.length > 0) {
          this.currentArticle = response.data[0];
          return this.currentArticle;
        }
        return null;
      } catch (error) {
        console.error("Error fetching article by slug:", error);
        return null;
      } finally {
        this.loading = false;
      }
    },

    // ۳. آپلود تصویر مقاله در باکت article-images
    async uploadArticleImage(file: File) {
      const { $supabase } = useNuxtApp();
      const fileExt = file.name.split(".").pop();
      const fileName = `article-${Date.now()}.${fileExt}`;

      const { data, error } = await $supabase.storage.from("article-images").upload(fileName, file);

      if (error) throw error;

      // دریافت لینک عمومی
      const { data: publicUrlData } = $supabase.storage.from("article-images").getPublicUrl(fileName);

      return publicUrlData.publicUrl;
    },

    // ۴. افزودن مقاله جدید (مخصوص ادمین)
    async addArticle(payload: { title: string; slug: string; content: string; excerpt: string; image_url: string; image_alt: string; is_published: boolean }) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();

      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      const url = `${config.public.supabaseUrl}/rest/v1/articles`;

      try {
        await axios.post(url, payload, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
        });
        // لیست را رفرش کن
        await this.fetchPublicArticles();
      } catch (error) {
        console.error("Error adding article:", error);
        throw error;
      }
    },
  },
});
