import { z } from "zod";
import { requestEmailOtp } from "@/lib/auth/otp";
import { json, apiError } from "@/lib/utils";

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    await requestEmailOtp(body.email.toLowerCase());
    return json({ success: true, message: "کد تأیید به ایمیل ارسال شد", expiresIn: 300 });
  } catch (err) {
    return apiError(err);
  }
}
