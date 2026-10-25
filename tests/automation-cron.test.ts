import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { nextRun, parseCron } = require("../scripts/lib/cron.cjs");

const config = JSON.parse(
  readFileSync(new URL("../scripts/automation.config.json", import.meta.url), "utf8")
) as { jobs: Array<{ id: string; path: string; schedule: string }> };
const vercel = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url), "utf8")
) as { crons: Array<{ path: string; schedule: string }> };

test("کرون هر ۵ دقیقه زمان درست را برمی‌گرداند", () => {
  const next = nextRun("*/5 * * * *", new Date("2026-10-24T12:03:20Z"), "UTC");
  assert.equal(next.toISOString(), "2026-10-24T12:05:00.000Z");
});

test("کرون ساعتی در ابتدای ساعت بعد اجرا می‌شود", () => {
  const next = nextRun("0 * * * *", new Date("2026-10-24T10:20:30Z"), "UTC");
  assert.equal(next.toISOString(), "2026-10-24T11:00:00.000Z");
});

test("کرون لیست انتظار (دقیقه ۱۵ هر ساعت) درست محاسبه می‌شود", () => {
  const next = nextRun("15 * * * *", new Date("2026-10-24T10:20:00Z"), "UTC");
  assert.equal(next.toISOString(), "2026-10-24T11:15:00.000Z");
});

test("کرون روزانه پس از گذشتن ساعت اجرا به روز بعد می‌رود", () => {
  const next = nextRun("0 2 * * *", new Date("2026-10-24T03:00:00Z"), "UTC");
  assert.equal(next.toISOString(), "2026-10-25T02:00:00.000Z");
});

test("منطقه زمانی Asia/Tehran در محاسبه اعمال می‌شود", () => {
  const next = nextRun("0 2 * * *", new Date("2026-10-23T00:00:00Z"), "Asia/Tehran");
  // ۲ بامداد ۲۴ اکتبر تهران = ۲۲:۳۰ روز قبل به وقت UTC
  assert.equal(next.toISOString(), "2026-10-23T22:30:00.000Z");
});

test("روز ماه و روز هفته محدودشده طبق استاندارد OR هستند", () => {
  // ۱۳ هر ماه یا هر جمعه؛ اولین جمعه پس از ۱ اکتبر ۲۰۲۶، ۲ اکتبر است.
  const next = nextRun("0 0 13 * 5", new Date("2026-10-01T00:00:00Z"), "UTC");
  assert.equal(next.toISOString(), "2026-10-02T00:00:00.000Z");
});

test("عبارت کرون نامعتبر خطا می‌دهد", () => {
  assert.throws(() => parseCron("61 * * * *"), /دقیقه/);
  assert.throws(() => parseCron("* * *"), /۵ فیلد/);
  assert.throws(() => parseCron("*/0 * * * *"), /گام/);
});

test("همه کارهای تنظیمات محلی کرون معتبر و شناسه یکتا دارند", () => {
  const ids = new Set<string>();
  for (const job of config.jobs) {
    assert.doesNotThrow(() => parseCron(job.schedule), `زمان‌بندی ${job.id}`);
    assert.ok(job.path.startsWith("/"), `مسیر ${job.id}`);
    assert.ok(!ids.has(job.id), `شناسه تکراری ${job.id}`);
    ids.add(job.id);
  }
});

test("زمان‌بندی اتوماسیون محلی با vercel.json هم‌خوان است", () => {
  const local = new Map(config.jobs.map((job) => [job.path, job.schedule]));
  for (const cron of vercel.crons) {
    assert.equal(local.get(cron.path), cron.schedule, `ناهم‌خوانی برای ${cron.path}`);
  }
  assert.equal(local.size, vercel.crons.length);
});
