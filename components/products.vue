<script setup lang="ts">
// import { computed, onMounted, ref } from "vue";
import { useProductStore } from "~/stores/products";
import { useAuthStore } from "~/stores/auth";
import type { Product } from "~/types/Product";

const productStore = useProductStore();
const authStore = useAuthStore();
const loading = ref(true);

const isAdmin = computed(() => authStore.isAdmin);

onMounted(async () => {
  // اگر محصولات از قبل در store نبودند، آنها را واکشی کن
  if (productStore.products.length === 0) {
    await productStore.fetchProducts();
  }
  loading.value = false;
});

const formatPrice = (price: number) => {
  return price.toLocaleString("fa-IR").replace(/٬/g, "،");
};

const quantities = ref<Record<number, number>>({});
const addToCart = (productId: number) => {
  quantities.value[productId] = 1;
};
const increment = (productId: number) => {
  quantities.value[productId]++;
};
const decrement = (productId: number) => {
  if (quantities.value[productId] > 1) {
    quantities.value[productId]--;
  } else {
    delete quantities.value[productId];
  }
};
const formatNumber = (num: number) => {
  return num.toLocaleString("fa-IR");
};
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
          <div class="h-[40vh] !p-3">
            <img
              v-if="product.image_urls && product.image_urls.length > 0"
              :src="product.image_urls[0]"
              class="w-full h-full bg-center bg-cover object-cover rounded-lg"
              alt="تصویر محصول" />
            <div v-else class="w-full h-full bg-gray-200 flex items-center justify-center rounded-t-lg">
              <span class="text-gray-400">بدون تصویر</span>
            </div>
          </div>
          <div class="!p-4 flex flex-col flex-grow relative">
            <h2 class="text-xl font-semibold mb-2">{{ product.title }}</h2>
            <p class="text-gray-600 mb-4 text-sm flex-grow">{{ product.description }}</p>
            <div class="flex justify-between items-center">
              <p class="text-lg font-bold text-green-600">{{ formatPrice(product.price) }} تومان</p>
              <div>
                <button v-if="!quantities[product.id]" @click="addToCart(product.id)" class="px-3 h-7 mybg hov">افزودن به سبد</button>
                <div v-else class="flex items-center gap-2">
                  <button @click.stop="decrement(product.id)" class="w-7 h-7 mybg hov">-</button>
                  <span>{{ formatNumber(quantities[product.id]) }}</span>
                  <button @click.stop="increment(product.id)" class="w-7 h-7 mybg hov">+</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
