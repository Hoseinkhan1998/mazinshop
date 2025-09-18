<template>
  <div class="relative h-full">
    <header class="backdrop-blur-2xl sticky top-0 z-30">
      <nav class="container mx-auto px-10 py-4 flex justify-between items-center">
        <div class="flex items-center gap-3">
          <NuxtLink to="/" class="text-xl font-bold text-gray-800">
            <img src="/images/logo.png" class="h-14 w-20" alt="" />
          </NuxtLink>
          <NuxtLink v-if="isAdmin && $route.path !== '/editproduct'" to="/editproduct" class="px-2 rounded-lg mybg hov py-1">ویرایش فروشگاه من</NuxtLink>
          <div class="ms-10 flex items-center gap-10">
            <NuxtLink to="/" :class="{ 'border-b-2 border-stone-600': $route.path === '/' }" class="!flex items-center gap-1 cursor-pointer pb-1 hover-underline-animation right">
              <v-icon class="text-stone-500">mdi-home-account</v-icon>
              <p>خانه</p>
            </NuxtLink>
            <NuxtLink to="/products" :class="{ 'border-b-2 border-stone-600': $route.path === '/products' }" class="!flex items-center gap-1 pb-1 cursor-pointer hover-underline-animation right">
              <v-icon class="text-stone-500">mdi-package-variant-closed</v-icon>
              <p>محصولات</p>
            </NuxtLink>
            <NuxtLink to="/aboutus" :class="{ 'border-b-2 border-stone-600': $route.path === '/aboutus' }" class="!flex items-center gap-1 pb-1 cursor-pointer hover-underline-animation right">
              <v-icon class="text-stone-500">mdi-account-circle-outline</v-icon>
              <p>درباره ما</p>
            </NuxtLink>
            <NuxtLink to="/contactus" :class="{ 'border-b-2 border-stone-600': $route.path === '/contactus' }" class="!flex items-center gap-1 pb-1 cursor-pointer hover-underline-animation right">
              <v-icon class="text-stone-500">mdi-phone-plus</v-icon>
              <p>تماس با ما</p>
            </NuxtLink>
            <div class="flex items-center">
              <v-icon class="absolute !-ml-8 text-stone-500">mdi-magnify</v-icon>
              <input
                type="text"
                placeholder="جستجو..."
                class="rounded-lg border ring-1 !text-sm ring-stone-400 focus:ring-1 focus:ring-stone-600 outline-none px-3 py-1 w-64 pr-10" />
            </div>
          </div>
        </div>
        <!-- name & shoppingcard -->
        <ClientOnly>
          <NuxtLink v-if="!isLoggedIn" to="/login">
            <div class="bg-stone-600 !text-white rounded-lg hover:bg-stone-500 transition-all duration-150 px-4 py-2">ورود / ثبت نام</div>
          </NuxtLink>
          <div v-else class="flex items-center gap-3">
            <span class="!text-stone-600 font-semibold">{{ displayName }}</span>
            <NuxtLink to="/shoppingcard" class="cursor-pointer relative">
              <div class="rounded-full bg-red-500 text-xs flex justify-center items-center text-white absolute -top-2 -right-2 px-1">۳</div>
              <v-icon class="!text-3xl">mdi-cart-variant</v-icon>
            </NuxtLink>
            <div @click="authStore.signOut()" class="px-4 py-1 mybg hov cursor-pointer rounded-md">خروج</div>
          </div>
        </ClientOnly>
      </nav>
    </header>

    <main class="container mx-auto px-6 py-8">
      <slot />
    </main>
    <ClientOnly>
      <v-menu v-if="isAdmin" location="top">
        <template v-slot:activator="{ props }">
          <v-btn v-bind="props" icon="mdi-plus" size="large" color="primarymain" position="fixed" location="bottom left" class="ma-4"></v-btn>
        </template>

        <v-list>
          <v-list-item @click="productDialog = true">
            <v-list-item-title>افزودن محصول</v-list-item-title>
          </v-list-item>
          <v-list-item @click="typesDialog = true">
            <v-list-item-title>مدیریت انواع</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-dialog v-model="productDialog" max-width="600px">
        <v-card class=" !rounded-xl">
          <v-card-text>
            <AddProductForm @submitted="productDialog = false" @cancel="productDialog = false" />
          </v-card-text>
        </v-card>
      </v-dialog>

      <v-dialog v-model="typesDialog" max-width="500px">
        <v-card class=" rounded-xl">
          <v-card-text>
            <TypeManager />
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <!-- <v-btn color="blue-darken-1" variant="text" @click="typesDialog = false">بستن</v-btn> -->
          </v-card-actions>
        </v-card>
      </v-dialog>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useAuthStore } from "~/stores/auth";
import AddProductForm from "~/components/AddProductForm.vue";
import TypeManager from "~/components/TypeManager.vue"; // کامپوننت جدید را وارد می‌کنیم

const authStore = useAuthStore();

const isLoggedIn = computed(() => authStore.isLoggedIn);
const displayName = computed(() => authStore.displayName);
const isAdmin = computed(() => authStore.isAdmin);

// دو متغیر برای کنترل دو دیالوگ جداگانه
const productDialog = ref(false);
const typesDialog = ref(false);

const props = defineProps<{
  title: string;
}>();
</script>

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
</style>
