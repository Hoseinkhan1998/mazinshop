<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { Product } from "~/types/Product";
import { useTypesStore } from "~/stores/types";
import { useGlobalLoading } from "~/composables/useGlobalLoading";

type SortMode = "newest" | "priceAsc" | "priceDesc" | null;

const typesStore = useTypesStore();
const route = useRoute();
const router = useRouter();

const { isGlobalLoading, setGlobalLoading } = useGlobalLoading();
const firstLoadDone = ref(false);
setGlobalLoading(true);
const productsLoading = ref(false); // لود محصولات از API
const statsLoading = ref(false); // لود min/max قیمت از API

// ---------- UI State ----------
const openPanels = ref<any[]>([]);
const selectedFilters = ref<Record<string, string[]>>({});
const typeOptions = ref<Record<number, string[]>>({}); // { attribute_id: [values] }

const sortBy = ref<SortMode>("newest");

// قیمت
const priceRange = ref<[number, number]>([0, 0]); // مقدار لحظه‌ای slider/input
const appliedPriceRange = ref<[number, number] | null>(null); // مقدار اعمال‌شده (برای request)
const minPriceInput = ref("");
const maxPriceInput = ref("");

// نتایج API
const shownProducts = ref<Product[]>([]);
const mixedFromServer = ref(false);

// stats از DB (بدون اعمال فیلتر قیمت)
const priceStatsRaw = ref<{ min: number; max: number }>({ min: 0, max: 0 });
const priceStats = computed(() => priceStatsRaw.value);

// ---------- Derived from Route ----------
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

// چون دیگر mixing نداریم (سرچ + دسته فقط همان دسته را می‌آورد)
const hasMixedTypes = computed(() => {
  if (!hasSearch.value || !currentTypeId.value) return false;
  return mixedFromServer.value;
});

// ---------- Helpers ----------
const formatNumber = (num: number | null | undefined) => {
  if (num == null) return "";
  return num.toLocaleString("fa-IR");
};

const parsePriceInput = (val: string): number => {
  if (!val) return 0;
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  let normalized = "";
  for (const ch of val) {
    const idx = persianDigits.indexOf(ch);
    if (idx >= 0) normalized += String(idx);
    else if (/[0-9]/.test(ch)) normalized += ch;
  }
  const n = Number(normalized || "0");
  return Number.isNaN(n) ? 0 : n;
};

const toEnglishDigit = (char: string) => {
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  const idx = persianDigits.indexOf(char);
  return idx >= 0 ? String(idx) : char;
};

// فقط max-bound برای اعتبارسنجی (مثل نسخه قبلی)
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
      if (isMinInput) handleMinPriceInput(String(max));
      else handleMaxPriceInput(String(max));
    }
  }
};

const handleMinPriceInput = (val: string) => {
  const maxBound = priceStats.value.max || 0;
  let n = parsePriceInput(val);
  if (n < 0) n = 0;
  if (n > maxBound) n = maxBound;

  const currentMax = priceRange.value[1];
  let newMin = n;
  let newMax = currentMax;

  if (newMin > newMax) newMax = newMin;

  priceRange.value = [newMin, newMax];
  minPriceInput.value = formatNumber(newMin);
};

const handleMaxPriceInput = (val: string) => {
  const maxBound = priceStats.value.max || 0;
  let n = parsePriceInput(val);
  if (n < 0) n = 0;
  if (n > maxBound) n = maxBound;

  const currentMin = priceRange.value[0];
  let newMin = currentMin;
  let newMax = n;

  if (newMax < newMin) newMin = newMax;

  priceRange.value = [newMin, newMax];
  maxPriceInput.value = formatNumber(newMax);
};

// ---------- Type name (category) helpers ----------
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

// ---------- Price helpers (card) ----------
const getPriceRange = (product: Product): string => {
  const variants = (product as any)?.product_variants;

  if (!Array.isArray(variants) || variants.length === 0) return "ناموجود";

  const prices = variants.map((v: any) => Number(v?.price)).filter((p: number) => Number.isFinite(p));

  if (prices.length === 0) return "ناموجود";

  const minPrice = Math.min(...prices);
  // طبق همون منطق قبلی: فقط کمترین قیمت را نشان بده
  return `${formatNumber(minPrice)} تومان`;
};

// ---------- Filters (attributes) ----------
const toggleFilter = (attrName: string, value: string, checked: boolean) => {
  const current = selectedFilters.value[attrName] || [];
  if (checked) {
    if (!current.includes(value)) selectedFilters.value[attrName] = [...current, value];
  } else {
    selectedFilters.value[attrName] = current.filter((v) => v !== value);
  }
};

