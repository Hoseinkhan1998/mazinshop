<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import axios from "axios";
import { useAuthStore } from "~/stores/auth";
import { useCartStore } from "~/stores/cart";
import { useToast } from "~/composables/useToast";
import { useGlobalLoading } from "~/composables/useGlobalLoading";

definePageMeta({
  middleware: "authenticated",
});

const { $supabase, $config } = useNuxtApp();
const authStore = useAuthStore();
const cartStore = useCartStore();
const router = useRouter();
const { trigger: showToast } = useToast();

const { setGlobalLoading } = useGlobalLoading();
const firstLoadDone = ref(false);
setGlobalLoading(true);

const confirmDeleteOpen = ref(false);
const addressIdToDelete = ref<number | null>(null);

type Address = {
  id: number;
  created_at: string;
  user_id: string;
  title: string;
  recipient_name: string;
  province: string;
  city: string;
  street_address: string;
  plaque: string;
  unit: string | null;
  postal_code: string;
  phone: string;
  email: string | null;
  is_default: boolean;
};

const loading = ref(true);
const addresses = ref<Address[]>([]);
const mode = ref<"select" | "create">("select");
const selectedAddressId = ref<number | null>(null);

// فرم آدرس جدید
const form = ref({
  title: "",
  province: "",
  city: "",
  recipient_name: "",
  street_address: "",
  plaque: "",
  unit: "",
  postal_code: "",
  phone: "",
  email: "",
});
const formErrors = ref<Record<string, string>>({});

// ===== Helpers =====
const formatNumber = (n: number) => n.toLocaleString("fa-IR");
const canSubmit = computed(() => {
  // همه به جز email باید پر باشند
  const f = form.value;
  return f.title.trim() && f.province.trim() && f.recipient_name.trim() && f.city.trim() && f.street_address.trim() && f.plaque.trim() && f.postal_code.trim() && f.phone.trim();
});

const selectedAddress = computed(() => addresses.value.find((a) => a.id === selectedAddressId.value) || null);
const phoneRules = [(v: string) => !!v || "شماره موبایل الزامی است", (v: string) => v.length === 11 || "شماره موبایل باید 11 رقم باشد"];

const postalCodeRules = [(v: string) => !!v || "کد پستی الزامی است", (v: string) => v.length === 10 || "کد پستی باید 10 رقم باشد"];

const loadAddresses = async () => {
  setGlobalLoading(true);
  loading.value = true;
  try {
    const {
      data: { session },
    } = await $supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("User not authenticated");

    const url = `${$config.public.supabaseUrl}/rest/v1/addresses?select=*&order=is_default.desc,created_at.desc`;
    const { data } = await axios.get(url, {
      headers: {
        apikey: $config.public.supabaseKey,
        Authorization: `Bearer ${token}`,
      },
    });

    addresses.value = data;
    // اگر آدرسی هست، یکی رو انتخاب کن (اولویت با is_default=true)
    if (addresses.value.length > 0) {
      const def = addresses.value.find((a) => a.is_default) || addresses.value[0];
      selectedAddressId.value = def.id;
      mode.value = "select";
    } else {
      // اگر آدرسی نیست، فرم ایجاد را نشان بده
      mode.value = "create";
    }
  } catch (e) {
    console.error(e);
    showToast("خطا در دریافت آدرس‌ها", "error");
    mode.value = "create";
  } finally {
    loading.value = false;
    firstLoadDone.value = true;
    setGlobalLoading(false);
  }
};

onMounted(async () => {
  await cartStore.initializeCart(); // برای خلاصه فاکتور
  await loadAddresses();
});

// اگر وسط کار لاگ‌اوت شد، به لاگین برگرد
watch(
  () => authStore.isLoggedIn,
  (is) => {
    if (!is) router.replace({ path: "/login", query: { redirect: "/userInfo" } });
  }
);

