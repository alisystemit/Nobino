import test from "node:test";
import assert from "node:assert/strict";
import {
  BOOL_DEFS,
  COUNT_DEFS,
  LIMIT_DEFS,
  UNLIMITED_FROM,
  findLimitDef,
  formatLimit,
  limitSettingKey,
} from "../src/lib/plans/limit-defs.ts";
import {
  INPUT_LIMIT_DEFS,
  PLAN_DEFAULTS,
  PLAN_LABELS,
  PLAN_ORDER,
  bestPlan,
  entryCeiling,
  limitCatalogIssues,
  normalizePlan,
} from "../src/lib/plans/limits-data.ts";

test("کاتالوگ محدودیت‌ها: کلید یکتا، برچسب فارسی و راهنمای پرکاربرد", () => {
  const keys = LIMIT_DEFS.map((d) => d.key as string);
  assert.equal(new Set(keys).size, keys.length, "کلید تکراری در کاتالوگ وجود دارد");
  for (const def of LIMIT_DEFS) {
    assert.ok(def.label.trim().length > 1, `برچسب خالی: ${def.key}`);
    assert.ok(def.hint.trim().length > 5, `راهنمای ناقص: ${def.key}`);
    assert.ok(def.icon.trim().length > 0, `آیکون خالی: ${def.key}`);
    assert.ok(def.kind === "count" || def.kind === "bool");
    assert.ok(def.scope === "salon" || def.scope === "owner");
    assert.ok(def.max > 0);
    if (def.kind === "count") assert.ok(def.unit.trim().length > 0, `واحد شمارشی خالی: ${def.key}`);
  }
  // تقسیم‌بندی‌ها باید کل کاتالوگ را بپوشانند
  assert.equal(COUNT_DEFS.length + BOOL_DEFS.length, LIMIT_DEFS.length);
  assert.equal(findLimitDef("staff")?.label, "تعداد کارکنان");
  assert.equal(findLimitDef("nope"), undefined);
});

test("هر کلید کاتالوگ در هر چهار پلن پیش‌فرض مقدار دارد و برعکس", () => {
  assert.deepEqual(limitCatalogIssues(), []);
  for (const plan of PLAN_ORDER) {
    for (const def of LIMIT_DEFS) {
      const value = (PLAN_DEFAULTS[plan] as unknown as Record<string, unknown>)[def.key as string];
      assert.notEqual(value, undefined, `${plan}.${def.key} تعریف نشده است`);
      if (def.kind === "count") {
        assert.equal(typeof value, "number");
        assert.ok(Number.isInteger(value) && (value as number) >= 0, `${plan}.${def.key} باید عدد صحیح باشد`);
      } else {
        assert.equal(typeof value, "boolean");
      }
    }
  }
});

test("پلن‌های بالاتر سقفِ کمتری از پلن پایین‌تر ندارند", () => {
  for (const def of COUNT_DEFS) {
    for (let i = 1; i < PLAN_ORDER.length; i++) {
      const prev = PLAN_DEFAULTS[PLAN_ORDER[i - 1]][def.key] as number;
      const next = PLAN_DEFAULTS[PLAN_ORDER[i]][def.key] as number;
      assert.ok(next >= prev, `${def.key}: پلن ${PLAN_ORDER[i]} (${next}) از ${PLAN_ORDER[i - 1]} (${prev}) کمتر است`);
    }
  }
  for (const def of BOOL_DEFS) {
    for (let i = 1; i < PLAN_ORDER.length; i++) {
      const prev = PLAN_DEFAULTS[PLAN_ORDER[i - 1]][def.key] as boolean;
      const next = PLAN_DEFAULTS[PLAN_ORDER[i]][def.key] as boolean;
      if (prev) assert.equal(next, true, `${def.key}: در ${PLAN_ORDER[i]} خاموش شده`);
    }
  }
});

test("پیامک ارسالی و کمپین ماهانه شمرده می‌شوند؛ تعداد سالن سطح کاربر است", () => {
  assert.equal(findLimitDef("smsPerMonth")?.monthly, true);
  assert.equal(findLimitDef("campaigns")?.monthly, true);
  assert.equal(findLimitDef("staff")?.monthly, undefined);
  assert.equal(findLimitDef("salons")?.scope, "owner");
  assert.equal(findLimitDef("staff")?.scope, "salon");
});

