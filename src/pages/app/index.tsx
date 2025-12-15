import type { GetServerSideProps } from "next";
import { useState } from "react";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

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

export default function AppHome() {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  return (
    <main className="container">
      <h1>Join a session</h1>

      <div className="card">
        <label>Room code</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
        />

        <div className="row">
          <button
            className="btn"
            onClick={async () => {
              setErr(null);
              try {
                const c = code.trim().toUpperCase();
                await postJSON("/api/rooms/join", { code: c });
                window.location.href = `/app/${c}`;
              } catch (e: any) {
                setErr(e.message);
              }
            }}
          >
            Join
          </button>

          <button
            className="btn secondary"
            onClick={async () => {
              setErr(null);
              try {
                const j = await postJSON("/api/rooms/create", {});
                window.location.href = `/app/${j.code}`;
              } catch (e: any) {
                setErr(e.message);
              }
            }}
          >
            Create new
          </button>
        </div>

        {err && <p className="error">{err}</p>}
      </div>

      <p className="muted">Tip: paste the room code into Slack and watch a room self-organize.</p>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) return { redirect: { destination: "/", permanent: false } };
  return { props: {} };
};


