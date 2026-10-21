import { env } from "@/lib/env";

/**
 * لایه انتزاعی ارسال پیامک.
 * درایورها: kavenegar | smsdotir | mock
 */
export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
  sendAppointmentReminder(phone: string, salon: string, time: string): Promise<void>;
}

class MockProvider implements SmsProvider {
  async sendOtp(phone: string, code: string) {
    console.log(`[SMS:MOCK] OTP به ${phone}: کد ${code}`);
  }
  async sendAppointmentReminder(phone: string, salon: string, time: string) {
    console.log(`[SMS:MOCK] یادآوری نوبت به ${phone} برای ${salon} ساعت ${time}`);
  }
}

class KavenegarProvider implements SmsProvider {
  private base = "https://api.kavenegar.com/v1";
  private apiKey: string;
  constructor() {
    this.apiKey = env.KAVENEGAR_API_KEY;
    if (!this.apiKey) throw new Error("KAVENEGAR_API_KEY تنظیم نشده است");
  }
  private async send(phone: string, message: string) {
    const url = `${this.base}/${this.apiKey}/sms/send.json`;
    const body = new URLSearchParams({ receptor: phone, message });
    await fetch(url, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  }
  async sendOtp(phone: string, code: string) {
    await this.send(phone, `کد ورود شما به نوبینو: ${code}`);
  }
  async sendAppointmentReminder(phone: string, salon: string, time: string) {
    await this.send(phone, `یادآوری نوبت آرایشگاه ${salon} — رأس ساعت ${time} حضور داشته باشید.`);
  }
}

class SmsDotIrProvider implements SmsProvider {
  private apiKey: string;
  private sender: string;
  constructor() {
    this.apiKey = env.SMSDOTIR_API_KEY;
    this.sender = env.SMSDOTIR_SENDER;
    if (!this.apiKey) throw new Error("SMSDOTIR_API_KEY تنظیم نشده است");
  }
  private async send(phone: string, message: string) {
    await fetch("https://api.sms.ir/v1/send/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({ lineNumber: this.sender, messageText: message, mobiles: [phone] }),
    });
  }
  async sendOtp(phone: string, code: string) {
    await this.send(phone, `کد ورود شما به نوبینو: ${code}`);
  }
  async sendAppointmentReminder(phone: string, salon: string, time: string) {
    await this.send(phone, `یادآوری نوبت آرایشگاه ${salon} — رأس ساعت ${time}.`);
  }
}

const providers: Record<string, () => SmsProvider> = {
  mock: () => new MockProvider(),
  kavenegar: () => new KavenegarProvider(),
  smsdotir: () => new SmsDotIrProvider(),
};

let _instance: SmsProvider | null = null;
export function getSmsProvider(): SmsProvider {
  if (!_instance) {
    const factory = providers[env.SMS_PROVIDER] ?? providers.mock;
    _instance = factory();
  }
  return _instance;
}
