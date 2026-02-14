<template>
  <div class=" px-4 max-w-3xl">
    <h1 class="text-3xl font-bold mb-8 text-gray-800">✍️ افزودن مقاله جدید</h1>

    <form @submit.prevent="submitArticle" class="space-y-6 bg-white !p-6 rounded-xl shadow-sm border border-gray-100">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">عنوان مقاله</label>
          <input
            v-model="form.title"
            @input="generateSlug"
            type="text"
            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="مثال: راهنمای خرید کفش کوهنوردی"
            required />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Slug (نامک URL)</label>
          <input
            v-model="form.slug"
            type="text"
            class="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-600 ltr text-left"
            placeholder="guide-buying-hiking-shoes"
            required />
          <p class="text-xs text-gray-400 mt-1">این قسمت در آدرس صفحه نمایش داده می‌شود (بهتر است انگلیسی باشد).</p>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">تصویر شاخص</label>
        <div class="flex items-center gap-4">
          <div v-if="previewImage" class="w-32 h-24 rounded-lg overflow-hidden border">
            <img :src="previewImage" class="w-full h-full object-cover" />
          </div>
          <div class="flex-1">
            <input
              type="file"
              @change="handleFileChange"
              accept="image/*"
              class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          </div>
        </div>
        <input v-model="form.image_alt" type="text" class="w-full mt-3 px-4 py-2 border rounded-lg text-sm" placeholder="متن جایگزین تصویر (Alt Text) برای سئو" />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">خلاصه متن (Meta Description)</label>
        <textarea
          v-model="form.excerpt"
          rows="3"
          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="یک پاراگراف کوتاه که در گوگل و کارت‌های مقاله نمایش داده می‌شود..."
          required></textarea>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">متن کامل مقاله</label>
        <textarea
          v-model="form.content"
          rows="15"
          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-sans"
          placeholder="متن مقاله خود را اینجا بنویسید. می‌توانید از تگ‌های HTML ساده مثل <h2>, <b>, <p> هم استفاده کنید."
          required></textarea>
      </div>

      <div class="flex justify-end gap-4 pt-4 border-t">
        <button type="button" @click="$router.push('/admin')" class="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">انصراف</button>
        <button type="submit" :disabled="loading" class="px-8 py-2 !bg-blue-600 text-white rounded-lg hover:!bg-blue-700 transition flex items-center gap-2">
          <span v-if="loading">در حال ارسال...</span>
          <span v-else>انتشار مقاله</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { useArticlesStore } from "~/stores/articles";

definePageMeta({
  layout: "default", // یا اگر لی‌اوت ادمین داری: 'admin'
  middleware: ["admin-auth"], // محافظت از صفحه
});

const store = useArticlesStore();
const router = useRouter();

const loading = ref(false);
const imageFile = ref<File | null>(null);
const previewImage = ref<string | null>(null);

const form = reactive({
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  image_alt: "",
});

// تولید خودکار Slug از روی تایتل
const generateSlug = () => {
  // این یک تبدیل ساده است، اگر خواستی می‌تونی دستی هم تغییرش بدی
  form.slug = form.title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-") // فاصله به خط تیره
    .replace(/[^a-z0-9\u0600-\u06FF-]/g, ""); // حذف کاراکترهای خاص
};

const handleFileChange = (e: any) => {
  const file = e.target.files[0];
  if (file) {
    imageFile.value = file;
    previewImage.value = URL.createObjectURL(file);
  }
};

const submitArticle = async () => {
  if (!form.title || !form.content || !form.slug) return;

  loading.value = true;
  try {
    let imageUrl = "";

    // ۱. اول آپلود عکس
    if (imageFile.value) {
      imageUrl = await store.uploadArticleImage(imageFile.value);
    }

    // ۲. ذخیره در دیتابیس
    await store.addArticle({
      title: form.title,
      slug: form.slug,
      content: form.content, // اینجا بعداً می‌تونیم ادیتور HTML بذاریم
      excerpt: form.excerpt,
      image_url: imageUrl,
      image_alt: form.image_alt || form.title,
      is_published: true, // فعلاً مستقیم منتشر می‌کنیم
    });

    alert("مقاله با موفقیت منتشر شد!");
    router.push("/articles"); // هدایت به صفحه مقالات
  } catch (error) {
    console.error(error);
    alert("خطا در ثبت مقاله");
  } finally {
    loading.value = false;
  }
};
</script>
