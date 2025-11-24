import { defineStore } from "pinia";
import type { Product, NewProduct, ProductVariant, NewVariant } from "~/types/Product";
import axios from "axios";
// import { getSupabaseClient } from "~/utils/supabase";

export const useProductStore = defineStore("product", {
  state: () => ({
    products: [] as Product[],
    currentProductDetails: null as any,

    productsLastFetchedAt: null as number | null,
    productsCacheHydrated: false,
  }),

  actions: {
    async fetchProducts(force: boolean = false) {
      const config = useRuntimeConfig();
      const { $supabase } = useNuxtApp();

      const CACHE_KEY = "mazin_products_cache_v1";
      const CACHE_TTL = 1000 * 60 * 5; // ۵ دقیقه – هر وقت خواستی عوضش کن
      const now = Date.now();

      // --- ۱) فقط یک‌بار: هیدرات از localStorage (سمت کلاینت) ---
      if (import.meta.client && !this.productsCacheHydrated) {
        this.productsCacheHydrated = true;
        try {
          const raw = localStorage.getItem(CACHE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.data)) {
              this.products = parsed.data;
              this.productsLastFetchedAt = parsed.ts || null;
            }
          }
        } catch (e) {
          console.warn("Failed to read products cache:", e);
          localStorage.removeItem(CACHE_KEY);
        }
      }

      const hasFreshEnough = !force && this.products.length > 0 && this.productsLastFetchedAt !== null && now - this.productsLastFetchedAt < CACHE_TTL;

      const fetchFromNetwork = async () => {
        const {
          data: { session },
        } = await $supabase.auth.getSession();
        const token = session?.access_token;

        const url = `${config.public.supabaseUrl}/rest/v1/products?select=*,product_variants(*)`;

        const response = await axios.get(url, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token || config.public.supabaseKey}`,
          },
        });

        const cleanData = response.data.map((product: any) => ({
          ...product,
          product_variants: Array.isArray(product.product_variants) ? product.product_variants : [],
        }));

        this.products = cleanData;
        this.productsLastFetchedAt = Date.now();

        if (import.meta.client) {
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data: cleanData, ts: this.productsLastFetchedAt }));
          } catch (e) {
            console.warn("Failed to write products cache:", e);
          }
        }
      };

      if (hasFreshEnough) {
        fetchFromNetwork().catch((err) => console.error("Background fetchProducts error:", err));
        return;
      }

      await fetchFromNetwork();
    },

    async fetchProductDetails(productId: number) {
      const { $supabase } = useNuxtApp();
      this.currentProductDetails = null; // ریست کردن قبل از واکشی
      try {
        const { data, error } = await $supabase.rpc("get_product_details", {
          p_id: productId,
        });
        if (error) throw error;
        if (data) {
          this.currentProductDetails = data;
        } else {
          // اگر محصولی با این ID پیدا نشد
          console.warn(`Product with ID ${productId} not found.`);
          // اینجا می‌توانید کاربر را به صفحه 404 هدایت کنید
        }
      } catch (error) {
        console.error("Error fetching product details:", error);
        // نمایش خطا به کاربر
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
        const finalProduct: Omit<Product, "id" | "created_at" | "product_variants"> = {
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

        const addedProduct = { ...response.data[0], product_variants: [] };
        this.products.push(addedProduct);
        return addedProduct;
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

        const finalProductData = { ...newData, image_urls: finalImageUrls };

        const url = `${config.public.supabaseUrl}/rest/v1/products?id=eq.${productToUpdate.id}`;
        const response = await axios.patch(url, finalProductData, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
        });

        const updatedProductFromServer = response.data[0];
        const productIndex = this.products.findIndex((p) => p.id === productToUpdate.id);
        if (productIndex !== -1) {
          const updatedProduct = {
            ...this.products[productIndex], // نگه‌داشتن variant های فعلی
            ...updatedProductFromServer, // آپدیت کردن اطلاعات پایه
          };
          this.products[productIndex] = updatedProduct;
          return updatedProduct; // <-- این خط return اضافه شده است
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
      // console.log("DEBUG: Data being sent to addVariant:", JSON.stringify(finalData, null, 2));
      try {
        const response = await axios.post(url, finalData, {
          headers: {
            apikey: config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
        });

        const newVariant = response.data[0];
        const productIndex = this.products.findIndex((p) => p.id === productId);
        if (productIndex !== -1) {
          const product = this.products[productIndex];
          const updatedProduct = {
            ...product,
            product_variants: [...product.product_variants, newVariant],
          };
          this.products[productIndex] = updatedProduct;
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

        // --- تغییر اصلی برای تضمین Reactivity ---
        const updatedVariant = response.data[0];
        const productIndex = this.products.findIndex((p) => p.id === updatedVariant.product_id);
        if (productIndex !== -1) {
          const product = this.products[productIndex];
          const updatedProduct = {
            ...product,
            product_variants: product.product_variants.map((v) => (v.id === variantId ? updatedVariant : v)),
          };
          this.products[productIndex] = updatedProduct;
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

        // --- تغییر اصلی برای تضمین Reactivity ---
        const productIndex = this.products.findIndex((p) => p.id === productId);
        if (productIndex !== -1) {
          const product = this.products[productIndex];
          const updatedProduct = {
            ...product,
            product_variants: product.product_variants.filter((v) => v.id !== variantId),
          };
          this.products[productIndex] = updatedProduct;
        }
      } catch (error) {
        console.error("Error deleting variant:", error);
        throw error;
      }
    },
  },
});
