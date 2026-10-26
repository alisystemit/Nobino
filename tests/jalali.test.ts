import test from "node:test";
import assert from "node:assert/strict";
import {
  formatJalali,
  formatJalaliWithWeekday,
  gregorianToJalali,
  isJalaliLeap,
  isoToJalali,
  jalaliMonthDays,
  jalaliToGregorian,
  jalaliToIso,
  toLatinDigits,
  toPersianDigits,
  weekdayIndexSaturdayFirst,
} from "../src/lib/time/jalali.ts";

/** مرجع مستقل: تقویم فارسی خود ICU */
const ICU = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  timeZone: "UTC",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

function icuJalali(iso: string): { jy: number; jm: number; jd: number } {
  const parts = ICU.formatToParts(new Date(`${iso}T00:00:00Z`));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { jy: get("year"), jm: get("month"), jd: get("day") };
}

test("تبدیل میلادی→شمسی با تقویم ICU روی بازهٔ ۵ ساله روز‌به‌روز یکی است", () => {
  let checked = 0;
  const start = Date.UTC(2022, 0, 1);
  for (let i = 0; i < 365 * 5 + 2; i += 1) {
    const d = new Date(start + i * 864e5);
    const iso = d.toISOString().slice(0, 10);
    const mine = gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    const ref = icuJalali(iso);
    assert.deepEqual(mine, ref, `اختلاف در ${iso}`);
    checked++;
  }
  assert.ok(checked > 1800);
});

test("رفت‌وبرگشت شمسی↔میلادی برای همهٔ روزهای ۱۴۰۰ تا ۱۴۰۷", () => {
  for (let jy = 1400; jy <= 1407; jy += 1) {
    for (let jm = 1; jm <= 12; jm += 1) {
      const len = jalaliMonthDays(jy, jm);
      for (let jd = 1; jd <= len; jd += 1) {
        const iso = jalaliToIso(jy, jm, jd);
        const back = isoToJalali(iso);
        assert.deepEqual(back, { jy, jm, jd }, `${jy}/${jm}/${jd} → ${iso}`);
      }
    }
  }
});

test("طول ماه‌ها و سال کبیسه با ICU هم‌خوان است", () => {
  for (let jy = 1395; jy <= 1410; jy += 1) {
    const leapByFormula = isJalaliLeap(jy);
    // اسفند ۳۰ روزه است اگر و فقط اگر سال کبیسه باشد؛ با ICU بررسی می‌شود
    const g = jalaliToGregorian(jy, 12, 30);
    const esfand30 = `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
    const back = icuJalali(esfand30);
    assert.equal(leapByFormula, back.jy === jy && back.jm === 12 && back.jd === 30, `سال ${jy}`);
    assert.equal(jalaliMonthDays(jy, 12), leapByFormula ? 30 : 29);
  }
});

test("شروع هفته از شنبه و نمایش فارسی با ارقام فارسی", () => {
  // ۱ مهر ۱۴۰۴ = ۲۰۲۵-۰۹-۲۳ (سه‌شنبه)
  assert.equal(weekdayIndexSaturdayFirst(2025, 9, 23), 3);
  assert.equal(formatJalali("2025-09-23"), "۱ مهر ۱۴۰۴");
  assert.equal(formatJalaliWithWeekday("2025-09-23"), "سه‌شنبه ۱ مهر ۱۴۰۴");
  assert.equal(toPersianDigits("1404-07-01"), "۱۴۰۴-۰۷-۰۱");
  assert.equal(toLatinDigits("۱۴۰۴/۰۷/۰۱"), "1404/07/01");
  assert.equal(formatJalali("نامعتبر"), "");
});

test("یک تاریخ مرجع شناخته‌شده", () => {
  assert.deepEqual(isoToJalali("2026-10-26"), { jy: 1405, jm: 8, jd: 4 });
  assert.equal(jalaliToIso(1405, 8, 4), "2026-10-26");
});
