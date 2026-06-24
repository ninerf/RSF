"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const LoginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginState = { error?: string } | undefined;

// Usernames don't have real emails; we synthesize a stable internal email when
// creating users. Login resolves username -> user id (service role), looks up
// that synthetic email, then signs in with the anon client so the session
// cookie is set for the browser.
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a username and password." };
  }

  const { username, password } = parsed.data;

  // Resolve username -> profile -> auth user (server-side, service role).
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .single();

  if (!profile) {
    return { error: "Invalid username or password." };
  }

  const { data: userRes, error: userErr } =
    await admin.auth.admin.getUserById(profile.id);

  if (userErr || !userRes.user?.email) {
    return { error: "Invalid username or password." };
  }

  // Sign in with the request-bound anon client so the session cookie is set.
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: userRes.user.email,
    password,
  });

  if (error) {
    return { error: "Invalid username or password." };
  }

  redirect("/dashboard");
}