// ذخیره آدرس جدید
const saveAddress = async () => {
  formErrors.value = {};
  if (!canSubmit.value) {
    showToast("لطفاً تمام فیلدهای الزامی را پر کنید.", "error");
    return;
  }

  try {
    const {
      data: { session },
    } = await $supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("User not authenticated");
    // بررسی اعتبارسنجی شماره موبایل و کد پستی
    if (form.value.phone.length !== 11) {
      showToast("شماره موبایل باید 11 رقم باشد", "error");
      return;
    }

    if (form.value.postal_code.length !== 10) {
      showToast("کد پستی باید 10 رقم باشد", "error");
      return;
    }
    // اگر کاربر هیچ آدرسی ندارد، اولین آدرس را پیش‌فرض می‌کنیم
    const makeDefault = addresses.value.length === 0;

    const payload = {
      title: form.value.title.trim(),
      recipient_name: form.value.recipient_name.trim(),
      province: form.value.province.trim(),
      city: form.value.city.trim(),
      street_address: form.value.street_address.trim(),
      plaque: form.value.plaque.trim(),
      unit: form.value.unit?.trim() || null,
      postal_code: form.value.postal_code.trim(),
      phone: form.value.phone.trim(),
      email: form.value.email?.trim() || null,
      is_default: makeDefault,
    };

    const url = `${$config.public.supabaseUrl}/rest/v1/addresses`;
    const { data } = await axios.post(url, payload, {
      headers: {
        apikey: $config.public.supabaseKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
    });

    const newAddr: Address = data[0];
    addresses.value.unshift(newAddr);
    selectedAddressId.value = newAddr.id;
    mode.value = "select";
    showToast("آدرس با موفقیت ثبت شد.", "success");
  } catch (e: any) {
    console.error(e);
    showToast("خطا در ثبت آدرس.", "error");
  }
};

// انتخاب آدرس پیش‌فرض
const makeDefaultAddress = async (id: number) => {
  try {
    const {
      data: { session },
    } = await $supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("User not authenticated");

    // 1) همه آدرس‌های کاربر را از is_default بردار
    const urlAll = `${$config.public.supabaseUrl}/rest/v1/addresses?is_default=eq.true`;
    await axios.patch(
      `${$config.public.supabaseUrl}/rest/v1/addresses`,
      { is_default: false },
      {
        headers: {
          apikey: $config.public.supabaseKey,
          Authorization: `Bearer ${token}`,
        },
        params: { user_id: `eq.${authStore.user?.id}`, is_default: "eq.true" },
      }
    );

    // 2) آدرس انتخابی را پیش‌فرض کن
    await axios.patch(
      `${$config.public.supabaseUrl}/rest/v1/addresses?id=eq.${id}`,
      { is_default: true },
      {
        headers: {
          apikey: $config.public.supabaseKey,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // به‌روزرسانی محلی
    addresses.value = addresses.value.map((a) => ({ ...a, is_default: a.id === id }));
    selectedAddressId.value = id;
    showToast("آدرس پیش‌فرض به‌روزرسانی شد.", "success");
  } catch (e) {
    console.error(e);
    showToast("خطا در به‌روزرسانی آدرس پیش‌فرض.", "error");
  }
};

const goAddNew = () => {
  // ریست فرم و رفتن به حالت ساخت
  form.value = {
    title: "",
    province: "",
    recipient_name: "",
    city: "",
    street_address: "",
    plaque: "",
    unit: "",
    postal_code: "",
    phone: "",
    email: "",
  };
  mode.value = "create";
};

const askDeleteAddress = (id: number) => {
  addressIdToDelete.value = id;
  confirmDeleteOpen.value = true;
};

const deleteAddress = async () => {
  if (!addressIdToDelete.value) return;
  try {
    const {
      data: { session },
    } = await $supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("User not authenticated");

    const id = addressIdToDelete.value;

    // تلاش برای حذف
    await axios.delete(`${$config.public.supabaseUrl}/rest/v1/addresses?id=eq.${id}`, {
      headers: {
        apikey: $config.public.supabaseKey,
        Authorization: `Bearer ${token}`,
      },
    });

    // حذف محلی
    const wasDefault = addresses.value.find((a) => a.id === id)?.is_default;
    addresses.value = addresses.value.filter((a) => a.id !== id);

    // اگر آدرس انتخابی/پیش‌فرض حذف شد، یکی دیگر را جایگزین کن
    if (selectedAddressId.value === id) {
      selectedAddressId.value = addresses.value[0]?.id ?? null;
    }
    if (wasDefault && addresses.value[0]) {
      // یکی را پیش‌فرض کن (اولی)
      await axios.patch(
        `${$config.public.supabaseUrl}/rest/v1/addresses?id=eq.${addresses.value[0].id}`,
        { is_default: true },
        {
          headers: {
            apikey: $config.public.supabaseKey,
            Authorization: `Bearer ${token}`,
          },
        }
      );
      // به‌روزرسانی محلی
      addresses.value = addresses.value.map((a, i) => ({ ...a, is_default: i === 0 }));
    }

    showToast("آدرس حذف شد.", "success");
  } catch (e: any) {
    // اگر در سفارشی استفاده شده باشد، FK مانع حذف می‌شود
    const code = e?.response?.data?.code;
    if (code === "23503") {
      showToast("این آدرس در یک سفارش استفاده شده و قابل حذف نیست.", "error");
    } else {
      showToast("حذف آدرس با خطا مواجه شد.", "error");
    }
    console.error(e);
  } finally {
    confirmDeleteOpen.value = false;
    addressIdToDelete.value = null;
  }
};

// تأیید و پرداخت (فعلاً ماک)
const confirmAndPay = () => {
  if (!selectedAddressId.value && mode.value !== "create") {
    showToast("لطفاً یک آدرس را انتخاب کنید یا آدرس جدید ثبت کنید.", "error");
    return;
  }
  // بعداً: ایجاد سفارش (orders + order_items) و رفتن به درگاه
  showToast("به مرحله پرداخت منتقل می‌شوید (ماک).", "info");
  // router.push("/payment"); // بعداً
};
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <h1  class="text-2xl md:text-3xl font-bold mb-6">اطلاعات ارسال و فاکتور</h1>
    <div v-if="!firstLoadDone" class="w-full h-[60vh] flex items-center justify-center">
      <AppLoader />
    </div>

    <div v-else-if="firstLoadDone" class="grid grid-cols-12 gap-6">
      <!-- راست: آدرس/فرم -->      
      <div class="col-span-6">
        <!-- حالت انتخاب آدرس‌های موجود -->
        <div v-if="mode === 'select'">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold">آدرس‌های شما</h2>
            <v-btn color="primary" variant="flat" @click="goAddNew">افزودن آدرس جدید</v-btn>
          </div>

          <v-radio-group v-model="selectedAddressId">
            <v-card v-for="addr in addresses" :key="addr.id" class="mb-3 p-4" :class="[addr.is_default ? 'border-2 border-primary' : 'border']" flat border>
              <div class="flex items-start gap-3">
                <v-radio :value="addr.id" color="primary" class="mt-1"></v-radio>
                <div class="flex-1">
                  <div class="flex items-center justify-between">
                    <p class="font-semibold">
                      {{ addr.title }}
                      <span v-if="addr.is_default" class="text-xs text-primary ml-2">(پیش‌فرض)</span>
                    </p>
                    <p class="text-sm text-gray-600 mt-1">گیرنده: {{ addr.recipient_name }}</p>

                    <div class="flex items-center gap-2">
                      <v-btn size="small" variant="text" @click="makeDefaultAddress(addr.id)" :disabled="addr.is_default">انتخاب به‌عنوان پیش‌فرض</v-btn>
                      <v-btn size="small" variant="text" color="red" @click="askDeleteAddress(addr.id)">حذف</v-btn>
                    </div>
                  </div>
                  <p class="text-sm text-gray-600 mt-1">
                    {{ addr.province }}، {{ addr.city }}، {{ addr.street_address }}، پلاک {{ addr.plaque }}
                    <template v-if="addr.unit">، واحد {{ addr.unit }}</template>
                  </p>
                  <p class="text-sm text-gray-600 mt-1">کدپستی: {{ addr.postal_code }}</p>
                  <p class="text-sm text-gray-600 mt-1">
                    موبایل: {{ addr.phone }} <span v-if="addr.email">| ایمیل: {{ addr.email }}</span>
                  </p>
                </div>
              </div>
            </v-card>
          </v-radio-group>
        </div>

        <!-- حالت ساخت آدرس جدید -->
        <div v-else>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold">افزودن آدرس جدید</h2>
            <v-btn variant="text" @click="mode = addresses.length ? 'select' : 'create'">بازگشت</v-btn>
          </div>

          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12 md:col-span-4">
              <v-text-field v-model="form.title" label="عنوان آدرس *" variant="outlined" density="compact" hide-details required />
            </div>
            <div class="col-span-12 md:col-span-4">
              <v-text-field v-model="form.recipient_name" label="نام و نام خانوادگی گیرنده *" variant="outlined" density="compact" hide-details required />
            </div>
            <div class="col-span-12 md:col-span-4">
              <v-text-field
                v-model="form.phone"
                label="شماره موبایل *"
                type="number"
                variant="outlined"
                density="compact"
                :rules="phoneRules"
                hide-spin-buttons
                :maxlength="11"
                required />
            </div>

            <div class="col-span-12 md:col-span-6">
              <v-text-field v-model="form.province" label="استان *" variant="outlined" density="compact" hide-details required />
            </div>
            <div class="col-span-12 md:col-span-6">
              <v-text-field v-model="form.city" label="شهر / شهرستان *" variant="outlined" density="compact" hide-details required />
            </div>

            <div class="col-span-12">
              <v-text-field v-model="form.street_address" label="آدرس پستی *" variant="outlined" density="compact" hide-details required />
            </div>

            <div class="col-span-6 md:col-span-3">
              <v-text-field v-model="form.plaque" label="پلاک *" variant="outlined" density="compact" hide-details required />
            </div>
            <div class="col-span-6 md:col-span-3">
              <v-text-field v-model="form.unit" label="واحد (اختیاری)" variant="outlined" density="compact" hide-details />
            </div>
            <div class="col-span-12 md:col-span-6">
              <v-text-field
                v-model="form.postal_code"
                label="کد پستی *"
                type="number"
                variant="outlined"
                density="compact"
                :rules="postalCodeRules"
                hide-spin-buttons
                :maxlength="10"
                required />
            </div>

            <div class="col-span-12">
              <v-text-field v-model="form.email" label="ایمیل (اختیاری)" type="email" variant="outlined" density="compact" hide-details />
            </div>
          </div>

          <div class="mt-4">
            <v-btn color="primary" :disabled="!canSubmit" @click="saveAddress">ثبت آدرس</v-btn>
          </div>
        </div>
      </div>

      <!-- چپ: فاکتور خرید -->
      <div class="col-span-12 md:col-span-5">
        <v-card flat border class="p-4">
          <h2 class="text-xl font-semibold mb-4">خلاصه فاکتور</h2>

          <div v-if="cartStore.items.length === 0" class="text-gray-500">سبد خرید شما خالی است.</div>

          <div v-else class="space-y-3">
            <div v-for="item in cartStore.items" :key="item.variantId" class="flex items-center gap-3">
              <v-img :src="item.image" width="64" height="64" cover class="rounded-md border"></v-img>
              <div class="flex-1">
                <p class="font-medium truncate">{{ item.name }}</p>
                <p class="text-sm text-gray-500">{{ item.variantName }}</p>
              </div>
              <div class="text-left">
                <p class="text-sm">تعداد: {{ formatNumber(item.quantity) }}</p>
                <p class="font-semibold">{{ formatNumber(item.price * item.quantity) }} تومان</p>
              </div>
            </div>

            <v-divider class="my-4"></v-divider>

            <div class="flex items-center justify-between">
              <span class="font-semibold">جمع کل</span>
              <span class="font-bold text-lg">{{ formatNumber(cartStore.totalPrice) }} تومان</span>
            </div>

            <v-btn color="primary" block class="mt-4" :disabled="cartStore.items.length === 0" @click="confirmAndPay"> تایید و پرداخت </v-btn>
          </div>
        </v-card>
      </div>
    </div>
  </div>
  <!-- Confirm Delete Address -->
  <v-dialog v-model="confirmDeleteOpen" max-width="420">
    <v-card class="!rounded-xl">
      <v-card-title class="font-bold">حذف آدرس</v-card-title>
      <v-card-text>
        آیا از حذف این آدرس مطمئن هستید؟
        <div class="text-sm text-gray-500 mt-2">توجه: اگر این آدرس در سفارشی استفاده شده باشد، امکان حذف آن وجود ندارد.</div>
      </v-card-text>
      <v-card-actions class="justify-end gap-2">
        <v-btn variant="text" @click="confirmDeleteOpen = false">انصراف</v-btn>
        <v-btn color="red" @click="deleteAddress">حذف</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
