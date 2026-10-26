import test from "node:test";
import assert from "node:assert/strict";
import {
  MODULES,
  defaultFeatures,
  moduleLabel,
  normalizeFeatures,
  resolveFeatures,
} from "../src/lib/plans/modules.ts";

test("هر ماژول کاتالوگ کلید یکتا و برچسب فارسی دارد", () => {
  const keys = MODULES.map((m) => m.key);
  assert.equal(new Set(keys).size, keys.length, "کلید تکراری وجود دارد");
  for (const m of MODULES) {
    assert.ok(m.label.trim().length > 1, `برچسب خالی: ${m.key}`);
    assert.ok(m.icon.trim().length > 0, `آیکون خالی: ${m.key}`);
    assert.ok(m.kind === "bool" || m.kind === "count");
  }
});

test("برچسب سقف‌ها از محدودیت زندهٔ پلن ساخته می‌شود، نه متن ذخیره‌شده", () => {
  assert.equal(moduleLabel({ key: "staff" }, { staff: 15 }), "تا ۱۵ کارکنان");
  assert.equal(moduleLabel({ key: "staff", value: 3 }, { staff: 60 }), "تا ۶۰ کارکنان");
  assert.equal(moduleLabel({ key: "staff", value: 3 }, undefined), "تا ۳ کارکنان");
  assert.equal(moduleLabel({ key: "staff", value: 1000 }), "کارکنان نامحدود");
  assert.equal(moduleLabel({ key: "branches", value: 5 }), "تا ۵ شعبه");
  assert.equal(moduleLabel({ key: "customDomain" }), "دامنه اختصاصی سالن");
});

test("سازگاری با داده قدیمی: رشته‌ها دست‌نخورده می‌مانند و ورودی نامعتبر حذف می‌شود", () => {
  assert.deepEqual(normalizeFeatures([" نوبت صوتی ", "", null, 42, { key: "staff", value: 15 }, { foo: 1 }]), [
    "نوبت صوتی",
    { key: "staff", value: 15 },
  ]);
  assert.deepEqual(normalizeFeatures(undefined), []);
  const out = resolveFeatures(["ویژگی A"], { staff: 15 });
  assert.deepEqual(out.map((f) => f.label), ["ویژگی A"]);
  assert.equal(out[0].key, null);
});

test("پکیج بدون ماژول، صفحه را خالی نمی‌گذارد: فهرست پیش‌فرض پلن می‌آید", () => {
  const limits = { staff: 60, branches: 20, customDomain: true, api: true, webapp: true, voiceBooking: true, csvExport: true, smsReminders: true };
  const resolved = resolveFeatures([], limits);
  assert.ok(resolved.length >= 10);
  assert.ok(resolved.some((f) => f.label === "تا ۶۰ کارکنان"));
  assert.ok(resolved.some((f) => f.label === "دامنه اختصاصی سالن"));
});

test("ماژول غیرفعال در پلن در فهرست نمایش داده نمی‌شود", () => {
  const limits = { staff: 5, branches: 2, customDomain: false, api: false, webapp: true, voiceBooking: true, csvExport: false, smsReminders: true };
  const resolved = resolveFeatures([{ key: "customDomain" }, { key: "csvExport" }, { key: "gallery" }], limits);
  assert.deepEqual(resolved.map((f) => f.key), ["gallery"]);
  // فهرست پیش‌فرض هم همان منطق را دارد
  assert.ok(!defaultFeatures(limits).some((f) => typeof f !== "string" && f.key === "api"));
  assert.ok(defaultFeatures(limits).some((f) => typeof f !== "string" && f.key === "smsReminders"));
});
