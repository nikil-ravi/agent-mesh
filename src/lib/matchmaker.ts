import { prisma } from "@/lib/prisma";
import { canonicalPair, cosineSim, nonEmpty } from "@/lib/util";
import { embedProfile, evaluatePair } from "@/lib/openai";
import { emailOpportunityIfNeeded } from "@/lib/opportunityNotify";

type RoomJob = { running: boolean; scheduled: boolean };
const jobs = new Map<string, RoomJob>();

function profileToText(u: { name: string | null; profile: any }) {
  const p = u.profile;
  return [
    `Name: ${u.name ?? "Unknown"}`,
    p?.headline ? `Headline: ${p.headline}` : "",
    p?.bio ? `Bio: ${p.bio}` : "",
    p?.interests ? `Interests: ${p.interests}` : "",
    p?.lookingFor ? `Looking For: ${p.lookingFor}` : ""
  ]
    .filter(nonEmpty)
    .join("\n");
}

export function scheduleMatchmaking(roomCode: string) {
  const j = jobs.get(roomCode) ?? { running: false, scheduled: false };

  if (j.running) {
    j.scheduled = true;
    jobs.set(roomCode, j);
    return;
  }

  j.running = true;
  jobs.set(roomCode, j);

  setTimeout(async () => {
    try {
      await runMatchmaking(roomCode);
    } finally {
      const jj = jobs.get(roomCode);
      if (!jj) return;
      if (jj.scheduled) {
        jj.scheduled = false;
        jj.running = false;
        jobs.set(roomCode, jj);
        scheduleMatchmaking(roomCode);
      } else {
        jobs.delete(roomCode);
      }
    }
  }, 250);
}

async function runMatchmaking(roomCode: string) {
  const room = await prisma.room.findUnique({
    where: { code: roomCode },
    include: { participants: { include: { user: { include: { profile: true } } } } }
  });
  if (!room) return;

  const people = room.participants
    .map((p) => p.user)
    .filter((u) => u.profile && (u.profile.bio || u.profile.interests || u.profile.headline));

  if (people.length < 2) return;

  for (const u of people) {
    const p = u.profile!;
    if (!p.embedding) {
      const text = profileToText({ name: u.name, profile: p });
      const emb = await embedProfile(text);
      if (emb) {
        await prisma.profile.update({
          where: { userId: u.id },
          data: { embedding: JSON.stringify(emb) }
        });
        p.embedding = JSON.stringify(emb) as any;
      }
    }
  }

  const withEmb = people
    .map((u) => {
      const raw = (u.profile?.embedding as unknown as string | null) ?? null;
      if (!raw) return { u, emb: null as number[] | null };
      try {
        const parsed = JSON.parse(raw) as unknown;
        return { u, emb: Array.isArray(parsed) ? (parsed as number[]) : null };
      } catch {
        return { u, emb: null as number[] | null };
      }
    })
    .filter((x) => Array.isArray(x.emb) && x.emb.length > 0);

  if (withEmb.length < 2) return;

  const SIM_THRESHOLD = 0.18;
  const MAX_LLM_EVALS = 6;
  const pairs: { a: any; b: any; sim: number }[] = [];

  for (let i = 0; i < withEmb.length; i++) {
    for (let k = i + 1; k < withEmb.length; k++) {
      const sim = cosineSim(withEmb[i]!.emb!, withEmb[k]!.emb!);
      if (sim >= SIM_THRESHOLD) pairs.push({ a: withEmb[i]!.u, b: withEmb[k]!.u, sim });
    }
  }

  pairs.sort((x, y) => y.sim - x.sim);

  let evaluated = 0;
  for (const { a, b } of pairs) {
    if (evaluated >= MAX_LLM_EVALS) break;

    const [userAId, userBId] = canonicalPair(a.id, b.id);

    const exists = await prisma.opportunity.findUnique({
      where: { roomId_userAId_userBId: { roomId: room.id, userAId, userBId } }
    });
    if (exists) continue;

    const textA = profileToText({ name: a.name, profile: a.profile });
    const textB = profileToText({ name: b.name, profile: b.profile });

    const evalRes = await evaluatePair({
      nameA: a.name ?? "A",
      nameB: b.name ?? "B",
      profileA: textA,
      profileB: textB
    });

    evaluated++;
    if (!evalRes) continue;

    if (!evalRes.should_connect || evalRes.score < 0.55) {
      await prisma.opportunity.create({
        data: {
          roomId: room.id,
          userAId,
          userBId,
          status: "DISCARDED",
          score: evalRes.score,
          rationale: evalRes.rationale,
          transcript: JSON.stringify(evalRes.transcript),
          introToA: evalRes.intro_to_a,
          introToB: evalRes.intro_to_b,
          questionA: evalRes.question_for_a,
          questionB: evalRes.question_for_b
        }
      });
      continue;
    }

    const created = await prisma.opportunity.create({
      data: {
        roomId: room.id,
        userAId,
        userBId,
        status: "PROPOSED",
        score: evalRes.score,
        rationale: evalRes.rationale,
        transcript: JSON.stringify(evalRes.transcript),
        introToA: evalRes.intro_to_a,
        introToB: evalRes.intro_to_b,
        questionA: evalRes.question_for_a,
        questionB: evalRes.question_for_b
      }
    });

    await emailOpportunityIfNeeded(created.id);
  }

  const io = (globalThis as any).io as import("socket.io").Server | undefined;
  io?.to(roomCode).emit("room:changed");
}


