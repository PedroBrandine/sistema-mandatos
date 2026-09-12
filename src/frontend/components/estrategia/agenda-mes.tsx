"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import type { EncontroAgenda } from "@backend/queries/agenda";
import { FUSO_HORARIO_PRODUTO } from "@backend/queries/agenda";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// EST-12 (T26, design.md "AgendaMes"). AD-046: tela de leitura -- caminho
// feliz de cada AC. Os pares que o "Done when" desta task pede explicitamente
// (um caso por status, hoje dentro E fora do mês) continuam exigidos.
//
// Presentational puro: recebe `encontros` já resolvidos (buscarEncontrosDoMes,
// T25) e devolve a intenção de navegar/selecionar via callback, sem buscar
// dado por conta própria -- mesma forma de QuadroAcompanhamento (T16),
// TabelaPendencias (T18) e ListaMandatos (T20).
//
// `hoje` é PROP OBRIGATÓRIA, nunca `new Date()` lido aqui dentro (lição
// L-002): a data de referência entra explícita de quem monta a página, o que
// torna AC6 testável dos dois lados (hoje dentro e fora do mês exibido) sem
// congelar relógio no teste.

// Figma 163:4: a grade começa na SEGUNDA (SEG TER QUA QUI SEX SÁB DOM), não no
// domingo, e os rótulos são de 3 letras em caixa alta. O fim de semana são as
// duas últimas colunas — por isso o índice 5/6 é o recorte de sábado/domingo.
const DIAS_SEMANA = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const PRIMEIRA_COLUNA_FIM_DE_SEMANA = 5;

const NOMES_MES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

// EST-12 AC2 nomeia dois estados: "Agendada" e "Realizada". ck_encontro_status
// permite outros dois (cancelado, remarcado) que nenhuma AC nomeia --
// SPEC-PRECISION GAP registrado no commit: recebem rótulo próprio e cor
// neutra em vez de serem escondidos, porque sumir com um encontro da grade
// seria pior que exibi-lo num estado que o spec não classificou.
const STATUS_LABEL: Record<EncontroAgenda["status"], string> = {
  planejado: "Agendada",
  realizado: "Realizada",
  cancelado: "Cancelada",
  remarcado: "Remarcada",
};

// Cores da marca (globals.css, CAD-13), nunca paleta genérica do Tailwind:
// Figma 163:4 pinta o chip de "Agendada" com o vinho da identidade
// (--secondary #571730) e a legenda de "Realizada" com o verde-água
// (--chart-4 #4ABFB2).
const STATUS_CLASS: Record<EncontroAgenda["status"], string> = {
  planejado: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
  realizado: "bg-chart-4 text-foreground hover:bg-chart-4/90",
  cancelado: "bg-muted text-muted-foreground hover:bg-muted/80 line-through",
  remarcado: "bg-chart-2 text-foreground hover:bg-chart-2/90",
};

// Bolinha da legenda "● Agendada ● Realizada" (Figma 163:4, canto superior
// direito da faixa do mês).
const LEGENDA: { status: EncontroAgenda["status"]; classe: string }[] = [
  { status: "planejado", classe: "bg-secondary" },
  { status: "realizado", classe: "bg-chart-4" },
];

// Offset fixo do fuso do produto, derivado da constante única de
// queries/agenda.ts -- nunca um "3" solto aqui (a mesma decisão vale para o
// intervalo da consulta e para a posição na grade, senão a borda do mês e a
// borda do dia discordariam).
function offsetEmMinutos(): number {
  const [, sinal, horas, minutos] = /^([+-])(\d{2}):(\d{2})$/.exec(FUSO_HORARIO_PRODUTO) ?? [];
  if (!sinal) return 0;
  const total = Number(horas) * 60 + Number(minutos);
  return sinal === "-" ? -total : total;
}

// "YYYY-MM-DD" do instante, no fuso do produto. Um encontro às 21h de 30/09
// em São Paulo é 01/10 em UTC -- sem esta conversão ele apareceria na célula
// do dia seguinte (EST-12 AC1, "dia correto").
export function diaNoFusoDoProduto(iso: string): string {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return "";
  const deslocado = new Date(instante.getTime() + offsetEmMinutos() * 60_000);
  return deslocado.toISOString().slice(0, 10);
}

// "HH:MM" do instante, no mesmo fuso. Fica aqui, ao lado de
// diaNoFusoDoProduto e de offsetEmMinutos, para a aritmética de fuso viver
// num arquivo só -- EncontroPopover (T28) importa as duas em vez de
// recalcular o offset por conta própria (licao L-005).
export function horaNoFusoDoProduto(iso: string): string {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return "";
  const deslocado = new Date(instante.getTime() + offsetEmMinutos() * 60_000);
  return deslocado.toISOString().slice(11, 16);
}

// "YYYY-MM-DD" de AGORA, no mesmo fuso. Terceiro consumidor da aritmética de
// offset (grade, popover e a página da Agenda, T30b): mora aqui pelo mesmo
// motivo que horaNoFusoDoProduto -- a conversão de fuso vive num arquivo só,
// senão a borda do dia discordaria da borda do mês (lição L-005).
// O instante entra por PARÂMETRO, nunca `new Date()` aqui dentro: quem monta
// a página decide quando leu o relógio, e o teste passa um instante fixo
// sem congelar o relógio global (lição L-002).
export function hojeNoFusoDoProduto(agora: Date): string {
  const deslocado = new Date(agora.getTime() + offsetEmMinutos() * 60_000);
  return deslocado.toISOString().slice(0, 10);
}

