/**
 * توابع منطقه‌زمانی بدون وابستگی به Prisma/کوکی‌ها تا در تست واحد هم قابل استفاده باشد.
 */

export function tzOffsetMinutes(timeZone: string, date: Date): number {
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = date.toLocaleString("en-US", { timeZone });
  return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
}

/** تبدیل نیمه‌شب محلی یک تاریخ میلادی (YYYY-MM-DD) در منطقه‌زمان دلخواه به UTC */
export function localMidnightUTC(dayISO: string, timeZone: string): Date {
  const [y, mo, d] = dayISO.split("-").map(Number);
  const year = y ?? 1970;
  const month = (mo ?? 1) - 1;
  const day = d ?? 1;
  const approx = new Date(Date.UTC(year, month, day, 12, 0, 0));
  const offset = tzOffsetMinutes(timeZone, approx);
  return new Date(Date.UTC(year, month, day, 0, 0, 0) - offset * 60 * 1000);
}
