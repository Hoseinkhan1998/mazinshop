<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "~/stores/auth";
import type { Product } from "~/types/Product";
import AddProductForm from "~/components/AddProductForm.vue";
import TypeManager from "~/components/TypeManager.vue";
import AttributeManager from "~/components/AttributeManager.vue";
import VariantManager from "~/components/VariantManager.vue";
import { useToast } from "~/composables/useToast";
import { useCartStore } from "~/stores/cart";
import { useTypesStore } from "~/stores/types";
import { useProductStore } from "~/stores/products";

const authStore = useAuthStore();
const { toast } = useToast();
const route = useRoute();
const router = useRouter();

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
const tab = ref<"details" | "variants">("details"); // کنترل تب فعال

// ---------- سرچ هدر ----------
const searchText = ref("");
const searchLoading = ref(false);
const showSearchDropdown = ref(false);
const searchRawResults = ref<any[]>([]);

let searchTimeout: any = null;

// هر بار متن سرچ عوض شد ⇒ با دی‌بونس به API سرچ بفرست
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

// پیشنهادهای دسته‌بندی بر اساس نتایج محصول
const typeSuggestions = computed(() => {
  const map = new Map<number, { typeId: number; typeName: string; count: number }>();

  for (const p of searchRawResults.value) {
    const tId = p.type_id as number | null;
    if (!tId) continue;

    if (!map.has(tId)) {
      const tName = (p.types && p.types.typename) || typesStore.types.find((t) => t.id === tId)?.typename || "دسته‌بندی نامشخص";

      map.set(tId, {
        typeId: tId,
        typeName: tName,
        count: 0,
      });
    }
    map.get(tId)!.count++;
  }

  // حداکثر مثلاً ۵ دسته‌بندی
  return Array.from(map.values()).slice(0, 5);
});

// ارسال سرچ با Enter یا کلیک روی آیکون ⇒ سرچ سراسری روی همه دسته‌ها (بدون type)
const submitSearch = () => {
  const q = searchText.value.trim();
  if (!q) return;
  showSearchDropdown.value = false;
  router.push({
    path: "/products",
    query: { search: q },
  });
};

// کلیک روی پیشنهاد دسته‌بندی ⇒ سرچ در همان دسته
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

onMounted(async () => {
  cartStore.initializeCart();

  if (typesStore.types.length === 0) {
    await typesStore.fetchTypes();
  }
  if (productStore.products.length === 0) {
    await productStore.fetchProducts();
  }
});

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
    // اگر بعداً خواستی قابلیت ویرایش رو هم اضافه کنی، اینجا مقدار بده
    // productToEdit.value = product;
    // productForVariantManagement.value = product;
  } else {
    productToEdit.value = null; // هیچ محصولی برای ویرایش اولیه نیست
    productForVariantManagement.value = null; // هنوز محصولی ساخته نشده
    tab.value = "details";
  }
  productDialog.value = true;
};

const handleProductSubmitted = (product: Product) => {
  productForVariantManagement.value = product;
  tab.value = "variants"; // به صورت خودکار به تب دوم می‌رویم
};

// تابع برای بستن و ریست کردن کامل دیالوگ
const closeProductDialog = () => {
  productDialog.value = false;
  setTimeout(() => {
    productToEdit.value = null;
    productForVariantManagement.value = null; // ریست کردن برای دفعه بعد
    tab.value = "details";
  }, 300);
};

const confirmLogout = () => {
  authStore.signOut();
  logoutDialog.value = false;
};
</script>