function chaveDia(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

// Dias do mês + as células vazias de preenchimento antes do dia 1, para a
// grade fechar em semanas completas. Mês sem nenhum encontro continua
// renderizando a grade inteira (edge case do spec).
function montarCelulas(ano: number, mes: number): (string | null)[] {
  // getUTCDay() devolve 0=domingo; a grade do Figma começa na segunda, então
  // o deslocamento é (dia + 6) % 7 -- segunda vira 0 e domingo vira 6.
  const diaDaSemana = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const primeiraColuna = (diaDaSemana + 6) % 7;
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const celulas: (string | null)[] = Array(primeiraColuna).fill(null);
  for (let dia = 1; dia <= diasNoMes; dia += 1) {
    celulas.push(chaveDia(ano, mes, dia));
  }
  while (celulas.length % 7 !== 0) celulas.push(null);
  return celulas;
}

export interface AgendaMesProps {
  ano: number;
  mes: number;
  encontros: EncontroAgenda[];
  /** Data de referência "YYYY-MM-DD" — explícita, nunca lida do relógio aqui (L-002). */
  hoje: string;
  onMudarMes?: (input: { ano: number; mes: number }) => void;
  onSelecionarEncontro?: (encontro: EncontroAgenda) => void;
}

export function AgendaMes({
  ano,
  mes,
  encontros,
  hoje,
  onMudarMes,
  onSelecionarEncontro,
}: AgendaMesProps) {
  const celulas = montarCelulas(ano, mes);

  const encontrosPorDia = new Map<string, EncontroAgenda[]>();
  for (const encontro of encontros) {
    if (!encontro.dtPrevistaInicio) continue;
    const dia = diaNoFusoDoProduto(encontro.dtPrevistaInicio);
    const lista = encontrosPorDia.get(dia) ?? [];
    lista.push(encontro);
    encontrosPorDia.set(dia, lista);
  }

  const irPara = (passo: number) => {
    const bruto = mes - 1 + passo;
    const anoDestino = ano + Math.floor(bruto / 12);
    const mesDestino = ((bruto % 12) + 12) % 12;
    onMudarMes?.({ ano: anoDestino, mes: mesDestino + 1 });
  };

  return (
    <Card>
      {/* Figma 163:4: título do mês e setas ANDAM JUNTOS à esquerda (as setas
          logo depois do título, não na borda oposta), e a legenda de status
          fica à direita. O título é "Setembro 2025", sem "de". */}
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2">
          <CardTitle className="font-heading text-2xl text-secondary">
            {NOMES_MES[mes - 1]} {ano}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Mês anterior"
              onClick={() => irPara(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Próximo mês"
              onClick={() => irPara(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <ul className="flex items-center gap-4">
          {LEGENDA.map(({ status, classe }) => (
            <li key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden="true" className={cn("size-2 rounded-full", classe)} />
              {STATUS_LABEL[status]}
            </li>
          ))}
        </ul>
      </CardHeader>

      <CardContent>
        <div role="grid" aria-label={`Agenda de ${NOMES_MES[mes - 1]} de ${ano}`} className="grid gap-px">
          <div role="row" className="grid grid-cols-7 gap-px">
            {DIAS_SEMANA.map((dia) => (
              <div
                key={dia}
                role="columnheader"
                className="px-2 py-1 text-center text-xs font-medium text-muted-foreground"
              >
                {dia}
              </div>
            ))}
          </div>

          {Array.from({ length: celulas.length / 7 }, (_, semana) => (
            <div role="row" key={semana} className="grid grid-cols-7 gap-px">
              {celulas.slice(semana * 7, semana * 7 + 7).map((chave, indice) => {
                const ehFimDeSemana = indice >= PRIMEIRA_COLUNA_FIM_DE_SEMANA;
                if (chave === null) {
                  return (
                    <div
                      key={`vazia-${semana}-${indice}`}
                      role="gridcell"
                      aria-hidden="true"
                      className={cn("min-h-28", ehFimDeSemana ? "bg-muted/50" : "bg-transparent")}
                    />
                  );
                }
                const ehHoje = chave === hoje;
                const doDia = encontrosPorDia.get(chave) ?? [];
                return (
                  <div
                    key={chave}
                    role="gridcell"
                    data-dia={chave}
                    data-hoje={ehHoje ? "true" : undefined}
                    className={cn(
                      "min-h-28 p-2 align-top",
                      // Figma 163:4: fim de semana com fundo bege da marca
                      // (--muted), não uma cor nova.
                      ehFimDeSemana ? "bg-muted/50" : "bg-card",
                      ehHoje && "ring-1 ring-inset ring-secondary"
                    )}
                  >
                    {/* Hoje: número dentro de um círculo dourado (--chart-2) e
                        a palavra HOJE ao lado, como no Figma. */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          ehHoje
                            ? "flex size-6 items-center justify-center rounded-full bg-chart-2 text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {Number(chave.slice(8, 10))}
                      </span>
                      {ehHoje && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Hoje
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 grid gap-1">
                      {doDia.map((encontro) => (
                        <button
                          key={encontro.idEncontro}
                          type="button"
                          onClick={() => onSelecionarEncontro?.(encontro)}
                          className={cn(
                            "w-full truncate rounded px-1.5 py-1 text-left text-xs font-medium transition-colors",
                            STATUS_CLASS[encontro.status]
                          )}
                        >
                          <span className="sr-only">{STATUS_LABEL[encontro.status]}: </span>
                          {/* Figma 163:4: o chip mostra HORA + título
                              ("14:00 Sprint de Planeja..."), não só o título. */}
                          {encontro.dtPrevistaInicio
                            ? `${horaNoFusoDoProduto(encontro.dtPrevistaInicio)} ${encontro.titulo}`
                            : encontro.titulo}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
