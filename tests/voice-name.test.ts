import test from "node:test";
import assert from "node:assert/strict";
import { extractNameFromText, trimPersianName } from "../src/lib/ai/text-fields.ts";

test("«به نام …» (رزرو توسط آرایشگر) نام کامل را می‌دهد و در «شماره» برش می‌خورد", () => {
  assert.equal(
    extractNameFromText("برای فردا ساعت 10:30 خدمت کوتاهی مو به نام سارا احمدی با شماره 09123456789"),
    "سارا احمدی"
  );
});

test("متن نمونهٔ راهنما (با ارقام و ویرگول فارسی) هم استخراج می‌شود", () => {
  assert.equal(
    extractNameFromText("سلام، می‌خوام نوبت رزرو کنم. برای فردا ساعت ده صبح، خدمت کوتاهی مو، به نام سارا احمدی، شماره موبایل ۰۹۱۲۳۴۵۶۷۸"),
    "سارا احمدی"
  );
});

test("حالت اول‌شخص هم کار می‌کند: «اسم من … است» و «منم …»", () => {
  assert.equal(extractNameFromText("اسم من مریم است"), "مریم");
  assert.equal(extractNameFromText("منم زهرا"), "زهرا");
});

test("«برای خانم …» نام خانوادگی را می‌گیرد", () => {
  assert.equal(extractNameFromText("یک نوبت برای خانم محمدی ساعت پنج"), "محمدی");
});

test("جملهٔ بدون نام، undefined برمی‌گرداند (نه رشتهٔ بی‌ربط)", () => {
  assert.equal(extractNameFromText("ساعت ۱۰ صبح شامپو و سشوار"), undefined);
});

test("برش نام: کلمات راهنما و نشانه‌ها حذف و حداکثر سه کلمه می‌ماند", () => {
  assert.equal(trimPersianName("الهام رضایی، شماره موبایل 0912"), "الهام رضایی");
  assert.equal(trimPersianName("من سارا احمدی"), "سارا احمدی");
  assert.equal(trimPersianName("الف ب پ ت ث"), "الف ب پ");
});
