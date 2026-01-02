<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTypesStore } from "~/stores/types";
import { useProductStore } from "~/stores/products";

const route = useRoute();
const router = useRouter();
const typesStore = useTypesStore();
const productStore = useProductStore();
const searchContainer = ref<HTMLElement | null>(null);

// ---------- state سرچ ----------
const searchText = ref("");
const searchLoading = ref(false);
const showSearchDropdown = ref(false);
const searchRawResults = ref<any[]>([]);

let searchTimeout: any = null;

// وقتی متن سرچ عوض می‌شود ⇒ با دی‌بونس سرچ کنیم
watch(searchText, (val) => {
  const q = val.trim();
  if (!q || q.length < 2) {
    searchRawResults.value = [];
    showSearchDropdown.value = false;
    if (searchTimeout) clearTimeout(searchTimeout);
    return;
  }

  showSearchDropdown.value = true;

  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(runSearch, 400);
});

const runSearch = async () => {
  const q = searchText.value.trim();
  if (!q || q.length < 2) return;

  searchLoading.value = true;
  try {
    const res = await $fetch<{ products: any[] }>("/api/search", {
      query: { q, limit: 50 },
    });
    searchRawResults.value = res.products || [];
  } catch (e) {
    console.error("search error:", e);
    searchRawResults.value = [];
  } finally {
    searchLoading.value = false;
  }
};

// ---------- پیشنهادهای دسته‌بندی بر اساس اولین محصول مچ شده ----------
const typeSuggestions = computed(() => {
  const map = new Map<number, { typeId: number; typeName: string; count: number; sampleTitle: string }>();

  for (const p of searchRawResults.value) {
    const tId = p.type_id as number | null;
    if (!tId) continue;

    let entry = map.get(tId);
    if (!entry) {
      const tName = (p.types && p.types.typename) || typesStore.types.find((t) => t.id === tId)?.typename || "دسته‌بندی نامشخص";

      entry = {
        typeId: tId,
        typeName: tName,
        count: 0,
        sampleTitle: "",
      };
      map.set(tId, entry);
    }

    entry.count++;

    // اولین محصولی که برای این دسته‌بندی در نتایج هست ⇒ sampleTitle
    if (!entry.sampleTitle && p.title) {
      entry.sampleTitle = p.title as string;
    }
  }

  // حداکثر ۵ دسته‌بندی
  return Array.from(map.values()).slice(0, 5);
});

// ارسال سرچ با Enter یا کلیک روی آیکون ⇒ سرچ سراسری (بدون type)
const submitSearch = () => {
  const q = searchText.value.trim();
  if (!q) return;
  showSearchDropdown.value = false;
  router.push({
    path: "/products",
    query: { search: q },
  });
};

// کلیک روی پیشنهاد دسته‌بندی ⇒ سرچ داخل همان دسته
const selectTypeSuggestion = (s: { typeId: number }) => {
  const q = searchText.value.trim();
  if (!q) return;
  showSearchDropdown.value = false;
  router.push({
    path: "/products",
    query: { search: q, type: s.typeId },
  });
};

// وقتی روت عوض می‌شود ⇒ دراپ‌داون بسته شود
watch(
  () => route.fullPath,
  () => {
    showSearchDropdown.value = false;
  }
);

const handleClickOutside = (event: MouseEvent) => {
  if (searchContainer.value && !searchContainer.value.contains(event.target as Node)) {
    showSearchDropdown.value = false;
  }
};

onMounted(async () => {
  document.addEventListener("click", handleClickOutside);
  // فقط برای این‌که اگر هنوز چیزی لود نشده، استورها آماده باشند
  if (typesStore.types.length === 0) {
    await typesStore.fetchTypes();
  }
  if (productStore.products.length === 0) {
    await productStore.fetchProducts();
  }
});

onUnmounted(() => {
  // پاک کردن لیسنر وقتی کامپوننت از بین میره (خیلی مهمه برای جلوگیری از مموری لیک)
  document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
  <div ref="searchContainer" class="relative flex items-center w-full group">
    <!-- آیکون سرچ -->
    <div class="absolute left-2 p-2 rounded-full hover:bg-stone-100 cursor-pointer transition-colors duration-200 z-10" @click="submitSearch">
      <v-icon class="text-stone-500">mdi-magnify</v-icon>
    </div>

    <!-- اینپوت سرچ -->
    <input
      v-model="searchText"
      @keyup.enter="submitSearch"
      type="text"
      placeholder="جستجو در محصولات، دسته‌ها و ..."
      class="w-full bg-stone-50 border-0 ring-1 ring-stone-400 text-stone-700 placeholder-stone-400 !rounded-2xl px-4 py-3 pl-12 focus:ring-2 focus:ring-stone-500 focus:bg-white shadow-sm transition-all duration-300 ease-in-out outline-none text-sm font-medium" />

    <!-- دراپ‌داون پیشنهادها -->
    <Transition name="fade-slide">
      <div
        v-if="showSearchDropdown"
        class="absolute z-50 w-full bg-white border border-stone-100 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] top-full mt-2 overflow-hidden flex flex-col">
        <!-- حالت در حال جستجو -->
        <div v-if="searchLoading" class="p-4 flex items-center gap-3 text-stone-400 text-sm justify-center">
          <v-progress-circular indeterminate color="grey" size="20" width="2" />
          <span>در حال جستجو...</span>
        </div>

        <!-- پیشنهادهای دسته‌بندی -->
        <template v-else>
          <div class="px-4 py-3 bg-stone-50 text-xs font-bold text-stone-400 border-b border-stone-100">پیشنهادهای دسته‌بندی</div>
          <div v-if="typeSuggestions.length === 0" class="!p-4 font-semibold text-stone-500 text-sm">موردی یافت نشد.</div>
          <div v-else>
            <div
              v-for="s in typeSuggestions"
              :key="s.typeId"
              class="group/item px-4 py-3 cursor-pointer hover:bg-stone-50 transition-colors duration-200 flex items-center justify-between border-b border-stone-50 last:border-0"
              @mousedown.prevent="selectTypeSuggestion(s)">
              <div class="flex flex-col gap-1">
                <!-- اینجا دیگه خود سرچText رو نمی‌نویسیم؛ اسم کامل محصول نمونه رو می‌نویسیم -->
                <span class="text-stone-800 font-semibold text-sm group-hover/item:text-black transition-colors">
                  {{ s.sampleTitle || searchText }}
                </span>
                <span class="text-xs text-stone-500 flex items-center gap-1">
                  در دسته‌بندی
                  <span class="text-stone-700 font-medium bg-stone-200 px-1.5 py-0.5 rounded">
                    {{ s.typeName }}
                  </span>
                </span>
              </div>

              <span class="text-xs bg-stone-100 text-stone-500 py-1 px-2 rounded-full group-hover/item:bg-white group-hover/item:shadow-sm transition-all">
                {{ s.count }} کالا
              </span>
            </div>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* انیمیشن برای دراپ‌داون سرچ (از default منتقل شد) */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
