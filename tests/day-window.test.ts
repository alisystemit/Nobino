import test from "node:test";
import assert from "node:assert/strict";
import { dayDiff, dayLabel, dayWindow, parseDayParam, shiftDay } from "../src/lib/time/day-window.ts";

test("پارام تاریخ نامعتبر یا نبود آن به روز مرجع برمی‌گردد", () => {
  assert.equal(parseDayParam("2026-10-26", "2026-01-01"), "2026-10-26");
  assert.equal(parseDayParam(null, "2026-10-26"), "2026-10-26");
  assert.equal(parseDayParam("", "2026-10-26"), "2026-10-26");
  assert.equal(parseDayParam("26-10-2026", "2026-10-26"), "2026-10-26");
  assert.equal(parseDayParam("2026-13-45", "2026-10-26"), "2026-13-45", "فرمت درست است؛ منطق تقویم جدا بررسی می‌شود");
});

test("جابه‌جایی روز از مرز ماه و سال درست رد می‌شود", () => {
  assert.equal(shiftDay("2026-10-31", 1), "2026-11-01");
  assert.equal(shiftDay("2026-11-01", -1), "2026-10-31");
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftDay("2028-02-28", 1), "2028-02-29", "سال کبیسه");
  assert.equal(shiftDay("2026-10-26", 0), "2026-10-26");
});

test("پنجرهٔ روز تهران: نیمه‌شب وال‌کلوک سالن = ۲۰:۳۰ UTC روز قبل", () => {
  const { start, end } = dayWindow("2026-10-26", "Asia/Tehran");
  assert.equal(start.toISOString(), "2026-10-25T20:30:00.000Z");
  assert.equal(end.toISOString(), "2026-10-26T20:30:00.000Z");
});

test("نوبت ۲۳:۵۰ وال‌کلوک تهران داخل همان روز می‌ماند (نه روز بعد به وقت UTC)", () => {
  const lateNight = new Date("2026-10-26T20:20:00.000Z"); // ۲۳:۵۰ تهران
  const { start, end } = dayWindow("2026-10-26", "Asia/Tehran");
  assert.ok(lateNight >= start && lateNight < end);
  // همان لحظه در پنجرهٔ روز بعد (به وقت تهران) نباید باشد
  const next = dayWindow("2026-10-27", "Asia/Tehran");
  assert.ok(lateNight < next.start);
});

test("منطقهٔ زمانی غربی: نیمه‌شب وال‌کلوک لس‌آنجلس = ۰۷:۰۰ UTC (آفست −۷)", () => {
  const { start, end } = dayWindow("2026-10-26", "America/Los_Angeles");
  assert.equal(start.toISOString(), "2026-10-26T07:00:00.000Z");
  assert.equal(end.toISOString(), "2026-10-27T07:00:00.000Z");
});

test("مبنای آفست، وال‌کلوک ظهر همان روز است (تقریب شناخته‌شدهٔ localMidnightUTC)", () => {
  // ۲ آبان: بعد از پایان ساعت تابستانی آمریکا → آفست −۸ و نیمه‌شب ۰۸:۰۰ UTC
  assert.equal(dayWindow("2026-11-02", "America/Los_Angeles").start.toISOString(), "2026-11-02T08:00:00.000Z");
  // تهران هیچ‌وقت ساعت تابستانی ندارد؛ آفست همهٔ روزها ۳:۳۰+ است
  assert.equal(dayWindow("2026-01-01", "Asia/Tehran").start.toISOString(), "2025-12-31T20:30:00.000Z");
  assert.equal(dayWindow("2026-07-01", "Asia/Tehran").start.toISOString(), "2026-06-30T20:30:00.000Z");
});

test("تعداد روز نسبت به امروز: دیروز −۱، فردا +۱", () => {
  assert.equal(dayDiff("2026-10-26", "2026-10-26"), 0);
  assert.equal(dayDiff("2026-10-27", "2026-10-26"), 1);
  assert.equal(dayDiff("2026-10-25", "2026-10-26"), -1);
  assert.equal(dayDiff("2026-11-01", "2026-10-26"), 6);
});

test("برچسب روز: امروز/فردا/دیروز و در بقیهٔ حالت‌ها تاریخ کامل", () => {
  const full = (d: string) => `تاریخ:${d}`;
  assert.equal(dayLabel("2026-10-26", "2026-10-26", full), "امروز");
  assert.equal(dayLabel("2026-10-27", "2026-10-26", full), "فردا");
  assert.equal(dayLabel("2026-10-25", "2026-10-26", full), "دیروز");
  assert.equal(dayLabel("2026-11-05", "2026-10-26", full), "تاریخ:2026-11-05");
});
