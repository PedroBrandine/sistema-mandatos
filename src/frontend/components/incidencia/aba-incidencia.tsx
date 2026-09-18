"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// FGC-14/FGC-16 (T22, fatos-geradores-ciclo-vida). Casca da rota
// `/contratos/[id]/fatos-registros` -- alterna Linha do Tempo / Ciclo de
// Vida por querystring (`?visao=`), MESMA FORMA de
// `components/planejamento/planejamento-abas.tsx` (não o componente em si,
// que é específico de Planejamento): duas visões na mesma rota, trocar não
// pode remontar o estado já carregado (timeline/cadeias), por isso
// `router.replace` sem entrada no histórico, não o `RouteTabs` do app-shell
// (que troca de rota de verdade).
//
// "Criar" recebe os itens já prontos (rótulo + conteúdo) do chamador (T25) --
// AbaIncidencia não importa RegistroForm/InsightForm/PreInsightForm/
// FatoGeradorWizard diretamente, só compõe. Sem componente de dropdown no
// design system (nenhum `ui/dropdown-menu.tsx`): um botão por item, mesmo
// padrão hoje em `ficha-contrato-chrome.tsx` (Registrar Insight / Registrar
// Fato Gerador como botões irmãos, cada um abre seu próprio Dialog).
export type AbaVisao = "linha-do-tempo" | "ciclo-de-vida";

export const VISAO_PADRAO: AbaVisao = "linha-do-tempo";
export const PARAM_VISAO = "visao";

export function normalizaVisao(valor: string | null | undefined): AbaVisao {
  return valor === "ciclo-de-vida" ? "ciclo-de-vida" : VISAO_PADRAO;
}

export interface ItemCriar {
  rotulo: string;
  // Render-prop, não `ReactNode` puro (achado de T25): o formulário precisa
  // fechar O PRÓPRIO diálogo ao concluir (mesmo comportamento hoje em
  // ficha-contrato-chrome.tsx -- `setDialogXAberto(false)` dentro de
  // `onConcluido`). Como o estado do diálogo é interno a este componente,
  // `renderizar` recebe `fechar` para o chamador plugar em `onConcluido`.
  renderizar: (fechar: () => void) => ReactNode;
}

export interface AbaIncidenciaProps {
  linhaDoTempo: ReactNode;
  cicloDeVida: ReactNode;
  criar: ItemCriar[];
}

const VISOES: { id: AbaVisao; rotulo: string }[] = [
  { id: "linha-do-tempo", rotulo: "Linha do Tempo" },
  { id: "ciclo-de-vida", rotulo: "Ciclo de Vida" },
];

export function AbaIncidencia({ linhaDoTempo, cicloDeVida, criar }: AbaIncidenciaProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const visaoAtiva = normalizaVisao(searchParams.get(PARAM_VISAO));

  const [itemAberto, setItemAberto] = useState<string | null>(null);

  function selecionarVisao(visao: AbaVisao) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(PARAM_VISAO, visao);
    // `replace`, não `push`: trocar de visão não é navegação que mereça
    // entrada no histórico (mesmo idioma de PlanejamentoAbas).
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" className="flex gap-3">
          {VISOES.map((visao) => (
            <button
              key={visao.id}
              type="button"
              role="tab"
              aria-selected={visaoAtiva === visao.id}
              onClick={() => selecionarVisao(visao.id)}
              className={cn(
                "border-b-[3px] px-1 py-4 text-sm",
                visaoAtiva === visao.id
                  ? "border-secondary font-bold text-secondary"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground"
              )}
            >
              {visao.rotulo}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {criar.map((item, indice) => {
            const principal = indice === criar.length - 1;
            return (
              <Dialog
                key={item.rotulo}
                open={itemAberto === item.rotulo}
                onOpenChange={(aberto) => setItemAberto(aberto ? item.rotulo : null)}
              >
                <Button
                  type="button"
                  variant={principal ? "default" : "outline"}
                  size="sm"
                  className={cn("gap-1.5", principal && "bg-secondary text-secondary-foreground shadow-md hover:bg-secondary/90")}
                  onClick={() => setItemAberto(item.rotulo)}
                >
                  {principal && <Plus className="size-3.5" />}
                  {item.rotulo}
                </Button>
                <DialogContent className="max-w-md sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{item.rotulo}</DialogTitle>
                  </DialogHeader>
                  {item.renderizar(() => setItemAberto(null))}
                </DialogContent>
              </Dialog>
            );
          })}
        </div>
      </div>

      {/* Renderização condicional, não `hidden` -- mesma escolha e mesmo
          racional de planejamento-abas.tsx: os dados (timeline, cadeias,
          resumos) vivem no estado da PÁGINA (T25), que não remonta ao trocar
          de visão; só o estado interno de cada visão (filtros da
          TimelineFeed, por ex.) se perde, e manter as duas montadas
          significaria uma árvore invisível recebendo re-render à toa. */}
      {visaoAtiva === "linha-do-tempo" ? linhaDoTempo : cicloDeVida}
    </div>
  );
}
