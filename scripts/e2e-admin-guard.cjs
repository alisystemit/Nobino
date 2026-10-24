const BASE = "http://localhost:3000";
const logFile = process.argv[2];

async function req(path, opts = {}, cookie) {
  const headers = { ...(opts.headers || {}) };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(BASE + path, { ...opts, headers, redirect: "manual" });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, loc: res.headers.get("location"), setCookie: res.headers.get("set-cookie") };
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
  const admin = await login("09120000000");
  const owner = await login("09120000001");
  const customer = await login("09129991133");

  // ۱) صفحه /admin — مسدودسازی = 403 یا ریدایرکت (307)
  const blocked = (s) => s === 403 || s === 307;
  const a = await req("/admin", {}, admin);
  const o = await req("/admin", {}, owner);
  const c = await req("/admin", {}, customer);
  console.log("✅ /admin + ادمین:", a.status, a.status === 200 ? "OK" : "FAIL");
  console.log("⛔ /admin + سالون‌دار:", o.status, blocked(o.status) ? "OK" : "FAIL");
  console.log("⛔ /admin + مشتری:", c.status, blocked(c.status) ? "OK" : "FAIL");

  // ۲) API حساس
  const aApi = await req("/api/admin/saas-metrics", {}, admin);
  const oApi = await req("/api/admin/saas-metrics", {}, owner);
  const cApi = await req("/api/admin/saas-metrics", {}, customer);
  console.log("✅ API ادمین (ادمین):", aApi.status);
  console.log("⛔ API ادمین (سالون‌دار):", oApi.status, oApi.status === 403 ? "OK" : "FAIL");
  console.log("⛔ API ادمین (مشتری):", cApi.status, cApi.status === 403 ? "OK" : "FAIL");

  // ۳) /dashboard/admin (برای ادمین ریدایرکت به /admin؛ برای بقیه مسدود)
  const dAdmin = await req("/dashboard/admin", {}, admin);
  const dOwner = await req("/dashboard/admin", {}, owner);
  console.log("✅ /dashboard/admin (ادمین):", dAdmin.status, dAdmin.loc ? `→ ${dAdmin.loc}` : "");
  console.log("⛔ /dashboard/admin (سالون‌دار):", dOwner.status, blocked(dOwner.status) ? "OK" : "FAIL");

  const pass =
    a.status === 200 && blocked(o.status) && blocked(c.status) &&
    aApi.status === 200 && oApi.status === 403 && cApi.status === 403 &&
    blocked(dOwner.status);
  console.log("\n" + (pass ? "🎉 همه تست‌های امنیتی /admin موفق بودند." : "❌ برخی تست‌ها ناموفق."));
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error("❌", e.message); process.exit(1); });