test("سقف‌های پلن رایگان با محدودیت‌های تبلیغ‌شده هم‌خوان است", () => {
  const free = PLAN_DEFAULTS.FREE;
  assert.equal(free.staff, 5);
  assert.equal(free.branches, 2);
  assert.equal(free.services, 20);
  assert.equal(free.customDomain, false);
  assert.equal(free.api, false);
  assert.equal(PLAN_DEFAULTS.PRO.customDomain, true);
  assert.equal(PLAN_LABELS.PRO, "حرفه‌ای");
});

test("formatLimit: فعال/غیرفعال، سقف فارسی، سقف ماهانه و نامحدود", () => {
  const staff = findLimitDef("staff")!;
  const sms = findLimitDef("smsPerMonth")!;
  const api = findLimitDef("api")!;
  assert.equal(formatLimit(api, true), "فعال");
  assert.equal(formatLimit(api, false), "غیرفعال");
  assert.equal(formatLimit(staff, 15), "تا ۱۵ کارمند");
  assert.equal(formatLimit(sms, 300), "۳۰۰ پیامک در ماه");
  assert.equal(formatLimit(staff, UNLIMITED_FROM), "کارمند نامحدود");
  // آستانهٔ نامحدود باید بالاتر از همهٔ سقف‌های واقعی پلن‌ها باشد
  assert.ok(
    UNLIMITED_FROM > Math.max(PLAN_DEFAULTS.PRO.smsPerMonth, PLAN_DEFAULTS.PRO.customers),
    "سقف واقعی پلن PRO بالاتر از آستانهٔ نامحدود است"
  );
});

test("کلید تنظیمات دست‌ی سوپرادمین فرم پایداری `plan.limit.<PLAN>.<key>` دارد", () => {
  assert.equal(limitSettingKey("PRO", "smsPerMonth"), "plan.limit.PRO.smsPerMonth");
  assert.equal(limitSettingKey("FREE", "api"), "plan.limit.FREE.api");
});

test("normalizePlan و bestPlan ورودی نامعتبر را به رایگان می‌برند", () => {
  assert.equal(normalizePlan("pro"), "PRO");
  assert.equal(normalizePlan(" ENTERPRISE "), "ENTERPRISE");
  assert.equal(normalizePlan("GOLD"), "FREE");
  assert.equal(normalizePlan(null), "FREE");
  assert.equal(bestPlan(["FREE", "BASIC", "PRO"]), "PRO");
  assert.equal(bestPlan(["FREE", "wat"]), "FREE");
  assert.equal(bestPlan([]), "FREE");
  assert.equal(bestPlan(["PRO", "ENTERPRISE", "BASIC"]), "ENTERPRISE");
});

test("مجموعهٔ کلیدهای کاتالوگ و ماتریس پیش‌فرض دقیقاً یکی است", () => {
  const catalog = LIMIT_DEFS.map((d) => d.key as string).sort();
  const defaults = Object.keys(PLAN_DEFAULTS.FREE).sort();
  assert.deepEqual(defaults, catalog);
  for (const plan of PLAN_ORDER) assert.deepEqual(Object.keys(PLAN_DEFAULTS[plan]).sort(), catalog);
  assert.deepEqual(limitCatalogIssues(), []);
});

test("سقف ورودی فرم، «نامحدود» و بزرگ‌ترین پیش‌فرض پلن را همیشه اجازه می‌دهد", () => {
  assert.equal(INPUT_LIMIT_DEFS.length, LIMIT_DEFS.length);
  for (const def of INPUT_LIMIT_DEFS) {
    if (def.kind !== "count") {
      assert.equal(def.max, 1, `سقف ورودی امکان بولی «${def.key}» نباید عوض شود`);
      continue;
    }
    assert.ok(def.max >= UNLIMITED_FROM, `«${def.key}» نمی‌تواند نامحدود شود (max=${def.max})`);
    for (const plan of PLAN_ORDER) {
      const v = PLAN_DEFAULTS[plan][def.key];
      if (typeof v === "number") assert.ok(def.max >= v, `پیش‌فرض ${plan}.${def.key} از سقف ورودی فرم بیشتر است`);
    }
    // مقدار فرم باید دقیقاً همان چیزی باشد که از کاتالوگ خام محاسبه می‌شود
    assert.equal(def.max, entryCeiling(findLimitDef(def.key as string)!));
  }
});
