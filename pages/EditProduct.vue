<script setup lang="ts">
// import { ref, onMounted } from "vue";
import { useProductStore } from "~/stores/products";
import type { Product } from "~/types/Product";
import AddProductForm from "~/components/AddProductForm.vue";

// تعریف middleware برای اطمینان از اینکه فقط ادمین به این صفحه دسترسی دارد
definePageMeta({
  middleware: "admin-auth",
});

const productStore = useProductStore();
const loading = ref(true);

const dialog = ref(false);
const editingProduct = ref<Product | null>(null);

// واکشی محصولات در زمان بارگذاری صفحه
onMounted(async () => {
  if (productStore.products.length === 0) {
    await productStore.fetchProducts();
  }
  loading.value = false;
});

// تابع برای باز کردن دیالوگ ویرایش
const openEditDialog = (product: Product) => {
  editingProduct.value = { ...product }; // یک کپی از محصول برای ویرایش
  dialog.value = true;
};

// تابع برای بستن دیالوگ
const closeDialog = () => {
  dialog.value = false;
  editingProduct.value = null;
};

// تابع برای حذف محصول
const handleDelete = async (product: Product) => {
  if (confirm(`آیا از حذف محصول "${product.title}" مطمئن هستید؟`)) {
    await productStore.deleteProduct(product);
  }
};
</script>
<template>
  <ClientOnly>
    <div>
      <h1 class="text-3xl font-bold mb-6">مدیریت محصولات</h1>

      <div v-if="loading" class="text-center">در حال بارگذاری...</div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="product in productStore.products" :key="product.id" class="border rounded-lg shadow-lg overflow-hidden">
          <div class="h-48">
            <img v-if="product.image_urls && product.image_urls.length > 0" :src="product.image_urls[0]" class="w-full h-full object-cover rounded-t-lg" alt="تصویر محصول" />
            <div v-else class="w-full h-full bg-gray-200 flex items-center justify-center rounded-t-lg">
              <span class="text-gray-400">بدون تصویر</span>
            </div>
          </div>
          <div class="p-4">
            <h2 class="text-xl font-semibold mb-2">{{ product.title }}</h2>
            <p class="text-lg font-bold text-green-600 mb-4">{{ product.price }} تومان</p>
            <div class="flex justify-end space-x-2">
              <v-btn size="small" color="error" @click="handleDelete(product)">حذف</v-btn>
              <v-btn size="small" color="primary" @click="openEditDialog(product)">ویرایش</v-btn>
            </div>
          </div>
        </div>
      </div>

      <v-dialog v-model="dialog" max-width="600px">
        <v-card class="!rounded-xl !p-0">
            <AddProductForm v-if="editingProduct" :product-to-edit="editingProduct" @submitted="closeDialog" @cancel="closeDialog" />
        </v-card>
      </v-dialog>
    </div>
  </ClientOnly>
</template>
