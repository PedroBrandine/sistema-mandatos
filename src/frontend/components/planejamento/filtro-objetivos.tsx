"use client";

import type { ObjetivoComMetas } from "@backend/queries/planejamento";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { cn } from "@/lib/utils";

// PLV-11 (T22, .specs/features/planejamento-estrategico-v2/spec.md "P2: KPIs e
// filtro por Objetivo" AC3). Um cartão por Objetivo Específico -- clicar
// filtra a árvore para aquele Objetivo; clicar de novo no mesmo limpa o
// filtro (mesma toggle-semantics de FiltroDashboard). "Estado ativo" da AC3
// é o card estar selecionado como filtro corrente, não o status do Objetivo
// (ativo/pausado/descartado) -- o mockup 227:194 não distingue por status
// nos cartões de filtro, só por seleção.
//
// pct_atingimento reaproveita ObjetivoComMetas de buscarPlanejamentoCompleto
// -- nenhuma query nova. Célula NÃO usa CelulaCalculada (essa é a trava de
// edição do modal, PLR-10); aqui é leitura simples com barra, mesmo estilo do
// mockup.
export interface FiltroObjetivosProps {
  objetivos: ObjetivoComMetas[];
  idSelecionado: number | null;
  onSelecionar: (id: number | null) => void;
}

export function FiltroObjetivos({ objetivos, idSelecionado, onSelecionar }: FiltroObjetivosProps) {
  if (objetivos.length === 0) {
    return <EstadoVazio titulo="Nenhum Objetivo Específico para filtrar" />;
  }

  return (
    <div role="group" aria-label="Filtrar por Objetivo Específico" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {objetivos.map((objetivo) => {
        const selecionado = objetivo.idObjetivo === idSelecionado;
        return (
          <Card
            key={objetivo.idObjetivo}
            role="button"
            aria-pressed={selecionado}
            tabIndex={0}
            onClick={() => onSelecionar(selecionado ? null : objetivo.idObjetivo)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelecionar(selecionado ? null : objetivo.idObjetivo);
              }
            }}
            className={cn(
              "cursor-pointer transition-colors hover:bg-muted/50",
              selecionado && "border-secondary ring-1 ring-secondary"
            )}
          >
            <CardHeader>
              <CardTitle className="text-sm font-medium">{objetivo.descricao}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold tabular-nums">
                {objetivo.pctAtingimento != null ? `${objetivo.pctAtingimento}%` : "—"}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-secondary"
                  style={{ width: `${objetivo.pctAtingimento ?? 0}%` }}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
