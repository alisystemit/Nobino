import test from "node:test";
import assert from "node:assert/strict";
import { mergeExtracted } from "../src/lib/ai/merge.ts";

test("مقادیر تازه جایگزین می‌شوند و بقیه فیلدها حفظ می‌مانند", () => {
  const base = { name: "سارا احمدی", phone: "09123456789", date: "2026-10-27" };
  const merged = mergeExtracted(base, { time: "10:30", service: "کوتاهی مو" });
  assert.deepEqual(merged, {
    name: "سارا احمدی",
    phone: "09123456789",
    date: "2026-10-27",
    time: "10:30",
    service: "کوتاهی مو",
  });
});

test("مقدار undefined، خالی یا فقط فاصله، یافتهٔ قبلی را پاک نمی‌کند", () => {
  const base = { name: "سارا", time: "11:00", phone: "09120000000" };
  const merged = mergeExtracted(base, { name: undefined, time: "   ", phone: "" });
  assert.equal(merged.name, "سارا");
  assert.equal(merged.time, "11:00");
  assert.equal(merged.phone, "09120000000");
});

test("پاسخ تکمیلی یک فیلد (حالت پرسش مجدد) بقیهٔ نوبت را از بین نمی‌برد", () => {
  const partial = { name: "مریم", date: "2026-10-28", time: "16:00" };
  const merged = mergeExtracted(partial, { phone: "09351112233" });
  assert.deepEqual(Object.keys(merged).sort(), ["date", "name", "phone", "time"]);
  assert.equal(merged.phone, "09351112233");
});