const activeFilters = computed(() => {
  return Object.fromEntries(Object.entries(selectedFilters.value).filter(([, values]) => values && values.length > 0));
});

const activeFiltersKey = computed(() => JSON.stringify(activeFilters.value));

// ---------- API: Abort + Debounce ----------
let productsAbort: AbortController | null = null;
let statsAbort: AbortController | null = null;

let productsTimer: ReturnType<typeof setTimeout> | null = null;
let statsTimer: ReturnType<typeof setTimeout> | null = null;

const PRODUCTS_DEBOUNCE_MS = 250;
const STATS_DEBOUNCE_MS = 250;

const buildProductsParams = () => {
  const params = new URLSearchParams();

  if (currentTypeId.value) params.set("type", String(currentTypeId.value));
  if (hasSearch.value) params.set("search", searchQuery.value);

  if (sortBy.value) params.set("sort", sortBy.value);

  if (appliedPriceRange.value) {
    params.set("minPrice", String(appliedPriceRange.value[0]));
    params.set("maxPrice", String(appliedPriceRange.value[1]));
  }

  const af = activeFilters.value;
  if (Object.keys(af).length) params.set("filters", JSON.stringify(af));

  params.set("limit", "50");
  params.set("offset", "0");

  return params;
};

const buildStatsParams = () => {
  const params = new URLSearchParams();

  if (currentTypeId.value) params.set("type", String(currentTypeId.value));
  if (hasSearch.value) params.set("search", searchQuery.value);

  const af = activeFilters.value;
  if (Object.keys(af).length) params.set("filters", JSON.stringify(af));

  return params;
};

const fetchProductsFromApi = async () => {
  // abort request قبلی
  if (productsAbort) productsAbort.abort();
  productsAbort = new AbortController();

  productsLoading.value = true;
  try {
    const params = buildProductsParams();
    const res = await $fetch<{ products: Product[]; mixed?: boolean }>(`/api/products?${params.toString()}`, {
      signal: productsAbort.signal,
    });
    shownProducts.value = res.products || [];
    mixedFromServer.value = !!res.mixed;
  } catch (err: any) {
    // اگر abort شد، خطا نگیریم
    if (err?.name !== "AbortError") {
      console.error("fetchProductsFromApi error:", err);
    }
  } finally {
    productsLoading.value = false;
  }
};

const fetchPriceStatsFromApi = async () => {
  if (statsAbort) statsAbort.abort();
  statsAbort = new AbortController();

  statsLoading.value = true;
  try {
    const params = buildStatsParams();
    const res = await $fetch<{ min: number; max: number }>(`/api/products/stats?${params.toString()}`, {
      signal: statsAbort.signal,
    });

    const min = Number(res.min ?? 0);
    const max = Number(res.max ?? 0);
    priceStatsRaw.value = {
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : 0,
    };
  } catch (err: any) {
    if (err?.name !== "AbortError") {
      console.error("fetchPriceStatsFromApi error:", err);
    }
  } finally {
    statsLoading.value = false;
  }
};

const scheduleFetchProducts = (immediate = false) => {
  if (productsTimer) clearTimeout(productsTimer);
  if (immediate) {
    fetchProductsFromApi();
    return;
  }
  productsTimer = setTimeout(() => {
    fetchProductsFromApi();
  }, PRODUCTS_DEBOUNCE_MS);
};

const scheduleFetchStats = (immediate = false) => {
  if (statsTimer) clearTimeout(statsTimer);
  if (immediate) {
    fetchPriceStatsFromApi();
    return;
  }
  statsTimer = setTimeout(() => {
    fetchPriceStatsFromApi();
  }, STATS_DEBOUNCE_MS);
};

const scheduleFetchAll = (immediate = false) => {
  scheduleFetchStats(immediate);
  scheduleFetchProducts(immediate);
};

// ---------- Types + Options ----------
const ensureTypesLoaded = async () => {
  if (typesStore.types.length === 0) {
    await typesStore.fetchTypes();
  }
};

const loadTypeOptions = async () => {
  if (!currentTypeId.value) {
    typeOptions.value = {};
    return;
  }
  const options = await typesStore.fetchOptionsForType(currentTypeId.value);
  typeOptions.value = options;
};

