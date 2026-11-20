import { describe, expect, it } from "vitest";
import { parsePrefs } from "./prefs";

describe("parsePrefs", () => {
  it("defaults when nothing or garbage is stored", () => {
    expect(parsePrefs(null)).toEqual({ model: "openai/gpt-oss-120b", search: true });
    expect(parsePrefs("{not json")).toEqual({ model: "openai/gpt-oss-120b", search: true });
  });
  it("keeps valid values and drops unknown models / non-booleans", () => {
    expect(parsePrefs(JSON.stringify({ model: "openai/gpt-oss-20b", search: false }))).toEqual({ model: "openai/gpt-oss-20b", search: false });
    expect(parsePrefs(JSON.stringify({ model: "evil/model", search: "no" }))).toEqual({ model: "openai/gpt-oss-120b", search: true });
  });
});
