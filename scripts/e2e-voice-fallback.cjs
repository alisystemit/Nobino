/**
 * e2e-voice-fallback.cjs — راستی‌آزمایی زندهٔ جداسازی رزرو صوتی/دستی و مسیرهای بدون میکروفون
 *
 * پیش‌نیاز: سروری روی http://localhost:3000 (یا BASE_URL) در حال اجرا باشد؛
 * با بیلد پروداکشن هم کار می‌کند (کد OTP مستقیم از دیتابیس خوانده می‌شود).
 * اجرا:  node scripts/e2e-voice-fallback.cjs
 *        BASE_URL=http://localhost:3100 node scripts/e2e-voice-fallback.cjs
 *
 * سناریو:
 *  ۱) ورود مالک سالن و سوپرادمین
 *  ۲) صفحهٔ رزرو صوتی فقط جریان صوتی دارد؛ فرم دستی در /dashboard/new-appointment است
 *  ۳) POST /api/voice/transcribe با `text` (بدون فایل) → متن → استخراج JSON
 *  ۴) حالت پرسش فیلد با `text` + `partial` → ادغام، بدون از دست رفتن یافته‌های قبلی
 *  ۵) حالت عادی با `partial` → برش بعدی یافته‌های قبلی را پاک نمی‌کند
 *  ۶) درخواست توخالی → ۴۰۰ با پیام فارسی
 *  ۷) رکورد VoiceCall برای ورودی متنی ساخته می‌شود (audioUrl=null، rawText دارد)
 *  ۸) سقف voiceBooking پلن به حالت دست‌نخورده برمی‌گردد
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function req(path, opts = {}, cookie) {
  const headers = { ...(opts.headers || {}) };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(BASE + path, { ...opts, headers });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 240) };
  }
  return { status: res.status, json, text, setCookie: res.headers.get("set-cookie") };
}

let db = null;
async function getDb() {
  if (db) return db;
  const prismaMod = await import("@prisma/client");
  const PrismaClient = prismaMod.PrismaClient || prismaMod.default?.PrismaClient;
  db = new PrismaClient();
  return db;
}

async function login(phone) {
  await req("/api/auth/otp/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  const fresh = await getDb();
  const otp = await fresh.otp.findFirst({
    where: { phone, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { code: true },
  });
  if (!otp?.code) throw new Error(`کد OTP برای ${phone} در دیتابیس پیدا نشد`);
  const v = await req("/api/auth/otp/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone, code: otp.code }),
  });
  if (!v.setCookie) throw new Error(`ورود ${phone} ناموفق: ${JSON.stringify(v.json)}`);
  return v.setCookie.split(";")[0];
}

async function loginAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@nobino.ir";
  const password = process.env.ADMIN_PASSWORD || "Admin@1234";
  const v = await req("/api/admin/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!v.setCookie) throw new Error(`ورود سوپرادمین ناموفق: ${JSON.stringify(v.json)}`);
  return v.setCookie.split(";")[0];
}

/** ارسال فرم چند-جزئی به مسیر تبدیل گفتار */
async function sendVoice(cookie, fields) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    form.append(k, typeof v === "string" ? v : String(v));
  }
  return req("/api/voice/transcribe", { method: "POST", body: form }, cookie);
}

