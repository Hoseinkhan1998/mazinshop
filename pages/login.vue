<template>
  <div class="max-w-md mx-auto mt-10 p-8 border rounded-lg shadow-lg bg-white">
    <h2 class="text-2xl font-bold text-center mb-6">{{ isRegisterMode ? "ثبت‌نام کاربر جدید" : "ورود به حساب کاربری" }}</h2>

    <form @submit.prevent="handleSubmit">
      <div v-if="isRegisterMode" class="mb-4">
        <label for="fullName" class="block text-gray-700 font-semibold mb-2">نام و نام خانوادگی</label>
        <input type="text" v-model="fullName" id="fullName" class="w-full px-3 py-2 border rounded-md" required />
      </div>
      <div class="mb-4">
        <label for="email" class="block text-gray-700 font-semibold mb-2">ایمیل</label>
        <input type="email" v-model="email" id="email" class="w-full px-3 py-2 border rounded-md" required />
      </div>
      <div class="mb-6">
        <label for="password" class="block text-gray-700 font-semibold mb-2">رمز عبور</label>
        <input type="password" v-model="password" id="password" class="w-full px-3 py-2 border rounded-md" required />
        <p class="text-xs text-gray-500 mt-1">رمز عبور باید شامل حروف و اعداد انگلیسی باشد.</p>
      </div>

      <p v-if="errorMessage" class="text-red-500 mb-4 text-sm">{{ errorMessage }}</p>

      <button type="submit" class="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700">
        {{ isRegisterMode ? "ثبت‌نام" : "ورود" }}
      </button>
    </form>

    <div class="mt-6 text-center">
      <button @click="isRegisterMode = !isRegisterMode" class="text-blue-600 hover:underline">
        {{ isRegisterMode ? "حساب کاربری دارید؟ وارد شوید" : "حساب کاربری ندارید؟ ثبت‌نام کنید" }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useAuthStore } from "~/stores/auth";
import { getSupabaseClient } from "~/utils/supabase";

const authStore = useAuthStore();
const router = useRouter();
// ما هنوز برای signUp به کلاینت نیاز داریم
const supabase = getSupabaseClient();

const isRegisterMode = ref(false);
const email = ref("");
const password = ref("");
const fullName = ref("");
const errorMessage = ref("");

const handleSubmit = async () => {
  errorMessage.value = "";
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
        // بعد از ثبت‌نام موفق، پروفایل را واکشی کرده و به صفحه اصلی می‌رویم
        await authStore.fetchUser();
        alert("ثبت‌نام با موفقیت انجام شد و وارد شدید!");
        router.push("/");
      }
    } else {
      // حالت ورود
      // از اکشن جدید در store استفاده می‌کنیم
      await authStore.signIn(email.value, password.value);
      // بعد از اینکه ورود و واکشی پروفایل تمام شد، هدایت می‌شویم
      router.push("/");
    }
  } catch (error: any) {
    errorMessage.value = error.message;
  }
};
</script>
