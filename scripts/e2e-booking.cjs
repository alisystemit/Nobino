// تست سرتاسری موتور نوبت‌دهی (MySQLسری/تداخل) روی سرور در حال اجرا
// نحوه اجرا: node scripts/e2e-booking.cjs <LOG_FILE> <PHONE>
const BASE = "http://localhost:3000";
const logFile = process.argv[2];
const phone = process.argv[3] || "09120000001";

async function req(path, opts = {}, cookie) {
  const headers = { ...(opts.headers || {}) };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(BASE + path, { ...opts, headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, setCookie: res.headers.get("set-cookie") };
}

async function main() {
  // ۱) ورود با OTP (کد از لاگ سرور خوانده می‌شود)
  await req("/api/auth/otp/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone }) });
  await new Promise((r) => setTimeout(r, 1500));
  const fs = await import("node:fs");
  const log = fs.readFileSync(logFile, "utf8");
  const m = log.match(new RegExp(`OTP به ${phone}: کد (\\d{4})`));
  const matches = [...log.matchAll(new RegExp(`OTP به ${phone}: کد (\\d{4})`, "g"))];
  if (!matches.length) throw new Error("کد OTP در لاگ یافت نشد");
  const code = matches[matches.length - 1][1];

  const v = await req("/api/auth/otp/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, code }) });
  if (!v.json?.success) throw new Error("ورود ناموفق: " + JSON.stringify(v.json));
  const cookie = v.setCookie.split(";")[0];
  console.log("✅ ورود:", v.json.user.role);

  // ۲) سالن
  const salonR = await req("/api/salons/mah");
  const salonId = salonR.json.salon.id;
  console.log("✅ سالن:", salonId);

  // ۳) ساخت یک خدمت تازه (id ASCII)
  const svc = await req(`/api/dashboard/salons/${salonId}/services`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "تست رنگ", durationMin: 45, price: 500000 }),
  }, cookie);
  const serviceId = svc.json.service.id;
  console.log("✅ خدمت:", serviceId, "مدت", svc.json.service.durationMin);

  // ۴) ساخت آرایشگر
  const staff = await req(`/api/dashboard/salons/${salonId}/staff`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "آزمایش", specialties: ["تست"] }),
  }, cookie);
  const staffId = staff.json.staff.id;
  console.log("✅ آرایشگر:", staffId);

  // ۵) اسلات آزاد
  const day = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  const av = await req(`/api/salons/mah/availability?serviceId=${serviceId}&employeeId=${staffId}&date=${day}`);
  if (!av.json.slots.length) throw new Error("اسلات آزاد یافت نشد");
  const slot = av.json.slots[0].startAt;
  console.log("✅ اسلات آزاد:", av.json.slots.length, "اولین:", slot);

  // ۶) رزرو اول
  const bk = await req("/api/appointments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ salonId, serviceId, employeeId: staffId, customerName: "سارا", customerPhone: "09121112233", startAt: slot, channel: "WEBAPP" }),
  }, cookie);
  console.log("✅ رزرو اول:", bk.status, bk.json?.success, bk.json?.appointment?.id);
  if (bk.status !== 201) throw new Error("رزرو اول ناموفق: " + JSON.stringify(bk.json));

  // ۷) تلاش برای رزرو هم‌زمان (باید 409 شود)
  const bk2 = await req("/api/appointments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ salonId, serviceId, employeeId: staffId, customerName: "رها", customerPhone: "09123334455", startAt: slot, channel: "WEBAPP" }),
  }, cookie);
  console.log("⛔ رزرو هم‌زمان:", bk2.status, bk2.json?.error);
  if (bk2.status !== 409) throw new Error("فیلتر تداخل کار نکرد: " + bk2.status);

  console.log("\n🎉 تمام سناریوهای موتور نوبت‌دهی موفق بودند.");
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
