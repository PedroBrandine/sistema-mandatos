import { config } from "dotenv";
import { resolve } from "node:path";

import { createAdminClient } from "../src/backend/supabase/admin.ts";

// AD-026: provisiona uma senha compartilhada em lote pra equipe
// @legislabrasil.org via service_role, sem depender de e-mail (rate limit
// do plano free da Supabase, ~2/h). Roda só local -- nunca expor isto como
// rota HTTP, service_role não pode viajar pra nenhum bundle de cliente
// (AD-009). Reaproveita createAdminClient de src/backend/supabase/admin.ts.
config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const [password, ...rawEmails] = process.argv.slice(2);

if (!password || rawEmails.length === 0) {
  console.error(
    "Uso: npm run provisionar-senhas -- <senha> <email1> [email2] [...]"
  );
  process.exit(1);
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY em .env.local"
  );
  process.exit(1);
}

const admin = createAdminClient();

// listUsers() desta versão do supabase-js só pagina (page/perPage), não
// filtra por e-mail -- paginamos até achar ou esgotar as páginas.
async function encontrarUsuarioPorEmail(email: string) {
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < perPage) return null;
  }
}

const criados: string[] = [];
const redefinidos: string[] = [];
const recusados: string[] = [];

for (const rawEmail of rawEmails) {
  const email = rawEmail.trim().toLowerCase();

  if (!email.endsWith("@legislabrasil.org")) {
    console.error(`Recusado: "${email}" não é @legislabrasil.org.`);
    recusados.push(email);
    continue;
  }

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!createError) {
    criados.push(email);
    continue;
  }

  if (createError.code !== "email_exists") {
    console.error(`Erro ao criar "${email}": ${createError.message}`);
    recusados.push(email);
    continue;
  }

  const existente = await encontrarUsuarioPorEmail(email);

  if (!existente) {
    console.error(
      `Erro: "${email}" reportado como já existente, mas não encontrado em auth.users`
    );
    recusados.push(email);
    continue;
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(existente.id, {
    password,
  });

  if (updateError) {
    console.error(`Erro ao redefinir senha de "${email}": ${updateError.message}`);
    recusados.push(email);
    continue;
  }

  redefinidos.push(email);
}

console.log("\nResumo:");
console.log(`  Criados (${criados.length}): ${criados.join(", ") || "-"}`);
console.log(`  Redefinidos (${redefinidos.length}): ${redefinidos.join(", ") || "-"}`);
console.log(`  Recusados (${recusados.length}): ${recusados.join(", ") || "-"}`);
console.log(`\nSenha: ${password}\n`);
