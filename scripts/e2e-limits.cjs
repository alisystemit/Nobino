/**
 * e2e-limits.cjs — راستی‌آزمایی زندهٔ سیستم محدودیت‌های پویا
 *
 * پیش‌نیاز: سروری روی http://localhost:3000 (یا BASE_URL) در حال اجرا باشد؛ با بیلد
 * پروداکشن هم کار می‌کند، چون کد OTP مستقیم از دیتابیس خوانده می‌شود.
 * اجرا:  node scripts/e2e-limits.cjs
 *        BASE_URL=http://localhost:3100 node scripts/e2e-limits.cjs
 *        (رمز سوپرادمین از متغیرهای ADMIN_EMAIL / ADMIN_PASSWORD خوانده می‌شود؛
 *         پیش‌فرض همان مقدار seed: admin@nobino.ir / Admin@1234)
 *
 * سناریو (هیچ دادهٔ نمونه‌ای خراب نمی‌شود؛ همهٔ سقف‌ها آخر کار به پیش‌فرض برمی‌گردند):
 *  ۱) خواندن ماتریس محدودیت‌ها از پنل سوپرادمین
 *  ۲) تغییر دست‌ی یک سقف (staff پلن FREE) و دیدن اثر آن در صفحهٔ داشبورد سالن
 *  ۳) رد شدن ساخت کارمند با کد ۴۰۲ و پیام فارسی
 *  ۴) رد شدن ایمپورت مشتری وقتی سقف CRM پر است
 *  ۵) رد شدن «ساخت سالن جدید» به دلیل سقف تعداد سالن هر کاربر
 *  ۶) بازگشت همهٔ تغییرات به پیش‌فرض پلن
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
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json, text, setCookie: res.headers.get("set-cookie") };
}

let db = null;
/** کلاینت Prisma برای خواندن کد OTP و شمارش صف پیامک (در پروداکشن هم کار می‌کند) */
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
  // کد از دیتابیس خوانده می‌شود تا به endpoint توسعه یا سوئیچ sms.show_sent_codes وابسته نباشیم
  const fresh = await getDb();
  // دقیقاً همان رکوردی که verifyOtp انتخاب می‌کند: جدیدترین کد مصرف‌نشدهٔ این شماره
  const otp = await fresh.otp.findFirst({
    where: { phone, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { code: true },
  });
  if (!otp?.code) throw new Error(`کد OTP برای ${phone} در دیتابیس پیدا نشد (سید این شماره را دارد؟)`);
  const v = await req("/api/auth/otp/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone, code: otp.code }),
  });
  if (!v.setCookie) throw new Error(`ورود ${phone} ناموفق بود: ${JSON.stringify(v.json)}`);
  return v.setCookie.split(";")[0];
}

/** سوپرادمین با ایمیل + رمز (رمز پیش‌فرض سید: Admin@1234) */
async function loginAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@nobino.ir";
  const password = process.env.ADMIN_PASSWORD || "Admin@1234";
  const v = await req("/api/admin/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!v.setCookie) throw new Error(`ورود سوپرادمین ناموفق بود (${v.status}): ${v.json?.error || ""}`);
  return v.setCookie.split(";")[0];
}

const ck = (plan, key) => `${plan}:${key}`;
const cellOf = (matrix, plan, key) => matrix.cells[ck(plan, key)];

