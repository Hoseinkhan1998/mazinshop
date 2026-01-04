<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "~/stores/auth";
import type { Product } from "~/types/Product";
import AddProductForm from "~/components/AddProductForm.vue";
import TypeManager from "~/components/TypeManager.vue";
import AttributeManager from "~/components/AttributeManager.vue";
import VariantManager from "~/components/VariantManager.vue";
import { useToast } from "~/composables/useToast";
import { useGlobalLoading } from "~/composables/useGlobalLoading";
import { useCartStore } from "~/stores/cart";
import { useTypesStore } from "~/stores/types";
import { useProductStore } from "~/stores/products";
import HeaderSearch from "~/components/HeaderSearch.vue";

const authStore = useAuthStore();
const { toast } = useToast();
const route = useRoute();

const isLoggedIn = computed(() => authStore.isLoggedIn);
const displayName = computed(() => authStore.profile?.full_name || "کاربر مهمان");
const isAdmin = computed(() => authStore.isAdmin);

const cartStore = useCartStore();
const typesStore = useTypesStore();
const productStore = useProductStore();

const cartCount = computed(() => cartStore.items.length);

// --- State برای دیالوگ‌ها ---
const productDialog = ref(false);
const typesDialog = ref(false);
const attributesDialog = ref(false);
const logoutDialog = ref(false);
const tab = ref<"details" | "variants">("details");
const { isGlobalLoading } = useGlobalLoading();

// فقط دسته‌هایی که واقعاً محصول قابل نمایش دارند
const visibleTypes = computed(() => {
  if (!typesStore.types.length || !productStore.products.length) return [];

  return typesStore.types.filter((type) => productStore.products.some((p) => p.type_id === type.id));
});

// مدیریت دیالوگ محصول / ویرایش
const productForVariantManagement = ref<Product | null>(null);
const productToEdit = ref<Product | null>(null);

const openProductDialog = (product: Product | null = null) => {
  if (product) {
    // اگر بعداً خواستی ویرایش محصول رو فعال کنی، اینجا مقدار بده
    // productToEdit.value = product;
    // productForVariantManagement.value = product;
  } else {
    productToEdit.value = null;
    productForVariantManagement.value = null;
    tab.value = "details";
  }
  productDialog.value = true;
};

const handleProductSubmitted = (product: Product) => {
  productForVariantManagement.value = product;
  tab.value = "variants";
};

// بستن و ریست کردن دیالوگ
const closeProductDialog = () => {
  productDialog.value = false;
  setTimeout(() => {
    productToEdit.value = null;
    productForVariantManagement.value = null;
    tab.value = "details";
  }, 300);
};

const confirmLogout = () => {
  authStore.signOut();
  logoutDialog.value = false;
};

// ---------- Scroll Handling for Header ----------
const showSubHeader = ref(true);
let lastScrollY = 0;

const handleScroll = () => {
  if (typeof window === "undefined") return;

  const currentScrollY = window.scrollY;

  // اگر به ابتدای صفحه چسبیده بودیم، حتما نشان بده
  if (currentScrollY <= 10) {
    showSubHeader.value = true;
  }
  // اسکرول به پایین -> مخفی کردن (بی‌قید و شرط)
  else if (currentScrollY > lastScrollY) {
    showSubHeader.value = false;
  }
  // اسکرول به بالا -> نشان دادن (بی‌قید و شرط)
  else if (currentScrollY < lastScrollY) {
    showSubHeader.value = true;
  }

  lastScrollY = currentScrollY;
};

onMounted(async () => {
  window.addEventListener("scroll", handleScroll);
  cartStore.initializeCart();

  if (typesStore.types.length === 0) {
    await typesStore.fetchTypes();
  }
  if (productStore.products.length === 0) {
    await productStore.fetchProducts();
  }
});

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
});
</script>

