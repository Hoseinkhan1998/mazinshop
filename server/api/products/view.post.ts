import type { H3Event } from "h3";
import { createError, readBody, getHeader, getCookie, setCookie } from "h3";
import { randomUUID } from "node:crypto";
import { getAdminClient } from "~/server/utils/supabaseAdmin";

export default defineEventHandler(async (event: H3Event) => {
  const admin = getAdminClient();

  const body = await readBody<{ productId: number }>(event);
  const productId = Number(body?.productId);

  if (!Number.isFinite(productId) || productId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "productId نامعتبر است." });
  }

  // --- 1) تشخیص کاربر لاگین (اگر توکن ارسال شده باشد) ---
  const authHeader = getHeader(event, "authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  let userId: string | null = null;
  if (token) {
    try {
      const { data } = await admin.auth.getUser(token);
      userId = data?.user?.id || null;
    } catch {
      userId = null;
    }
  }

  // --- 2) اگر لاگین نبود، از cookie visitor id استفاده کن ---
  let vid = getCookie(event, "vid");
  if (!vid) {
    vid = randomUUID();
    setCookie(event, "vid", vid, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      secure: process.env.NODE_ENV === "production",
    });
  }

  const viewer_key = userId || vid;

  // --- 3) upsert: در یک روز فقط یک بار ثبت شود ---
  const { error } = await admin
    .from("product_daily_views")
    .upsert(
      {
        product_id: productId,
        viewer_key,
        user_id: userId, // nullable
        // viewed_on => default current_date
      },
      {
        onConflict: "product_id,viewer_key,viewed_on",
        ignoreDuplicates: true,
      }
    );

  if (error) {
    console.error("view upsert error:", error);
    throw createError({ statusCode: 500, statusMessage: "خطا در ثبت بازدید." });
  }

  return { success: true };
});
