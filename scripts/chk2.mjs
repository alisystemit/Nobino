import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const r = await p.user.findUnique({ where: { id: "cmvi5kfzj0001v948ha6ri2v2" }, select: { id: true, phone: true, isActive: true } });
console.log(JSON.stringify(r));
await p.$disconnect();
