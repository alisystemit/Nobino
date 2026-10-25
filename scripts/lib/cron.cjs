"use strict";

/**
 * پارسر و زمان‌بند مینیمال کرون (۵ فیلدی) برای اتوماسیون محلی.
 * پشتیبانی: همه مقادیر، گام‌دار، مقدار ثابت، بازه، بازه گام‌دار و لیست با کاما.
 * منطقه زمانی می‌تواند "local" یا یک IANA timezone مثل "Asia/Tehran" باشد.
 */

const FIELDS = [
  { key: "minute", label: "دقیقه", min: 0, max: 59 },
  { key: "hour", label: "ساعت", min: 0, max: 23 },
  { key: "day", label: "روز ماه", min: 1, max: 31 },
  { key: "month", label: "ماه", min: 1, max: 12 },
  { key: "weekday", label: "روز هفته", min: 0, max: 7 },
];

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const MINUTE_MS = 60_000;
const MAX_SEARCH_MINUTES = 366 * 24 * 60;

function parseField(raw, spec, normalize) {
  const source = String(raw ?? "").trim();
  if (!source) throw new Error(`فیلد «${spec.label}» خالی است.`);

  const values = new Set();

  for (const rawPart of source.split(",")) {
    const token = rawPart.trim();
    if (!token) throw new Error(`فیلد «${spec.label}» یک عضو خالی دارد.`);

    const pieces = token.split("/");
    if (pieces.length > 2) {
      throw new Error(`عبارت «${token}» در فیلد «${spec.label}» معتبر نیست.`);
    }

    const rangePart = pieces[0].trim();
    const stepPart = pieces[1];
    const step = stepPart === undefined ? 1 : Number(stepPart);

    if (!Number.isInteger(step) || step < 1) {
      throw new Error(`گام «${token}» در فیلد «${spec.label}» باید عددی مثبت باشد.`);
    }

    let start;
    let end;

    if (rangePart === "*" || rangePart === "?") {
      start = spec.min;
      end = spec.max;
    } else if (rangePart.includes("-")) {
      const bounds = rangePart.split("-");
      if (bounds.length !== 2) {
        throw new Error(`بازه «${rangePart}» در فیلد «${spec.label}» معتبر نیست.`);
      }
      start = Number(bounds[0]);
      end = Number(bounds[1]);
    } else {
      start = Number(rangePart);
      end = stepPart === undefined ? start : spec.max;
    }

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < spec.min ||
      end > spec.max ||
      start > end
    ) {
      throw new Error(
        `مقدار «${token}» در فیلد «${spec.label}» باید بین ${spec.min} و ${spec.max} باشد.`
      );
    }

    for (let value = start; value <= end; value += step) {
      values.add(normalize ? normalize(value) : value);
    }
  }

  if (values.size === 0) {
    throw new Error(`فیلد «${spec.label}» هیچ مقدار معتبری ندارد.`);
  }

  return values;
}

/** تجزیه عبارت کرون؛ در صورت خطا استثنا با پیام فارسی پرتاب می‌شود. */
function parseCron(expression) {
  if (typeof expression !== "string" || !expression.trim()) {
    throw new Error("عبارت کرون باید یک رشته غیرخالی باشد.");
  }

  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(
      `عبارت کرون «${expression}» باید ۵ فیلد داشته باشد (دقیقه ساعت روز ماه روزهفته).`
    );
  }

  const [minute, hour, day, month, weekday] = fields;
  const dayWildcard = day === "*" || day === "?";
  const weekdayWildcard = weekday === "*" || weekday === "?";

  return {
    expression: fields.join(" "),
    minute: parseField(minute, FIELDS[0]),
    hour: parseField(hour, FIELDS[1]),
    day: parseField(day, FIELDS[2]),
    month: parseField(month, FIELDS[3]),
    weekday: parseField(weekday, FIELDS[4], (value) => (value === 7 ? 0 : value)),
    dayRestricted: !dayWildcard,
    weekdayRestricted: !weekdayWildcard,
  };
}

const FORMATTERS = new Map();

function getFormatter(timeZone) {
  if (FORMATTERS.has(timeZone)) return FORMATTERS.get(timeZone);

  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
  } catch {
    throw new Error(`منطقه زمانی «${timeZone}» معتبر نیست.`);
  }

  FORMATTERS.set(timeZone, formatter);
  return formatter;
}

/** اجزای تاریخ در منطقه زمانی مشخص (برای تطبیق با کرون). */
function getParts(date, timeZone = "local") {
  if (!timeZone || timeZone === "local") {
    return {
      minute: date.getMinutes(),
      hour: date.getHours(),
      day: date.getDate(),
      month: date.getMonth() + 1,
      weekday: date.getDay(),
    };
  }

  const parts = {};
  for (const part of getFormatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }

  return {
    minute: Number(parts.minute),
    hour: Number(parts.hour) % 24,
    day: Number(parts.day),
    month: Number(parts.month),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
  };
}

/** آیا این لحظه با عبارت کرون هم‌خوان است؟ (دقت دقیقه) */
function matches(parsed, parts) {
  if (!parsed.minute.has(parts.minute)) return false;
  if (!parsed.hour.has(parts.hour)) return false;
  if (!parsed.month.has(parts.month)) return false;

  const dayMatch = parsed.day.has(parts.day);
  const weekdayMatch = parsed.weekday.has(parts.weekday);

  // طبق کرون استاندارد: اگر هم روز ماه و هم روز هفته محدود شده باشند، OR هستند.
  if (parsed.dayRestricted && parsed.weekdayRestricted) return dayMatch || weekdayMatch;
  return dayMatch && weekdayMatch;
}

/**
 * نزدیک‌ترین زمان اجرای بعدی (به‌صورت دقیقه‌شمار و همیشه بعد از from).
 * @param {string|ReturnType<typeof parseCron>} expression
 * @param {Date} from
 * @param {string} timeZone "local" یا IANA
 */
function nextRun(expression, from = new Date(), timeZone = "local") {
  const parsed = typeof expression === "string" ? parseCron(expression) : expression;

  if (!(from instanceof Date) || Number.isNaN(from.getTime())) {
    throw new Error("زمان مبدأ برای محاسبه اجرای بعدی معتبر نیست.");
  }

  const start = new Date(from.getTime());
  start.setSeconds(0, 0);
  // همیشه بعد از دقیقه جاری؛ زمان‌بند در شروع دقیقه بعد اجرا می‌شود.
  const candidate = new Date(start.getTime() + MINUTE_MS);

  for (let i = 0; i < MAX_SEARCH_MINUTES; i++) {
    if (matches(parsed, getParts(candidate, timeZone))) {
      return new Date(candidate);
    }
    candidate.setTime(candidate.getTime() + MINUTE_MS);
  }

  throw new Error(`برای عبارت «${parsed.expression}» اجرای بعدی در یک سال پیدا نشد.`);
}

module.exports = {
  parseCron,
  nextRun,
  matches,
  getParts,
};
