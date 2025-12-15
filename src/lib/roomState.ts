import { prisma } from "@/lib/prisma";

export async function getRoomState(code: string, viewerUserId: string) {
  const room = await prisma.room.findUnique({
    where: { code },
    include: {
      participants: {
        include: { user: { include: { profile: true } } },
        orderBy: { joinedAt: "asc" }
      }
    }
  });

  if (!room) return null;

  const isParticipant = room.participants.some((p) => p.userId === viewerUserId);
  if (!isParticipant) return null;

  const me = room.participants.find((p) => p.userId === viewerUserId)?.user ?? null;

  const opps = await prisma.opportunity.findMany({
    where: {
      roomId: room.id,
      status: { in: ["PROPOSED", "ACCEPTED", "DECLINED"] },
      OR: [{ userAId: viewerUserId }, { userBId: viewerUserId }]
    },
    orderBy: { updatedAt: "desc" }
  });

  const userIds = new Set<string>();
  for (const o of opps) {
    userIds.add(o.userAId);
    userIds.add(o.userBId);
  }

  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } },
    include: { profile: true }
  });

  const byId = new Map(users.map((u) => [u.id, u]));

  return {
    room: { code: room.code, createdAt: room.createdAt },
    me: me
      ? {
          id: me.id,
          name: me.name,
          image: me.image,
          profile: me.profile
        }
      : null,
    participants: room.participants.map((p) => ({
      id: p.user.id,
      name: p.user.name,
      image: p.user.image,
      headline: p.user.profile?.headline ?? ""
    })),
    opportunities: opps.map((o) => {
      const otherId = o.userAId === viewerUserId ? o.userBId : o.userAId;
      const other = byId.get(otherId);
      let transcript: any = null;
      if (typeof o.transcript === "string" && o.transcript.trim()) {
        try {
          transcript = JSON.parse(o.transcript);
        } catch {
          transcript = null;
        }
      }
      return {
        ...o,
        transcript,
        other: other
          ? {
              id: other.id,
              name: other.name,
              image: other.image,
              headline: other.profile?.headline ?? ""
            }
          : null,
        viewerSide: o.userAId === viewerUserId ? ("A" as const) : ("B" as const)
      };
    })
  };
}