// ---------- Price range syncing with stats ----------
watch(
  () => priceStats.value,
  ({ max }) => {
    if (max <= 0) {
      priceRange.value = [0, 0];
      minPriceInput.value = "0";
      maxPriceInput.value = "0";
      appliedPriceRange.value = null;
      return;
    }

    // clamp applied range با max جدید
    if (appliedPriceRange.value) {
      let [aMin, aMax] = appliedPriceRange.value;
      if (aMin < 0) aMin = 0;
      if (aMax > max) aMax = max;
      if (aMin > aMax) aMin = 0;
      appliedPriceRange.value = [aMin, aMax];
      priceRange.value = [aMin, aMax];
    } else {
      // default: 0..max
      priceRange.value = [0, max];
    }

    minPriceInput.value = formatNumber(priceRange.value[0]);
    maxPriceInput.value = formatNumber(priceRange.value[1]);
  },
  { immediate: true }
);

// وقتی priceRange عوض می‌شود، اینپوت‌ها آپدیت شود
watch(
  () => priceRange.value,
  ([min, max]) => {
    minPriceInput.value = formatNumber(min);
    maxPriceInput.value = formatNumber(max);
  }
);

// ---------- Apply/Clear price filter ----------
const canApplyPriceFilter = computed(() => {
  if (!priceStats.value.max || priceStats.value.max <= 0) return false;

  const [curMin, curMax] = priceRange.value;

  if (!appliedPriceRange.value && curMin === 0 && curMax === priceStats.value.max) return false;
  if (appliedPriceRange.value && appliedPriceRange.value[0] === curMin && appliedPriceRange.value[1] === curMax) return false;

  return true;
});

const applyPriceFilter = () => {
  const [minVal, maxVal] = priceRange.value;
  if (minVal === 0 && maxVal === priceStats.value.max) {
    appliedPriceRange.value = null;
  } else {
    appliedPriceRange.value = [minVal, maxVal];
  }
  // با debounce (پروژه حرفه‌ای)
  scheduleFetchProducts(false);
};

const clearPriceFilter = () => {
  appliedPriceRange.value = null;
  const max = priceStats.value.max || 0;
  priceRange.value = [0, max];
  scheduleFetchProducts(false);
};

// ---------- Route watchers ----------
watch(
  () => route.query.type,
  async () => {
    // با تغییر type: فیلترهای ویژگی ریست + options جدید
    selectedFilters.value = {};
    openPanels.value = [];

    // price filter ریست
    appliedPriceRange.value = null;

    await loadTypeOptions();
    scheduleFetchAll(true);
  }
);

// با تغییر سرچ: فیلتر قیمت ریست (مثل قبل)
watch(
  () => searchQuery.value,
  () => {
    appliedPriceRange.value = null;
    scheduleFetchAll(false);
  }
);

// با تغییر sort / price-applied => محصولات باید دوباره از API بیایند
watch(
  () => [sortBy.value, appliedPriceRange.value],
  () => {
    scheduleFetchProducts(false);
  },
  { deep: true }
);

// با تغییر فیلترهای ویژگی: هم stats و هم products باید آپدیت شوند
watch(
  () => activeFiltersKey.value,
  () => {
    appliedPriceRange.value = null; // حرفه‌ای‌تر: چون stats عوض می‌شود، قیمت اعمال‌شده را ریست کن
    scheduleFetchAll(false);
  }
);

// ---------- Initial load ----------
onMounted(async () => {
  setGlobalLoading(true);
  await ensureTypesLoaded();

  // اگر نه سرچ داریم و نه type ⇒ برو روی اولین type
  if (!hasSearch.value && !route.query.type && typesStore.types.length > 0) {
    await router.replace({
      path: "/products",
      query: { type: typesStore.types[0].id },
    });
  }

  await loadTypeOptions();

  // اولین fetch (بدون debounce)
  await Promise.all([fetchPriceStatsFromApi(), fetchProductsFromApi()]);
  firstLoadDone.value = true;
  setGlobalLoading(false);
});

// ---------- Smart Sticky Sidebar Logic ----------
const sidebarRef = ref<HTMLElement | null>(null);
const sidebarTop = ref(144);
let lastScrollY = 0;

