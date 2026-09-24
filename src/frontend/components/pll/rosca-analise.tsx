"use client";

import { useId } from "react";
import { Cell, Pie, PieChart } from "recharts";

import type { CategoriaDistribuicao } from "@backend/queries/pll-dashboard";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

// pll-dashboard-agenda T18 (design.md "Components", PLL-DB-15…19). Rosca
// (donut) compartilhada pelos 3 painéis de análise (Participante, Mandato,
// Afinidade de agenda) -- mesma lib Recharts já escolhida em T9
// (PllStatusMensalChart).
//
// PLL-DB-19: centro da rosca mostra o `n` de respondentes (nunca "100%",
// D-5b -- o mockup original tinha "100%" fixo em todo gráfico, que não
// informa nada num gráfico de partes); a legenda soma ~100% (a soma exata
// de cada `percentual` já vem arredondada por categoria em
// buscarAnalise*Pll, não recalculada aqui).
//
// D-13 revogada em sessão ao vivo com Pedro (22/09): o gráfico sempre
// renderiza, mesmo com poucos respondentes -- o limiar "n < 5 suprime"
// travava o Dashboard inteiro com qualquer recorte pequeno.
const PALETA = [
  "var(--chart-1)",
  "var(--chart-4)",
  "var(--chart-2)",
  "var(--secondary)",
  "var(--chart-5)",
  "var(--chart-3)",
  "var(--muted-foreground)",
  "var(--accent)",
] as const;

function corDaCategoria(indice: number): string {
  return PALETA[indice % PALETA.length];
}

export interface RoscaAnaliseProps {
  titulo: string;
  n: number;
  categorias: CategoriaDistribuicao[];
  /** D-5(c): ausência de resposta (nulo), fora do denominador da rosca -- só
   * existe em campos com noção de "não respondeu" (DistribuicaoDemografica).
   * Campos sempre preenchidos (ex.: quantidade de mandatos anteriores) não
   * passam esta prop. */
  semResposta?: number;
  className?: string;
  /** PF3-02: quando o card em volta já mostra `titulo` no próprio CardTitle
   * (uma rosca só, sem agrupar várias métricas), evita repetir o texto na
   * tela -- o nome continua no DOM (sr-only) pra manter o `aria-labelledby`
   * do gráfico. */
  ocultarTitulo?: boolean;
  /** Achado 24/09: "respondentes" só faz sentido nas 3 roscas de pesquisa
   * (Participante/Mandato/Afinidade de agenda). Composição Partidária da
   * Casa conta candidatos ELEITOS, não respostas de formulário -- sem esta
   * prop o rótulo do centro saía errado por reaproveitar o default. */
  rotuloCentro?: string;
}

export function RoscaAnalise({
  titulo,
  n,
  categorias,
  semResposta,
  className,
  ocultarTitulo,
  rotuloCentro = "respondentes",
}: RoscaAnaliseProps) {
  const tituloId = useId();

  const config: ChartConfig = Object.fromEntries(
    categorias.map((c, i) => [c.categoria, { label: c.categoria, color: corDaCategoria(i) }])
  );

  return (
    <div className={cn("grid gap-2", className)}>
      <p id={tituloId} className={ocultarTitulo ? "sr-only" : "text-sm font-bold text-secondary"}>
        {titulo}
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
        {/* PLL-DB-19: `n` no CENTRO da rosca -- nunca "100%" fixo (D-5b,
            achado do mockup original). Overlay absoluto sobre o buraco do
            donut, não uma legenda separada. */}
        <div className="relative shrink-0">
          <ChartContainer config={config} className="aspect-square h-36 w-36" role="img" aria-labelledby={tituloId}>
            <PieChart>
              <Pie
                data={categorias}
                dataKey="quantidade"
                nameKey="categoria"
                innerRadius="65%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
                stroke="var(--card)"
                strokeWidth={2}
              >
                {categorias.map((c, i) => (
                  <Cell key={c.categoria} fill={corDaCategoria(i)} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-heading text-xl text-secondary">{n}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{rotuloCentro}</span>
          </div>
        </div>

        <ul className="grid w-full gap-1 text-xs text-muted-foreground">
          {categorias.map((c, i) => (
            <li key={c.categoria} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 truncate">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: corDaCategoria(i) }}
                />
                <span className="truncate">{c.categoria}</span>
              </span>
              <span className="shrink-0 font-medium text-foreground">{c.percentual}%</span>
            </li>
          ))}
          {semResposta !== undefined && semResposta > 0 && (
            <li className="mt-1 text-[11px] text-muted-foreground/80">{semResposta} sem resposta</li>
          )}
        </ul>
      </div>
    </div>
  );
}
