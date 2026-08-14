"use client";

import { useId, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Table2 } from "lucide-react";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface SerieLinhaEvolucao {
  id: string;
  nome: string;
  cor: string;
  pontos: { mes: string; valor: number | null }[];
}

interface ChartLinhaEvolucaoProps {
  titulo: string;
  series: SerieLinhaEvolucao[];
  formatarValor?: (v: number) => string;
  formatarMes?: (mes: string) => string;
}

const formatarMesPadrao = (mes: string) => {
  const [ano, mesNum] = mes.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const indice = Number(mesNum) - 1;
  return indice >= 0 && indice < 12 ? `${nomes[indice]}/${ano.slice(2)}` : mes;
};

// visao-gerencial-g3-g6, T21 (infra, consumido por GER-07/08/12/13). Wrapper
// fino sobre o primitivo shadcn/Recharts -- uma métrica só por instância
// (nunca dois eixos Y, regra de visualização do pedido original), cor
// categórica fixa por série (atribuída pelo chamador via `cor`, nunca
// ciclada automaticamente), legenda só com 2+ séries, tooltip sempre, toggle
// "ver como tabela" acessível por teclado/leitor de tela embutido.
export function ChartLinhaEvolucao({ titulo, series, formatarValor, formatarMes = formatarMesPadrao }: ChartLinhaEvolucaoProps) {
  const [comoTabela, setComoTabela] = useState(false);
  const tituloId = useId();

  const meses = series[0]?.pontos.map((p) => p.mes) ?? [];
  const dados = meses.map((mes) => {
    const linha: Record<string, string | number | null> = { mes: formatarMes(mes) };
    for (const serie of series) {
      linha[serie.id] = serie.pontos.find((p) => p.mes === mes)?.valor ?? null;
    }
    return linha;
  });

  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.id, { label: s.nome, color: s.cor }])
  );

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
              <TableHead>Mês</TableHead>
              {series.map((s) => (
                <TableHead key={s.id}>{s.nome}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {dados.map((linha, i) => (
              <TableRow key={i}>
                <TableCell>{linha.mes}</TableCell>
                {series.map((s) => {
                  const valor = linha[s.id];
                  return (
                    <TableCell key={s.id}>
                      {valor === null ? "—" : formatarValor ? formatarValor(valor as number) : valor}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <ChartContainer config={config} className="aspect-auto h-56 w-full" role="img" aria-labelledby={tituloId}>
          <LineChart data={dados} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
            <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickLine={false} axisLine={false} fontSize={11} width={36} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {series.length >= 2 && <ChartLegend content={<ChartLegendContent />} />}
            {series.map((s) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.id}
                stroke={s.cor}
                strokeWidth={1.75}
                dot={{ r: 2.5 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}
