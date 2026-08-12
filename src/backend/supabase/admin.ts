import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

// Cliente service_role -- só pra uso server-only, e só nas exceções
// documentadas da AD-010 (lista fechada). Duas categorias de uso hoje:
// (1) dev-only, bloqueado por checagem de NODE_ENV -- app/admin/acesso/entrar/route.ts;
// (2) produção real, exceção AD-033 -- app/convite/[token]/{page.tsx,consumir/route.ts}
//     (criação de conta Auth pra Mentor/Assessor convidado, pré-sessão, sem
//     outro caminho possível). Nunca importar isto de um componente client,
//     nunca deixar alcançável a partir de código que não seja uma dessas
//     exceções explícitas (AD-009/AD-011).
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
