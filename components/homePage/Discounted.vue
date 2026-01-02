<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from "vue";
import { useRouter } from "vue-router";

// Swiper
import { Swiper, SwiperSlide } from "swiper/vue";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";

type DiscountProduct = {
  id: number;
  title: string;
  image: string;
  oldPrice: number; // تومان (عدد خام)
  newPrice: number;
  fireicon?: Boolean; // مثلا "فروش ویژه"
  inventoryno?: Number; // موجودی انبار
};

// ---- hardcoded demo data (فعلاً بصری)
const products = ref<DiscountProduct[]>([
  {
    id: 101,
    title: "صندلی مدرن مدل LUX-01",
    image: "https://images.unsplash.com/photo-1582582621959-48d27397dc19?auto=format&fit=crop&w=1200&q=80",
    oldPrice: 8900000,
    newPrice: 6490000,
    fireicon: true,
    inventoryno: 10,
  },
  {
    id: 102,
    title: "میز جلو مبلی سنگی مینیمال",
    image: "https://images.unsplash.com/photo-1549497538-303791108f95?auto=format&fit=crop&w=1200&q=80",
    oldPrice: 7200000,
    newPrice: 5290000,
    fireicon: false,
    inventoryno: 5,
  },
  {
    id: 103,
    title: "آباژور ایستاده طلایی",
    image: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&q=80",
    oldPrice: 4600000,
    newPrice: 3190000,
    fireicon: true,
    inventoryno: 19,
  },
  {
    id: 104,
    title: "کاناپه دو نفره پارچه‌ای",
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=80",
    oldPrice: 24500000,
    newPrice: 19900000,
    fireicon: false,
    inventoryno: 5,
  },
  {
    id: 105,
    title: "سِت اکسسوری دکوراتیو",
    image: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80",
    oldPrice: 3900000,
    newPrice: 2790000,
    fireicon: false,
    inventoryno: 8,
  },
  {
    id: 106,
    title: "فرش مدرن طرح هندسی",
    image: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80",
    oldPrice: 11800000,
    newPrice: 8990000,
    fireicon: true,
    inventoryno: 2,
  },
]);

const router = useRouter();
const modules = [Navigation];

// Nav buttons refs
const navPrevEl = ref<HTMLElement | null>(null); // راست
const navNextEl = ref<HTMLElement | null>(null); // چپ

const discountedSwiper = ref<any>(null);
const setDiscountedSwiper = (s: any) => {
  discountedSwiper.value = s;
};

// format price (تومان) — ساده و سریع
const formatToman = (price: number) => {
  // جداکننده هزارگان و تبدیل به فارسی
  const str = price.toLocaleString("en-US");
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

const discountPercent = (p: DiscountProduct) => {
  if (p.oldPrice <= 0) return 0;
  const d = Math.round(((p.oldPrice - p.newPrice) / p.oldPrice) * 100);
  return Math.max(0, d);
};

const goProduct = (e: MouseEvent, p: DiscountProduct) => {
  // drag = کلیک نکن
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

onMounted(async () => {
  await nextTick();
  if (discountedSwiper.value?.navigation) {
    try {
      discountedSwiper.value.navigation.init();
      discountedSwiper.value.navigation.update();
    } catch {}
  }
});

// یک شمارنده نمایشی ساده برای “زمان محدود” (صرفاً بصری)
const fakeTimer = computed(() => {
  // یه متن ثابت لوکس؛ بعداً واقعی می‌کنی
  return "۰۲:۴۵:۱۸";
});
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
          <p class="text-sm sm:text-xs text-neutral-900 mt-2 font-medium leading-relaxed max-w-2xl">
            بهترین انتخاب‌ها با تخفیف واقعی — قبل از تمام شدن موجودی، سریع‌تر انتخاب کن.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <!-- Nav buttons -->
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

    <!-- Swiper -->
    <div class="relative">
      <Swiper v-bind="discountedSwiperOptions" :modules="modules" class="select-none" @swiper="setDiscountedSwiper">
        <SwiperSlide v-for="p in products" :key="p.id">
          <!-- Product Card -->
          <div
            class="group rounded-[28px] overflow-hidden border border-neutral-100 bg-white transition-all duration-500 cursor-pointer"
            @click="(e) => goProduct(e, p)">
            <!-- Image -->
            <div class="relative">
              <img :src="p.image" draggable="false" class="w-full h-[240px] object-cover group-hover:scale-[1.03] transition-transform duration-700" alt="" />

              <!-- Overlay gradient -->
              <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"></div>

              <!-- Discount badge -->
              <div class="absolute top-4 right-4 flex items-center gap-2">
                <span class="px-3 py-1 rounded-full text-[11px] font-black bg-[#b69a78] text-white shadow-lg"> ٪{{ formatToman(discountPercent(p)) }} تخفیف </span>              
              </div>

              <!-- Fire icon -->
              <div v-if="p.fireicon" class="absolute bottom-4 left-4">
                <div class="w-10 h-10 rounded-2xl bg-white/90 backdrop-blur flex items-center justify-center border border-white/60 shadow">
                  <v-icon class="text-red-600">mdi-fire</v-icon>
                </div>
              </div>
            </div>

            <!-- Content -->
            <div class="!p-5">
              <h3 class="text-sm sm:text-base font-black text-neutral-900 leading-snug line-clamp-2">
                {{ p.title }}
              </h3>

              <!-- Prices -->
              <div class="mt-4 flex items-end justify-between gap-4">
                <div class="flex flex-col">
                  <span class="text-xs text-neutral-400 font-bold line-through"> {{ formatToman(p.oldPrice) }} تومان </span>
                  <span class="text-lg font-black text-neutral-900">
                    {{ formatToman(p.newPrice) }}
                    <span class="text-xs font-black text-neutral-500">تومان</span>
                  </span>
                </div>

                <div class="text-xs mb-2 font-semibold" :class="p.inventoryno < 6 ? 'text-red-600' : 'text-black'"><span>{{ p.inventoryno }}</span> <span>تا باقی مانده</span></div>
              </div>
            </div>
          </div>
        </SwiperSlide>
      </Swiper>
    </div>
  </div>
</template>

<style scoped>
/* برای جلوگیری از drag پیشفرض تصاویر */
img {
  -webkit-user-drag: none;
  user-drag: none;
}
</style>
