"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Username-based accounts: synthesize a stable internal email so Supabase Auth
// (which is email-based) has something to key on. This email is never shown.
const INTERNAL_EMAIL_DOMAIN = "zillowfinder.internal";

function internalEmail(username: string) {
  return `${username.toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`;
}

const CreateUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Use letters, numbers, _ . - only"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "worker", "client"]),
  can_run_searches: z.boolean(),
});

export type ActionState = { error?: string; success?: string } | undefined;

export async function createUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = CreateUserSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    role: formData.get("role"),
    can_run_searches: formData.get("can_run_searches") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { username, password, role, can_run_searches } = parsed.data;
  const admin = createAdminClient();

  // Reject duplicate usernames up front for a clear message.
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existing) {
    return { error: "That username is already taken." };
  }

  // Check if an auth user with this internal email already exists
  // (can happen if a user was deleted but auth user wasn't fully cleaned up).
  const email = internalEmail(username);
  const { data: { users: existingAuthUsers } } = await admin.auth.admin.listUsers();
  const existingAuthUser = existingAuthUsers.find(u => u.email === email);
  
  if (existingAuthUser) {
    // Clean up orphaned auth user before creating new one
    await admin.auth.admin.deleteUser(existingAuthUser.id);
  }

  // Create the auth user with a confirmed synthetic email.
  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email: internalEmail(username),
      password,
      email_confirm: true,
      user_metadata: { username },
    },
  );

  if (createErr || !created.user) {
    return { error: createErr?.message ?? "Could not create user." };
  }

  // Create the matching profile row.
  const { error: profileErr } = await admin.from("profiles").insert({
    id: created.user.id,
    username,
    role,
    can_run_searches,
  });

  if (profileErr) {
    // Roll back the auth user so we don't orphan it.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "Could not create profile. Try again." };
  }

  revalidatePath("/users");
  return { success: `User "${username}" created.` };
}

export async function deleteUser(formData: FormData): Promise<void> {
  const admin_profile = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");

  if (!userId || userId === admin_profile.id) {
    // Never allow deleting yourself.
    return;
  }

  const admin = createAdminClient();
  // Deleting the auth user cascades to the profile (FK on delete cascade).
  await admin.auth.admin.deleteUser(userId);
  revalidatePath("/users");
}