(async () => {
  const prisma = await getDb();
  const ownerUser = await prisma.user.findFirst({
    where: { role: "SALON_OWNER" },
    select: { id: true, phone: true },
    orderBy: { createdAt: "asc" },
  });
  if (!ownerUser?.phone) throw new Error("کاربر مالک سالن با شماره تلفن در دیتابیس نیست (npm run seed)");
  const salon = await prisma.salon.findFirst({
    where: { ownerId: ownerUser.id },
    select: { id: true, name: true, plan: true },
    orderBy: { createdAt: "asc" },
  });
  if (!salon) throw new Error("سالنی برای این مالک پیدا نشد");
  const plan = (salon.plan || "FREE").toUpperCase();

  const owner = await login(ownerUser.phone);
  const admin = await loginAdmin();
  check("ورود مالک سالن و سوپرادمین", Boolean(owner) && Boolean(admin));

  // ── ۲) جداسازی دو صفحه ──
  const voice = await req("/dashboard/voice-booking", {}, owner);
  check("صفحهٔ رزرو صوتی باز می‌شود", voice.status === 200, `status=${voice.status}`);
  check("عنوان صوتی و پیش‌نمایش گفتاری در صفحه هست", voice.text.includes("رزرو صوتی هوشمند") && voice.text.includes("پیش‌نمایش نوبت گفتاری"));
  check("فرم «ثبت دستی نوبت» از صفحه صوتی حذف شده", !voice.text.includes("ثبت نوبت دستی"));
  check("صفحهٔ صوتی پیوند رزرو دستی را دارد", voice.text.includes("/dashboard/new-appointment"));
  check("دکمهٔ نصب اپ در صفحهٔ صوتی هست", voice.text.includes("نصب اپ"));

  const manual = await req("/dashboard/new-appointment", {}, owner);
  check("صفحهٔ رزرو دستی باز می‌شود", manual.status === 200, `status=${manual.status}`);
  check("فرم دستی با عنوان و کانال نوبت نمایش داده می‌شود", manual.text.includes("ثبت دستی نوبت") && manual.text.includes("کانال دریافت نوبت"));
  check("صفحهٔ دستی دکمهٔ ضبط میکروفون ندارد", !manual.text.includes("در حال ضبط"));

  const nav = await req("/dashboard", {}, owner);
  check("منوی کناری هر دو مسیر جدا را دارد", nav.text.includes("رزرو دستی") && nav.text.includes("رزرو صوتی هوشمند"));

  // ── فعال‌سازی سقف voiceBooking پلن (آخر کار پاک می‌شود) ──
  const patch = await req(
    "/api/admin/limits",
    { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ updates: [{ plan, key: "voiceBooking", value: true }] }) },
    admin
  );
  check(`سقف voiceBooking پلن ${plan} روشن شد`, patch.status === 200, `status=${patch.status} ${patch.json.error || ""}`);
  await new Promise((r) => setTimeout(r, 9000)); // کش تنظیمات ۸ ثانیه

  const SENTENCE = "برای فردا ساعت 10:30 خدمت کوتاهی مو به نام سارا احمدی با شماره 09123456789";

  // ── ۳) ورودی متنی بدون فایل ──
  const textRes = await sendVoice(owner, { salonId: salon.id, phone: "09123456789", text: SENTENCE });
  check("POST با text تنها (بدون میکروفون) ۲۰۰ می‌دهد", textRes.status === 200 && textRes.json.success === true, `status=${textRes.status} ${textRes.json.error || ""}`);
  check("provider برای ورودی متنی «text» برمی‌گردد", textRes.json.provider === "text", `provider=${textRes.json.provider}`);
  check("متن دقیقاً همان جملهٔ ارسالی است", (textRes.json.transcript || "").includes("کوتاهی مو"), `transcript=${String(textRes.json.transcript).slice(0, 60)}`);
  const ex = textRes.json.extracted || {};
  check("شماره موبایل از جمله استخراج شد", String(ex.phone || "").includes("9123456789"), `phone=${ex.phone}`);
  check("نام مشتری از جمله استخراج شد", Boolean(ex.name), `name=${ex.name}`);
  check("ساعت از جمله استخراج شد", Boolean(ex.time), `time=${ex.time}`);
  const voiceCallId = textRes.json.voiceCallId;
  check("رکورد تماس صوتی ساخته شد", Boolean(voiceCallId), `id=${voiceCallId}`);

  // ── ۴) پرسش مجدد یک فیلد فقط با متن ──
  const fieldRes = await sendVoice(owner, {
    salonId: salon.id,
    phone: "09123456789",
    field: "date",
    text: "پنجشنبه ۱۴۰۵/۰۸/۰۵",
    partial: JSON.stringify({ name: "سارا احمدی", phone: "09123456789", time: "10:30" }),
    voiceCallId,
  });
  check("POST فیلد+text ۲۰۰ می‌دهد", fieldRes.status === 200 && fieldRes.json.success === true, `status=${fieldRes.status} ${fieldRes.json.error || ""}`);
  check("مقدار فیلد درخواستی برگشت", Boolean(fieldRes.json.fieldValue), `fieldValue=${fieldRes.json.fieldValue}`);
  const merged = fieldRes.json.extracted || {};
  check("ادغام، یافته‌های قبلی را نگه داشت", merged.name === "سارا احمدی" && Boolean(merged.phone) && Boolean(merged.time), JSON.stringify(merged));

  // ── ۵) برش بعدی در حالت عادی نباید قبلی‌ها را پاک کند ──
  const second = await sendVoice(owner, {
    salonId: salon.id,
    phone: "09123456789",
    text: "فقط ساعت را اصلاح می‌کنم: 18:45",
    partial: JSON.stringify({ name: "سارا احمدی", phone: "09123456789", date: "2026-10-27" }),
  });
  check("برش دوم ۲۰۰ می‌دهد", second.status === 200 && second.json.success === true, `status=${second.status}`);
  const ex2 = second.json.extracted || {};
  check("برش دوم نام و تاریخ قبلی را پاک نکرد", ex2.name === "سارا احمدی" && Boolean(ex2.date), JSON.stringify(ex2));

  // ── ۶) درخواست توخالی ──
  const empty = await sendVoice(owner, { salonId: salon.id, phone: "09123456789" });
  check("درخواست بدون audio و بدون text → ۴۰۰", empty.status === 400, `status=${empty.status}`);
  check("پیام خطای ۴۰۰ فارسی است", String(empty.json.error || "").includes("متن"), `error=${empty.json.error}`);

  // ── ۷) رکورد دیتابیس برای ورودی متنی ──
  const call = await prisma.voiceCall.findUnique({
    where: { id: voiceCallId },
    select: { audioUrl: true, rawText: true, transcript: true, status: true },
  });
  check("VoiceCall ورودی متنی فایل صوتی ندارد و rawText را نگه می‌دارد", Boolean(call) && call.audioUrl === null && Boolean(call.rawText), `status=${call?.status}`);

  // ── ۸) بازگشت سقف به حالت قبل ──
  const reset = await req(
    "/api/admin/limits",
    { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ updates: [{ plan, key: "voiceBooking", value: null }] }) },
    admin
  );
  const cell = (reset.json.matrix?.cells || {})[`${plan}:voiceBooking`];
  check("سقف voiceBooking به پیش‌فرض پلن برگشت", reset.status === 200 && cell?.overridden === false, `overridden=${cell?.overridden} effective=${cell?.effective}`);

  await prisma.$disconnect();
  console.log(failures ? `\n❌ ${failures} بررسی ناموفق` : "\n🎉 همهٔ بررسی‌های رزرو صوتی/دستی سبز است");
  process.exit(failures ? 1 : 0);
})().catch(async (e) => {
  console.error("❌ اجرا شکست خورد:", e.message);
  if (db) await db.$disconnect();
  process.exit(1);
});
