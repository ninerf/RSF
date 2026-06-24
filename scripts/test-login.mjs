import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const content = readFileSync(".env.local", "utf8");
for (const line of content.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  if (!(t.slice(0, eq).trim() in process.env))
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const username = process.env.SEED_ADMIN_USERNAME;
const password = process.env.SEED_ADMIN_PASSWORD;

const admin = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Step 1: profile lookup
const { data: profile, error: pErr } = await admin
  .from("profiles")
  .select("id")
  .eq("username", username)
  .single();
console.log("Step 1 profile:", profile, "err:", pErr?.message);
if (!profile) process.exit(1);

// Step 2: getUserById
const { data: userRes, error: uErr } =
  await admin.auth.admin.getUserById(profile.id);
console.log("Step 2 email:", userRes?.user?.email, "err:", uErr?.message);

// Step 3: signInWithPassword via anon client
const supabase = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { error: sErr } = await supabase.auth.signInWithPassword({
  email: userRes.user.email,
  password,
});
console.log("Step 3 signIn err:", sErr?.status, sErr?.message);
