import { createClient } from "@/lib/supabase/server";

// Always verify with Supabase (getUser), never trust the session cookie alone.
export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserId(): Promise<string | null> {
  return (await getUser())?.id ?? null;
}

// Admins are listed by email in ADMIN_EMAILS (comma-separated).
export function isAdmin(email: string | undefined) {
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!email && admins.includes(email.toLowerCase());
}
