"use client";

import { useId } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import type { SerieMensalStatus } from "@backend/queries/pll-dashboard";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

// pll-dashboard-agenda T9 (design.md "PllStatusMensalChart", PLL-DB-05).
// Barras empilhadas por mês/status (Figma 44:477, "Status da mentoria por
// data" -- rótulo corrigido para refletir que o eixo é MÊS, não "por data",
// e que o status é de Encontro, não de mentorado; ver spec.md "Vocabulário e
// enums").
//
// Recharts (mesma lib de evolucao-mensal.tsx/chart-barra-horizontal.tsx),
// stackId único para as 4 séries se empilharem numa barra por mês.
//
// D-6(c): UMA paleta de status para Dashboard e Agenda -- a da Agenda
// (agenda-mes.tsx STATUS_CLASS), não a que o mockup do Dashboard desenhava.
// Cores em var(--token), nunca hex cru: Planejado = --secondary (vinho),
// Realizado = --chart-4 (verde-água), Remarcado = --chart-2 (dourado/âmbar),
// Cancelado = --muted-foreground (cinza).
const CONFIG: ChartConfig = {
  planejado: { label: "Planejado", color: "var(--secondary)" },
  realizado: { label: "Realizado", color: "var(--chart-4)" },
  remarcado: { label: "Remarcado", color: "var(--chart-2)" },
  cancelado: { label: "Cancelado", color: "var(--muted-foreground)" },
};

const SERIES: { chave: keyof Omit<SerieMensalStatus, "mes">; rotulo: string; corVar: string; dotClass: string }[] = [
  { chave: "planejado", rotulo: "Planejado", corVar: "var(--secondary)", dotClass: "bg-secondary" },
  { chave: "realizado", rotulo: "Realizado", corVar: "var(--chart-4)", dotClass: "bg-chart-4" },
  { chave: "remarcado", rotulo: "Remarcado", corVar: "var(--chart-2)", dotClass: "bg-chart-2" },
  { chave: "cancelado", rotulo: "Cancelado", corVar: "var(--muted-foreground)", dotClass: "bg-muted-foreground" },
];

const NOMES_MES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatarMes(mes: string): string {
  const [ano, mesNum] = mes.split("-");
  const indice = Number(mesNum) - 1;
  return indice >= 0 && indice < 12 ? `${NOMES_MES_ABREV[indice]}/${ano.slice(2)}` : mes;
}

export interface PllStatusMensalChartProps {
  serie: SerieMensalStatus[];
}

export function PllStatusMensalChart({ serie }: PllStatusMensalChartProps) {
  const tituloId = useId();

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={tituloId} className="font-heading text-xl text-secondary">
          Status da mentoria por mês
        </p>
        <ul className="flex flex-wrap items-center gap-3">
          {SERIES.map((s) => (
            <li key={s.chave} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden="true" className={cn("size-2 rounded-full", s.dotClass)} />
              {s.rotulo}
            </li>
          ))}
        </ul>
      </div>

      <ChartContainer
        config={CONFIG}
        className="aspect-auto h-64 w-full"
        role="img"
        aria-labelledby={tituloId}
      >
        <BarChart data={serie} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
          <XAxis dataKey="mes" tickFormatter={formatarMes} tickLine={false} axisLine={false} fontSize={11} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} width={28} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => formatarMes(String(v))} />} />
          {SERIES.map((s) => (
            <Bar
              key={s.chave}
              dataKey={s.chave}
              stackId="status"
              fill={s.corVar}
              isAnimationActive={false}
              radius={0}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </div>
  );
}
