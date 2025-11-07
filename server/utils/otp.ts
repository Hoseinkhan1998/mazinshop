import crypto from 'node:crypto';

export function normalizePhone(phone: string): string {
  const raw = (phone || '').replace(/\D/g, '');
  // 0912xxxxxxx
  if (/^09\d{9}$/.test(raw)) return raw;
  // 912xxxxxxx  -> تبدیل به 0912...
  if (/^9\d{9}$/.test(raw)) return '0' + raw;
  // 98912xxxxxxx -> تبدیل به 0912...
  if (/^989\d{9}$/.test(raw)) return '0' + raw.substring(2);
  throw new Error('شماره موبایل نامعتبر است (مثال: 09123456789)');
}


export function randomCode(len = 6): string {
  const n = Math.floor(Math.random() * Math.pow(10, len));
  return n.toString().padStart(len, '0');
}

export function hmacCode(code: string, phone: string, pepper: string): string {
  const h = crypto.createHmac('sha256', pepper);
  h.update(`${code}|${phone}`);
  return h.digest('base64');
}

export function randomPassword(): string {
  return crypto.randomBytes(24).toString('base64');
}
