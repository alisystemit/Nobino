import { PaymentGateway, PaymentOrder, PaymentRequestResult, PaymentVerifyResult } from "@/lib/payments/types";

/**
 * پایه مشترک درگاه‌ها.
 * اگر درگاه در حالت سندباکس باشد، به‌صورت خودکار از رفتار
 * شبیه‌سازی استفاده می‌کند؛ در غیر این صورت پیاده‌سازی واقعی صدا زده می‌شود.
 */
export abstract class BaseGateway implements PaymentGateway {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly sandbox: boolean;

  abstract doRequestPayment(order: PaymentOrder): Promise<PaymentRequestResult>;
  abstract doVerifyPayment(opts: {
    order: PaymentOrder;
    authority?: string;
    params: Record<string, string>;
  }): Promise<PaymentVerifyResult>;

  callbackMethod(): "GET" | "POST" {
    return "GET";
  }

  async requestPayment(order: PaymentOrder): Promise<PaymentRequestResult> {
    if (this.sandbox) return this.sandboxRequest(order);
    return this.doRequestPayment(order);
  }

  async verifyPayment(opts: {
    order: PaymentOrder;
    authority?: string;
    params: Record<string, string>;
  }): Promise<PaymentVerifyResult> {
    if (this.sandbox) return this.sandboxVerify(opts);
    return this.doVerifyPayment(opts);
  }

  // ─── رفتار شبیه‌سازی (سندباکس) ────────────────────────────────────────
  private sandboxRequest(order: PaymentOrder): Promise<PaymentRequestResult> {
    const authority = `SB-${this.id.toUpperCase()}-${Date.now()}`;
    const invoiceParam = order.invoiceId ? `&invoice=${order.invoiceId}` : "";
    return Promise.resolve({
      success: true,
      authority,
      redirectUrl: `/api/payments/mock-pay?authority=${authority}&order=${order.id}&gateway=${this.id}${invoiceParam}`,
      message: `درگاه ${this.name} (تست)`,
    });
  }

  private sandboxVerify(opts: {
    order: PaymentOrder;
    authority?: string;
    params: Record<string, string>;
  }): Promise<PaymentVerifyResult> {
    return Promise.resolve({
      success: true,
      refId: `SB-${this.id.toUpperCase()}-REF-${Date.now()}`,
      cardPan: "6274-****-****-0000",
      amount: opts.order.amount,
      message: "پرداخت تست موفق",
    });
  }
}
