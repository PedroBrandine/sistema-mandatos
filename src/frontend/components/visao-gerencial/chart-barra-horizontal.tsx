"use client";

import { useId, useState } from "react";
import { Bar, BarChart, Cell, CartesianGrid, XAxis, YAxis } from "recharts";
import { Table2 } from "lucide-react";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { UnidadeValor } from "@/components/visao-gerencial/chart-linha-evolucao";

export interface ItemBarraHorizontal {
  id: string;
  rotulo: string;
  valor: number | null;
  cor?: string; // default: --primary. Suporta destaque por item (ex.: atraso).
}

interface ChartBarraHorizontalProps {
  titulo: string;
  itens: ItemBarraHorizontal[];
  unidade?: UnidadeValor;
  ordenarPorValor?: boolean; // false quando a ordem já é significativa (ex.: régua de etapas, GER-10)
}

// `unidade` (discriminador serializável, não função) -- mesmo achado real de
// ChartLinhaEvolucao (T23): função como prop quebra em runtime quando o
// chamador é Server Component.
function formatarValorPorUnidade(v: number, unidade: UnidadeValor): string {
  if (unidade === "pct") return `${v.toFixed(0)}%`;
  if (unidade === "dias") return `${v.toFixed(0)}d`;
  return String(v);
}

// visao-gerencial-g3-g6, T21 (infra, consumido por GER-08/10/14/17/18). Uma
// métrica só por instância (nunca dois eixos Y). `ordenarPorValor=false` é
// obrigatório pro Bloco 1 (barras sempre na ordem da régua, nunca por
// volume, GER-10) -- default true pros demais usos (G4, G6...).
export function ChartBarraHorizontal({
  titulo,
  itens,
  unidade = "numero",
  ordenarPorValor = true,
}: ChartBarraHorizontalProps) {
  const [comoTabela, setComoTabela] = useState(false);
  const tituloId = useId();

  const dados = ordenarPorValor
    ? [...itens].sort((a, b) => (b.valor ?? -Infinity) - (a.valor ?? -Infinity))
    : itens;

  const config: ChartConfig = { valor: { label: titulo, color: "var(--primary)" } };

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <p id={tituloId} className="text-sm font-medium text-foreground">
          {titulo}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={() => setComoTabela((v) => !v)}
          aria-pressed={comoTabela}
        >
          <Table2 className="size-3.5" aria-hidden="true" />
          {comoTabela ? "Ver gráfico" : "Ver como tabela"}
        </Button>
      </div>

      {comoTabela ? (
        <Table aria-labelledby={tituloId}>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dados.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.rotulo}</TableCell>
                <TableCell>{item.valor === null ? "—" : formatarValorPorUnidade(item.valor, unidade)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <ChartContainer
          config={config}
          className="aspect-auto w-full"
          style={{ height: `${Math.max(dados.length * 32, 96)}px` }}
          role="img"
          aria-labelledby={tituloId}
        >
          <BarChart data={dados} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.4} />
            <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis type="category" dataKey="rotulo" tickLine={false} axisLine={false} fontSize={11} width={110} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="valor" radius={3} isAnimationActive={false}>
              {dados.map((item) => (
                <Cell key={item.id} fill={item.cor ?? "var(--primary)"} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
}
