<script setup lang="ts">
import { ref, computed, watchEffect, onMounted } from "vue";
import { useProductStore } from "~/stores/products";
import { useTypesStore } from "~/stores/types";
import type { Product, NewProduct } from "~/types/Product";
import { useToast } from "~/composables/useToast";

const { trigger: showToast } = useToast();

const props = defineProps<{ productToEdit?: Product | null }>();
const emit = defineEmits(["submitted", "cancel"]);

const productStore = useProductStore();
const typesStore = useTypesStore();

const isSubmitting = ref(false);
const isEditMode = computed(() => !!props.productToEdit);

const newFiles = ref<File[]>([]);
const existingImageUrls = ref<string[]>([]);
const previewUrls = ref<{ url: string; isNew: boolean; file?: File }[]>([]);

const form = ref<{ title: string; description: string; type_id: number | null }>({
  title: "",
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
    form.value.title = props.productToEdit.title;
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
  if (previewUrls.value.length + files.length > 8) {
    showToast("شما حداکثر می‌توانید ۸ تصویر انتخاب کنید.", "error");
    return;
  }
  for (const file of files) {
    if (file.size > 300 * 1024) {
      showToast(`حجم فایل "${file.name}" بیشتر از 300 کیلوبایت است.`, "error");
      continue;
    }
    newFiles.value.push(file);
    previewUrls.value.push({
      url: URL.createObjectURL(file),
      isNew: true,
      file: file,
    });
  }
  if (fileInput.value) fileInput.value.value = "";
};

const removeImage = (index: number) => {
  const imageToRemove = previewUrls.value[index];
  if (imageToRemove.isNew) {
    newFiles.value = newFiles.value.filter((f) => f !== imageToRemove.file);
  } else {
    existingImageUrls.value = existingImageUrls.value.filter((url) => url !== imageToRemove.url);
  }
  previewUrls.value.splice(index, 1);
};

// components/AddProductForm.vue -> <script setup>

const handleSubmit = async () => {
  // --- Validation ---
  if (!form.value.title.trim()) {
    showToast("لطفاً عنوان محصول را وارد کنید.", "error");
    return;
  }
  if (!form.value.type_id) {
    showToast("انتخاب نوع محصول الزامی است.", "error");
    return;
  }
  // تغییر اصلی اینجاست: چک می‌کنیم که آرایه پیش‌نمایش خالی نباشد
  if (previewUrls.value.length === 0) {
    showToast("انتخاب حداقل یک تصویر برای محصول الزامی است.", "error");
    return;
  }
  // -----------------

  isSubmitting.value = true;
  try {
    const dataToSend = {
      title: form.value.title,
      description: form.value.description,
      type_id: form.value.type_id,
    };

    if (isEditMode.value && props.productToEdit) {
      const updatedProduct = await productStore.updateProduct(props.productToEdit, dataToSend, newFiles.value, existingImageUrls.value);
      showToast("مشخصات اصلی محصول ویرایش شد!", "success");
      emit("submitted", updatedProduct);
    } else {
      const newProduct = await productStore.addProduct(dataToSend, newFiles.value);
      showToast("محصول پایه با موفقیت اضافه شد!", "success");
      emit("submitted", newProduct);
    }
  } catch (error) {
    showToast("عملیات با خطا مواجه شد.", "error");
    console.error(error);
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="!p-3 !overflow-y-hidden">
    <div class="!p-3 !pt-0 !rounded-xl border-2 border-primarymain border-dashed relative h-[70vh] overflow-y-auto">
      <h2 v-if="isEditMode" class="text-2xl truncate font-semibold mb-6 sticky top-0 bg-white py-4 z-30 text-center">ویرایش مشخصات اصلی</h2>
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
                <v-icon class="!text-white !text-sm">mdi-close</v-icon>
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
          label="نوع محصول"
          variant="outlined"
          :rules="[(v) => !!v || 'انتخاب نوع الزامی است']"
          required
          :disabled="isEditMode && productToEdit && productToEdit.product_variants.length > 0"
          hint="برای تغییر نوع، ابتدا باید تمام نسخه‌های محصول را حذف کنید."
          :persistent-hint="isEditMode && productToEdit && productToEdit.product_variants.length > 0"
          class="mb-4"></v-select>

        <v-text-field
          v-model="form.title"
          density="compact"
          label="عنوان محصول"
          variant="outlined"
          :rules="[(v) => !!v || 'عنوان الزامی است']"
          required
          class="mb-4"></v-text-field>

        <v-textarea v-model="form.description" density="compact" rows="4" label="توضیحات" variant="outlined" class="mb-4"></v-textarea>

        <div class="flex justify-end !space-x-2">
          <v-btn type="button" @click="emit('cancel')">انصراف</v-btn>
          <v-btn type="submit" :loading="isSubmitting" color="primary">
            {{ isEditMode ? "ذخیره تغییرات" : "ادامه (افزودن نسخه‌ها)" }}
          </v-btn>
        </div>
      </form>
    </div>
  </div>
</template>
