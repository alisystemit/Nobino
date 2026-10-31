#!/usr/bin/env node
/**
 * استارت مخصوص PaaS (Render / Railway / Fly / Koyeb / Docker …)
 *
 * ترتیب کار:
 *  1) اگر دیتابیس در دسترس بود، اسکیمای Prisma با `db push --skip-generate`
 *     هم‌راستا می‌شود (این پروژه مهاجرت SQL ندارد؛ روی سرورهای Ubuntu هم همین
 *     روش استفاده می‌شود). اگر دیتابیس هنوز بالا نیامده باشد، چند بار با
 *     فاصلهٔ زمانی تلاش دوباره می‌کنیم و در نهایت بی‌صدا رد می‌شویم تا
 *     سایت حداقل بالا بیاید و خطای واضح‌تری در لاگ بماند.
 *  2) `next start` روی پورتی که پلتفرم در متغیر محیطی PORT می‌دهد اجرا می‌شود
 *     (پیش‌فرض 3000). سیگنال‌های توقف به فرزند منتقل می‌شوند تا restart
 *     تمیز باشد.
 *
 * با `SKIP` می‌توان مرحلهٔ ۱ را خاموش کرد: PAAS_SKIP_DB_PUSH=true
 * تعداد تلاش و فاصله: PAAS_DB_PUSH_ATTEMPTS / PAAS_DB_PUSH_DELAY_MS
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// اگر فایل .env کنار پروژه بود (حالت عادی روی VPS/لوکال)، همان مقادیر را قبل از
// اجرا می‌گذاریم؛ متغیرهای محیطی خودِ پلتفرم (PaaS) اولویت دارند و بازنویسی نمی‌شوند.
// روی PaaS معمولاً env از پنل پلتفرم می‌آید و این فایل وجود ندارد.
const envFile = path.join(ROOT, ".env");
if (existsSync(envFile)) {
  try {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      if (process.env[m[1]] !== undefined) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* فایل env خوانده نشد؛ همان env موجود کافی است */
  }
}

const PORT = Number(process.env.PORT) || 3000;
// بسیاری از پلتفرم‌ها (Docker رسمی Node) HOSTNAME را به نام کانکینر ست می‌کند؛
// نکست نباید به آن بایند شود، پس صراحتاً روی همهٔ اینترفیس‌ها گوش می‌دهیم.
const HOST = "0.0.0.0";
const ATTEMPTS = Number(process.env.PAAS_DB_PUSH_ATTEMPTS) || 6;
const DELAY_MS = Number(process.env.PAAS_DB_PUSH_DELAY_MS) || 5000;
const SKIP_DB_PUSH = process.env.PAAS_SKIP_DB_PUSH === "true";

const log = (msg) => console.log(`[paas-start] ${msg}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** اجرای یک فرمان و برگرداندن { code, output } */
function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT });
    let output = "";
    child.stdout.on("data", (d) => (output += d.toString()));
    child.stderr.on("data", (d) => (output += d.toString()));
    child.on("close", (code) => resolve({ code, output }));
    child.on("error", (err) => resolve({ code: 1, output: String(err) }));
  });
}

async function alignSchema() {
  if (SKIP_DB_PUSH) {
    log("PAAS_SKIP_DB_PUSH=true — هم‌رسانی اسکیمای دیتابیس انجام نمی‌شود.");
    return;
  }
  const schemaPath = path.join(ROOT, "prisma", "schema.prisma");
  if (!existsSync(schemaPath)) {
    log("فایل prisma/schema.prisma پیدا نشد؛ مرحلهٔ db push نادیده گرفته شد.");
    return;
  }
  if (!process.env.DATABASE_URL) {
    log("هشدار: DATABASE_URL تنظیم نیست — db push رد می‌شود (سایت با همان وضعیت env بالا می‌آید).");
    return;
  }

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    log(`هم‌رسانی اسکیمای دیتابیس (تلاش ${attempt}/${ATTEMPTS}) …`);
    const { code, output } = await run(
      process.execPath,
      [path.join("node_modules", "prisma", "build", "index.js"), "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"],
    );
    if (code === 0) {
      log("اسکیمای دیتابیس هم‌راستا شد ✔");
      return;
    }
    if (attempt < ATTEMPTS) {
      const brief = output.split("\n").filter(Boolean).slice(-2).join(" | ");
      log(`دیتابیس هنوز آماده نیست (${brief || `exit ${code}`}) — ${DELAY_MS / 1000} ثانیه دیگر تلاش می‌کنم.`);
      await sleep(DELAY_MS);
    } else {
      log("هشدار: db push موفق نشد؛ سرور باز هم اجرا می‌شود. متن خطا:");
      console.error(output);
    }
  }
}

async function main() {
  await alignSchema();

  log(`راه‌اندازی next start روی ${HOST}:${PORT} …`);
  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const server = spawn(process.execPath, [nextBin, "start", "-H", HOST, "-p", String(PORT)], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });

  const forward = (signal) => {
    log(`دریافت ${signal} — متوقف کردن سرور…`);
    server.kill(signal);
  };
  process.on("SIGTERM", () => forward("SIGTERM"));
  process.on("SIGINT", () => forward("SIGINT"));

  server.on("close", (code) => {
    log(`سرور با کد ${code} خارج شد.`);
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error("[paas-start] خطای غیرمنتظره:", err);
  process.exit(1);
});
