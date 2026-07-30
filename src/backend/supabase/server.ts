import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./database.types";

// Server-side Supabase client (Server Components/Actions/Route Handlers).
// Still the anon key, not service_role -- RLS + the papel_atual()/GRANT
// wiring from Fase 0 (T1-T5) is what scopes access per user, exactly like
// the browser client. Only the cookie bridge differs, so the session set by
// Supabase Auth on the client is readable server-side too.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component (no response to attach
            // Set-Cookie to) -- safe to ignore as long as middleware or a
            // Server Action elsewhere refreshes the session.
          }
        },
      },
    }
  );
}
