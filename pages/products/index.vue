<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useProductStore } from "~/stores/products";
import type { Product } from "~/types/Product";
import { useTypesStore } from "~/stores/types";

const productStore = useProductStore();
const typesStore = useTypesStore();
const route = useRoute();
const router = useRouter();
const openPanels = ref([]);

const loading = ref(true);

const selectedFilters = ref<Record<string, string[]>>({});

const typeOptions = ref<Record<number, string[]>>({});

const currentTypeId = computed(() => {
  const t = Number(route.query.type);
  return Number.isNaN(t) ? null : t;
});

const currentType = computed(() => {
  if (!currentTypeId.value) return null;
  return typesStore.types.find((t) => t.id === currentTypeId.value) || null;
});

const searchQuery = computed(() => ((route.query.search as string) || "").trim());
const hasSearch = computed(() => searchQuery.value.length > 0);

// ---------- لود اولیه ----------
const ensureTypesLoaded = async () => {
  if (typesStore.types.length === 0) {
    await typesStore.fetchTypes();
  }
};

const ensureProductsLoaded = async () => {
  if (productStore.products.length === 0) {
    await productStore.fetchProducts();
  }
};

const loadTypeOptions = async () => {
  if (!currentTypeId.value) {
    typeOptions.value = {};
    return;
  }
  const options = await typesStore.fetchOptionsForType(currentTypeId.value);
  typeOptions.value = options; // { attribute_id: [values] }
};

onMounted(async () => {
  await ensureTypesLoaded();
  await ensureProductsLoaded();

  // اگر نه سرچ هست و نه type ⇒ برو روی اولین type
  if (!hasSearch.value && !route.query.type && typesStore.types.length > 0) {
    await router.replace({
      path: "/products",
      query: { type: typesStore.types[0].id },
    });
  }

  if (currentTypeId.value) {
    await loadTypeOptions();
  }

  loading.value = false;
});

// وقتی type در URL عوض شد ⇒ فیلترهای ویژگی ریست و options لود
watch(
  () => route.query.type,
  async () => {
    selectedFilters.value = {};
    if (currentTypeId.value) {
      await loadTypeOptions();
    } else {
      typeOptions.value = {};
    }
  }
);

// هر بار که type یا search عوض می‌شود، فیلتر قیمت ریست شود
watch(
  () => [currentTypeId.value, searchQuery.value],
  () => {
    appliedPriceRange.value = null;
  }
);

// ---------- Helpers عمومی ----------
const formatNumber = (num: number | null | undefined) => {
  if (num == null) return "";
  return num.toLocaleString("fa-IR");
};

// نقشه type_id → نام دسته‌بندی
const typeNameMap = computed(() => {
  const m = new Map<number, string>();
  for (const t of typesStore.types) {
    m.set(t.id, t.typename);
  }
  return m;
});

const getTypeName = (product: Product) => {
  return typeNameMap.value.get(product.type_id) || "نامشخص";
};

