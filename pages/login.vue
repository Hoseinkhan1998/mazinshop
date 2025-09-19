<script setup lang="ts">
// import { ref } from "vue";
import { useAuthStore } from "~/stores/auth";
import { getSupabaseClient } from "~/utils/supabase";
import { useToast } from "~/composables/useToast";

const authStore = useAuthStore();
const router = useRouter();
const supabase = getSupabaseClient();

const isRegisterMode = ref(false);
const email = ref("");
const password = ref("");
const fullName = ref("");
const confirmPassword = ref("");
const errorMessage = ref("");
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const { trigger: showToast } = useToast();


const handleSubmit = async () => {
  errorMessage.value = "";

  if (isRegisterMode.value && password.value !== confirmPassword.value) {
    errorMessage.value = "رمز عبور و تایید رمز عبور مطابقت ندارند.";
    return;
  }

  try {
    if (isRegisterMode.value) {
      // حالت ثبت‌نام
      const { data, error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
        options: {
          data: {
            full_name: fullName.value,
          },
        },
      });
      if (error) throw error;
      if (data.user) {        
        await authStore.fetchUser();
        showToast("ثبت‌نام با موفقیت انجام شد و وارد شدید!", "success");
        router.push("/");
      }
    } else {
      await authStore.signIn(email.value, password.value);
      showToast("با موفقیت وارد شدید!", "success");
      router.push("/");
    }
  } catch (error: any) {
    if (error.message === "Invalid login credentials") {
      errorMessage.value = "اطلاعات ورود نامعتبر است.";
    } else if (error.message === "User already registered") {
      errorMessage.value = "کاربر قبلا ثبت نام کرده است";
    } else {
      errorMessage.value = error.message;
    }
  }
};
</script>

<template>
  <div class="max-w-md mx-auto mt-10 !p-8 !rounded-xl border shadow-lg bg-white">
    <h2 class="text-2xl font-bold text-center mb-6">{{ isRegisterMode ? "ثبت‌نام کاربر جدید" : "ورود به حساب کاربری" }}</h2>

    <form @submit.prevent="handleSubmit">
      <div v-if="isRegisterMode" class="mb-4">
        <v-text-field density="compact" rounded="lg" v-model="fullName" label="نام و نام خانوادگی" variant="outlined" required></v-text-field>
      </div>
      <div class="mb-4">
        <v-text-field density="compact" rounded="lg" v-model="email" label="ایمیل" type="email" variant="outlined" required></v-text-field>
      </div>
      <div class="mb-4">
        <v-text-field density="compact" rounded="lg"
          v-model="password"
          :label="isRegisterMode ? 'رمز عبور' : 'رمز عبور'"
          :type="showPassword ? 'text' : 'password'"
          :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          @click:append-inner="showPassword = !showPassword"
          variant="outlined"
          required>
          <template v-slot:details>
            <p class="text-xs text-gray-500 mt-1">رمز عبور باید شامل حروف و اعداد انگلیسی باشد.</p>
          </template>
        </v-text-field>
      </div>
      <div v-if="isRegisterMode" class="mb-6">
        <v-text-field density="compact" rounded="lg"
          v-model="confirmPassword"
          label="تایید رمز عبور"
          :type="showConfirmPassword ? 'text' : 'password'"
          :append-inner-icon="showConfirmPassword ? 'mdi-eye-off' : 'mdi-eye'"
          @click:append-inner="showConfirmPassword = !showConfirmPassword"
          variant="outlined"
          required></v-text-field>
      </div>

      <p v-if="errorMessage" class="text-red-500 mb-4 text-sm">{{ errorMessage }}</p>

      <button type="submit" class="w-full py-2 mybg hov" >
        {{ isRegisterMode ? "ثبت‌ نام" : "ورود" }}
      </button>
    </form>

    <div class="mt-6 text-center">
      <button @click="isRegisterMode = !isRegisterMode" class="text-blue-600 hover:underline">
        {{ isRegisterMode ? "حساب کاربری دارید؟ وارد شوید" : "حساب کاربری ندارید؟ ثبت‌نام کنید" }}
      </button>
    </div>    
  </div>
</template>
