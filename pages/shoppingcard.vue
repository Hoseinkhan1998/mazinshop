<script setup lang="ts">
import { useCartStore } from "~/stores/cart";
import { useToast } from "~/composables/useToast";

const cartStore = useCartStore();
const { trigger: showToast } = useToast();

// در زمان بارگذاری این صفحه (اگر کاربر مستقیماً وارد شود)
// سبد خرید را بارگذاری می‌کنیم
onMounted(() => {
  cartStore.initializeCart();
});

const formatNumber = (num: number) => {
  return num.toLocaleString("fa-IR");
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
  <div class="container mx-auto p-4">
    <h1 class="text-3xl font-bold mb-6">سبد خرید شما</h1>

    <div v-if="cartStore.loading" class="text-center py-10">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
      <p>در حال بارگذاری سبد خرید...</p>
    </div>

    <div v-else-if="!cartStore.items || cartStore.items.length === 0" class="text-center py-10">
      <p class="text-2xl text-gray-500">سبد خرید شما خالی است.</p>
      <v-btn to="/" color="primary" class="mt-6">بازگشت به فروشگاه</v-btn>
    </div>

    <div v-else>
      <div class="space-y-4 mb-6">
        <v-card v-for="item in cartStore.items" :key="item.variantId" class="d-flex pa-4" flat border>
          <v-img :src="item.image" width="100" height="100" cover class="rounded-lg mr-4"></v-img>

          <div class="flex-grow-1">
            <h2 class="text-lg font-semibold">{{ item.name }}</h2>
            <p class="text-sm text-gray-500">{{ item.variantName }}</p>
            <p class="text-md font-bold text-green-600 mt-1">{{ formatNumber(item.price) }} تومان</p>
          </div>

          <div class="d-flex flex-column align-end justify-space-between">
            <div class="d-flex align-center">
              <v-btn icon="mdi-plus" size="small" @click="handleUpdateQuantity(item.variantId, item.quantity + 1)" :disabled="item.quantity >= item.stock"></v-btn>
              <span class="mx-3 font-semibold">{{ formatNumber(item.quantity) }}</span>
              <v-btn icon="mdi-minus" size="small" @click="handleUpdateQuantity(item.variantId, item.quantity - 1)"></v-btn>
            </div>
            <v-btn variant="text" color="red" size="small" @click="handleRemoveItem(item.variantId)">حذف</v-btn>
          </div>
        </v-card>
      </div>

      <v-divider class="my-6"></v-divider>
      <div class="text-left">
        <h2 class="text-2xl font-bold">جمع کل: {{ formatNumber(cartStore.totalPrice) }} تومان</h2>
        <v-btn color="primary" size="large" class="mt-4" :disabled="cartStore.totalItems === 0"> ادامه جهت تسویه حساب </v-btn>
      </div>
    </div>
  </div>
</template>
