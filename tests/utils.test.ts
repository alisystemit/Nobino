import { test } from "node:test";
import assert from "node:assert/strict";
import { formatToman, toPersianDigits } from "../src/lib/utils.ts";

test("formatToman عدد را به تومان شمسی قالب‌بندی می‌کند", () => {
  const result = formatToman(250000);
  assert.ok(result.includes("تومان"), "باید عبارت «تومان» داشته باشد");
  assert.ok(result.includes("۲۵۰"), "باید رقم ۲۵۰ به فارسی باشد");
});

test("toPersianDigits ارقام لاتین را به فارسی تبدیل می‌کند", () => {
  assert.equal(toPersianDigits("0912-345-6789"), "۰۹۱۲-۳۴۵-۶۷۸۹");
  assert.equal(toPersianDigits(2024), "۲۰۲۴");
});

test("toPersianDigits با ورودی خالی کار می‌کند", () => {
  assert.equal(toPersianDigits(""), "");
});
