import { PaymentGateway, PaymentOrder, PaymentRequestResult, PaymentVerifyResult } from "@/lib/payments/types";

/**
 * درگاه شبیه‌سازی‌شده (Sandbox/Mock).
 * برای توسعه و تست بدون نیاز به مرچنت‌کد. همواره موفق است.
 */
export class SandboxGateway implements PaymentGateway {
  readonly id = "sandbox";
  readonly name = "شبیه‌سازی (تست)";
  readonly sandbox = true;

  async requestPayment(order: PaymentOrder): Promise<PaymentRequestResult> {
    const authority = `SANDBOX-${Date.now()}`;
    return {
      success: true,
      authority,
      redirectUrl: `/api/payments/mock-pay?authority=${authority}&order=${order.id}`,
      message: "درگاه تست",
    };
  }

  async verifyPayment(opts: {
    order: PaymentOrder;
    authority?: string;
    params: Record<string, string>;
  }): Promise<PaymentVerifyResult> {
    return {
      success: true,
      refId: `SANDBOX-REF-${Date.now()}`,
      cardPan: "6219-8619-****-0000",
      amount: opts.order.amount,
      message: "پرداخت تست موفق",
    };
  }

  callbackMethod(): "GET" | "POST" {
    return "GET";
  }
}
