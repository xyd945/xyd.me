import type { SupabaseClient } from "@supabase/supabase-js";

export async function requestEmailCode(client: SupabaseClient, email: string) {
  const address = email.trim();
  const { error } = await client.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } });
  if (error) throw error;
  return address;
}

export async function verifyEmailCode(client: SupabaseClient, email: string, token: string) {
  if (!/^[0-9]{6}$/.test(token)) throw new Error("Enter the six-digit code from your email.");
  const { error } = await client.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
}
