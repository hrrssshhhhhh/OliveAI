"use client";

import { useState } from "react";

export type Conv = { id: string; title: string; createdAt: string };

type Props = {
  convs: Conv[] | null;
  activeId: string | null;
  open: boolean; // mobile drawer
  collapsed: boolean; // desktop
  email: string | null;
  onClose: () => void;
  onCollapse: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onSignOut: () => void;
};

const icon = "size-[18px] shrink-0";
export const iconBtn =
  "grid size-9 cursor-pointer place-items-center rounded-ctl text-ink-3 transition-colors duration-200 ease-soft hover:bg-glass-3 hover:text-ink";

// Today / Yesterday / Previous 7 days / Previous 30 days / Older, newest first (list is already sorted)
function groupByDate(convs: Conv[]) {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const day = 86_400_000;
  const label = (t: number) =>
    t >= startOfToday ? "Today"
    : t >= startOfToday - day ? "Yesterday"
    : t >= startOfToday - 7 * day ? "Previous 7 days"
    : t >= startOfToday - 30 * day ? "Previous 30 days"
    : "Older";
  const groups: { label: string; items: Conv[] }[] = [];
  for (const c of convs) {
    const l = label(new Date(c.createdAt).getTime());
    if (groups.at(-1)?.label !== l) groups.push({ label: l, items: [] });
    groups.at(-1)!.items.push(c);
  }
  return groups;
}

export function Sidebar(p: Props) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <aside
      aria-label="Chat history"
      // transform-only slide on both breakpoints. Desktop collapse: the panel becomes absolute (main reflows at once,
      // its columns glide via Motion) and slides out. "invisible" applies after the slide, so hidden = not focusable.
      className={`fixed inset-y-0 left-0 z-30 flex w-[272px] flex-col border-r border-line bg-[#0d0d0f]/90 backdrop-blur-xl transition-[transform,visibility] duration-[420ms] ease-soft md:z-10 md:bg-glass-1 md:backdrop-blur-none ${p.open ? "translate-x-0" : "-translate-x-full max-md:invisible"} ${p.collapsed ? "md:absolute md:-translate-x-full md:invisible" : "md:static md:visible md:translate-x-0"}`}
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-3">
        <span className="flex items-center gap-2 pl-1 font-display text-2xl leading-none tracking-[-0.01em]">
          <Logo />
          Olive
        </span>
        <button onClick={p.onClose} aria-label="Close sidebar" className={`${iconBtn} md:hidden`}>
          <svg aria-hidden viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        <button onClick={p.onCollapse} aria-label="Hide sidebar" title="Hide sidebar" className={`${iconBtn} hidden md:grid`}>
          <PanelIcon />
        </button>
      </div>

      <div className="px-3 pb-2">
        <button
          onClick={p.onNew}
          className="edge flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-row border border-line bg-glass-2 px-3 text-sm text-ink transition-[background-color,border-color] duration-200 ease-soft hover:border-line-strong hover:bg-glass-3"
        >
          <NewChatIcon />
          New chat
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {p.convs === null ? (
          <ul className="space-y-1 pt-2" aria-label="Loading chats">
            {[0, 1, 2, 3].map((i) => <li key={i} style={{ opacity: 1 - i * 0.2 }} className="sweep h-9 rounded-row bg-glass-2" />)}
          </ul>
        ) : p.convs.length === 0 ? (
          <p className="px-2.5 pt-3 text-sm leading-relaxed text-ink-3">Your conversations will appear here.</p>
        ) : (
          groupByDate(p.convs).map((g) => (
            <section key={g.label} className="mt-6 first:mt-3">
              <h2 className="label px-2.5 pb-2">{g.label}</h2>
              <ul className="space-y-0.5">
                {g.items.map((c) => (
                  <li key={c.id}>
                    {editing === c.id ? (
                      <RenameInput
                        initial={c.title}
                        onDone={(title) => {
                          setEditing(null);
                          if (title && title !== c.title) p.onRename(c.id, title);
                        }}
                      />
                    ) : (
                      <div className={`group relative flex items-center rounded-row transition-colors duration-200 ease-soft ${c.id === p.activeId ? "bg-glass-3 text-ink shadow-[inset_0_0_0_1px_var(--color-line)]" : "text-ink-2 hover:bg-glass-2 hover:text-ink"}`}>
                        <button
                          onClick={() => p.onOpen(c.id)}
                          aria-current={c.id === p.activeId ? "page" : undefined}
                          className="min-h-9 min-w-0 flex-1 cursor-pointer truncate rounded-row px-3 py-2 text-left text-sm"
                        >
                          {c.title}
                        </button>
                        {/* always visible on touch screens and the active row; on hover/focus otherwise */}
                        <div className={`flex shrink-0 pr-1 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 ${c.id === p.activeId ? "md:opacity-100" : ""}`}>
                          <button onClick={() => setEditing(c.id)} aria-label={`Rename "${c.title}"`} title="Rename" className={`${iconBtn} size-8`}>
                            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                          </button>
                          <button
                            onClick={() => confirm(`Delete "${c.title}"? This can't be undone.`) && p.onDelete(c.id)}
                            aria-label={`Delete "${c.title}"`}
                            title="Delete"
                            className={`${iconBtn} size-8 hover:text-danger`}
                          >
                            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 px-1">
          <span aria-hidden className="edge grid size-8 shrink-0 place-items-center rounded-full border border-line bg-glass-3 font-display text-base text-ink">
            {(p.email?.[0] ?? "?").toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-ink-2" title={p.email ?? undefined}>{p.email ?? "…"}</span>
          <button onClick={p.onSignOut} aria-label="Sign out" title="Sign out" className={iconBtn}>
            <svg aria-hidden viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

function RenameInput({ initial, onDone }: { initial: string; onDone: (title: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <input
      autoFocus
      aria-label="Chat title"
      value={value}
      maxLength={60}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => onDone(value.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") onDone(initial);
      }}
      className="min-h-9 w-full rounded-row border border-accent/50 bg-black/40 px-3 text-sm text-ink outline-none focus-visible:outline-none"
    />
  );
}

export function Logo({ className = "size-5" }: { className?: string }) {
  return (
    // the product's own glyph: one olive and a leaf, flat, one color. Also the signature dot elsewhere.
    <svg aria-hidden viewBox="0 0 24 24" className={`shrink-0 text-accent ${className}`} fill="currentColor">
      <ellipse cx="14.2" cy="14.6" rx="5.6" ry="7.4" transform="rotate(32 14.2 14.6)" />
      <path d="M10.9 7.7C9.6 4.7 6.6 3 2.9 3.4c.8 3.4 3.6 5.4 8 4.3Z" opacity=".75" />
    </svg>
  );
}

export function PanelIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></svg>
  );
}

export function NewChatIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={icon} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.4 2.6a2 2 0 0 1 3 3L12 15l-4 1 1-4Z" /></svg>
  );
}
