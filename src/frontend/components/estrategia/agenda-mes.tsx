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

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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

const STATUS_CLASS: Record<EncontroAgenda["status"], string> = {
  planejado: "bg-sky-100 text-sky-900 hover:bg-sky-200 dark:bg-sky-950 dark:text-sky-100",
  realizado: "bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-100",
  cancelado: "bg-muted text-muted-foreground hover:bg-muted/80 line-through",
  remarcado: "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-100",
};

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

function chaveDia(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

// Dias do mês + as células vazias de preenchimento antes do dia 1, para a
// grade fechar em semanas completas. Mês sem nenhum encontro continua
// renderizando a grade inteira (edge case do spec).
function montarCelulas(ano: number, mes: number): (string | null)[] {
  const primeiroDiaSemana = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const celulas: (string | null)[] = Array(primeiroDiaSemana).fill(null);
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
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle className="font-heading text-xl">
          {NOMES_MES[mes - 1]} de {ano}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Mês anterior"
            onClick={() => irPara(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Próximo mês"
            onClick={() => irPara(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
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
                if (chave === null) {
                  return (
                    <div
                      key={`vazia-${semana}-${indice}`}
                      role="gridcell"
                      aria-hidden="true"
                      className="min-h-24 rounded-md bg-muted/20"
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
                      "min-h-24 rounded-md border border-border/50 p-1.5 align-top",
                      ehHoje && "border-primary bg-primary/5 ring-1 ring-primary"
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-medium text-muted-foreground",
                        ehHoje && "text-primary"
                      )}
                    >
                      {Number(chave.slice(8, 10))}
                    </span>
                    <div className="mt-1 grid gap-1">
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
                          {encontro.titulo}
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