<template>
  <v-app>
    <div class="relative min-h-screen flex flex-col">
      <header v-if="route.path !== '/login' && route.path !== '/information'" class="fixed w-full top-0 z-50 bg-stone-300/80 backdrop-blur-2xl transition-transform duration-300">
        <nav class="container mx-auto px-10 py-4">
          <div class="grid grid-cols-12 items-center">
            <div class="col-span-9 grid grid-cols-12 items-center">
              <NuxtLink to="/" class="text-xl col-span-2 font-bold text-gray-800">
                <img src="/images/logo.png" class="h-14 w-20" alt="" />
              </NuxtLink>
              <div class="ms-5 col-span-6 flex items-center gap-10">
                <HeaderSearch />
              </div>
            </div>
            <!-- name & shoppingcard -->
            <div class="flex items-center gap-3 col-span-3 justify-end">
              <ClientOnly v-if="isLoggedIn">
                <div class="dropdown dropdown-bottom">
                  <div tabindex="0" role="button" class="flex items-center m-1 gap-2 py-1 border-2 border-neutral-400 border-solid rounded-lg px-4 hov mybg">
                    <v-icon class="text-white !text-2xl">mdi-account-circle</v-icon>
                    <p class="truncate max-w-40">{{ displayName }}</p>
                  </div>
                  <ul tabindex="0" class="dropdown-content relative menu gap-3 bg-neutral-100 mt-3 rounded-box z-[1] w-48 !p-2 shadow-xl shadow-neutral-200">
                    <NuxtLink
                      v-if="isAdmin && $route.path !== '/editproduct'"
                      to="/editproduct"
                      class="cursor-pointer hover:!bg-neutral-200 px-4 py-1 transition-all duration-150 flex items-center gap-1 rounded-lg">
                      <p>ویرایش فروشگاه من</p>
                      <v-icon class="!text-xl text-yellow-500 transform -rotate-30">mdi-crown</v-icon>
                    </NuxtLink>
                    <NuxtLink
                      v-if="isAdmin && $route.path !== '/admin/comments'"
                      to="/admin/comments"
                      class="cursor-pointer hover:!bg-neutral-200 px-4 py-1 transition-all duration-150 flex items-center gap-1 rounded-lg">
                      <p>مدیریت کامنت‌ها</p>
                      <v-icon class="!text-xl text-yellow-500 transform -rotate-30">mdi-crown</v-icon>
                    </NuxtLink>

                    <NuxtLink to="/information" class="cursor-pointer hover:!bg-neutral-200 px-4 py-1 transition-all duration-150 rounded-lg">ویرایش پروفایل</NuxtLink>
                    <li>
                      <div
                        @click="logoutDialog = true"
                        class="px-4 py-1 bg-red-600 text-white font-semibold hover:bg-red-500 transition-all duration-150 cursor-pointer rounded-md">
                        خروج
                      </div>
                    </li>
                  </ul>
                </div>
              </ClientOnly>

              <ClientOnly v-if="isAdmin">
                <div class="relative group">
                  <v-icon class="!text-3xl text-yellow-500 transform -rotate-30">mdi-crown</v-icon>
                  <v-tooltip class="!text-xs" activator="parent" location="bottom"><p class="text-xs">ادمین</p></v-tooltip>
                </div>
              </ClientOnly>
              <!-- سبد خرید: همیشه دیده شود -->
              <NuxtLink v-else to="/shoppingcard" class="cursor-pointer relative" aria-label="سبد خرید">
                <ClientOnly>
                  <div v-if="cartCount > 0" class="rounded-full bg-red-500 text-xs flex justify-center items-center text-white absolute -top-2 -right-2 px-1 min-w-[18px] h-[18px]">
                    {{ cartCount }}
                  </div>
                </ClientOnly>
                <v-icon class="!text-3xl">mdi-cart-variant</v-icon>
              </NuxtLink>

              <!-- ورود/خروج -->
              <ClientOnly>
                <NuxtLink v-if="!isLoggedIn" to="/login">
                  <div class="bg-stone-600 !text-white rounded-lg hover:bg-stone-500 transition-all duration-150 px-4 py-2">ورود / ثبت نام</div>
                </NuxtLink>
              </ClientOnly>
            </div>
          </div>
          <!-- navigation types -->
          <div
            class="col-span-12 flex items-center gap-5 text-sm transition-all duration-300 ease-in-out overflow-hidden"
            :class="showSubHeader ? 'max-h-20 opacity-100 translate-y-0 mt-2' : 'max-h-0 opacity-0 -translate-y-2 mt-0'">
            <template v-if="visibleTypes.length">
              <NuxtLink
                v-for="type in visibleTypes"
                :key="type.id"
                :to="`/products?type=${type.id}`"
                class="hover-underline-animation right cursor-pointer"
                :class="{
                  'border-b-2 border-stone-600': $route.path.startsWith('/products') && $route.query.search === undefined && Number($route.query.type) === type.id,
                }">
                {{ type.typename }}
              </NuxtLink>
            </template>

            <span v-else-if="!isGlobalLoading" class="text-gray-400 text-xs"> بارگذاری دسته‌بندی‌ها... </span>
          </div>
        </nav>
      </header>

      <main class="flex-1 flex flex-col" :class="{ '!pt-28': route.path !== '/login' && route.path !== '/information' }">
        <div v-if="isGlobalLoading" class="w-full h-[90vh] !pb-24 flex items-center justify-center bg-white">
          <AppLoader />
        </div>

        <div v-show="!isGlobalLoading" :class="{ 'mx-auto px-6 py-8 w-full': route.path !== '/login' && route.path !== '/information' && route.path !== '/' }">
          <slot />
        </div>
      </main>

      <Transition name="toast-slide">
        <div v-if="toast.show" class="toast toast-top toast-start z-[9999]">
          <div class="py-2 text-white px-6 max-w-[40vh] flex items-center gap-2 font-semibold" :class="['alert', toast.type]">
            <v-icon v-if="toast.type === 'alert-error'" class="!text-2xl">mdi-alert</v-icon>
            <v-icon v-if="toast.type === 'alert-success'" class="!text-2xl">mdi-check-circle</v-icon>
            <span>{{ toast.message }}</span>
          </div>
        </div>
      </Transition>

      <footer v-if="route.path !== '/login'" class="bg-neutral-900 text-white pt-10 pb-4 relative z-20">
        <div class="container mx-auto px-10">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 items-start gap-8 mb-12">
            <!-- ستون ۱: درباره ما -->
            <div>
              <div class="flex items-center gap-2 mb-2 !-mt-2">
                <img src="/images/logo.png" class="h-10 w-auto brightness-0 invert opacity-80" alt="Logo" />
                <h3 class="text-lg font-bold text-white">مزین شاپ</h3>
              </div>
              <p class="text-gray-400 text-sm leading-7 text-justify">
                فروشگاه اینترنتی مزین‌شاپ با هدف ارائه محصولات باکیفیت و تجربه خریدی آسان و مطمئن راه‌اندازی شده است. ما بر این باوریم که مشتریان لایق بهترین‌ها هستند و تمام تلاش
                خود را برای جلب رضایت شما به کار می‌گیریم.
              </p>
            </div>

            <!-- ستون ۲: دسترسی سریع و دسته‌بندی‌ها -->
            <div class="!flex !items-center gap-5">
              <div class="flex flex-col gap-2 text-sm text-gray-400">
                <h3 class="text-lg font-semibold mb-2 text-white">دسترسی سریع</h3>
                <NuxtLink to="/" class="hover:text-primary transition-colors">صفحه اصلی</NuxtLink>
                <NuxtLink to="/products" class="hover:text-primary transition-colors">محصولات</NuxtLink>
                <NuxtLink to="/information" class="hover:text-primary transition-colors">حساب کاربری</NuxtLink>
              </div>
              <!-- دسته‌بندی‌ها -->
              <div class="flex flex-col gap-2">
                <template v-if="visibleTypes.length > 0">
                  <div class="mb-2 font-semibold text-white text-lg">دسته‌بندی‌های محبوب</div>
                  <NuxtLink v-for="type in visibleTypes.slice(0, 4)" :key="type.id" :to="`/products?type=${type.id}`" class="hover:text-primary text-sm transition-colors">
                    {{ type.typename }}
                  </NuxtLink>
                </template>
              </div>
            </div>

            <!-- ستون ۳: اطلاعات تماس -->
            <div>
              <h3 class="text-lg font-bold mb-4 text-white">ارتباط با ما</h3>
              <ul class="space-y-4 text-sm text-gray-400">
                <li>
                  <a href="tel:09358203460" class="flex items-center gap-3 hover:text-white transition-colors group">
                    <div class="bg-neutral-800 p-2 rounded-full group-hover:bg-primary transition-colors">
                      <v-icon size="small" color="white">mdi-phone</v-icon>
                    </div>
                    <span dir="ltr">0935 820 3460</span>
                  </a>
                </li>
                <li>
                  <a href="https://wa.me/989358203460" target="_blank" class="flex items-center gap-3 hover:text-white transition-colors group">
                    <div class="bg-neutral-800 p-2 rounded-full group-hover:bg-green-600 transition-colors">
                      <v-icon size="small" color="white">mdi-whatsapp</v-icon>
                    </div>
                    <span>واتساپ پشتیبانی</span>
                  </a>
                </li>
                <li>
                  <a href="mailto:info@alishop.ir" class="flex items-center gap-3 hover:text-white transition-colors group">
                    <div class="bg-neutral-800 p-2 rounded-full group-hover:bg-primary transition-colors">
                      <v-icon size="small" color="white">mdi-email</v-icon>
                    </div>
                    <span>info@alishop.ir</span>
                  </a>
                </li>
                <li class="flex items-start gap-3">
                  <div class="bg-neutral-800 p-2 rounded-full mt-1">
                    <v-icon size="small" color="white">mdi-map-marker</v-icon>
                  </div>
                  <span class="mt-2">تهران، میدان آزادی، خیابان آزادی، پلاک ۱۱۰</span>
                </li>
              </ul>
              <div class="flex gap-4 md:mt-0">
                <v-btn icon variant="text" size="small" color="grey" class="hover:!text-white"><v-icon>mdi-instagram</v-icon></v-btn>
                <v-btn icon variant="text" size="small" color="grey" class="hover:!text-white"><v-icon>mdi-twitter</v-icon></v-btn>
                <v-btn icon variant="text" size="small" color="grey" class="hover:!text-white"><v-icon>mdi-linkedin</v-icon></v-btn>
              </div>
            </div>

            <!-- ستون ۴: نماد اعتماد -->
            <div>
              <h3 class="text-lg font-bold mb-4 text-white">نمادهای اعتماد</h3>
              <div class="flex flex-wrap gap-4">
                <div class="bg-white/10 rounded-xl p-2 w-20 h-20 flex items-center justify-center cursor-pointer hover:bg-white/20 transition-all">
                  <v-icon size="40" color="grey-lighten-1">mdi-shield-check</v-icon>
                </div>
                <div class="bg-white/10 rounded-xl p-2 w-20 h-20 flex items-center justify-center cursor-pointer hover:bg-white/20 transition-all">
                  <v-icon size="40" color="grey-lighten-1">mdi-certificate</v-icon>
                </div>
              </div>
              <p class="text-xs text-gray-500 mt-4">با اطمینان خرید کنید. پرداخت امن و ارسال سریع تضمین شده است.</p>
            </div>
          </div>

          <div class="flex flex-col md:flex-row justify-center items-center text-xs text-gray-500 pb-2">
            <p>تمامی حقوق مادی و معنوی این وب‌سایت محفوظ و متعلق به مجموعه مزین‌شاپ میباشد.</p>
          </div>
        </div>
      </footer>

      <ClientOnly>
        <v-menu v-if="isAdmin" location="top">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-plus" size="large" color="primary" position="fixed" location="bottom left" class="ma-4 z-30"></v-btn>
          </template>

          <v-list>
            <v-list-item @click="openProductDialog()">
              <v-list-item-title>افزودن محصول</v-list-item-title>
            </v-list-item>
            <v-list-item @click="typesDialog = true">
              <v-list-item-title>مدیریت انواع</v-list-item-title>
            </v-list-item>
            <v-list-item @click="attributesDialog = true">
              <v-list-item-title>مدیریت ویژگی‌ها</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>

        <v-dialog v-model="productDialog" max-width="700px" persistent>
          <v-card class="!rounded-xl">
            <!-- <div @click="closeProductDialog"><v-icon>mdi-close</v-icon></div> -->
            <v-tabs v-model="tab" bg-color="primary" grow>
              <v-tab value="details">۱. مشخصات اصلی</v-tab>
              <v-tab value="variants" :disabled="!productForVariantManagement">۲. نسخه‌ها و قیمت</v-tab>
            </v-tabs>

            <v-card-text>
              <v-window v-model="tab">
                <v-window-item value="details">
                  <AddProductForm :product-to-edit="productToEdit" @submitted="handleProductSubmitted" @cancel="closeProductDialog" />
                </v-window-item>

                <v-window-item value="variants">
                  <VariantManager v-if="productForVariantManagement" :product-id="productForVariantManagement.id" />
                  <div v-else class="text-center pa-4 text-grey">ابتدا مشخصات اصلی محصول را در تب قبل ذخیره کنید.</div>
                </v-window-item>
              </v-window>
            </v-card-text>

            <v-btn color="blue-darken-1" variant="text" @click="closeProductDialog">
              {{ productForVariantManagement ? "پایان و بستن" : "انصراف" }}
            </v-btn>
          </v-card>
        </v-dialog>

        <v-dialog v-model="typesDialog" max-width="800px">
          <v-card class="!rounded-xl !p-0">
            <v-card-title><span class="text-h5">مدیریت انواع محصول</span></v-card-title>
            <v-card-text><TypeManager /></v-card-text>
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn color="blue-darken-1" variant="text" @click="typesDialog = false">بستن</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog v-model="attributesDialog" max-width="500px">
          <v-card class="!rounded-xl !p-0">
            <v-card-title><span class="text-h5">مدیریت ویژگی‌ها</span></v-card-title>
            <v-card-text><AttributeManager /></v-card-text>
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn color="blue-darken-1" variant="text" @click="attributesDialog = false">بستن</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </ClientOnly>

      <ClientOnly>
        <v-dialog v-model="logoutDialog" max-width="400px" persistent>
          <v-card class="!rounded-xl !p-0">
            <v-card-title class="!text-lg font-bold !pt-5 !px-5">
              <v-icon color="warning" class="ml-2">mdi-alert-outline</v-icon>
              تایید خروج
            </v-card-title>
            <v-card-text class="!pt-4 !pb-2 !px-5"> آیا مطمئن هستید که می‌خواهید از حساب کاربری خود خارج شوید؟ </v-card-text>
            <v-card-actions class="!px-5 !pb-4">
              <v-spacer></v-spacer>
              <v-btn class="rounded-lg" variant="text" @click="logoutDialog = false"> انصراف </v-btn>
              <v-btn color="error" class="rounded-lg" variant="flat" @click="confirmLogout"> خروج </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </ClientOnly>
    </div>
  </v-app>
</template>

<style scoped>
.hover-underline-animation {
  display: inline-block;
  position: relative;
}

.hover-underline-animation::after {
  content: "";
  position: absolute;
  width: 100%;
  transform: scaleX(0);
  height: 2px;
  bottom: 0;
  left: 0;
  background-color: #6d5842d2;
  transition: transform 0.25s ease-out;
}

.hover-underline-animation:hover::after {
  transform: scaleX(1);
}

.hover-underline-animation.right::after {
  transform-origin: bottom left;
}

.hover-underline-animation.right:hover::after {
  transform-origin: bottom right;
}
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.5s ease-in-out;
}

.toast-slide-enter-from,
.toast-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.toast-slide-enter-to,
.toast-slide-leave-from {
  transform: translateX(0);
  opacity: 1;
}

/* انیمیشن برای دراپ‌داون سرچ */
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
