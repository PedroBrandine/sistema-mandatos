import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

// Cliente service_role -- só pra uso server-only, e só a partir de código já
// bloqueado a `next dev` local (ver checagem de NODE_ENV em
// app/admin/acesso/entrar/route.ts). Nunca importar isto de um componente
// client, nunca deixar alcançável a partir de uma build de produção (AD-009/AD-011).
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
