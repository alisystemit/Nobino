import test from "node:test";
import assert from "node:assert/strict";
import { extractPhone, extractTime } from "../src/lib/ai/voice-text.ts";

test("شمارهٔ موبایل با ارقام فارسی، لاتین، فاصله و +98", () => {
  assert.equal(extractPhone("شماره موبایل ۰۹۱۲۳۴۵۶۷۸۹"), "09123456789");
  assert.equal(extractPhone("شماره 0912 345 6789"), "09123456789");
  assert.equal(extractPhone("شماره +989123456789"), "09123456789");
});

test("شماره‌ای که کلمه‌به‌کلمه گفته شده هم خوانده می‌شود", () => {
  assert.equal(
    extractPhone("شماره من صفر نه یک دو سه چهار پنج شش هفت هشت نه است"),
    "09123456789"
  );
});

test("«نه» در جملهٔ معمولی به‌اشتباه شماره نمی‌سازد", () => {
  assert.equal(extractPhone("نه، نمی‌خوام"), undefined);
});

test("ساعت با کلمه، ارقام، صبح/عصر و دقیقه", () => {
  assert.equal(extractTime("برای فردا ساعت ده صبح"), "10:00");
  assert.equal(extractTime("ساعت ۱۰ صبح"), "10:00");
  assert.equal(extractTime("فردا ساعت پنج عصر"), "17:00");
  assert.equal(extractTime("ساعت 10:30"), "10:30");
  assert.equal(extractTime("ساعت ده و نیم"), "10:30");
});

test("ارقام شمارهٔ موبایل به‌اشتباه ساعت فهمیده نمی‌شود", () => {
  assert.equal(extractTime("شماره موبایل ۰۹۱۲۳۴۵۶۷۸۹"), undefined);
});
