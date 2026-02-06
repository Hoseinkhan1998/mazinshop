<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import { useRouter } from "vue-router";

// Swiper (Vue)
import { Swiper, SwiperSlide } from "swiper/vue";
import { Grid, Pagination, Navigation } from "swiper/modules";

// Styles
import "swiper/css";
import "swiper/css/grid";
import "swiper/css/pagination";
import "swiper/css/navigation";

type Product = {
  id: number;
  title: string;
  image: string;
  price: number;
};

const products = ref<Product[]>([]);

const router = useRouter();
const modules = [Grid, Pagination, Navigation];

// Nav buttons refs
const navPrevEl = ref<HTMLElement | null>(null);
const navNextEl = ref<HTMLElement | null>(null);

// format price (تومان)
const formatToman = (price: number) => {
  const str = Math.max(0, Math.floor(price || 0)).toLocaleString("en-US");
  return str
    .replaceAll("0", "۰")
    .replaceAll("1", "۱")
    .replaceAll("2", "۲")
    .replaceAll("3", "۳")
    .replaceAll("4", "۴")
    .replaceAll("5", "۵")
    .replaceAll("6", "۶")
    .replaceAll("7", "۷")
    .replaceAll("8", "۸")
    .replaceAll("9", "۹")
    .replaceAll(",", "٬");
};

// کلیک
const bestSwiper = ref<any>(null);
const setBestSwiper = (s: any) => (bestSwiper.value = s);

const goProduct = (e: MouseEvent, p: Product) => {
  if (!bestSwiper.value?.allowClick) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  router.push(`/products/${p.id}`);
};

// Swiper config
const swiperOptions = {
  slidesPerView: 1.25,
  spaceBetween: 14,
  speed: 650,
  grabCursor: true,
  watchOverflow: true,

  preventClicks: true,
  preventClicksPropagation: true,

  grid: { rows: 2, fill: "row" as const },

  navigation: {
    prevEl: null as any,
    nextEl: null as any,
    disabledClass: "opacity-20 pointer-events-none",
  },

  pagination: {
    el: ".best-pagination-container",
    clickable: true,
    bulletClass: "best-bullet",
    bulletActiveClass: "best-bullet-active",
  },

  onBeforeInit(swiper: any) {
    swiper.params.navigation.prevEl = navPrevEl.value;
    swiper.params.navigation.nextEl = navNextEl.value;
  },

  breakpoints: {
    480: { slidesPerView: 1.6, spaceBetween: 14 },
    640: { slidesPerView: 2.2, spaceBetween: 16 },
    1024: { slidesPerView: 3, spaceBetween: 18 },
    1280: { slidesPerView: 3.2, spaceBetween: 18 },
  },
};

onMounted(async () => {
  // 1) دیتای واقعی
  try {
    const res = await $fetch<{ products: any[] }>("/api/products/most-viewed?limit=10");
    products.value =
      (res.products || []).map((x) => ({
        id: x.id,
        title: x.title,
        image: x.image || "",
        price: Number(x.price || 0),
      })) || [];
  } catch (e) {
    console.error("most-viewed fetch error:", e);
    products.value = [];
  }

  // 2) init nav
  await nextTick();
  if (bestSwiper.value?.navigation) {
    try {
      bestSwiper.value.navigation.init();
      bestSwiper.value.navigation.update();
    } catch {}
  }
});
</script>