<template>
  <v-app>
    <div class="relative h-full">
      <header v-if="route.path !== '/login' && route.path !== '/information'" class="backdrop-blur-2xl sticky top-0 z-30">
        <nav class="container mx-auto px-10 py-4 grid grid-cols-12 items-center">
          <ClientOnly class="col-span-9">
            <div class="grid grid-cols-12 items-center">
              <NuxtLink to="/" class="text-xl col-span-2 font-bold text-gray-800">
                <img src="/images/logo.png" class="h-14 w-20" alt="" />
              </NuxtLink>
              <div v-if="isAdmin && $route.path !== '/editproduct'" class="col-span-2 !-ms-10">
                <NuxtLink to="/editproduct" class="px-2 rounded-lg mybg hov py-1">ویرایش فروشگاه من</NuxtLink>
              </div>
              <div class="ms-5 col-span-6 flex items-center gap-10">
                <div class="relative flex items-center w-full group">
                  <div class="absolute left-2 p-2 rounded-full hover:bg-stone-100 cursor-pointer transition-colors duration-200 z-10" @click="submitSearch">
                    <v-icon class="text-stone-500">mdi-magnify</v-icon>
                  </div>

                  <input
                    v-model="searchText"
                    @keyup.enter="submitSearch"
                    type="text"
                    placeholder="جستجو در محصولات، دسته‌ها و ..."
                    class="w-full bg-stone-50 border-0 ring-1 ring-stone-200 text-stone-700 placeholder-stone-400 !rounded-2xl px-4 py-3 pl-12 focus:ring-2 focus:ring-stone-500 focus:bg-white shadow-sm transition-all duration-300 ease-in-out outline-none text-sm font-medium" />

                  <Transition name="fade-slide">
                    <div
                      v-if="showSearchDropdown && (typeSuggestions.length || searchLoading)"
                      class="absolute z-50 w-full bg-white border border-stone-100 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] top-full mt-2 overflow-hidden flex flex-col">
                      <div v-if="searchLoading" class="p-4 flex items-center gap-3 text-stone-400 text-sm justify-center">
                        <v-progress-circular indeterminate color="grey" size="20" width="2"></v-progress-circular>
                        <span>در حال جستجو...</span>
                      </div>

                      <template v-else>
                        <div class="px-4 py-3 bg-stone-50 text-xs font-bold text-stone-400 border-b border-stone-100">پیشنهادهای دسته‌بندی</div>

                        <div
                          v-for="s in typeSuggestions"
                          :key="s.typeId"
                          class="group/item px-4 py-3 cursor-pointer hover:bg-stone-50 transition-colors duration-200 flex items-center justify-between border-b border-stone-50 last:border-0"
                          @mousedown.prevent="selectTypeSuggestion(s)">
                          <div class="flex flex-col gap-1">
                            <span class="text-stone-800 font-semibold text-sm group-hover/item:text-black transition-colors">
                              {{ searchText }}
                            </span>
                            <span class="text-xs text-stone-500 flex items-center gap-1">
                              در دسته‌بندی <span class="text-stone-700 font-medium bg-stone-200 px-1.5 py-0.5 rounded">{{ s.typeName }}</span>
                            </span>
                          </div>

                          <span class="text-xs bg-stone-100 text-stone-500 py-1 px-2 rounded-full group-hover/item:bg-white group-hover/item:shadow-sm transition-all">
                            {{ s.count }} کالا
                          </span>
                        </div>
                      </template>
                    </div>
                  </Transition>
                </div>
              </div>
            </div>
          </ClientOnly>
          <!-- name & shoppingcard -->
          <div class="flex items-center gap-3 col-span-3 justify-end">
            <ClientOnly v-if="isLoggedIn">
              <div class="dropdown dropdown-bottom">
                <div tabindex="0" role="button" class="flex items-center m-1 gap-2 py-1 border-2 border-neutral-400 border-solid rounded-lg px-4 hov mybg">
                  <v-icon class="text-white !text-2xl">mdi-account-circle</v-icon>
                  <p class="truncate max-w-40">{{ displayName }}</p>
                </div>
                <ul tabindex="0" class="dropdown-content relative menu gap-3 bg-neutral-100 mt-3 rounded-box z-[1] w-44 !p-2 shadow-xl shadow-neutral-200">
                  <NuxtLink to="/information" class="cursor-pointer hover:!bg-neutral-200 px-4 py-1 transition-all duration-150 rounded-lg">ویرایش پروفایل</NuxtLink>
                  <li>
                    <div @click="logoutDialog = true" class="px-4 py-1 bg-red-600 text-white font-semibold hover:bg-red-500 transition-all duration-150 cursor-pointer rounded-md">
                      خروج
                    </div>
                  </li>
                </ul>
              </div>
            </ClientOnly>

            <!-- سبد خرید: همیشه دیده شود -->
            <NuxtLink to="/shoppingcard" class="cursor-pointer relative" aria-label="سبد خرید">
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
          <!-- navigation types -->
          <div class="col-span-4 flex items-center gap-5 mt-4 text-sm">
            <ClientOnly>
              <template v-if="visibleTypes.length">
                <NuxtLink
                  v-for="type in visibleTypes"
                  :key="type.id"
                  :to="`/products?type=${type.id}`"
                  class="hover-underline-animation right cursor-pointer"
                  :class="{
                    'border-b-2 border-stone-600': $route.path.startsWith('/products') && Number($route.query.type) === type.id,
                  }">
                  {{ type.typename }}
                </NuxtLink>
              </template>

              <span v-else class="text-gray-400 text-xs"> فعلاً دسته‌بندی فعالی برای نمایش وجود ندارد. </span>
            </ClientOnly>
          </div>
        </nav>
      </header>

      <main class="" :class="{ 'mx-auto px-6 py-8': route.path !== '/login' && route.path !== '/information' }">
        <slot />
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

      <ClientOnly>
        <v-menu v-if="isAdmin" location="top">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-plus" size="large" color="primary" position="fixed" location="bottom left" class="ma-4"></v-btn>
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
          <v-card class="!p-0 !rounded-xl">
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

            <v-card-actions class="bg-grey-lighten-4">
              <v-spacer></v-spacer>
              <v-btn color="blue-darken-1" variant="text" @click="closeProductDialog">
                {{ productForVariantManagement ? "پایان و بستن" : "انصراف" }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog v-model="typesDialog" max-width="500px">
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
