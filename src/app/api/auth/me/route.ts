import { getCurrentUser } from "@/lib/auth/guards";
import { json } from "@/lib/utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return json({ success: false, user: null }, { status: 401 });
  }
  return json({
    success: true,
    user: { id: user.id, phone: user.phone, name: user.name, role: user.role, email: user.email },
  });
}
