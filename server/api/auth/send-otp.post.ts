import type { H3Event } from "h3";
import { getAdminClient } from "~/server/utils/supabaseAdmin";
import { normalizePhone, randomCode, hmacCode } from "~/server/utils/otp";

export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig();
  const admin = getAdminClient();

  const body = await readBody<{ phone: string; full_name: string }>(event);
  const phone = normalizePhone(body?.phone || "");
  const fullName = (body?.full_name || "").trim();
  if (!fullName) {
    throw createError({ statusCode: 400, statusMessage: "نام و نام خانوادگی الزامی است." });
  }

  // تولید کد 6 رقمی
  const code = randomCode(6);
  const code_hash = hmacCode(code, phone, config.otpPepper!);
  const expires_at = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 دقیقه

  // اختیاری: غیرفعال کردن OTPهای قبلی مصرف‌نشده
  await admin.from("phone_otps").update({ consumed: true }).eq("phone", phone).eq("consumed", false);

  // ذخیره
  const { error: insErr } = await admin.from("phone_otps").insert({
    phone,
    code_hash,
    expires_at,
    meta: { full_name: fullName },
  });
  if (insErr) {
    throw createError({ statusCode: 500, statusMessage: "خطا در ذخیره OTP" });
  }

  // ارسال با SMS.ir
  const payload = {
    mobile: phone,
    templateId: config.smsirTemplateId,
    parameters: [{ name: config.smsirParamName || "CODE", value: code }],
  };

  const resp = await $fetch.raw("https://api.sms.ir/v1/send/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/plain",
      "x-api-key": config.smsirApiKey,
    },
    body: payload,
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw createError({ statusCode: 502, statusMessage: `SMS.ir error: ${resp.status} ${t}` });
  }

  // for sandbox mode
  const isSandbox = !!config.smsirSandbox || process.env.SMSIR_SANDBOX === "1";
  const isProd = process.env.NODE_ENV === "production";

  if (isSandbox && !isProd) {
    return { success: true, sandbox: true, echoCode: code };
  }

  return { success: true };
});
