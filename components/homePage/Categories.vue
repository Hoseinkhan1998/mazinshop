<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import { useRouter } from "vue-router";

// Swiper (Vue)
import { Swiper, SwiperSlide } from "swiper/vue";
import { Navigation } from "swiper/modules";

import "swiper/css";
import "swiper/css/navigation";

type Category = {
  id: number;
  name: string;
  image: string;
};

const props = withDefaults(
  defineProps<{
    title?: string;
    categories?: Category[];
    linkBase?: string; 
    queryKey?: string; 
  }>(),
  {
    title: "دسته‌بندی‌های محبوب",
    linkBase: "/products",
    queryKey: "category",
    categories: () => {
      const cardLeftImage = "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=70";
      const cardRightImage = "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=70";
      const heroImage = "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1920&q=80";

      return [
        { id: 1, name: "صندلی راحتی", image: cardRightImage },
        { id: 2, name: "میز ناهارخوری", image: cardLeftImage },
        { id: 3, name: "اکسسوری منزل", image: heroImage },
        { id: 4, name: "نورپردازی", image: cardRightImage },
        { id: 5, name: "کمد و قفسه", image: cardLeftImage },
        { id: 6, name: "تخت خواب", image: heroImage },
        { id: 7, name: "مبلمان اداری", image: cardRightImage },
        { id: 8, name: "فرش و موکت", image: cardLeftImage },
        { id: 9, name: "آینه و کنسول", image: heroImage },
        { id: 10, name: "مبلمان باغی", image: cardRightImage },
      ];
    },
  }
);

const modules = [Navigation];
const router = useRouter();

// refs برای دکمه‌های navigation
const navPrevEl = ref<HTMLElement | null>(null); 
const navNextEl = ref<HTMLElement | null>(null); 

// swiper instance
const categoriesSwiper = ref<any>(null);
const setCategoriesSwiper = (s: any) => {
  categoriesSwiper.value = s;
};

const categoryTo = (cat: Category) => `${props.linkBase}?${props.queryKey}=${encodeURIComponent(String(cat.id))}`;

const onCategoryClick = (e: MouseEvent, cat: Category) => {
  if (!categoriesSwiper.value?.allowClick) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  router.push(categoryTo(cat));
};

onMounted(async () => {
  await nextTick();
  if (categoriesSwiper.value?.navigation) {
    try {
      categoriesSwiper.value.navigation.init();
      categoriesSwiper.value.navigation.update();
    } catch {
    }
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
      <h2 class="text-xl font-black text-neutral-800 border-r-4 border-[#b69a78] pr-3">
        {{ props.title }}
      </h2>
    </div>

    <div class="relative">
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
          <SwiperSlide v-for="cat in props.categories" :key="cat.id">
            <div class="py-4">
              <div class="w-full flex flex-col items-center group cursor-pointer" @click="(e) => onCategoryClick(e, cat)">
                <div
                  class="w-[92px] sm:w-[104px] lg:w-[170px] aspect-square rounded-full overflow-hidden border-4 border-transparent group-hover:border-[#b69a78] transition-all p-1">
                  <div class="w-full h-full rounded-full overflow-hidden bg-neutral-100">
                    <img :src="cat.image" draggable="false" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                  </div>
                </div>

                <span class="mt-4 text-xs font-bold text-neutral-600 group-hover:text-neutral-900 transition-colors">
                  {{ cat.name }}
                </span>
              </div>
            </div>
          </SwiperSlide>
        </Swiper>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
