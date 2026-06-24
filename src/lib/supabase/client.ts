"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requirePublicEnv } from "@/lib/env";

// Browser client — uses the anon key only. All data access is constrained by
// Row Level Security. Never put the service role key here.
export function createClient() {
  const { url, anonKey } = requirePublicEnv();
  return createBrowserClient(url, anonKey);
}
