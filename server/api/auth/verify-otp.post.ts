import type { H3Event } from "h3";
import { getAdminClient } from "~/server/utils/supabaseAdmin";
import { normalizePhone, hmacCode, randomPassword } from "~/server/utils/otp";

export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig();
  const admin = getAdminClient();
  const anonKey = config.supabaseAnonKey;
  const supabaseUrl = config.public.supabaseUrl;

  const body = await readBody<{ phone: string; code: string }>(event);
  const phone = normalizePhone(body?.phone || "");
  const code = (body?.code || "").trim();
  if (!code) throw createError({ statusCode: 400, statusMessage: "کد تایید الزامی است." });

  // آخرین OTP معتبر و مصرف‌نشده
  const { data: rows, error: selErr } = await admin.from("phone_otps").select("*").eq("phone", phone).eq("consumed", false).order("created_at", { ascending: false }).limit(1);

  if (selErr) throw createError({ statusCode: 500, statusMessage: "خطا در خواندن OTP" });
  const otp = rows?.[0];
  if (!otp) throw createError({ statusCode: 400, statusMessage: "کد معتبر یافت نشد." });

  if (new Date(otp.expires_at).getTime() < Date.now()) {
    await admin.from("phone_otps").update({ consumed: true }).eq("id", otp.id);
    throw createError({ statusCode: 400, statusMessage: "کد منقضی شده است." });
  }

  // بررسی کد
  const code_hash = hmacCode(code, phone, config.otpPepper!);
  if (code_hash !== otp.code_hash) {
    const attempts = (otp.attempts || 0) + 1;
    await admin.from("phone_otps").update({ attempts }).eq("id", otp.id);
    throw createError({ statusCode: 400, statusMessage: "کد نادرست است." });
  }

  // مصرف کن
  await admin.from("phone_otps").update({ consumed: true }).eq("id", otp.id);

  // ساخت/آپدیت کاربر در Auth
  const aliasLocal = `u_${phone}`;
  const aliasEmail = `${aliasLocal}@${config.authAliasDomain}`;
  const password = randomPassword();

  // تلاش برای یافتن پروفایل با phone_number
  let userId: string | null = null;
  const { data: existingProfile } = await admin.from("profiles").select("id").eq("phone_number", phone).limit(1).maybeSingle();

  if (existingProfile?.id) {
    userId = existingProfile.id;
  } else {
    // ایجاد کاربر (اگر موجود نیست)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: aliasEmail,
      email_confirm: true,
      user_metadata: { full_name: otp.meta?.full_name || "" },
      password,
    });
    if (createErr && !createErr.message?.includes("already registered")) {
      console.error("createUser error (details):", createErr);
      throw createError({ statusCode: 500, statusMessage: "خطا در ایجاد کاربر" });
    }
    if (created?.user?.id) userId = created.user.id;
  }

  // اگر هنوز userId نداریم، ممکن است قبلاً با ایمیل مصنوعی ساخته شده باشد:
  if (!userId) {
    // به‌روزرسانی کاربر (با ایمیل/پسورد/تلفن) — اگر بود ویرایش می‌شود
    const { data: listTry, error: updErr } = await admin.auth.admin.updateUserById(
      // @ts-ignore
      existingProfile?.id || "", // اگر id نداریم ولی updateUserById نیاز دارد، از مرحله بعدی عبور می‌کنیم
      { email: aliasEmail, email_confirm: true, password }
    );
  } else {
    await admin.auth.admin.updateUserById(userId, { email: aliasEmail, email_confirm: true, password });
  }

  // پروفایل را upsert کن
  if (userId) {
    const payload: any = {
      id: userId,
      phone_number: phone,
    };

    if (!existingProfile) {
      payload.full_name = otp.meta?.full_name || "";
      payload.role = "user";
    }

    await admin.from("profiles").upsert(payload);
  }

  // گرفتن توکن سشن با Password Grant
  const tokenUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`;
  const tokens = await $fetch(tokenUrl, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: { email: aliasEmail, password },
  });
  // { access_token, refresh_token, ... }
  return { success: true, tokens };
});
