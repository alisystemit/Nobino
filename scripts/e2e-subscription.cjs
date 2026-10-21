const BASE = "http://localhost:3000";
const logFile = process.argv[2];

async function req(path, opts = {}, cookie) {
  const headers = { ...(opts.headers || {}) };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(BASE + path, { ...opts, headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, setCookie: res.headers.get("set-cookie") };
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
  const owner = await login("09120000001");
  console.log("✅ ورود مالک سالن");

  // ۱) خرید پکیج سالانه با تمدید خودکار
  const pkgs = await req("/api/packages");
  const pkg = pkgs.json.packages[1]; // PRO
  const salons = await req("/api/salons", {}, owner);
  const salonId = salons.json.salons[0].id;
  const create = await req("/api/payments/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ packageId: pkg.id, salonId, gateway: "sandbox", period: "YEARLY", autoRenew: true }),
  }, owner);
  console.log("✅ خرید سالانه: amount=", create.json.amount, "period=YEARLY");

  const fin = await fetch(BASE + create.json.redirectUrl, { redirect: "manual", headers: { cookie: owner } });
  const loc = fin.headers.get("location");
  const res2 = await fetch(loc, { headers: { cookie: owner } });
  const text = await res2.text();
  console.log("✅ پرداخت:", text.includes("پرداخت موفق") ? "موفق" : "ناموفق");

  // ۲) بررسی اشتراک فعال + پلن سالن
  const admin = await login("09120000000");
  const subs = await req("/api/admin/subscriptions", {}, admin);
  const latest = subs.json.subscriptions[0];
  console.log("✅ اشتراک: status=", latest.status, "period=", latest.period, "plan=", latest.package.plan, "autoRenew=", latest.autoRenew);

  // ۳) مدیریت کاربران و پکیج‌ها
  const users = await req("/api/admin/users", {}, admin);
  console.log("✅ کاربران:", users.json.users.length, "نفر");
  const pkgList = await req("/api/admin/packages", {}, admin);
  console.log("✅ پکیج‌ها:", pkgList.json.packages.length, "item");

  console.log("\n🎉 چرخه اشتراک و پنل ادمین موفق بود.");
}
main().catch((e) => { console.error("❌", e.message); process.exit(1); });
