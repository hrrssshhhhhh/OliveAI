"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Passwordless: Supabase emails a sign-in link; new emails get an account automatically.
export default function EmailForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      console.warn("sign-in failed:", error.message);
      setError(error.status === 429
        ? "Too many sign-in emails were sent. Please wait a few minutes and try again."
        : "Couldn't send the sign-in email. Check the address and try again.");
      setStatus("idle");
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className="animate-rise rounded-row border border-accent/25 bg-accent/[0.06] px-4 py-3.5 text-sm text-ink">
        <p className="label text-accent">Check your email</p>
        <p className="mt-2 leading-relaxed text-ink-2">We sent a sign-in link to <strong className="font-medium text-ink">{email.trim()}</strong>. Open it in this browser to continue.</p>
        <button onClick={() => setStatus("idle")} className="mt-3 cursor-pointer text-accent underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent">Use a different email</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="email" className="label block">Email</label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="min-h-12 w-full rounded-row border border-line bg-black/30 px-3.5 text-base text-ink outline-none transition-colors duration-200 ease-soft placeholder:text-ink-3 hover:border-line-strong focus:border-accent/70 focus-visible:outline-none"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="min-h-12 w-full cursor-pointer rounded-row bg-ink px-4 text-sm font-medium text-bg transition-[background-color,opacity] duration-200 ease-soft hover:bg-white disabled:cursor-wait disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>
  );
}
