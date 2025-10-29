<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useProductStore } from "~/stores/products";
import type { Product } from "~/types/Product";
import AddProductForm from "~/components/AddProductForm.vue";
import VariantManager from "~/components/VariantManager.vue";
import { useToast } from "~/composables/useToast";

definePageMeta({
  middleware: "admin-auth",
});

const productStore = useProductStore();
const { trigger: showToast } = useToast();

const loading = ref(true);
const editDialog = ref(false);
const deleteDialog = ref(false);
const deleteLoading = ref(false);
const tab = ref<"details" | "variants">("details");

const editingProductId = ref<number | null>(null);

const editingProduct = computed(() => {
  if (!editingProductId.value) return null;
  return productStore.products.find((p) => p.id === editingProductId.value);
});

const productToDelete = ref<Product | null>(null);

onMounted(async () => {
  await productStore.fetchProducts();
  loading.value = false;
});

// حالا این تابع فقط شناسه را تنظیم می‌کند
const openEditDialog = (product: Product) => {
  editingProductId.value = product.id;
  editDialog.value = true;
};

const closeEditDialog = () => {
  editDialog.value = false;
  setTimeout(() => {
    editingProductId.value = null;
    tab.value = "details";
  }, 300);
};

// این تابع دیگر نیازی به آپدیت دستی editingProduct ندارد چون computed است
const handleProductUpdate = (updatedProduct: Product) => {
  tab.value = "variants";
};

const openDeleteDialog = (product: Product) => {
  productToDelete.value = product;
  deleteDialog.value = true;
};

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
</script>

<template>
  <ClientOnly>
    <div>
      <div v-if="loading" class="text-center">در حال بارگذاری...</div>
      <div v-else>
        <h1 class="text-3xl font-bold mb-6">مدیریت محصولات فروشگاه</h1>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div v-for="product in productStore.products" :key="product.id" class="border rounded-lg shadow-lg flex flex-col">
            <div class="h-48">
              <v-carousel
                v-if="product.image_urls && product.image_urls.length > 0"
                height="192"
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

            <div class="p-4 flex flex-col flex-grow">
              <h2 class="text-xl font-semibold mb-2 truncate">{{ product.title }}</h2>
              <p class="text-gray-500 text-sm mb-4">تعداد نسخه‌ها: {{ product.product_variants.length }}</p>
              <div class="flex-grow"></div>
              <div class="flex justify-end space-x-2 mt-4">
                <v-btn size="small" color="error" variant="tonal" @click="openDeleteDialog(product)">حذف</v-btn>
                <v-btn size="small" color="primary" variant="flat" @click="openEditDialog(product)">مدیریت</v-btn>
              </div>
            </div>
          </div>
        </div>
      </div>

      <v-dialog v-model="editDialog" max-width="700px" persistent>
        <v-card class="!p-0 !rounded-xl">
          <v-tabs v-model="tab" bg-color="primary" grow>
            <v-tab value="details">مشخصات اصلی</v-tab>
            <v-tab value="variants">نسخه‌ها و قیمت</v-tab>
          </v-tabs>

          <v-window v-model="tab">
            <v-window-item value="details">
              <AddProductForm v-if="editingProduct" :product-to-edit="editingProduct" @submitted="handleProductUpdate" @cancel="closeEditDialog" />
            </v-window-item>
            <v-window-item value="variants">
              <VariantManager v-if="editingProduct" :product-id="editingProduct.id" />
            </v-window-item>
          </v-window>

          <v-card-actions class="bg-grey-lighten-4">
            <v-spacer></v-spacer>
            <v-btn color="blue-darken-1" variant="text" @click="closeEditDialog">بستن</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-dialog v-model="deleteDialog" max-width="500">
        <v-card class="!rounded-xl !p-0">
          <v-card-title class="d-flex align-center">
            <v-icon color="error" class="ml-2">mdi-alert-circle</v-icon>
            <span>تأیید حذف محصول</span>
          </v-card-title>
          <v-divider></v-divider>
          <v-card-text class="pt-4">
            <p>
              آیا از حذف محصول <strong>"{{ productToDelete?.title }}"</strong> مطمئن هستید؟
            </p>
            <p class="text-caption text-error mt-2">این عمل تمام نسخه‌های زیرمجموعه آن را نیز حذف خواهد کرد و غیرقابل بازگشت است!</p>
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
