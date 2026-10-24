import { z } from "zod";
import { requireSalonManage } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { json, apiError } from "@/lib/utils";

const schema = z.object({
  rows: z
    .array(
      z.object({
        phone: z.string().regex(/^0?9\d{9}$/),
        name: z.string().optional(),
        visits: z.number().int().min(0).optional(),
        spend: z.number().int().min(0).optional(),
        note: z.string().max(2000).optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .max(5000),
});

/** ورود داده قدیمی مشتریان با upsert روی شماره/سالن */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireSalonManage(id);
    const { rows } = schema.parse(await req.json());

    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const phone = row.phone.startsWith("0") ? row.phone : `0${row.phone}`;
      const existing = await prisma.salonCustomer.findUnique({ where: { salonId_phone: { salonId: id, phone } } });
      if (existing) {
        await prisma.salonCustomer.update({
          where: { id: existing.id },
          data: {
            name: row.name ?? existing.name,
            visits: row.visits ?? existing.visits,
            spend: row.spend ?? existing.spend,
            note: row.note ?? existing.note,
            tags: row.tags ?? existing.tags,
          },
        });
        updated++;
      } else {
        await prisma.salonCustomer.create({
          data: {
            salonId: id,
            phone,
            name: row.name,
            visits: row.visits ?? 0,
            spend: row.spend ?? 0,
            note: row.note,
            tags: row.tags ?? [],
          },
        });
        created++;
      }
    }

    return json({ success: true, created, updated, total: rows.length });
  } catch (err) {
    return apiError(err);
  }
}