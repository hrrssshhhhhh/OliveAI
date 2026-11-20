"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MotionConfig, motion } from "motion/react";
import { ComposerSettings } from "@/components/ComposerSettings";
import { CopyButton, Markdown } from "@/components/Markdown";
import { iconBtn, Logo, NewChatIcon, PanelIcon, Sidebar, type Conv } from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/client";
import { usePrefs } from "@/lib/prefs";
import { BUSY_TEXT, REFUSAL_TEXT, STREAM_BUSY, STREAM_FAILED, STREAM_REFUSED, type ChatMessage, type ModelId } from "@/lib/chat";

const ERROR = "Something went wrong, try again.";
const SUGGESTIONS = [
  { title: "Explain a concept", prompt: "Explain how HTTPS keeps my connection secure, in simple terms." },
  { title: "Write some code", prompt: "Write a TypeScript function that debounces another function, with a short usage example." },
  { title: "Help me write", prompt: "Draft a polite email asking my manager for a day off next Friday." },
  { title: "Catch up on the news", prompt: "What were the three biggest tech stories this week? One line each, with sources." },
];

// full reload on purpose: drops all chat state and lets proxy.ts re-check the session
// eslint-disable-next-line @next/next/no-location-assign-relative-destination
const toLogin = () => location.assign("/login");

type Settings = { model: ModelId; search: boolean };
type Body = ({ conversationId?: string; message: string } | { conversationId: string; regenerate: true }) & Settings;

