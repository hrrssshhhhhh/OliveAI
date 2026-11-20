import { Suspense } from "react";
import EmailForm from "./EmailForm";
import GoogleButton from "./GoogleButton";
import { Logo } from "@/components/Sidebar";

export default function Login({ searchParams }: PageProps<"/login">) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="glass w-full max-w-[400px] animate-rise rounded-card p-7 sm:p-9">
        <Logo className="size-8" />
        <h1 className="mt-6 font-display text-[40px] leading-[1.05] tracking-[-0.02em] text-ink">Sign in to Olive</h1>
        <p className="mt-3 mb-8 text-[15px] leading-relaxed text-ink-2">Answers, code and live web search. Your chats are saved to your account.</p>
        <Suspense>
          <AuthError searchParams={searchParams} />
        </Suspense>
        <GoogleButton />
        <div className="my-6 flex items-center gap-4 text-xs text-ink-3">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>
        <EmailForm />
      </div>
    </main>
  );
}

const REASONS: Record<string, string> = {
  otp_expired: "That sign-in link has expired or was already used. Request a new one below.",
  flow_state_expired: "That sign-in link has expired. Request a new one below.",
  pkce_code_verifier_not_found: "Open the sign-in link in the same browser you requested it from (not your email app's built-in browser), or request a new one below.",
  flow_state_not_found: "That sign-in link was already used or replaced by a newer one. Use the latest email, or request a new link below.",
  access_denied: "Google sign-in was cancelled. Try again, or use your email below.",
  bad_code_verifier: "Open the sign-in link in the same browser you requested it from, or request a new one below.",
};

async function AuthError({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  if (typeof error !== "string") return null;
  return (
    <p role="alert" className="mb-5 rounded-row border border-danger/30 bg-danger/[0.06] px-3.5 py-2.5 text-sm text-danger">
      {REASONS[error] ?? "Sign-in didn't work. Request a new link below."}
      {!REASONS[error] && <span className="mt-1 block font-mono text-xs opacity-80">({error})</span>}
    </p>
  );
}
