#!/usr/bin/env node
"use strict";

/* eslint-disable @typescript-eslint/no-require-imports -- اسکریپت خط فرمان CommonJS است */

/**
 * اتوماسیون محلی Nobino
 * ------------------------------------------------------------------
 * در بازه‌های تعیین‌شده (کرون) endpointهای /api/cron را روی سرور محلی
 * صدا می‌زند؛ همان کارهایی که در production توسط Vercel Cron اجرا می‌شوند.
 *
 * استفاده:
 *   npm run automate                 اجرای پیوسته طبق automation.config.json
 *   npm run automate -- --once       اجرای فوری همه کارهای فعال و خروج
 *   npm run automate -- --list       نمایش زمان‌بندی و اجرای بعدی
 *   npm run automate -- --job holds --once
 *   npm run automate -- --dry-run    نمایش فراخوانی‌ها بدون درخواست HTTP
 */

const fs = require("node:fs");
const path = require("node:path");
const { nextRun, parseCron } = require("./lib/cron.cjs");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_CONFIG = path.join(__dirname, "automation.config.json");
const LOCK_PATH = path.join(ROOT, "logs", "automation.pid");
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const MAX_TIMEOUT_MS = 2_147_483_647;

let configFile = DEFAULT_CONFIG;
let logPath = null;
let logBytes = 0;
let lockFile = null;
let timer = null;
let running = false;
let stopping = false;
let baseUrl = "";
let timeZone = "local";
let secret = "";
let timeoutMs = 60_000;
const dateFormatters = new Map();

// ---------------------------------------------------------------------------
// ابزارهای پایه
// ---------------------------------------------------------------------------

