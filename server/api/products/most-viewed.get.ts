import { getQuery, createError } from "h3";
import { getAdminClient } from "~/server/utils/supabaseAdmin";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const limit = Math.min(parseInt((query.limit as string) || "10", 10) || 10, 30);

  const admin = getAdminClient();

  const { data, error } = await admin.rpc("get_most_viewed_products", {
    p_limit: limit,
  });

  if (error) {
    console.error("get_most_viewed_products error:", error);
    throw createError({ statusCode: 500, statusMessage: "خطا در دریافت پربازدیدترین‌ها" });
  }

  return { products: data || [] };
});
