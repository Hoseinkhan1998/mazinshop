<script setup lang="ts">
import { ref, computed } from "vue";
import { useAuthStore } from "~/stores/auth";
import { useToast } from "~/composables/useToast";
import { useRoute, useRouter } from "vue-router";

const { $supabase } = useNuxtApp();
const authStore = useAuthStore();
const { trigger: showToast } = useToast();
const route = useRoute();
const router = useRouter();

const redirectTo = computed(() => {
  const q = (route.query.redirect as string) || "/";
  return q.startsWith("/") ? q : "/";
});

const phone = ref("");
const fullName = ref("");
const otp = ref("");
const step = ref<"enter-phone" | "enter-otp">("enter-phone");
const loading = ref(false);
const errorMessage = ref("");

const phoneIranRegex = /^09\d{9}$/;

const sendCode = async () => {
  errorMessage.value = "";
  if (!phoneIranRegex.test(phone.value)) {
    errorMessage.value = "شماره موبایل نامعتبر است (مثال: 09123456789)";
    return;
  }

  loading.value = true;
  try {
    const resp = await $fetch("/api/auth/send-otp", {
      method: "POST",
      body: { phone: phone.value, full_name: fullName.value.trim() },
    });
    if (!(resp as any)?.success) throw new Error("ارسال کد با خطا مواجه شد.");
    showToast("کد تایید ارسال شد.", "success");
    step.value = "enter-otp";
  } catch (e: any) {
    errorMessage.value = e?.data?.statusMessage || e?.message || "ارسال کد با خطا مواجه شد.";
  } finally {
    loading.value = false;
  }
};

const verifyCode = async () => {
  errorMessage.value = "";
  if (!otp.value) {
    errorMessage.value = "کد تایید را وارد کنید.";
    return;
  }
  loading.value = true;
  try {
    const resp = await $fetch("/api/auth/verify-otp", {
      method: "POST",
      body: { phone: phone.value, code: otp.value },
    });
    const tokens = (resp as any)?.tokens;
    if (!tokens) throw new Error("تایید کد با خطا مواجه شد.");

    await $supabase.auth.setSession(tokens);
    await authStore.fetchUser();
    showToast("با موفقیت وارد شدید!", "success");
    router.push(redirectTo.value);
  } catch (e: any) {
    errorMessage.value = e?.data?.statusMessage || e?.message || "کد نامعتبر است.";
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <ClientOnly>
    <div class="grid grid-cols-1 lg:grid-cols-2 overflow-hidden h-screen">
      <div class="flex relative justify-center items-center h-full bg-white">
        <div class="absolute top-5 right-5 z-20">
          <router-link
            to="/"
            class="cursor-pointer flex items-center justify-center !rounded-2xl px-5 py-2 gap-2 mybg border border-stone-200 hover:bg-stone-100 transition-all duration-300 text-stone-700">
            <v-icon size="18">mdi-arrow-right</v-icon>
            <p class="text-xs font-bold">بازگشت به خانه</p>
          </router-link>
        </div>

        <div class="flex flex-col justify-center items-center w-full h-full px-4 lg:bg-none bg-center bg-no-repeat relative">
          <img src="/images/login1.png" class="lg:hidden absolute inset-0 w-full h-full object-cover opacity-20" alt="" />

          <div class="login-glass-card !p-10 !rounded-3xl w-full max-w-[450px] z-10">
            <div class="text-center mb-8">
              <!-- <p class="text-stone-500 text-sm font-medium mb-1">خوش آمدید!</p> -->
              <h2 class="text-xl font-bold text-stone-800">به<span class="mazin-logo-text text-3xl mx-1">مزین شاپ</span> خوش آمدید</h2>
            </div>

            <div v-if="step === 'enter-phone'">
              <div class="mb-4">
                <v-text-field
                  density="comfortable"
                  rounded="lg"
                  type="number"
                  hide-spin-buttons
                  v-model="phone"
                  label="شماره موبایل"
                  placeholder="09123456789"
                  variant="outlined"
                  color="#6d5842"
                  required />
              </div>

              <p v-if="errorMessage" class="text-red-500 mb-4 text-xs text-center font-bold">{{ errorMessage }}</p>

              <v-btn class="group !rounded-xl" :loading="loading" color="primarymain" block height="48" @click="sendCode">
                <span class="font-bold">ارسال کد تایید</span>
                <v-icon class="ms-2 opacity-0 group-hover:opacity-100 transition-all duration-300" size="18">mdi-chevron-left</v-icon>
              </v-btn>
            </div>

            <div v-else>
              <div class="mb-4">
                <v-text-field density="comfortable" rounded="lg" v-model="otp" label="کد تایید پیامک شده" variant="outlined" color="#6d5842" required />
              </div>

              <p v-if="errorMessage" class="text-red-500 mb-4 text-xs text-center font-bold">{{ errorMessage }}</p>

              <v-btn :loading="loading" color="primarymain" block height="48" class="!rounded-xl font-bold" @click="verifyCode">تایید و ورود</v-btn>
              <v-btn variant="text" block class="mt-4 !text-stone-500 !text-xs" @click="step = 'enter-phone'">ویرایش شماره موبایل</v-btn>
            </div>
          </div>
        </div>
      </div>

      <div class="hidden lg:block h-screen relative overflow-hidden">
        <img src="/public/images/login2.png" class="h-full w-full object-cover object-center scale-105" alt="MazinShop Login" />
        <div class="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
      </div>
    </div>
  </ClientOnly>
</template>

<style scoped>
/* انیمیشن برای حرکت رنگ‌ها در متن */
@keyframes rgb-flow {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.mazin-logo-text {
  /* گرادینت رنگی هماهنگ با تم سایت شما (طلایی، قهوه‌ای روشن، نارنجی ملایم) */
  background: linear-gradient(90deg, #6d5842, #b3a08a, #d4af37, #6d5842);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  display: inline-block;
  font-weight: 900;
  animation: rgb-flow 4s ease infinite;
}

.login-glass-card {
  background: rgba(255, 255, 255, 0.75) !important;
  backdrop-filter: blur(12px) !important;
  border: 1px solid rgba(109, 88, 66, 0.2) !important;
  box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.1) !important;
}
</style>
