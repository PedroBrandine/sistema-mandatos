"use client";

import Link from "next/link";

import type { EncontroAgenda } from "@backend/queries/agenda";
import type { RegistroAgenda } from "@backend/queries/registros-agenda";

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { diaNoFusoDoProduto, horaNoFusoDoProduto } from "./agenda-mes";

// EST-13 (T28, design.md "AgendaMes + EncontroPopover"). Tela de ESCRITA --
// AD-046 mantém aqui a profundidade integral de AD-042: os dois lados de cada
// condicional, estado vazio e estado de erro seguem exigidos. Esta task cobre
// só a leitura (AC1, AC2); marcar presença e adicionar registro entram na T30.
//
// O conteúdo é um componente próprio, separado do wrapper de Popover, pelo
// mesmo motivo empírico que levou a extrair useBuscaTse na T22: o Portal do
// Radix atrapalha a asserção direta em jsdom. Assim os testes de exibição
// batem em ConteudoEncontro sem depender do portal, e um teste só cobre a
// composição Popover -> conteúdo.

const STATUS_LABEL: Record<EncontroAgenda["status"], string> = {
  planejado: "Agendada",
  realizado: "Realizada",
  cancelado: "Cancelada",
  remarcado: "Remarcada",
};

const STATUS_VARIANT: Record<EncontroAgenda["status"], "default" | "secondary" | "outline"> = {
  planejado: "default",
  realizado: "secondary",
  cancelado: "outline",
  remarcado: "outline",
};

const MODALIDADE_LABEL: Record<string, string> = {
  presencial: "Presencial",
  online: "Online",
};

// Ausência é "—", nunca string vazia nem valor inventado (AD-005).
const AUSENTE = "—";

function textoOuAusente(valor: string | null | undefined): string {
  return valor && valor.trim() !== "" ? valor : AUSENTE;
}

// "15/09/2026 · 14:00 — 15:30". Sem dt_prevista_inicio não há data/horário a
// exibir: devolve a ausência, nunca uma data inventada.
export function formatarDataHorario(inicio: string | null, fim: string | null): string {
  if (!inicio) return AUSENTE;
  const [ano, mes, dia] = diaNoFusoDoProduto(inicio).split("-");
  const base = `${dia}/${mes}/${ano} · ${horaNoFusoDoProduto(inicio)}`;
  return fim ? `${base} — ${horaNoFusoDoProduto(fim)}` : base;
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="grid gap-0.5">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="text-sm">{valor}</p>
    </div>
  );
}

export interface ConteudoEncontroProps {
  encontro: EncontroAgenda;
  /** Registros já filtrados por este encontro (buscarRegistrosDaAgenda, T27). */
  registros: RegistroAgenda[];
}

export function ConteudoEncontro({ encontro, registros }: ConteudoEncontroProps) {
  const participantes = encontro.participantes.map((p) => p.nome).filter((n) => n.trim() !== "");

  return (
    <div className="grid gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-heading text-base font-medium">{encontro.titulo}</p>
        <Badge variant={STATUS_VARIANT[encontro.status]}>{STATUS_LABEL[encontro.status]}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Campo rotulo="Etapa" valor={textoOuAusente(encontro.nomeEtapa)} />
        <Campo rotulo="Tipo" valor={textoOuAusente(encontro.nomeTipo)} />
        <Campo
          rotulo="Data e horário"
          valor={formatarDataHorario(encontro.dtPrevistaInicio, encontro.dtPrevistaFim)}
        />
        <Campo
          rotulo="Modalidade"
          valor={
            encontro.modalidade
              ? MODALIDADE_LABEL[encontro.modalidade] ?? encontro.modalidade
              : AUSENTE
          }
        />
        <Campo rotulo="Local" valor={textoOuAusente(encontro.local)} />
        <Campo rotulo="Tema" valor={textoOuAusente(encontro.temaPrioritario)} />
      </div>

      <Campo
        rotulo="Participantes"
        valor={participantes.length > 0 ? participantes.join(", ") : AUSENTE}
      />

      {/* EST-13 AC2: contagem e link só existem quando há registro vinculado.
          Sem registro, nem a contagem nem o link são renderizados -- não é um
          "0 registros" cinza, é ausência. */}
      {registros.length > 0 && (
        <Link
          href={`/contratos/${encontro.idContrato}/encontros`}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {registros.length === 1 ? "1 registro vinculado" : `${registros.length} registros vinculados`}
        </Link>
      )}
    </div>
  );
}

export interface EncontroPopoverProps extends ConteudoEncontroProps {
  children: React.ReactNode;
  aberto?: boolean;
  onAbertoChange?: (aberto: boolean) => void;
}

export function EncontroPopover({
  encontro,
  registros,
  children,
  aberto,
  onAbertoChange,
}: EncontroPopoverProps) {
  return (
    <Popover open={aberto} onOpenChange={onAbertoChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <ConteudoEncontro encontro={encontro} registros={registros} />
      </PopoverContent>
    </Popover>
  );
}
