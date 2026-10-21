<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# قواعد معماری و الگوهای پروژه (Nobino)

## معماری
- Next.js 16 (App Router) — فرانت و بک‌اند یکپارچه در `src/app`.
- مابلات دیتابیس با Prisma 6 + PostgreSQL. اسکیمای دیتابیس فقط در `prisma/schema.prisma`.
- **همه منطق تجاری در `src/lib`**، نه مستقیم داخل Route Handler.
- TypeScript سخت‌گیرانه (`strict`). هر کد جدید باید نوع‌دهی کامل داشته باشد.

## دستورات
| فرمان | شرح |
|---|---|
| `npm run dev` | اجرای محلی |
| `npm run db:local` | راه‌اندازی PostgreSQL محلی (embedded) + seed |
| `npm run db:migrate` | مهاجرت دیتابیس |
| `npm run db:push` | اعمال schema بدون مهاجرت |
| `npm run seed` | داده‌های نمونه |
| `npm test` | تست‌ها (Node test runner) |
| `npm run build` | بیلد پروداکشن |

## الگوی تست
- تست‌ها در `tests/*.test.ts` (Node built-in test runner، بدون وابستگی).
- تست‌های E2E زنده: `scripts/e2e-*.cjs` (نیازمند سرور در حال اجرا).
- قبل از انتشار کد، `npm run build` و `npm test` باید سبز باشند.

## محدودیت‌های امنیتی (مهم)
- تغییرات دیتابیس فقط از طریق Prisma (schema) — هرگز SQL مستقیم بدون تراکنش.
- ثبت نوبت باید از `createAppointmentSafe` عبور کند (قفل `FOR UPDATE` روی سالن تا از رزرو هم‌زمان جلوگیری شود). هرگز فقط با بررسی فرانت/بررسی ساده در فرانت جلوگیری نکن.
- کلیدهای API و مقادیر secret نباید در پاسخ API برگردند (در پنل تنظیمات فقط `hasValue` برمی‌گردد).
- دسترسی نقش‌ها از طریق `requireRole`/`requireAuth`؛ سوپرادمین `ADMIN`، آرایشگر `SALON_OWNER`، نماینده `AGENT`.
- نباید به کاربران عادی دسترسی به مسیرهای `admin` یا تنظیمات سیستم داده شود.
- ارسال پیامک از طریق صف `Notification` (با `uniqueKey` برای جلوگیری از ارسال تکراری) انجام شود، نه ارسال مستقیم.

## نکات Next 16
- از `proxy.ts` استفاده کنید (نه `middleware.ts`).
- `params`/`searchParams`/`cookies()`/`headers()` همگی async هستند و باید `await` شوند.
- برای مسیرهای داینامیک با داده زنده، از `export const instant = false` استفاده کنید.
- `nextConfig.cacheComponents` فعال است؛ `dynamic="force-dynamic"` مجاز نیست.
