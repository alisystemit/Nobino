import test from "node:test";
import assert from "node:assert/strict";
import { localMidnightUTC } from "../src/lib/timezone.ts";

test("localMidnightUTC maps Tehran midnight to expected UTC", () => {
  const utc = localMidnightUTC("2026-10-23", "Asia/Tehran");
  assert.equal(utc.toISOString(), "2026-10-22T20:30:00.000Z"); // 2026-10-23 00:00 +03:30
});

test("localMidnightUTC uses UTC for GMT", () => {
  const utc = localMidnightUTC("2026-10-23", "UTC");
  assert.equal(utc.toISOString(), "2026-10-23T00:00:00.000Z");
});
