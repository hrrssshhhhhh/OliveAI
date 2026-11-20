"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MODELS } from "@/lib/chat";
import type { Prefs } from "@/lib/prefs";

// Model + web search picker that lives in the composer. Opens upward as a smoked-glass panel.
export function ComposerSettings({ prefs, onChange }: { prefs: Prefs; onChange: (p: Partial<Prefs>) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const current = MODELS.find((m) => m.id === prefs.model) ?? MODELS[0];

  // close on outside click or Escape (focus goes back to the button)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      btnRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const row = "flex cursor-pointer items-center gap-3 rounded-row px-2.5 py-2 transition-colors duration-200 hover:bg-glass-3 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-accent";

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Chat settings: ${current.name} model, web search ${prefs.search ? "on" : "off"}`}
        title="Model and web search"
        className={`flex h-11 cursor-pointer items-center gap-1.5 rounded-[14px] px-3 text-[13px] transition-colors duration-200 ease-soft hover:bg-glass-3 hover:text-ink ${open ? "bg-glass-3 text-ink" : "text-ink-3"}`}
      >
        {prefs.search && (
          <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" /></svg>
        )}
        {current.name}
        <svg aria-hidden viewBox="0 0 24 24" className={`size-3 transition-transform duration-300 ease-soft ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 15 6-6 6 6" /></svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Chat settings"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.14 } }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            // solid, no blur: a backdrop-filter nested inside the composer glass makes Chrome ghost the text behind it
            className="absolute right-0 bottom-full z-30 mb-3 w-[min(18rem,calc(100vw-2.5rem))] origin-bottom-right rounded-card border border-line bg-[#131315] p-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_24px_48px_-16px_rgb(0_0_0/0.85)]"
          >
            <fieldset>
              <legend className="label px-2.5 pt-1.5 pb-2">Model</legend>
              {MODELS.map((m) => (
                <label key={m.id} className={row}>
                  <input type="radio" name="model" className="sr-only" checked={prefs.model === m.id} onChange={() => onChange({ model: m.id })} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">{m.name}</span>
                    <span className="mt-0.5 block text-xs text-ink-3">{m.hint}</span>
                  </span>
                  <svg aria-hidden viewBox="0 0 24 24" className={`size-4 shrink-0 text-accent transition-opacity duration-200 ${prefs.model === m.id ? "opacity-100" : "opacity-0"}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </label>
              ))}
            </fieldset>
            <div className="mx-2.5 my-2 h-px bg-line" />
            <label className={row}>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink">Web search</span>
                <span className="mt-0.5 block text-xs text-ink-3">Current info. Slower, uses more of the free limit.</span>
              </span>
              <input type="checkbox" role="switch" className="peer sr-only" checked={prefs.search} onChange={(e) => onChange({ search: e.target.checked })} />
              <span aria-hidden className="relative h-5 w-9 shrink-0 rounded-full border border-line bg-glass-4 transition-colors duration-200 peer-checked:border-accent/60 peer-checked:bg-accent/80 after:absolute after:top-0.5 after:left-0.5 after:size-3.5 after:rounded-full after:bg-ink after:transition-transform after:duration-300 after:ease-soft peer-checked:after:translate-x-4 peer-checked:after:bg-bg" />
            </label>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
