import type { GetServerSideProps } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { signIn, signOut } from "next-auth/react";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export const getServerSideProps: GetServerSideProps<{ email: string | null }> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  return { props: { email: session?.user?.email ?? null } };
};

export default function Home({ email }: { email: string | null }) {

  return (
    <main className="container">
      <h1>Agent Mesh</h1>
      <p className="muted">AI-mediated matchmaking for humans (with consent).</p>

      {!email ? (
        <button className="btn" onClick={() => signIn("google")}>
          Sign in with Google
        </button>
      ) : (
        <>
          <p>
            Signed in as <b>{email}</b>
          </p>
          <div className="row">
            <Link className="btn" href="/app">
              Go to app
            </Link>
            <button className="btn secondary" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
        </>
      )}
    </main>
  );
}


