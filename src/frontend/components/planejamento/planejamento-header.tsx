"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";

import type { EtapaRegua } from "@backend/queries/etapa-contrato";
import type { PlanejamentoCompleto } from "@backend/queries/planejamento";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// PLR-02, PLR-03, PLR-04 (.specs/features/planejamento-estrategico-redesenho). Renderiza
// DENTRO de `children` de FichaContratoChrome, abaixo do h1/subtítulo/RouteTabs que o
// chrome já mostra, e só acrescenta o que é específico do Planejamento: a etapa atual
// (com atraso) e o alerta de percentuais desatualizados.
//
// Ajuste de fidelidade ao Figma, 2026-09-21 (57:671 tem UM cabeçalho: nome + subtítulo
// + botões, e logo abaixo as duas abas). Saíram daqui, por duplicarem o chrome: o
// breadcrumb "Contratante › Planejamento" (o chrome já tem título e "Voltar ao
// dashboard"), o h1 com o Objetivo do ano em Anton (esse texto já é o cartão "Objetivo
// do ano" da aba Diagnóstico) e o badge do Produto (já está no subtítulo do chrome).
//
// `etapaAtual` reaproveita vw_etapa_contrato via buscarReguaDoContrato
// (queries/etapa-contrato.ts, já usada por EtapaContratoPage) -- nenhuma query nova
// criada aqui; o cálculo de "qual etapa está em andamento" fica no chamador (page.tsx),
// este componente só exibe o que recebe.
//
// A faixa "Atingimento geral / Cobertura do ciclo / IIP" que vivia aqui SAIU em
// 2026-09-18 (Pedro, mesmo padrão do corte do GIP em contexto-estrategico.tsx):
// "Atingimento geral" duplicava a "Atingimento total do plano" que a T21
// (PlanejamentoKpis) traz para dentro da aba Construir a estrutura, com o
// mesmo pctAtingimento; "IIP: Em desenvolvimento" duplicava o IipCard real que
// já mora na aba Fatos Geradores e Registros (ficha-mandato-contrato,
// concorrente). "Cobertura do ciclo" era informação única e não tinha
// substituto no Figma (57:671/227:194) -- saiu junto, por decisão explícita.
export interface PlanejamentoHeaderProps {
  planejamento: PlanejamentoCompleto;
  etapaAtual: EtapaRegua | null;
  mesCicloAtual: string; // "YYYY-MM-01"
  onRecalcular: () => void | Promise<void>;
}

function formatarMesCiclo(isoData: string): string {
  const data = new Date(`${isoData}T00:00:00`);
  const texto = data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function PlanejamentoHeader({
  planejamento,
  etapaAtual,
  mesCicloAtual,
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

  // Nada a mostrar: não reserva espaço (o `gap` do pai criaria uma faixa vazia).
  if (!etapaAtual && !planejamento.atingimentoDesatualizado) return null;

  return (
    <div className="grid gap-3">
      {etapaAtual && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={etapaAtual.estaAtrasada ? "destructive" : "outline"}>
            {etapaAtual.nome} · {formatarMesCiclo(mesCicloAtual)}
            {etapaAtual.estaAtrasada && ` · ${etapaAtual.diasAtraso}d de atraso`}
          </Badge>
        </div>
      )}

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
  );
}
