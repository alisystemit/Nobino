/* eslint-disable @typescript-eslint/no-require-imports -- اسکریپت خط فرمان CommonJS است */
// ایجاد دیتابیس «nobino» در صورت نبودن (برای اسکریپت راه‌اندازی محلی)
const { Client } = require("pg");

const port = Number(process.argv[2] || 5433);
const db = process.argv[3] || "nobino";

(async () => {
  const client = new Client({ host: "localhost", port, user: "postgres" });
  await client.connect();
  await client.query(`CREATE DATABASE ${db}`).catch(() => {});
  await client.end();
  console.log("  database ready");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