const handleScroll = () => {
  const sidebarEl = sidebarRef.value;
  if (!sidebarEl) return;

  const currentScrollY = window.scrollY;
  const sidebarHeight = sidebarEl.offsetHeight;
  const windowHeight = window.innerHeight;

  const headerOffset = 144;
  const bottomPadding = 20;

  if (sidebarHeight < windowHeight - headerOffset) {
    sidebarTop.value = headerOffset;
    lastScrollY = currentScrollY;
    return;
  }

  const delta = currentScrollY - lastScrollY;
  let newTop = sidebarTop.value - delta;

  const maxTop = headerOffset;
  const minTop = windowHeight - sidebarHeight - bottomPadding;

  if (newTop > maxTop) newTop = maxTop;
  if (newTop < minTop) newTop = minTop;

  sidebarTop.value = newTop;
  lastScrollY = currentScrollY;
};

onMounted(() => {
  if (typeof window !== "undefined") {
    lastScrollY = window.scrollY;
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
  }
});

onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("scroll", handleScroll);
    window.removeEventListener("resize", handleScroll);
  }

  // cleanup timers + aborts
  if (productsTimer) clearTimeout(productsTimer);
  if (statsTimer) clearTimeout(statsTimer);
  if (productsAbort) productsAbort.abort();
  if (statsAbort) statsAbort.abort();
});
</script>

<template>
  <div class="p-8">
    <div v-if="!firstLoadDone" class="w-full h-[80vh] flex items-center justify-center">
      <AppLoader />
    </div>

    <div v-else class="grid grid-cols-12 gap-5 relative">
      <!-- ستون فیلترها -->
      <div class="col-span-3">
        <div ref="sidebarRef" class="sticky transition-all duration-75 ease-linear" :style="{ top: sidebarTop + 'px' }">
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
                      <v-expansion-panel-title class="!text-lg !font-semibold">
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
      </div>

      <!-- ستون محصولات -->
      <div class="col-span-9">
        <div class="grid grid-cols-12 gap-4">
          <h1 class="text-3xl font-bold mb-2 col-span-full">
            {{ hasSearch ? "نتایج جستجو" : "لیست محصولات" }}
            <span v-if="currentType"> ({{ currentType.typename }})</span>
          </h1>
          
          <template v-if="shownProducts.length > 0">
            <NuxtLink            
              v-for="product in shownProducts"
              :key="product.id"
              :to="`/products/${product.id}`"
              class="card card-compact bg-base-100 shadow-lg hover:!shadow-3xl shadow-neutral-200 border-[1px] border-neutral-200 !rounded-lg transition-all duration-300 cursor-pointer group col-span-4 no-underline text-current relative overflow-hidden">
              <div
                class="absolute top-0 right-0 w-1/4 h-1/4 border-t-[2px] border-r-[2px] border-yellow-500 rounded-tr-lg group-hover:rounded-lg rounded-bl-lg pointer-events-none z-10 transition-all duration-500 ease-out group-hover:w-full group-hover:h-full"></div>
              <figure class="h-[35vh] overflow-hidden relative rounded-t-lg">
                <img
                  :src="product.image_urls?.[0] || '/placeholder.png'"
                  :alt="product.title"
                  class="w-full h-full object-cover transition-all duration-700 ease-in-out group-hover:scale-110"
                  :class="{ 'group-hover:opacity-0': product.image_urls?.length > 1 }" />

                <img
                  v-if="product.image_urls?.length > 1"
                  :src="product.image_urls[1]"
                  :alt="product.title"
                  class="absolute inset-0 w-full h-full object-cover transition-all duration-500 ease-in-out opacity-0 group-hover:!opacity-100 group-hover:scale-110" />
              </figure>

              <div class="!p-3">
                <h2 class="text-gray-800 line-clamp-2 h-12">
                  {{ product.title }}
                </h2>

                <div class="flex items-center gap-2 mt-1">
                  <span class="text-gray-500 text-xs"> دسته بندی: {{ getTypeName(product) }} </span>
                </div>
                <div class="card-actions justify-end items-center">
                  <span class="text-primary text-xl font-bold">
                    {{ getPriceRange(product) }}
                  </span>
                </div>
              </div>
              <div
                class="absolute bottom-0 left-0 w-1/4 h-1/4 border-b-[2px] border-l-[2px] border-yellow-500 rounded-bl-lg rounded-tr-lg group-hover:rounded-lg pointer-events-none z-10 transition-all duration-500 ease-out group-hover:w-full group-hover:h-full"></div>
            </NuxtLink>
          </template>
          <div v-else class="col-span-full text-center py-20 text-gray-500">
            {{ hasSearch ? "محصولی مطابق جستجو یافت نشد." : "محصولی با این فیلترها پیدا نشد." }}
          </div>
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
