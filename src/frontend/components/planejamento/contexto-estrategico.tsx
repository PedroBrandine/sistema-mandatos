"use client";

import { useState } from "react";
import { Compass } from "lucide-react";

import type { PlanejamentoCompleto, PreditorPrioritarioLinha } from "@backend/queries/planejamento";

import type { PermissoesModo } from "./permissoes";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { DadosPlanejamentoForm } from "./dados-planejamento-form";

// PLR-01, PLR-05, PLR-06 (.specs/features/planejamento-estrategico-redesenho). Coluna
// esquerda ("contexto estratégico") do layout de 2 colunas. Colapsável via <details>
// nativo em vez de estado controlado pelo pai (design.md sugeria colapsado/onToggle) --
// simplificação deliberada: <details>/<summary> já resolve "colapsável por botão" (T8)
// E "vira accordion abaixo de 1024px" (T9) com a mesma marcação, sem JS extra e com
// semântica/teclado nativos. A grade (irmã, no grid do page.tsx) sempre ocupa o
// restante da largura via `1fr` -- nunca depende de saber se este componente está
// aberto ou fechado (regra inegociável: nenhum painel fixo à direita em nenhum estado).
export interface ContextoEstrategicoProps {
  planejamento: PlanejamentoCompleto;
  preditoresAtuais: PreditorPrioritarioLinha[];
  produtoNome: string;
  permissoes: PermissoesModo;
  onDadosAlterados: () => void;
}

export function ContextoEstrategico({
  planejamento,
  preditoresAtuais,
  produtoNome,
  permissoes,
  onDadosAlterados,
}: ContextoEstrategicoProps) {
  const [editando, setEditando] = useState(false);
  const preditoresOrdenados = [...preditoresAtuais].sort((a, b) => a.ordem - b.ordem);

  return (
    <details open className="w-full lg:w-[240px] lg:shrink-0">
      <summary className="flex cursor-pointer items-center gap-2 rounded-md py-2 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
        <Compass className="size-4 shrink-0 text-muted-foreground" />
        Contexto estratégico
      </summary>

      <div className="grid gap-4 border-t pt-3">
        {editando && permissoes.crudHierarquia ? (
          <DadosPlanejamentoForm
            planejamento={planejamento}
            preditoresAtuais={preditoresAtuais}
            produtoNome={produtoNome}
            onConcluido={() => {
              setEditando(false);
              onDadosAlterados();
            }}
          />
        ) : (
          <div className="grid gap-3 text-sm">
            <div className="grid gap-1">
              <p className="text-xs font-medium text-muted-foreground">Legado</p>
              <p className="text-foreground">{planejamento.legado ?? "—"}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-xs font-medium text-muted-foreground">Análise de conjuntura</p>
              <p className="text-foreground">{planejamento.analiseConjuntura ?? "—"}</p>
            </div>

            {preditoresOrdenados.length > 0 && (
              <div className="grid gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">Preditores prioritários</p>
                <div className="flex flex-wrap gap-1.5">
                  {preditoresOrdenados.map((p) => (
                    <Badge key={p.ordem} variant="outline">
                      {p.ordem}. {p.nomePreditor}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {permissoes.crudHierarquia && (
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setEditando(true)}>
                Editar dados do Planejamento
              </Button>
            )}

            {/* PLR-06: GIP (fat_gip/fat_gip_dimensao/vw_gip_evolucao) e' escopo ja
                desenhado de .specs/features/formularios-produto/ (FRM-15 a FRM-19) --
                nao provisionado ainda. Placeholder deliberado, nao dado inventado
                (AD-005) -- ver spec.md "Out of Scope". */}
            <div className="grid gap-1 rounded-md border border-dashed p-3">
              <p className="text-xs font-medium text-muted-foreground">GIP</p>
              <p className="text-xs text-muted-foreground">
                Em desenvolvimento — a régua × onde chegamos aparece aqui quando a feature de
                Formulários concluir o GIP.
              </p>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
