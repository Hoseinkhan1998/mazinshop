<script setup lang="ts">
import { ref, onMounted, nextTick, computed, watch } from "vue";
import { useRouter } from "vue-router";

import { Swiper, SwiperSlide } from "swiper/vue";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";

type DiscountProduct = {
  id: number; // product id
  variant_id: number; // representative discounted variant
  title: string;
  image: string;
  oldPrice: number;
  newPrice: number;
  discountPercent: number;
  fireicon: boolean;
  inventoryno: number;
  type_id: number | null;
};

const router = useRouter();
const modules = [Navigation];

// Nav buttons refs
const navPrevEl = ref<HTMLElement | null>(null);
const navNextEl = ref<HTMLElement | null>(null);

const discountedSwiper = ref<any>(null);
const setDiscountedSwiper = (s: any) => {
  discountedSwiper.value = s;
};

// ---- fetch data (SSR friendly) ----
const { data, pending, error, refresh } = await useFetch<{ products: DiscountProduct[] }>("/api/home/discounted", { server: true });

const products = computed(() => data.value?.products ?? []);

// format price (تومان)
const formatToman = (price: number) => {
  const str = Math.trunc(Math.max(0, price)).toLocaleString("en-US");
  const fa = str
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
  return fa;
};

const goProduct = (e: MouseEvent, p: DiscountProduct) => {
  if (!discountedSwiper.value?.allowClick) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  router.push(`/products/${p.id}`);
};

const discountedSwiperOptions = {
  slidesPerView: 1.15,
  spaceBetween: 16,
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
    480: { slidesPerView: 1.35, spaceBetween: 16 },
    640: { slidesPerView: 2.1, spaceBetween: 16 },
    1024: { slidesPerView: 3.1, spaceBetween: 18 },
    1280: { slidesPerView: 3.6, spaceBetween: 18 },
  },

  onBeforeInit(swiper: any) {
    swiper.params.navigation.prevEl = navPrevEl.value;
    swiper.params.navigation.nextEl = navNextEl.value;
  },
};

const reInitNav = async () => {
  await nextTick();
  if (discountedSwiper.value?.navigation) {
    try {
      discountedSwiper.value.navigation.init();
      discountedSwiper.value.navigation.update();
    } catch {}
  }
};

onMounted(async () => {
  await reInitNav();
});

// وقتی دیتا آمد/تغییر کرد، ناوبری swiper آپدیت شود
watch(
  () => products.value.length,
  async () => {
    await reInitNav();
  }
);
</script>

<template>
  <div class="max-w-7xl mx-auto" dir="rtl">
    <!-- Header -->
    <div class="relative overflow-hidden rounded-[28px] border border-neutral-100 bg-gradient-to-l from-white/60 via-white to-black !p-3 sm:p-8 mb-8">
      <div class="absolute -left-10 -top-10 w-40 h-40 rounded-full bg-[#b69a78]/15 blur-2xl"></div>
      <div class="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-black/5 blur-2xl"></div>

      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
        <div>
          <div class="flex items-center gap-3 mb-3">
            <span class="px-3 py-1 rounded-full text-[11px] font-black bg-black text-white"> 🔥 محصولات پر تخفیف </span>
          </div>

          <h2 class="text-2xl sm:text-2xl font-black text-red-500 leading-tight">محصولات تخفیف‌خورده‌ی منتخب</h2>
          <p class="text-sm sm:text-xs text-neutral-900 mt-2 font-medium leading-relaxed max-w-2xl">بهترین انتخاب‌ها با تخفیف واقعی — قبل از تمام شدن موجودی، سریع‌تر انتخاب کن.</p>

          <p v-if="error" class="text-xs text-red-600 mt-2 font-bold">
            خطا در دریافت محصولات تخفیف‌خورده.
            <button class="underline" @click="refresh()">تلاش مجدد</button>
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button
            ref="navPrevEl"
            type="button"
            aria-label="قبلی"
            class="w-11 h-11 rounded-full bg-white border border-neutral-200 shadow-sm hover:shadow-md transition-all flex items-center justify-center">
            <v-icon>mdi-chevron-right</v-icon>
          </button>
          <button
            ref="navNextEl"
            type="button"
            aria-label="بعدی"
            class="w-11 h-11 rounded-full bg-white border border-neutral-200 shadow-sm hover:shadow-md transition-all flex items-center justify-center">
            <v-icon>mdi-chevron-left</v-icon>
          </button>

          <button
            type="button"
            class="ml-2 px-5 h-11 select-none rounded-full bg-neutral-900 text-white font-bold text-sm hover:bg-[#b69a78] transition-all flex items-center gap-2"
            @click="router.push('/products?discounted=1')">
            مشاهده همه
            <v-icon size="18">mdi-arrow-left</v-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- Loading (ساده) -->
    <div v-if="pending" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="i in 4" :key="i" class="rounded-[28px] overflow-hidden border border-neutral-100 bg-white">
        <div class="h-[240px] bg-neutral-200 animate-pulse"></div>
        <div class="p-5 space-y-3">
          <div class="h-4 bg-neutral-200 rounded animate-pulse"></div>
          <div class="h-4 bg-neutral-200 rounded w-2/3 animate-pulse"></div>
          <div class="h-6 bg-neutral-200 rounded w-1/2 animate-pulse"></div>
        </div>
      </div>
    </div>

    <!-- Swiper -->
    <div v-else class="relative">
      <Swiper v-bind="discountedSwiperOptions" :modules="modules" class="select-none" @swiper="setDiscountedSwiper">
        <SwiperSlide v-for="p in products" :key="p.id">
          <div class="group rounded-[28px] overflow-hidden border border-neutral-100 bg-white transition-all duration-500 cursor-pointer" @click="(e) => goProduct(e, p)">
            <div class="relative">
              <img :src="p.image" draggable="false" class="w-full h-[240px] object-cover group-hover:scale-[1.03] transition-transform duration-700" alt="" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"></div>

              <div class="absolute top-4 right-4 flex items-center gap-2">
                <span class="px-3 py-1 rounded-full text-[11px] font-black bg-[#b69a78] text-white shadow-lg"> ٪{{ formatToman(p.discountPercent) }} تخفیف </span>
              </div>

              <div v-if="p.fireicon" class="absolute bottom-4 left-4">
                <div class="w-10 h-10 rounded-2xl bg-white/90 backdrop-blur flex items-center justify-center border border-white/60 shadow">
                  <v-icon class="text-red-600">mdi-fire</v-icon>
                </div>
              </div>
            </div>

            <div class="!p-5">
              <h3 class="text-sm sm:text-base font-black text-neutral-900 leading-snug line-clamp-1">
                {{ p.title }}
              </h3>

              <div class="mt-4 flex items-end justify-between gap-4">
                <div class="flex flex-col">
                  <span class="text-xs text-neutral-400 font-bold line-through"> {{ formatToman(p.oldPrice) }} تومان </span>
                  <span class="text-lg font-black text-neutral-900">
                    {{ formatToman(p.newPrice) }}
                    <span class="text-xs font-black text-neutral-500">تومان</span>
                  </span>
                </div>

                <div class="text-xs mb-2 font-semibold" :class="p.inventoryno < 6 ? 'text-red-600' : 'text-black'">
                  <span>{{ formatToman(p.inventoryno) }}</span>
                  <span>تا باقی مانده</span>
                </div>
              </div>
            </div>
          </div>
        </SwiperSlide>
      </Swiper>
    </div>
  </div>
</template>

<style scoped>
img {
  -webkit-user-drag: none;
  user-drag: none;
}
</style>
