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
const personalFullName = ref(authStore.profile?.full_name || "");
const personalPhone = ref<string>("");
const personalNameError = ref<string>("");
const savingPersonal = ref(false);
const personal = ref({
  full_name: "",
  phone: "",
});

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
const mode = ref<"list" | "create">("list");
const editingAddressId = ref<number | null>(null);
const notSelfRecipient = ref(false);

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
    // گیرنده کس دیگری است → این دو باید پر شوند
    return f.recipient_name.trim() && f.phone.trim();
  } else {
    // گیرنده خود کاربر است → باید اطلاعات فردی کامل باشد
    return personal.value.full_name.trim() && personal.value.phone.trim();
  }
});

const phoneRules = [(v: string) => !!v || "شماره موبایل الزامی است", (v: string) => v.length === 11 || "شماره موبایل باید 11 رقم باشد"];

const postalCodeRules = [(v: string) => !!v || "کد پستی الزامی است", (v: string) => v.length === 10 || "کد پستی باید 10 رقم باشد"];

const personalNameRules = [
  (v: string) => {
    if (!notSelfRecipient.value && !v?.trim()) {
      return "لطفاً نام و نام خانوادگی خود را وارد کنید.";
    }
    return true;
  },
];

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
      mode.value = "list";
    } else {
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
  await cartStore.initializeCart();
  if (!authStore.profile) {
    await authStore.fetchUser();
  }

  personalPhone.value = authStore.profile?.phone_number || "";
  personal.value.full_name = authStore.profile?.full_name || "";
  personal.value.phone = authStore.profile?.phone_number || "";

  await loadAddresses();
});

// اگر وسط کار لاگ‌اوت شد، به لاگین برگرد
watch(
  () => authStore.isLoggedIn,
  (is) => {
    if (!is) router.replace({ path: "/login", query: { redirect: "/information" } });
  }
);

watch(
  () => authStore.profile,
  (profile) => {
    if (profile) {
      if (!personalPhone.value) {
        personalPhone.value = profile.phone_number || "";
      }
      if (!personalFullName.value && profile.full_name) {
        personalFullName.value = profile.full_name;
      }
    }
  },
  { immediate: true }
);

