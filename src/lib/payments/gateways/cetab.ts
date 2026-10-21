import { BaseGateway } from "@/lib/payments/gateways/base";
import { PaymentOrder, PaymentRequestResult, PaymentVerifyResult } from "@/lib/payments/types";
import { env, isSandbox } from "@/lib/env";

/**
 * درگاه سی‌تاب (CETab) — بانک تجارت
 */
export class CetabGateway extends BaseGateway {
  readonly id = "cetab";
  readonly name = "سی‌تاب (تجارت)";
  readonly sandbox = isSandbox(env.CETAB_SANDBOX);

  private base = "https://cetab.shaparak.ir";

  async doRequestPayment(order: PaymentOrder): Promise<PaymentRequestResult> {
    const res = await fetch(`${this.base}/api/v1/payment/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        terminalId: env.CETAB_TERMINAL_ID,
        merchantId: env.CETAB_MERCHANT_ID,
        amount: order.amount * 10,
        callbackUrl: order.callbackUrl,
        invoiceNumber: order.id,
      }),
    });
    const data = await res.json();
    if (data.token) {
      return { success: true, authority: data.token, redirectUrl: `${this.base}/payment/gateway/${data.token}` };
    }
    return { success: false, message: data.message ?? "خطای سی‌تاب" };
  }

  async doVerifyPayment(opts: {
    order: PaymentOrder;
    authority?: string;
    params: Record<string, string>;
  }): Promise<PaymentVerifyResult> {
    const res = await fetch(`${this.base}/api/v1/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        terminalId: env.CETAB_TERMINAL_ID,
        merchantId: env.CETAB_MERCHANT_ID,
        token: opts.authority ?? opts.params.token ?? "",
      }),
    });
    const data = await res.json();
    if (data.status === 0 || data.success) {
      return { success: true, refId: data.rrn ?? data.traceNo ?? "" };
    }
    return { success: false, message: data.message ?? "تراکنش ناموفق" };
  }
}
