// server/api/home/discounted.get.ts
import { createError, getQuery } from "h3";
import { getAdminClient } from "~/server/utils/supabaseAdmin";

const LIMIT = 12;
const PER_TYPE_N = 2;
const AUTO_MIN_PERCENT = 10;
const FIRE_MIN_PERCENT = 40;

type DbRow = {
  id: number; // variant id
  product_id: number;
  price: number | string;
  discounted_price: number | string | null;
  discount_percent: number | null;
  stock_quantity: number | null;

  pin_to_home_discount: boolean;
  pinned_to_home_discount_at: string | null;
  created_at: string | null;

  products: {
    id: number;
    title: string;
    type_id: number | null;
    image_urls: any;
    created_at: string | null;
  } | null;
};

type HomeDiscountCard = {
  id: number; // product id
  variant_id: number;
  title: string;
  image: string;
  oldPrice: number;
  newPrice: number;
  discountPercent: number;
  fireicon: boolean;
  inventoryno: number;
  type_id: number | null;
};

function n(x: any): number {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}

function stockOf(r: DbRow): number {
  const s = n(r.stock_quantity);
  return s > 0 ? s : 0;
}

function discountOf(r: DbRow): number {
  return Math.max(0, n(r.discount_percent));
}

function diffOf(r: DbRow): number {
  const p = n(r.price);
  const d = n(r.discounted_price);
  return Math.max(0, p - d);
}

function timeOf(r: DbRow): number {
  const t = r.pinned_to_home_discount_at || r.created_at || r.products?.created_at || null;
  const ms = t ? new Date(t).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

// مقایسه “ارجح” برای انتخاب واریانت نماینده (همون قانون شما)
function better(a: DbRow, b: DbRow) {
  // 1) بیشترین درصد تخفیف
  const ap = discountOf(a);
  const bp = discountOf(b);
  if (bp !== ap) return bp - ap;

  // 2) بیشترین اختلاف قیمت (old-new)
  const ad = diffOf(a);
  const bd = diffOf(b);
  if (bd !== ad) return bd - ad;

  // 3) جدیدتر (pinned_at/created_at)
  const at = timeOf(a);
  const bt = timeOf(b);
  if (bt !== at) return bt - at;

  // 4) موجودی بیشتر
  const as = stockOf(a);
  const bs = stockOf(b);
  if (bs !== as) return bs - as;

  // 5) fallback
  return n(b.id) - n(a.id);
}

function toImage(product: DbRow["products"]): string {
  const urls = Array.isArray(product?.image_urls) ? product!.image_urls : [];
  // اگر فایل پیش‌فرض محصول داری، این مسیر رو همون کن
  return urls?.[0] || "/images/product-default.jpg";
}

function toCard(r: DbRow): HomeDiscountCard {
  const product = r.products!;
  const oldPrice = n(r.price);
  const newPrice = n(r.discounted_price);
  const percent = discountOf(r);

  return {
    id: product.id,
    variant_id: r.id,
    title: product.title,
    image: toImage(product),
    oldPrice,
    newPrice,
    discountPercent: percent,
    fireicon: percent >= FIRE_MIN_PERCENT,
    inventoryno: stockOf(r),
    type_id: product.type_id ?? null,
  };
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const limit = Math.min(Number(query.limit || LIMIT), 12) || LIMIT;

  const supabase = getAdminClient();

  // همه‌ی کاندیدها: pinned یا discount>=AUTO_MIN_PERCENT
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      `
      id,
      product_id,
      price,
      discounted_price,
      discount_percent,
      stock_quantity,
      pin_to_home_discount,
      pinned_to_home_discount_at,
      created_at,
      products:products (
        id,
        title,
        type_id,
        image_urls,
        created_at
      )
    `
    )
    .not("discounted_price", "is", null)
    .or(`pin_to_home_discount.eq.true,discount_percent.gte.${AUTO_MIN_PERCENT}`);

  if (error) {
    console.error("home discounted fetch error:", error);
    throw createError({ statusCode: 500, statusMessage: "خطا در دریافت محصولات تخفیف‌خورده" });
  }

  const rows = (data || []) as DbRow[];

  // فقط ردیف‌هایی که product دارند + موجودی > 0
  const valid = rows.filter((r) => r.products && stockOf(r) > 0);

  // -------------------------
  // 1) PINNED (اولویت اول)
  // -------------------------
  const pinnedRaw = valid.filter((r) => r.pin_to_home_discount === true && discountOf(r) > 0);

  // safety: اگر احیاناً چندتا pinned برای یک محصول بود (نباید بشه)، بهترین رو نگه دار
  const pinnedBestByProduct = new Map<number, DbRow>();
  for (const r of pinnedRaw) {
    const prev = pinnedBestByProduct.get(r.product_id);
    if (!prev || better(prev, r) > 0) {
      pinnedBestByProduct.set(r.product_id, r);
    }
  }

  const pinned = Array.from(pinnedBestByProduct.values()).sort((a, b) => {
    // pinned ها فقط با “جدیدتر pin” مرتب میشن
    const at = timeOf(a);
    const bt = timeOf(b);
    if (bt !== at) return bt - at;
    return n(b.id) - n(a.id);
  });

  const selectedPinned = pinned.slice(0, limit);
  const usedProductIds = new Set(selectedPinned.map((r) => r.product_id));

  if (selectedPinned.length >= limit) {
    return { products: selectedPinned.map(toCard) };
  }

  const remaining = limit - selectedPinned.length;

  // -------------------------
  // 2) AUTO PICKS
  // شرط: discount_percent >= AUTO_MIN_PERCENT و stock>0
  // و نماینده هر محصول: بهترین واریانت تخفیفی همان محصول
  // -------------------------
  const autoCandidates = valid.filter((r) => !r.pin_to_home_discount && !usedProductIds.has(r.product_id) && discountOf(r) >= AUTO_MIN_PERCENT);

  // بهترین واریانت برای هر محصول
  const bestVariantByProduct = new Map<number, DbRow>();
  for (const r of autoCandidates) {
    const prev = bestVariantByProduct.get(r.product_id);
    if (!prev || better(prev, r) > 0) {
      bestVariantByProduct.set(r.product_id, r);
    }
  }

  // گروه‌بندی بر اساس type، هر type حداکثر PER_TYPE_N
  const byType = new Map<number, DbRow[]>();
  for (const r of bestVariantByProduct.values()) {
    const t = r.products?.type_id;
    if (!t) continue;
    const arr = byType.get(t) || [];
    arr.push(r);
    byType.set(t, arr);
  }

  for (const [t, arr] of byType) {
    arr.sort((a, b) => better(a, b));
    byType.set(t, arr.slice(0, PER_TYPE_N));
  }

  // Round-robin بین type ها برای تنوع
  const typeIds = Array.from(byType.keys()).sort((ta, tb) => {
    const a0 = byType.get(ta)?.[0];
    const b0 = byType.get(tb)?.[0];
    if (!a0 && !b0) return 0;
    if (!a0) return 1;
    if (!b0) return -1;
    return better(a0, b0);
  });

  const autoPicked: DbRow[] = [];
  for (let i = 0; autoPicked.length < remaining; i++) {
    let any = false;
    for (const tid of typeIds) {
      const arr = byType.get(tid) || [];
      const item = arr[i];
      if (!item) continue;
      any = true;
      autoPicked.push(item);
      if (autoPicked.length >= remaining) break;
    }
    if (!any) break; // چیزی باقی نمونده
  }

  const finalRows = [...selectedPinned, ...autoPicked].slice(0, limit);
  return { products: finalRows.map(toCard) };
});
