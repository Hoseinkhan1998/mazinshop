<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
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

onMounted(async () => {
  cartStore.initializeCart();

  if (typesStore.types.length === 0) {
    await typesStore.fetchTypes();
  }
  if (productStore.products.length === 0) {
    await productStore.fetchProducts();
  }
});
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
                <HeaderSearch />
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
                    <div @click="logoutDialog = true" class="px-4 py-1 bg-red-600 text-white font-semibold hover:bg-red-500 transition-all duration-150 cursor-pointer rounded-md">
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
