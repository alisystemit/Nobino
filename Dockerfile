# نوبینو — ایمیج دوکِر برای PaaS (Render / Railway / Fly.io / Koyeb / هر هاست دوکِر‌پسند)
# build:  docker build -t nobino .
# run  :  docker run -p 3000:3000 --env-file .env nobino

# ── ۱) وابستگی‌ها (npm ci با postinstall → prisma generate) ──
FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# prisma generate در postinstall به فایل اسکیم نیاز دارد
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ── ۲) بیلد (بدون DATABASE_URL هم موفق است — env.ts در فاز بیلد placeholder می‌گذارد) ──
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── ۳) اجرا ──
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
# موتورهای Prisma به OpenSSL نیاز دارند
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts/paas-start.mjs ./scripts/paas-start.mjs
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
# paas-start اول اسکیمای دیتابیس را (با تلاش مجدد) هم‌راستا می‌کند، بعد next start
CMD ["node", "scripts/paas-start.mjs"]
