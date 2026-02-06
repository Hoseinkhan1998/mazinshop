<template>
  <div class="container mx-auto px-4 py-12">
    <div class="text-center mb-12">
      <h1 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">وبلاگ و مقالات آموزشی</h1>
      <p class="text-gray-500 max-w-2xl mx-auto">جدیدترین اخبار، راهنمای خرید و مقالات تخصصی را در اینجا بخوانید.</p>
    </div>

    <div v-if="store.loading" class="text-center py-20 text-gray-400">در حال بارگذاری مقالات...</div>

    <div v-else-if="store.articles.length === 0" class="text-center py-20 bg-gray-50 rounded-xl">
      <p class="text-gray-500">هنوز مقاله‌ای منتشر نشده است.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div v-for="article in store.articles" :key="article.id" class="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition group border border-gray-100">
        <NuxtLink :to="`/articles/${article.slug}`" class="block relative aspect-[16/9] overflow-hidden">
          <img
            :src="article.image_url || '/images/placeholder.jpg'"
            :alt="article.image_alt"
            class="w-full h-full object-cover transform group-hover:scale-105 transition duration-500" />
        </NuxtLink>

        <div class="p-6">
          <h2 class="text-xl font-bold text-gray-800 mb-3 group-hover:text-blue-600 transition">
            <NuxtLink :to="`/articles/${article.slug}`">
              {{ article.title }}
            </NuxtLink>
          </h2>
          <p class="text-gray-500 text-sm leading-relaxed line-clamp-3 mb-4">
            {{ article.excerpt }}
          </p>

          <div class="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
            <span class="text-xs text-gray-400">
              {{ new Date(article.created_at).toLocaleDateString("fa-IR") }}
            </span>
            <NuxtLink :to="`/articles/${article.slug}`" class="text-blue-600 text-sm font-medium hover:underline"> ادامه مطلب &larr; </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useArticlesStore } from "~/stores/articles";

const store = useArticlesStore();

// سئو صفحه لیست
useSeoMeta({
  title: "وبلاگ و مقالات - فروشگاه مازین شاپ",
  description: "لیست جدیدترین مقالات و راهنمای خرید محصولات در فروشگاه مازین شاپ",
});

// دریافت مقالات در سمت سرور (یا کلاینت)
await useAsyncData("articles", async () => {
  await store.fetchPublicArticles();
});
</script>
