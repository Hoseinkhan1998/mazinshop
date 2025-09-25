<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useProductStore } from "~/stores/products";
import type { Product } from "~/types/Product";

const productStore = useProductStore();
const loading = ref(true);

onMounted(async () => {
  if (productStore.products.length === 0) {
    await productStore.fetchProducts();
  }
  loading.value = false;
});

const formatNumber = (num: number) => {
  return num.toLocaleString("fa-IR");
};

// تابع جدید برای محاسبه و نمایش بازه قیمتی
const getPriceRange = (product: Product): string => {
  if (!product.product_variants || product.product_variants.length === 0) {
    return "ناموجود";
  }
  if (product.product_variants.length === 1) {
    return `${formatNumber(product.product_variants[0].price)} تومان`;
  }

  const prices = product.product_variants.map((v) => v.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  if (minPrice === maxPrice) {
    return `${formatNumber(minPrice)} تومان`;
  }

  return `از ${formatNumber(minPrice)} تا ${formatNumber(maxPrice)} تومان`;
};

// --- منطق موقت سبد خرید ---
const quantities = ref<Record<number, number>>({});

const getFirstVariantId = (product: Product): number => {
  return product.product_variants?.[0]?.id || 0;
};

const addToCart = (variantId: number) => {
  if (variantId > 0) {
    quantities.value[variantId] = 1;
  }
};
const increment = (variantId: number) => {
  if (variantId > 0) {
    quantities.value[variantId]++;
  }
};
const decrement = (variantId: number) => {
  if (quantities.value[variantId] > 1) {
    quantities.value[variantId]--;
  } else {
    delete quantities.value[variantId];
  }
};
// -----------------------------
</script>

<template>
  <div class="p-8">
    <div v-if="loading" class="text-center text-gray-500">در حال بارگذاری محصولات...</div>

    <div v-else-if="!productStore.products || productStore.products.length === 0" class="text-center text-gray-500">محصولی برای نمایش وجود ندارد.</div>

    <div v-else class="grid grid-cols-12 gap-5">
      <div class="col-span-3">
        <p class="text-2xl font-semibold">فیلتر محصولات</p>
      </div>
      <div class="col-span-9 grid grid-cols-12 gap-4">
        <h1 class="text-3xl font-bold mb-6 col-span-full">لیست محصولات</h1>
        <div v-for="product in productStore.products" :key="product.id" class="border col-span-4 rounded-lg shadow-lg flex flex-col">
          <div class="h-[35vh]">
            <v-carousel
              v-if="product.image_urls && product.image_urls.length > 0"
              height="100%"
              :show-arrows="product.image_urls.length > 1 ? 'hover' : false"
              hide-delimiters
              cycle
              class="rounded-t-lg">
              <v-carousel-item v-for="(imageUrl, i) in product.image_urls" :key="i" :src="imageUrl" cover></v-carousel-item>
            </v-carousel>
            <div v-else class="w-full h-full bg-gray-200 flex items-center justify-center rounded-t-lg">
              <span class="text-gray-400">بدون تصویر</span>
            </div>
          </div>

          <div class="!p-4 flex flex-col flex-grow">
            <h2 class="text-xl font-semibold mb-2 truncate">{{ product.title }}</h2>
            <div class="flex-grow"></div>
            <div class="flex justify-between items-center mt-4">
              <p class="text-lg font-bold text-green-600">{{ getPriceRange(product) }}</p>

              <div>
                <button v-if="!quantities[getFirstVariantId(product)]" @click="addToCart(getFirstVariantId(product))" class="px-3 h-8 mybg hov rounded-md text-white text-sm">
                  افزودن به سبد
                </button>
                <div v-else class="flex items-center gap-2">
                  <button @click="decrement(getFirstVariantId(product))" class="w-8 h-8 mybg hov rounded-md text-white">-</button>
                  <span class="font-semibold w-4 text-center">{{ formatNumber(quantities[getFirstVariantId(product)]) }}</span>
                  <button @click="increment(getFirstVariantId(product))" class="w-8 h-8 mybg hov rounded-md text-white">+</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
