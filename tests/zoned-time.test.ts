import test from "node:test";
import assert from "node:assert/strict";
import { zonedTimeToIso, todayInZone } from "../src/lib/time/zoned.ts";

test("تهران: ساعت وال‌کلوک سالن دقیقاً به UTC درست تبدیل می‌شود (+۳:۳۰)", () => {
  assert.equal(zonedTimeToIso("2026-10-27", "11:30", "Asia/Tehran"), "2026-10-27T08:00:00.000Z");
  assert.equal(zonedTimeToIso("2026-10-27", "09", "Asia/Tehran"), "2026-10-27T05:30:00.000Z");
});

test("منطقهٔ زمانی مرورگر نباید در نتیجه effect بگذارد", () => {
  // یک لحظهٔ مشخص، بدون وابستگی به TZ سیستم
  const iso = zonedTimeToIso("2026-10-27", "11:30", "Asia/Tehran");
  assert.equal(new Date(iso).getTime(), Date.UTC(2026, 9, 27, 8, 0));
});

test("لس‌آنجلس (ساعت تابستانی، ‎-۷) و لندن (زمستان/تابستان) درست هندل می‌شوند", () => {
  assert.equal(zonedTimeToIso("2026-10-27", "11:30", "America/Los_Angeles"), "2026-10-27T18:30:00.000Z");
  assert.equal(zonedTimeToIso("2026-12-21", "09:00", "Europe/London"), "2026-12-21T09:00:00.000Z");
  assert.equal(zonedTimeToIso("2026-06-21", "09:00", "Europe/London"), "2026-06-21T08:00:00.000Z");
});

test("UTC و منطقهٔ زمانی نامعتبر/نداشته: رفتار امن (مرورگر یا همان UTC)", () => {
  assert.equal(zonedTimeToIso("2026-10-27", "11:30", "UTC"), "2026-10-27T11:30:00.000Z");
  assert.equal(
    zonedTimeToIso("2026-10-27", "11:30", "Not/AZone"),
    new Date("2026-10-27T11:30:00").toISOString(),
    "با منطقهٔ زمانی نامعتبر مثل قبل از منطقهٔ زمانی مرورگر استفاده می‌شود"
  );
  assert.equal(
    zonedTimeToIso("2026-10-27", "11:30"),
    new Date("2026-10-27T11:30:00").toISOString()
  );
});

test("ارقام فارسی هم پذیرفته می‌شوند و ورودی بی‌معنی خطای فارسی می‌دهد (نه RangeError)", () => {
  assert.equal(zonedTimeToIso("2026-10-27", "۱۱:۳۰", "Asia/Tehran"), "2026-10-27T08:00:00.000Z");
  assert.throws(() => zonedTimeToIso("2026-10-27", "", "Asia/Tehran"), /تاریخ یا ساعت نامعتبر/);
  assert.throws(() => zonedTimeToIso("2026-10-27", "25:00", "Asia/Tehran"), /تاریخ یا ساعت نامعتبر/);
  assert.throws(() => zonedTimeToIso("نامعتبر", "11:30", "Asia/Tehran"), /تاریخ یا ساعت نامعتبر/);
});

test("todayInZone تاریخ همان منطقهٔ زمانی را می‌دهد نه UTC", () => {
  const iso = todayInZone("Asia/Tehran");
  assert.match(iso, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(
    iso,
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  );
});
