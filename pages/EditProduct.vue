<script setup lang="ts">
// import { ref, onMounted } from "vue";
import { useProductStore } from "~/stores/products";
import type { Product } from "~/types/Product";
import AddProductForm from "~/components/AddProductForm.vue";
import { useToast } from "~/composables/useToast";

// تعریف middleware برای اطمینان از اینکه فقط ادمین به این صفحه دسترسی دارد
definePageMeta({
  middleware: "admin-auth",
});

const productStore = useProductStore();
const loading = ref(true);
const { trigger: showToast } = useToast();
const dialog = ref(false);
const editingProduct = ref<Product | null>(null);
const deleteDialog = ref(false);
const deleteLoading = ref(false);
const productToDelete = ref<Product | null>(null);

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

const handleDelete = (product: Product) => {
  productToDelete.value = product;
  deleteDialog.value = true;
};

// تابع جدید برای تأیید حذف
const confirmDelete = async () => {
  if (!productToDelete.value) return;
  deleteLoading.value = true;
  try {
    await productStore.deleteProduct(productToDelete.value);
    showToast("محصول با موفقیت حذف شد", "success");
    deleteDialog.value = false;
  } catch (error: any) {
    showToast(error.message, "error");
  } finally {
    deleteLoading.value = false;
    productToDelete.value = null;
  }
};
const formatNumber = (num: number) => {
  return num.toLocaleString("fa-IR");
};
</script>
<template>
  <ClientOnly>
    <div>
      <div v-if="loading" class="text-center">در حال بارگذاری...</div>

      <div v-else class="grid grid-cols-12 gap-5">
        <div class="col-span-3">
          <p class="text-2xl font-semibold">فیلتر محصولات</p>
        </div>
        <div class="col-span-9 grid grid-cols-12 gap-4">
          <h1 class="text-3xl font-bold col-span-full mb-6">مدیریت محصولات</h1>
          <div v-for="product in productStore.products" :key="product.id" class="border col-span-4 rounded-lg shadow-lg overflow-hidden">
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
            <div class="!p-4">
              <h2 class="text-xl font-semibold mb-2">{{ product.title }}</h2>
              <div class="flex items-center justify-between">
                <p class="text-lg font-bold text-green-600">{{ formatNumber(product.price) }} تومان</p>
                <div class="flex items-center gap-2">
                  <button class="!text-sm py-1 !rounded-lg !bg-red-500 hover:!bg-red-600 w-16 text-white" @click="handleDelete(product)">
                    <v-icon class="!text-sm">mdi-delete</v-icon>
                    حذف
                  </button>

                  <button class="!text-sm py-1 mybg hov w-20" @click="openEditDialog(product)">
                    <v-icon class="!text-sm !text-white">mdi-pencil</v-icon>
                    ویرایش
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <v-dialog v-model="dialog" max-width="600px">
        <v-card class="!rounded-xl !p-0">
          <AddProductForm v-if="editingProduct" :product-to-edit="editingProduct" @submitted="closeDialog" @cancel="closeDialog" />
        </v-card>
      </v-dialog>
      <v-dialog v-model="deleteDialog" max-width="500">
        <v-card class="!rounded-xl !p-0" >
          <v-card-title class="d-flex align-center">
            <v-icon color="error" class="ml-2">mdi-alert-circle</v-icon>
            <span>تأیید حذف محصول</span>
          </v-card-title>

          <v-divider></v-divider>

          <v-card-text class="pt-4">
            <p>
              آیا از حذف محصول <strong>"{{ productToDelete?.title }}"</strong> مطمئن هستید؟
            </p>
            <p class="text-caption text-error mt-2">این عمل غیرقابل بازگشت است!</p>
          </v-card-text>

          <v-card-actions class="justify-end">
            <v-btn color="grey" variant="text" @click="deleteDialog = false" :disabled="deleteLoading">انصراف</v-btn>
            <v-btn color="error" variant="flat" @click="confirmDelete" :loading="deleteLoading">حذف</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </ClientOnly>
</template>
