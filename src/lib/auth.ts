import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export async function requireUser(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const user = session?.user as (typeof session.user & { id?: string }) | undefined;
  if (!user?.id) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return { session, userId: user.id, user };
}


