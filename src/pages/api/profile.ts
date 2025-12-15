import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { embedProfile } from "@/lib/openai";
import { scheduleMatchmaking } from "@/lib/matchmaker";

const Body = z.object({
  code: z.string().trim().min(3).max(16),
  headline: z.string().trim().max(140).optional().nullable(),
  bio: z.string().trim().max(1200).optional().nullable(),
  interests: z.string().trim().max(800).optional().nullable(),
  lookingFor: z.string().trim().max(800).optional().nullable()
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireUser(req, res);
  if (!auth) return;

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const code = parsed.data.code.toUpperCase();

  const updated = await prisma.profile.upsert({
    where: { userId: auth.userId },
    update: {
      headline: parsed.data.headline ?? undefined,
      bio: parsed.data.bio ?? undefined,
      interests: parsed.data.interests ?? undefined,
      lookingFor: parsed.data.lookingFor ?? undefined
    },
    create: {
      userId: auth.userId,
      headline: parsed.data.headline ?? undefined,
      bio: parsed.data.bio ?? undefined,
      interests: parsed.data.interests ?? undefined,
      lookingFor: parsed.data.lookingFor ?? undefined
    }
  });

  const text = [
    parsed.data.headline ?? "",
    parsed.data.bio ?? "",
    parsed.data.interests ?? "",
    parsed.data.lookingFor ?? ""
  ]
    .join("\n")
    .trim();

  const emb = await embedProfile(text);
  if (emb) {
    await prisma.profile.update({
      where: { userId: auth.userId },
      data: { embedding: JSON.stringify(emb) }
    });
  }

  scheduleMatchmaking(code);
  res.status(200).json({ ok: true, profile: updated });
}


