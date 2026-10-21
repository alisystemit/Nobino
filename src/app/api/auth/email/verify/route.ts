import { z } from "zod";
import { cookies, headers } from "next/headers";
import { createHash } from "node:crypto";
import { verifyOtp } from "@/lib/auth/otp";
import { signToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { json, apiError } from "@/lib/utils";

const schema = z.object({ email: z.string().email(), code: z.string().length(4) });

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase();

    const user = await verifyOtp(email, body.code, "EMAIL_LOGIN");
    const token = await signToken({ sub: user.id, phone: user.phone ?? email, role: user.role });

    try {
      const hdrs = await headers();
      const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || null;
      const device = hdrs.get("user-agent") || null;
      await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          device,
          ip,
        },
      });
    } catch {
      // ثبت نشست اختیاری است
    }

    const store = await cookies();
    store.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    return apiError(err);
  }
}
