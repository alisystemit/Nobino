"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import {
  JALALI_MONTHS,
  WEEKDAYS_SHORT,
  isoToJalali,
  jalaliMonthDays,
  jalaliToGregorian,
  jalaliToIso,
  toPersianDigits,
  weekdayIndexSaturdayFirst,
} from "@/lib/time/jalali";
import { todayInZone } from "@/lib/time/zoned";

type Props = {
  /** تاریخ میلادی به شکل YYYY-MM-DD (همان چیزی که به API می‌رود) */
  value: string;
  onChange: (iso: string) => void;
  /** کمینه/بیشینه به شکل میلادی YYYY-MM-DD */
  min?: string;
  max?: string;
  label?: string;
  placeholder?: string;
  /** کلاس خودِ دکمهٔ فیلد (برای هم‌اندازه شدن با بقیهٔ فرم) */
  className?: string;
  /** «امروز» به ساعت سالن؛ اگر ندهید از منطقهٔ زمانی مرورگر خوانده می‌شود */
  timeZone?: string | null;
  disabled?: boolean;
  id?: string;
};

/**
 * تقویم هجری شمسی — جایگزین `<input type="date">` که تقویم میلادی نشان می‌داد.
 * مقدارِ ذخیره‌شده همچنان میلادی (ISO) است؛ فقط نمایش و انتخاب شمسی و با ارقام فارسی.
 */
export default function JalaliDatePicker({
  value,
  onChange,
  min,
  max,
  label,
  placeholder = "انتخاب تاریخ",
  className = "",
  timeZone,
  disabled = false,
  id,
}: Props) {
  const today = useMemo(() => todayInZone(timeZone), [timeZone]);
  const selected = isoToJalali(value);
  const todayJ = isoToJalali(today);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<{ jy: number; jm: number }>(() => {
    const base = selected ?? todayJ ?? { jy: 1405, jm: 1, jd: 1 };
    return { jy: base.jy, jm: base.jm };
  });
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openCalendar() {
    if (disabled) return;
    const base = isoToJalali(value) ?? todayJ ?? { jy: 1405, jm: 1, jd: 1 };
    setView({ jy: base.jy, jm: base.jm });
    setOpen((v) => !v);
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const total = v.jy * 12 + (v.jm - 1) + delta;
      return { jy: Math.floor(total / 12), jm: (total % 12) + 1 };
    });
  }

  function shiftYear(delta: number) {
    setView((v) => ({ jy: v.jy + delta, jm: v.jm }));
  }

  const days = jalaliMonthDays(view.jy, view.jm);
  const firstG = jalaliToGregorian(view.jy, view.jm, 1);
  const lead = weekdayIndexSaturdayFirst(firstG.gy, firstG.gm, firstG.gd);

  function dayIso(jd: number): string {
    return jalaliToIso(view.jy, view.jm, jd);
  }

  function isDisabled(iso: string): boolean {
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  }

  function pick(iso: string) {
    if (isDisabled(iso)) return;
    onChange(iso);
    setOpen(false);
  }

  const fieldCls =
    "flex w-full items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50/60 px-3 py-2.5 text-sm text-neutral-800 outline-none transition focus:border-pink-400 focus:bg-white disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:bg-neutral-900";

  return (
    <div className="relative" ref={boxRef}>
      {label && (
        <span className="mb-1 block text-[11px] font-black text-neutral-500 dark:text-neutral-400">{label}</span>
      )}
      <button
        id={id}
        type="button"
        onClick={openCalendar}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label ? `${label} — تقویم شمسی` : "تقویم شمسی"}
        className={`${fieldCls} ${value ? "" : "text-neutral-400 dark:text-neutral-500"} ${className}`}
      >
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-pink-500" />
          {value ? formatShown(value) : placeholder}
        </span>
        <ChevronLeft className={`h-4 w-4 text-neutral-400 transition ${open ? "-rotate-90" : "rotate-0"}`} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="انتخاب تاریخ شمسی"
          className="absolute right-0 z-50 mt-2 w-[19.5rem] max-w-[92vw] rounded-2xl border border-neutral-200 bg-white p-3 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
        >
          <div className="mb-2 flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftYear(-1)}
                aria-label="سال قبل"
                className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="ماه قبل"
                className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm font-black text-neutral-800 dark:text-neutral-100">
              {JALALI_MONTHS[view.jm - 1]} {toPersianDigits(view.jy)}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="ماه بعد"
                className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => shiftYear(1)}
                aria-label="سال بعد"
                className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS_SHORT.map((d) => (
              <span key={d} className="py-1 text-[10px] font-black text-neutral-400">
                {d}
              </span>
            ))}
            {Array.from({ length: lead }).map((_, i) => (
              <span key={`lead-${i}`} />
            ))}
            {Array.from({ length: days }).map((_, i) => {
              const jd = i + 1;
              const iso = dayIso(jd);
              const isSel = selected?.jy === view.jy && selected?.jm === view.jm && selected?.jd === jd;
              const isToday = iso === today;
              const off = isDisabled(iso);
              return (
                <button
                  key={jd}
                  type="button"
                  onClick={() => pick(iso)}
                  disabled={off}
                  aria-label={`${jd} ${JALALI_MONTHS[view.jm - 1]} ${view.jy}`}
                  aria-pressed={isSel}
                  className={`h-9 rounded-lg text-sm transition ${
                    isSel
                      ? "bg-gradient-to-l from-pink-600 to-purple-600 font-black text-white shadow-sm"
                      : off
                        ? "cursor-not-allowed text-neutral-300 dark:text-neutral-600"
                        : isToday
                          ? "bg-pink-50 font-bold text-pink-700 hover:bg-pink-100 dark:bg-pink-900/30 dark:text-pink-300"
                          : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  }`}
                >
                  {toPersianDigits(jd)}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => pick(today)}
              disabled={isDisabled(today)}
              className="rounded-lg px-2 py-1 text-xs font-black text-pink-600 transition hover:bg-pink-50 disabled:opacity-40 dark:text-pink-300 dark:hover:bg-pink-900/30"
            >
              امروز ({toPersianDigits(todayJ ? `${todayJ.jd} ${JALALI_MONTHS[todayJ.jm - 1]}` : "")})
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="بستن تقویم"
              className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** نمایش تاریخ انتخاب‌شده در دکمه: «۴ آبان ۱۴۰۵» */
function formatShown(iso: string): string {
  const j = isoToJalali(iso);
  if (!j) return "";
  return toPersianDigits(`${j.jd} ${JALALI_MONTHS[j.jm - 1]} ${j.jy}`);
}
