import { listGateways } from "@/lib/payments/registry";
import { json } from "@/lib/utils";

export async function GET() {
  return json({ success: true, gateways: listGateways() });
}
