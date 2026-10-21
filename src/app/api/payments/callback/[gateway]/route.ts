import { handlePaymentCallback } from "@/lib/payments/engine";
import { getGateway } from "@/lib/payments/registry";

function collectParams(url: string, body?: Record<string, string>): Record<string, string> {
  const u = new URL(url);
  const params: Record<string, string> = {};
  u.searchParams.forEach((v, k) => {
    params[k] = v;
  });
  if (body) Object.assign(params, body);
  return params;
}

export async function GET(req: Request, { params }: { params: Promise<{ gateway: string }> }) {
  const { gateway } = await params;
  const gw = getGateway(gateway);
  const search = collectParams(req.url);
  const orderId = search.order ?? search.OrderId ?? "";
  const authority = search.authority ?? search.RefId ?? search.token ?? search.Token ?? "";

  const result = await handlePaymentCallback({ gatewayId: gateway, orderId, authority, searchParams: search });

  const base = `${search.redirect ?? "/payment/result"}`;
  if (result.success) {
    return Response.redirect(`${base}?status=success&ref=${result.companyId}`);
  }
  return Response.redirect(`${base}?status=failed&reason=${encodeURIComponent(result.message ?? "")}`);
}

export async function POST(req: Request, { params }: { params: Promise<{ gateway: string }> }) {
  const { gateway } = await params;
  let body: Record<string, string> | undefined;
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const obj = await req.json();
      body = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, String(v)]));
    } else {
      const form = await req.formData();
      body = {};
      for (const [k, v] of form.entries()) {
        if (typeof v === "string") body[k] = v;
      }
    }
  } catch {
    body = undefined;
  }

  const search = collectParams(req.url, body);
  const orderId = search.order ?? search.OrderId ?? "";
  const authority = search.authority ?? search.RefId ?? search.token ?? search.Token ?? "";

  const result = await handlePaymentCallback({ gatewayId: gateway, orderId, authority, searchParams: search });

  const base = `${search.redirect ?? "/payment/result"}`;
  if (result.success) {
    return Response.redirect(`${base}?status=success&ref=${result.companyId}`);
  }
  return Response.redirect(`${base}?status=failed&reason=${encodeURIComponent(result.message ?? "")}`);
}
