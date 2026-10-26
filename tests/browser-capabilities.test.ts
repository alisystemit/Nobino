import test from "node:test";
import assert from "node:assert/strict";
import {
  HTTPS_HINT,
  clipboardAvailable,
  micBlockReason,
  micUnavailable,
  readMicCapability,
} from "../src/lib/browser/capabilities.ts";

/** همان وضعیتی که روی سرور زنده دیدیم: http با پورت ⇒ `navigator.mediaDevices` تعریف نشده است */
const INSECURE_HTTP = { isSecureContext: false, mediaDevices: null, MediaRecorder: undefined };
const SECURE_READY = { isSecureContext: true, mediaDevices: { getUserMedia: () => {} }, MediaRecorder: function Recorder() {} };

test("میکروفون روی بستر ناامن قفل است و دلیل فارسیِ https می‌دهد", () => {
  const cap = readMicCapability(INSECURE_HTTP);
  assert.equal(cap.secureContext, false);
  assert.equal(cap.hasMediaDevices, false);
  assert.equal(micUnavailable(cap), true);
  const reason = micBlockReason(cap);
  assert.ok(reason);
  assert.match(reason!, /https/);
});

test("بستر امن با mediaDevices و MediaRecorder ⇒ هیچ محدودیتی گزارش نمی‌شود", () => {
  const cap = readMicCapability(SECURE_READY);
  assert.equal(cap.secureContext, true);
  assert.equal(cap.hasMediaDevices, true);
  assert.equal(cap.hasMediaRecorder, true);
  assert.equal(micBlockReason(cap), null);
  assert.equal(micUnavailable(cap), false);
});

test("مرورگر امن ولی بدون MediaRecorder ⇒ پیشنهاد آپلود فایل صوتی", () => {
  const cap = readMicCapability({ ...SECURE_READY, MediaRecorder: undefined });
  assert.equal(cap.hasMediaRecorder, false);
  assert.match(micBlockReason(cap)!, /فایل صوتی/);
});

test("مرورگر امن با mediaDevices تعریف‌نشده ⇒ پیشنهاد مرورگر دیگر", () => {
  const cap = readMicCapability({ isSecureContext: true, mediaDevices: null, MediaRecorder: function Recorder() {} });
  assert.match(micBlockReason(cap)!, /mediaDevices/);
});

test("mediaDevices بدون getUserMedia تابعی ⇒ همچنان غیرقابل‌استفاده", () => {
  const cap = readMicCapability({ isSecureContext: true, mediaDevices: { getUserMedia: "not-a-function" }, MediaRecorder: function Recorder() {} });
  assert.equal(cap.hasMediaDevices, false);
});

test("کلیپ‌بورد روی http در دسترس نیست و راهنمای https همراه پیام است", () => {
  assert.equal(clipboardAvailable(undefined), false);
  assert.equal(clipboardAvailable(null), false);
  assert.equal(clipboardAvailable({}), false);
  assert.equal(clipboardAvailable({ writeText: () => Promise.resolve() }), true);
  assert.match(HTTPS_HINT, /https/);
});