<template>
  <div v-if="products.length" class="max-w-7xl mx-auto" dir="rtl">
    <!-- متفاوت: یک پنل/گالری -->
    <div class="relative rounded-[28px] overflow-hidden border border-neutral-100 bg-white">
      <!-- Top strip -->
      <div class="!p-3 sm:p-8 border-b border-neutral-100 bg-gradient-to-l from-neutral-900 via-neutral-600 to-neutral-400">
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="px-3 py-1 rounded-full text-[11px] font-black bg-white/10 text-white border border-white/15"> ⭐ پربازدیدترین‌ها </span>
              <span class="px-3 py-1 rounded-full text-[11px] font-black bg-[#b69a78] text-white"> انتخاب مشتریان </span>
            </div>
            <h2 class="text-xl sm:text-2xl font-black text-white">محبوب‌ترین محصولات مزین شاپ</h2>
            <!-- <p class="text-xs sm:text-sm text-white/70 mt-2 font-medium">یک نگاه سریع به آیتم‌هایی که بیشترین سفارش را داشته‌اند.</p> -->
          </div>
        </div>
      </div>

      <!-- Grid Swiper -->
      <div class="!p-5 sm:p-6">
        <Swiper v-bind="swiperOptions" :modules="modules" class="bestSwiper select-none" @swiper="setBestSwiper" dir="rtl" style="direction: rtl">
          <SwiperSlide v-for="p in products" :key="p.id">
            <!-- Compact Product Card -->
            <div
              class="group rounded-[18px] border border-neutral-100 bg-white !pe-3 hover:border-[#b69a78]/60 hover:shadow-[0_18px_50px_rgba(182,154,120,0.18)] transition-all duration-500 cursor-pointer overflow-hidden"
              @click="(e) => goProduct(e, p)">
              <div class="flex items-center gap-4 p-3">
                <!-- Image -->
                <div class="w-[70px] h-[70px] rounded-2xl overflow-hidden bg-neutral-100 flex-shrink-0">
                  <img :src="p.image" draggable="false" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                </div>

                <!-- Info -->
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-black text-neutral-900 truncate">
                    {{ p.title }}
                  </div>
                  <div class="mt-2 flex items-center gap-2">
                    <span class="text-base font-black text-neutral-900">
                      {{ formatToman(p.price) }}
                    </span>
                    <span class="text-xs font-bold text-neutral-400">تومان</span>
                  </div>
                </div>

                <!-- small accent -->
                <div
                  class="w-9 h-9 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center group-hover:bg-[#b69a78]/10 group-hover:border-[#b69a78]/30 transition-all">
                  <v-icon size="18" class="text-neutral-600 group-hover:text-[#b69a78] transition-all duration-300">mdi-arrow-left</v-icon>
                </div>
              </div>
            </div>
          </SwiperSlide>
        </Swiper>

        <!-- Navigation & Pagination Controls -->
        <div class="flex items-center justify-center gap-2 mt-6">
          <button
            ref="navPrevEl"
            type="button"
            aria-label="قبلی"
            class="w-9 h-9 rounded-full bg-white border border-neutral-200 shadow-sm hover:shadow-md transition-all flex items-center justify-center group/nav">
            <v-icon size="20" class="text-neutral-500 group-hover/nav:text-neutral-900">mdi-chevron-right</v-icon>
          </button>

          <div class="best-pagination-container"></div>

          <button
            ref="navNextEl"
            type="button"
            aria-label="بعدی"
            class="w-9 h-9 rounded-full bg-white border border-neutral-200 shadow-sm hover:shadow-md transition-all flex items-center justify-center group/nav">
            <v-icon size="20" class="text-neutral-500 group-hover/nav:text-neutral-900">mdi-chevron-left</v-icon>
          </button>
        </div>

        <!-- Mobile CTA -->
        <button
          type="button"
          class="sm:hidden mt-6 w-full h-12 rounded-full bg-neutral-900 text-white font-bold text-sm hover:bg-[#b69a78] transition-all flex items-center justify-center gap-2"
          @click="router.push('/products?sort=bestselling')">
          مشاهده همه
          <v-icon size="18">mdi-arrow-left</v-icon>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* جلوگیری از drag پیشفرض */
img {
  -webkit-user-drag: none;
  user-drag: none;
}

/* Pagination container styling */
.best-pagination-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: fit-content;
}

:deep(.best-bullet) {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.18);
  transition: all 0.3s ease;
  display: inline-block;
}

:deep(.best-bullet-active) {
  width: 18px;
  background: rgba(182, 154, 120, 0.95);
}

/* Grid spacing در Swiper Grid گاهی با ارتفاع می‌لنگه، این کمک می‌کند کارت‌ها منظم باشند */
:deep(.bestSwiper .swiper-slide) {
  height: auto;
}
</style>
