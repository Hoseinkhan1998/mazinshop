<script setup lang="ts">
import { useCartStore } from "~/stores/cart";
import { useToast } from "~/composables/useToast";
import { useAuthStore } from "~/stores/auth";
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useGlobalLoading } from "~/composables/useGlobalLoading";

const cartStore = useCartStore();
const authStore = useAuthStore();
const router = useRouter();
const { trigger: showToast } = useToast();
const showLoginPrompt = ref(false);

const { setGlobalLoading } = useGlobalLoading();
const firstLoadDone = ref(false);
setGlobalLoading(true);

// در زمان بارگذاری این صفحه (اگر کاربر مستقیماً وارد شود)
// سبد خرید را بارگذاری می‌کنیم
onMounted(async () => {
  await cartStore.initializeCart();
  firstLoadDone.value = true;
  setGlobalLoading(false);
});

const formatNumber = (num: number) => {
  return num.toLocaleString("fa-IR");
};

const handleProceedToCheckout = () => {
  if (cartStore.totalItems === 0) return;
  if (authStore.isLoggedIn) {
    router.push("/userInfo");
  } else {
    showLoginPrompt.value = true;
  }
};

const goToLogin = () => {
  router.push({ path: "/login", query: { redirect: "/userInfo" } });
};

const handleUpdateQuantity = async (variantId: number, newQuantity: number) => {
  try {
    await cartStore.updateQuantity(variantId, newQuantity);
  } catch (error: any) {
    showToast(error.message, "error");
  }
};

const handleRemoveItem = (variantId: number) => {
  cartStore.removeItem(variantId);
  showToast("محصول از سبد خرید حذف شد.", "info");
};
</script>

