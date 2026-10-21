import { BaseGateway } from "@/lib/payments/gateways/base";
import { PaymentOrder, PaymentRequestResult, PaymentVerifyResult } from "@/lib/payments/types";
import { env, isSandbox } from "@/lib/env";

/**
 * درگاه ونکی (Vanak) — بانک دی
 */
export class VanakGateway extends BaseGateway {
  readonly id = "vanak";
  readonly name = "ونکی (بانک دی)";
  readonly sandbox = isSandbox(env.VANAK_SANDBOX);

  private base = "https://vanak.ir/api/payment";

  async doRequestPayment(order: PaymentOrder): Promise<PaymentRequestResult> {
    const res = await fetch(`${this.base}/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        terminalId: env.VANAK_TERMINAL_ID,
        merchantId: env.VANAK_MERCHANT_ID,
        amount: order.amount * 10,
        callbackUrl: order.callbackUrl,
        invoiceNumber: order.id,
        description: order.description,
      }),
    });
    const data = await res.json();
    if (data.token || data.status === 0) {
      return {
        success: true,
        authority: data.token ?? String(data.status),
        redirectUrl: `${this.base}/gateway/${data.token ?? data.status}`,
      };
    }
    return { success: false, message: data.message ?? "خطای ونکی" };
  }

  async doVerifyPayment(opts: {
    order: PaymentOrder;
    authority?: string;
    params: Record<string, string>;
  }): Promise<PaymentVerifyResult> {
    const res = await fetch(`${this.base}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        terminalId: env.VANAK_TERMINAL_ID,
        merchantId: env.VANAK_MERCHANT_ID,
        token: opts.authority ?? opts.params.token ?? "",
      }),
    });
    const data = await res.json();
    if (data.status === 0 || data.success) {
      return { success: true, refId: data.rrn ?? data.ref_id ?? "" };
    }
    return { success: false, message: data.message ?? "تراکنش ناموفق" };
  }
}
