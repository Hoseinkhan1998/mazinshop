<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useTypesStore } from "~/stores/types";
import { useProductStore } from "~/stores/products";

// Swiper (Vue)
import { Swiper, SwiperSlide } from "swiper/vue";
import { Navigation } from "swiper/modules";

import "swiper/css";
import "swiper/css/navigation";

const DEFAULT_TYPE_IMAGE = "/images/type-default.jpg";

const typesStore = useTypesStore();
const productStore = useProductStore();

const modules = [Navigation];

// ✅ فقط دسته‌هایی که واقعاً محصول دارند
const visibleTypes = computed(() => {
  if (!typesStore.types.length || !productStore.products.length) return [];
  return typesStore.types.filter((t) => productStore.products.some((p) => p.type_id === t.id));
});

// refs برای دکمه‌های navigation
const navPrevEl = ref<HTMLElement | null>(null);
const navNextEl = ref<HTMLElement | null>(null);

// swiper instance
const categoriesSwiper = ref<any>(null);
const setCategoriesSwiper = (s: any) => {
  categoriesSwiper.value = s;
};

onMounted(async () => {
  // اگر هنوز داده‌ها نیومدن، اینجا واکشی کن
  if (typesStore.types.length === 0) await typesStore.fetchTypes();
  if (productStore.products.length === 0) await productStore.fetchProducts();

  await nextTick();
  if (categoriesSwiper.value?.navigation) {
    try {
      categoriesSwiper.value.navigation.init();
      categoriesSwiper.value.navigation.update();
    } catch {}
  }
});

const categorySwiperOptions = {
  slidesPerView: 2.2,
  spaceBetween: 16,
  slidesPerGroup: 2,
  speed: 700,
  grabCursor: true,
  watchOverflow: true,

  preventClicks: true,
  preventClicksPropagation: true,

  navigation: {
    prevEl: null as any,
    nextEl: null as any,
    disabledClass: "opacity-30 pointer-events-none",
  },

  breakpoints: {
    640: { slidesPerView: 3.2, spaceBetween: 16, slidesPerGroup: 2 },
    1024: { slidesPerView: 5, spaceBetween: 16, slidesPerGroup: 2 },
  },

  onBeforeInit(swiper: any) {
    swiper.params.navigation.prevEl = navPrevEl.value;
    swiper.params.navigation.nextEl = navNextEl.value;
  },
};
</script>

<template>
  <div class="max-w-7xl mx-auto relative">
    <div class="flex items-center justify-between mb-8">
      <h2 class="text-xl font-black text-neutral-800 border-r-4 border-[#b69a78] pr-3">دسته‌بندی‌های محبوب</h2>
    </div>

    <!-- اگر هیچ دسته‌ای محصول نداشت، کلاً چیزی نشون نده -->
    <div v-if="visibleTypes.length" class="relative">
      <!-- Right (Prev) -->
      <button
        ref="navPrevEl"
        class="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center bg-white shadow-md hover:bg-neutral-50 transition-all"
        type="button"
        aria-label="قبلی">
        <v-icon>mdi-chevron-right</v-icon>
      </button>

      <!-- Left (Next) -->
      <button
        ref="navNextEl"
        class="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center bg-white shadow-md hover:bg-neutral-50 transition-all"
        type="button"
        aria-label="بعدی">
        <v-icon>mdi-chevron-left</v-icon>
      </button>

      <!-- Swiper -->
      <div class="mx-12 px-2 select-none" dir="rtl" style="direction: rtl">
        <Swiper v-bind="categorySwiperOptions" :modules="modules" class="select-none" @swiper="setCategoriesSwiper">
          <SwiperSlide v-for="t in visibleTypes" :key="t.id">
            <div class="py-4">
              <!-- ✅ لینک مستقیم به /products?type=id -->
              <NuxtLink :to="`/products?type=${t.id}`" class="w-full flex flex-col items-center group cursor-pointer">
                <div
                  class="w-[92px] sm:w-[104px] lg:w-[170px] aspect-square rounded-full overflow-hidden border-4 border-transparent group-hover:border-[#b69a78] transition-all p-1">
                  <div class="w-full h-full rounded-full overflow-hidden bg-neutral-100">
                    <img
                      :src="(t as any).image_url || DEFAULT_TYPE_IMAGE"
                      draggable="false"
                      class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      alt="" />
                  </div>
                </div>

                <span class="mt-4 text-xs font-bold text-neutral-600 group-hover:text-neutral-900 transition-colors">
                  {{ t.typename }}
                </span>
              </NuxtLink>
            </div>
          </SwiperSlide>
        </Swiper>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
