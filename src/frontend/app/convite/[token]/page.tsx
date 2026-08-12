import { headers } from "next/headers";
import type { ReactNode } from "react";

import { hashToken } from "@backend/lib/convite-token";
import { buscarContratoParaFicha } from "@backend/queries/contrato";
import { checarRateLimitConvite, validarConvite } from "@backend/queries/convite";
import { createAdminClient } from "@backend/supabase/admin";

import { ConviteConsumoForm } from "@/components/convite-consumo-form";

// CVT-09/10. Página pré-sessão -- fora do route group (app)/ (AD-027), sem
// sidebar. Sempre via createAdminClient() (service_role): pré-sessão não tem
// app.id_usuario, então a RLS de convite_contrato bloquearia qualquer outro
// cliente. Rate limit checado ANTES do lookup do token (CVT-10) -- "antes de
// consultar o banco" no spec.md quer dizer antes de consultar
// convite_contrato especificamente, não literalmente sem tocar o banco (o
// próprio rate limit é Postgres -- não há outra infra de estado no projeto,
// design.md Tech Decisions).
function extrairIp(cabecalhos: Headers): string {
  const encaminhado = cabecalhos.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return "0.0.0.0";
}

export default async function ConvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { token } = await params;
  const { erro: erroSubmissao } = await searchParams;

  const cabecalhos = await headers();
  const ip = extrairIp(cabecalhos);

  const admin = createAdminClient();

  const permitido = await checarRateLimitConvite(admin, ip);
  if (!permitido) {
    return (
      <Mensagem titulo="Muitas tentativas">
        Tente novamente em alguns minutos.
      </Mensagem>
    );
  }

  const tokenHash = await hashToken(token);
  const estado = await validarConvite(admin, tokenHash);

  // Checar `!== "valido"` (em vez de checar cada estado negativo em `if`s
  // separados) é o que deixa o TypeScript narrowar `estado` pro membro
  // "valido" da union depois deste bloco -- só ele tem idContrato/papelNoContrato.
  if (estado.estado !== "valido") {
    const mensagens: Record<Exclude<typeof estado.estado, "valido">, { titulo: string; corpo: string }> = {
      invalido: { titulo: "Convite inválido", corpo: "Verifique o link recebido." },
      expirado: { titulo: "Convite expirado", corpo: "Peça um novo convite à Gestora responsável." },
      usado: { titulo: "Convite já utilizado", corpo: "Este link já foi usado para criar um acesso." },
    };
    const { titulo, corpo } = mensagens[estado.estado];
    return <Mensagem titulo={titulo}>{corpo}</Mensagem>;
  }

  const contrato = await buscarContratoParaFicha(admin, estado.idContrato);

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-xl font-semibold">Criar acesso</h1>
        {contrato && (
          <p className="mb-6 text-sm text-muted-foreground">
            Você foi convidado como <strong>{estado.papelNoContrato}</strong> pra {contrato.nomeContratante}
            {contrato.nomeProduto ? ` (${contrato.nomeProduto})` : ""}.
          </p>
        )}
        {erroSubmissao && (
          <p role="alert" className="mb-4 text-sm text-red-500">
            {erroSubmissao}
          </p>
        )}
        <ConviteConsumoForm token={token} />
      </div>
    </div>
  );
}

function Mensagem({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="mb-2 text-xl font-semibold">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
