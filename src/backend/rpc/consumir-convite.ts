import type { AuthError, PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";

export type ResultadoConsumo =
  | { tipo: "sucesso_logado" }
  | { tipo: "sucesso_sem_login" }
  | { tipo: "erro"; mensagem: string };

export interface ConsumirConviteDeps {
  /** service_role -- único cliente que consegue ler/escrever convite_contrato
   * pré-sessão e chamar Admin API (createUser). */
  admin: SupabaseClient<Database>;
  /** anon key, cookie-aware (createClient() de server.ts) -- só usado pro
   * signInWithPassword pós-criação, pra estabelecer a sessão do navegador. */
  server: SupabaseClient<Database>;
}

export interface ConsumirConviteParams {
  tokenHash: string;
  nome: string;
  senha: string;
}

function erroIndicaEmailJaRegistrado(erro: AuthError): boolean {
  // email_exists/user_already_exists: códigos estruturados do GoTrue
  // (node_modules/@supabase/auth-js/dist/main/lib/error-codes.d.ts). O
  // regex de mensagem é fallback defensivo -- melhor ser permissivo aqui
  // (tratar como retry legítimo) do que travar a pessoa numa falha parcial
  // real (design.md Error Handling Strategy).
  if (erro.code === "email_exists" || erro.code === "user_already_exists") return true;
  return /already.*(registered|exists)/i.test(erro.message);
}

function mensagemDeErroConsumo(erro: PostgrestError): string {
  switch (erro.code) {
    case "CNV02":
      return "Convite já utilizado.";
    case "CNV03":
      return "Convite expirado. Peça um novo à Gestora.";
    case "CNV01":
    case "CNV04":
      return "Convite inválido.";
    default:
      return "Erro ao processar convite.";
  }
}

// CVT-06/07/08/09. Orquestração do consumo do convite -- função de domínio,
// testável por injeção de dependência (design.md Components). O Route
// Handler (/convite/[token]/route.ts, T15) é um adaptador fino em volta
// desta função: extrai os parâmetros do POST e traduz o resultado em
// redirect.
//
// Ordem: (1) resolve o e-mail do convite; (2) decide se cria conta Auth --
// só quando dim_usuario ainda não existe pra esse e-mail, nunca quando já
// existe (nunca sobrescreve credencial de conta pré-estabelecida); (3)
// chama app.consumir_convite (T3), que valida tudo de novo no banco e faz a
// escrita atômica; (4) só tenta signInWithPassword quando o RPC confirma
// conta_nova=true -- é o único caso em que temos certeza de que foi esta
// chamada que definiu essa senha.
export async function consumirConvite(
  deps: ConsumirConviteDeps,
  params: ConsumirConviteParams
): Promise<ResultadoConsumo> {
  const { data: convite, error: erroConvite } = await deps.admin
    .from("convite_contrato")
    .select("email")
    .eq("token_hash", params.tokenHash)
    .maybeSingle();

  if (erroConvite) return { tipo: "erro", mensagem: "Erro ao processar convite." };
  if (!convite) return { tipo: "erro", mensagem: "Convite inválido." };

  const email = convite.email;

  const { data: usuarioExistente, error: erroUsuario } = await deps.admin
    .from("dim_usuario")
    .select("id_usuario")
    .eq("email", email)
    .maybeSingle();
  if (erroUsuario) return { tipo: "erro", mensagem: "Erro ao processar convite." };

  if (!usuarioExistente) {
    const { error: erroCreate } = await deps.admin.auth.admin.createUser({
      email,
      password: params.senha,
      email_confirm: true,
      user_metadata: { nome: params.nome },
    });
    if (erroCreate && !erroIndicaEmailJaRegistrado(erroCreate)) {
      return { tipo: "erro", mensagem: "Erro ao criar conta." };
    }
  }

  const { data, error } = await deps.admin
    .schema("app")
    .rpc("consumir_convite", { p_token_hash: params.tokenHash, p_nome: params.nome });

  if (error) return { tipo: "erro", mensagem: mensagemDeErroConsumo(error) };

  const { conta_nova: contaNova } = data as { id_usuario: number; conta_nova: boolean };

  if (!contaNova) {
    // Conta pré-existente -- nunca tenta logar com a senha submetida agora
    // (vetor de account-takeover se fizéssemos isso -- design.md Error
    // Handling Strategy).
    return { tipo: "sucesso_sem_login" };
  }

  // spec.md Edge Cases: "convidado já tem sessão ativa (ex.: Admin testando
  // o link) -- processar o convite normalmente, sem misturar com a sessão
  // corrente". signInWithPassword no client cookie-aware (`deps.server`)
  // troca a sessão do navegador -- se já existe uma sessão, NÃO tenta logar
  // (a conta e o vínculo já foram criados pelo RPC acima; só não assume a
  // sessão de quem enviou o request). Achado do Verifier independente
  // (validation.md): sem esta checagem, abrir o link logado como Admin
  // encerrava a sessão do Admin e a substituía pela do convidado.
  const { data: sessaoAtual } = await deps.server.auth.getUser();
  if (sessaoAtual.user) {
    return { tipo: "sucesso_sem_login" };
  }

  const { error: erroLogin } = await deps.server.auth.signInWithPassword({ email, password: params.senha });
  return erroLogin ? { tipo: "sucesso_sem_login" } : { tipo: "sucesso_logado" };
}
