"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import type { LinhaEvolucaoMensal, PessoaVinculada } from "@backend/queries/planejamento";

import { calculaAvancoMensal } from "./planejamento-series";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// PLV-13 (T25, .specs/features/planejamento-estrategico-v2/spec.md "P1: Evolução
// mensal"). Curvas Esperado × Atingido + leitura do avanço do mês -- a
// pergunta que Pedro faz todo mês: "quanto eu avancei no mês X?".
//
// Este componente NÃO calcula nada de gestão: `serie` já vem pronta da view
// (vw_planejamento_evolucao_mensal, AD-003/AC2), e o avanço vem de
// calculaAvancoMensal (T11, módulo puro) -- subtração de dois pontos já
// prontos, não agregação nova.
//
// "Inspecionar um mês" (AC3) é um <Select>, não hover num ponto do SVG: um
// tooltip de hover é ilegível pra leitor de tela e intestável em jsdom (SVG
// sem bounding box real) -- o Select dá a mesma resposta ("Esperado/Atingido/
// Avanço deste mês"), de forma acessível e testável. O gráfico em si continua
// com o ChartTooltip padrão (ui/chart.tsx) pra quem passa o mouse, mas o AC
// não depende dele.
//
// AC7: P=0 é a view devolvendo ZERO linhas (comentário da migration:
// "Plano sem nenhum SM não produz linha alguma") -- serie.length === 0 é
// exatamente essa condição, tratada como EstadoVazio, nunca uma curva em 0%.
export interface EvolucaoMensalProps {
  serie: LinhaEvolucaoMensal[];
  pessoasVinculadas: PessoaVinculada[];
  idResponsavel: number | null;
  onFiltrar: (idResponsavel: number | null) => void;
}

function formatarMes(mes: string): string {
  const [ano, mesNum] = mes.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const indice = Number(mesNum) - 1;
  return indice >= 0 && indice < 12 ? `${nomes[indice]}/${ano.slice(2)}` : mes;
}

function formatarPct(valor: number | null): string {
  return valor == null ? "—" : `${valor}%`;
}

function formatarAvanco(valor: number | null): string {
  if (valor == null) return "—";
  const sinal = valor > 0 ? "+" : "";
  return `${sinal}${valor}pp`;
}

const CONFIG: ChartConfig = {
  pctEsperado: { label: "Esperado", color: "var(--muted-foreground)" },
  pctAtingido: { label: "Atingido", color: "var(--secondary)" },
};

export function EvolucaoMensal({ serie, pessoasVinculadas, idResponsavel, onFiltrar }: EvolucaoMensalProps) {
  const pontos = useMemo(() => calculaAvancoMensal(serie), [serie]);

  // Mês corrente = o último com Atingido não nulo (AC8: Atingido para no mês
  // corrente, os futuros chegam null) -- é a leitura que a Gestora quer ao
  // abrir a tela, sem precisar escolher nada.
  const mesPadrao = useMemo(() => {
    const comAtingido = pontos.filter((p) => p.pctAtingido != null);
    return comAtingido.at(-1)?.mes ?? pontos.at(-1)?.mes ?? null;
  }, [pontos]);

  // Ajustar estado durante o render (mesmo idioma de page.tsx,
  // `papelParaFiltroPadrao`) -- quando `serie` muda de referência (o filtro de
  // responsável refez a consulta, AC5), o mês antes inspecionado pode nem
  // existir na série nova; volta pro mês corrente da série nova, em vez de
  // ficar preso a um mês que já não está lá.
  const [serieVista, setSerieVista] = useState(serie);
  const [mesInspecionado, setMesInspecionado] = useState<string | null>(mesPadrao);
  if (serie !== serieVista) {
    setSerieVista(serie);
    setMesInspecionado(mesPadrao);
  }
  const mesAtivo = mesInspecionado ?? mesPadrao;
  const pontoInspecionado = pontos.find((p) => p.mes === mesAtivo) ?? null;

  if (serie.length === 0) {
    return (
      <div className="grid gap-3">
        <Cabecalho pessoasVinculadas={pessoasVinculadas} idResponsavel={idResponsavel} onFiltrar={onFiltrar} />
        <EstadoVazio
          titulo="Sem Sucessos Mensais para calcular a evolução"
          mensagem="A curva aparece aqui assim que o plano tiver ao menos um Sucesso Mensal com peso."
        />
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <Cabecalho pessoasVinculadas={pessoasVinculadas} idResponsavel={idResponsavel} onFiltrar={onFiltrar} />

      <ChartContainer config={CONFIG} className="aspect-auto h-56 w-full">
        <LineChart data={pontos} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
          <XAxis dataKey="mes" tickFormatter={formatarMes} tickLine={false} axisLine={false} fontSize={11} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} width={36} unit="%" />
          <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => formatarMes(String(v))} />} />
          <Line dataKey="pctEsperado" type="monotone" stroke="var(--muted-foreground)" strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line dataKey="pctAtingido" type="monotone" stroke="var(--secondary)" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
        </LineChart>
      </ChartContainer>

      <div className="grid gap-2 rounded-lg border p-3">
        <Select value={mesAtivo ?? undefined} onValueChange={setMesInspecionado}>
          <SelectTrigger className="w-fit" aria-label="Inspecionar mês">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pontos.map((p) => (
              <SelectItem key={p.mes} value={p.mes}>
                {formatarMes(p.mes)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {pontoInspecionado && (
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Esperado</dt>
              <dd className="font-semibold tabular-nums">{formatarPct(pontoInspecionado.pctEsperado)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Atingido</dt>
              <dd className="font-semibold tabular-nums">{formatarPct(pontoInspecionado.pctAtingido)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Avanço do mês</dt>
              <dd className="font-semibold tabular-nums">{formatarAvanco(pontoInspecionado.avanco)}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}

function Cabecalho({
  pessoasVinculadas,
  idResponsavel,
  onFiltrar,
}: {
  pessoasVinculadas: PessoaVinculada[];
  idResponsavel: number | null;
  onFiltrar: (idResponsavel: number | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-medium text-foreground">Evolução mensal</p>
      {/* AC5: filtrar por responsável refaz a consulta -- onFiltrar é quem
          decide (page.tsx), este componente só emite a escolha. "Todos"
          (idResponsavel null) é o escopo do plano inteiro. */}
      <Select
        value={idResponsavel != null ? String(idResponsavel) : "todos"}
        onValueChange={(v) => onFiltrar(v === "todos" ? null : Number(v))}
      >
        <SelectTrigger className="w-fit" aria-label="Filtrar por responsável">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          {pessoasVinculadas.map((p) => (
            <SelectItem key={p.idUsuario} value={String(p.idUsuario)}>
              {p.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
