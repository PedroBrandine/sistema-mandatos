import { CornerDownRight } from "lucide-react";

import { createClient } from "@backend/supabase/server";
import { buscarPapelGlobalAtual } from "@backend/queries/usuario";
import { buscarVisaoMandato } from "@backend/queries/numeros-impacto";
import { NaoAutorizado } from "@/components/app-shell/nao-autorizado";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVazio } from "@/components/ui/estado-vazio";

function formataData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

// SAI-05, SAI-06, SAI-07. Server Component -- mesmo gate de papel de
// /numeros-impacto (repetido aqui: rota acessível por URL direta, não só
// pelo clique a partir da listagem -- design.md "Components", spec.md
// P2.AC3). Timeline ordenada por ordemContrato (já vem ordenada de
// buscarVisaoMandato). idContratoAnterior != null desenha um conector
// visual acima do card (continuidade/renovação); sua ausência é o caso
// normal (contrato novo, não falha de dado) -- cards ficam visualmente
// separados por padrão (spec.md, Edge Cases).
//
// Fix F2 (validation.md, achado do Verifier): título/breadcrumb agora
// mostram o nome do contratante (vw_visao_mandato já trazia a coluna,
// buscarVisaoMandato só não a projetava) -- sem nome/nenhum contrato
// (contratante inexistente ou sem contrato) cai no <EstadoVazio> abaixo,
// título genérico "Visão do Mandato" como fallback.
export default async function VisaoMandatoPage({
  params,
}: {
  params: Promise<{ idContratante: string }>;
}) {
  const { idContratante } = await params;
  const client = await createClient();
  const papel = await buscarPapelGlobalAtual(client);

  if (papel === "mentor" || papel === "assessor") {
    return (
      <div className="mx-auto grid max-w-4xl gap-6 p-6">
        <NaoAutorizado />
      </div>
    );
  }

  const contratos = await buscarVisaoMandato(client, Number(idContratante));
  const nomeContratante = contratos[0]?.nomeContratante ?? null;

  return (
    <div className="mx-auto grid max-w-4xl gap-6 p-6">
      <Breadcrumbs
        items={[
          { label: "Números de Impacto", href: "/numeros-impacto" },
          { label: nomeContratante ?? "Visão do Mandato" },
        ]}
      />

      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">
          {nomeContratante ?? "Visão do Mandato"}
        </h1>
        <p className="text-xs text-muted-foreground">
          Linha do tempo consolidada dos contratos deste contratante, lida de{" "}
          <code className="font-mono">vw_visao_mandato</code>.
        </p>
      </div>

      {contratos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum contrato encontrado"
          mensagem="Este contratante ainda não possui contrato registrado."
        />
      ) : (
        <div className="grid gap-3">
          {contratos.map((contrato) => (
            <div key={contrato.idContrato} className="grid gap-2">
              {contrato.idContratoAnterior !== null && (
                <div className="flex items-center gap-2 pl-4 text-xs font-medium text-muted-foreground">
                  <CornerDownRight className="size-3.5 shrink-0" />
                  Continuação do contrato #{contrato.idContratoAnterior}
                </div>
              )}
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold">
                      #{contrato.ordemContrato} — {contrato.nomeProduto}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{contrato.nomeProjeto ?? "—"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {contrato.idContratoAnterior !== null && <Badge variant="secondary">Continuação</Badge>}
                    <Badge variant="outline">{contrato.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div className="grid gap-0.5">
                    <span className="text-muted-foreground">Cargo</span>
                    <span className="font-medium text-foreground">{contrato.cargoNoContrato ?? "—"}</span>
                  </div>
                  <div className="grid gap-0.5">
                    <span className="text-muted-foreground">Partido</span>
                    <span className="font-medium text-foreground">{contrato.partidoNoContrato ?? "—"}</span>
                  </div>
                  <div className="grid gap-0.5">
                    <span className="text-muted-foreground">Início</span>
                    <span className="font-mono text-foreground">{formataData(contrato.dtInicio)}</span>
                  </div>
                  <div className="grid gap-0.5">
                    <span className="text-muted-foreground">Fim</span>
                    <span className="font-mono text-foreground">
                      {contrato.dtFim ? formataData(contrato.dtFim) : "em andamento"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
