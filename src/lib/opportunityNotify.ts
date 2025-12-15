import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

function baseUrl() {
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

function fmtName(u: { name: string | null; email: string | null }) {
  return u.name?.trim() || u.email?.trim() || "Someone";
}

export async function emailOpportunityIfNeeded(opportunityId: string) {
  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      room: true,
      userA: true,
      userB: true
    }
  });

  if (!opp) return;
  if (opp.status !== "PROPOSED") return;

  const url = `${baseUrl()}/app/${opp.room.code}`;
  const nameA = fmtName(opp.userA);
  const nameB = fmtName(opp.userB);

  if (opp.userA.email && !opp.emailedAAt) {
    const text = [
      `Potential match in room ${opp.room.code}`,
      "",
      `Other person: ${nameB}`,
      opp.rationale ? `Why: ${opp.rationale}` : "",
      opp.introToA ? `Intro drafted for you:\n${opp.introToA}` : "",
      opp.questionA ? `Question for you:\n${opp.questionA}` : "",
      "",
      `Open: ${url}`
    ]
      .filter(Boolean)
      .join("\n\n");

    await sendEmail({
      to: opp.userA.email,
      subject: `Agent Mesh: potential match (${nameB})`,
      text
    });

    await prisma.opportunity.update({ where: { id: opp.id }, data: { emailedAAt: new Date() } });
  }

  if (opp.userB.email && !opp.emailedBAt) {
    const text = [
      `Potential match in room ${opp.room.code}`,
      "",
      `Other person: ${nameA}`,
      opp.rationale ? `Why: ${opp.rationale}` : "",
      opp.introToB ? `Intro drafted for you:\n${opp.introToB}` : "",
      opp.questionB ? `Question for you:\n${opp.questionB}` : "",
      "",
      `Open: ${url}`
    ]
      .filter(Boolean)
      .join("\n\n");

    await sendEmail({
      to: opp.userB.email,
      subject: `Agent Mesh: potential match (${nameA})`,
      text
    });

    await prisma.opportunity.update({ where: { id: opp.id }, data: { emailedBAt: new Date() } });
  }
}

export async function emailAcceptedOpportunityIfNeeded(opportunityId: string) {
  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      room: true,
      userA: true,
      userB: true
    }
  });

  if (!opp) return;
  if (opp.status !== "ACCEPTED") return;

  const url = `${baseUrl()}/app/${opp.room.code}`;
  const nameA = fmtName(opp.userA);
  const nameB = fmtName(opp.userB);

  const emailA = opp.userA.email?.trim() || null;
  const emailB = opp.userB.email?.trim() || null;

  if (emailA && !opp.acceptedEmailedAAt) {
    const text = [
      `Accepted match in room ${opp.room.code}`,
      "",
      `You: ${nameA} <${emailA}>`,
      emailB ? `Them: ${nameB} <${emailB}>` : `Them: ${nameB}`,
      "",
      opp.introToA ? `Suggested intro you can send:\n${opp.introToA}` : "",
      "",
      `Open: ${url}`
    ]
      .filter(Boolean)
      .join("\n\n");

    await sendEmail({
      to: emailA,
      subject: `Agent Mesh: accepted match (${nameB})`,
      text
    });

    await prisma.opportunity.update({ where: { id: opp.id }, data: { acceptedEmailedAAt: new Date() } });
  }

  if (emailB && !opp.acceptedEmailedBAt) {
    const text = [
      `Accepted match in room ${opp.room.code}`,
      "",
      `You: ${nameB} <${emailB}>`,
      emailA ? `Them: ${nameA} <${emailA}>` : `Them: ${nameA}`,
      "",
      opp.introToB ? `Suggested intro you can send:\n${opp.introToB}` : "",
      "",
      `Open: ${url}`
    ]
      .filter(Boolean)
      .join("\n\n");

    await sendEmail({
      to: emailB,
      subject: `Agent Mesh: accepted match (${nameA})`,
      text
    });

    await prisma.opportunity.update({ where: { id: opp.id }, data: { acceptedEmailedBAt: new Date() } });
  }
}


