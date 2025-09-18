// stores/products.ts
import { defineStore } from "pinia";
import type { Product, NewProduct } from "~/types/Product";
import axios from "axios";
import { getSupabaseClient } from "~/utils/supabase";

export const useProductStore = defineStore("product", {
  state: () => ({
    products: [] as Product[],
  }),

  actions: {
    async fetchProducts(filters: string = "") {
      const config = useRuntimeConfig();
      const supabaseUrl = config.public.supabaseUrl;
      const supabaseKey = config.public.supabaseKey;

      if (!supabaseUrl || !supabaseKey) return;

      try {
        // اگر فیلتری ارسال شده بود، اون رو به انتهای URL اضافه می‌کنیم
        const url = `${supabaseUrl}/rest/v1/products?select=*${filters ? `&${filters}` : ""}`;

        console.log("Requesting URL:", url); // برای تست خوبه که ببینیم آدرس چی ساخته شده

        const response = await axios.get(url, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        });

        this.products = response.data;
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    },

    async addProduct(newProductData: Omit<NewProduct, "image_urls" | "id" | "created_at">, files: File[]) {
      const config = useRuntimeConfig();
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error("User not authenticated.");

      try {
        // ۱. آپلود تصاویر جدید و دریافت آرایه URLها
        const newImageUrls = await this.uploadMultipleImages(files);

        // ۲. ساخت آبجکت نهایی محصول برای ارسال به دیتابیس
        const finalProduct: NewProduct = {
          ...newProductData,
          image_urls: newImageUrls,
        };
        console.log("Data being sent to Supabase:", finalProduct);

        const url = `${config.public.supabaseUrl}/rest/v1/products`;

        // ۳. ارسال محصول نهایی به دیتابیس
        const response = await axios.post(url, finalProduct, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
        });

        // ۴. افزودن محصول جدید به state برای نمایش آنی در UI
        this.products.push(response.data[0]);
      } catch (error) {
        console.error("Error adding product:", error);
        throw error;
      }
    },

    async uploadMultipleImages(files: File[]): Promise<string[]> {
      const supabase = getSupabaseClient();
      const uploadedUrls: string[] = [];

      for (const file of files) {
        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-_]/g, "")}`;
        const { error: uploadError } = await supabase.storage.from("product-images").upload(fileName, file);

        if (uploadError) {
          console.error("Error uploading one of the images:", uploadError);
          throw uploadError;
        }

        const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);

        uploadedUrls.push(data.publicUrl);
      }
      return uploadedUrls;
    },

    async deleteImages(urls: string[]) {
      if (urls.length === 0) return;
      const supabase = getSupabaseClient();
      const fileNames = urls.map((url) => url.split("/").pop() as string);

      const { error } = await supabase.storage.from("product-images").remove(fileNames);

      if (error) {
        console.error("Error deleting images from storage:", error);
      }
    },

    // stores/products.ts -> actions

    async deleteProduct(productToDelete: Product) {
      const supabase = getSupabaseClient();
      const config = useRuntimeConfig();

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("User is not authenticated.");

        // --- مرحله ۱: حذف تصاویر از Storage (نسخه آپدیت شده) ---
        // چک می‌کنیم که آرایه تصاویر وجود دارد و خالی نیست
        if (productToDelete.image_urls && productToDelete.image_urls.length > 0) {
          // نام فایل را برای هر URL در آرایه استخراج می‌کنیم
          const fileNames = productToDelete.image_urls.map((url) => new URL(url).pathname.split("/").pop()).filter(Boolean) as string[]; // filter(Boolean) برای حذف آیتم‌های null یا undefined

          // اگر نام فایلی برای حذف وجود داشت، آنها را از Storage پاک می‌کنیم
          if (fileNames.length > 0) {
            const { error: storageError } = await supabase.storage.from("product-images").remove(fileNames);

            if (storageError) {
              console.error("Warning: Could not delete images from storage:", storageError.message);
            }
          }
        }

        // --- مرحله ۲: حذف رکورد محصول از دیتابیس (بدون تغییر) ---
        const url = `${config.public.supabaseUrl}/rest/v1/products?id=eq.${productToDelete.id}`;
        await axios.delete(url, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
          },
        });

        // --- مرحله ۳: آپدیت کردن state (بدون تغییر) ---
        this.products = this.products.filter((p) => p.id !== productToDelete.id);
      } catch (error) {
        console.error("Error deleting product:", error);
        throw error;
      }
    },

    async updateProduct(
      productToUpdate: Product,
      newData: { title: string; price: number; description: string; type_id: number | null },
      newFiles: File[],
      keptImageUrls: string[]
    ) {
      const config = useRuntimeConfig();
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      try {
        // ۱. پیدا کردن تصاویری که توسط کاربر حذف شده‌اند
        const imagesToDelete = productToUpdate.image_urls.filter((url) => !keptImageUrls.includes(url));
        // حذف تصاویر از Storage
        await this.deleteImages(imagesToDelete);

        // ۲. آپلود تصاویر جدیدی که کاربر اضافه کرده
        const newImageUrls = await this.uploadMultipleImages(newFiles);

        // ۳. ساخت آرایه نهایی URLهای تصاویر (ترکیب عکس‌های باقی‌مانده و جدید)
        const finalImageUrls = [...keptImageUrls, ...newImageUrls];

        // ۴. ساخت آبجکت نهایی داده‌ها برای ارسال به دیتابیس
        const finalProductData = {
          ...newData,
          image_urls: finalImageUrls,
        };

        const url = `${config.public.supabaseUrl}/rest/v1/products?id=eq.${productToUpdate.id}`;

        // ۵. ارسال درخواست آپدیت به دیتابیس
        const response = await axios.patch(url, finalProductData, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
        });

        // ۶. آپدیت کردن محصول در state برای نمایش آنی تغییرات در UI
        const updatedItem = response.data[0];
        const index = this.products.findIndex((p) => p.id === updatedItem.id);
        if (index !== -1) {
          this.products[index] = updatedItem;
        }
      } catch (error) {
        console.error("Error updating product:", error);
        throw error;
      }
    },
  },
});
