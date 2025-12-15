import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/auth";
import { getRoomState } from "@/lib/roomState";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireUser(req, res);
  if (!auth) return;

  const codeRaw = String(req.query.code || "").toUpperCase();
  if (!codeRaw || codeRaw.length > 16) return res.status(400).json({ error: "Bad code" });

  const state = await getRoomState(codeRaw, auth.userId);
  if (!state) return res.status(404).json({ error: "Room not found or not a participant" });

  res.status(200).json(state);
}


