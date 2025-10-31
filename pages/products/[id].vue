<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useProductStore } from "~/stores/products";
import type { Product, ProductVariant } from "~/types/Product";
import type { Attribute } from "~/stores/attributes";
import { useTypesStore } from "~/stores/types";
import { useToast } from "~/composables/useToast";
import { useCartStore } from "~/stores/cart";

const cartStore = useCartStore();
const router = useRouter();

const { trigger: showToast } = useToast();
const route = useRoute();
const productStore = useProductStore();
const typesStore = useTypesStore();

const loading = ref(true);
const errorMessage = ref<string | null>(null);

const quantity = ref(1);
const productId = computed(() => Number(route.params.id));
const selectedImageIndex = ref(0);

// انتخاب‌های کاربر برای اتریبیوت‌های متغیر
const selectedOptions = ref<Record<string, string>>({});

// وضعیت CTA: بعد از افزودن کالا، دکمه به «مشاهده سبد خرید» تغییر می‌کند
const addedToCart = ref(false);

// ---------- Fetch ----------
onMounted(() => fetchDetails());
watch(productId, () => fetchDetails());

async function fetchDetails() {
  loading.value = true;
  errorMessage.value = null;
  selectedImageIndex.value = 0;
  selectedOptions.value = {};
  quantity.value = 1;
  addedToCart.value = false;

  if (typesStore.types.length === 0) {
    await typesStore.fetchTypes();
  }

  try {
    await productStore.fetchProductDetails(productId.value);
    const p = product.value;
    if (p && Array.isArray(p.variants) && p.variants.length > 0) {
      const existingForThisProduct = cartStore.items.find((i) => i.productId === p.id);
      if (existingForThisProduct) {
        const match = p.variants.find((v) => v.id === existingForThisProduct.variantId);
        if (match) {
          selectedOptions.value = { ...match.attributes };
          quantity.value = existingForThisProduct.quantity;
        }
      }
    }
    if (!productStore.currentProductDetails?.product) {
      errorMessage.value = "محصول مورد نظر یافت نشد.";
    } else {
      // پیش‌انتخاب اولین وریِنت (در صورت وجود)
      const firstVariant = productStore.currentProductDetails.product.variants?.[0];
      if (firstVariant) {
        selectedOptions.value = { ...firstVariant.attributes };
      }
    }
  } catch (err) {
    errorMessage.value = "خطا در دریافت اطلاعات محصول.";
    console.error(err);
  } finally {
    loading.value = false;
  }
}

// ---------- Computed ----------
const product = computed<Product | null>(() => productStore.currentProductDetails?.product || null);
const typeAttributes = computed<Attribute[]>(() => productStore.currentProductDetails?.type_attributes || []);
const variantOptions = computed<Record<number, string[]>>(() => productStore.currentProductDetails?.options || {}); // اگر جای دیگری استفاده داری، حفظ شده

const productType = computed(() => {
  if (!product.value) return null;
  return typesStore.types.find((t) => t.id === product.value!.type_id) || null;
});

const mainImageUrl = computed(() => {
  return product.value?.image_urls?.[selectedImageIndex.value] || "/images/placeholder.png";
});

const thumbnailImages = computed(() => {
  return product.value?.image_urls || [];
});

// همهٔ وریِنت‌ها به صورت امن
const allVariants = computed<ProductVariant[]>(() => product.value?.variants ?? []);

// یکتاهای هر اتریبیوت بر اساس همهٔ وریِنت‌های این محصول
const uniqueAttributeValues = computed(() => {
  const uniqueValues: Record<string, Set<string>> = {};
  if (!product.value || !product.value.variants) return uniqueValues;

  // نام همهٔ ویژگی‌ها از typeAttributes
  typeAttributes.value.forEach((attr) => {
    uniqueValues[attr.name] = new Set<string>();
  });

  // پر کردن ست‌ها از روی وریِنت‌ها
  product.value.variants.forEach((variant) => {
    Object.entries(variant.attributes).forEach(([key, value]) => {
      if (uniqueValues[key]) uniqueValues[key].add(value);
    });
  });

  return uniqueValues;
});

