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
  if (!fullName.value.trim()) {
    errorMessage.value = "نام و نام خانوادگی الزامی است.";
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
    <div class="max-w-md mx-auto mt-10 !p-8 !rounded-xl border shadow-lg bg-white">
      <h2 class="text-2xl font-bold text-center mb-6">ورود / ثبت‌نام با شماره موبایل</h2>

      <div v-if="step === 'enter-phone'">
        <div class="mb-4">
          <v-text-field density="compact" rounded="lg" v-model="phone" label="شماره موبایل (مثال: 09123456789)" variant="outlined" required />
        </div>
        <div class="mb-6">
          <v-text-field density="compact" rounded="lg" v-model="fullName" label="نام و نام خانوادگی" variant="outlined" required />
        </div>

        <p v-if="errorMessage" class="text-red-500 mb-4 text-sm">{{ errorMessage }}</p>

        <v-btn :loading="loading" color="primary" block @click="sendCode">ارسال کد تایید</v-btn>
      </div>

      <div v-else>
        <div class="mb-4">
          <v-text-field density="compact" rounded="lg" v-model="otp" label="کد تایید" variant="outlined" required />
        </div>

        <p v-if="errorMessage" class="text-red-500 mb-4 text-sm">{{ errorMessage }}</p>

        <v-btn :loading="loading" color="primary" block @click="verifyCode">تایید و ورود</v-btn>
        <v-btn variant="text" block class="mt-2" @click="step = 'enter-phone'">ویرایش شماره</v-btn>
      </div>
    </div>
  </ClientOnly>
</template>
