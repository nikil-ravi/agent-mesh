import type { GetServerSideProps } from "next";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import useSWR from "swr";
import { io as ioClient, type Socket } from "socket.io-client";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

const fetcher = (u: string) =>
  fetch(u).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Failed");
    return j;
  });

async function postJSON(url: string, body: any) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}

export default function RoomPage({ code }: { code: string }) {
  const { data, error, mutate } = useSWR(code ? `/api/rooms/${code}` : null, fetcher, { refreshInterval: 6000 });

  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!code) return;
    postJSON("/api/rooms/join", { code }).catch(() => {});
  }, [code]);

  useEffect(() => {
    if (!code) return;
    fetch("/api/socket").catch(() => {});
    const s = ioClient({ path: "/api/socket" });
    s.on("connect", () => s.emit("room:join", { code }));
    s.on("room:changed", () => mutate());
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [code, mutate]);

  if (error)
    return (
      <main className="container">
        <p className="error">{String(error.message || error)}</p>
      </main>
    );

  if (!data)
    return (
      <main className="container">
        <p>Loading…</p>
      </main>
    );

  const me = data.me;
  const participants = data.participants ?? [];
  const opps = data.opportunities ?? [];

  return (
    <main className="container">
      <div className="row space">
        <div>
          <h1>Room {code}</h1>
          <p className="muted">Participants: {participants.length}</p>
        </div>
        <Link className="btn secondary" href="/app">
          Change room
        </Link>
      </div>

      <section className="grid2">
        <div className="card">
          <h2>Your profile</h2>
          <ProfileEditor code={code} me={me} onSaved={() => mutate()} />
          <p className="muted tiny">The agent should only use what you write here. Treat it like a public badge.</p>
        </div>

        <div className="card">
          <h2>People in this room</h2>
          <ul className="list">
            {participants.map((p: any) => (
              <li key={p.id} className="listItem">
                <span className="dot" />
                <div>
                  <div>
                    <b>{p.name ?? "Unnamed"}</b>
                  </div>
                  <div className="muted tiny">{p.headline}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card">
        <h2>Opportunities</h2>
        {opps.length === 0 ? (
          <p className="muted">
            No proposals yet. Add more detail to your profile to help the agent match you.
          </p>
        ) : (
          <div className="stack">
            {opps.map((o: any) => (
              <OpportunityCard key={o.id} opp={o} onChanged={() => mutate()} />
            ))}
          </div>
        )}
      </section>

      <p className="muted tiny">Socket: {socket?.connected ? "connected" : "disconnected"} • Polling fallback active.</p>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps<{ code: string }> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/", permanent: false } };

  const codeRaw = String(ctx.params?.code || "").toUpperCase();
  if (!codeRaw || codeRaw.length > 16) return { notFound: true };

  return { props: { code: codeRaw } };
};

function ProfileEditor({ code, me, onSaved }: { code: string; me: any; onSaved: () => void }) {
  const [headline, setHeadline] = useState(me?.profile?.headline ?? "");
  const [interests, setInterests] = useState(me?.profile?.interests ?? "");
  const [lookingFor, setLookingFor] = useState(me?.profile?.lookingFor ?? "");
  const [bio, setBio] = useState(me?.profile?.bio ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHeadline(me?.profile?.headline ?? "");
    setInterests(me?.profile?.interests ?? "");
    setLookingFor(me?.profile?.lookingFor ?? "");
    setBio(me?.profile?.bio ?? "");
  }, [me?.profile?.headline, me?.profile?.interests, me?.profile?.lookingFor, me?.profile?.bio]);

  return (
    <>
      <label>Headline</label>
      <input
        value={headline}
        onChange={(e) => setHeadline(e.target.value)}
        placeholder="e.g. LLM evals • infra • agents"
      />

      <label>Interests</label>
      <input value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="topics you like" />

      <label>Looking for</label>
      <input
        value={lookingFor}
        onChange={(e) => setLookingFor(e.target.value)}
        placeholder="collabs, hiring, cofounder, etc."
      />

      <label>Bio</label>
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        rows={6}
        placeholder="context + constraints + what you want to talk about"
      />

      <div className="row">
        <button
          className="btn"
          disabled={saving}
          onClick={async () => {
            setErr(null);
            setSaving(true);
            try {
              await postJSON("/api/profile", { code, headline, interests, lookingFor, bio });
              onSaved();
            } catch (e: any) {
              setErr(e.message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Save & re-run matching"}
        </button>
      </div>

      {err && <p className="error">{err}</p>}
    </>
  );
}

function OpportunityCard({ opp, onChanged }: { opp: any; onChanged: () => void }) {
  const other = opp.other;
  const side = opp.viewerSide as "A" | "B";
  const myDecision = side === "A" ? opp.decisionA : opp.decisionB;
  const myQuestion = side === "A" ? opp.questionA : opp.questionB;
  const myAnswer = side === "A" ? opp.answerA : opp.answerB;
  const [answer, setAnswer] = useState(myAnswer ?? "");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setAnswer(myAnswer ?? ""), [myAnswer]);

  const declined = opp.status === "DECLINED";
  const accepted = opp.status === "ACCEPTED";

  return (
    <div className="card subtle">
      <div className="row space">
        <div>
          <div>
            <b>{other?.name ?? "Someone"}</b>{" "}
            <span className="muted tiny">({other?.headline ?? ""})</span>
          </div>
          <div className="muted tiny">
            score: {(opp.score ?? 0).toFixed(2)} • status: <b>{opp.status}</b>
          </div>
        </div>
      </div>

      {opp.rationale && (
        <p>
          <b>Why:</b> {opp.rationale}
        </p>
      )}

      {Array.isArray(opp.transcript) && opp.transcript.length > 0 && (
        <div className="transcript">
          {opp.transcript.map((t: any, i: number) => (
            <div key={i} className="turn">
              <span className="who">{t.speaker}</span>
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid2">
        <div>
          <div className="muted tiny">
            <b>Intro drafted for you</b>
          </div>
          <p className="tiny">{side === "A" ? opp.introToA : opp.introToB}</p>
        </div>
        <div>
          <div className="muted tiny">
            <b>Intro drafted for them</b>
          </div>
          <p className="tiny">{side === "A" ? opp.introToB : opp.introToA}</p>
        </div>
      </div>

      {myQuestion && !declined && (
        <>
          <p className="tiny">
            <b>Agent asks you:</b> {myQuestion}
          </p>
          <textarea
            rows={3}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer (optional but helps)"
          />
        </>
      )}

      {!declined && !accepted && (
        <div className="row">
          <button
            className="btn"
            onClick={async () => {
              setErr(null);
              try {
                await postJSON(`/api/opportunities/${opp.id}/respond`, {
                  decision: "ACCEPT",
                  answer: answer.trim() || undefined
                });
                onChanged();
              } catch (e: any) {
                setErr(e.message);
              }
            }}
          >
            Accept
          </button>

          <button
            className="btn secondary"
            onClick={async () => {
              setErr(null);
              try {
                await postJSON(`/api/opportunities/${opp.id}/respond`, { decision: "DECLINE" });
                onChanged();
              } catch (e: any) {
                setErr(e.message);
              }
            }}
          >
            Decline
          </button>
        </div>
      )}

      {myDecision !== "UNKNOWN" && (
        <p className="muted tiny">
          Your decision: <b>{myDecision}</b>
        </p>
      )}

      {err && <p className="error">{err}</p>}

      {accepted && (
        <p className="ok">✅ Both accepted. Next step: add a “human chat” tab or export calendar-intro text.</p>
      )}
    </div>
  );
}


