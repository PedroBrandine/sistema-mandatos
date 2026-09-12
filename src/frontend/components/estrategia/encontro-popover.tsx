"use client";

import Link from "next/link";

import type { EncontroAgenda } from "@backend/queries/agenda";
import type { RegistroAgenda } from "@backend/queries/registros-agenda";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
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

// EST-13 AC3: o aviso e a ação de presença existem só quando a data prevista
// JÁ PASSOU **e** o status é `planejado`. As duas metades são independentes e
// cada uma tem caso dos dois lados no teste (lição L-036): um encontro futuro
// planejado não oferece a ação, e um encontro vencido já realizado também
// não. Comparação de strings "YYYY-MM-DD" no fuso do produto -- nunca Date
// contra Date, que reintroduziria o fuso da máquina.
export function encontroVencido(encontro: EncontroAgenda, hoje: string): boolean {
  if (encontro.status !== "planejado") return false;
  if (!encontro.dtPrevistaInicio) return false;
  return diaNoFusoDoProduto(encontro.dtPrevistaInicio) < hoje;
}

export interface ConteudoEncontroProps {
  encontro: EncontroAgenda;
  /** Registros já filtrados por este encontro (buscarRegistrosDaAgenda, T27). */
  registros: RegistroAgenda[];
  /** Data de referência "YYYY-MM-DD" — explícita, nunca lida do relógio (L-002). */
  hoje: string;
  onMarcarPresenca?: (input: { idEncontro: number }) => void;
  onAdicionarRegistro?: (input: { idEncontro: number; idContrato: number }) => void;
  marcandoPresenca?: boolean;
  /** Falha da RPC de presença, já traduzida por mapeiaErroRpc. */
  erroPresenca?: string | null;
}

export function ConteudoEncontro({
  encontro,
  registros,
  hoje,
  onMarcarPresenca,
  onAdicionarRegistro,
  marcandoPresenca = false,
  erroPresenca = null,
}: ConteudoEncontroProps) {
  const participantes = encontro.participantes.map((p) => p.nome).filter((n) => n.trim() !== "");
  const vencido = encontroVencido(encontro, hoje);

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

      {/* EST-13 AC3: aviso + ação de presença, só no encontro vencido e
          planejado. */}
      {vencido && (
        <div className="grid gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="text-xs text-amber-900 dark:text-amber-100">
            A data prevista já passou e este encontro segue como agendado.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={marcandoPresenca}
            onClick={() => onMarcarPresenca?.({ idEncontro: encontro.idEncontro })}
          >
            {marcandoPresenca ? "Marcando…" : "Marcar presença"}
          </Button>
        </div>
      )}

      {/* Erro da escrita pelo componente padrão do projeto (lição L-008),
          nunca por um elemento ad-hoc. */}
      {erroPresenca && <ErroInline titulo="Não foi possível marcar presença" mensagem={erroPresenca} />}

      {/* EST-13 AC6: a criação já nasce vinculada ao encontro E ao contrato --
          os dois identificadores vão no payload, não só o encontro. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onAdicionarRegistro?.({
            idEncontro: encontro.idEncontro,
            idContrato: encontro.idContrato,
          })
        }
      >
        Adicionar registro
      </Button>
    </div>
  );
}

export interface EncontroPopoverProps extends ConteudoEncontroProps {
  children: React.ReactNode;
  aberto?: boolean;
  onAbertoChange?: (aberto: boolean) => void;
}

// O rest repassa TODAS as props de conteúdo (incluindo hoje, callbacks e
// estado de erro) em vez de listá-las uma a uma: uma prop nova acrescentada a
// ConteudoEncontroProps passa a chegar sozinha, sem virar prop silenciosamente
// descartada aqui.
export function EncontroPopover({
  children,
  aberto,
  onAbertoChange,
  ...conteudo
}: EncontroPopoverProps) {
  return (
    <Popover open={aberto} onOpenChange={onAbertoChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <ConteudoEncontro {...conteudo} />
      </PopoverContent>
    </Popover>
  );
}
