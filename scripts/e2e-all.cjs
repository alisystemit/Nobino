// تست جامع تمام ماژول‌ها — هر بخش جداگانه با نتیجه دقیق
const BASE = "http://localhost:3000";
const logFile = process.argv[2];

const results = [];
function report(module, test, ok, detail = "") {
  results.push({ module, test, ok, detail });
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} [${module}] ${test}${detail ? " — " + detail : ""}`);
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

async function req(path, opts = {}, cookie) {
  const headers = { ...(opts.headers || {}) };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(BASE + path, { ...opts, headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, setCookie: res.headers.get("set-cookie") };
}

async function login(phone) {
  await req("/api/auth/otp/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone }) });
  await new Promise((r) => setTimeout(r, 1500));
  const fs = await import("node:fs");
  const log = fs.readFileSync(logFile, "utf8");
  const matches = [...log.matchAll(new RegExp(`OTP به ${phone}: کد (\\d{4})`, "g"))];
  const v = await req("/api/auth/otp/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, code: matches[matches.length - 1][1] }) });
  return v.setCookie.split(";")[0];
}

async function main() {
  // ═══════════ ۱) احراز هویت ═══════════
  console.log("\n== ۱) احراز هویت ==");
  const admin = await login("09120000000");
  report("Auth", "ورود ادمین", !!admin, admin?.slice(0, 15));
  const owner = await login("09120000001");
  report("Auth", "ورود آرایشگر", !!owner);
  const agentC = await login("09120000002");
  report("Auth", "ورود نماینده", !!agentC);
  const me = await req("/api/auth/me", {}, owner);
  report("Auth", "me (آرایشگر)", me.status === 200 && me.json.user.role === "SALON_OWNER", JSON.stringify(me.json?.user?.role));
  // ورود شماره نامعتبر
  const bad = await req("/api/auth/otp/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: "123" }) });
  report("Auth", "رد شماره نامعتبر", bad.status === 400, bad.status);
  // ایمیل
  const emReq = await req("/api/auth/email/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "test@example.com" }) });
  report("Auth", "درخواست OTP ایمیل", emReq.status === 200, emReq.status);

  // ═══════════ ۲) سالن‌ها ═══════════
  console.log("\n== ۲) سالن‌ها ==");
  const salons = await req("/api/salons", {}, owner);
  report("Salons", "لیست سالن‌های مالک", salons.status === 200 && salons.json.salons.length > 0, `تعداد=${salons.json?.salons?.length}`);
  const salon = salons.json.salons[0];
  const slug = salon.slug;
  const pub = await req(`/api/salons/${slug}`);
  report("Salons", "صفحه عمومی سالن", pub.status === 200 && pub.json.salon.name, pub.json?.salon?.name);
  const search = await req("/api/salons/search?city=تهران");
  report("Salons", "جستجو", search.status === 200 && Array.isArray(search.json.salons), search.status);
  const notfound = await req("/api/salons/nonexistent");
  report("Salons", "سالن ناموجود → 404", notfound.status === 404, notfound.status);

  // ═══════════ ۳) خدمات ═══════════
  console.log("\n== ۳) خدمات ==");
  const services = await req(`/api/dashboard/salons/${salon.id}/services`, {}, owner);
  report("Services", "لیست خدمات", services.status === 200 && services.json.services.length > 0, `تعداد=${services.json?.services?.length}`);
  const svc = services.json.services[0];
  // ساخت خدمت جدید
  const nsvc = await req(`/api/dashboard/salons/${salon.id}/services`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "تست دیباگ", durationMin: 20, price: 100000 }) }, owner);
  report("Services", "ساخت خدمت", nsvc.status === 201, nsvc.status);
  const svcId = nsvc.json?.service?.id;
  if (svcId) {
    const del = await req(`/api/dashboard/salons/${salon.id}/services/${svcId}`, { method: "DELETE" }, owner);
    report("Services", "حذف خدمت", del.status === 200, del.status);
  }

  // ═══════════ ۴) در دسترس بودن / زمان آزاد ═══════════
  console.log("\n== ۴) زمان آزاد ==");
  const day = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  const av = await req(`/api/salons/${slug}/availability?serviceId=${svc.id}&date=${day}`);
  report("Availability", "اسلات آزاد", av.status === 200, `تعداد=${av.json?.slots?.length}`);
  const avBad = await req(`/api/salons/${slug}/availability?serviceId=${svc.id}`);
  report("Availability", "بدون تاریخ → 400", avBad.status === 400, avBad.status);

  // ═══════════ ۵) نوبت‌ها ═══════════
  console.log("\n== ۵) نوبت‌ها ==");
  const slot = av.json?.slots?.[0]?.startAt;
  const appt = await req("/api/appointments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ salonId: salon.id, serviceId: svc.id, customerName: "مشتری تست", customerPhone: "09121119900", startAt: slot, channel: "WEBAPP" }) }, owner);
  report("Appointments", "ثبت نوبت", appt.status === 201, appt.status);
  const apptId = appt.json?.appointment?.id;
  if (apptId) {
    const lst = await req("/api/appointments", {}, owner);
    report("Appointments", "لیست نوبت‌ها", lst.status === 200 && lst.json.appointments.length > 0, `تعداد=${lst.json?.appointments?.length}`);
    // همرزمان → 409
    const clash = await req("/api/appointments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ salonId: salon.id, serviceId: svc.id, customerName: "دوم", customerPhone: "09121119911", startAt: slot, channel: "WEBAPP" }) }, owner);
    report("Appointments", "رزرو هم‌زمان → 409", clash.status === 409, clash.status);
    // وضعیت → COMPLETED
    const done = await req(`/api/appointments/${apptId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "COMPLETED" }) }, owner);
    report("Appointments", "تکمیل نوبت", done.status === 200 && done.json.appointment.status === "COMPLETED", done.json?.appointment?.status);
  }

  // جابه‌جایی و لغو روی یک نوبت «فعال» (نه تکمیل‌شده)
  const actSlot = av.json?.slots?.[1]?.startAt;
  const rsSlot = av.json?.slots?.[3]?.startAt;
  if (actSlot) {
    const act = await req("/api/appointments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ salonId: salon.id, serviceId: svc.id, customerName: "فعال", customerPhone: "09121119922", startAt: actSlot, channel: "WEBAPP" }) }, owner);
    const actId = act.json?.appointment?.id;
    if (actId) {
      if (rsSlot) {
        const rs = await req(`/api/appointments/${actId}/reschedule`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ startAt: rsSlot }) }, owner);
        report("Appointments", "جابه‌جایی (فعال)", rs.status === 200, rs.status);
      }
      const canc = await req(`/api/appointments/${actId}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "تست" }) }, owner);
      report("Appointments", "لغو نوبت (فعال)", canc.status === 200, canc.status);
    }
  }

  // ═══════════ ۶) قفل موقت ═══════════
  console.log("\n== ۶) قفل موقت ==");
  const holdSlot = av.json?.slots?.[2]?.startAt;
  if (holdSlot) {
    const hold = await req("/api/appointments/hold", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ salonId: salon.id, serviceId: svc.id, startAt: holdSlot }) });
    report("Hold", "ایجاد قفل موقت", hold.status === 201, hold.status);
    const holdId = hold.json?.holdId;
    if (holdId) {
      const confirm = await req("/api/appointments/hold/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appointmentId: holdId, customerName: "نگار", customerPhone: "09124440000" }) });
      report("Hold", "تأیید قفل → نوبت", confirm.status === 200, confirm.status);
    }
  }

  // ═══════════ ۷) نوبت صوتی ═══════════
  console.log("\n== ۷) نوبت صوتی ==");
  const form = new FormData();
  form.append("salonId", salon.id);
  form.append("audio", new Blob([new Uint8Array(1000)], { type: "audio/webm" }), "t.webm");
  const voice = await fetch(BASE + "/api/voice/transcribe", { method: "POST", body: form });
  const vJson = await voice.json().catch(() => null);
  report("Voice", "transcribe (Mock)", voice.status === 200, JSON.stringify(vJson)?.slice(0, 80));
  const voiceNoSalon = await req("/api/voice/transcribe", { method: "POST", body: new FormData() });
  report("Voice", "بدون فایل → 400", voiceNoSalon.status === 400, voiceNoSalon.status);

  // ═══════════ ۸) کیف پول و کمیسیون ═══════════
  console.log("\n== ۸) مالی ==");
  const wallet = await req("/api/wallet", {}, owner);
  report("Wallet", "کیف پول مالک", wallet.status === 200, JSON.stringify(wallet.json?.wallet?.balance));
  const comm = await req("/api/commission", {}, agentC);
  report("Commission", "کمیسیون نماینده", comm.status === 200, JSON.stringify(comm.json?.summary?.totalEarned));

  // ═══════════ ۹) پرداخت ═══════════
  console.log("\n== ۹) پرداخت ==");
  const gws = await req("/api/payments/gateways");
  report("Payments", "لیست درگاه‌ها", gws.status === 200 && gws.json.gateways.length >= 15, `تعداد=${gws.json?.gateways?.length}`);
  const pkgs = await req("/api/packages");
  report("Payments", "لیست پکیج‌ها", pkgs.status === 200 && pkgs.json.packages.length > 0, `تعداد=${pkgs.json?.packages?.length}`);
  const pkg = pkgs.json.packages[0];
  const create = await req("/api/payments/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ packageId: pkg.id, salonId: salon.id, gateway: "sandbox", period: "MONTHLY" }) }, owner);
  report("Payments", "ایجاد پرداخت sandbox", create.status === 201, JSON.stringify(create.json?.amount));
  if (create.json?.redirectUrl) {
    const fin = await fetch(BASE + create.json.redirectUrl, { redirect: "manual", headers: { cookie: owner } });
    const loc = fin.headers.get("location");
    const res2 = await fetch(loc, { headers: { cookie: owner } });
    const txt = await res2.text();
    report("Payments", "تکمیل پرداخت", txt.includes("پرداخت موفق"), txt.includes("پرداخت موفق") ? "موفق" : "ناموفق");
  }

  // ═══════════ ۱۰) پنل سالن ═══════════
  console.log("\n== ۱۰) پنل سالن ==");
  const branches = await req(`/api/dashboard/salons/${salon.id}/branches`, {}, owner);
  report("SalonMgr", "شعبه‌ها", branches.status === 200, `تعداد=${branches.json?.branches?.length}`);
  const cash = await req(`/api/dashboard/salons/${salon.id}/cash`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cashAmount: 100000, cardAmount: 50000 }) }, owner);
  report("SalonMgr", "ثبت صندوق", cash.status === 201, cash.status);
  const hours = await req(`/api/dashboard/salons/${salon.id}/hours`, {}, owner);
  report("SalonMgr", "ساعات کاری", hours.status === 200 && hours.json.hours.length === 7, `تعداد=${hours.json?.hours?.length}`);
  const reportR = await req(`/api/dashboard/salons/${salon.id}/report`, {}, owner);
  report("SalonMgr", "گزارش عملکرد", reportR.status === 200, JSON.stringify(reportR.json?.report?.total));
  const finR = await req(`/api/dashboard/salons/${salon.id}/financial?from=2026-01-01&to=2026-12-31`, {}, owner);
  report("SalonMgr", "گزارش مالی", finR.status === 200, JSON.stringify(finR.json?.report?.revenueLabel));

  // ═══════════ ۱۱) صف انتظار ═══════════
  console.log("\n== ۱۱) صف انتظار ==");
  const wl = await req(`/api/salons/${slug}/waitlist`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customerName: "منتظر", customerPhone: "09129990000" }) });
  report("Waitlist", "ثبت در صف", wl.status === 201, wl.status);
  const wlId = wl.json?.entry?.id;
  if (wlId) {
    const mark = await req(`/api/salons/${slug}/waitlist/${wlId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "NOTIFIED" }) }, owner);
    report("Waitlist", "علامت‌گذاری", mark.status === 200, mark.status);
  }

  // ═══════════ ۱۲) ادمین پلتفرم ═══════════
  console.log("\n== ۱۲) ادمین پلتفرم ==");
  const users = await req("/api/admin/users", {}, admin);
  report("Admin", "لیست کاربران", users.status === 200 && users.json.users.length > 0, `تعداد=${users.json?.users?.length}`);
  const subs = await req("/api/admin/subscriptions", {}, admin);
  report("Admin", "اشتراک‌ها", subs.status === 200, `تعداد=${subs.json?.subscriptions?.length}`);
  const discounts = await req("/api/admin/discounts", {}, admin);
  report("Admin", "کد تخفیف", discounts.status === 200, `تعداد=${discounts.json?.discounts?.length}`);
  const reviews = await req("/api/admin/reviews", {}, admin);
  report("Admin", "نظرات", reviews.status === 200, `تعداد=${reviews.json?.reviews?.length}`);
  const settings = await req("/api/admin/settings", {}, admin);
  report("Admin", "تنظیمات سیستم", settings.status === 200 && settings.json.smsProviders.length >= 10, `سرویس‌ها=${settings.json?.smsProviders?.length}`);
  const metrics = await req("/api/admin/saas-metrics", {}, admin);
  report("Admin", "شاخص‌های SaaS", metrics.status === 200, JSON.stringify(metrics.json?.metrics?.mrr));
  const audit = await req("/api/admin/audit", {}, admin);
  report("Admin", "لاگ حسابرسی", audit.status === 200, `تعداد=${audit.json?.logs?.length}`);

  // ═══════════ ۱۳) AI ═══════════
  console.log("\n== ۱۳) هوش مصنوعی ==");
  const chat = await req("/api/ai/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ salonId: salon.id, question: "قیمت خدمات چنده؟" }) });
  report("AI", "دستیار چت", chat.status === 200, chat.json?.reply?.slice(0, 40));
  const analyze = await req("/api/ai/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ salonId: salon.id }) }, owner);
  report("AI", "تحلیل کسب‌وکار", analyze.status === 200, analyze.json?.summary?.slice(0, 40));
  const content = await req("/api/ai/generate-content", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ salonId: salon.id, type: "promo", targetId: salon.id }) }, owner);
  report("AI", "تولید محتوا", content.status === 200, content.json?.text?.slice(0, 30));
  const suggest = await req(`/api/salons/${slug}/ai/suggest`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ serviceId: svc.id, date: day }) });
  report("AI", "پیشنهاد زمان", suggest.status === 200, `اسلات=${suggest.json?.slots?.length}`);

  // ═══════════ ۱۴) علاقه‌مندی و کارت هدیه ═══════════
  console.log("\n== ۱۴) علاقه‌مندی و کارت هدیه ==");
  const fav = await req(`/api/favorites/${salon.id}`, { method: "POST" }, owner);
  report("Favorite", "افزودن علاقه‌مندی", fav.status === 201, fav.status);
  const favList = await req("/api/favorites", {}, owner);
  report("Favorite", "لیست علاقه‌مندی", favList.status === 200 && favList.json.favorites.length > 0, `تعداد=${favList.json?.favorites?.length}`);
  const gc = await req("/api/giftcards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ balance: 200000 }) }, agentC);
  report("GiftCard", "فروش کارت هدیه", gc.status === 201, gc.json?.card?.code);
  if (gc.json?.card?.code) {
    const redeem = await req("/api/giftcards/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: gc.json.card.code, amount: 50000 }) }, owner);
    report("GiftCard", "مصرف توسط شخص دیگر", redeem.status === 200, JSON.stringify(redeem.json?.remaining));
  }

  // ═══════════ ۱۵) اعلان عمومی ═══════════
  console.log("\n== ۱۵) اعلان عمومی ==");
  const ann = await req("/api/public/announcement");
  report("Announcement", "دریافت اعلان", ann.status === 200, ann.json?.announcement);

  // ═══════════ خلاصه ═══════════
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log("\n" + "═".repeat(50));
  console.log(`🔢 کل تست‌ها: ${results.length} | ✅ موفق: ${passed} | ❌ ناموفق: ${failed.length}`);
  if (failed.length) {
    console.log("\n❌ بخش‌های ناموفق:");
    failed.forEach((f) => console.log(`  [${f.module}] ${f.test} — ${f.detail}`));
  }
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error("❌ خطا در اجرا:", e.message); process.exit(1); });
