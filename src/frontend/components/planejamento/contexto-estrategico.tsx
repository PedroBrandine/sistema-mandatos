"use client";

import { useState } from "react";
import { Compass } from "lucide-react";

import type { LinhaEvolucaoGip, PlanejamentoCompleto, PreditorPrioritarioLinha } from "@backend/queries/planejamento";

import type { PermissoesModo } from "./permissoes";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/ui/estado-vazio";

import { DadosPlanejamentoForm } from "./dados-planejamento-form";

// SAI-08, SAI-09, SAI-10. Ordem cronológica de exibição -- vw_gip_evolucao
// ordena por momento alfabeticamente (fim, inicio, meio), não cronológico;
// a UI reagrupa aqui na ordem certa antes de renderizar.
const ORDEM_MOMENTO = ["inicio", "meio", "fim"] as const;
const ROTULO_MOMENTO: Record<string, string> = { inicio: "Início", meio: "Meio", fim: "Fim" };
const ROTULO_SITUACAO: Record<string, string> = { atingiu: "Atingiu", proximo: "Próximo", distante: "Distante" };
const VARIANTE_SITUACAO: Record<string, "secondary" | "outline" | "destructive"> = {
  atingiu: "secondary",
  proximo: "outline",
  distante: "destructive",
};

function agrupaEvolucaoGipPorMomento(evolucaoGip: LinhaEvolucaoGip[]): [string, LinhaEvolucaoGip[]][] {
  const porMomento = new Map<string, LinhaEvolucaoGip[]>();
  for (const linha of evolucaoGip) {
    const lista = porMomento.get(linha.momento) ?? [];
    lista.push(linha);
    porMomento.set(linha.momento, lista);
  }
  return ORDEM_MOMENTO.filter((m) => porMomento.has(m)).map((m) => [m, porMomento.get(m)!]);
}

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
  evolucaoGip: LinhaEvolucaoGip[];
  produtoNome: string;
  permissoes: PermissoesModo;
  onDadosAlterados: () => void;
}

export function ContextoEstrategico({
  planejamento,
  preditoresAtuais,
  evolucaoGip,
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

            {/* SAI-08, SAI-09, SAI-10: substitui o placeholder PLR-06 (fechado por
                formularios-produto, T9 -- vw_gip_evolucao já existe) por leitura real,
                agrupada por momento (inicio/meio/fim). Contrato sem nenhuma aplicação
                de GIP mostra <EstadoVazio> (spec.md P3.AC3); momento só com
                reguaSonhos preenchido (onde_chegamos/gap/situacao null) mostra a
                explicação de "aspiração pactuada" em vez de "0"/traço genérico
                (spec.md P3.AC2, AD-005). */}
            <div className="grid gap-2 rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">GIP</p>
              {evolucaoGip.length === 0 ? (
                <EstadoVazio
                  titulo="Nenhuma aplicação de GIP ainda"
                  mensagem="A régua × onde chegamos aparece aqui assim que o contrato tiver ao menos uma aplicação."
                />
              ) : (
                <div className="grid gap-3">
                  {agrupaEvolucaoGipPorMomento(evolucaoGip).map(([momento, linhasDoMomento]) => {
                    const quadrante = linhasDoMomento.find((l) => l.quadrante !== null)?.quadrante ?? null;
                    return (
                      <div key={momento} className="grid gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground">{ROTULO_MOMENTO[momento] ?? momento}</p>
                          {quadrante && (
                            <Badge variant="outline" className="text-[10px]">
                              {quadrante}
                            </Badge>
                          )}
                        </div>
                        <div className="grid gap-1.5">
                          {linhasDoMomento.map((linha) => (
                            <div key={linha.dimensao} className="grid gap-0.5 text-xs">
                              <p className="font-medium text-foreground">{linha.nomeDimensao}</p>
                              <p className="text-muted-foreground">Régua dos Sonhos: {linha.reguaSonhos ?? "—"}</p>
                              {linha.ondeChegamos !== null ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-muted-foreground">
                                    Onde chegamos: {linha.ondeChegamos} (gap {linha.gap})
                                  </span>
                                  {linha.situacao && (
                                    <Badge variant={VARIANTE_SITUACAO[linha.situacao]} className="text-[10px]">
                                      {ROTULO_SITUACAO[linha.situacao]}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <p className="text-[11px] italic text-muted-foreground">
                                  Aspiração pactuada — ainda sem leitura de &quot;onde chegamos&quot;.
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
