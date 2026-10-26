"use client";

import { toPersianDigits } from "@/lib/time/jalali";

type Props = {
  /** "HH:MM" (لاتین، همان چیزی که فرم‌ها انتظار دارند) */
  value: string;
  onChange: (value: string) => void;
  /** بازهٔ ساعات قابل انتخاب (پیش‌فرض ۸ تا ۲۳) */
  from?: number;
  to?: number;
  /** گام دقیقه (پیش‌فرض ۵) */
  step?: number;
  className?: string;
  disabled?: boolean;
  label?: string;
};

const fieldCls =
  "rounded-xl border border-neutral-200 bg-neutral-50/60 px-2 py-2.5 text-center text-sm text-neutral-800 outline-none transition focus:border-pink-400 focus:bg-white disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100";

/**
 * انتخاب ساعت با ارقام فارسی — جایگزین `<input type="time">` که ساعت را با ارقام
 * لاتین نشان می‌داد. مقدار خروجی "HH:MM" لاتین است تا همان قرارداد قبلی حفظ شود.
 */
export default function TimeField({
  value,
  onChange,
  from = 8,
  to = 23,
  step = 5,
  className = "",
  disabled = false,
  label,
}: Props) {
  const [hourPart = "", minutePart = ""] = value ? value.split(":") : ["", ""];
  const hours = Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
  const minutes = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step);
  const currentMinute = Number(minutePart);
  if (minutePart && !minutes.includes(currentMinute)) minutes.push(currentMinute);
  minutes.sort((a, b) => a - b);

  function setHour(h: string) {
    const m = minutePart || String(minutes[0]).padStart(2, "0");
    onChange(h ? `${h.padStart(2, "0")}:${m}` : "");
  }

  function setMinute(m: string) {
    const h = hourPart || String(from).padStart(2, "0");
    onChange(m ? `${h}:${m.padStart(2, "0")}` : "");
  }

  return (
    <div className={className}>
      {label && <span className="mb-1 block text-[11px] font-black text-neutral-500 dark:text-neutral-400">{label}</span>}
      <div className="flex items-center justify-center gap-1" dir="ltr">
        <select
          value={hourPart}
          onChange={(e) => setHour(e.target.value)}
          disabled={disabled}
          aria-label="ساعت"
          className={`${fieldCls} min-w-0 flex-1`}
        >
          <option value="">ساعت</option>
          {hours.map((h) => (
            <option key={h} value={String(h).padStart(2, "0")}>
              {toPersianDigits(String(h).padStart(2, "0"))}
            </option>
          ))}
        </select>
        <span className="text-sm font-black text-neutral-400">:</span>
        <select
          value={minutePart}
          onChange={(e) => setMinute(e.target.value)}
          disabled={disabled}
          aria-label="دقیقه"
          className={`${fieldCls} min-w-0 flex-1`}
        >
          <option value="">دقیقه</option>
          {minutes.map((m) => (
            <option key={m} value={String(m).padStart(2, "0")}>
              {toPersianDigits(String(m).padStart(2, "0"))}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