/** خواندن ساده .env بدون وابستگی؛ مقادیر موجود در محیط را بازنویسی نمی‌کند. */
function loadEnv(file) {
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    if (process.env[key] !== undefined) continue;

    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function fatal(message) {
  console.error(`[خطا] ${message}`);
  process.exit(1);
}

function two(value) {
  return String(value).padStart(2, "0");
}

function timestamp(date = new Date()) {
  if (!timeZone || timeZone === "local") {
    return (
      `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ` +
      `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`
    );
  }

  let formatter = dateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dateFormatters.set(timeZone, formatter);
  }

  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function timeZoneLabel() {
  if (!timeZone || timeZone === "local") {
    try {
      return `محلی (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
    } catch {
      return "محلی";
    }
  }
  return timeZone;
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return Boolean(error && error.code === "EPERM");
  }
}

// ---------------------------------------------------------------------------
// لاگ (کنسول + فایل با چرخش ساده)
// ---------------------------------------------------------------------------

function initLog(file) {
  if (!file) return;

  logPath = path.isAbsolute(file) ? file : path.join(ROOT, file);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });

  if (fs.existsSync(logPath)) {
    logBytes = fs.statSync(logPath).size;
    if (logBytes > MAX_LOG_BYTES) rotateLog();
  }
}

function rotateLog() {
  if (!logPath) return;
  try {
    fs.rmSync(`${logPath}.1`, { force: true });
    fs.renameSync(logPath, `${logPath}.1`);
    logBytes = 0;
  } catch (error) {
    console.error(`[هشدار] چرخش فایل لاگ ناموفق بود: ${error.message}`);
  }
}

function log(level, message) {
  const line = `[${timestamp()}] ${level.padEnd(5)} ${message}`;
  console.log(line);

  if (!logPath) return;

  try {
    if (logBytes > MAX_LOG_BYTES) rotateLog();
    const entry = `${line}\n`;
    fs.appendFileSync(logPath, entry, "utf8");
    logBytes += Buffer.byteLength(entry);
  } catch (error) {
    console.error(`[هشدار] نوشتن در فایل لاگ ناموفق بود: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// تنظیمات و آرگومان‌ها
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
اتوماسیون محلی Nobino — اجرای زمان‌بندی‌شده کارهای /api/cron

استفاده:
  npm run automate                    اجرای پیوسته طبق scripts/automation.config.json
  npm run automate -- --once          اجرای فوری همه کارهای فعال و خروج
  npm run automate -- --list          نمایش زمان‌بندی و اجرای بعدی هر کار
  npm run automate -- --job holds --once
  npm run automate -- --job notifications,holds
  npm run automate -- --dry-run       فقط نمایش درخواست‌ها، بدون فراخوانی HTTP
  npm run automate -- --config <path> استفاده از فایل تنظیمات دیگر

نکته‌ها:
  • CRON_SECRET از .env خوانده می‌شود و به‌صورت Bearer ارسال می‌شود.
  • baseUrl، منطقه زمانی و زمان‌بندی‌ها در scripts/automation.config.json هستند.
  • منطقه زمانی پیش‌فرض Asia/Tehran است؛ "local" یعنی ساعت سیستم و "UTC" هم‌خوان با Vercel.
  • --once همه کارهای فعال را همان لحظه اجرا می‌کند (شامل تمدید اشتراک)؛ برای آزمایش از --dry-run استفاده کنید.
  • لاگ در logs/automation.log ذخیره می‌شود (پس از ۵ مگابایت به .1 منتقل می‌شود).
  • فقط یک نمونه از حالت پیوسته می‌تواند هم‌زمان اجرا شود (logs/automation.pid).
`);
}

function parseArgs(argv) {
  const options = {
    once: false,
    dryRun: false,
    list: false,
    help: false,
    jobs: null,
    config: null,
  };

  for (let i = 2; i < argv.length; i++) {
    let arg = argv[i];
    let inlineValue = null;

    if (arg.startsWith("--") && arg.includes("=")) {
      const separator = arg.indexOf("=");
      inlineValue = arg.slice(separator + 1);
      arg = arg.slice(0, separator);
    }

    switch (arg) {
      case "--once":
        options.once = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--list":
        options.list = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--job": {
        const raw = inlineValue ?? argv[++i];
        if (!raw) {
          fatal("گزینه --job به شناسه کار نیاز دارد (مثلاً notifications یا notifications,holds).");
        }
        options.jobs = raw
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        if (options.jobs.length === 0) fatal("گزینه --job حداقل یک شناسه معتبر نیاز دارد.");
        break;
      }
      case "--config": {
        const raw = inlineValue ?? argv[++i];
        if (!raw) fatal("گزینه --config به مسیر فایل تنظیمات نیاز دارد.");
        options.config = raw;
        break;
      }
      default:
        fatal(`گزینه ناشناخته: ${arg}\nبرای راهنما اجرا کنید: node scripts/automate.cjs --help`);
    }
  }

  return options;
}

function readConfig(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    fatal(`فایل تنظیمات پیدا نشد یا خوانده نشد: ${file}`);
  }

  let config;
  try {
    config = JSON.parse(raw);
  } catch (error) {
    fatal(`JSON فایل تنظیمات معتبر نیست (${file}): ${error.message}`);
  }

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    fatal("محتوای فایل تنظیمات باید یک شیء JSON باشد.");
  }
  if (!Array.isArray(config.jobs) || config.jobs.length === 0) {
    fatal("config.jobs باید حداقل یک کار داشته باشد.");
  }
  if (
    config.requestTimeoutMs !== undefined &&
    (!Number.isFinite(config.requestTimeoutMs) || config.requestTimeoutMs < 1000)
  ) {
    fatal("config.requestTimeoutMs باید عددی بزرگ‌تر از ۱۰۰۰ میلی‌ثانیه باشد.");
  }

  return config;
}

function buildJobs(rawJobs) {
  const seen = new Set();

  return rawJobs.map((job, index) => {
    if (!job || typeof job !== "object" || Array.isArray(job)) {
      fatal(`کار شماره ${index + 1} در تنظیمات معتبر نیست.`);
    }

    const id = typeof job.id === "string" ? job.id.trim() : "";
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      fatal(`شناسه کار ${JSON.stringify(job.id)} معتبر نیست؛ فقط حروف انگلیسی، عدد، - و _ مجاز است.`);
    }
    if (seen.has(id)) fatal(`شناسه کار تکراری است: ${id}`);
    seen.add(id);

    if (typeof job.path !== "string" || !job.path.startsWith("/")) {
      fatal(`مسیر کار «${id}» باید با / شروع شود.`);
    }

    let parsed;
    try {
      parsed = parseCron(job.schedule);
    } catch (error) {
      fatal(`زمان‌بندی کار «${id}» معتبر نیست: ${error.message}`);
    }

    return {
      id,
      label: typeof job.label === "string" && job.label.trim() ? job.label.trim() : id,
      path: job.path,
      schedule: parsed.expression,
      parsed,
      enabled: job.enabled !== false,
      nextAt: null,
    };
  });
}

function printList(jobs) {
  console.log("\nاتوماسیون محلی Nobino — زمان‌بندی کارها");
  console.log(`مقصد: ${baseUrl}`);
  console.log(`منطقه زمانی: ${timeZoneLabel()}`);
  console.log(`تنظیمات: ${configFile}\n`);

  const now = new Date();
  for (const job of jobs) {
    const state = job.enabled ? "فعال" : "غیرفعال";
    let next = "—";

    if (job.enabled) {
      try {
        next = timestamp(nextRun(job.parsed, now, timeZone));
      } catch (error) {
        next = `خطا: ${error.message}`;
      }
    }

    console.log(`• ${job.id} [${state}] — ${job.schedule} — اجرای بعدی: ${next}`);
    console.log(`  ${job.label} → ${job.path}`);
  }
  console.log("");
}

// ---------------------------------------------------------------------------
// فراخوانی endpointها
// ---------------------------------------------------------------------------

async function callJob(job, { dryRun }) {
  const url = `${baseUrl}${job.path}`;

  if (dryRun) {
    log("INFO", `[dry-run] ${job.id}: GET ${url}`);
    return true;
  }

  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        authorization: `Bearer ${secret}`,
        accept: "application/json",
        "user-agent": "nobino-local-automation/1.0",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    const elapsed = Date.now() - startedAt;
    const raw = await response.text();
    const body = raw.length > 800 ? `${raw.slice(0, 800)}…` : raw;

    if (!response.ok) {
      log(
        "ERROR",
        `${job.id}: HTTP ${response.status} در ${elapsed}ms | ${body || "بدون بدنه"}`
      );
      if (response.status === 401) {
        log("WARN", "احراز هویت رد شد؛ CRON_SECRET در .env و سرور باید یکسان باشد.");
      }
      return false;
    }

    log("OK", `${job.id}: HTTP ${response.status} در ${elapsed}ms | ${body || "بدون بدنه"}`);
    return true;
  } catch (error) {
    const elapsed = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    const cause = error && error.cause instanceof Error ? ` (${error.cause.message})` : "";

    log("ERROR", `${job.id}: اتصال به ${url} ناموفق بود در ${elapsed}ms: ${message}${cause}`);
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(`${message}${cause}`)) {
      log("WARN", "سرور محلی در دسترس نیست؛ ابتدا «npm run dev» را اجرا کنید.");
    }
    return false;
  }
}

async function runOnce(jobs, dryRun) {
  const startedAt = Date.now();
  log("INFO", `اجرای یک‌باره ${jobs.length} کار${dryRun ? " (dry-run)" : ""}...`);

  let failures = 0;
  for (const job of jobs) {
    const ok = await callJob(job, { dryRun });
    if (!ok) failures++;
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  log(
    failures > 0 ? "ERROR" : "OK",
    `پایان اجرای یک‌باره: ${jobs.length - failures} موفق، ${failures} ناموفق (${elapsed}s)`
  );

  return failures;
}

// ---------------------------------------------------------------------------
// حلقه زمان‌بندی
// ---------------------------------------------------------------------------

function computeNext(job) {
  job.nextAt = nextRun(job.parsed, new Date(), timeZone);
}

function scheduleNext(activeJobs, dryRun) {
  if (stopping) return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (activeJobs.length === 0) return;

  const earliest = Math.min(...activeJobs.map((job) => job.nextAt.getTime()));
  const delay = Math.max(0, earliest - Date.now());
  timer = setTimeout(() => tick(activeJobs, dryRun), Math.min(delay, MAX_TIMEOUT_MS));
}

async function tick(activeJobs, dryRun) {
  if (stopping || running) return;

  running = true;
  try {
    const now = Date.now();
    const due = activeJobs.filter((job) => job.nextAt.getTime() <= now);

    for (const job of due) {
      if (stopping) break;

      log("INFO", `شروع ${job.id} (${job.label})`);
      await callJob(job, { dryRun });
      computeNext(job);
      log("INFO", `${job.id}: اجرای بعدی ${timestamp(job.nextAt)}`);
    }
  } catch (error) {
    log(
      "ERROR",
      `خطای غیرمنتظره در حلقه زمان‌بندی: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    running = false;
    scheduleNext(activeJobs, dryRun);
  }
}

function startScheduler(activeJobs, dryRun) {
  if (activeJobs.length === 0) {
    fatal("هیچ کار فعالی برای اجرا وجود ندارد؛ در automation.config.json حداقل یک کار را enabled کنید.");
  }

  for (const job of activeJobs) computeNext(job);

  log("INFO", `اتوماسیون محلی Nobino شروع شد | مقصد: ${baseUrl} | منطقه زمانی: ${timeZoneLabel()}`);
  for (const job of activeJobs) {
    log(
      "INFO",
      `• ${job.id} (${job.label}) — ${job.schedule} — اجرای بعدی: ${timestamp(job.nextAt)}`
    );
  }
  if (dryRun) log("WARN", "حالت dry-run فعال است؛ هیچ درخواست واقعی ارسال نمی‌شود.");
  log("INFO", `برای توقف Ctrl+C را بزنید. لاگ: ${logPath ?? "فقط کنسول"}`);

  scheduleNext(activeJobs, dryRun);
}

// ---------------------------------------------------------------------------
// قفل تک‌نمونه و خاموشی تمیز
// ---------------------------------------------------------------------------

function acquireLock() {
  fs.mkdirSync(path.dirname(LOCK_PATH), { recursive: true });

  if (fs.existsSync(LOCK_PATH)) {
    const pid = Number(fs.readFileSync(LOCK_PATH, "utf8").trim());
    if (Number.isInteger(pid) && pid > 0 && pid !== process.pid && isPidAlive(pid)) {
      fatal(
        `یک نمونه دیگر از اتوماسیون در حال اجراست (PID ${pid}). ابتدا آن را ببندید یا ${LOCK_PATH} را حذف کنید.`
      );
    }
  }

  fs.writeFileSync(LOCK_PATH, String(process.pid), "utf8");
  lockFile = LOCK_PATH;
}

function releaseLock() {
  if (!lockFile) return;

  try {
    if (fs.readFileSync(lockFile, "utf8").trim() === String(process.pid)) {
      fs.rmSync(lockFile, { force: true });
    }
  } catch {
    // فایل از قبل حذف شده است.
  }

  lockFile = null;
}

function shutdown(signal) {
  if (stopping) return;

  stopping = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  log("INFO", `دریافت ${signal}؛ اتوماسیون متوقف شد.`);
  releaseLock();
  process.exit(0);
}

// ---------------------------------------------------------------------------
// اجرای اصلی
// ---------------------------------------------------------------------------

async function main() {
  loadEnv(path.join(ROOT, ".env"));

  const options = parseArgs(process.argv);
  if (options.help) {
    printHelp();
    return;
  }

  configFile = options.config ? path.resolve(process.cwd(), options.config) : DEFAULT_CONFIG;
  const config = readConfig(configFile);

  baseUrl = String(
    process.env.AUTOMATION_BASE_URL || config.baseUrl || "http://localhost:3000"
  ).replace(/\/+$/, "");

  try {
    const parsedUrl = new URL(baseUrl);
    if (!/^https?:$/.test(parsedUrl.protocol)) throw new Error("unsupported protocol");
  } catch {
    fatal(`baseUrl معتبر نیست: ${baseUrl}`);
  }

  timeZone =
    typeof config.timezone === "string" && config.timezone.trim()
      ? config.timezone.trim()
      : "local";
  timeoutMs = Number.isFinite(config.requestTimeoutMs) ? config.requestTimeoutMs : 60_000;
  secret = process.env.CRON_SECRET || "";

  let jobs = buildJobs(config.jobs);

  if (options.jobs) {
    const wanted = new Set(options.jobs);
    const known = new Set(jobs.map((job) => job.id));
    const unknown = [...wanted].filter((id) => !known.has(id));

    if (unknown.length > 0) {
      fatal(`کار(های) ناشناخته: ${unknown.join(", ")} | کارهای موجود: ${[...known].join(", ")}`);
    }

    jobs = jobs.filter((job) => wanted.has(job.id));
  }

  if (options.list) {
    printList(jobs);
    return;
  }

  initLog(config.logFile);

  const activeJobs = jobs.filter((job) => job.enabled);
  if (activeJobs.length === 0) {
    fatal("هیچ کار فعالی انتخاب نشده است؛ enabled را در تنظیمات بررسی کنید.");
  }
  if (!options.dryRun && !secret) {
    fatal("CRON_SECRET در .env یا متغیرهای محیطی تنظیم نشده است.");
  }

  if (options.once) {
    const failures = await runOnce(activeJobs, options.dryRun);
    process.exitCode = failures > 0 ? 1 : 0;
    return;
  }

  acquireLock();
  process.on("exit", releaseLock);
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => {
    log(
      "ERROR",
      `Promise ردشده بدون مدیریت: ${
        reason instanceof Error ? reason.stack ?? reason.message : String(reason)
      }`
    );
  });
  process.on("uncaughtException", (error) => {
    log("ERROR", `استثنای مدیریت‌نشده: ${error.stack ?? error.message}`);
    releaseLock();
    process.exit(1);
  });

  startScheduler(activeJobs, options.dryRun);
}

main().catch((error) => {
  console.error(
    `[خطا] ${error instanceof Error ? error.stack ?? error.message : String(error)}`
  );
  releaseLock();
  process.exit(1);
});