// دسته‌بندی ویژگی‌ها به ثابت/متغیر
const categorizedAttributes = computed(() => {
  const fixed: { name: string; value: string }[] = [];
  const variable: Attribute[] = [];

  typeAttributes.value.forEach((attr) => {
    const values = uniqueAttributeValues.value[attr.name];
    if (values && values.size === 1) {
      fixed.push({ name: attr.name, value: Array.from(values)[0] });
    } else if (values && values.size > 1) {
      variable.push(attr);
    }
  });
  return { fixed, variable };
});

// با انتخاب‌های فعلی (به‌جز یک اتریبیوت مشخص)، کدام وریِنت‌ها سازگارند؟
function filterVariantsWithPartialSelections(excludeAttr?: string) {
  const partial = { ...selectedOptions.value };
  if (excludeAttr) delete partial[excludeAttr];

  return allVariants.value.filter((v) => Object.entries(partial).every(([k, val]) => v.attributes[k] === val));
}

// فقط گزینه‌های «واقعاً قابل انتخاب» برای یک اتریبیوت (با توجه به انتخاب‌های فعلی سایر اتریبیوت‌ها)
const getAvailableOptionsForAttribute = (attributeName: string): string[] => {
  if (!product.value) return [];
  const compatible = filterVariantsWithPartialSelections(attributeName);
  const set = new Set<string>();
  for (const v of compatible) {
    const val = v.attributes[attributeName];
    if (val) set.add(val);
  }
  return Array.from(set);
};

// وریِنت انتخاب‌شده بر اساس selectedOptions + fixed attributes
const selectedVariant = computed<ProductVariant | null>(() => {
  if (!product.value || !product.value.variants) return null;

  const combinedSelections: Record<string, string> = { ...selectedOptions.value };
  // افزودن fixed attributes
  categorizedAttributes.value.fixed.forEach((attr) => {
    combinedSelections[attr.name] = attr.value;
  });

  // اگر به تعداد همهٔ اتریبیوت‌ها نرسید، هنوز وریِنت قطعی نداریم
  if (Object.keys(combinedSelections).length !== typeAttributes.value.length) return null;

  const selectedKeys = Object.keys(combinedSelections).sort();
  const selectedAttrsString = JSON.stringify(Object.fromEntries(selectedKeys.map((key) => [key, combinedSelections[key]])));

  return (
    product.value.variants.find((variant) => {
      const variantKeys = Object.keys(variant.attributes).sort();
      if (variantKeys.length !== selectedKeys.length) return false;

      const variantAttrsString = JSON.stringify(Object.fromEntries(variantKeys.map((key) => [key, variant.attributes[key]])));
      return variantAttrsString === selectedAttrsString;
    }) || null
  );
});

// قیمت فعلی (null اگر هنوز وریِنت کامل نشده)
const currentPrice = computed<number | null>(() => selectedVariant.value?.price ?? null);

// ---------- Helpers ----------
const formatNumber = (num: number | undefined | null) => (num != null ? num.toLocaleString("fa-IR") : "-");

const selectImage = (index: number) => {
  selectedImageIndex.value = index;
};

