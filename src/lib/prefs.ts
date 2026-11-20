import { useMemo, useSyncExternalStore } from "react";
import { MODELS, type ModelId } from "./chat";

// Composer settings, remembered per browser. Falls back to memory when storage is blocked (private mode etc.).
export type Prefs = { model: ModelId; search: boolean };

const KEY = "olive.prefs";
const DEFAULTS: Prefs = { model: MODELS[0].id, search: true };
const listeners = new Set<() => void>();
let memory: string | null = null;

function read() {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb); // other tabs
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

// stored value is untrusted (old versions, hand edits): keep only known models and real booleans
export function parsePrefs(raw: string | null): Prefs {
  try {
    const p = JSON.parse(raw ?? "{}");
    return {
      model: MODELS.some((m) => m.id === p?.model) ? p.model : DEFAULTS.model,
      search: typeof p?.search === "boolean" ? p.search : DEFAULTS.search,
    };
  } catch {
    return DEFAULTS;
  }
}

export function usePrefs() {
  const raw = useSyncExternalStore(subscribe, read, () => null); // server renders defaults
  const prefs = useMemo(() => parsePrefs(raw), [raw]);
  const update = (patch: Partial<Prefs>) => {
    memory = JSON.stringify({ ...prefs, ...patch });
    try {
      localStorage.setItem(KEY, memory);
    } catch {}
    listeners.forEach((l) => l());
  };
  return [prefs, update] as const;
}
