const BASE = "http://localhost:3000";
const logFile = process.argv[2];
const phone = process.argv[3] || "09120000000"; // ادمین (یا هر کاربر)

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
  if (!matches.length) throw new Error("کد یافت نشد");
  const v = await req("/api/auth/otp/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, code: matches[matches.length - 1][1] }) });
  const cookie = v.setCookie.split(";")[0];
  console.log("✅ ورود:", v.json.user.role);

  const salonR = await req("/api/salons/mah");
  const salonId = salonR.json.salon.id;

  // علاقه‌مندی
  const fav = await req(`/api/favorites/${salonId}`, { method: "POST" }, cookie);
  console.log("✅ افزودن به علاقه‌مندی:", fav.status);
  const favList = await req("/api/favorites", {}, cookie);
  console.log("   لیست علاقه‌مندی‌ها:", favList.json.favorites.length);
  const favDel = await req(`/api/favorites/${salonId}`, { method: "DELETE" }, cookie);
  console.log("✅ حذف از علاقه‌مندی:", favDel.status);

  // نظر
  const rev = await req(`/api/salons/mah/reviews`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rating: 5, comment: "عالی بود" }),
  }, cookie);
  console.log("✅ ثبت نظر:", rev.status, rev.json?.success);
  const revList = await req("/api/salons/mah/reviews");
  console.log("   خلاصه نظرات:", JSON.stringify(revList.json.summary));

  console.log("\n🎉 تست نظرات و علاقه‌مندی‌ها موفق بود.");
}
main().catch((e) => { console.error("❌", e.message); process.exit(1); });
