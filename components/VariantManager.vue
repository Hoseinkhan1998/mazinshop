<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from "vue";
import { useProductStore } from "~/stores/products";
import { useTypesStore } from "~/stores/types";
import type { ProductVariant } from "~/types/Product";
import { useToast } from "~/composables/useToast";
import type { VForm } from "vuetify/components";

const props = defineProps<{ productId: number }>();

const productStore = useProductStore();
const typesStore = useTypesStore();
const { trigger: showToast } = useToast();

const isSubmitting = ref(false);
const editingVariant = ref<ProductVariant | null>(null);
const isEditMode = computed(() => !!editingVariant.value);

const optionsForAttributes = ref<Record<number, string[]>>({});

const product = computed(() => productStore.products.find((p) => p.id === props.productId));

const relevantAttributes = computed(() => {
  if (!product.value) return [];
  const productType = typesStore.types.find((t) => t.id === product.value?.type_id);
  return productType?.attributes || [];
});

const initialFormState = () => ({
  price: 0,
  stock_quantity: 0,
  attributes: {} as Record<string, string>,
  discount_percent: 0 as number,
  discounted_price: null as number | null,
  pin_to_home_discount: false,
});

const variantForm = ref(initialFormState());

// ------------------------
// ✅ UI input states (for live thousand separators)
// ------------------------
const priceInput = ref<string>("");
const discountPercentInput = ref<string>(""); // فقط عدد 0..100
const discountedPriceInput = ref<string>("");

const lastDiscountEdited = ref<"percent" | "discounted">("percent");

// helpers
const digitsOnly = (s: string) => (s || "").toString().replace(/[^\d]/g, "");
const parseNumber = (s: string): number | null => {
  const d = digitsOnly(s);
  if (!d) return null;
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
};
const formatNumber = (n: number) => {
  if (!Number.isFinite(n)) return "";
  return Math.max(0, Math.trunc(n)).toLocaleString("en-US"); // سه‌رقمی
};
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const discountsDisabled = computed(() => !variantForm.value.price || variantForm.value.price <= 0);

// sync functions (بدون شکستن قوانین)
const applyFromPercent = () => {
  if (discountsDisabled.value) return;

  const price = variantForm.value.price;
  const percent = clamp(Number(variantForm.value.discount_percent || 0), 0, 100);

  variantForm.value.discount_percent = percent;
  discountPercentInput.value = percent === 0 ? "" : String(percent);

  if (percent === 0) {
    variantForm.value.discounted_price = null;
    discountedPriceInput.value = "";
    return;
  }

  const discounted = Math.round((price * (100 - percent)) / 100);
  const safeDiscounted = clamp(discounted, 0, price);

  variantForm.value.discounted_price = safeDiscounted;
  discountedPriceInput.value = formatNumber(safeDiscounted);
};

const applyFromDiscounted = () => {
  if (discountsDisabled.value) return;

  const price = variantForm.value.price;
  const discounted = variantForm.value.discounted_price;

  if (discounted == null) {
    variantForm.value.discount_percent = 0;
    discountPercentInput.value = "";
    return;
  }

  const safeDiscounted = clamp(discounted, 0, price);
  variantForm.value.discounted_price = safeDiscounted;
  discountedPriceInput.value = formatNumber(safeDiscounted);

  const percent = price > 0 ? Math.round(((price - safeDiscounted) / price) * 100) : 0;
  const safePercent = clamp(percent, 0, 100);

  variantForm.value.discount_percent = safePercent;
  discountPercentInput.value = safePercent === 0 ? "" : String(safePercent);

  // اگر قیمت پس از تخفیف == قیمت اصلی شد، تخفیف رو خنثی کن (اختیاری ولی تمیز)
  if (safeDiscounted === price) {
    variantForm.value.discount_percent = 0;
    discountPercentInput.value = "";
    variantForm.value.discounted_price = null;
    discountedPriceInput.value = "";
  }
};

