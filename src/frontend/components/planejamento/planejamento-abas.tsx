"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

// PLV-14 (.specs/features/planejamento-estrategico-v2/spec.md:323). Duas abas
// dentro da tela de Planejamento: o Diagnóstico (contexto estratégico do plano)
// e a estrutura de Objetivos/Metas/Sucessos Mensais.
//
// NÃO é o RouteTabs do app-shell, ainda que se pareça de propósito: aquele
// navega por `pathname` com <Link>, e estas duas abas vivem na MESMA rota
// (/contratos/[id]/planejamento). Trocar de aba não pode trocar de rota -- o
// estado já carregado da página (hierarquia, grade, GIP) seria remontado a cada
// ida e volta. A persistência exigida pela AC5 é de querystring, não de caminho.
export type AbaPlanejamento = "diagnostico" | "estrutura";

export const ABA_PADRAO: AbaPlanejamento = "diagnostico";

// O parâmetro é `aba` e os valores são os identificadores acima -- não os
// rótulos. Rótulo é texto de tela e muda; querystring que alguém colou no Slack
// não pode quebrar quando o rótulo for reescrito.
export const PARAM_ABA = "aba";

const ABAS: { id: AbaPlanejamento; rotulo: string }[] = [
  // Rótulos verbatim da spec (AC1/AC5) e do Figma 57:671.
  { id: "diagnostico", rotulo: "Diagnóstico (Análise de Conjuntura)" },
  { id: "estrutura", rotulo: "Construir a estrutura" },
];

// Querystring é entrada de usuário: vem de link colado, de histórico antigo, de
// digitação. Valor desconhecido cai no padrão em vez de renderizar tela em
// branco -- a AC não prevê terceiro estado, e uma aba "nenhuma" seria inventar
// um.
export function normalizaAba(valor: string | null | undefined): AbaPlanejamento {
  return ABAS.some((aba) => aba.id === valor) ? (valor as AbaPlanejamento) : ABA_PADRAO;
}

export interface PlanejamentoAbasProps {
  diagnostico: React.ReactNode;
  estrutura: React.ReactNode;
}

export function PlanejamentoAbas({ diagnostico, estrutura }: PlanejamentoAbasProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ativa = normalizaAba(searchParams.get(PARAM_ABA));

  function selecionar(aba: AbaPlanejamento) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(PARAM_ABA, aba);
    // `replace` e não `push`: alternar aba não é navegação que mereça entrada no
    // histórico -- o Voltar do navegador deve sair da tela de Planejamento, não
    // desfazer cliques de aba. Mesmo idioma de BarraRecorte.
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="grid gap-4">
      <nav
        aria-label="Seções do Planejamento"
        className="flex items-center gap-6 overflow-x-auto border-b border-border/40 scrollbar-none"
      >
        {ABAS.map(({ id, rotulo }) => {
          const eAtiva = id === ativa;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={eAtiva}
              onClick={() => selecionar(id)}
              className={cn(
                "relative whitespace-nowrap pb-3 text-sm font-medium transition-colors duration-200",
                eAtiva ? "font-semibold text-secondary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {rotulo}
              {eAtiva && <span className="absolute bottom-0 left-0 h-[2.5px] w-full rounded-t-full bg-secondary" />}
            </button>
          );
        })}
      </nav>

      {/* Renderização condicional, não `hidden`: a aba inativa sai do DOM. Os
          dados da página (hierarquia, grade, preditores, GIP) vivem no estado de
          page.tsx e sobrevivem à troca, então nada é rebuscado -- o que se perde
          é só o estado interno da grade (nós expandidos), e mantê-la montada
          significaria uma árvore inteira invisível recebendo re-render a cada
          tecla digitada no Diagnóstico. */}
      {ativa === "diagnostico" ? diagnostico : estrutura}
    </div>
  );
}
