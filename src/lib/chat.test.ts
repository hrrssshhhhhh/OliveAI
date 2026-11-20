import { describe, expect, it } from "vitest";
import { BodySchema, MAX_HISTORY, TitleSchema, trimHistory, type ChatMessage } from "./chat";

const turns = (n: number): ChatMessage[] =>
  Array.from({ length: n }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));

describe("BodySchema", () => {
  it("accepts a new chat or an existing chat id", () => {
    expect(BodySchema.safeParse({ message: "hi" }).success).toBe(true);
    expect(BodySchema.safeParse({ message: "hi", conversationId: crypto.randomUUID() }).success).toBe(true);
  });
  it("accepts only allowlisted models and a boolean search flag", () => {
    expect(BodySchema.safeParse({ message: "hi", model: "openai/gpt-oss-20b", search: false }).success).toBe(true);
    expect(BodySchema.safeParse({ conversationId: crypto.randomUUID(), regenerate: true, model: "openai/gpt-oss-120b" }).success).toBe(true);
    expect(BodySchema.safeParse({ message: "hi", model: "some/expensive-model" }).success).toBe(false);
    expect(BodySchema.safeParse({ message: "hi", search: "yes" }).success).toBe(false);
  });
  it("accepts regenerate only for an existing chat", () => {
    expect(BodySchema.safeParse({ conversationId: crypto.randomUUID(), regenerate: true }).success).toBe(true);
    expect(BodySchema.safeParse({ regenerate: true }).success).toBe(false);
  });
  it("rejects empty, too-long, or bad-id input", () => {
    expect(BodySchema.safeParse({ message: "   " }).success).toBe(false);
    expect(BodySchema.safeParse({ message: "x".repeat(4001) }).success).toBe(false);
    expect(BodySchema.safeParse({ message: "hi", conversationId: "1" }).success).toBe(false);
    expect(BodySchema.safeParse(null).success).toBe(false);
  });
});

describe("TitleSchema", () => {
  it("trims and limits titles", () => {
    expect(TitleSchema.parse({ title: "  My chat " }).title).toBe("My chat");
    expect(TitleSchema.safeParse({ title: "" }).success).toBe(false);
    expect(TitleSchema.safeParse({ title: "x".repeat(61) }).success).toBe(false);
  });
});

describe("trimHistory", () => {
  it("keeps short histories as-is", () => {
    expect(trimHistory(turns(5))).toEqual(turns(5));
  });
  it("keeps the newest messages and starts with a user message", () => {
    const out = trimHistory(turns(25)); // m0..m24, last is user
    expect(out.length).toBeLessThanOrEqual(MAX_HISTORY);
    expect(out[0].role).toBe("user");
    expect(out.at(-1)!.content).toBe("m24");
  });
});