// input handlers
const onPriceInput = (val: string) => {
  const n = parseNumber(val);

  if (n == null) {
    priceInput.value = "";
    variantForm.value.price = 0;

    // پاک کردن تخفیف‌ها چون قیمت نداریم
    variantForm.value.discount_percent = 0;
    discountPercentInput.value = "";
    variantForm.value.discounted_price = null;
    discountedPriceInput.value = "";
    return;
  }

  const safe = Math.max(0, Math.trunc(n));
  variantForm.value.price = safe;
  priceInput.value = formatNumber(safe);

  // وقتی قیمت عوض شد، تخفیف‌ها رو دوباره با آخرین منبع تغییر sync کن
  nextTick(() => {
    if (lastDiscountEdited.value === "percent") applyFromPercent();
    else applyFromDiscounted();
  });
};

const onDiscountPercentInput = (val: string) => {
  lastDiscountEdited.value = "percent";

  if (discountsDisabled.value) {
    discountPercentInput.value = "";
    variantForm.value.discount_percent = 0;
    return;
  }

  const n = parseNumber(val);
  if (n == null) {
    discountPercentInput.value = "";
    variantForm.value.discount_percent = 0;
    variantForm.value.discounted_price = null;
    discountedPriceInput.value = "";
    return;
  }

  const safe = clamp(Math.trunc(n), 0, 100);
  variantForm.value.discount_percent = safe;
  discountPercentInput.value = safe === 0 ? "" : String(safe);

  applyFromPercent();
};

const onDiscountedPriceInput = (val: string) => {
  lastDiscountEdited.value = "discounted";

  if (discountsDisabled.value) {
    discountedPriceInput.value = "";
    variantForm.value.discounted_price = null;
    return;
  }

  const n = parseNumber(val);
  if (n == null) {
    discountedPriceInput.value = "";
    variantForm.value.discounted_price = null;
    variantForm.value.discount_percent = 0;
    discountPercentInput.value = "";
    return;
  }

  const price = variantForm.value.price;
  const safe = clamp(Math.trunc(n), 0, price);

  variantForm.value.discounted_price = safe;
  discountedPriceInput.value = formatNumber(safe);

  applyFromDiscounted();
};

// ✅ اگر تخفیف حذف شد یا نامعتبر بود، تیک "نمایش در صفحه اول" هم برداشته شود
watch(
  () => [variantForm.value.discount_percent, variantForm.value.discounted_price],
  ([percent, discounted]) => {
    if (!percent || Number(percent) <= 0 || discounted == null) {
      variantForm.value.pin_to_home_discount = false;
    }
  }
);

// ------------------------
// existing code
// ------------------------
const formatAttributes = (attrs: Record<string, string>): string => {
  return Object.entries(attrs)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" - ");
};

onMounted(async () => {
  if (product.value) {
    optionsForAttributes.value = await typesStore.fetchOptionsForType(product.value.type_id);
  }
});

watch(
  relevantAttributes,
  (newAttrs) => {
    if (!isEditMode.value) {
      const newAttributeKeys: Record<string, string> = {};
      newAttrs.forEach((attr) => {
        newAttributeKeys[attr.name] = "";
      });
      variantForm.value.attributes = newAttributeKeys;
    }
  },
  { immediate: true }
);

const formRef = ref<VForm | null>(null);

const startEditing = (variant: ProductVariant) => {
  editingVariant.value = variant;

  // اطمینان از اینکه تمام کلیدهای ویژگی‌ها وجود دارند (حتی اگر در نسخه ذخیره شده نباشند)
  const initializedAttributes: Record<string, string> = {};
  relevantAttributes.value.forEach((attr) => {
    initializedAttributes[attr.name] = "";
  });

  variantForm.value = {
    price: Number(variant.price) || 0,
    stock_quantity: Number(variant.stock_quantity) || 0,
    attributes: { ...initializedAttributes, ...variant.attributes },
    discount_percent: Number((variant as any).discount_percent ?? 0) || 0,
    discounted_price: (variant as any).discounted_price != null ? Number((variant as any).discounted_price) : null,
    pin_to_home_discount: !!(variant as any).pin_to_home_discount,
  };

  // پر کردن ورودی‌های نمایشی
  priceInput.value = variantForm.value.price ? formatNumber(variantForm.value.price) : "";
  if (variantForm.value.discount_percent > 0) {
    discountPercentInput.value = String(variantForm.value.discount_percent);
  } else {
    discountPercentInput.value = "";
  }
  if (variantForm.value.discounted_price != null) {
    discountedPriceInput.value = formatNumber(variantForm.value.discounted_price);
  } else {
    discountedPriceInput.value = "";
  }

  // اگر یکی از این دو پر بود، منبع sync را همان قرار بده
  if (variantForm.value.discounted_price != null) lastDiscountEdited.value = "discounted";
  else lastDiscountEdited.value = "percent";

  nextTick(() => {
    formRef.value?.validate();
  });
};

