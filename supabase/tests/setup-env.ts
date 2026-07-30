import { config } from "dotenv";
import { resolve } from "node:path";

// Loads repo-root .env.local so integration tests can reach the live
// sistema-mandatos-dev Supabase project (no local Docker stack available).
config({ path: resolve(process.cwd(), ".env.local"), quiet: true });
