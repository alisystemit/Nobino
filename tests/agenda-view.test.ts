import test from "node:test";
import assert from "node:assert/strict";
import {
  durationMin,
  faDuration,
  isLive,
  money,
  nextAppointment,
  splitDay,
  summarize,
  timeIn,
  untilLabel,
  type AgendaItem,
} from "../src/lib/appointments/agenda-view.ts";

/** سازندهٔ نوبت با پیش‌فرض‌های قابل‌خواندن؛ زمان‌ها UTC و تهران = +۳:۳۰ */
function item(patch: Partial<AgendaItem> = {}): AgendaItem {
  return {
    id: "a1",
    customerName: "مریم رضایی",
    customerPhone: "09120000000",
    startAt: "2026-10-26T10:00:00.000Z", // ۱۳:۳۰ تهران
    endAt: "2026-10-26T11:00:00.000Z", // ۱۴:۳۰ تهران
    status: "CONFIRMED",
    channel: "MANUAL",
    service: "کوتاه کردن مو",
    serviceId: "s1",
    servicePrice: 300000,
    employee: "سارا",
    employeeId: "e1",
    branchId: null,
    note: null,
    depositAmount: null,
    depositPaid: false,
    salonId: "salon1",
    salonName: "سالن نمونه",
    salonSlug: "sample",
    salonTimezone: "Asia/Tehran",
    ...patch,
  };
}

const NOON = Date.parse("2026-10-26T10:30:00.000Z"); // ۱۴:۰۰ تهران

test("ساعت نوبت به وقت سالن و با ارقام فارسی نمایش داده می‌شود", () => {
  assert.equal(timeIn("2026-10-26T10:00:00.000Z", "Asia/Tehran"), "۱۳:۳۰");
  // منطقهٔ زمانی نامعتبر نباید استثنا بدهد
  assert.match(timeIn("2026-10-26T10:00:00.000Z", "Not/AZone"), /\d{2}:\d{2}/);
});

test("مدت نوبت به دقیقه و به فارسی", () => {
  assert.equal(durationMin(item()), 60);
  assert.equal(durationMin(item({ endAt: "2026-10-26T10:45:00.000Z" })), 45);
  assert.equal(durationMin(item({ endAt: "2026-10-26T09:00:00.000Z" })), 0, "پایان قبل از شروع → بدون مدت");
  assert.equal(faDuration(45), "۴۵ دقیقه");
  assert.equal(faDuration(120), "۲ ساعت");
  assert.equal(faDuration(90), "۱ ساعت و ۳۰ دقیقه");
  assert.equal(faDuration(0), "");
});

test("نوبت جاری فقط وقتی «در حال انجام» است که بین شروع و پایان باشیم", () => {
  assert.equal(isLive(item(), NOON), true);
  assert.equal(isLive(item(), Date.parse("2026-10-26T11:00:00.000Z")), false, "دقیقاً لحظهٔ پایان");
  assert.equal(isLive(item({ status: "CANCELLED" }), NOON), false, "نوبت لغوشده جاری نیست");
});

test("فاصلهٔ زمانی: «… دیگر» برای آینده و «… پیش» برای گذشته", () => {
  assert.equal(untilLabel("2026-10-26T11:00:00.000Z", NOON), "۳۰ دقیقه دیگر");
  assert.equal(untilLabel("2026-10-26T10:00:00.000Z", NOON), "۳۰ دقیقه پیش");
  assert.equal(untilLabel("2026-10-26T10:30:00.000Z", NOON), "هم‌اکنون");
  assert.equal(untilLabel("2026-10-26T13:00:00.000Z", NOON), "۲ ساعت و ۳۰ دقیقه دیگر");
});

test("تقسیم روز: جاری، باقی‌مانده و گذشته", () => {
  const morning = item({ id: "m", startAt: "2026-10-26T06:00:00.000Z", endAt: "2026-10-26T07:00:00.000Z" });
  const now = item({ id: "l" });
  const later = item({ id: "n", startAt: "2026-10-26T14:00:00.000Z", endAt: "2026-10-26T15:00:00.000Z" });
  const split = splitDay([morning, now, later], NOON);
  assert.deepEqual(split.live.map((i) => i.id), ["l"]);
  assert.deepEqual(split.upcoming.map((i) => i.id), ["n"]);
  assert.deepEqual(split.past.map((i) => i.id), ["m"]);
});

test("نوبت بعدی فقط نوبت‌های فعالِ تمام‌نشده را می‌گیرد", () => {
  const done = item({ id: "d", status: "COMPLETED", startAt: "2026-10-26T14:00:00.000Z", endAt: "2026-10-26T15:00:00.000Z" });
  const waiting = item({ id: "w", status: "REQUESTED", startAt: "2026-10-26T15:00:00.000Z", endAt: "2026-10-26T16:00:00.000Z" });
  const soon = item({ id: "s", startAt: "2026-10-26T12:00:00.000Z", endAt: "2026-10-26T13:00:00.000Z" });
  assert.equal(nextAppointment([done, waiting, soon], NOON)?.id, "s");
  assert.equal(nextAppointment([done], NOON), null);
});

test("خلاصهٔ روز: شمارش وضعیت‌ها، درآمد و درصد پیشرفت", () => {
  const rows = [
    item({ id: "1", status: "COMPLETED" }),
    item({ id: "2", status: "CONFIRMED", servicePrice: 500000 }),
    item({ id: "3", status: "REQUESTED", servicePrice: 200000 }),
    item({ id: "4", status: "CANCELLED" }),
    item({ id: "5", status: "NO_SHOW" }),
    item({ id: "6", status: "CONFIRMED", depositAmount: 100000, depositPaid: true }),
    item({ id: "7", status: "CONFIRMED", depositAmount: 150000, depositPaid: false }),
  ];
  const s = summarize(rows);
  assert.equal(s.total, 7);
  assert.equal(s.completed, 1);
  assert.equal(s.confirmed, 3);
  assert.equal(s.requested, 1);
  assert.equal(s.cancelled, 1);
  assert.equal(s.noShow, 1);
  assert.equal(s.revenue, 300000);
  assert.equal(s.expected, 500000 + 200000 + 300000 + 300000, "فقط نوبت‌های فعال در درآمد انتظاری");
  assert.equal(s.depositPaid, 100000);
  assert.equal(s.depositDue, 150000);
  assert.equal(s.progress, Math.round((3 / 7) * 100));
  assert.equal(summarize([]).progress, 0, "روز خالی تقسیم بر صفر نمی‌شود");
});

test("ارقام تومان و شمارش‌ها فارسی و با جداکنندهٔ هزارگان", () => {
  assert.equal(money(1250000), "۱٬۲۵۰٬۰۰۰ تومان");
});
