import { prisma } from "@/lib/prisma";
import { json } from "@/lib/utils";

export async function GET() {
  const packages = await prisma.package.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
  });
  return json({
    success: true,
    packages: packages.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      plan: p.plan,
      price: p.price,
      yearlyPrice: p.yearlyPrice,
      durationDays: p.durationDays,
      features: (p.features ?? []) as string[],
    })),
  });
}
