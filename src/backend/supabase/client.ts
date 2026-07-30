import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";

// Browser-side Supabase client (Client Components). Reads only the two
// public, anon-scoped env vars -- never service_role (AD-009/AD-011): this
// file is bundled into client JS, so anything referenced here ships to the
// browser.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