const handleOptionChange = (changedAttributeName: string) => {
  for (const attr of typeAttributes.value) {
    const name = attr.name;
    if (name === changedAttributeName) continue;

    const chosen = selectedOptions.value[name];
    if (!chosen) continue;

    const allowed = new Set(getAvailableOptionsForAttribute(name));
    if (!allowed.has(chosen)) {
      delete selectedOptions.value[name];
    }
  }

  if (Object.keys(selectedOptions.value).length === 1) {
    const remainingAttributes = typeAttributes.value.filter((attr) => !selectedOptions.value[attr.name]);
    if (remainingAttributes.length === 1) {
      const remainingAttr = remainingAttributes[0];
      const availableOptions = getAvailableOptionsForAttribute(remainingAttr.name);
      selectedOptions.value[remainingAttr.name] = availableOptions[0] || "";
    }
  }

  const remaining = allVariants.value.filter((v) => Object.entries(selectedOptions.value).every(([k, val]) => v.attributes[k] === val));

  if (remaining.length === 1) {
    const only = remaining[0];
    for (const [k, v] of Object.entries(only.attributes)) {
      if (!selectedOptions.value[k]) {
        selectedOptions.value[k] = v;
      }
    }
  }

  const v = selectedVariant.value;
  if (v) {
    const existing = cartStore.items.find((i) => i.variantId === v.id);
    quantity.value = existing ? existing.quantity : 1;
  } else {
    quantity.value = 1;
  }
  addedToCart.value = false;
};

// ---------- Quantity ----------
const increment = () => {
  if (selectedVariant.value && quantity.value < selectedVariant.value.stock_quantity) {
    quantity.value++;
  } else if (selectedVariant.value) {
    showToast(`حداکثر موجودی این نسخه (${selectedVariant.value.stock_quantity} عدد) در انبار است.`, "error");
  } else {
    quantity.value++;
  }
  // هر تغییری در تعداد ⇒ CTA به حالت افزودن برگردد
  addedToCart.value = false;
};

const decrement = () => {
  if (quantity.value > 1) {
    quantity.value--;
    addedToCart.value = false;
  }
};

// هر تغییری در productId یا تصویر اصلی هم CTA را برمی‌گرداند (سخت‌گیرانه طبق درخواستت)
watch(
  [productId, selectedImageIndex, selectedOptions],
  () => {
    addedToCart.value = false;
  },
  { deep: true }
);

// همچنین اگر selectedOptions تغییر کند (برای هر دلیل دیگری)
watch(
  selectedOptions,
  () => {
    quantity.value = 1;
    addedToCart.value = false;
  },
  { deep: true }
);
watch(
  () => selectedVariant.value,
  (v) => {
    if (!v) return;
    const existing = cartStore.items.find((i) => i.variantId === v.id);
    quantity.value = existing ? existing.quantity : 1;
    addedToCart.value = false; // کاربر دوباره روی CTA تصمیم بگیرد
  }
);

// ---------- CTA behavior ----------
const handleAddToCart = async () => {
  if (!addedToCart.value) {
    if (product.value && selectedVariant.value) {
      try {
        await cartStore.addItem(product.value, selectedVariant.value, quantity.value); // ← await
        showToast("محصول به سبد خرید اضافه شد!", "success");
        addedToCart.value = true;
      } catch (error: any) {
        showToast(error?.message || "خطا در افزودن به سبد خرید", "error");
      }
    } else {
      showToast("لطفاً تمام گزینه‌های محصول را انتخاب کنید.", "error");
    }
  } else {
    router.push("/shoppingcard");
  }
};

// برای سادگی قالب
const primaryCtaLabel = computed(() => {
  if (addedToCart.value) return "مشاهده سبد خرید";
  if (selectedVariant.value && selectedVariant.value.stock_quantity === 0) return "موجود نیست";
  return "افزودن به سبد خرید";
});

const primaryCtaIcon = computed(() => (addedToCart.value ? "mdi-cart" : "mdi-cart-plus"));

const isPrimaryCtaDisabled = computed(() => {
  // اگر قبلاً اضافه شده، باید بتواند به سبد خرید برود، حتی اگر موجودی الان صفر باشد
  if (addedToCart.value) return false;
  // در حالت افزودن: نیاز به وریِنت معتبر و موجودی > 0
  return !selectedVariant.value || selectedVariant.value.stock_quantity === 0;
});
</script>

