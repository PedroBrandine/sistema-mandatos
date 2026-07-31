import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// Bypass temporário (decisão de sessão) pro rate limit de e-mail do plano
// free da Supabase (~2/h): gera o link de acesso via admin.generateLink
// (service_role) em vez de esperar signInWithOtp mandar e-mail. Roda só
// local -- nunca expor isto como rota HTTP, service_role não pode viajar
// pra nenhum bundle de cliente (AD-009).
//
// O link é montado manualmente com token_hash + type, no mesmo formato que
// src/frontend/app/auth/confirm/route.ts já sabe verificar (supabase.auth.verifyOtp),
// em vez do action_link hospedado pela Supabase (que usa outro fluxo, hash
// fragment / implicit grant, que este app não trata).
//
// type vem de data.properties.verification_type, não é sempre "magiclink":
// pra um e-mail que ainda não existe em auth.users, generateLink cria o
// usuário e o token é emitido como verification_type="signup" (mesmo
// pedindo type: "magiclink" na chamada) -- hardcodar "magiclink" no link
// faz verifyOtp rejeitar como "invalid or expired" pra todo primeiro login.
config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const DEFAULT_SITE_URL = "https://sistema-mandatos-pedrobrandine-5642-legisla.vercel.app";

const email = process.argv[2]?.trim().toLowerCase();
const siteUrl = (process.argv[3] ?? process.env.GERAR_LINK_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, "");

if (!email) {
  console.error("Uso: npm run gerar-link-acesso -- <email> [site_url]");
  process.exit(1);
}

if (!email.endsWith("@legislabrasil.org")) {
  // admin.generateLink({ type: 'magiclink' }) cria o usuário em auth.users
  // se ele não existir, igual signInWithOtp com shouldCreateUser=true --
  // aqui não há esse parâmetro pra desligar. Fora do domínio isso pula o
  // gate que login-form.tsx aplica hoje (só @legislabrasil.org se
  // autoprovisiona -- migração 0018), então recusamos por padrão.
  console.error(
    `Recusado: "${email}" não é @legislabrasil.org. Fora desse domínio, dim_usuario ` +
      "precisa já existir (cadastrado por Gestora/Admin) antes de gerar o link -- " +
      "edite o script conscientemente se for esse o caso."
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey);

const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });

if (error || !data) {
  console.error("Erro ao gerar link:", error?.message ?? "resposta vazia");
  process.exit(1);
}

const link = `${siteUrl}/auth/confirm?token_hash=${data.properties.hashed_token}&type=${data.properties.verification_type}&next=/`;

console.log(`\nLink de acesso para ${email} (expira em 1h, uso único):\n${link}\n`);
