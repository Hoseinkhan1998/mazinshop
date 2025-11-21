// server/api/search.get.ts
import { getQuery, createError } from "h3";
import { getAdminClient } from "~/server/utils/supabaseAdmin";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const qRaw = (query.q as string | undefined) || "";
  const q = qRaw.trim();

  // حداقل دو کاراکتر برای سرچ
  if (!q || q.length < 2) {
    return { products: [] };
  }

  // limit برای پیشنهادها یا لیست کامل
  const limitParam = query.limit as string | undefined;
  const limit = Math.min(parseInt(limitParam || "50", 10) || 50, 100);

  const supabase = getAdminClient();

  // سرچ روی عنوان محصول و کد محصول
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
        price
      ),
      types (
        id,
        typename
      )
    `
    )
    .or(`title.ilike.%${q}%,product_code.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("search error:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "خطا در جستجو",
    });
  }

  return {
    products: data || [],
  };
});