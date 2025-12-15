import type { NextApiRequest, NextApiResponse } from "next";
import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const gen = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireUser(req, res);
  if (!auth) return;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = gen();
    try {
      const room = await prisma.room.create({
        data: {
          code,
          createdById: auth.userId,
          participants: { create: { userId: auth.userId } }
        }
      });
      return res.status(200).json({ code: room.code });
    } catch {
      // collision, retry
    }
  }

  res.status(500).json({ error: "Failed to create room code" });
}


