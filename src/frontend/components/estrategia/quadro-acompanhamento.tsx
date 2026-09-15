"use client";

import Link from "next/link";

import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import type { CardEtapaQuadro, CardProspeccaoQuadro, ColunaEtapaQuadro, ColunaQuadro } from "@backend/queries/quadro";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { classificarLimiar, type LimiaresEtapa, type EstadoLimiarEtapa } from "@/lib/limiar";
import { cn } from "@/lib/utils";

// EST-07 (T16, design.md "QuadroAcompanhamento"). AD-046: tela de leitura --
// caminho feliz de cada AC, sem par positivo/negativo de cada condicional.
//
// Presentational + interativo: recebe `colunas` já resolvidas (buscarQuadro,
// T15) e devolve o movimento pretendido via `onMoverCard`, sem buscar dados
// nem chamar moverEtapaKanban por conta própria -- a orquestração de
// useQuery/useMutation fica para a task que montar a página do Dashboard
// (fora do escopo aprovado deste batch, ver Registro de execução). Mesmo
// esqueleto de DnD de KanbanBoard/KanbanColuna (sensors, useDraggable,
// useDroppable): card de etapa é arrastável e cada coluna de etapa é
// droppable pelo idEtapa; a raia de Prospecção nunca recebe useDraggable --
// não arrastável por construção (AD-040), não por uma checagem condicional.
//
// Card não é o KanbanCard existente: aqui o badge reflete o limiar (T14),
// não o status do contrato, e há uma linha extra de cargo/partido (EST-07
// AC2) -- por isso um render próprio, mantendo os hooks de DnD idênticos.
export interface QuadroAcompanhamentoProps {
  colunas: ColunaQuadro[];
  limiares?: LimiaresEtapa;
  onMoverCard?: (input: { idContrato: number; idEtapaDestino: number }) => void;
}

const ESTADO_LABEL: Record<EstadoLimiarEtapa, string> = {
  normal: "Normal",
  atencao: "Atenção",
  atrasado: "Atrasado",
};

const ESTADO_DOT_CLASS: Record<EstadoLimiarEtapa, string> = {
  normal: "bg-emerald-500",
  atencao: "bg-amber-500",
  atrasado: "bg-destructive",
};

// Ajuste de fidelidade visual, 2026-09-14 (Figma 86:2/86:5/211:51): o badge
// do card é um chip com fundo na cor do estado a ~14% de opacidade, não só
// dot + texto solto. Reaproveita as mesmas classes de paleta de
// ESTADO_DOT_CLASS (Tailwind, sem hex cru) só com o modificador de opacidade.
const ESTADO_BADGE_CLASS: Record<EstadoLimiarEtapa, string> = {
  normal: "bg-emerald-500/14 text-emerald-600",
  atencao: "bg-amber-500/14 text-amber-600",
  atrasado: "bg-destructive/14 text-destructive",
};

function formatarCargoPartido(cargo: string | null, partido: string | null): string | null {
  const partes = [cargo, partido].filter((v): v is string => Boolean(v && v.trim() !== ""));
  return partes.length > 0 ? partes.join(" · ") : null;
}

// KSM-17. Distância mínima (px) antes de o dnd-kit assumir o ponteiro como
// arrasto. NÃO é ajuste de ergonomia: é o que faz clique e arraste coexistirem
// no mesmo card. Com 0, o dnd-kit consome o `pointerdown` e o <Link> do card
// nunca dispara -- exatamente a regressão que KSM-16 corrigiu. Exportada para
// que o teste possa provar que o sensor é criado com ela.
export const ATIVACAO_ARRASTE_PX = 8;

export function QuadroAcompanhamento({ colunas, limiares, onMoverCard }: QuadroAcompanhamentoProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: ATIVACAO_ARRASTE_PX } }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event: { active: { id: string | number }; over: { id: string | number } | null }) {
    const { active, over } = event;
    if (!over || !onMoverCard) return;

    const idContrato = idContratoDoDraggable(active.id);
    const idEtapaDestino = idEtapaDoDroppable(over.id);
    if (idContrato === null || idEtapaDestino === null) return;

    onMoverCard({ idContrato, idEtapaDestino });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {colunas.map((coluna) =>
          coluna.tipo === "prospeccao" ? (
            <ColunaProspeccao key={coluna.codigo} coluna={coluna} />
          ) : (
            <ColunaEtapa key={coluna.idEtapa} coluna={coluna} limiares={limiares} />
          )
        )}
      </div>
    </DndContext>
  );
}

// Ajuste de fidelidade visual, 2026-09-14: pedido explícito do Pedro --
// "max-height + scroll interno no Kanban". Cada coluna ganha altura fixa
// (em vez de esticar com o conteúdo) e só a lista de cards dentro dela rola
// (overflow-y-auto no min-h-0 acima); o cabeçalho da coluna (nome + contagem)
// fica sempre visível. Isso também é o que trava a altura da seção inteira
// do Quadro, independente de quantos cards qualquer coluna acumule --
// independente da rolagem própria da TabelaPendencias (EstadoVazio da seção
// de baixo).
const ALTURA_COLUNA = "h-[520px]";

