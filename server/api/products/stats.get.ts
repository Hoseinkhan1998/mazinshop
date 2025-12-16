// server/api/products/stats.get.ts
import { getQuery, createError } from "h3";
import { getAdminClient } from "~/server/utils/supabaseAdmin";

// خیلی ساده: در حالت سرچ، stats را از /api/products می‌گیریم (همان generator) تا دقیقاً مثل قبل باشد.
// در حالت بدون سرچ، از RPC get_products_price_stats استفاده می‌کنیم.

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  const typeRaw = query.type as string | undefined;
  const typeId = typeRaw ? Number(typeRaw) : null;

  const search = ((query.search as string | undefined) || "").trim();
  const hasSearch = search.length > 0;

  // filters (فقط در حالت بدون سرچ)
  let filters: any = {};
  try {
    const raw = (query.filters as string | undefined) || "";
    filters = raw ? JSON.parse(raw) : {};
  } catch {
    filters = {};
  }

  // حالت سرچ: stats را مستقیم از generator محصولات بگیر (دقیقاً مثل قبل)
  if (hasSearch) {
    // با یک call به همان endpoint اصلی محصولات:
    const params = new URLSearchParams();
    if (typeId) params.set("type", String(typeId));
    params.set("search", search);

    const res = await $fetch<{ stats?: { min: number; max: number } }>(`/api/products?${params.toString()}`);
    return {
      min: Number(res?.stats?.min ?? 0),
      max: Number(res?.stats?.max ?? 0),
    };
  }

  // حالت بدون سرچ: stats واقعی از DB با RPC
  const supabase = getAdminClient();

  const { data, error } = await supabase.rpc("get_products_price_stats", {
    p_type_id: Number.isFinite(typeId as any) ? typeId : null,
    p_search: null,
    p_filters: filters,
  });

  if (error) {
    console.error("products stats error:", error);
    throw createError({ statusCode: 500, statusMessage: "خطا در دریافت آمار قیمت" });
  }

  return {
    min: Number(data?.min ?? 0),
    max: Number(data?.max ?? 0),
  };
});
