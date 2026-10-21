import { z } from "zod";
import { requestOtp } from "@/lib/auth/otp";
import { json, apiError } from "@/lib/utils";

const schema = z.object({
  phone: z.string().regex(/^0?9\d{9}$/, "شماره موبایل معتبر نیست"),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const phone = body.phone.startsWith("0") ? body.phone : `0${body.phone}`;
    await requestOtp(phone);
    return json({ success: true, message: "کد تأیید ارسال شد", expiresIn: 300 });
  } catch (err) {
    return apiError(err);
  }
}
