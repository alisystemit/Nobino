import { createHmac } from "crypto";
import { BaseGateway } from "@/lib/payments/gateways/base";
import { PaymentOrder, PaymentRequestResult, PaymentVerifyResult } from "@/lib/payments/types";
import { env, isSandbox } from "@/lib/env";

function sha256(input: string): string {
  return createHmac("sha256", "").update(input).digest("hex");
}

/**
 * درگاه سداد (بانک ملی)
 */
export class SadadGateway extends BaseGateway {
  readonly id = "sadad";
  readonly name = "سداد (ملی)";
  readonly sandbox = isSandbox(env.SADAD_SANDBOX);

  private requestUrl = "https://sadad.shaparak.ir/api/RequestToken";
  private verifyUrl = "https://sadad.shaparak.ir/api/VerifyTransaction";
  private gateway = "https://sadad.shaparak.ir/VPG/Purchase";

  async doRequestPayment(order: PaymentOrder): Promise<PaymentRequestResult> {
    const token = Date.now().toString();
    const amount = String(order.amount * 10); // ریال
    const signData = env.SADAD_TERMINAL_ID + env.SADAD_MERCHANT_ID + amount + token + order.callbackUrl;
    const sign = sha256(signData);

    const res = await fetch(this.requestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        TerminalId: env.SADAD_TERMINAL_ID,
        MerchantId: env.SADAD_MERCHANT_ID,
        Amount: amount,
        SignData: sign,
        ReturnUrl: order.callbackUrl,
        LocalDateTime: new Date().toISOString().replace(/[-:]/g, "").slice(0, 14),
        OrderId: token,
      }),
    });
    const data = await res.json();
    if (data.Token) {
      return {
        success: true,
        authority: data.Token,
        redirectUrl: `${this.gateway}?token=${data.Token}`,
        referenceId: token,
      };
    }
    return { success: false, message: data.Description ?? "خطای سداد" };
  }

  async doVerifyPayment(opts: {
    order: PaymentOrder;
    authority?: string;
    params: Record<string, string>;
  }): Promise<PaymentVerifyResult> {
    const token = opts.authority ?? opts.params.token ?? "";
    const res = await fetch(this.verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Token: token }),
    });
    const data = await res.json();
    if (data.ResponseCode === 0 || data.Success === true) {
      return { success: true, refId: data.RRN ?? data.SystemTraceNo ?? token };
    }
    return { success: false, message: data.Description ?? "تراکنش ناموفق" };
  }
}
