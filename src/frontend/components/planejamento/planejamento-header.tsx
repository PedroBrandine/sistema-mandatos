"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";

import type { ContratoParaFicha } from "@backend/queries/contrato";
import type { EtapaRegua } from "@backend/queries/etapa-contrato";
import type { PlanejamentoCompleto } from "@backend/queries/planejamento";

import type { PermissoesModo } from "./permissoes";

import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";

// PLR-02, PLR-03, PLR-04 (.specs/features/planejamento-estrategico-redesenho). Cabeçalho
// novo da tela -- renderiza DENTRO de `children` de FichaContratoChrome, abaixo do
// h1/subtítulo/RouteTabs que o chrome já mostra (design.md "Achado de Design"): não
// duplica a identidade Contratante/Produto, só acrescenta o que é específico do
// Planejamento. Breadcrumb curto ("Contratante › Planejamento"), não o trail inteiro.
//
// `etapaAtual` reaproveita vw_etapa_contrato via buscarReguaDoContrato
// (queries/etapa-contrato.ts, já usada por EtapaContratoPage) -- nenhuma query nova
// criada aqui; o cálculo de "qual etapa está em andamento" fica no chamador (page.tsx),
// este componente só exibe o que recebe. `cobertura`/`mesCicloAtual` idem: computados
// pelo chamador a partir de dados já carregados (buscarGradeSucessosMensais).
//
// `permissoes.veIip` controla o indicador de IIP -- sempre placeholder fixo nesta
// feature (IIP funcional é Out of Scope, spec.md -- dono é incidencia-encontros
// T16-T35). Como só gestora/mentor/admin têm veIip=true, o indicador já fica ausente
// para assessor sem lógica extra (Success Criteria "papel assessor: sem IIP").
export interface PlanejamentoHeaderProps {
  planejamento: PlanejamentoCompleto;
  contrato: ContratoParaFicha;
  etapaAtual: EtapaRegua | null;
  mesCicloAtual: string; // "YYYY-MM-01"
  cobertura: { n: number; N: number };
  permissoes: PermissoesModo;
  onRecalcular: () => void | Promise<void>;
}

function formatarMesCiclo(isoData: string): string {
  const data = new Date(`${isoData}T00:00:00`);
  const texto = data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function PlanejamentoHeader({
  planejamento,
  contrato,
  etapaAtual,
  mesCicloAtual,
  cobertura,
  permissoes,
  onRecalcular,
}: PlanejamentoHeaderProps) {
  const [recalculando, setRecalculando] = useState(false);

  async function handleRecalcular() {
    setRecalculando(true);
    try {
      await onRecalcular();
    } finally {
      setRecalculando(false);
    }
  }

  const percentual = planejamento.pctAtingimento;

  return (
    <div className="grid gap-4">
      <Breadcrumbs
        items={[
          { label: contrato.nomeContratante, href: `/contratos/${contrato.idContrato}` },
          { label: "Planejamento" },
        ]}
      />

      <div className="grid gap-3">
        <h1 className="font-heading text-xl font-semibold text-foreground">
          {planejamento.objetivoAno ?? "Planejamento Estratégico"}
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{contrato.nomeProduto}</Badge>
          {contrato.tipoContratante === "coalizao" && <Badge variant="secondary">Coalizão</Badge>}
          {contrato.tipoContratante === "coalizao" && contrato.nomeProjetoOrigem && (
            <Badge variant="outline">Projeto: {contrato.nomeProjetoOrigem}</Badge>
          )}
          {etapaAtual && (
            <Badge variant={etapaAtual.estaAtrasada ? "destructive" : "outline"}>
              {etapaAtual.nome} · {formatarMesCiclo(mesCicloAtual)}
              {etapaAtual.estaAtrasada && ` · ${etapaAtual.diasAtraso}d de atraso`}
            </Badge>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Atingimento geral</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {percentual != null ? `${percentual}%` : "—"}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${percentual ?? 0}%` }} />
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Cobertura do ciclo</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {cobertura.n}/{cobertura.N}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Sucessos Mensais preenchidos</p>
          </div>

          {permissoes.veIip && (
            <div className="rounded-lg border border-dashed p-3">
              <p className="text-xs text-muted-foreground">IIP</p>
              <p className="mt-1 text-sm text-muted-foreground">Em desenvolvimento</p>
            </div>
          )}
        </div>

        {planejamento.atingimentoDesatualizado && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <TriangleAlert className="size-4 shrink-0" />
              <span>Os percentuais de Meta/Objetivo estão desatualizados desde a última edição.</span>
            </div>
            <Button type="button" size="sm" onClick={handleRecalcular} disabled={recalculando}>
              {recalculando ? "Recalculando..." : "Recalcular agora"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
