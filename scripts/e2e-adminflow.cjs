const BASE = "http://localhost:3000";
const logFile = process.argv[2];
const phone = process.argv[3] || "09120000000";

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
  await req("/api/auth/otp/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone }) });
  await new Promise((r) => setTimeout(r, 1500));
  const fs = await import("node:fs");
  const log = fs.readFileSync(logFile, "utf8");
  const matches = [...log.matchAll(new RegExp(`OTP به ${phone}: کد (\\d{4})`, "g"))];
  const v = await req("/api/auth/otp/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, code: matches[matches.length - 1][1] }) });
  const cookie = v.setCookie.split(";")[0];
  console.log("✅ ورود:", v.json.user.role);

  // ۱) ساخت کد تخفیف
  const d = await req("/api/admin/discounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "TEST20", percent: 20 }) }, cookie);
  console.log("✅ ساخت کد تخفیف:", d.status, d.json?.discount?.code);

  // ۲) خرید با کد تخفیف
  const pkgs = await req("/api/packages");
  const pkg = pkgs.json.packages[1];
  const create = await req("/api/payments/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ packageId: pkg.id, gateway: "sandbox", discountCode: "TEST20" }) }, cookie);
  console.log("✅ خرید با تخفیف: amount=", create.json.amount, "original=", create.json.originalAmount, "discount=", create.json.discountApplied);

  // ۳) تکمیل پرداخت sandbox (redirect از طریق mock-pay)
  const fin = await fetch(BASE + create.json.redirectUrl, { redirect: "manual", headers: { cookie } });
  const statusText = fin.status === 302 || fin.status === 301 ? (await (await fetch(fin.headers.get("location"), { headers: { cookie } })).text()) : await fin.text();
  console.log("✅ پرداخت:", statusText.includes("پرداخت موفق") ? "موفق" : "ناموفق");

  // ۴) بررسی افزایش usedCount
  const list = await req("/api/admin/discounts", {}, cookie);
  const disc = list.json.discounts.find((x) => x.code === "TEST20");
  console.log("   usedCount after pay:", disc.usedCount);

  // ۵) تأیید/تعلیق سالن + لاگ
  const salons = await req("/api/salons", {}, cookie);
  const salon = salons.json.salons[0];
  const st = await req(`/api/admin/salons/${salon.id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isActive: false }) }, cookie);
  console.log("✅ تعلیق سالن:", st.status, st.json?.success);
  await req(`/api/admin/salons/${salon.id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isActive: true }) }, cookie);
  const audit = await req("/api/admin/audit", {}, cookie);
  console.log("✅ لاگ حسابرسی:", audit.json.logs.length, "رویداد");

  // ۶) تست پیامک (بدون کلید → باید 400 برگردد)
  const smsTest = await req("/api/admin/sms/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: "kavenegar", phone: "09121110000" }) }, cookie);
  console.log("   تست پیامک (بدون کلید):", smsTest.status, smsTest.json?.error);

  console.log("\n🎉 فلوی ادمین کامل تأیید شد.");
}
main().catch((e) => { console.error("❌", e.message); process.exit(1); });
