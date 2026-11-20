import { and, count, eq, gt, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";

export const MESSAGES_PER_HOUR = 20;
export const DAILY_TOKEN_LIMIT = 2_000_000; // web search pages count as input (~100-250k per search)
// input + output (incl. cached) tokens per user per UTC day

const mine = (userId: string) => eq(conversations.userId, userId);

// Returns a user-facing reason to block, or null if the user may send.
// Counts come from the messages table itself, so no extra tables or Redis.
// shortcut: check-then-insert isn't atomic, a burst of parallel requests can overshoot by a few; fine for a cost guard
export async function checkLimits(userId: string): Promise<string | null> {
  const [[{ sent }], [{ used }]] = await Promise.all([
    db.select({ sent: count() }).from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(mine(userId), eq(messages.role, "user"), gt(messages.createdAt, sql`now() - interval '1 hour'`))),
    db.select({ used: sql<number>`coalesce(sum(coalesce(${messages.inputTokens}, 0) + coalesce(${messages.outputTokens}, 0)), 0)::int` })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(mine(userId), gte(messages.createdAt, sql`date_trunc('day', now() at time zone 'utc') at time zone 'utc'`))),
  ]);
  if (sent >= MESSAGES_PER_HOUR) return `You've sent ${MESSAGES_PER_HOUR} messages in the last hour. Please wait a bit and try again.`;
  if (used >= DAILY_TOKEN_LIMIT) return "You've reached today's usage limit. It resets at midnight UTC.";
  return null;
}
