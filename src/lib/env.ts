import { z } from "zod";

/**
 * اعتبارسنجی متمرکز متغیرهای محیطی.
 * مقادیر اختیاری که در توسعه استفاده نمی‌شوند، جایگزین پیش‌فرض می‌گیرند.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16).default("dev-secret-change-me"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_ROOT_DOMAIN: z.string().default("localhost"),

  SMS_PROVIDER: z.enum(["kavenegar", "smsdotir", "mock"]).default("mock"),
  KAVENEGAR_API_KEY: z.string().default(""),
  SMSDOTIR_API_KEY: z.string().default(""),
  SMSDOTIR_SENDER: z.string().default(""),

  VOICE_PROVIDER: z.enum(["openai", "mock"]).default("mock"),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_MODEL: z.string().default("whisper-1"),

  PAYMENT_DEFAULT_GATEWAY: z.string().default("sandbox"),
  PAYMENT_SANDBOX: z.string().default("true"),
  PAYMENT_CALLBACK_BASE: z.string().default("http://localhost:3000/api/payments/callback"),

  ZARINPAL_MERCHANT_ID: z.string().default(""),
  ZARINPAL_SANDBOX: z.string().default("true"),

  MELLAT_TERMINAL_ID: z.string().default(""),
  MELLAT_USERNAME: z.string().default(""),
  MELLAT_PASSWORD: z.string().default(""),
  MELLAT_SANDBOX: z.string().default("true"),

  SAMAN_TERMINAL_ID: z.string().default(""),
  SAMAN_SANDBOX: z.string().default("true"),

  PARSIAN_TERMINAL_ID: z.string().default(""),
  PARSIAN_USERNAME: z.string().default(""),
  PARSIAN_PASSWORD: z.string().default(""),
  PARSIAN_SANDBOX: z.string().default("true"),

  PASARGAD_TERMINAL_ID: z.string().default(""),
  PASARGAD_USERNAME: z.string().default(""),
  PASARGAD_PASSWORD: z.string().default(""),
  PASARGAD_SANDBOX: z.string().default("true"),

  ASANPARDASHT_MERCHANT_ID: z.string().default(""),
  ASANPARDASHT_CONFIG_ID: z.string().default(""),
  ASANPARDASHT_SANDBOX: z.string().default("true"),

  IRANKISH_TERMINAL_ID: z.string().default(""),
  IRANKISH_MERCHANT_ID: z.string().default(""),
  IRANKISH_SHA_KEY: z.string().default(""),
  IRANKISH_SANDBOX: z.string().default("true"),

  BEHPARDAKHT_MERCHANT_ID: z.string().default(""),
  BEHPARDAKHT_SANDBOX: z.string().default("true"),

  SADAD_TERMINAL_ID: z.string().default(""),
  SADAD_MERCHANT_ID: z.string().default(""),
  SADAD_SHA_KEY: z.string().default(""),
  SADAD_SANDBOX: z.string().default("true"),

  MABNA_TERMINAL_ID: z.string().default(""),
  MABNA_MERCHANT_ID: z.string().default(""),
  MABNA_SHA_KEY: z.string().default(""),
  MABNA_SANDBOX: z.string().default("true"),

  CETAB_TERMINAL_ID: z.string().default(""),
  CETAB_MERCHANT_ID: z.string().default(""),
  CETAB_SHA_KEY: z.string().default(""),
  CETAB_SANDBOX: z.string().default("true"),

  PARDASHTNET_MERCHANT_ID: z.string().default(""),
  PARDASHTNET_API_KEY: z.string().default(""),
  PARDASHTNET_SANDBOX: z.string().default("true"),

  PSP_MERCHANT_ID: z.string().default(""),
  PSP_API_KEY: z.string().default(""),
  PSP_SANDBOX: z.string().default("true"),

  NEXTPAY_MERCHANT_ID: z.string().default(""),
  NEXTPAY_API_KEY: z.string().default(""),
  NEXTPAY_SANDBOX: z.string().default("true"),

  VANAK_TERMINAL_ID: z.string().default(""),
  VANAK_MERCHANT_ID: z.string().default(""),
  VANAK_USERNAME: z.string().default(""),
  VANAK_PASSWORD: z.string().default(""),
  VANAK_SANDBOX: z.string().default("true"),

  BLOB_READ_WRITE_TOKEN: z.string().default(""),
  BLOB_STORE_ID: z.string().default(""),
});

export type Env = z.infer<typeof envSchema>;

/**
 * فاز بیلد (next build → Collecting page data) ماژول‌ها را بدون env واقعی evaluate می‌کند.
 * در آن فاز DATABASE_URL جانشین صوری می‌گیرد تا بیلد در کانتینر/پلتفرم بدون .env نشکند؛
 * در زمان اجرا (dev/start) همان‌طور سخت‌گیرانه throw می‌شود.
 */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

function loadEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (err) {
    if (isBuildPhase) {
      return envSchema.parse({
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || "postgresql://build:build@localhost:5432/build_placeholder",
      });
    }
    throw err;
  }
}

export const env = loadEnv();

export const isSandbox = (key?: string) =>
  (key ?? "true").toLowerCase() === "true";
