"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import type { CardKanban, ColunaKanban } from "@backend/queries/kanban";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { KanbanCard } from "@/components/kanban/kanban-card";
import { cn } from "@/lib/utils";

export interface KanbanColunaProps {
  coluna: ColunaKanban;
}

// T8 (KAN-01 AC1): cabeçalho com o nome da etapa + área useDroppable contendo
// a lista de KanbanCard. O id do droppable É o idEtapa da coluna -- o board
// (T9) resolve a coluna de destino direto por event.over.id, sem lookup
// extra (design.md: "onDragEnd calcula a coluna de destino pelo id do
// droppable").
export function KanbanColuna({ coluna }: KanbanColunaProps) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.idEtapa });

  return (
    <Card size="sm" className="flex h-full w-72 shrink-0 flex-col gap-3">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span>{coluna.nome}</span>
          <span className="text-xs font-normal text-muted-foreground">{coluna.cards.length}</span>
        </CardTitle>
      </CardHeader>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 rounded-lg p-2 transition-colors",
          isOver && "bg-muted/60"
        )}
      >
        {coluna.cards.map((card) => (
          <KanbanCardArrastavel key={card.idContrato} card={card} />
        ))}
      </div>
    </Card>
  );
}

// Cada card é seu próprio draggable -- id = idContrato, único no board. O
// board (T9) lê event.active.id pra saber qual contrato foi movido.
function KanbanCardArrastavel({ card }: { card: CardKanban }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.idContrato,
  });

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={cn("cursor-grab touch-none", isDragging && "opacity-50")}
      {...listeners}
      {...attributes}
    >
      <KanbanCard card={card} />
    </div>
  );
}
