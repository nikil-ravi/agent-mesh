import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { scheduleMatchmaking } from "@/lib/matchmaker";
import { emailAcceptedOpportunityIfNeeded } from "@/lib/opportunityNotify";

const Body = z.object({
  decision: z.enum(["ACCEPT", "DECLINE"]),
  answer: z.string().trim().max(800).optional()
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireUser(req, res);
  if (!auth) return;

  const oppId = String(req.query.id || "");
  if (!oppId) return res.status(400).json({ error: "Missing id" });

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const opp = await prisma.opportunity.findUnique({
    where: { id: oppId },
    include: { room: true }
  });
  if (!opp) return res.status(404).json({ error: "Not found" });

  const isA = opp.userAId === auth.userId;
  const isB = opp.userBId === auth.userId;
  if (!isA && !isB) return res.status(403).json({ error: "Not yours" });

  const decisionEnum = parsed.data.decision === "ACCEPT" ? "ACCEPT" : "DECLINE";

  const data: any = {};
  if (isA) {
    data.decisionA = decisionEnum;
    if (parsed.data.answer) data.answerA = parsed.data.answer;
  } else {
    data.decisionB = decisionEnum;
    if (parsed.data.answer) data.answerB = parsed.data.answer;
  }

  await prisma.opportunity.update({ where: { id: oppId }, data });

  const final = await prisma.opportunity.findUnique({ where: { id: oppId } });
  if (!final) return res.status(200).json({ ok: true });

  let status: any = final.status;
  const declined = final.decisionA === "DECLINE" || final.decisionB === "DECLINE";
  const accepted = final.decisionA === "ACCEPT" && final.decisionB === "ACCEPT";
  if (declined) status = "DECLINED";
  if (accepted) status = "ACCEPTED";

  if (status !== final.status) {
    await prisma.opportunity.update({ where: { id: oppId }, data: { status } });
  }

  if (status === "ACCEPTED") {
    await emailAcceptedOpportunityIfNeeded(oppId);
  }

  scheduleMatchmaking(opp.room.code);

  const io = (globalThis as any).io as import("socket.io").Server | undefined;
  io?.to(opp.room.code).emit("room:changed");

  res.status(200).json({ ok: true });
}


