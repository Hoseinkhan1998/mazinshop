<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useProductStore } from "~/stores/products";
import { useTypesStore } from "~/stores/types";
import type { Product, ProductVariant } from "~/types/Product";
import { useToast } from "~/composables/useToast";

const props = defineProps<{ product: Product }>();

const productStore = useProductStore();
const typesStore = useTypesStore();
const { trigger: showToast } = useToast();

const isSubmitting = ref(false);
const editingVariant = ref<ProductVariant | null>(null);
const isEditMode = computed(() => !!editingVariant.value);

// State جدید برای نگهداری آپشن‌های واکشی شده
const optionsForAttributes = ref<Record<number, string[]>>({});

const initialFormState = () => ({
  price: 0,
  stock_quantity: 0,
  attributes: {} as Record<string, string>,
});

const variantForm = ref(initialFormState());

// کامپیوپتد پراپرتی برای گرفتن ویژگی‌های مربوط به "نوع" این محصول
const relevantAttributes = computed(() => {
  const productType = typesStore.types.find((t) => t.id === props.product.type_id);
  return productType?.attributes || [];
});

onMounted(async () => {
  // آپشن‌های مربوط به نوع این محصول را واکشی می‌کنیم
  optionsForAttributes.value = await typesStore.fetchOptionsForType(props.product.type_id);
});

const formatAttributes = (attrs: Record<string, string>): string => {
  return Object.entries(attrs)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" - ");
};

const startEditing = (variant: ProductVariant) => {
  editingVariant.value = variant;
  variantForm.value = {
    price: variant.price,
    stock_quantity: variant.stock_quantity,
    attributes: { ...variant.attributes },
  };
};

const cancelEdit = () => {
  editingVariant.value = null;
  variantForm.value = initialFormState();
};

const handleDelete = async (variant: ProductVariant) => {
  if (confirm(`آیا از حذف این نسخه مطمئن هستید؟`)) {
    isSubmitting.value = true;
    try {
      await productStore.deleteVariant(variant.id, props.product.id);
      showToast("نسخه با موفقیت حذف شد.", "success");
    } catch (error) {
      showToast("خطا در حذف نسخه.", "error");
    } finally {
      isSubmitting.value = false;
    }
  }
};

const handleSubmit = async () => {
  // چک کردن اینکه آیا نسخه‌ای با همین ویژگی‌ها از قبل وجود دارد یا نه
  const newVariantAttrsString = JSON.stringify(variantForm.value.attributes);
  const isDuplicate = props.product.product_variants.some((variant) => {
    // در حالت ویرایش، خود آیتم فعلی را در نظر نمی‌گیریم
    if (isEditMode.value && variant.id === editingVariant.value?.id) return false;
    return JSON.stringify(variant.attributes) === newVariantAttrsString;
  });

  if (isDuplicate) {
    showToast("نسخه‌ای با این ویژگی‌ها از قبل برای این محصول وجود دارد.", "error");
    return;
  }

  isSubmitting.value = true;
  try {
    if (isEditMode.value && editingVariant.value) {
      await productStore.updateVariant(editingVariant.value.id, variantForm.value);
      showToast("نسخه با موفقیت ویرایش شد.", "success");
    } else {
      await productStore.addVariant(props.product.id, variantForm.value);
      showToast("نسخه جدید با موفقیت اضافه شد.", "success");
    }
    cancelEdit();
  } catch (error) {
    showToast("عملیات با خطا مواجه شد.", "error");
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="!p-3 !overflow-y-hidden">
    <div class="!p-3 !rounded-xl border-2 border-primarymain border-dashed max-h-[90vh] overflow-y-auto">
      <h3 class="text-xl font-semibold mb-4 text-center">مدیریت نسخه‌ها برای: {{ product.title }}</h3>

      <v-list v-if="product.product_variants && product.product_variants.length > 0" density="compact">
        <v-list-item v-for="variant in product.product_variants" :key="variant.id" class="border-b">
          <v-list-item-title class="font-semibold">{{ formatAttributes(variant.attributes) }}</v-list-item-title>
          <v-list-item-subtitle>قیمت: {{ variant.price.toLocaleString() }} تومان - موجودی: {{ variant.stock_quantity }} عدد</v-list-item-subtitle>
          <template v-slot:append>
            <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="handleDelete(variant)"></v-btn>
            <v-btn icon="mdi-pencil" variant="text" size="small" @click="startEditing(variant)"></v-btn>
          </template>
        </v-list-item>
      </v-list>
      <p v-else class="text-center text-gray-500 my-4">هنوز هیچ نسخه‌ای برای این محصول تعریف نشده است.</p>

      <v-divider class="my-6"></v-divider>

      <h4 class="font-semibold mb-4">{{ isEditMode ? "ویرایش نسخه" : "افزودن نسخه جدید" }}</h4>
      <form @submit.prevent="handleSubmit">
        <div v-for="attr in relevantAttributes" :key="attr.id" class="mb-4">
          <v-autocomplete
            v-model="variantForm.attributes[attr.name]"
            :items="optionsForAttributes[attr.id] || []"
            :label="attr.name"
            density="compact"
            variant="outlined"
            hide-details
            required
            :rules="[(v) => !!v || `${attr.name} الزامی است`]"></v-autocomplete>
        </div>

        <v-text-field
          v-model.number="variantForm.price"
          label="قیمت (تومان)"
          type="number"
          density="compact"
          variant="outlined"
          hide-details
          required
          class="mb-4"
          :rules="[(v) => v > 0 || 'قیمت باید معتبر باشد']"></v-text-field>

        <v-text-field
          v-model.number="variantForm.stock_quantity"
          label="موجودی انبار"
          type="number"
          density="compact"
          variant="outlined"
          hide-details
          required
          class="mb-4"
          :rules="[(v) => v >= 0 || 'موجودی نمی‌تواند منفی باشد']"></v-text-field>

        <div class="flex justify-end gap-2">
          <v-btn v-if="isEditMode" @click="cancelEdit">انصراف</v-btn>
          <v-btn type="submit" color="primary" :loading="isSubmitting">{{ isEditMode ? "ذخیره تغییرات" : "افزودن نسخه" }}</v-btn>
        </div>
      </form>
    </div>
  </div>
</template>
