import { z } from "zod";

export const MAX_HISTORY = 20; // messages sent to the model per request; older ones are dropped to cap cost

// Models the user may pick (Groq ids). The server only accepts these, so the browser can't request anything else.
export const MODELS = [
  { id: "openai/gpt-oss-120b", name: "Thorough", hint: "Best answers · gpt-oss-120b" },
  { id: "openai/gpt-oss-20b", name: "Swift", hint: "Faster replies · gpt-oss-20b" },
] as const;
export type ModelId = (typeof MODELS)[number]["id"];

// Per-request settings from the composer; both optional so older clients keep working
const Settings = {
  model: z.enum(MODELS.map((m) => m.id) as [ModelId, ...ModelId[]]).optional(),
  search: z.boolean().optional(), // web search; default on
};

// What the browser sends: only the new message + which chat it belongs to (history comes from the DB)
export const BodySchema = z.union([
  z.object({
    conversationId: z.uuid().optional(), // missing = start a new chat
    message: z.string().trim().min(1).max(4000),
    ...Settings,
  }),
  // re-answer the last user message of an existing chat
  z.object({ conversationId: z.uuid(), regenerate: z.literal(true), ...Settings }),
]);

export const TitleSchema = z.object({ title: z.string().trim().min(1).max(60) });

export type ChatMessage = { role: "user" | "assistant"; content: string };

// Keep the last MAX_HISTORY messages; the model needs the first one to be from the user
export function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  const recent = messages.slice(-MAX_HISTORY);
  return recent[0]?.role === "assistant" ? recent.slice(1) : recent;
}

// Markers the chat route appends to the text stream; the browser strips them and shows a message instead.
export const STREAM_FAILED = "\n\n[Couldn't get a reply. Please try again.]";
export const STREAM_REFUSED = "\n\n[REFUSED]";
export const STREAM_BUSY = "\n\n[BUSY]"; // Groq rate limit (free tier: tokens per minute)
export const BUSY_TEXT = "The AI is busy right now (free-tier limit). Please wait a minute and try again.";
export const REFUSAL_TEXT = "Sorry, I can't help with that request. Try rephrasing it or ask about something else.";
