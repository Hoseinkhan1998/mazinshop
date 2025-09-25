import { defineStore } from "pinia";
import type { Product, NewProduct, ProductVariant } from "~/types/Product";
import axios from "axios";
// import { getSupabaseClient } from "~/utils/supabase";

export const useProductStore = defineStore("product", {
  state: () => ({
    products: [] as Product[],
  }),

  actions: {
    // 1. واکشی تمام محصولات به همراه نسخه‌های مختلف آنها
    async fetchProducts() {
      const config = useRuntimeConfig();
      const url = `${config.public.supabaseUrl}/rest/v1/products?select=*,product_variants(*)`;

      try {
        const response = await axios.get(url, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${config.public.supabaseKey}`,
          },
        });
        this.products = response.data;
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    },

    async addProduct(newProductData: Omit<NewProduct, "image_urls">, files: File[]) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      try {
        const newImageUrls = await this.uploadMultipleImages(files);

        const finalProduct: NewProduct = {
          ...newProductData,
          image_urls: newImageUrls,
        };

        const url = `${config.public.supabaseUrl}/rest/v1/products`;
        const response = await axios.post(url, finalProduct, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
        });

        // برای نمایش آنی، محصول جدید را به state اضافه می‌کنیم
        // و یک آرایه خالی برای variants قرار میدهیم
        const addedProduct = { ...response.data[0], product_variants: [] };
        this.products.push(addedProduct);
        return addedProduct; // محصول ساخته شده را برمیگردانیم تا در فرم استفاده شود
      } catch (error) {
        console.error("Error adding product:", error);
        throw error;
      }
    },

    // 3. آپدیت کردن اطلاعات پایه و گالری تصاویر یک محصول
    async updateProduct(productToUpdate: Product, newData: { title: string; description: string; type_id: number | null }, newFiles: File[], keptImageUrls: string[]) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      try {
        const imagesToDelete = productToUpdate.image_urls.filter((url) => !keptImageUrls.includes(url));
        await this.deleteImages(imagesToDelete);

        const newImageUrls = await this.uploadMultipleImages(newFiles);
        const finalImageUrls = [...keptImageUrls, ...newImageUrls];

        const finalProductData = {
          ...newData,
          image_urls: finalImageUrls,
        };

        const url = `${config.public.supabaseUrl}/rest/v1/products?id=eq.${productToUpdate.id}`;
        const response = await axios.patch(url, finalProductData, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
        });

        const updatedItem = { ...response.data[0], product_variants: productToUpdate.product_variants };
        const index = this.products.findIndex((p) => p.id === updatedItem.id);
        if (index !== -1) {
          this.products[index] = updatedItem;
        }
      } catch (error) {
        console.error("Error updating product:", error);
        throw error;
      }
    },

    // 4. حذف کامل یک محصول (به همراه تمام variantها و تصاویر)
    async deleteProduct(productToDelete: Product) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      try {
        // ۱. حذف تمام تصاویر محصول از Storage
        await this.deleteImages(productToDelete.image_urls);

        // ۲. حذف محصول از جدول products
        // نکته: شما باید در Supabase برای کلید خارجی product_id در جدول product_variants
        // گزینه On delete را روی CASCADE تنظیم کنید تا با حذف محصول، تمام variantهای آن هم خودکار حذف شوند.
        const url = `${config.public.supabaseUrl}/rest/v1/products?id=eq.${productToDelete.id}`;
        await axios.delete(url, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
          },
        });

        // ۳. حذف محصول از state
        this.products = this.products.filter((p) => p.id !== productToDelete.id);
      } catch (error) {
        console.error("Error deleting product:", error);
        throw error;
      }
    },

    // --- توابع کمکی برای تصاویر (این دو تابع بدون تغییر باقی می‌مانند) ---
    async uploadMultipleImages(files: File[]): Promise<string[]> {
      const { $supabase } = useNuxtApp();
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-_]/g, "")}`;
        const { error } = await $supabase.storage.from("product-images").upload(fileName, file);
        if (error) {
          console.error("Error uploading one of the images:", error);
          throw error;
        }
        const { data } = $supabase.storage.from("product-images").getPublicUrl(fileName);
        uploadedUrls.push(data.publicUrl);
      }
      return uploadedUrls;
    },

    async deleteImages(urls: string[]) {
      if (!urls || urls.length === 0) return;
      const { $supabase } = useNuxtApp();
      const fileNames = urls.map((url) => url.split("/").pop()).filter(Boolean) as string[];
      if (fileNames.length > 0) {
        const { error } = await $supabase.storage.from("product-images").remove(fileNames);
        if (error) {
          console.error("Error deleting images from storage:", error);
        }
      }
    },

    async addVariant(productId: number, newVariantData: NewVariant) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      const finalData = { ...newVariantData, product_id: productId };
      const url = `${config.public.supabaseUrl}/rest/v1/product_variants`;

      try {
        const response = await axios.post(url, finalData, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
        });

        // آپدیت state به صورت آنی
        const newVariant = response.data[0];
        const productIndex = this.products.findIndex((p) => p.id === productId);
        if (productIndex !== -1) {
          this.products[productIndex].product_variants.push(newVariant);
        }
      } catch (error) {
        console.error("Error adding variant:", error);
        throw error;
      }
    },

    // آپدیت کردن یک Variant موجود
    async updateVariant(variantId: number, updatedVariantData: Partial<ProductVariant>) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      const url = `${config.public.supabaseUrl}/rest/v1/product_variants?id=eq.${variantId}`;

      try {
        const response = await axios.patch(url, updatedVariantData, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
        });

        // آپدیت state به صورت آنی
        const updatedVariant = response.data[0];
        const productIndex = this.products.findIndex((p) => p.id === updatedVariant.product_id);
        if (productIndex !== -1) {
          const variantIndex = this.products[productIndex].product_variants.findIndex((v) => v.id === variantId);
          if (variantIndex !== -1) {
            this.products[productIndex].product_variants[variantIndex] = updatedVariant;
          }
        }
      } catch (error) {
        console.error("Error updating variant:", error);
        throw error;
      }
    },

    // حذف کردن یک Variant
    async deleteVariant(variantId: number, productId: number) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("User not authenticated.");

      const url = `${config.public.supabaseUrl}/rest/v1/product_variants?id=eq.${variantId}`;

      try {
        await axios.delete(url, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
          },
        });

        // آپدیت state به صورت آنی
        const productIndex = this.products.findIndex((p) => p.id === productId);
        if (productIndex !== -1) {
          this.products[productIndex].product_variants = this.products[productIndex].product_variants.filter((v) => v.id !== variantId);
        }
      } catch (error) {
        console.error("Error deleting variant:", error);
        throw error;
      }
    },
  },
});
