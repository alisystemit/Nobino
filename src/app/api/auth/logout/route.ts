import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE } from "@/lib/auth/guards";
import { json } from "@/lib/utils";

export async function POST() {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;

  if (token) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.session.deleteMany({ where: { tokenHash } });
  }

  store.delete(AUTH_COOKIE);
  return json({ success: true });
}