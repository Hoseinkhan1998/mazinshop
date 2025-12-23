<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useProductStore } from "~/stores/products";
import type { Product } from "~/types/Product";

const props = defineProps<{
  product: Product;
}>();

const productStore = useProductStore();

const SIMILAR_MAX = 12;

// ---------- Similarity Logic ----------
const normalizeTitle = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenizeFa = (s: string) => {
  const raw = normalizeTitle(s).split(" ");
  const stop = new Set(["و", "یا", "برای", "به", "از", "در", "با", "مدل", "جدید"]);
  return raw.filter((t) => t.length >= 2 && !stop.has(t));
};

const titleSimilarityScore = (a: string, b: string) => {
  const ta = new Set(tokenizeFa(a));
  const tb = tokenizeFa(b);
  let score = 0;
  for (const t of tb) if (ta.has(t)) score++;
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na && nb && (na.includes(nb) || nb.includes(na))) score += 2;
  return score;
};

const similarProducts = computed<Product[]>(() => {
  const current = props.product;
  if (!current) return [];

  const currentId = Number(current.id);
  const primaryTypeId = Number(current.type_id);
  const currentTitle = String(current.title || "");

  const all = productStore.products || [];
  if (!all.length || !primaryTypeId) return [];

  const matchesByType = new Map<number, { p: Product; score: number }[]>();
  const nonMatchesByType = new Map<number, Product[]>();
  const allTypeIdsSet = new Set<number>();

  for (const p of all) {
    if (!p?.id || p.id === currentId) continue;
    if (!p.type_id) continue;

    const tId = Number(p.type_id);
    allTypeIdsSet.add(tId);

    const score = titleSimilarityScore(currentTitle, p.title);
    if (score > 0) {
      const arr = matchesByType.get(tId) || [];
      arr.push({ p, score });
      matchesByType.set(tId, arr);
    } else {
      const arr = nonMatchesByType.get(tId) || [];
      arr.push(p);
      nonMatchesByType.set(tId, arr);
    }
  }

  const sortByNewest = (arr: any[]) =>
    arr.sort((a, b) => {
      const itemA = a.p || a;
      const itemB = b.p || b;
      const da = itemA.created_at ? new Date(itemA.created_at).getTime() : 0;
      const db = itemB.created_at ? new Date(itemB.created_at).getTime() : 0;
      return db - da;
    });

  for (const [tid, arr] of matchesByType.entries()) {
    arr.sort((a, b) => b.score - a.score || (new Date((b.p as any).created_at).getTime() - new Date((a.p as any).created_at).getTime()));
  }
  for (const [tid, arr] of nonMatchesByType.entries()) sortByNewest(arr);

  const list: Product[] = [];
  const used = new Set<number>();

  const pushProducts = (items: Product[] | undefined) => {
    if (!items) return;
    for (const p of items) {
      if (list.length >= SIMILAR_MAX) break;
      if (used.has(p.id)) continue;
      list.push(p);
      used.add(p.id);
    }
  };

  const pushMatched = (items: { p: Product; score: number }[] | undefined) => {
    if (!items) return;
    for (const it of items) {
      if (list.length >= SIMILAR_MAX) break;
      if (used.has(it.p.id)) continue;
      list.push(it.p);
      used.add(it.p.id);
    }
  };

  pushMatched(matchesByType.get(primaryTypeId));
  const otherMatchedTypeIds = Array.from(matchesByType.keys()).filter((tid) => tid !== primaryTypeId);
  for (const tid of otherMatchedTypeIds) pushMatched(matchesByType.get(tid));
  pushProducts(nonMatchesByType.get(primaryTypeId));
  for (const tid of otherMatchedTypeIds) pushProducts(nonMatchesByType.get(tid));
  const remainingTypeIds = Array.from(allTypeIdsSet).filter((tid) => tid !== primaryTypeId && !matchesByType.has(tid));
  for (const tid of remainingTypeIds) pushProducts(nonMatchesByType.get(tid));

  return list;
});

const formatNumber = (num: number | undefined | null) => (num != null ? num.toLocaleString("fa-IR") : "-");

const getPriceLabel = (p: Product) => {
  if (!Array.isArray(p.product_variants) || p.product_variants.length === 0) return "ناموجود";
  const prices = p.product_variants.map((v) => v.price).filter((x) => typeof x === "number");
  if (!prices.length) return "ناموجود";
  const min = Math.min(...prices);
  return `${formatNumber(min)} تومان`;
};

onMounted(async () => {
  if (productStore.products.length === 0) {
    await productStore.fetchProducts();
  }
});
</script>

<template>
  <section class="mt-6 px-4 lg:px-16">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <v-icon color="primary" size="30">mdi-sparkles</v-icon>
        <p class="text-lg font-semibold text-gray-800">محصولات مشابه</p>
      </div>
      <!-- <span v-if="similarProducts.length" class="text-[11px] text-gray-400"> {{ formatNumber(similarProducts.length) }} پیشنهاد </span> -->
    </div>

    <div v-if="similarProducts.length === 0" class="text-xs text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4"> فعلاً محصول مشابهی برای نمایش نداریم. </div>

    <v-slide-group v-else show-arrows class="py-2">
      <v-slide-group-item v-for="p in similarProducts" :key="p.id">
        <NuxtLink :to="`/products/${p.id}`" class="no-underline group text-current block w-56 sm:w-64 me-4">
          <div class="rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
            <div class="h-36 bg-gray-50 overflow-hidden relative">
              <img
                :src="p.image_urls?.[0] || '/placeholder.png'"
                :alt="p.title"
                class="w-full h-full object-cover transition-all duration-700 ease-in-out group-hover:scale-110"
                :class="{ 'group-hover:opacity-0': p.image_urls?.length > 1 }" />

              <img
                v-if="p.image_urls?.length > 1"
                :src="p.image_urls[1]"
                :alt="p.title"
                class="absolute inset-0 w-full h-full object-cover transition-all duration-500 ease-in-out opacity-0 group-hover:!opacity-100 group-hover:scale-110" />
            </div>
            <div class="!p-3">
              <p class="text-sm text-gray-800 font-semibold line-clamp-2 min-h-[40px]"> {{ p.title }} </p>
              <div class="mt-2 flex items-center justify-between">
                <span class="text-[11px] text-gray-400"></span>
                <span class="text-sm font-black text-gray-900">{{ getPriceLabel(p) }}</span>
              </div>
            </div>
          </div>
        </NuxtLink>        
      </v-slide-group-item>
    </v-slide-group>
  </section>
</template>