<template>
  <div>
    <div v-if="loading" class="text-center py-10">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
      <p>در حال بارگذاری اطلاعات محصول...</p>
    </div>

    <div v-else-if="errorMessage" class="text-center py-10 text-red-500">
      <v-alert type="error" prominent>{{ errorMessage }}</v-alert>
    </div>

    <div v-else-if="product" class="grid grid-cols-12 gap-8">
      <!-- Gallery -->
      <div class="col-span-12 md:col-span-4">
        <div class="sticky top-24">
          <v-img :src="mainImageUrl" aspect-ratio="1" cover class="w-full rounded-lg shadow-md border mb-4"></v-img>

          <div v-if="thumbnailImages.length > 1" class="flex flex-wrap gap-2 justify-center">
            <v-img
              v-for="(imgUrl, index) in thumbnailImages"
              :key="index"
              :src="imgUrl"
              aspect-ratio="1"
              cover
              class="w-16 h-16 rounded cursor-pointer border hover:border-primarymain transition-all"
              :class="{ 'border-2 border-primarymain': selectedImageIndex === index }"
              @click="selectImage(index)" />
          </div>
        </div>
      </div>

      <!-- Details -->
      <div class="col-span-12 md:col-span-8">
        <h1 class="text-3xl font-bold mb-4">{{ product.title }}</h1>

        <p v-if="productType" class="text-lg text-gray-500 mb-4">
          دسته بندی: <strong class="text-gray-700">{{ productType.typename }}</strong>
        </p>

        <!-- Fixed & Variable attributes -->
        <div class="space-y-4 mb-6">
          <div v-for="attribute in categorizedAttributes.fixed" :key="attribute.name">
            <p class="text-sm font-medium text-gray-700">
              {{ attribute.name }}: <span class="font-bold">{{ attribute.value }}</span>
            </p>
          </div>

          <div v-for="attribute in categorizedAttributes.variable" :key="attribute.id">
            <v-select
              v-model="selectedOptions[attribute.name]"
              :items="getAvailableOptionsForAttribute(attribute.name)"
              :label="attribute.name"
              variant="outlined"
              density="compact"
              hide-details
              clearable
              @update:modelValue="handleOptionChange(attribute.name)" />
          </div>
        </div>

        <!-- Price -->
        <div class="mb-6">
          <p class="text-2xl font-bold text-green-600">
            <span v-if="currentPrice !== null">{{ formatNumber(currentPrice) }} تومان</span>
            <span v-else-if="product.variants && product.variants.length > 0" class="text-slate-500"> لطفاً گزینه‌های محصول را انتخاب کنید </span>
            <span v-else class="text-red-600">ناموجود</span>
          </p>
        </div>

        <!-- Quantity -->
        <div class="my-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">تعداد:</label>
          <div class="flex items-center">
            <v-btn icon="mdi-plus" size="small" :disabled="!selectedVariant || (selectedVariant && quantity >= selectedVariant.stock_quantity)" @click="increment" />
            <span class="mx-4 text-xl font-semibold w-8 text-center">{{ formatNumber(quantity) }}</span>
            <v-btn icon="mdi-minus" size="small" @click="decrement" :disabled="quantity <= 1" />
          </div>
        </div>

        <!-- Primary CTA -->
        <v-btn color="primary" size="large" class="w-full md:w-auto" :disabled="isPrimaryCtaDisabled" :prepend-icon="primaryCtaIcon" @click="handleAddToCart">
          {{ primaryCtaLabel }}
        </v-btn>

        <p v-if="!addedToCart && selectedVariant && selectedVariant.stock_quantity < 10 && selectedVariant.stock_quantity > 0" class="text-orange-600 text-sm mt-2">
          فقط {{ formatNumber(selectedVariant.stock_quantity) }} عدد در انبار باقی مانده!
        </p>
        <p v-else-if="!addedToCart && selectedVariant && selectedVariant.stock_quantity === 0" class="text-red-600 text-sm mt-2">موجودی انبار تمام شده است.</p>

        <v-divider class="my-8"></v-divider>

        <!-- Description -->
        <div>
          <h2 class="text-xl font-semibold mb-3">توضیحات محصول</h2>
          <p class="text-gray-700 leading-relaxed">
            {{ product.description || "توضیحاتی برای این محصول ارائه نشده است." }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