const cancelEdit = () => {
  editingVariant.value = null;

  const newAttributeKeys: Record<string, string> = {};
  relevantAttributes.value.forEach((attr) => {
    newAttributeKeys[attr.name] = "";
  });

  variantForm.value = { ...initialFormState(), attributes: newAttributeKeys, pin_to_home_discount: false };

  // ریست ورودی‌ها
  priceInput.value = "";
  discountPercentInput.value = "";
  discountedPriceInput.value = "";
  lastDiscountEdited.value = "percent";
  nextTick(() => {
    formRef.value?.resetValidation();
  });
};

const handleDelete = async (variant: ProductVariant) => {
  if (confirm(`آیا از حذف این نسخه مطمئن هستید؟`) && product.value) {
    isSubmitting.value = true;
    try {
      await productStore.deleteVariant(variant.id, product.value.id);
      showToast("نسخه با موفقیت حذف شد.", "success");
    } catch (error) {
      showToast("خطا در حذف نسخه.", "error");
    } finally {
      isSubmitting.value = false;
    }
  }
};

const validateAndDuplicate = async () => {
  const { valid } = (await formRef.value?.validate()) || { valid: false };
  if (!valid) return;
  if (!product.value) return;

  // جلوگیری از duplicate variant فقط بر اساس attributes (مثل قبل)
  const sortedAttributes = Object.fromEntries(Object.entries(variantForm.value.attributes).sort());
  const newVariantAttrsString = JSON.stringify(sortedAttributes);

  const existingVariants = product.value.product_variants || [];
  const isDuplicate = existingVariants.some((variant) => {
    const existingSortedAttributes = Object.fromEntries(Object.entries(variant.attributes).sort());
    return JSON.stringify(existingSortedAttributes) === newVariantAttrsString;
  });

  if (isDuplicate) {
    showToast("نسخه‌ای با این ویژگی‌های دقیق از قبل برای این محصول وجود دارد.", "error");
    return false;
  }
  return true;
};
const handleDuplicate = async () => {
  const { valid } = (await formRef.value?.validate()) || { valid: false };
  if (!valid) return;
  if (!product.value) return;

  isSubmitting.value = true;
  try {
    const isValidToDuplicate = await validateAndDuplicate();
    if (!isValidToDuplicate) return;

    const dataToSend = {
      ...variantForm.value,
      discount_percent: variantForm.value.discount_percent || 0,
      discounted_price: variantForm.value.discounted_price != null ? Number(variantForm.value.discounted_price) : null,
    };
    await productStore.addVariant(product.value.id, dataToSend);
    cancelEdit();
    showToast("نسخه جدید با موفقیت اضافه شد.", "success");
  } catch (error) {
    showToast("عملیات با خطا مواجه شد.", "error");
  } finally {
    isSubmitting.value = false;
  }
};

