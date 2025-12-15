import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { scheduleMatchmaking } from "@/lib/matchmaker";

const Body = z.object({ code: z.string().trim().min(3).max(16) });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireUser(req, res);
  if (!auth) return;

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid code" });

  const code = parsed.data.code.toUpperCase();
  const room = await prisma.room.findUnique({ where: { code } });
  if (!room) return res.status(404).json({ error: "Room not found" });

  await prisma.roomParticipant.upsert({
    where: { roomId_userId: { roomId: room.id, userId: auth.userId } },
    update: {},
    create: { roomId: room.id, userId: auth.userId }
  });

  scheduleMatchmaking(code);
  res.status(200).json({ ok: true, code });
}


