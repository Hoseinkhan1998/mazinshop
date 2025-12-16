// server/api/products.get.ts
import { getQuery, createError } from "h3";
import { getAdminClient } from "~/server/utils/supabaseAdmin";

type SortMode = "newest" | "priceAsc" | "priceDesc";

type DbProduct = {
  id: number;
  title: string;
  product_code: string;
  type_id: number;
  image_urls: any;
  created_at: string;
  product_variants: Array<{
    id: number;
    product_id?: number;
    price: number | string; // numeric ممکنه string بیاد
    stock_quantity?: number;
    attributes?: any;
  }>;
};

const MAX_PRODUCTS = 50;

// همون الگوریتم قدیمی تو، فقط منتقل‌شده روی سرور
function generateProducts50(params: { allProducts: DbProduct[]; q: string; primaryTypeId: number | null }) {
  const { allProducts, q, primaryTypeId } = params;
  const qLower = q.toLowerCase();

  const matchesByType = new Map<number, DbProduct[]>();
  const nonMatchesByType = new Map<number, DbProduct[]>();
  const allTypeIdsSet = new Set<number>();

  for (const p of allProducts) {
    const tId = p.type_id as number | null;
    if (!tId) continue;

    allTypeIdsSet.add(tId);

    const matches = (p.title || "").toLowerCase().includes(qLower);
    const map = matches ? matchesByType : nonMatchesByType;

    const arr = map.get(tId) || [];
    arr.push(p);
    map.set(tId, arr);
  }

  const sortByNewest = (arr: DbProduct[]) =>
    arr.sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });

  for (const [, arr] of matchesByType) sortByNewest(arr);
  for (const [, arr] of nonMatchesByType) sortByNewest(arr);

  const list: DbProduct[] = [];
  const usedIds = new Set<number>();
  const bucketById = new Map<number, number>();
  let mixed = false;

  const pushFromList = (items: DbProduct[] | undefined, bucket: number, typeIdForItems?: number) => {
    if (!items) return;

    for (const p of items) {
      if (list.length >= MAX_PRODUCTS) break;
      if (usedIds.has(p.id)) continue;

      if (primaryTypeId && typeIdForItems && typeIdForItems !== primaryTypeId) {
        mixed = true;
      }

      list.push(p);
      usedIds.add(p.id);
      bucketById.set(p.id, bucket);
    }
  };

  const matchesTypeIds = Array.from(matchesByType.keys());
  const allTypeIds = Array.from(allTypeIdsSet);

  if (primaryTypeId) {
    // 1) مچ‌های دسته انتخاب‌شده
    pushFromList(matchesByType.get(primaryTypeId), 1, primaryTypeId);

    // 2) مچ‌ها در بقیه دسته‌هایی که مچ دارند
    const otherMatchedTypeIds = matchesTypeIds.filter((tid) => tid !== primaryTypeId);
    for (const tid of otherMatchedTypeIds) {
      if (list.length >= MAX_PRODUCTS) break;
      pushFromList(matchesByType.get(tid), 2, tid);
    }

    // 3) غیرمچ‌های دسته انتخاب‌شده
    if (list.length < MAX_PRODUCTS) {
      pushFromList(nonMatchesByType.get(primaryTypeId), 3, primaryTypeId);
    }

    // 4) غیرمچ‌های بقیه دسته‌هایی که مچ داشتند
    if (list.length < MAX_PRODUCTS) {
      for (const tid of otherMatchedTypeIds) {
        if (list.length >= MAX_PRODUCTS) break;
        pushFromList(nonMatchesByType.get(tid), 4, tid);
      }
    }

    // 5) دسته‌هایی که هیچ مچ نداشتند
    if (list.length < MAX_PRODUCTS) {
      const remainingTypeIds = allTypeIds.filter((tid) => tid !== primaryTypeId && !matchesByType.has(tid));
      for (const tid of remainingTypeIds) {
        if (list.length >= MAX_PRODUCTS) break;
        pushFromList(nonMatchesByType.get(tid), 5, tid);
      }
    }
  } else {
    // سرچ بدون type
    // 1) مچ‌ها در همه دسته‌ها
    for (const tid of matchesTypeIds) {
      if (list.length >= MAX_PRODUCTS) break;
      pushFromList(matchesByType.get(tid), 1, tid);
    }

    // 2) غیرمچ‌های همان دسته‌هایی که مچ داشتند
    if (list.length < MAX_PRODUCTS) {
      for (const tid of matchesTypeIds) {
        if (list.length >= MAX_PRODUCTS) break;
        pushFromList(nonMatchesByType.get(tid), 2, tid);
      }
    }

    // 3) دسته‌هایی که هیچ مچ نداشتند
    if (list.length < MAX_PRODUCTS) {
      const remainingTypeIds = allTypeIds.filter((tid) => !matchesByType.has(tid));
      for (const tid of remainingTypeIds) {
        if (list.length >= MAX_PRODUCTS) break;
        pushFromList(nonMatchesByType.get(tid), 3, tid);
      }
    }

    const typeSet = new Set<number>();
    for (const p of list) {
      if (p.type_id) typeSet.add(p.type_id);
    }
    mixed = typeSet.size > 1;
  }

  return { list, mixed, bucketById };
}

function getMinPrice(p: DbProduct): number {
  const vars = Array.isArray(p.product_variants) ? p.product_variants : [];
  const prices = vars.map((v) => Number(v?.price)).filter((x) => Number.isFinite(x));
  if (!prices.length) return Number.POSITIVE_INFINITY;
  return Math.min(...prices);
}