const savePersonalInfo = async () => {
  personalNameError.value = "";

  if (!personalFullName.value.trim()) {
    personalNameError.value = "لطفاً نام و نام خانوادگی خود را وارد کنید.";
    showToast("لطفاً نام و نام خانوادگی خود را وارد کنید.", "error");
    return;
  }

  try {
    savingPersonal.value = true;

    const {
      data: { session },
    } = await $supabase.auth.getSession();
    if (!session?.user) throw new Error("User not authenticated");

    const { error } = await $supabase.from("profiles").update({ full_name: personalFullName.value.trim() }).eq("id", session.user.id);

    if (error) throw error;

    // استور auth را به‌روز می‌کنیم تا هدر هم آپدیت شود
    await authStore.fetchUser();

    showToast("اطلاعات فردی با موفقیت ذخیره شد.", "success");
  } catch (e) {
    console.error(e);
    showToast("خطا در ذخیره اطلاعات فردی.", "error");
  } finally {
    savingPersonal.value = false;
  }
};

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

    // تعیین گیرنده نهایی بر اساس toggle
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
        const { error: profErr } = await $supabase.from("profiles").update({ full_name: newName }).eq("id", userId);

        if (!profErr) {
          // پروفایل استور را هم تازه کن
          await authStore.fetchUser();
        } else {
          console.error("Error updating profile full_name", profErr);
        }
      }
    }

    // اگر کاربر هیچ آدرسی ندارد، اولین آدرس را پیش‌فرض می‌کنیم
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
      // ویرایش آدرس موجود
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
      if (idx !== -1) {
        addresses.value[idx] = saved;
      }
      showToast("آدرس با موفقیت ویرایش شد.", "success");
    } else {
      // ایجاد آدرس جدید
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

    // ریست حالت فرم
    editingAddressId.value = null;
    mode.value = "list";
  } catch (e: any) {
    console.error(e);
    showToast("خطا در ثبت/ویرایش آدرس.", "error");
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

  // پر کردن فیلدهای اصلی آدرس
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

  // تشخیص اینکه گیرنده خود کاربر است یا نه
  const selfName = personal.value.full_name?.trim() || "";
  const selfPhone = personal.value.phone?.trim() || "";

  const addrName = addr.recipient_name?.trim() || "";
  const addrPhone = addr.phone?.trim() || "";

  const isSelf = selfName && selfPhone && addrName === selfName && addrPhone === selfPhone;

  if (isSelf) {
    // گیرنده خود کاربر است → toggle خاموش و فیلدهای گیرنده خالی
    notSelfRecipient.value = false;
    form.value.recipient_name = "";
    form.value.phone = "";
  } else {
    // گیرنده شخص دیگری است → toggle روشن و فیلدها با همان مقدار آدرس
    notSelfRecipient.value = true;
    form.value.recipient_name = addrName;
    form.value.phone = addrPhone;
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
    // حذف محلی
    const wasDefault = addresses.value.find((a) => a.id === id)?.is_default;
    addresses.value = addresses.value.filter((a) => a.id !== id);

    if (addresses.value.length === 0) {
      // هیچ آدرسی نمانده → برو روی حالت ساخت آدرس جدید
      mode.value = "create";

      // ریست کامل فرم و وضعیت گیرنده
      form.value = {
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
      };
      notSelfRecipient.value = false;
      editingAddressId.value = null;
    } else if (wasDefault) {
      // اگر آدرس پیش‌فرض حذف شد و هنوز آدرسی داریم، اولی را پیش‌فرض کن
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
</script>

<template>
  <div v-if="!firstLoadDone" class="w-full h-[90vh] !mt-[-5vh] flex items-center justify-center">
    <AppLoader />
  </div>

  <ClientOnly v-else-if="firstLoadDone">
    <div class="grid relative grid-cols-1 lg:grid-cols-2">
      <div class="flex flex-col px-4 relative w-full">
        <div class="absolute top-5 right-5">
          <router-link
            to="/"
            class="cursor-pointer flex items-center justify-center rounded-lg px-4 py-1 gap-2 border-2 hover:!bg-[#6d5842d2] !text-black hover:!text-white transition-all duration-150 border-neutral-400">
            <v-icon class="">mdi-arrow-right-bold-circle-outline</v-icon>
            <p>بازگشت</p>
          </router-link>
        </div>
        <!-- نام و شماره موبایل -->
        <p class="text-lg font-semibold mb-3 !mt-20">اطلاعات فردی</p>

        <div class="grid grid-cols-12 items-center gap-4 mb-3">
          <v-text-field
            v-model="personalFullName"
            rounded="lg"
            label="نام و نام خانوادگی"
            variant="outlined"
            density="compact"
            class="col-span-5"
            :error="!!personalNameError"
            :error-messages="personalNameError" />

          <v-text-field class="col-span-5" v-model="personalPhone" label="شماره موبایل" type="tel" rounded="lg" variant="outlined" density="compact" disabled />
          <v-btn color="primary" class="rounded-lg col-span-2 !-mt-6 mybg hov" :disabled="!personalFullName.trim().length" :loading="savingPersonal" @click="savePersonalInfo">
            ذخیره تغییرات
          </v-btn>
        </div>

        <!-- حالت انتخاب آدرس‌های موجود -->
        <div class="w-full !mt-5" v-if="mode === 'list'">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold">آدرس‌های شما</h2>
            <v-btn color="primary" class="rounded-lg mybg hov" variant="flat" @click="goAddNew">افزودن آدرس جدید</v-btn>
          </div>

          <div class="max-h-[70vh] overflow-y-auto">
            <div v-for="addr in addresses" :key="addr.id" class="grid grid-cols-12 items-center px-3 py-3 mt-3 border rounded-lg">
              <div class="grid grid-cols-12 gap-3 col-span-11">
                <div class="col-span-full flex items-center gap-3 font-semibold truncate">
                  {{ addr.title }}
                  <p v-if="addr.is_default" class="text-xs text-primary">(پیش‌فرض)</p>
                  <div v-if="!addr.is_default" class="mybg text-xs hov py-1 cursor-pointer !px-2 rounded-lg text-white" @click="makeDefaultAddress(addr.id)">انتخاب به عنوان پیش‌فرض</div>
                </div>
                <p class="text-sm text-gray-600 mt-1 col-span-12">
                  {{ addr.province }}، {{ addr.city }}، {{ addr.street_address }}، پلاک {{ addr.plaque }} 
                  <template v-if="addr.unit">، واحد {{ addr.unit }}</template>
                </p>
                <p class="text-xs text-gray-600 mt-1 col-span-12">
                  گیرنده:
                  {{ addr.recipient_name || authStore.profile?.full_name || "—" }}
                  | موبایل: {{ addr.phone }}
                </p>
              </div>
              <div class="col-span-1 gap-2 flex justify-end items-center text-xs">
                <!-- <v-btn size="small" variant="text" class="!text-blue-600" @click="startEditAddress(addr)">ویرایش</v-btn> -->
                <div @click="startEditAddress(addr)" class="cursor-pointer text-blue-600">
                  <v-icon>mdi-pencil</v-icon>
                  <v-tooltip class="text-xs" activator="parent" location="bottom"> ویرایش آدرس</v-tooltip>
                </div>
                <div class="cursor-pointer text-red-600" @click="askDeleteAddress(addr.id)">
                  <v-icon>mdi-delete</v-icon>
                  <v-tooltip class="text-xs" activator="parent" location="bottom"> حذف آدرس</v-tooltip>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- حالت ساخت آدرس جدید -->
        <div class="w-full !mt-5" v-else>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold">افزودن آدرس جدید</h2>
            <v-btn v-if="addresses.length !== 0" variant="text" class="rounded-lg mybg hov" @click="mode = addresses.length ? 'list' : 'create'">آدرس‌های موجود</v-btn>
          </div>

          <p v-if="addresses.length === 0" class="text-sm text-gray-500 mb-4">شما هنوز هیچ آدرسی ثبت نکرده‌اید. لطفاً فرم زیر را برای ثبت اولین آدرس خود تکمیل کنید.</p>

          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12 md:col-span-6">
              <v-text-field rounded="lg" v-model="form.province" label="استان *" variant="outlined" density="compact" hide-details required />
            </div>
            <div class="col-span-12 md:col-span-6">
              <v-text-field rounded="lg" v-model="form.city" label="شهر / شهرستان *" variant="outlined" density="compact" hide-details required />
            </div>
            <div class="col-span-12">
              <v-text-field rounded="lg" v-model="form.street_address" label="آدرس *" variant="outlined" density="compact" hide-details required />
            </div>
            <div class="col-span-6 md:col-span-6">
              <v-text-field rounded="lg" v-model="form.plaque" label="پلاک *" variant="outlined" density="compact" hide-details required />
            </div>
            <div class="col-span-6 md:col-span-6">
              <v-text-field rounded="lg" v-model="form.unit" label="واحد (اختیاری)" variant="outlined" density="compact" hide-details />
            </div>
            <div class="col-span-12 md:col-span-6">
              <v-text-field
                rounded="lg"
                v-model="form.postal_code"
                label="کد پستی *"
                type="number"
                variant="outlined"
                density="compact"
                :rules="postalCodeRules"
                hide-details
                hide-spin-buttons
                :maxlength="10"
                required />
            </div>
            <div class="col-span-12 md:col-span-6">
              <v-text-field rounded="lg" v-model="form.title" label="عنوان آدرس (منزل، محل کار و...)*" variant="outlined" density="compact" hide-details required />
            </div>

            <!-- Toggle گیرنده -->
            <div class="col-span-12 flex items-center gap-2">
              <v-switch v-model="notSelfRecipient" density="compact" size="10px" color="primary" hide-details :label="'گیرنده خودم نیستم'" />
            </div>

            <!-- فیلدهای گیرنده فقط وقتی گیرنده خود کاربر نیست -->
            <div v-if="notSelfRecipient" class="col-span-12 md:col-span-6">
              <v-text-field rounded="lg" v-model="form.recipient_name" label="نام و نام خانوادگی گیرنده *" variant="outlined" density="compact" hide-details required />
            </div>
            <div v-if="notSelfRecipient" class="col-span-12 md:col-span-6">
              <v-text-field
                rounded="lg"
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
              <v-text-field rounded="lg" v-model="form.email" label="ایمیل (اختیاری)" type="email" variant="outlined" density="compact" hide-details />
            </div>
          </div>

          <div class="mt-4 pb-3">
            <v-btn color="primarymain" rounded="lg" :disabled="!canSubmit" @click="saveAddress">ثبت آدرس</v-btn>
          </div>
        </div>
      </div>
      <div class="hidden sticky left-0 top-0 lg:block h-screen">
        <img src="/public/images/login2.png" class="h-full w-full" alt="" />
      </div>
    </div>
  </ClientOnly>
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
