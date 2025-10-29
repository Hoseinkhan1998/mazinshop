<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue"; // Make sure watch is imported
import { useProductStore } from "~/stores/products";
import { useTypesStore } from "~/stores/types"; // Import typesStore
import type { Product, ProductVariant, NewVariant } from "~/types/Product";
import { useToast } from "~/composables/useToast";

// Accept productId instead of the whole product object
const props = defineProps<{ productId: number }>();

const productStore = useProductStore();
const typesStore = useTypesStore(); // Instantiate typesStore
const { trigger: showToast } = useToast();

const isSubmitting = ref(false);
const editingVariant = ref<ProductVariant | null>(null);
const isEditMode = computed(() => !!editingVariant.value);
const optionsForAttributes = ref<Record<number, string[]>>({});

// --- Key Change: Use computed to get the reactive product from the store ---
const product = computed(() => {
  return productStore.products.find((p) => p.id === props.productId);
});
// ------------------------------------------------------------------------

// Computed property for relevant attributes based on the reactive product
const relevantAttributes = computed(() => {
  if (!product.value) return [];
  const productType = typesStore.types.find((t) => t.id === product.value?.type_id);
  return productType?.attributes || [];
});

const initialFormState = () => ({
  price: 0,
  stock_quantity: 0,
  attributes: {} as Record<string, string>,
});

const variantForm = ref(initialFormState());

onMounted(async () => {
  // Fetch options only if a valid product exists
  if (product.value) {
    optionsForAttributes.value = await typesStore.fetchOptionsForType(product.value.type_id);
  }
});

// Watch for changes in relevantAttributes to pre-fill form keys if needed
watch(
  relevantAttributes,
  (newAttrs) => {
    if (!isEditMode.value) {
      // Only adjust form for new variants
      const newAttributeKeys: Record<string, string> = {};
      newAttrs.forEach((attr) => {
        newAttributeKeys[attr.name] = ""; // Initialize with empty string
      });
      variantForm.value.attributes = newAttributeKeys;
    }
  },
  { immediate: true }
);

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
  // Re-initialize attribute keys based on relevant attributes
  const newAttributeKeys: Record<string, string> = {};
  relevantAttributes.value.forEach((attr) => {
    newAttributeKeys[attr.name] = "";
  });
  variantForm.value = { ...initialFormState(), attributes: newAttributeKeys };
};

const handleDelete = async (variant: ProductVariant) => {
  if (confirm(`آیا از حذف این نسخه مطمئن هستید؟`) && product.value) {
    isSubmitting.value = true;
    try {
      await productStore.deleteVariant(variant.id, product.value.id); // Use product.value.id
      showToast("نسخه با موفقیت حذف شد.", "success");
    } catch (error) {
      showToast("خطا در حذف نسخه.", "error");
    } finally {
      isSubmitting.value = false;
    }
  }
};

const handleSubmit = async () => {
  if (!product.value) return; // Ensure product exists

  const sortedAttributes = Object.fromEntries(Object.entries(variantForm.value.attributes).sort());
  const newVariantAttrsString = JSON.stringify(sortedAttributes);

  const existingVariants = product.value.product_variants || []; // Ensure it's an array

  const isDuplicate = existingVariants.some((variant) => {
    if (isEditMode.value && variant.id === editingVariant.value?.id) return false;
    const existingSortedAttributes = Object.fromEntries(Object.entries(variant.attributes).sort());
    return JSON.stringify(existingSortedAttributes) === newVariantAttrsString;
  });

  if (isDuplicate) {
    showToast("نسخه‌ای با این ویژگی‌های دقیق از قبل برای این محصول وجود دارد.", "error");
    return;
  }

  isSubmitting.value = true;
  try {
    const dataToSend = {
      ...variantForm.value,
      attributes: sortedAttributes,
    };
    if (isEditMode.value && editingVariant.value) {
      await productStore.updateVariant(editingVariant.value.id, dataToSend);
      showToast("نسخه با موفقیت ویرایش شد.", "success");
    } else {
      await productStore.addVariant(product.value.id, dataToSend); // Use product.value.id
      showToast("نسخه جدید با موفقیت اضافه شد.", "success");
    }
    cancelEdit();
  } catch (error) {
    showToast("عملیات با خطا مواجه شد.", "error");
    console.error(error);
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="!p-3 !overflow-y-hidden" v-if="product">
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
  <div v-else class="p-4 text-center text-gray-500">در حال بارگذاری اطلاعات محصول...</div>
</template>
