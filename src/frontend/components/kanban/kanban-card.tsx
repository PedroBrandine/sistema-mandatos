import Link from "next/link";

import type { CardKanban } from "@backend/queries/kanban";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// KAN-01 (AC4): card mostra nome do contratante e "há N dias na etapa atual"
// sempre; badge de status só quando statusContrato !== 'ativo' (Edge Case --
// contrato encerrado continua visível, com indicação visual, nunca some do
// board). Puramente apresentacional -- o drag (useDraggable) é wireado em
// kanban-coluna.tsx (T8), que é quem itera sobre os cards da coluna.
//
// Fix (UAT): card inteiro é um <Link> pra ficha do contrato -- mesmo padrão
// de produtos/[slug]/contratos/page.tsx. Só funciona porque kanban-board.tsx
// configura activationConstraint({ distance: 8 }) no PointerSensor: sem
// isso, o próprio dnd-kit intercepta o pointerdown e o clique nunca chega
// no <Link> (achado real de UAT, não estava coberto pelo Validate --
// débito de teste, sem harness de componente pra simular clique+drag).
const STATUS_LABEL: Record<string, string> = {
  concluido: "Concluído",
  nao_concluido: "Não concluído",
};

const STATUS_VARIANT: Record<string, "secondary" | "default" | "outline" | "ghost"> = {
  concluido: "outline",
  nao_concluido: "secondary",
};

export interface KanbanCardProps {
  card: CardKanban;
}

export function KanbanCard({ card }: KanbanCardProps) {
  return (
    <Link href={`/contratos/${card.idContrato}`} className="block">
      <Card size="sm" className="gap-2 p-3 transition-colors hover:border-primary/50">
        <CardContent className="grid gap-1.5 p-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug">{card.nomeContratante}</p>
            {card.statusContrato !== "ativo" ? (
              <Badge variant={STATUS_VARIANT[card.statusContrato] ?? "secondary"}>
                {STATUS_LABEL[card.statusContrato] ?? card.statusContrato}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            há {card.diasNaEtapaAtual} {card.diasNaEtapaAtual === 1 ? "dia" : "dias"} na etapa atual
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
