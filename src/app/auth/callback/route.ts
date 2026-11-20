import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Email sign-in links land here. Two shapes:
// - ?token_hash=&type=   email template uses {{ .TokenHash }} (recommended): works in any browser/device
// - ?code=...            default Supabase template (PKCE): only works in the browser that asked for the link
// Supabase itself may also send ?error_code=... (e.g. otp_expired) instead.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const fail = (reason: string) => NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);

  const upstream = searchParams.get("error_code") ?? searchParams.get("error");
  if (upstream) {
    console.error("auth callback: supabase sent", upstream, searchParams.get("error_description"));
    return fail(upstream);
  }

  const supabase = await createClient();
  const code = searchParams.get("code");
  const flowId = searchParams.get("sb_flow_id"); // picks the right verifier if several links were requested
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const { error } = tokenHash && type
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    : code
      ? await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
      : { error: { code: "missing_code", message: "no code or token_hash in link" } };

  if (!error) return NextResponse.redirect(`${origin}/`);
  console.error("auth callback failed:", error.code, error.message);
  return fail(error.code ?? "unknown");
}
