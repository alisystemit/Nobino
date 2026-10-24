import test from "node:test";
import assert from "node:assert/strict";
import { serviceDuration, servicesTotalDuration } from "../src/lib/bookings/service.ts";

test("serviceDuration برای خدمت معمولی همان durationMin است", () => {
  assert.equal(serviceDuration({ durationMin: 45, steps: null }), 45);
});

test("serviceDuration برای خدمت چندمرحله‌ای مجموع مراحل را برمی‌گرداند", () => {
  const svc = {
    durationMin: 60,
    steps: [
      { name: "شامپو", durationMin: 15 },
      { name: "برش", durationMin: 30 },
      { name: "حالت‌دهی", durationMin: 20 },
    ],
  };
  assert.equal(serviceDuration(svc), 65);
});

test("servicesTotalDuration مجموع منابع چند خدمت را حساب می‌کند", () => {
  const a = { durationMin: 30, steps: null };
  const b = { durationMin: 15, steps: null };
  assert.equal(servicesTotalDuration([a, b]), 45);
});
