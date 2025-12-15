import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireUser(req, res);
  if (!auth) return;

  const me = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: { profile: true }
  });

  res.status(200).json({ me });
}


