<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import HomePageCategories from "~/components/homePage/Categories.vue";

// Hero Section
const totalProducts = "۱,۴۶۴";
const happyCustomers = "۱۲,۵۷۳";

const heroImages = [
  "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=1920&q=80",
];

const currentImageIndex = ref(0);
let autoPlayInterval: ReturnType<typeof setInterval> | null = null;

const nextImage = () => {
  currentImageIndex.value = (currentImageIndex.value + 1) % heroImages.length;
};

const prevImage = () => {
  currentImageIndex.value = (currentImageIndex.value - 1 + heroImages.length) % heroImages.length;
};

const stopAutoPlay = () => {
  if (autoPlayInterval) clearInterval(autoPlayInterval);
  autoPlayInterval = null;
};

const startAutoPlay = () => {
  stopAutoPlay();
  autoPlayInterval = setInterval(() => {
    nextImage();
  }, 6000);
};

const setImage = (index: number) => {
  currentImageIndex.value = index;
  startAutoPlay();
};

onMounted(() => {
  startAutoPlay();
});

onUnmounted(() => {
  stopAutoPlay();
});

// Assets (برای سکشن‌های بعدی هنوز لازم‌اند)
const cardLeftImage = "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=70";
const cardRightImage = "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=70";
</script>

<template>
  <div class="w-full overflow-x-hidden" dir="rtl">
    <!-- Hero Section -->
    <section class="relative w-full h-[650px] overflow-hidden">
      <div v-for="(img, index) in heroImages" :key="index">
        <transition name="fade-hero">
          <div
            v-if="currentImageIndex === index"
            class="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-[2000ms]"
            :style="{ backgroundImage: `url(${img})` }">
            <div class="absolute inset-0 bg-gradient-to-l from-black/90 via-black/40 to-transparent"></div>
          </div>
        </transition>
      </div>

      <div class="relative h-full container mx-auto px-6 lg:px-16 flex !pt-20">
        <div class="grid grid-cols-12 w-full">
          <div class="col-span-12 lg:col-span-7 text-white">
            <h1 class="text-3xl sm:text-4xl lg:text-5xl font-black leading-[1.3] mb-5">
              گلچینی از بهترین<br />
              <span class="text-[#b69a78]">اکسسوری و مبلمان</span>
            </h1>

            <p class="text-white/70 text-sm sm:text-base max-w-lg leading-loose mb-8 font-medium">
              ما در مزین شاپ، زیبایی را به خانه شما می‌آوریم. تجربه‌ای مدرن با محصولاتی که برای سلیقه خاص شما انتخاب شده‌اند.
            </p>

            <div class="flex flex-wrap items-center gap-3">
              <NuxtLink
                to="/products"
                class="holographic-button px-6 py-3 rounded-full bg-white text-neutral-900 text-sm font-bold shadow-lg flex items-center gap-2 relative overflow-hidden">
                <span class="relative z-10">همین حالا خرید کنید</span>
                <v-icon size="20" class="relative z-10">mdi-cart-outline</v-icon>
              </NuxtLink>
            </div>

            <div class="mt-12 flex items-center gap-10 border-r border-[#b69a78]/50 pr-5">
              <div>
                <div class="text-2xl font-black text-white">{{ totalProducts }}</div>
                <div class="text-[10px] text-white/50 font-bold uppercase mt-1">تنوع کالا</div>
              </div>
              <div>
                <div class="text-2xl font-black text-white">{{ happyCustomers }}</div>
                <div class="text-[10px] text-white/50 font-bold uppercase mt-1">مشتریان راضی</div>
              </div>
            </div>
          </div>

          <!-- Vertical Swiper Controls -->
          <div class="hidden lg:flex col-span-5 flex-col justify-center items-end pl-12 relative z-20">
            <div class="flex flex-col items-center gap-6 bg-black/50 backdrop-blur-xl py-6 px-3 rounded-full border border-white/50">
              <!-- Up Arrow -->
              <button
                @click="
                  prevImage();
                  startAutoPlay();
                "
                class="text-white hover:text-[#b69a78] transition-all hover:-translate-y-1 active:scale-90">
                <v-icon size="28">mdi-chevron-up</v-icon>
              </button>

              <!-- Indicators -->
              <div class="flex flex-col gap-3 items-center">
                <div
                  v-for="(img, index) in heroImages"
                  :key="index"
                  @click="setImage(index)"
                  class="cursor-pointer transition-all duration-500 rounded-full"
                  :class="currentImageIndex === index ? 'w-1.5 h-8 bg-[#b69a78] shadow-[0_0_10px_rgba(182,154,120,0.8)]' : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/80'"></div>
              </div>

              <!-- Down Arrow -->
              <button
                @click="
                  nextImage();
                  startAutoPlay();
                "
                class="text-white hover:text-[#b69a78] transition-all hover:translate-y-1 active:scale-90">
                <v-icon size="28">mdi-chevron-down</v-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="absolute bottom-0 left-0 right-0 h-12 bg-white rounded-t-[40px] z-10"></div>
    </section>
    <!-- Product Categories Section -->
    <section class="bg-white py-6 px-6 lg:px-16 overflow-hidden">
      <HomePageCategories />
    </section>

    <!-- Discounted products Section -->
    <section class="bg-white px-6 lg:px-16 py-6">
      <HomePageDiscounted />
    </section>

    <!-- Promotional Cards Section -->
    <section class="bg-white px-6 lg:px-16 py-12 pb-24">
      <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div class="group relative rounded-[40px] overflow-hidden h-[400px] shadow-lg">
          <img :src="cardLeftImage" class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
          <div class="absolute bottom-10 right-10 left-10">
            <span class="text-[#b69a78] font-bold text-sm">#فضای_کاری</span>
            <h2 class="text-white text-3xl font-black mt-2 leading-tight">دفتر کار خود را<br />حرفه‌ای و خاص چیدمان کنید</h2>
            <NuxtLink
              to="/products"
              class="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-white text-neutral-900 rounded-full font-bold hover:bg-[#b69a78] hover:text-white transition-all">
              مشاهده محصولات
              <v-icon size="18">mdi-arrow-left</v-icon>
            </NuxtLink>
          </div>
        </div>

        <div class="group relative rounded-[40px] overflow-hidden h-[400px] shadow-lg">
          <img :src="cardRightImage" class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
          <div class="absolute bottom-10 right-10 left-10">
            <span class="text-[#b69a78] font-bold text-sm">#دکوراسیون_منزل</span>
            <h2 class="text-white text-3xl font-black mt-2 leading-tight">روح زندگی در<br />جزئیات طراحی داخلی خانه</h2>
            <NuxtLink
              to="/products"
              class="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-white text-neutral-900 rounded-full font-bold hover:bg-[#b69a78] hover:text-white transition-all">
              مشاهده محصولات
              <v-icon size="18">mdi-arrow-left</v-icon>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>
    <!-- Best-selling products Section -->
    <section class="bg-white px-6 lg:px-16 py-6">
      <HomePageBestselling />
    </section>

    <!-- Features Section-->
    <section class="bg-white px-6 lg:px-16 py-12 relative z-20">
      <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="p-8 rounded-[32px] bg-[#f9f9f9] border border-neutral-100 flex items-center gap-5 group hover:bg-white hover:shadow-2xl transition-all duration-500">
          <div class="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center group-hover:bg-[#b69a78]">
            <v-icon size="28" class="">mdi-truck-fast-outline</v-icon>
          </div>
          <div>
            <h3 class="font-black text-lg text-neutral-900">ارسال به سراسر کشور</h3>
            <p class="text-sm text-neutral-400 mt-1 font-medium">تحویل سریع در کمترین زمان ممکن</p>
          </div>
        </div>

        <div class="p-8 rounded-[32px] bg-[#f9f9f9] border border-neutral-100 flex items-center gap-5 group hover:bg-white hover:shadow-2xl transition-all duration-500">
          <div class="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center group-hover:bg-[#b69a78]">
            <v-icon size="28" class="">mdi-shield-star-outline</v-icon>
          </div>
          <div>
            <h3 class="font-black text-lg text-neutral-900">ضمانت اصالت و کیفیت</h3>
            <p class="text-sm text-neutral-400 mt-1 font-medium">بهترین متریال و بالاترین کیفیت ساخت</p>
          </div>
        </div>

        <div class="p-8 rounded-[32px] bg-[#f9f9f9] border border-neutral-100 flex items-center gap-5 group hover:bg-white hover:shadow-2xl transition-all duration-500">
          <div class="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center group-hover:bg-[#b69a78]">
            <v-icon size="28" class="">mdi-cash-check</v-icon>
          </div>
          <div>
            <h3 class="font-black text-lg text-neutral-900">قیمت‌های رقابتی</h3>
            <p class="text-sm text-neutral-400 mt-1 font-medium">خرید مستقیم و بدون واسطه با بهترین قیمت</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
@keyframes bounce-slow {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-15px);
  }
}
.animate-bounce-slow {
  animation: bounce-slow 6s infinite ease-in-out;
}

.fade-hero-enter-active,
.fade-hero-leave-active {
  transition: opacity 1.8s ease-in-out;
}

.fade-hero-enter-from,
.fade-hero-leave-to {
  opacity: 0;
}

/* انیمیشن شناور صندلی */
@keyframes bounce-slow {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-12px);
  }
}
.animate-bounce-slow {
  animation: bounce-slow 6s infinite ease-in-out;
}

.holographic-button {
  transition: all 0.5s ease;
}

.holographic-button::before {
  content: "";
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(0deg, transparent, transparent 30%, rgba(182, 154, 120, 0.3));
  transform: rotate(-45deg);
  transition: all 0.6s ease;
  opacity: 0;
  pointer-events: none;
}

.holographic-button:hover {
  transform: scale(1.05);
  box-shadow: 0 10px 25px rgba(182, 154, 120, 0.3);
}

.holographic-button:hover::before {
  opacity: 1;
  transform: rotate(-45deg) translateY(100%);
}
</style>
