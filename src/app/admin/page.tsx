import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { DAILY_TOKEN_LIMIT } from "@/lib/limits";
import { getUser, isAdmin } from "@/lib/user";

// Only signed-in users whose email is in ADMIN_EMAILS can see this.
export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <p className="label">Admin</p>
      <h1 className="mt-2 font-display text-[44px] leading-none tracking-[-0.02em]">Usage</h1>
      <Suspense fallback={<p className="mt-6 text-ink-2">Loading…</p>}>
        <Usage />
      </Suspense>
    </main>
  );
}

async function Usage() {
  const user = await getUser();
  if (!isAdmin(user?.email)) notFound(); // 404, not 403: don't advertise the page exists

  const tokens = sql<number>`sum(coalesce(${messages.inputTokens}, 0) + coalesce(${messages.outputTokens}, 0))::int`;
  const day = sql<string>`to_char(date_trunc('day', ${messages.createdAt} at time zone 'utc'), 'YYYY-MM-DD')`;

  const [daily, recent] = await Promise.all([
    db.select({
      day,
      userId: conversations.userId,
      requests: sql<number>`count(*)::int`,
      input: sql<number>`sum(${messages.inputTokens})::int`,
      output: sql<number>`sum(${messages.outputTokens})::int`,
      tokens,
    })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(isNotNull(messages.outputTokens), gt(messages.createdAt, sql`now() - interval '14 days'`)))
      .groupBy(day, conversations.userId)
      .orderBy(desc(day), desc(tokens)),
    db.select({
      at: messages.createdAt,
      userId: conversations.userId,
      title: conversations.title,
      input: messages.inputTokens,
      output: messages.outputTokens,
    })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(isNotNull(messages.outputTokens))
      .orderBy(desc(messages.createdAt))
      .limit(50),
  ]);

  const th = "px-3 py-2.5 text-left text-xs font-medium text-ink-3";
  const td = "px-3 py-2 tabular-nums";
  const n = (x: number | null) => (x ?? 0).toLocaleString();

  return (
    <>
      <h2 className="label mt-10">Daily totals (last 14 days, UTC)</h2>
      <p className="mt-1 text-sm text-ink-2">Daily limit per user: {n(DAILY_TOKEN_LIMIT)} tokens. Title generation is not counted.</p>
      <div className="mt-3 overflow-x-auto edge rounded-row border border-line bg-glass-1">
        <table className="w-full text-sm">
          <thead className="bg-glass-2"><tr>
            <th className={th}>Day</th><th className={th}>User</th><th className={th}>Replies</th>
            <th className={th}>Input</th><th className={th}>Output</th><th className={th}>Total</th>
          </tr></thead>
          <tbody>
            {daily.length === 0 && <tr><td className={td} colSpan={6}>No usage yet.</td></tr>}
            {daily.map((r) => (
              <tr key={r.day + r.userId} className="border-t border-line transition-colors hover:bg-glass-1">
                <td className={td}>{r.day}</td>
                <td className={`${td} font-mono text-xs`}>{r.userId.slice(0, 8)}</td>
                <td className={td}>{n(r.requests)}</td>
                <td className={td}>{n(r.input)}</td>
                <td className={td}>{n(r.output)}</td>
                <td className={`${td} ${r.tokens >= DAILY_TOKEN_LIMIT ? "font-semibold text-danger" : ""}`}>{n(r.tokens)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="label mt-12">Last 50 requests</h2>
      <div className="mt-3 overflow-x-auto edge rounded-row border border-line bg-glass-1">
        <table className="w-full text-sm">
          <thead className="bg-glass-2"><tr>
            <th className={th}>Time (UTC)</th><th className={th}>User</th><th className={th}>Chat</th>
            <th className={th}>Input</th><th className={th}>Output</th>
          </tr></thead>
          <tbody>
            {recent.map((r, i) => (
              <tr key={i} className="border-t border-line transition-colors hover:bg-glass-1">
                <td className={`${td} whitespace-nowrap`}>{r.at.toISOString().slice(0, 19).replace("T", " ")}</td>
                <td className={`${td} font-mono text-xs`}>{r.userId.slice(0, 8)}</td>
                <td className="max-w-64 truncate px-3 py-2">{r.title}</td>
                <td className={td}>{n(r.input)}</td>
                <td className={td}>{n(r.output)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