const handleSubmit = async () => {
  const { valid } = (await formRef.value?.validate()) || { valid: false };
  if (!valid) return;
  if (!product.value) return;

  // جلوگیری از duplicate variant فقط بر اساس attributes (مثل قبل)
  const sortedAttributes = Object.fromEntries(Object.entries(variantForm.value.attributes).sort());
  const newVariantAttrsString = JSON.stringify(sortedAttributes);

  const existingVariants = product.value.product_variants || [];
  const isDuplicate = existingVariants.some((variant) => {
    if (isEditMode.value && variant.id === editingVariant.value?.id) return false;
    const existingSortedAttributes = Object.fromEntries(Object.entries(variant.attributes).sort());
    return JSON.stringify(existingSortedAttributes) === newVariantAttrsString;
  });

  if (isDuplicate) {
    showToast("نسخه‌ای با این ویژگی‌های دقیق از قبل برای این محصول وجود دارد.", "error");
    return;
  }

  const price = Number(variantForm.value.price) || 0;
  let percent = clamp(Number(variantForm.value.discount_percent || 0), 0, 100);
  let discounted = variantForm.value.discounted_price != null ? Number(variantForm.value.discounted_price) : null;

  if (!price || price <= 0) {
    percent = 0;
    discounted = null;
  } else {
    if (discounted != null) discounted = clamp(discounted, 0, price);
    if (percent === 0) discounted = null;
    if (discounted === price) {
      percent = 0;
      discounted = null;
    }
    // اگر discounted پر بود ولی percent 0 شد، دوباره percent بساز
    if (discounted != null && percent === 0) {
      percent = Math.round(((price - discounted) / price) * 100);
      percent = clamp(percent, 0, 100);
      if (percent === 0) discounted = null;
    }
  }

  isSubmitting.value = true;
  try {
    const wantsPin = !!variantForm.value.pin_to_home_discount;
    const dataToSend = {
      ...variantForm.value,
      attributes: sortedAttributes,
      discount_percent: percent,
      discounted_price: discounted,
      pin_to_home_discount: wantsPin ? false : false,
    };

    if (isEditMode.value && editingVariant.value) {
      await productStore.updateVariant(editingVariant.value.id, dataToSend);

      if (wantsPin) {
        await productStore.setHomeDiscountPinnedVariant(editingVariant.value.id);
        await productStore.fetchProducts(true); // برای اینکه UI هم آپدیت شود
      } else {
      }

      showToast("نسخه با موفقیت ویرایش شد.", "success");
    } else {
      const created = await productStore.addVariant(product.value.id, dataToSend);

      if (wantsPin && created?.id) {
        await productStore.setHomeDiscountPinnedVariant(created.id);
        await productStore.fetchProducts(true);
      }

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
    <div class="!p-3 !pt-0 !rounded-xl border-2 relative border-primarymain border-dashed h-[70vh] overflow-y-auto">
      <h3 class="text-xl font-semibold py-6 sticky top-0 bg-white z-20 text-center">مدیریت نسخه‌ها برای: {{ product.title }}</h3>

      <v-list v-if="product.product_variants && product.product_variants.length > 0" density="compact">
        <v-list-item v-for="variant in product.product_variants" :key="variant.id" class="border-b">
          <v-list-item-title class="font-semibold">{{ formatAttributes(variant.attributes) }}</v-list-item-title>
          <v-list-item-subtitle class="flex flex-wrap items-center gap-2">
            <span> قیمت: {{ Number(variant.price).toLocaleString("fa-IR") }} تومان - موجودی: {{ variant.stock_quantity }} عدد </span>

            <!-- ✅ badge تخفیف -->
            <v-chip v-if="Number((variant as any).discount_percent || 0) > 0" color="red" variant="flat" class="!h-6 !text-xs !px-2">
              {{ Number((variant as any).discount_percent || 0).toLocaleString("fa-IR") }}٪ تخفیف
            </v-chip>

            <!-- ✅ قیمت پس از تخفیف -->
            <span v-if="(variant as any).discounted_price != null && Number((variant as any).discount_percent || 0) > 0" class="text-xs font-bold text-red-600">
              قیمت جدید: {{ Number((variant as any).discounted_price).toLocaleString("fa-IR") }} تومان
            </span>
          </v-list-item-subtitle>

          <template v-slot:append>
            <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="handleDelete(variant)"></v-btn>
            <v-btn icon="mdi-pencil" variant="text" size="small" @click="startEditing(variant)"></v-btn>
          </template>
        </v-list-item>
      </v-list>
      <p v-else class="text-center text-gray-500 my-4">هنوز هیچ نسخه‌ای برای این محصول تعریف نشده است.</p>

      <v-divider class="my-6"></v-divider>

      <h4 class="font-semibold mb-4">{{ isEditMode ? "ویرایش نسخه" : "افزودن نسخه جدید" }}</h4>
      <v-form ref="formRef" @submit.prevent="handleSubmit">
        <div v-for="attr in relevantAttributes" :key="attr.id" class="mb-4">
          <v-autocomplete
            v-model="variantForm.attributes[attr.name]"
            :items="optionsForAttributes[attr.id] || []"
            :label="attr.name"
            density="compact"
            variant="outlined"
            hide-details
            required
            :rules="[(v) => !!v || `${attr.name} الزامی است`]">
          </v-autocomplete>
        </div>

        <!-- ✅ Price with thousand separator -->
        <v-text-field
          :model-value="priceInput"
          @update:modelValue="onPriceInput"
          label="قیمت اصلی (تومان)"
          inputmode="numeric"
          type="text"
          density="compact"
          variant="outlined"
          hide-details
          required
          class="mb-4"
          :rules="[(v) => (!!variantForm.price && variantForm.price > 0) || 'قیمت باید معتبر باشد']">
        </v-text-field>

        <!-- ✅ Discount hint -->
        <div class="flex items-center gap-2">
          <div class="text-xs text-neutral-500 mb-2 font-semibold">در صورت داشتن تخفیف، فیلدهای زیر را تکمیل کنید:</div>
          <div class="text-gray-600 !-mt-2">
            <v-icon>mdi-information-outline</v-icon>
            <v-tooltip class="!text-[4px]" activator="parent" location="bottom">تخفیف بالای 40 درصد آیکون 🔥 میگیرد</v-tooltip>
          </div>
        </div>
        <!-- ✅ discount percent & discounted price row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <v-text-field
            :model-value="discountPercentInput"
            @update:modelValue="onDiscountPercentInput"
            label="درصد تخفیف (۰ تا ۱۰۰)"
            inputmode="numeric"
            type="text"
            density="compact"
            variant="outlined"
            hide-details
            :disabled="discountsDisabled"></v-text-field>

          <v-text-field
            :model-value="discountedPriceInput"
            @update:modelValue="onDiscountedPriceInput"
            label="قیمت پس از تخفیف (تومان)"
            inputmode="numeric"
            type="text"
            density="compact"
            variant="outlined"
            hide-details
            :disabled="discountsDisabled"></v-text-field>
        </div>
        <div class="flex items-center gap-3 mb-3">
          <v-checkbox
            v-model="variantForm.pin_to_home_discount"
            label="نمایش در صفحه اول"
            color="primary"
            density="compact"
            hide-details
            :disabled="!variantForm.discounted_price || !(variantForm.discount_percent > 0)" />

          <p class="text-xs text-neutral-500">(فقط یک نسخه از هر محصول می‌تواند انتخاب شود.)</p>
        </div>
        <v-text-field
          v-model.number="variantForm.stock_quantity"
          label="موجودی انبار"
          type="number"
          density="compact"
          variant="outlined"
          hide-details
          required
          class="mb-4"
          :rules="[(v) => v >= 0 || 'موجودی نمی‌تواند منفی باشد']">
        </v-text-field>

        <div class="flex justify-between">
          <div class="flex gap-2">
            <v-btn v-if="isEditMode" @click="handleDuplicate" color="success" :loading="isSubmitting">ذخیره به عنوان نسخه جدید</v-btn>
          </div>
          <div class="flex items-center gap-3">
            <v-btn v-if="isEditMode" @click="cancelEdit">انصراف</v-btn>
            <v-btn type="submit" color="primary" :loading="isSubmitting">
              {{ isEditMode ? "ذخیره تغییرات" : "افزودن نسخه" }}
            </v-btn>
          </div>
        </div>
      </v-form>
    </div>
  </div>
  <div v-else class="p-4 text-center text-gray-500">در حال بارگذاری اطلاعات محصول...</div>
</template>
