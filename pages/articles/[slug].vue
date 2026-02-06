<template>
  <div class="container mx-auto px-4 py-12 max-w-4xl">
    <div v-if="pending" class="text-center py-20">در حال دریافت مقاله...</div>

    <div v-else-if="!article" class="text-center py-20 text-red-500">
      <h1 class="text-2xl font-bold">مقاله مورد نظر یافت نشد!</h1>
      <NuxtLink to="/articles" class="text-blue-500 mt-4 block">بازگشت به وبلاگ</NuxtLink>
    </div>

    <article v-else class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="aspect-[21/9] w-full relative">
        <img :src="article.image_url || '/images/placeholder.jpg'" :alt="article.image_alt" class="w-full h-full object-cover" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end">
          <div class="p-6 md:p-10 text-white">
            <h1 class="text-3xl md:text-5xl font-extrabold leading-tight mb-4">
              {{ article.title }}
            </h1>
            <div class="flex items-center gap-4 text-sm opacity-90">
              <span>📅 {{ new Date(article.created_at).toLocaleDateString("fa-IR") }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="p-6 md:p-12">
        <div class="prose prose-lg max-w-none prose-img:rounded-xl prose-headings:text-gray-800 text-gray-600 leading-loose whitespace-pre-wrap" v-if="!isHtml(article.content)">
          {{ article.content }}
        </div>

        <div v-else v-html="article.content" class="prose prose-lg max-w-none prose-blue prose-img:rounded-xl leading-loose"></div>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { useArticlesStore } from "~/stores/articles";
const route = useRoute();
const store = useArticlesStore();

const slug = route.params.slug as string;

// تابع کمکی برای تشخیص اینکه آیا محتوا HTML است یا متن ساده
const isHtml = (text: string) => /<\/?[a-z][\s\S]*>/i.test(text);

const { data: article, pending } = await useAsyncData(`article-${slug}`, async () => {
  return await store.fetchArticleBySlug(slug);
});

// تنظیمات سئو دینامیک
if (article.value) {
  useSeoMeta({
    title: article.value.title,
    description: article.value.excerpt,
    ogTitle: article.value.title,
    ogDescription: article.value.excerpt,
    ogImage: article.value.image_url,
    twitterCard: "summary_large_image",
  });
}
</script>

<style>
/* استایل‌های پایه برای تمیزتر شدن متن‌های طولانی */
.prose p {
  margin-bottom: 1.5em;
  text-align: justify;
}
.prose h2 {
  font-size: 1.8rem;
  margin-top: 2em;
  margin-bottom: 0.8em;
  font-weight: 800;
}
</style>
