<script setup lang="ts">
import { ref, computed, watchEffect, onMounted } from "vue";
import { useProductStore } from "~/stores/products";
import { useTypesStore } from "~/stores/types";
import type { Product, NewProduct } from "~/types/Product";

const props = defineProps<{ productToEdit?: Product | null }>();
const emit = defineEmits(["submitted", "cancel"]);

const productStore = useProductStore();
const typesStore = useTypesStore();

const isSubmitting = ref(false);
const isEditMode = computed(() => !!props.productToEdit);

// State برای مدیریت فایل‌ها
const newFiles = ref<File[]>([]);
const existingImageUrls = ref<string[]>([]);
const previewUrls = ref<{ url: string; isNew: boolean; file?: File }[]>([]);

const form = ref<{ title: string; price: number; description: string; type_id: number | null }>({
  title: "",
  price: 0,
  description: "",
  type_id: null,
});

const fileInput = ref<HTMLInputElement | null>(null);

onMounted(() => {
  if (typesStore.types.length === 0) {
    typesStore.fetchTypes();
  }
});

watchEffect(() => {
  if (isEditMode.value && props.productToEdit) {
    // پر کردن فرم با اطلاعات محصول موجود
    form.value.title = props.productToEdit.title;
    form.value.price = props.productToEdit.price;
    form.value.description = props.productToEdit.description;
    form.value.type_id = props.productToEdit.type_id;
    existingImageUrls.value = [...props.productToEdit.image_urls];
    previewUrls.value = props.productToEdit.image_urls.map((url) => ({ url, isNew: false }));
  }
});

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = Array.from(target.files || []);

  if (!files.length) return;

  // بررسی محدودیت تعداد کل تصاویر
  if (previewUrls.value.length + files.length > 8) {
    alert("شما حداکثر می‌توانید ۸ تصویر انتخاب کنید.");
    return;
  }

  for (const file of files) {
    // بررسی محدودیت حجم هر فایل
    if (file.size > 300 * 1024) {
      // 300 KB
      alert(`حجم فایل "${file.name}" بیشتر از 300 کیلوبایت است.`);
      continue; // این فایل را نادیده بگیر و به سراغ بعدی برو
    }

    newFiles.value.push(file);
    previewUrls.value.push({
      url: URL.createObjectURL(file),
      isNew: true,
      file: file,
    });
  }

  // input را خالی می‌کنیم تا بتوان دوباره همان فایل را انتخاب کرد
  if (fileInput.value) fileInput.value.value = "";
};

const removeImage = (index: number) => {
  const imageToRemove = previewUrls.value[index];
  if (imageToRemove.isNew) {
    // حذف از فایل‌های جدید
    newFiles.value = newFiles.value.filter((f) => f !== imageToRemove.file);
  } else {
    // حذف از URLهای موجود
    existingImageUrls.value = existingImageUrls.value.filter((url) => url !== imageToRemove.url);
  }
  // حذف از لیست پیش‌نمایش
  previewUrls.value.splice(index, 1);
};

const handleSubmit = async () => {
  // --- بخش جدید Validation ---
  if (!form.value.title.trim()) {
    alert("لطفاً عنوان محصول را وارد کنید.");
    return;
  }
  if (!form.value.price || form.value.price <= 0) {
    alert("لطفاً قیمت معتبری برای محصول وارد کنید.");
    return;
  }
  // برای محصول جدید باید حداقل یک فایل جدید انتخاب شده باشد
  // برای محصول در حال ویرایش، باید حداقل یک عکس (قدیمی یا جدید) باقی مانده باشد
  if (previewUrls.value.length === 0) {
    alert("انتخاب حداقل یک تصویر برای محصول الزامی است.");
    return;
  }
  // -------------------------

  isSubmitting.value = true;
  try {
    if (isEditMode.value && props.productToEdit) {
      // حالت ویرایش
      await productStore.updateProduct(props.productToEdit, form.value, newFiles.value, existingImageUrls.value);
      alert("محصول با موفقیت ویرایش شد!");
    } else {
      // حالت افزودن
      await productStore.addProduct(form.value, newFiles.value);
      alert("محصول با موفقیت اضافه شد!");
    }
    emit("submitted");
  } catch (error) {
    alert("عملیات با خطا مواجه شد.");
    console.error(error);
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <ClientOnly>
    <div class="p-4 rounded-xl">
      <h2 v-if="productToEdit" class="text-2xl truncate font-semibold mb-6 text-center">ویرایش {{ productToEdit.title }}</h2>
      <h2 v-else class="text-2xl font-semibold mb-6 text-center">افزودن محصول جدید</h2>
      <form @submit.prevent="handleSubmit">
        <div class="mb-6">
          <label class="block text-gray-500 text-sm mb-2">تصاویر محصول (حداکثر ۸ تصویر، هر کدام تا 300KB)</label>
          <div class="grid grid-cols-4 sm:grid-cols-6 gap-2 justify-items-center">
            <div
              v-if="previewUrls.length < 8"
              @click="fileInput?.click()"
              class="w-20 h-20 flex items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-100">
              <v-icon size="x-large">mdi-image-plus</v-icon>
            </div>
            <div v-for="(image, index) in previewUrls" :key="index" class="relative">
              <img :src="image.url" class="w-24 h-20 object-cover rounded-lg border" />
              <button
                type="button"
                @click="removeImage(index)"
                class="absolute top-0 right-0 -mt-2 -mr-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                <v-icon class=" text-red-600">mdi-delete</v-icon>
              </button>
            </div>
          </div>
          <input type="file" ref="fileInput" @change="handleFileChange" class="hidden" accept="image/*" multiple />
        </div>

        <v-select
          v-model="form.type_id"
          :items="typesStore.types"
          item-title="typename"
          item-value="id"
          density="compact"
          rounded="lg"
          label="نوع محصول"
          variant="outlined"
          :rules="[(v) => !!v || 'انتخاب نوع محصول الزامی است']"
          required
          class="mb-4"></v-select>

        <v-text-field
          v-model="form.title"
          density="compact"
          rounded="lg"
          label="عنوان محصول"
          variant="outlined"
          :rules="[(v) => !!v || 'عنوان محصول الزامی است']"
          required
          class="mb-4"></v-text-field>

        <v-text-field
          v-model="form.price"
          density="compact"
          rounded="lg"
          type="number"
          hide-spin-buttons
          label="قیمت محصول"
          variant="outlined"
          :rules="[(v) => !!v || 'قیمت محصول الزامی است']"
          required
          class="mb-4"></v-text-field>

        <v-textarea v-model="form.description" density="compact" rounded="lg" rows="4" label="توضیحات" variant="outlined" class="mb-4"></v-textarea>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="w-full mybg hov py-2 rounded-lg ">
          {{ isSubmitting ? "در حال ارسال..." : (productToEdit ? 'ویرایش محصول' :'افزودن محصول') }}
        </button>
      </form>
    </div>
  </ClientOnly>
</template>
