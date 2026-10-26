import test from "node:test";
import assert from "node:assert/strict";
import { resolveCookieSecure } from "../src/lib/auth/cookie-secure.ts";

test("سویچ صریح مدیر سرور بر همه‌چیز اولویت دارد", () => {
  assert.equal(resolveCookieSecure({ flag: "false", proto: "https", nodeEnv: "production" }), false);
  assert.equal(resolveCookieSecure({ flag: "true", proto: "http", nodeEnv: "development" }), true);
  assert.equal(resolveCookieSecure({ flag: "0", proto: "https" }), false);
  assert.equal(resolveCookieSecure({ flag: "YES", proto: "http" }), true);
});

test("پروتکل درخواست پروکس را می‌گوید: HTTP کوکی بدون Secure می‌خواهد", () => {
  assert.equal(resolveCookieSecure({ proto: "http", nodeEnv: "production" }), false);
  assert.equal(resolveCookieSecure({ proto: "https", nodeEnv: "development" }), true);
  assert.equal(resolveCookieSecure({ proto: "ssl", nodeEnv: "production" }), true);
  // زنجیرهٔ پروکس: «https, http» — مقدار اول معتبر است
  assert.equal(resolveCookieSecure({ proto: "https, http", nodeEnv: "production" }), true);
  assert.equal(resolveCookieSecure({ proto: "HTTP", nodeEnv: "production" }), false);
});

test("بدون اطلاعات پروکس، رفتار پیش‌فرض حفظ می‌شود", () => {
  assert.equal(resolveCookieSecure({ nodeEnv: "production" }), true);
  assert.equal(resolveCookieSecure({ nodeEnv: "development" }), false);
  assert.equal(resolveCookieSecure({ proto: "", nodeEnv: "production" }), true);
});
