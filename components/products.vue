<template>
  <div class="p-8">
    <h1 class="text-3xl font-bold mb-6">لیست محصولات</h1>

    <div v-if="loading" class="text-center text-gray-500">در حال بارگذاری محصولات...</div>

    <div v-else-if="!productStore.products || productStore.products.length === 0" class="text-center text-gray-500">محصولی برای نمایش وجود ندارد.</div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="product in productStore.products" :key="product.id" class="border rounded-lg shadow-lg flex flex-col">
        <div class="h-48">
          <img v-if="product.image_urls && product.image_urls.length > 0" :src="product.image_urls[0]" class="w-full h-full object-cover rounded-t-lg" alt="تصویر محصول" />
          <div v-else class="w-full h-full bg-gray-200 flex items-center justify-center rounded-t-lg">
            <span class="text-gray-400">بدون تصویر</span>
          </div>
        </div>
        <div class="p-4 flex flex-col flex-grow relative">
          <h2 class="text-xl font-semibold mb-2">{{ product.title }}</h2>
          <p class="text-gray-600 mb-4 text-sm flex-grow">{{ product.description }}</p>
          <p class="text-lg font-bold text-green-600 self-end">{{ product.price }} تومان</p>
        </div>
      </div>
    </div>
  </div>
</template>

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

const handleDelete = async (product: Product) => {
  if (confirm(`آیا از حذف محصول "${product.title}" مطمئن هستید؟`)) {
    await productStore.deleteProduct(product);
  }
};
</script>