export default function Home() {
  const [convs, setConvs] = useState<Conv[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<{ text: string; retry?: () => void } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [prefs, setPrefs] = usePrefs();
  const [settled, setSettled] = useState(0); // messages below this index were loaded, not sent: no entrance animation

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true); // auto-scroll only while user is at the bottom
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // latest chat id for async callbacks (a retry closure would otherwise see a stale id and start a new chat)
  const activeRef = useRef<string | null>(null);
  useEffect(() => { activeRef.current = activeId; }, [activeId]);

  const loadConvs = useCallback(() =>
    fetch("/api/conversations")
      .then((res) => (res.status === 401 ? toLogin() : res.ok ? res.json() : Promise.reject(res.status)))
      .then(setConvs, () => {
        setConvs((c) => c ?? []);
        setError({ text: "Couldn't load your chats. Refresh to try again." });
      }), []);

  useEffect(() => { loadConvs(); }, [loadConvs]);
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const title = convs?.find((c) => c.id === activeId)?.title;
  useEffect(() => { document.title = title ? `${title} · Olive` : "Olive"; }, [title]);

  function scrollToBottom() {
    stickRef.current = true;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }

  function newChat() {
    abortRef.current?.abort();
    setActiveId(null);
    activeRef.current = null;
    setMsgs([]);
    setSettled(0);
    setError(null);
    setAtBottom(true);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }

  async function openChat(id: string) {
    if (id === activeId) return setSidebarOpen(false);
    abortRef.current?.abort();
    setSidebarOpen(false);
    setError(null);
    setActiveId(id);
    activeRef.current = id;
    setMsgs([]);
    setAtBottom(true);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.status === 401) return toLogin();
      if (!res.ok) throw new Error();
      const data: { messages: ChatMessage[] } = await res.json();
      stickRef.current = true;
      setSettled(data.messages.length);
      setMsgs(data.messages.map(({ role, content }) => ({ role, content })));
    } catch {
      setError({ text: "Couldn't open this chat. Try again." });
    }
  }

  async function renameChat(id: string, newTitle: string) {
    const prev = convs;
    setConvs((c) => c?.map((x) => (x.id === id ? { ...x, title: newTitle } : x)) ?? c);
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    }).catch(() => null);
    if (!res?.ok) {
      setConvs(prev);
      setError({ text: "Couldn't rename the chat. Try again." });
    }
  }

  async function deleteChat(id: string) {
    const prev = convs;
    setConvs((c) => c?.filter((x) => x.id !== id) ?? c);
    if (id === activeId) newChat();
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setConvs(prev);
      setError({ text: "Couldn't delete the chat. Try again." });
    }
  }

  // Streams one assistant reply into the last message slot (already added by the caller).
  async function run(body: Body, retry: () => void) {
    setError(null);
    stickRef.current = true;
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    // Network chunks arrive in bursts; reveal them at a steady pace instead (each frame shows a share of
    // the backlog, so it never falls far behind). Text that looks like an end marker is held back so it never flashes.
    let reply = "";
    let shown = 0;
    let raf = 0;
    const render = (n: number) => setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: reply.slice(0, n) }]);
    const visibleEnd = () => {
      const marker = reply.lastIndexOf("\n\n[");
      return marker >= 0 && marker > reply.length - 64 ? marker : reply.length;
    };
    const pump = () => {
      const end = visibleEnd();
      if (shown < end) render((shown += Math.ceil((end - shown) / 6)));
      raf = requestAnimationFrame(pump);
    };
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (res.status === 401) return toLogin();
      if (res.status === 429) {
        const data = await res.json().catch(() => null);
        throw Object.assign(new Error("limited"), { friendly: data?.error ?? "You're sending messages too fast. Please wait a bit." });
      }
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const wasNew = !activeRef.current;
      const newId = res.headers.get("X-Conversation-Id");
      if (newId && newId !== activeRef.current) {
        setActiveId(newId);
        activeRef.current = newId;
        setConvs((c) => [{ id: newId, title: "New chat", createdAt: new Date().toISOString() }, ...(c ?? [])]);
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      raf = requestAnimationFrame(pump);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += value;
      }
      // let the reveal catch up (skipped in a background tab, where frames don't run), then show the exact text
      while (!document.hidden && shown < visibleEnd()) await new Promise(requestAnimationFrame);
      cancelAnimationFrame(raf);
      render(reply.length); // marker cases below overwrite this in the same render batch
      if (reply.endsWith(STREAM_REFUSED)) {
        // replace the whole bubble: a partial answer cut off by a refusal shouldn't look complete
        setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: REFUSAL_TEXT }]);
      } else if (reply.endsWith(STREAM_FAILED) || reply.endsWith(STREAM_BUSY)) {
        const busy = reply.endsWith(STREAM_BUSY);
        reply = reply.slice(0, -(busy ? STREAM_BUSY : STREAM_FAILED).length);
        setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: reply }]);
        throw Object.assign(new Error("server failed mid-stream"), { busy });
      }
      if (wasNew) loadConvs(); // pick up the generated title
    } catch (e) {
      cancelAnimationFrame(raf);
      if (reply) render(reply.length); // show everything that arrived before the stop/failure
      if (ctrl.signal.aborted) return; // user pressed Stop: keep partial reply as-is
      console.warn("chat failed:", e); // warn, not error: the alert already tells the user; error pops Next's dev overlay
      if (!reply) setMsgs((m) => m.slice(0, -1)); // drop empty bubble
      const friendly = (e as { friendly?: string }).friendly;
      const busy = (e as { busy?: boolean }).busy;
      setError(friendly ? { text: friendly } : { text: busy ? BUSY_TEXT : ERROR, retry });
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setStreaming(false);
      }
    }
  }

  function send(text: string) {
    text = text.trim();
    if (!text || streaming) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    run({ conversationId: activeRef.current ?? undefined, message: text, ...prefs }, () => {
      // remove the failed question so the retry doesn't show it twice
      setMsgs((m) => m.slice(0, Math.max(0, m.findLastIndex((x) => x.role === "user"))));
      send(text);
    });
  }

  function regenerate() {
    const id = activeRef.current;
    if (!id || streaming) return;
    setMsgs((m) => [...(m.at(-1)?.role === "assistant" ? m.slice(0, -1) : m), { role: "assistant", content: "" }]);
    run({ conversationId: id, regenerate: true, ...prefs }, regenerate);
  }

  const last = msgs.at(-1);
  const waiting = streaming && last?.role === "assistant" && !last.content;
  const empty = msgs.length === 0;

  const composer = (
    <form
      onSubmit={(e) => { e.preventDefault(); send(input); }}
      className="w-full"
    >
      {/* focus = an olive hairline faded in with opacity (no glow), so focusing never repaints the glass */}
      <div className="glass relative flex items-end gap-2 rounded-composer p-2 pl-5 before:pointer-events-none before:absolute before:-inset-px before:rounded-composer before:border before:border-accent/50 before:opacity-0 before:transition-opacity before:duration-300 before:ease-soft focus-within:before:opacity-100">
        <label htmlFor="msg" className="sr-only">Message</label>
        <textarea
          id="msg"
          ref={inputRef}
          rows={1}
          autoFocus
          value={input}
          maxLength={4000}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask anything"
          className="field-sizing-content max-h-52 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-base leading-6 text-ink outline-none placeholder:text-ink-3 focus-visible:outline-none"
        />
        <ComposerSettings prefs={prefs} onChange={setPrefs} />
        {streaming ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            aria-label="Stop generating"
            title="Stop generating"
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-[14px] bg-ink text-bg transition-colors duration-200 ease-soft hover:bg-white"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-3" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2.5" /></svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Send message"
            title="Send (Enter)"
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-[14px] bg-accent text-on-accent transition-[background-color,color] duration-300 ease-soft hover:bg-[#e2d0aa] disabled:cursor-not-allowed disabled:bg-glass-3 disabled:text-ink-3"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        )}
      </div>
    </form>
  );

  const errorBox = error && (
    <div role="alert" className="mt-6 flex animate-rise items-center justify-between gap-3 rounded-row border border-danger/30 bg-danger/[0.06] px-4 py-3 text-sm text-danger">
      <span>{error.text}</span>
      {error.retry && (
        <button
          onClick={() => error.retry!()}
          className="min-h-9 shrink-0 cursor-pointer rounded-ctl border border-danger/40 px-3 font-medium transition-colors duration-200 hover:bg-danger/10"
        >
          Try again
        </button>
      )}
    </div>
  );

  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 340, damping: 36 }}>
    <div className="relative flex h-dvh overflow-hidden text-ink">
      {sidebarOpen && (
        <button aria-label="Close sidebar" className="fixed inset-0 z-20 animate-fade cursor-pointer bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        convs={convs}
        activeId={activeId}
        open={sidebarOpen}
        collapsed={collapsed}
        email={email}
        onClose={() => setSidebarOpen(false)}
        onCollapse={() => setCollapsed(true)}
        onNew={newChat}
        onOpen={openChat}
        onRename={renameChat}
        onDelete={deleteChat}
        onSignOut={async () => { await createClient().auth.signOut(); toLogin(); }}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <motion.header layout="position" layoutDependency={collapsed} className="flex h-14 shrink-0 items-center gap-1 px-2 md:px-3">
          <button onClick={() => setSidebarOpen(true)} aria-label="Open sidebar" className={`${iconBtn} size-10 md:hidden`}>
            <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 8h16M4 16h10" /></svg>
          </button>
          {collapsed && (
            <div className="hidden animate-fade md:flex">
              <button onClick={() => setCollapsed(false)} aria-label="Show sidebar" title="Show sidebar" className={`${iconBtn} size-10`}>
                <PanelIcon />
              </button>
              <button onClick={newChat} aria-label="New chat" title="New chat" className={`${iconBtn} size-10`}>
                <NewChatIcon />
              </button>
            </div>
          )}
          <h1 key={title ?? ""} className="min-w-0 flex-1 animate-fade truncate px-2 font-display text-xl leading-none tracking-[-0.01em] text-ink">
            {title ?? ""}
          </h1>
          <button onClick={newChat} aria-label="New chat" className={`${iconBtn} size-10 md:hidden`}>
            <NewChatIcon />
          </button>
        </motion.header>

        {empty ? (
          // Empty chat: the mark, what Olive does (and whether search is on), the composer, a few starters
          <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-[10vh]">
            <motion.div layout="position" layoutDependency={collapsed} className="w-full max-w-2xl">
            <div className="animate-rise">
              <Logo className="size-8" />
              <h2 className="mt-6 font-display text-[40px] leading-[1.05] tracking-[-0.02em] text-balance sm:text-[52px]">
                From a line of code to today&rsquo;s news
              </h2>
              <p className="mt-3 mb-8 max-w-lg text-[15px] leading-relaxed text-pretty text-ink-2">
                {prefs.search
                  ? "Ask Olive anything. Web search is on, so answers can cover this week."
                  : "Ask Olive anything. Web search is off, so answers come from what the model already knows."}
              </p>
              {composer}
              <ul className="mt-8 border-t border-line">
                {SUGGESTIONS.map((s) => (
                  <li key={s.title} className="border-b border-line">
                    <button
                      onClick={() => send(s.prompt)}
                      className="group flex min-h-14 w-full cursor-pointer items-center gap-4 rounded-ctl px-1 py-3 text-left transition-colors duration-200 hover:bg-glass-1"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-ink">{s.title}</span>
                        <span className="mt-0.5 block truncate text-sm text-ink-3">{s.prompt}</span>
                      </span>
                      <svg aria-hidden viewBox="0 0 24 24" className="size-4 shrink-0 text-ink-3 transition-[transform,color] duration-300 ease-soft group-hover:translate-x-0.5 group-hover:text-ink" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
              {errorBox}
            </div>
            </motion.div>
          </div>
        ) : (
          <>
            <motion.div
              layoutScroll
              ref={scrollRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                stickRef.current = bottom;
                if (bottom !== atBottom) setAtBottom(bottom);
              }}
              className="flex-1 overflow-y-auto"
            >
              {/* keyed by chat: opening a chat fades it in once; messages added afterwards rise in one by one */}
              <motion.ol layout="position" layoutDependency={collapsed} key={activeId ?? "new"} className="mx-auto max-w-3xl animate-fade space-y-9 px-4 pt-6 pb-10 md:px-6" aria-live="polite">
                {msgs.map((m, i) => {
                  const isLast = i === msgs.length - 1;
                  const rise = i >= settled ? "animate-rise" : "";
                  return m.role === "user" ? (
                    <li key={i} className={`flex justify-end ${rise}`}>
                      <div className="edge max-w-[85%] whitespace-pre-wrap break-words rounded-bubble rounded-br-md border border-line bg-glass-2 px-4 py-2.5 leading-7 text-ink">
                        {m.content}
                      </div>
                    </li>
                  ) : (
                    <li key={i} className={`min-w-0 ${rise}`}>
                      {waiting && isLast ? (
                        <div className="flex h-7 items-center gap-2.5" role="status" aria-label="Assistant is thinking">
                          <Logo className="size-3.5 animate-breathe" />
                          <ThinkingLabel />
                        </div>
                      ) : (
                        <>
                          <Markdown text={m.content} />
                          {!(streaming && isLast) && m.content && (
                            <div className="mt-3 -ml-2 flex animate-fade gap-0.5">
                              <CopyButton iconOnly label="Copy response" getText={() => m.content} />
                              {isLast && activeId && (
                                <button onClick={regenerate} aria-label="Regenerate response" title="Regenerate" className={`${iconBtn} size-8`}>
                                  <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /></svg>
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </motion.ol>
              {error && <div className="mx-auto max-w-3xl px-4 pb-6 md:px-6">{errorBox}</div>}
            </motion.div>

            <motion.div layout="position" layoutDependency={collapsed} className="relative mx-auto w-full max-w-3xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
              {/* fade the transcript out under the floating composer */}
              <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-linear-to-t from-bg to-transparent" />
              {!atBottom && (
                <button
                  onClick={scrollToBottom}
                  aria-label="Scroll to latest message"
                  className="glass absolute -top-14 left-1/2 grid size-9 -translate-x-1/2 animate-fade cursor-pointer place-items-center rounded-full text-ink-2 transition-colors duration-200 hover:text-ink"
                >
                  <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
                </button>
              )}
              {composer}
              <p className="mt-2.5 text-center text-xs text-ink-3">
                Olive can make mistakes. Check important info.
              </p>
            </motion.div>
          </>
        )}
      </main>
    </div>
    </MotionConfig>
  );
}


const THINKING_WORDS = [
  "Thinking", "Pondering", "Considering", "Reading closely", "Connecting dots",
  "Weighing options", "Mulling it over", "Drafting", "Composing", "Polishing",
];

// Status word that changes every ~2s while waiting for the first token; each new word fades up into place.
// aria-hidden: the parent's role=status label is announced once instead of every word.
function ThinkingLabel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % THINKING_WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <span aria-hidden key={i} className="inline-block animate-rise text-sm text-ink-2">
      {THINKING_WORDS[i]}…
    </span>
  );
}


