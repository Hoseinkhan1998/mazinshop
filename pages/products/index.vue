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

const loading = ref(true);

// فیلترهای انتخاب شده: کلید = نام ویژگی، مقدار = آرایه مقادیر انتخاب شده
const selectedFilters = ref<Record<string, string[]>>({});

// گزینه‌های هر ویژگی برای type فعلی (attribute_id -> [values])
const typeOptions = ref<Record<number, string[]>>({});

// ---------- type و سرچ از روی URL ----------
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

// وقتی type در URL عوض شد ⇒ فیلترها ریست و options لود
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

// ---------- Helpers ----------
const formatNumber = (num: number) => {
  return num.toLocaleString("fa-IR");
};

// تابع برای محاسبه و نمایش بازه قیمتی
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

// ---------- محصولات نهایی برای نمایش ----------
const shownProducts = computed<Product[]>(() => {
  let list = productStore.products;

  // اول بر اساس type (اگر هست)
  if (currentTypeId.value) {
    list = list.filter((p) => p.type_id === currentTypeId.value);
  }

  // بعد بر اساس متن سرچ (اگر هست)
  if (hasSearch.value) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter((p) => p.title.toLowerCase().includes(q));
  }

  // اگر type نداریم (یعنی سرچ سراسری بدون دسته) ⇒ اصلاً فیلترهای attribute اعمال نمی‌شوند
  if (!currentTypeId.value) {
    return list;
  }

  // فیلترهای ویژگی‌ها
  const activeFilters = Object.entries(selectedFilters.value).filter(([, values]) => values && values.length > 0);
  if (activeFilters.length === 0) {
    return list;
  }

  // برای هر محصول، اگر حداقل یک variant داشته باشد که تمام فیلترها را پاس کند ⇒ نگه می‌داریم
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

// تغییر تیک فیلترها
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

    <div v-else class="grid grid-cols-12 gap-5">
      <!-- ستون فیلتر -->
      <div class="col-span-3">
        <!-- اگر type نداریم و فقط سرچ هست ⇒ بدون فیلتر -->
        <template v-if="!currentType && hasSearch">
          <h2 class="text-2xl font-semibold mb-2">بدون فیلتر</h2>
          <p class="mt-2 text-sm text-gray-500">نتایج جستجو برای «{{ searchQuery }}»</p>
        </template>

        <!-- اگر type داریم ⇒ فیلترهای معمولی -->
        <template v-else-if="currentType">
          <h2 class="text-2xl font-semibold mb-4">فیلتر محصولات ({{ currentType.typename }})</h2>

          <!-- هر ویژگی مربوط به این type -->
          <div v-for="attr in currentType.attributes" :key="attr.id" class="mb-4 border-b pb-2">
            <p class="font-semibold text-sm mb-2">{{ attr.name }}</p>

            <div class="flex flex-col gap-1 max-h-40 overflow-y-auto">
              <label v-for="opt in typeOptions[attr.id] || []" :key="opt" class="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  :value="opt"
                  :checked="(selectedFilters[attr.name] || []).includes(opt)"
                  @change="(e: any) => toggleFilter(attr.name, opt, e.target.checked)" />
                <span>{{ opt }}</span>
              </label>
            </div>
          </div>

          <!-- دکمه پاک کردن همه فیلترها -->
          <button v-if="Object.values(selectedFilters).some((arr) => arr && arr.length > 0)" class="mt-2 text-xs text-blue-600 hover:underline" @click="selectedFilters = {}">
            پاک کردن همه فیلترها
          </button>
        </template>

        <!-- نه type هست، نه سرچ ⇒ پیام انتخاب دسته‌بندی -->
        <template v-else>
          <h2 class="text-2xl font-semibold mb-4">فیلتر محصولات</h2>
          <div class="text-gray-500 text-sm">لطفاً یک دسته‌بندی از بالا انتخاب کنید.</div>
        </template>
      </div>

      <!-- ستون محصولات -->
      <div class="col-span-9 grid grid-cols-12 gap-4">
        <h1 class="text-3xl font-bold mb-6 col-span-full">
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
</template>