const PREFIXO_DRAGGABLE_CONTRATO = "contrato-";

function idContratoDoDraggable(id: string | number): number | null {
  if (typeof id !== "string" || !id.startsWith(PREFIXO_DRAGGABLE_CONTRATO)) return null;
  const idContrato = Number(id.slice(PREFIXO_DRAGGABLE_CONTRATO.length));
  return Number.isFinite(idContrato) ? idContrato : null;
}

function idEtapaDoDroppable(id: string | number): number | null {
  const idEtapa = Number(id);
  return Number.isFinite(idEtapa) ? idEtapa : null;
}

function ColunaProspeccao({ coluna }: { coluna: Extract<ColunaQuadro, { tipo: "prospeccao" }> }) {
  return (
    <Card size="sm" className={cn(ALTURA_COLUNA, "flex w-72 shrink-0 flex-col gap-3 bg-muted/30")}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span>{coluna.nome}</span>
          <span className="text-xs font-normal text-muted-foreground">{coluna.cards.length}</span>
        </CardTitle>
      </CardHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg p-2">
        {coluna.cards.length === 0 ? (
          <p className="p-2 text-xs italic text-muted-foreground">Nenhuma prospecção aberta.</p>
        ) : (
          coluna.cards.map((card) => <CardProspeccaoView key={card.idProspeccao} card={card} />)
        )}
      </div>
    </Card>
  );
}

function CardProspeccaoView({ card }: { card: CardProspeccaoQuadro }) {
  return (
    <Card size="sm" className="gap-2 p-3">
      <p className="text-sm font-medium leading-snug">{card.nomeContratante}</p>
      <p className="text-xs text-muted-foreground">
        {card.diasEmAberto} {card.diasEmAberto === 1 ? "dia" : "dias"} em prospecção
      </p>
    </Card>
  );
}

function ColunaEtapa({ coluna, limiares }: { coluna: ColunaEtapaQuadro; limiares?: LimiaresEtapa }) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.idEtapa });

  return (
    <Card size="sm" className={cn(ALTURA_COLUNA, "flex w-72 shrink-0 flex-col gap-3")}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span>{coluna.nome}</span>
          <span className="text-xs font-normal text-muted-foreground">{coluna.cards.length}</span>
        </CardTitle>
      </CardHeader>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg p-2 transition-colors",
          isOver && "bg-muted/60"
        )}
      >
        {coluna.cards.length === 0 ? (
          <p className="p-2 text-xs italic text-muted-foreground">Nenhum mandato nesta etapa.</p>
        ) : (
          coluna.cards.map((card) => (
            <CardEtapaArrastavel key={card.idContrato} card={card} duracaoPrevistaDias={coluna.duracaoPrevistaDias} limiares={limiares} />
          ))
        )}
      </div>
    </Card>
  );
}

function CardEtapaArrastavel({
  card,
  duracaoPrevistaDias,
  limiares,
}: {
  card: CardEtapaQuadro;
  duracaoPrevistaDias: number | null;
  limiares?: LimiaresEtapa;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${PREFIXO_DRAGGABLE_CONTRATO}${card.idContrato}`,
  });

  const estado = classificarLimiar(card.diasNaEtapaAtual, duracaoPrevistaDias, limiares);
  const subtitulo = formatarCargoPartido(card.cargoAtual, card.partidoAtual);

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={cn("cursor-grab touch-none", isDragging && "opacity-50")}
      {...listeners}
      {...attributes}
    >
      {/* KSM-16. O <Link> fica DENTRO do nó arrastável, nunca em volta dele:
          por fora, o transform do dnd-kit passaria a ser aplicado sobre o
          elemento de navegação e o arrasto viraria clique. Mesmo padrão de
          kanban-card.tsx -- de onde este componente herdou o esqueleto de
          DnD sem herdar o link, que é a regressão que KSM-16 corrige.

          Só funciona por causa do activationConstraint({ distance: 8 }) no
          PointerSensor (ver `sensors` acima): sem essa distância o dnd-kit
          consome o pointerdown e o clique nunca chega ao <Link>. */}
      <Link href={`/contratos/${card.idContrato}`} className="block">
        <Card size="sm" className="gap-1.5 p-3 transition-colors hover:border-primary/50">
          <p className="text-sm font-medium leading-snug">{card.nomeContratante}</p>
          {subtitulo ? <p className="text-xs text-muted-foreground">{subtitulo}</p> : null}
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-medium text-secondary">
              {card.diasNaEtapaAtual} {card.diasNaEtapaAtual === 1 ? "dia" : "dias"} na etapa
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[9px] font-medium",
                ESTADO_BADGE_CLASS[estado]
              )}
            >
              <span className={cn("size-1.5 rounded-full", ESTADO_DOT_CLASS[estado])} />
              {ESTADO_LABEL[estado]}
            </span>
          </div>
        </Card>
      </Link>
    </div>
  );
}
