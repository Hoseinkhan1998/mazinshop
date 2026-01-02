<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useProductStore } from "~/stores/products";

const productStore = useProductStore();

const loading = ref(true);
const activeMenu = ref<"home" | "product" | "categories" | "promo">("home");

onMounted(async () => {
  try {
    if (productStore.products.length === 0) {
      await productStore.fetchProducts();
    }
  } finally {
    loading.value = false;
  }
});

const totalProducts = computed(() => productStore.products?.length || 0);

// فعلاً نمایشی (بعداً می‌تونی واقعی کنی)
const happyCustomers = computed(() => 12573);

// برای کارت کوچک روی هیرو
const highlighted = computed(() => {
  // اگر محصول داریم از همون استفاده کن (فقط نمایشی)
  const p = productStore.products?.[0];
  return {
    title: p?.title || "Chair-225",
    price: p?.product_variants?.[0]?.price || 8900000,
  };
});

const formatNumber = (num: number) => num.toLocaleString("fa-IR");

// تصاویر فیک (بعداً خودت جایگزین کن)
const heroImage = "https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=1200&q=70";
const cardLeftImage = "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=70";
const cardRightImage = "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=70";
</script>

<template>
  <section class="w-full">
    <!-- Wrapper -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- HERO CARD -->
      <div class="rounded-[28px] overflow-hidden border border-neutral-200 bg-white shadow-sm">
        <!-- Hero Background -->
        <div class="relative">
          <!-- background image -->
          <div class="h-[420px] sm:h-[460px] lg:h-[520px] w-full bg-center bg-cover" :style="{ backgroundImage: `url(${heroImage})` }">
            <!-- Dark overlay -->
            <div class="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/10"></div>
          </div>

          <!-- Top Nav -->
          <div class="absolute top-4 left-4 right-4">
            <div class="flex items-center justify-between rounded-full bg-white/95 border border-white/60 px-4 py-2 shadow-sm">
              <div class="flex items-center gap-2">
                <div class="w-9 h-9 rounded-full bg-neutral-900 flex items-center justify-center">
                  <v-icon color="white" size="18">mdi-lightning-bolt</v-icon>
                </div>
                <span class="font-semibold text-sm text-neutral-900">MazzinShop</span>
              </div>

              <div class="hidden md:flex items-center gap-6 text-sm text-neutral-700">
                <button class="hover:text-neutral-900 transition" :class="activeMenu === 'home' ? 'font-bold text-neutral-900' : ''" @click="activeMenu = 'home'">Home</button>
                <button class="hover:text-neutral-900 transition" :class="activeMenu === 'product' ? 'font-bold text-neutral-900' : ''" @click="activeMenu = 'product'">
                  Product
                </button>
                <button class="hover:text-neutral-900 transition" :class="activeMenu === 'categories' ? 'font-bold text-neutral-900' : ''" @click="activeMenu = 'categories'">
                  Categories
                </button>
                <button class="hover:text-neutral-900 transition" :class="activeMenu === 'promo' ? 'font-bold text-neutral-900' : ''" @click="activeMenu = 'promo'">Promo</button>
              </div>

              <div class="flex items-center gap-2">
                <NuxtLink to="/register" class="px-4 py-2 rounded-full text-xs font-bold bg-[#b69a78] text-white hover:opacity-90 transition"> Register </NuxtLink>
              </div>
            </div>
          </div>

          <!-- Hero Content -->
          <div class="absolute inset-0 flex items-center">
            <div class="w-full px-6 sm:px-10 lg:px-14">
              <div class="grid grid-cols-12 gap-8 items-center">
                <!-- Left Text -->
                <div class="col-span-12 lg:col-span-6">
                  <h1 class="text-white text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05]">
                    Choose Our Top<br />
                    Picks Furniture
                  </h1>

                  <p class="text-white/80 mt-4 text-sm sm:text-base max-w-lg leading-relaxed">
                    ما بهترین محصولات را برای خانه و محل کار شما انتخاب کرده‌ایم. این بخش فعلاً نمایشی است و بعداً با داده‌های واقعی و تصاویر نهایی جایگزین می‌شود.
                  </p>

                  <!-- CTA -->
                  <div class="mt-6 flex flex-wrap items-center gap-3">
                    <NuxtLink to="/products" class="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white text-neutral-900 text-sm font-bold hover:opacity-90 transition">
                      <v-icon size="18">mdi-cart-outline</v-icon>
                      Shop Now
                    </NuxtLink>

                    <button
                      class="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 text-white text-sm font-bold border border-white/25 hover:bg-white/15 transition"
                      type="button">
                      <span class="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
                        <v-icon size="16" color="white">mdi-play</v-icon>
                      </span>
                      Watch Video
                    </button>
                  </div>

                  <!-- Stats -->
                  <div class="mt-10 flex items-center gap-8">
                    <div class="text-white">
                      <div class="text-2xl font-black">
                        {{ loading ? "..." : formatNumber(totalProducts) }}
                      </div>
                      <div class="text-[11px] text-white/70">Total Products</div>
                    </div>

                    <div class="text-white">
                      <div class="text-2xl font-black">
                        {{ formatNumber(happyCustomers) }}
                      </div>
                      <div class="text-[11px] text-white/70">Happy Customers</div>
                    </div>
                  </div>
                </div>

                <!-- Right Side: floating mini card -->
                <div class="col-span-12 lg:col-span-6 relative hidden lg:block">
                  <div class="absolute bottom-10 left-10">
                    <div class="bg-white/95 backdrop-blur rounded-2xl border border-white/60 shadow-md px-4 py-3 flex items-center gap-4">
                      <div class="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center">
                        <v-icon size="22" color="black">mdi-sofa-outline</v-icon>
                      </div>

                      <div class="flex flex-col">
                        <span class="text-sm font-bold text-neutral-900 leading-tight">
                          {{ highlighted.title }}
                        </span>
                        <span class="text-[11px] text-neutral-500"> {{ formatNumber(highlighted.price) }} تومان </span>
                      </div>

                      <button class="px-3 py-2 rounded-xl bg-neutral-900 text-white text-[11px] font-bold hover:opacity-90 transition" type="button">Add to Cart →</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Rounded bottom spacing -->
          <div class="absolute bottom-0 left-0 right-0 h-10 bg-white rounded-t-[28px]"></div>
        </div>

        <!-- FEATURES -->
        <div class="bg-white px-6 sm:px-10 lg:px-14 py-8">
          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12 md:col-span-4">
              <div class="h-full rounded-2xl border border-neutral-200 bg-white px-5 py-5 flex items-start gap-3">
                <div class="w-11 h-11 rounded-2xl bg-neutral-100 flex items-center justify-center">
                  <v-icon size="22" color="black">mdi-truck-fast-outline</v-icon>
                </div>
                <div>
                  <p class="font-bold text-sm text-neutral-900">Free Worldwide Shipping</p>
                  <p class="text-xs text-neutral-500 mt-1 leading-relaxed">ارسال سریع و قابل‌اعتماد (فعلاً متن نمایشی). بعداً شرایط ارسال واقعی را اینجا می‌گذاریم.</p>
                </div>
              </div>
            </div>

            <div class="col-span-12 md:col-span-4">
              <div class="h-full rounded-2xl border border-neutral-200 bg-white px-5 py-5 flex items-start gap-3">
                <div class="w-11 h-11 rounded-2xl bg-neutral-100 flex items-center justify-center">
                  <v-icon size="22" color="black">mdi-seal-variant</v-icon>
                </div>
                <div>
                  <p class="font-bold text-sm text-neutral-900">Best Quality Product</p>
                  <p class="text-xs text-neutral-500 mt-1 leading-relaxed">کیفیت بالا و انتخاب حرفه‌ای محصولات (فعلاً نمونه). بعداً از دیتا/ویژگی‌ها واقعی می‌کنیم.</p>
                </div>
              </div>
            </div>

            <div class="col-span-12 md:col-span-4">
              <div class="h-full rounded-2xl border border-neutral-200 bg-white px-5 py-5 flex items-start gap-3">
                <div class="w-11 h-11 rounded-2xl bg-neutral-100 flex items-center justify-center">
                  <v-icon size="22" color="black">mdi-cash-multiple</v-icon>
                </div>
                <div>
                  <p class="font-bold text-sm text-neutral-900">Super Affordable Price</p>
                  <p class="text-xs text-neutral-500 mt-1 leading-relaxed">قیمت‌های رقابتی و منطقی (نمایشی). بعداً می‌تونیم روی پروموها و تخفیف‌ها مانور بدیم.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- CATEGORY CARDS -->
          <div class="mt-8 grid grid-cols-12 gap-6">
            <!-- Left card -->
            <div class="col-span-12 md:col-span-6">
              <div class="rounded-[26px] border border-neutral-200 bg-white overflow-hidden shadow-sm">
                <div class="grid grid-cols-12">
                  <div class="col-span-5 bg-[#b69a78] p-6 flex flex-col justify-between">
                    <div class="text-white/80 text-xs font-bold">#Office</div>
                    <div>
                      <h3 class="text-white text-xl font-black leading-tight mt-2">Make Your<br />Office More<br />Comfortable</h3>
                      <NuxtLink
                        to="/products"
                        class="inline-flex items-center gap-2 mt-5 text-xs font-bold bg-white text-neutral-900 px-4 py-2 rounded-full hover:opacity-90 transition">
                        Explore
                        <v-icon size="16">mdi-arrow-left</v-icon>
                      </NuxtLink>
                    </div>
                  </div>

                  <div class="col-span-7 relative">
                    <img :src="cardLeftImage" alt="Office" class="w-full h-full object-cover" />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right card -->
            <div class="col-span-12 md:col-span-6">
              <div class="rounded-[26px] border border-neutral-200 bg-white overflow-hidden shadow-sm">
                <div class="grid grid-cols-12">
                  <div class="col-span-7 relative">
                    <img :src="cardRightImage" alt="House" class="w-full h-full object-cover" />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
                  </div>

                  <div class="col-span-5 p-6 flex flex-col justify-between">
                    <div class="text-neutral-400 text-xs font-bold">#House</div>
                    <div>
                      <h3 class="text-neutral-900 text-xl font-black leading-tight mt-2">Express Your<br />Life Through<br />Design</h3>
                      <NuxtLink
                        to="/products"
                        class="inline-flex items-center gap-2 mt-5 text-xs font-bold bg-neutral-900 text-white px-4 py-2 rounded-full hover:opacity-90 transition">
                        Explore
                        <v-icon size="16" color="white">mdi-arrow-left</v-icon>
                      </NuxtLink>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- END HERO CARD -->
    </div>
  </section>
</template>

<style scoped>
/* اگر خواستی بعداً انیمیشن/ریزکاری اضافه کنیم همینجا خوبه */
</style>
