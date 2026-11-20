import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { TitleSchema } from "@/lib/chat";
import { getUserId } from "@/lib/user";

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => Response.json({ error: "Not found" }, { status: 404 });

// Every query is scoped to this user, so one user can never touch another's chat.
// Returns null for ids that aren't uuids (Postgres would throw on them).
async function mine(ctx: Ctx) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return null;
  const userId = await getUserId();
  if (!userId) return null;
  return and(eq(conversations.id, id), eq(conversations.userId, userId));
}

// Open a chat: title + all its messages in order
export async function GET(_req: Request, ctx: Ctx) {
  const where = await mine(ctx);
  if (!where) return notFound();
  const [conv] = await db.select().from(conversations).where(where);
  if (!conv) return notFound();
  const msgs = await db
    .select({ role: messages.role, content: messages.content, createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(asc(messages.createdAt), asc(messages.id));
  return Response.json({ id: conv.id, title: conv.title, createdAt: conv.createdAt, messages: msgs });
}

// Rename
export async function PATCH(req: Request, ctx: Ctx) {
  const where = await mine(ctx);
  if (!where) return notFound();
  const parsed = TitleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  const done = await db.update(conversations).set({ title: parsed.data.title }).where(where)
    .returning({ id: conversations.id });
  return done.length ? Response.json({ ok: true }) : notFound();
}

// Delete (its messages go too, via ON DELETE CASCADE)
export async function DELETE(_req: Request, ctx: Ctx) {
  const where = await mine(ctx);
  if (!where) return notFound();
  const done = await db.delete(conversations).where(where).returning({ id: conversations.id });
  return done.length ? Response.json({ ok: true }) : notFound();
}
