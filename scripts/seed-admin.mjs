// Seeds the first admin account from env vars. Idempotent: re-running won't
// create duplicates. Run with: npm run seed
//
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//           SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Minimal .env.local loader (no dotenv dependency).
function loadEnv(file) {
  try {
    const content = readFileSync(file, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // No .env.local — rely on the ambient environment.
  }
}

loadEnv(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const username = process.env.SEED_ADMIN_USERNAME;
const password = process.env.SEED_ADMIN_PASSWORD;

if (!url || !serviceRoleKey || !username || !password) {
  console.error(
    "Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD.",
  );
  process.exit(1);
}

const INTERNAL_EMAIL_DOMAIN = "zillowfinder.internal";
const email = `${username.toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`;

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Already seeded?
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existing) {
    console.log(`Admin "${username}" already exists. Nothing to do.`);
    return;
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    },
  );

  if (createErr || !created.user) {
    console.error("Failed to create auth user:", createErr?.message);
    process.exit(1);
  }

  const { error: profileErr } = await admin.from("profiles").insert({
    id: created.user.id,
    username,
    role: "admin",
    can_run_searches: true,
  });

  if (profileErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    console.error("Failed to create profile:", profileErr.message);
    process.exit(1);
  }

  console.log(`Seeded admin "${username}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