async function main() {
  console.log(`🔎 هدف: ${BASE}\n`);

  const admin = await loginAdmin();
  check("ورود سوپرادمین (ایمیل + رمز)", true);

  // ۱) ماتریس محدودیت‌ها
  const m = await req("/api/admin/limits", {}, admin);
  check("GET /api/admin/limits با ۲۰۰ برمی‌گردد", m.status === 200 && m.json.success === true, `status=${m.status}`);
  const matrix = m.json;
  check("۴ پلن و ۱۵ محدودیت در کاتالوگ", matrix.plans?.length === 4 && matrix.defs?.length >= 15, `plans=${matrix.plans?.length} defs=${matrix.defs?.length}`);
  check("ماتریس کامل است (هر پلن × هر محدودیت)", Object.keys(matrix.cells || {}).length === matrix.plans.length * matrix.defs.length, `cells=${Object.keys(matrix.cells || {}).length}`);
  check("ناهماهنگی کاتالوگ ندارد", Array.isArray(matrix.issues) && matrix.issues.length === 0, (matrix.issues || []).join(" | "));
  check("پیامک ماهانه و کمپین «ماهانه» و سالن «سطح کاربر» است",
    matrix.defs.find((d) => d.key === "smsPerMonth")?.monthly === true &&
      matrix.defs.find((d) => d.key === "campaigns")?.monthly === true &&
      matrix.defs.find((d) => d.key === "salons")?.scope === "owner");
  check("آستانهٔ «نامحدود» از API می‌آید و هر سقف عددی تا آن قابل ورود است",
    Number(matrix.unlimitedFrom) >= 100000 &&
      matrix.defs.filter((d) => d.kind === "count").every((d) => Number(d.max) >= Number(matrix.unlimitedFrom)),
    `unlimitedFrom=${matrix.unlimitedFrom}`);

  // سالندار و پلن واقعی سالنش (سالن اولِ ۰۹۱۲۰۰۰۰۰۰۱)
  const owner = await login("09120000001");
  const salons = await req("/api/salons", {}, owner);
  const salon = salons.json.salons?.[0];
  check("سالن تست پیدا شد", Boolean(salon?.id), salon?.name || "");
  if (!salon) throw new Error("سالن نمونه وجود ندارد");
  const plan = (salon.plan || "FREE").toUpperCase();
  console.log(`ℹ️ پلن سالن «${salon.name}»: ${plan}`);

  // ۲) تغییر دست‌ی سقف همان پلن (کارمند=۰، مشتری=۰، سالن=۱)
  const updates = [
    { plan, key: "staff", value: 0 },
    { plan, key: "customers", value: 0 },
    { plan, key: "salons", value: 1 },
  ];
  const patch = await req(
    "/api/admin/limits",
    { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ updates }) },
    admin
  );
  check("PATCH سه سقف با ۲۰۰", patch.status === 200 && patch.json.saved === 3, `saved=${patch.json.saved} ${patch.json.error || ""}`);
  check("مقدار مؤثر به ۰ رسید و «دست‌ی» علامت خورد",
    cellOf(patch.json.matrix, plan, "staff")?.effective === 0 && cellOf(patch.json.matrix, plan, "staff")?.overridden === true,
    `effective=${cellOf(patch.json.matrix, plan, "staff")?.effective}`);

  // اثر تغییر سقف در کارت «مصرف پلن» داشبورد سالن
  await new Promise((r) => setTimeout(r, 9000)); // کش تنظیمات ۸ ثانیه
  const dash = await req("/dashboard/salon", {}, owner);
  check("داشبورد سالن کلمه «مصرف پلن» را دارد", (dash.text || "").includes("مصرف پلن"), `status=${dash.status}`);

  // ۳) ساخت کارمند باید ۴۰۲ بگیرد (سقف صفر → هیچ کارمندی مجاز نیست)
  const staff = await req(
    `/api/dashboard/salons/${salon.id}/staff`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "تست سقف", role: "STYLIST" }) },
    owner
  );
  check("ساخت کارمند فراتر از سقف → ۴۰۲", staff.status === 402, `status=${staff.status} msg=${staff.json?.error || ""}`);
  check("پیام خطا فارسی و ارجاع به پلن است", /سقف|فعال نیست/.test(staff.json?.error || "") && (staff.json?.error || "").includes("پلن"), staff.json?.error || "");

  // ۴) ایمپورت مشتری با سقف صفر → ۴۰۲
  const imp = await req(
    `/api/dashboard/salons/${salon.id}/import/customers`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: [{ phone: "09121110000", name: "مشتری سقف" }] }) },
    owner
  );
  check("ایمپورت مشتری با سقف پر → ۴۰۲", imp.status === 402, `status=${imp.status} msg=${imp.json?.error || ""}`);

  // ۵) سقف «تعداد سالن هر کاربر»
  const newSalon = await req(
    "/api/salons",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "سالن دوم تست", slug: "test-second-salon-e2e", phone: "09129999999", city: "تهران" }) },
    owner
  );
  check("ساخت سالن دوم با سقف ۱ → ۴۰۲", newSalon.status === 402, `status=${newSalon.status} msg=${newSalon.json?.error || ""}`);

  // ۶) بازگشت به پیش‌فرض و دیدن مقدار قبلی
  const reset = await req(
    "/api/admin/limits",
    { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ updates: updates.map((u) => ({ plan: u.plan, key: u.key, value: null })) }) },
    admin
  );
  const back = cellOf(reset.json.matrix || {}, plan, "staff");
  check("بازگشت به پیش‌فرض (کلیدها پاک شدند)", reset.status === 200 && back?.overridden === false && back?.effective > 1, `staff=${back?.effective}`);

  // ساخت کارمند بعد از بازگشت سقف، دیگر نباید ۴۰۲ بگیرد
  const after = await req(
    `/api/dashboard/salons/${salon.id}/staff`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "تست سقف", role: "STYLIST" }) },
    owner
  );
  check("بعد از بازگشت سقف، ساخت کارمند ۴۰۲ نمی‌دهد", after.status !== 402, `status=${after.status}`);
  if (after.json?.staff?.id) {
    const del = await req(`/api/dashboard/salons/${salon.id}/staff/${after.json.staff.id}`, { method: "DELETE" }, owner);
    console.log(`${del.status < 300 ? "🧹" : "⚠️"} کارمند تست حذف شد (status=${del.status})`);
  }

  // ۷) سقف «پیامک ارسالی در ماه»: نوبت ثبت می‌شود ولی پیامک به صف نمی‌آید
  const smsPatch = await req(
    "/api/admin/limits",
    { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ updates: [{ plan, key: "smsPerMonth", value: 0 }] }) },
    admin
  );
  check("سقف پیامک ماهانه پلن روی صفر تنظیم شد", smsPatch.status === 200 && cellOf(smsPatch.json.matrix, plan, "smsPerMonth")?.effective === 0);

  const prisma = await getDb();
  try {
    const [services, staffList] = await Promise.all([
      req(`/api/dashboard/salons/${salon.id}/services`, {}, owner),
      req(`/api/dashboard/salons/${salon.id}/staff`, {}, owner),
    ]);
    const service = (services.json.services || []).find((s) => s.isActive !== false);
    const emp = (staffList.json.staff || []).find((s) => s.isActive !== false);
    check("خدمت و آرایشگر فعال برای رزرو پیدا شد", Boolean(service?.id && emp?.id), `service=${service?.name} employee=${emp?.name}`);

    if (service && emp) {
      await new Promise((r) => setTimeout(r, 9000)); // کش تنظیمات
      const day = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
      const av = await req(`/api/salons/${salon.slug}/availability?serviceId=${service.id}&employeeId=${emp.id}&date=${day}`);
      const slot = (av.json.slots || [])[0]?.startAt;
      check("اسلات آزاد پیدا شد", Boolean(slot), `date=${day} slots=${(av.json.slots || []).length}`);
      if (slot) {
        // اعلان «سقف پیامک» روزی یک بار ثبت می‌شود؛ برای تست قطعی، نسخهٔ امروز را پاک می‌کنیم
        const dayKey = new Date().toISOString().slice(0, 10);
        await prisma.notification.deleteMany({ where: { uniqueKey: `sms-limit:${salon.id}:${dayKey}` } });
        const before = await prisma.notification.count({ where: { salonId: salon.id, channel: "SMS" } });
        const t0 = new Date();
        const bk = await req(
          "/api/appointments",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ salonId: salon.id, serviceId: service.id, employeeId: emp.id, customerName: "تست سقف پیامک", customerPhone: "09121119988", startAt: slot, channel: "WEBAPP" }),
          },
          owner
        );
        check("رزرو با سقف پیامک صفر هنوز موفق است (جریان نوبت نمی‌شکند)", bk.status === 201, `status=${bk.status} ${bk.json?.error || ""}`);
        const newSms = await prisma.notification.count({ where: { salonId: salon.id, channel: "SMS", createdAt: { gte: t0 } } });
        check("پیامک جدیدی به صف نیامده است", newSms === 0, `newSms=${newSms} (تاریخی=${before})`);
        const notice = await prisma.notification.count({ where: { type: "SMS_LIMIT_REACHED", salonId: salon.id, createdAt: { gte: t0 } } });
        check("اعلان داخلی «سقف پیامک» ثبت شد", notice >= 1, `notice=${notice}`);
        if (bk.json?.appointment?.id) {
          const cancel = await req(
            `/api/appointments/${bk.json.appointment.id}`,
            { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "CANCELLED" }) },
            owner
          );
          console.log(`${cancel.status < 300 ? "🧹" : "⚠️"} نوبت تست لغو شد (status=${cancel.status})`);
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  const smsReset = await req(
    "/api/admin/limits",
    { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ updates: [{ plan, key: "smsPerMonth", value: null }] }) },
    admin
  );
  check("سقف پیامک به پیش‌فرض پلن برگشت", smsReset.status === 200 && cellOf(smsReset.json.matrix, plan, "smsPerMonth")?.overridden === false, `value=${cellOf(smsReset.json.matrix, plan, "smsPerMonth")?.effective}`);

  // ماتریس باید بعد از تست‌ها دقیقاً مثل روز اول (همه روی پیش‌فرض کد) باشد
  const leftovers = Object.values(smsReset.json.matrix?.cells || {}).filter((c) => c.overridden);
  check("هیچ سقف دست‌ی یا ردیف به‌جا مانده‌ای باقی نمانده", leftovers.length === 0, leftovers.map((c) => `${c.plan}.${c.key}=${c.override}`).join(" | "));
  console.log(`\n${failures ? `❌ ${failures} مورد ناموفق` : "🎉 همهٔ بررسی‌های محدودیت‌های پویا موفق بود"}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