// تابع برای محاسبه و نمایش بازه قیمتی در کارت محصول
const getPriceRange = (product: Product): string => {
  if (!Array.isArray(product.product_variants) || product.product_variants.length === 0) {
    return "ناموجود";
  }

  if (product.product_variants.length === 1) {
    return `${formatNumber(product.product_variants[0].price)} تومان`;
  }

  const prices = product.product_variants.map((v) => v.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  if (minPrice === maxPrice) {
    return `${formatNumber(minPrice)} تومان`;
  }

  return `از ${formatNumber(minPrice)} تا ${formatNumber(maxPrice)} تومان`;
};

// کمترین قیمت یک محصول (برای مرتب‌سازی و فیلتر)
const getProductMinPrice = (product: Product): number => {
  if (!Array.isArray(product.product_variants) || product.product_variants.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  const prices = product.product_variants.map((v) => v.price).filter((p) => typeof p === "number");
  if (!prices.length) return Number.POSITIVE_INFINITY;
  return Math.min(...prices);
};

// ---------- پروداکت جنریتور (۵۰تایی) برای حالت‌های سرچ ----------

const MAX_PRODUCTS = 50;

const aggregationResult = computed<{
  list: Product[];
  mixed: boolean;
}>(() => {
  if (!hasSearch.value) {
    return { list: [], mixed: false };
  }

  const allProducts = productStore.products;
  if (!allProducts.length) {
    return { list: [], mixed: false };
  }

  const primaryTypeId = currentTypeId.value; // ممکنه null باشه (وقتی فقط سرچ شده)
  const q = searchQuery.value.toLowerCase();

  // تقسیم محصولات به "مچ‌شده" و "غیر مچ" بر اساس type
  const matchesByType = new Map<number, Product[]>();
  const nonMatchesByType = new Map<number, Product[]>();
  const allTypeIdsSet = new Set<number>();

  for (const p of allProducts) {
    const tId = p.type_id as number | null;
    if (!tId) continue;

    allTypeIdsSet.add(tId);

    const matches = p.title.toLowerCase().includes(q);
    const map = matches ? matchesByType : nonMatchesByType;

    const arr = map.get(tId) || [];
    arr.push(p);
    map.set(tId, arr);
  }

  // helper: مرتب‌سازی داخل هر لیست بر اساس جدیدترین (created_at)
  const sortByNewest = (arr: Product[]) =>
    arr.sort((a, b) => {
      const da = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
      const db = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
      return db - da;
    });

  for (const [tid, arr] of matchesByType.entries()) {
    sortByNewest(arr);
  }
  for (const [tid, arr] of nonMatchesByType.entries()) {
    sortByNewest(arr);
  }

  const list: Product[] = [];
  const usedIds = new Set<number>();
  let mixed = false;

  const pushFromList = (items: Product[] | undefined, typeIdForItems?: number) => {
    if (!items) return;

    for (const p of items) {
      if (list.length >= MAX_PRODUCTS) break;
      if (usedIds.has(p.id)) continue;

      // فقط وقتی type مشخص شده (سرچ + دسته) و داریم از دسته‌ی دیگری آیتم می‌آوریم
      if (primaryTypeId && typeIdForItems && typeIdForItems !== primaryTypeId) {
        mixed = true;
      }

      list.push(p);
      usedIds.add(p.id);
    }
  };

  const matchesTypeIds = Array.from(matchesByType.keys());
  const allTypeIds = Array.from(allTypeIdsSet);

  if (primaryTypeId) {
    pushFromList(matchesByType.get(primaryTypeId), primaryTypeId);

    // 2) مچ‌ها در بقیه دسته‌هایی که مچ دارند
    const otherMatchedTypeIds = matchesTypeIds.filter((tid) => tid !== primaryTypeId);
    for (const tid of otherMatchedTypeIds) {
      if (list.length >= MAX_PRODUCTS) break;
      pushFromList(matchesByType.get(tid), tid);
    }

    // 3) غیرمچ‌های دسته انتخاب‌شده
    if (list.length < MAX_PRODUCTS) {
      pushFromList(nonMatchesByType.get(primaryTypeId), primaryTypeId);
    }

    // 4) غیرمچ‌های بقیه دسته‌هایی که مچ داشتند
    if (list.length < MAX_PRODUCTS) {
      for (const tid of otherMatchedTypeIds) {
        if (list.length >= MAX_PRODUCTS) break;
        pushFromList(nonMatchesByType.get(tid), tid);
      }
    }

    // 5) دسته‌هایی که هیچ مچ نداشتند ⇒ هرچی محصول دارند (غیرمچ‌ها)
    if (list.length < MAX_PRODUCTS) {
      const remainingTypeIds = allTypeIds.filter((tid) => tid !== primaryTypeId && !matchesByType.has(tid));

      for (const tid of remainingTypeIds) {
        if (list.length >= MAX_PRODUCTS) break;
        pushFromList(nonMatchesByType.get(tid), tid);
      }
    }
  } else {
    // 1) مچ‌ها در همه دسته‌ها
    for (const tid of matchesTypeIds) {
      if (list.length >= MAX_PRODUCTS) break;
      pushFromList(matchesByType.get(tid), tid);
    }
    // 2) غیرمچ‌های همان دسته‌هایی که مچ داشتند
    if (list.length < MAX_PRODUCTS) {
      for (const tid of matchesTypeIds) {
        if (list.length >= MAX_PRODUCTS) break;
        pushFromList(nonMatchesByType.get(tid), tid);
      }
    }
    // 3) دسته‌هایی که هیچ مچ نداشتند ⇒ همه محصولاتشان
    if (list.length < MAX_PRODUCTS) {
      const remainingTypeIds = allTypeIds.filter((tid) => !matchesByType.has(tid));

      for (const tid of remainingTypeIds) {
        if (list.length >= MAX_PRODUCTS) break;
        pushFromList(nonMatchesByType.get(tid), tid);
      }
    }

    // فقط جهت اطلاع
    const typeSet = new Set<number>();
    for (const p of list) {
      if (p.type_id) typeSet.add(p.type_id);
    }
    mixed = typeSet.size > 1;
  }

  return { list, mixed };
});

// آیا در حالت سرچ + type، مجبور شدیم از چند دسته محصول بیاوریم؟
const hasMixedTypes = computed(() => {
  if (!hasSearch.value || !currentTypeId.value) return false;
  return aggregationResult.value.mixed;
});

const baseProducts = computed<Product[]>(() => {
  const allProducts = productStore.products;
  if (!allProducts.length) return [];

  if (!hasSearch.value) {
    let list = allProducts;

    // فیلتر بر اساس type (دسته انتخاب‌شده از هدر)
    if (currentTypeId.value) {
      list = list.filter((p) => p.type_id === currentTypeId.value);
    }

    // اگر type نداریم، فقط همین لیست را برگردان
    if (!currentTypeId.value) {
      return list;
    }

    // فیلتر ویژگی‌ها
    const activeFilters = Object.entries(selectedFilters.value).filter(([, values]) => values && values.length > 0);
    if (activeFilters.length === 0) {
      return list;
    }

    return list.filter((product) => {
      if (!product.product_variants || product.product_variants.length === 0) return false;

      return product.product_variants.some((variant) => {
        const attrs = variant.attributes as Record<string, string>;
        return activeFilters.every(([attrName, values]) => {
          const vVal = attrs[attrName];
          if (!vVal) return false;
          return (values as string[]).includes(vVal);
        });
      });
    });
  }

  const { list, mixed } = aggregationResult.value;

  // حالت سرچ بدون type ⇒ فقط همون لیست پروداکت‌جنریتور، بدون فیلتر ویژگی
  if (!currentTypeId.value) {
    return list;
  }

  const activeFilters = Object.entries(selectedFilters.value).filter(([, values]) => values && values.length > 0);
  if (mixed || activeFilters.length === 0) {
    return list;
  }

  // اینجا: سرچ + type و همه نتایج از همان type ⇒ می‌توانیم فیلتر ویژگی را اعمال کنیم
  return list.filter((product) => {
    if (!product.product_variants || product.product_variants.length === 0) return false;

    return product.product_variants.some((variant) => {
      const attrs = variant.attributes as Record<string, string>;
      return activeFilters.every(([attrName, values]) => {
        const vVal = attrs[attrName];
        if (!vVal) return false;
        return (values as string[]).includes(vVal);
      });
    });
  });
});

// ---------- فیلتر قیمت (ورودی + اسلایدر + دکمه اعمال) ----------

const sortBy = ref<"newest" | "priceAsc" | "priceDesc" | null>("newest");

const priceRange = ref<[number, number]>([0, 0]);

const appliedPriceRange = ref<[number, number] | null>(null);

const priceStats = computed(() => {
  const products = baseProducts.value;
  let min = Number.POSITIVE_INFINITY;
  let max = 0;

  for (const p of products) {
    if (!Array.isArray(p.product_variants)) continue;
    for (const v of p.product_variants) {
      const price = v.price;
      if (typeof price !== "number") continue;
      if (price < min) min = price;
      if (price > max) max = price;
    }
  }

  if (!Number.isFinite(min)) min = 0;
  if (max < min) max = min;

  return { min, max };
});

watch(
  () => priceStats.value,
  ({ max }) => {
    if (max <= 0) {
      priceRange.value = [0, 0];
      return;
    }

    if (!appliedPriceRange.value) {
      priceRange.value = [0, max];
    } else {
      let [aMin, aMax] = appliedPriceRange.value;
      if (aMax > max) aMax = max;
      if (aMin > aMax) aMin = 0;
      appliedPriceRange.value = [aMin, aMax];
      priceRange.value = [aMin, aMax];
    }
  },
  { immediate: true }
);

// کمک برای تبدیل اعداد فارسی/کاما دار به عدد ساده
const parsePriceInput = (val: string): number => {
  if (!val) return 0;
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  let normalized = "";
  for (const ch of val) {
    const idx = persianDigits.indexOf(ch);
    if (idx >= 0) {
      normalized += String(idx);
    } else if (/[0-9]/.test(ch)) {
      normalized += ch;
    }
  }
  const n = Number(normalized || "0");
  return Number.isNaN(n) ? 0 : n;
};

// رشته‌ی نمایش برای اینپوت‌ها
const minPriceInput = ref("");
const maxPriceInput = ref("");

// وقتی priceRange عوض می‌شود، اینپوت‌ها را با جداکننده سه‌تایی آپدیت کن
watch(
  () => priceRange.value,
  ([min, max]) => {
    minPriceInput.value = formatNumber(min);
    maxPriceInput.value = formatNumber(max);
  },
  { immediate: true }
);

// تبدیل اعداد فارسی کیبورد به انگلیسی برای محاسبه
const toEnglishDigit = (char: string) => {
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  const idx = persianDigits.indexOf(char);
  return idx >= 0 ? String(idx) : char;
};

// اعتبارسنجی دقیق هنگام تایپ (دیوار + تبدیل به سقف)
const validatePriceKeyPress = (e: KeyboardEvent, currentValStr: string, isMinInput: boolean) => {
  const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End"];
  if (allowedKeys.includes(e.key)) return;

  if (!/[0-9\u06F0-\u06F9]/.test(e.key)) {
    e.preventDefault();
    return;
  }

  const max = priceStats.value.max;
  if (max <= 0) return;

  const input = e.target as HTMLInputElement;
  if (input.selectionStart !== input.selectionEnd) return;

  const currentNum = parsePriceInput(currentValStr);
  const newKey = toEnglishDigit(e.key);

  const potentialNumber = Number(String(currentNum) + newKey);

  if (potentialNumber > max) {
    e.preventDefault();

    if (currentNum < max) {
      if (isMinInput) {
        handleMinPriceInput(String(max));
      } else {
        handleMaxPriceInput(String(max));
      }
    }
  }
};

// هندل تغییر اینپوت "از"
const handleMinPriceInput = (val: string) => {
  const maxBound = priceStats.value.max || 0;
  let n = parsePriceInput(val);
  if (n < 0) n = 0;
  if (n > maxBound) n = maxBound;

  const currentMax = priceRange.value[1];
  let newMin = n;
  let newMax = currentMax;

  if (newMin > newMax) {
    newMax = newMin;
  }

  if (newMin === priceRange.value[0] && newMax === priceRange.value[1]) {
    minPriceInput.value = formatNumber(newMin);
    return;
  }

  priceRange.value = [newMin, newMax];
  minPriceInput.value = formatNumber(newMin);
};

// هندل تغییر اینپوت "تا"
const handleMaxPriceInput = (val: string) => {
  const maxBound = priceStats.value.max || 0;
  let n = parsePriceInput(val);
  if (n < 0) n = 0;
  if (n > maxBound) n = maxBound;

  const currentMin = priceRange.value[0];
  let newMin = currentMin;
  let newMax = n;

  if (newMax < newMin) {
    newMin = newMax;
  }

  if (newMin === priceRange.value[0] && newMax === priceRange.value[1]) {
    maxPriceInput.value = formatNumber(newMax);
    return;
  }

  priceRange.value = [newMin, newMax];
  maxPriceInput.value = formatNumber(newMax);
};

// آیا دکمه اعمال محدوده قیمت فعال باشد؟
const canApplyPriceFilter = computed(() => {
  if (!priceStats.value.max || priceStats.value.max <= 0) return false;

  const [curMin, curMax] = priceRange.value;
  if (!appliedPriceRange.value && curMin === 0 && curMax === priceStats.value.max) return false;

  if (appliedPriceRange.value && appliedPriceRange.value[0] === curMin && appliedPriceRange.value[1] === curMax) {
    return false;
  }

  return true;
});

// دکمه "اعمال محدوده قیمت"
const applyPriceFilter = () => {
  const [minVal, maxVal] = priceRange.value;
  if (minVal === 0 && maxVal === priceStats.value.max) {
    appliedPriceRange.value = null;
  } else {
    appliedPriceRange.value = [minVal, maxVal];
  }
};

// حذف فیلتر قیمت
const clearPriceFilter = () => {
  appliedPriceRange.value = null;
  const max = priceStats.value.max || 0;
  priceRange.value = [0, max];
};

// ---------- محصولات نهایی برای نمایش (پایه + فیلتر قیمت + مرتب‌سازی) ----------

const shownProducts = computed<Product[]>(() => {
  let list = baseProducts.value;

  if (appliedPriceRange.value) {
    const [minP, maxP] = appliedPriceRange.value;
    list = list.filter((product) => {
      if (!Array.isArray(product.product_variants) || product.product_variants.length === 0) return false;
      return product.product_variants.some((v) => v.price >= minP && v.price <= maxP);
    });
  }

  const arr = [...list];

  // مرتب‌سازی
  if (sortBy.value === "priceAsc") {
    arr.sort((a, b) => getProductMinPrice(a) - getProductMinPrice(b));
  } else if (sortBy.value === "priceDesc") {
    arr.sort((a, b) => getProductMinPrice(b) - getProductMinPrice(a));
  } else if (sortBy.value === "newest") {
    if (!hasSearch.value) {
      arr.sort((a, b) => {
        const da = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
        const db = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
        return db - da;
      });
    }
  }
  // اگر sortBy = null ⇒ هیچ مرتب‌سا زی اضافه‌ای انجام نمی‌دهیم

  return arr;
});

// ---------- تغییر تیک فیلترهای ویژگی ----------
const toggleFilter = (attrName: string, value: string, checked: boolean) => {
  const current = selectedFilters.value[attrName] || [];
  if (checked) {
    if (!current.includes(value)) {
      selectedFilters.value[attrName] = [...current, value];
    }
  } else {
    selectedFilters.value[attrName] = current.filter((v) => v !== value);
  }
};
</script>

<template>
  <div class="p-8">
    <div v-if="loading" class="text-center text-gray-500">در حال بارگذاری محصولات...</div>

    <div v-else-if="!productStore.products || productStore.products.length === 0" class="text-center text-gray-500">محصولی برای نمایش وجود ندارد.</div>

    <div v-else class="grid grid-cols-12 gap-5 relative">
      <!-- ستون فیلترها -->
      <div class="col-span-3 !sticky !top-36 !self-start">
        <div class="flex items-center mb-6 gap-3">
          <v-icon size="30px">mdi-tune</v-icon>
          <p class="text-2xl font-semibold">فیلترها</p>
        </div>
        <div class="space-y-6 border-2 border-neutral-200 shadow-lg shadow-stone-200 rounded-lg !p-2 bg-neutral-50">
          <!-- مرتب‌سازی (همیشه) -->
          <div class="grid grid-cols-3 items-center gap-2 text-sm">
            <!-- جدیدترین: فقط toggle -->
            <div
              class="flex justify-center items-center border-2 rounded-lg py-2 cursor-pointer transition-colors"
              :class="sortBy === 'newest' ? 'bg-stone-600 text-white border-stone-600' : 'border-neutral-300 hover:bg-neutral-200'"
              @click="sortBy = sortBy === 'newest' ? null : 'newest'">
              جدیدترین
            </div>

            <!-- ارزان‌ترین: مثل رادیو، همیشه اینو فعال می‌کنه -->
            <div
              class="flex justify-center items-center border-2 rounded-lg py-2 cursor-pointer transition-colors"
              :class="sortBy === 'priceAsc' ? 'bg-stone-600 text-white border-stone-600' : 'border-neutral-300 hover:bg-neutral-200'"
              @click="sortBy = sortBy === 'priceAsc' ? null : 'priceAsc'">
              ارزان‌ترین
            </div>

            <!-- گران‌ترین: مثل رادیو، همیشه اینو فعال می‌کنه -->
            <div
              class="flex justify-center items-center border-2 rounded-lg py-2 cursor-pointer transition-colors"
              :class="sortBy === 'priceDesc' ? 'bg-stone-600 text-white border-stone-600' : 'border-neutral-300 hover:bg-neutral-200'"
              @click="sortBy = sortBy === 'priceDesc' ? null : 'priceDesc'">
              گران‌ترین
            </div>
          </div>

          <!-- فیلتر بازه قیمت (همیشه) -->
          <div class="mt-3">
            <h2 class="text-base font-semibold mb-3">محدوده قیمت (تومان)</h2>

            <div v-if="priceStats.max > 0" class="space-y-3 px-3">
              <!-- دو فیلد "از" و "تا" -->
              <div class="flex flex-col gap-2 text-xs">
                <div class="flex items-center gap-2">
                  <v-text-field
                    :model-value="minPriceInput"
                    @update:model-value="handleMinPriceInput"
                    append-inner="sadsd"
                    @keypress="(e) => validatePriceKeyPress(e, minPriceInput, true)"
                    variant="outlined"
                    density="compact"
                    hide-details
                    rounded="lg"
                    class="">
                    <template v-slot:append-inner>
                      <p class="text-black text-xs">تومان</p>
                    </template>
                    <template v-slot:prepend-inner>
                      <p class="text-black pe-3 text-xs">از</p>
                    </template>
                  </v-text-field>
                </div>

                <div class="flex items-center gap-2">
                  <v-text-field
                    :model-value="maxPriceInput"
                    @update:model-value="handleMaxPriceInput"
                    @keypress="(e) => validatePriceKeyPress(e, maxPriceInput, false)"
                    variant="outlined"
                    density="compact"
                    hide-details
                    rounded="lg"
                    class="">
                    <template v-slot:append-inner>
                      <p class="text-black text-xs">تومان</p>
                    </template>
                    <template v-slot:prepend-inner>
                      <p class="text-black pe-3 text-xs">تا</p>
                    </template>
                  </v-text-field>
                </div>
              </div>

              <!-- اسلایدر بازه قیمت -->
              <v-range-slider v-model="priceRange" :min="0" :max="priceStats.max" step="1000" class="mt-2" />
              <div class="!flex justify-between w-full !-mt-5 text-xs items-center">
                <p class="!-ms-3">ارزان‌ترین</p>
                <p class="!-me-3">گران‌ترین</p>
              </div>

              <!-- دکمه اعمال / حذف فیلتر قیمت -->
              <div class="flex items-center gap-2 mt-2">
                <v-btn color="primary" size="small" class="flex-1" :disabled="!canApplyPriceFilter" @click="applyPriceFilter"> اعمال محدوده قیمت </v-btn>
                <button v-if="appliedPriceRange" @click="clearPriceFilter">
                  <v-icon class="text-red-600 !text-2xl">mdi-close-circle</v-icon>
                  <v-tooltip class="!text-xs" activator="parent" location="bottom"><p class="text-xs">پاک کردن فیلتر قیمت</p></v-tooltip>
                </button>
              </div>
            </div>

            <div v-else class="text-xs text-gray-500">فیلتر قیمت برای این نتایج فعال نیست.</div>
          </div>

          <div class="pt-4">
            <!-- اگر type داریم ⇒ فیلترهای ویژگی معمولی -->
            <template v-if="currentType && !hasMixedTypes && !hasSearch">
              <p class="text-lg font-semibold mb-4">فیلترهای دسته بندی {{ currentType.typename }}</p>

              <!-- هر ویژگی مربوط به این type -->
              <div>
                <v-expansion-panels v-model="openPanels" multiple>
                  <v-expansion-panel v-for="attr in currentType.attributes" :key="attr.id">
                    <v-expansion-panel-title class=" !text-lg !font-semibold">
                      {{ attr.name }}
                    </v-expansion-panel-title>

                    <v-expansion-panel-text>
                      <!-- فقط این div محدود + اسکرول‌دار میشه -->
                      <div class="attr-scroll">
                        <label v-for="opt in typeOptions[attr.id] || []" :key="opt" class="flex cursor-pointer text-sm items-center my-1">
                          <input
                            type="checkbox"
                            :value="opt"
                            class="checkbox me-2 !border-2 !p-[2px] !border-neutral-300 rounded-lg bg-indigo-500 checked:border-orange-500 checked:bg-orange-400 checked:text-orange-800"
                            :checked="(selectedFilters[attr.name] || []).includes(opt)"
                            @change="(e: any) => toggleFilter(attr.name, opt, e.target.checked)" />
                          <span>{{ opt }}</span>
                        </label>
                      </div>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>
              </div>
              <!-- دکمه پاک کردن همه فیلترهای ویژگی -->
              <div
                v-if="Object.values(selectedFilters).some((arr) => arr && arr.length > 0)"
                class="flex justify-center transition-all duration-200 items-center border-2 border-dashed mt-3 border-neutral-300 rounded-lg hover:bg-neutral-300">
                <button class="text-sm" @click="selectedFilters = {}">پاک کردن تمام فیلتر ها</button>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- ستون محصولات -->
      <div class="col-span-9">
        <div class="grid grid-cols-12 gap-4">
          <h1 class="text-3xl font-bold mb-2 col-span-full">
            {{ hasSearch ? "نتایج جستجو" : "لیست محصولات" }}
            <span v-if="currentType"> ({{ currentType.typename }})</span>
          </h1>

          <div v-if="shownProducts.length === 0" class="col-span-full text-gray-500">
            {{ hasSearch ? "محصولی مطابق جستجو یافت نشد." : "محصولی با این فیلترها پیدا نشد." }}
          </div>

          <NuxtLink
            v-else
            v-for="product in shownProducts"
            :key="product.id"
            :to="`/products/${product.id}`"
            class="border col-span-4 rounded-lg shadow-lg flex flex-col no-underline text-current hover:shadow-xl transition-shadow duration-200">
            <div class="h-[35vh]">
              <v-carousel
                v-if="product.image_urls && product.image_urls.length > 0"
                height="100%"
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

            <div class="!p-4 flex flex-col flex-grow">
              <h2 class="text-xl font-semibold mb-2 truncate">
                {{ product.title }}
              </h2>
              <!-- دسته‌بندی محصول -->
              <p class="text-xs text-gray-500 mb-2">
                دسته‌بندی:
                <span class="font-medium">
                  {{ getTypeName(product) }}
                </span>
              </p>
              <div class="flex-grow"></div>
              <div class="flex justify-between items-center mt-4">
                <p class="text-lg font-bold text-green-600">
                  {{ getPriceRange(product) }}
                </p>
              </div>
            </div>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.attr-scroll {
  max-height: 200px;
  overflow-y: auto;
  padding-inline-end: 8px;
}
</style>
