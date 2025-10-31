// stores/cart.ts
import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { useAuthStore } from "./auth";
import type { Product, ProductVariant } from "~/types/Product";
import axios from "axios";

// اینترفیس آیتم سبد خرید
export interface CartItem {
  variantId: number;
  productId: number;
  quantity: number;
  name: string;
  variantName: string;
  price: number;
  image: string;
  stock: number;
}

const hydrated = ref(false);
const LOCAL_STORAGE_KEY = "mazinshop_cart";

export const useCartStore = defineStore("cart", () => {
  const { $supabase, $config } = useNuxtApp();
  const authStore = useAuthStore();

  // --- STATE ---
  const items = ref<CartItem[]>([]);
  const loading = ref(false); // برای نمایش لودینگ هنگام سینک با دیتابیس

  // --- PRIVATE FUNCTIONS (توابع داخلی) ---

  // ۱. ذخیره در لوکال استوریج
  const _saveToLocalStorage = () => {
    if (import.meta.server) return;
    // فقط بعد از هیدراته شدن و فقط وقتی کاربر لاگین نیست
    if (hydrated.value && !authStore.isLoggedIn) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items.value));
    }
  };

  // ۲. واکشی سبد خرید از دیتابیس
  const _fetchDbCart = async () => {
    if (import.meta.server || !authStore.user) return [];
    const url = `${$config.public.supabaseUrl}/rest/v1/cart_items?select=*,product_variants(price,stock_quantity,attributes,products(id,title,image_urls))`;
    try {
      // توکن را مستقیماً از $supabase می‌گیریم
      const {
        data: { session },
      } = await $supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return [];

      const response = await axios.get(url, {
        headers: {
          apikey: $config.public.supabaseKey,
          Authorization: `Bearer ${token}`,
        },
      });

      // تبدیل داده‌های دیتابیس به فرمت CartItem
      return response.data.map((item: any) => ({
        variantId: item.variant_id,
        productId: item.product_variants.products.id,
        quantity: item.quantity,
        name: item.product_variants.products.title,
        variantName: Object.entries(item.product_variants.attributes)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" - "),
        price: item.product_variants.price,
        image: item.product_variants.products.image_urls[0] || "",
        stock: item.product_variants.stock_quantity,
      }));
    } catch (error) {
      console.error("Error fetching DB cart:", error);
      return [];
    }
  };

  // ۳. افزودن یک آیتم به دیتابیس
  const _addItemToDb = async (variantId: number, quantity: number) => {
    const {
      data: { session },
    } = await $supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("User not authenticated");

    const url = `${$config.public.supabaseUrl}/rest/v1/cart_items`;
    await axios.post(
      url,
      { variant_id: variantId, quantity: quantity },
      {
        headers: {
          apikey: $config.public.supabaseKey,
          Authorization: `Bearer ${token}`,
          Prefer: "return=representation",
        },
      }
    );
  };

  // ۴. آپدیت تعداد در دیتابیس
  const _updateItemQuantityInDb = async (variantId: number, newQuantity: number) => {
    const {
      data: { session },
    } = await $supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("User not authenticated");

    const url = `${$config.public.supabaseUrl}/rest/v1/cart_items?variant_id=eq.${variantId}`;
    await axios.patch(
      url,
      { quantity: newQuantity },
      {
        headers: {
          apikey: $config.public.supabaseKey,
          Authorization: `Bearer ${token}`,
        },
      }
    );
  };

  // ۵. حذف آیتم از دیتابیس
  const _removeItemFromDb = async (variantId: number) => {
    const {
      data: { session },
    } = await $supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("User not authenticated");

    const url = `${$config.public.supabaseUrl}/rest/v1/cart_items?variant_id=eq.${variantId}`;
    await axios.delete(url, {
      headers: {
        apikey: $config.public.supabaseKey,
        Authorization: `Bearer ${token}`,
      },
    });
  };

  // --- PUBLIC ACTIONS (توابع عمومی) ---

  // این تابع باید در پلاگین auth فراخوانی شود
  const initializeCart = async () => {
    if (import.meta.server) return; // فقط کلاینت
    loading.value = true;

    if (authStore.isLoggedIn) {
      items.value = await _fetchDbCart();
    } else {
      const storedCart = localStorage.getItem(LOCAL_STORAGE_KEY);
      try {
        items.value = storedCart ? JSON.parse(storedCart) : [];
      } catch {
        items.value = [];
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }

    loading.value = false;
    hydrated.value = true; // ← خیلی مهم
  };

  // افزودن آیتم (منطق هیبریدی)
  const addItem = async (product: Product, variant: ProductVariant, quantity: number) => {
    const existingItem = items.value.find((item) => item.variantId === variant.id);
    const newQuantity = (existingItem ? existingItem.quantity : 0) + quantity;

    if (newQuantity > variant.stock_quantity) {
      throw new Error("تعداد درخواستی بیشتر از موجودی انبار است.");
    }

    if (authStore.isLoggedIn) {
      loading.value = true;
      try {
        if (existingItem) {
          await _updateItemQuantityInDb(variant.id, newQuantity);
        } else {
          await _addItemToDb(variant.id, newQuantity);
        }
        items.value = await _fetchDbCart(); // بازخوانی سبد خرید از دیتابیس
      } catch (error) {
        console.error("Error adding item to DB:", error);
      } finally {
        loading.value = false;
      }
    } else {
      if (existingItem) {
        existingItem.quantity = newQuantity;
      } else {
        const newItem: CartItem = {
          variantId: variant.id,
          productId: product.id,
          quantity: quantity,
          name: product.title,
          variantName: Object.entries(variant.attributes)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" - "),
          price: variant.price,
          image: product.image_urls[0] || "",
          stock: variant.stock_quantity,
        };
        items.value.push(newItem);
      }
      _saveToLocalStorage();
    }
  };

  // آپدیت تعداد (منطق هیبریدی)
  const updateQuantity = async (variantId: number, newQuantity: number) => {
    const item = items.value.find((i) => i.variantId === variantId);
    if (!item) return;

    if (newQuantity <= 0) {
      await removeItem(variantId);
      return;
    }
    if (newQuantity > item.stock) {
      newQuantity = item.stock;
      throw new Error("تعداد درخواستی بیشتر از موجودی انبار است.");
    }

    item.quantity = newQuantity;
    if (authStore.isLoggedIn) {
      await _updateItemQuantityInDb(variantId, newQuantity);
    } else {
      _saveToLocalStorage();
    }
  };

  // حذف آیتم (منطق هیبریدی)
  const removeItem = async (variantId: number) => {
    items.value = items.value.filter((item) => item.variantId !== variantId);
    if (authStore.isLoggedIn) {
      await _removeItemFromDb(variantId);
    } else {
      _saveToLocalStorage();
    }
  };

  // سینک کردن سبد لوکال با دیتابیس (هنگام لاگین)
  const syncOnLogin = async () => {
    if (import.meta.server) return; // استفاده از import.meta.server
    loading.value = true;
    const localCartRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const localItems: CartItem[] = localCartRaw ? JSON.parse(localCartRaw) : [];

    if (localItems.length > 0) {
      const dbCart = await _fetchDbCart();
      for (const localItem of localItems) {
        const dbItem = dbCart.find((i) => i.variantId === localItem.variantId);
        if (dbItem) {
          let newQty = dbItem.quantity + localItem.quantity;
          if (newQty > localItem.stock) newQty = localItem.stock;
          await _updateItemQuantityInDb(localItem.variantId, newQty);
        } else {
          await _addItemToDb(localItem.variantId, localItem.quantity);
        }
      }
    }
    items.value = await _fetchDbCart();
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    loading.value = false;
  };

  // پاک کردن سبد خرید (هنگام لاگ اوت)
  const clearOnLogout = () => {
    if (import.meta.server) return; // استفاده از import.meta.server
    items.value = [];
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  // --- GETTERS ---
  const totalPrice = computed(() => {
    return items.value.reduce((total, item) => total + item.price * item.quantity, 0);
  });
  const totalItems = computed(() => {
    return items.value.reduce((total, item) => total + item.quantity, 0);
  });

  // --- PERSISTENCE ---
  watch(
    items,
    (newItems) => {
      if (import.meta.server) return;
      if (!hydrated.value) return; // ← جلوِ نوشتنِ زودهنگام رو بگیر
      if (!authStore.isLoggedIn) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newItems));
      }
    },
    { deep: true }
  );

  return {
    items,
    loading,
    totalPrice,
    totalItems,
    initializeCart,
    addItem,
    updateQuantity,
    removeItem,
    syncOnLogin,
    clearOnLogout,
  };
});
