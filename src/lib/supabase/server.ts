import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requirePublicEnv } from "@/lib/env";

// Server client bound to the request's cookies, using the anon key. RLS still
// applies — this represents the logged-in user on the server. In Next.js 16
// `cookies()` is async and must be awaited.
export async function createClient() {
  const { url, anonKey } = requirePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // `setAll` was called from a Server Component. Safe to ignore when
          // cookie refreshing is handled by the proxy.
        }
      },
    },
  });
}
