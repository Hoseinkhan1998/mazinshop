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
const editingAddressId = ref<number | null>(null);
const notSelfRecipient = ref(false);
const personal = ref({
  full_name: "",
  phone: "",
});

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
  const f = form.value;
  const baseFilled = f.title.trim() && f.province.trim() && f.city.trim() && f.street_address.trim() && f.plaque.trim() && f.postal_code.trim();

  if (!baseFilled) return false;

  if (notSelfRecipient.value) {
    // گیرنده کس دیگری است
    return f.recipient_name.trim() && f.phone.trim();
  } else {
    // گیرنده خود کاربر است
    return personal.value.full_name.trim() && personal.value.phone.trim();
  }
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
  if (!authStore.profile) {
    await authStore.fetchUser();
  }
  personal.value.full_name = authStore.profile?.full_name || "";
  personal.value.phone = authStore.profile?.phone_number || "";
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

    // تعیین گیرنده نهایی
    const finalRecipientName = notSelfRecipient.value ? form.value.recipient_name.trim() : personal.value.full_name.trim();
    const finalRecipientPhone = notSelfRecipient.value ? form.value.phone.trim() : personal.value.phone.trim();

    if (!finalRecipientName || !finalRecipientPhone) {
      showToast("نام و شماره موبایل گیرنده الزامی است.", "error");
      return;
    }

    if (finalRecipientPhone.length !== 11) {
      showToast("شماره موبایل گیرنده باید 11 رقم باشد", "error");
      return;
    }

    if (form.value.postal_code.length !== 10) {
      showToast("کد پستی باید 10 رقم باشد", "error");
      return;
    }

    // اگر گیرنده خود کاربر است و اسم جدیدی وارد کرده، پروفایل را آپدیت کن
    if (!notSelfRecipient.value) {
      const newName = personal.value.full_name.trim();
      const oldName = authStore.profile?.full_name?.trim() || "";
      const userId = authStore.user?.id;
      if (userId && newName && newName !== oldName) {
        await $supabase.from("profiles").update({ full_name: newName }).eq("id", userId);
        await authStore.fetchUser();
      }
    }

    const makeDefault = addresses.value.length === 0 && !editingAddressId.value;

    const payload = {
      title: form.value.title.trim(),
      recipient_name: finalRecipientName,
      province: form.value.province.trim(),
      city: form.value.city.trim(),
      street_address: form.value.street_address.trim(),
      plaque: form.value.plaque.trim(),
      unit: form.value.unit?.trim() || null,
      postal_code: form.value.postal_code.trim(),
      phone: finalRecipientPhone,
      email: form.value.email?.trim() || null,
      ...(makeDefault ? { is_default: true } : {}),
    };

    let saved: Address;

    if (editingAddressId.value) {
      // ویرایش
      const url = `${$config.public.supabaseUrl}/rest/v1/addresses?id=eq.${editingAddressId.value}`;
      const { data } = await axios.patch(url, payload, {
        headers: {
          apikey: $config.public.supabaseKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
      });
      saved = data[0];
      const idx = addresses.value.findIndex((a) => a.id === editingAddressId.value);
      if (idx !== -1) addresses.value[idx] = saved;
      showToast("آدرس با موفقیت ویرایش شد.", "success");
    } else {
      // ایجاد
      const url = `${$config.public.supabaseUrl}/rest/v1/addresses`;
      const { data } = await axios.post(url, payload, {
        headers: {
          apikey: $config.public.supabaseKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
      });
      saved = data[0];
      addresses.value.unshift(saved);
      showToast("آدرس با موفقیت ثبت شد.", "success");
    }

    selectedAddressId.value = saved.id;
    editingAddressId.value = null;
    mode.value = "select";
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
  editingAddressId.value = null;
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
  notSelfRecipient.value = false;
  mode.value = "create";
};

const startEditAddress = (addr: Address) => {
  mode.value = "create";
  editingAddressId.value = addr.id;
  form.value = {
    title: addr.title || "",
    province: addr.province || "",
    city: addr.city || "",
    recipient_name: "",
    street_address: addr.street_address || "",
    plaque: addr.plaque || "",
    unit: addr.unit || "",
    postal_code: addr.postal_code || "",
    phone: "",
    email: addr.email || "",
  };

  const selfName = personal.value.full_name?.trim() || "";
  const selfPhone = personal.value.phone?.trim() || "";
  const isSelf = selfName && selfPhone && addr.recipient_name === selfName && addr.phone === selfPhone;

  notSelfRecipient.value = !isSelf;
  if (!isSelf) {
    form.value.recipient_name = addr.recipient_name;
    form.value.phone = addr.phone;
  }
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
  <div v-if="!firstLoadDone" class="w-full min-h-screen !mt-[-16vh] flex items-center justify-center">
    <AppLoader />
  </div>
  <div v-else class="container mx-auto px-4 py-8">
    <h1 class="text-2xl md:text-3xl font-bold mb-6">اطلاعات ارسال و فاکتور</h1>

    <div class="grid grid-cols-12 gap-6">
      <!-- راست: آدرس/فرم -->
      <div class="col-span-12 lg:col-span-7 sticky top-36 h-fit">
        <!-- حالت انتخاب آدرس‌های موجود -->
        <div v-if="mode === 'select'">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold">آدرس‌های شما</h2>
            <button class="rounded-lg px-2 py-1 mybg hov" @click="goAddNew">افزودن آدرس جدید</button>
          </div>

          <v-radio-group v-model="selectedAddressId" hide-details>
            <div
              v-for="addr in addresses"
              :key="addr.id"
              class="w-full grid grid-cols-12 items-center px-3 py-3 mt-3 border rounded-lg"
              :class="{ 'border-primary border-2': selectedAddressId === addr.id }">
              <!-- Radio -->
              <div class="col-span-1 flex justify-center">
                <v-radio :value="addr.id" color="primary" density="compact" hide-details></v-radio>
              </div>

              <!-- Content -->
              <div class="grid grid-cols-12 gap-3 col-span-10">
                <div class="col-span-full flex items-center gap-3 font-semibold truncate">
                  {{ addr.title }}
                  <p v-if="addr.is_default" class="text-xs text-primary">(پیش‌فرض)</p>
                  <div v-if="!addr.is_default" class="mybg text-xs hov py-1 cursor-pointer !px-2 rounded-lg text-white" @click.stop="makeDefaultAddress(addr.id)">
                    انتخاب به عنوان پیش‌فرض
                  </div>
                </div>
                <p class="text-sm text-gray-600 mt-1 col-span-12">
                  {{ addr.province }}، {{ addr.city }}، {{ addr.street_address }}، پلاک {{ addr.plaque }}
                  <template v-if="addr.unit">، واحد {{ addr.unit }}</template>
                </p>
                <p class="text-xs text-gray-600 mt-1 col-span-12">گیرنده: {{ addr.recipient_name }} | موبایل: {{ addr.phone }}</p>
              </div>

              <!-- Actions -->
              <div class="col-span-1 gap-2 flex justify-end items-center text-xs">
                <div @click.stop="startEditAddress(addr)" class="cursor-pointer text-blue-600">
                  <v-icon>mdi-pencil</v-icon>
                  <v-tooltip class="text-xs" activator="parent" location="bottom"> ویرایش آدرس</v-tooltip>
                </div>
                <div class="cursor-pointer text-red-600" @click.stop="askDeleteAddress(addr.id)">
                  <v-icon>mdi-delete</v-icon>
                  <v-tooltip class="text-xs" activator="parent" location="bottom"> حذف آدرس</v-tooltip>
                </div>
              </div>
            </div>
          </v-radio-group>
        </div>

        <!-- حالت ساخت آدرس جدید -->
        <div v-else>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold">{{ editingAddressId ? 'ویرایش آدرس' : 'افزودن آدرس جدید' }}</h2>
            <v-btn v-if="addresses.length > 0" variant="text" class="rounded-lg mybg hov" @click="mode = 'select'">انتخاب از بین آدرس‌های موجود</v-btn>
          </div>

          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12 md:col-span-6">
              <v-text-field v-model="form.province" label="استان *" variant="outlined" density="compact" hide-details required />
            </div>
            <div class="col-span-12 md:col-span-6">
              <v-text-field v-model="form.city" label="شهر / شهرستان *" variant="outlined" density="compact" hide-details required />
            </div>

            <div class="col-span-12">
              <v-text-field v-model="form.street_address" label="آدرس کامل *" variant="outlined" density="compact" hide-details required />
            </div>

            <div class="col-span-6 md:col-span-6">
              <v-text-field v-model="form.plaque" label="پلاک *" variant="outlined" density="compact" hide-details required />
            </div>
            <div class="col-span-6 md:col-span-6">
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
            <div class="col-span-12 md:col-span-6">
              <v-text-field v-model="form.title" label="عنوان آدرس (منزل، محل کار و...)*" variant="outlined" density="compact" hide-details required />
            </div>

            <!-- Toggle گیرنده -->
            <div class="col-span-12 flex items-center gap-2">
              <v-switch v-model="notSelfRecipient" density="compact" color="primary" hide-details :label="'گیرنده خودم نیستم'" />
            </div>

            <!-- فیلدهای گیرنده -->
            <div v-if="notSelfRecipient" class="col-span-12 md:col-span-6">
              <v-text-field v-model="form.recipient_name" label="نام و نام خانوادگی گیرنده *" variant="outlined" density="compact" hide-details required />
            </div>
            <div v-if="notSelfRecipient" class="col-span-12 md:col-span-6">
              <v-text-field
                v-model="form.phone"
                label="شماره موبایل گیرنده *"
                type="number"
                variant="outlined"
                density="compact"
                :rules="phoneRules"
                hide-spin-buttons
                hide-details
                :maxlength="11"
                required />
            </div>

            <div class="col-span-12">
              <v-text-field v-model="form.email" label="ایمیل (اختیاری)" type="email" variant="outlined" density="compact" hide-details />
            </div>
          </div>

          <div class="mt-4">
            <v-btn color="primary" class="rounded-lg" :disabled="!canSubmit" @click="saveAddress">
              {{ editingAddressId ? 'ویرایش آدرس' : 'ثبت آدرس' }}
            </v-btn>
            <v-btn v-if="editingAddressId" variant="text" class="mr-2" @click="mode = 'select'">انصراف</v-btn>
          </div>
        </div>
      </div>

      <!-- چپ: فاکتور خرید -->
      <div class="col-span-12 lg:col-span-4 sticky top-28 h-fit">
        <div class="bg-stone-50 rounded-3xl border border-stone-100 !p-6 shadow-sm">
          <h2 class="text-xl font-black text-stone-800 mb-6 pb-4 border-b border-dashed border-stone-200">فاکتور پرداخت</h2>

          <div class="!space-y-4 mb-8">
            <div class="flex justify-between items-center text-stone-500">
              <span class="text-sm font-medium">قیمت کالاها ({{ formatNumber(cartStore.totalItems) }})</span>
              <span class="font-bold text-stone-700">{{ formatNumber(cartStore.totalPrice) }} تومان</span>
            </div>

            <div class="flex justify-between items-center text-stone-500">
              <span class="text-sm font-medium">هزینه ارسال</span>
              <div class="text-left">
                <p v-if="selectedAddressId" class="text-xs font-bold text-green-600">بر اساس تعرفه پست</p>
                <p v-else class="text-[10px] text-orange-500">انتخاب آدرس الزامی است</p>
              </div>
            </div>

            <div v-if="selectedAddress" class="pt-3 border-t border-stone-100">
              <span class="text-[10px] text-stone-400 block mb-1">ارسال به:</span>
              <p class="text-[11px] font-bold text-stone-600 line-clamp-1">{{ selectedAddress.province }}، {{ selectedAddress.city }}، {{ selectedAddress.title }}</p>
            </div>

            <div class="pt-4 border-t-2 border-stone-200 flex justify-between items-center">
              <span class="text-base font-bold text-stone-800">مبلغ قابل پرداخت:</span>
              <div class="text-left">
                <p class="text-2xl font-black text-primary">{{ formatNumber(cartStore.totalPrice) }}</p>
                <p class="text-[10px] text-stone-500 font-bold">تومان</p>
              </div>
            </div>
          </div>

          <v-tooltip :disabled="!!selectedAddressId" location="top" text="هنوز هیچ آدرسی انتخاب نشده است">
            <template v-slot:activator="{ props }">
              <div v-bind="props" class="flex justify-center items-center px-10">
                <button
                  class="!rounded-2xl !text-lg !font-bold mybg hov w-full py-2 elevation-0 transition-all duration-300"
                  :class="!selectedAddressId || cartStore.totalItems === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer opacity-100'"
                  :disabled="!selectedAddressId || cartStore.totalItems === 0"
                  @click="confirmAndPay">
                  تأیید و پرداخت نهایی
                  <v-icon end class="ms-2">mdi-credit-card-outline</v-icon>
                </button>
              </div>
            </template>
          </v-tooltip>

          <div class="mt-6 flex items-center gap-3 justify-center text-stone-400">
            <v-icon size="18">mdi-shield-lock-outline</v-icon>
            <span class="text-[10px] font-medium">پرداخت از طریق درگاه رسمی و امن</span>
          </div>
        </div>
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
