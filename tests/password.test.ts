import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, passwordIssue } from "../src/lib/auth/passwordHash.ts";

test("هش رمز عبور قابل تأیید است", async () => {
  const hash = await hashPassword("Admin@1234");
  assert.ok(hash.startsWith("scrypt:"));
  assert.equal(await verifyPassword("Admin@1234", hash), true);
});

test("رمز اشتباه رد می‌شود", async () => {
  const hash = await hashPassword("Admin@1234");
  assert.equal(await verifyPassword("WrongPass1", hash), false);
});

test("هش با قالب نامعتبر بدون خطا رد می‌شود", async () => {
  assert.equal(await verifyPassword("x", "not-a-hash"), false);
  assert.equal(await verifyPassword("x", ""), false);
});

test("بررسی قدرت رمز عبور", () => {
  assert.equal(passwordIssue("abc"), "رمز عبور باید حداقل 8 کاراکتر باشد.");
  assert.equal(passwordIssue("abcdefgh"), "رمز عبور باید ترکیبی از حروف انگلیسی و عدد باشد.");
  assert.equal(passwordIssue("12345678"), "رمز عبور باید ترکیبی از حروف انگلیسی و عدد باشد.");
  assert.equal(passwordIssue("Abc12345"), null);
});