function filterByPriceRange(products: DbProduct[], minP: number | null, maxP: number | null) {
  if (minP == null && maxP == null) return products;

  const min = minP ?? 0;
  const max = maxP ?? Number.POSITIVE_INFINITY;

  return products.filter((p) => {
    const vars = Array.isArray(p.product_variants) ? p.product_variants : [];
    return vars.some((v) => {
      const price = Number(v?.price);
      return Number.isFinite(price) && price >= min && price <= max;
    });
  });
}

function calcStats(products: DbProduct[]) {
  let min = Number.POSITIVE_INFINITY;
  let max = 0;

  for (const p of products) {
    const vars = Array.isArray(p.product_variants) ? p.product_variants : [];
    for (const v of vars) {
      const price = Number(v?.price);
      if (!Number.isFinite(price)) continue;
      if (price < min) min = price;
      if (price > max) max = price;
    }
  }

  if (!Number.isFinite(min)) min = 0;
  if (max < min) max = min;

  return { min, max };
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  const supabase = getAdminClient();

  const typeRaw = query.type as string | undefined;
  const typeId = typeRaw ? Number(typeRaw) : null;

  const search = ((query.search as string | undefined) || "").trim();
  const hasSearch = search.length > 0; // اگر مثل سرچ قدیمی می‌خوای >=2 بگذاری، همینجا تغییر بده

  const sort = ((query.sort as string | undefined) || "newest") as SortMode;

  const minPrice = query.minPrice != null ? Number(query.minPrice) : null;
  const maxPrice = query.maxPrice != null ? Number(query.maxPrice) : null;

  // filters (فقط برای حالت بدون سرچ استفاده می‌کنیم تا دقیقاً مثل قبل رفتار کند)
  let filters: any = {};
  try {
    const raw = (query.filters as string | undefined) || "";
    filters = raw ? JSON.parse(raw) : {};
  } catch {
    filters = {};
  }

  const limit = Math.min(parseInt((query.limit as string) || "50", 10) || 50, 100);
  const offset = Math.max(parseInt((query.offset as string) || "0", 10) || 0, 0);

  // ---------------------------
  // A) حالت سرچ: Generator دقیق قدیمی
  // ---------------------------
  if (hasSearch) {
    // این عدد رو بزرگ می‌گیریم تا “جدیدترین‌ها” رو خوب پوشش بده و الگوریتمت دقیق اجرا بشه
    // اگر دیتاستت خیلی بزرگ شد، می‌تونیم بعداً به RPC/window-function حرفه‌ای‌تر تبدیلش کنیم.
    const BIG_LIMIT = 10000;

    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id,
        title,
        product_code,
        type_id,
        image_urls,
        created_at,
        product_variants (
          id,
          price,
          stock_quantity,
          attributes
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(BIG_LIMIT);

    if (error) {
      console.error("products search generator fetch error:", error);
      throw createError({ statusCode: 500, statusMessage: "خطا در دریافت محصولات" });
    }

    const allProducts = (data || []) as DbProduct[];

    const {
      list: generated,
      mixed,
      bucketById,
    } = generateProducts50({
      allProducts,
      q: search,
      primaryTypeId: Number.isFinite(typeId as any) ? (typeId as number) : null,
    });

    // stats باید بر اساس “baseProducts” باشد (مثل قبل) و مستقل از price filter
    const baseStats = calcStats(generated);

    // اعمال price filter (اگر اعمال شده باشد)
    let finalList = filterByPriceRange(generated, Number.isFinite(minPrice as any) ? minPrice : null, Number.isFinite(maxPrice as any) ? maxPrice : null);
    // --- حفظ ترتیب generator + sort قیمت داخل bucketها ---
    const baseOrderRank = new Map<number, number>();
    generated.forEach((p, idx) => baseOrderRank.set(p.id, idx));

    const getBucket = (p: DbProduct) => bucketById.get(p.id) ?? 999;
    const getRank = (p: DbProduct) => baseOrderRank.get(p.id) ?? 999999;

    if (sort === "priceAsc") {
      finalList = [...finalList].sort((a, b) => getBucket(a) - getBucket(b) || getMinPrice(a) - getMinPrice(b) || getRank(a) - getRank(b));
    } else if (sort === "priceDesc") {
      finalList = [...finalList].sort((a, b) => getBucket(a) - getBucket(b) || getMinPrice(b) - getMinPrice(a) || getRank(a) - getRank(b));
    } else {
      // newest: دقیقاً ترتیب generator حفظ شود
      finalList = [...finalList].sort((a, b) => getRank(a) - getRank(b));
    }

    // pagination (اگر بعداً خواستی) — فعلاً با 50تایی generator، offset/limit معنی زیادی نداره
    // ولی برای سازگاری، می‌بریمش روی slice
    const paged = finalList.slice(offset, offset + limit);

    return {
      products: paged,
      mixed,
      stats: baseStats, // مهم: این همون max/min قبل از اعمال فیلتر قیمت است (مثل قبل)
    };
  }

  // ---------------------------
  // B) حالت بدون سرچ: فیلتر دیتابیس (RPC قبلی)
  // ---------------------------
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_products_filtered", {
    p_type_id: Number.isFinite(typeId as any) ? typeId : null,
    p_search: null,
    p_filters: filters,
    p_min_price: Number.isFinite(minPrice as any) ? minPrice : null,
    p_max_price: Number.isFinite(maxPrice as any) ? maxPrice : null,
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
  });

  if (rpcError) {
    console.error("products filter rpc error:", rpcError);
    throw createError({ statusCode: 500, statusMessage: "خطا در دریافت محصولات" });
  }

  return {
    products: (rpcData?.products ?? []) as any[],
    mixed: false,
  };
});