<template>
  <div v-if="!firstLoadDone" class="w-full min-h-screen !mt-[-16vh] flex items-center justify-center">
    <AppLoader />
  </div>
  <div
    v-else-if="!cartStore.items || cartStore.items.length === 0"
    class="flex flex-col items-center justify-center min-h-[50vh] bg-white rounded-3xl border border-dashed border-stone-200 p-10 shadow-sm">
    <v-icon size="100" color="stone-lighten-3" class="mb-6 opacity-20">mdi-cart-off</v-icon>
    <p class="text-xl font-bold text-stone-400 mb-6">سبد خرید شما فعلاً خالی است!</p>
    <v-btn to="/products" color="primary" height="48" class="!rounded-xl !px-10 font-bold mybg hov"> شروع خرید از MazinShop </v-btn>
  </div>
  <div v-else class="mx-auto px-4 lg:px-8">
    <div class="flex items-center gap-4 mb-8">
      <h1 class="text-3xl font-black text-stone-800">سبد خرید</h1>
      <v-chip v-if="cartStore.totalItems > 0" color="primary" size="small" variant="flat"> {{ formatNumber(cartStore.totalItems) }} کالا </v-chip>
    </div>

    <div class="grid grid-cols-12 gap-8 items-start">
      <!-- سبد خرید -->
      <div class="col-span-12 lg:col-span-8 !space-y-4">
        <div
          v-for="item in cartStore.items"
          :key="item.variantId"
          class="group bg-white rounded-xl border border-stone-100 p-4 transition-all duration-300 hover:shadow-xl hover:shadow-stone-100 grid grid-cols-12 gap-6 items-center">
          <div class="w-32 h-32 flex-shrink-0 bg-stone-50 rounded-xl overflow-hidden border border-stone-50 p-2 col-span-2">
            <img :src="item.image" :alt="item.name" class="w-full h-full object-contain mix-blend-multiply" />
          </div>

          <div class="col-span-10">
            <div class="grid grid-cols-12">
              <h2 class="text-lg font-semibold col-span-11 text-stone-800 mb-2 truncate">{{ item.name }}</h2>
              <v-btn icon variant="tonal" color="red-lighten-4" size="40" class="!rounded-xl col-span-1" @click="handleRemoveItem(item.variantId)">
                <v-icon size="20" color="red">mdi-trash-can-outline</v-icon>
                <v-tooltip activator="parent" location="top">حذف کالا</v-tooltip>
              </v-btn>
            </div>
            <div class="flex items-center ps-3 gap-2 mb-4">
              <v-icon size="16" color="stone-lighten-2">mdi-layers-outline</v-icon>
              <span class="text-xs text-stone-500 font-medium">{{ item.variantName }}</span>
            </div>

            <div class="flex pe-5 items-center justify-between gap-4">
              <div class="flex items-center bg-stone-50 rounded-xl border border-stone-100 p-1">
                <v-btn icon variant="text" size="32" color="primary" @click="handleUpdateQuantity(item.variantId, item.quantity + 1)" :disabled="item.quantity >= item.stock">
                  <v-icon size="18">mdi-plus</v-icon>
                </v-btn>
                <span class="w-10 text-center font-black text-stone-700">{{ formatNumber(item.quantity) }}</span>
                <v-btn icon variant="text" size="32" @click="handleUpdateQuantity(item.variantId, item.quantity - 1)" :disabled="item.quantity <= 1">
                  <v-icon size="18">mdi-minus</v-icon>
                </v-btn>
              </div>

              <div class="flex items-center gap-6">
                <div class="flex flex-col items-end">
                  <p class="text-lg font-black text-stone-800">{{ formatNumber(item.price) }} <span class="text-[10px] text-stone-500">تومان</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- خلاصه سفارش -->
      <div class="col-span-12 lg:col-span-4 sticky top-28">
        <div class="bg-stone-50 rounded-3xl border border-stone-100 !p-6 shadow-sm">
          <h2 class="text-xl font-bold text-stone-800 mb-6 pb-4 border-b border-dashed border-stone-200">خلاصه سفارش</h2>

          <div class="!space-y-4 mb-8">
            <div class="flex justify-between items-center text-stone-500">
              <span class="text-sm">قیمت کالاها ({{ formatNumber(cartStore.totalItems) }})</span>
              <span class="font-bold">{{ formatNumber(cartStore.totalPrice) }} تومان</span>
            </div>
            <div class="flex justify-between items-center text-stone-500">
              <span class="text-sm">هزینه ارسال</span>
              <span class="text-xs font-bold text-green-600">وابسته به آدرس</span>
            </div>
            <div class="pt-4 border-t border-stone-200 flex justify-between items-center">
              <span class="text-base font-bold text-stone-800">جمع کل سبد خرید:</span>
              <div class="text-left">
                <p class="text-2xl font-black text-primary">{{ formatNumber(cartStore.totalPrice) }}</p>
                <p class="text-[10px] text-stone-500 font-bold">تومان</p>
              </div>
            </div>
          </div>
          <div class="flex justify-center items-center px-10">
            <button class="!rounded-2xl !text-lg  w-full py-2 flex items-center justify-center !font-semibold mybg hov" :disabled="cartStore.totalItems === 0" @click="handleProceedToCheckout">
              ادامه فرآیند خرید
              <v-icon end class="ms-2">mdi-chevron-left</v-icon>
            </button>
          </div>
          <div class="mt-6 flex items-center gap-3 justify-center text-gray-400">
            <v-icon size="20">mdi-shield-check-outline</v-icon>
            <span class="text-[10px]">پرداخت امن و ضمانت بازگشت کالا</span>
          </div>
        </div>
      </div>
    </div>

    <v-dialog v-model="showLoginPrompt" max-width="450">
      <v-card class="!rounded-3xl !p-6">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <v-icon size="32" color="primary">mdi-account-lock-outline</v-icon>
          </div>
          <h3 class="text-xl font-bold text-stone-800">نیاز به ورود به حساب</h3>
          <p class="text-sm text-stone-500 mt-2">برای ثبت سفارش و ادامه تسویه‌حساب، لطفاً ابتدا وارد شوید.</p>
        </div>
        <div class="flex flex-col gap-3">
          <v-btn color="primary" height="48" class="!rounded-xl font-bold mybg hov" @click="goToLogin"> ورود یا ثبت‌نام </v-btn>
          <v-btn variant="text" color="stone" @click="showLoginPrompt = false"> انصراف و بازگشت </v-btn>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>
