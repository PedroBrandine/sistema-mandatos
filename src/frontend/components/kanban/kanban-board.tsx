"use client";

import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createClient } from "@backend/supabase/client";
import { buscarBoardKanban, type CardKanban, type ColunaKanban, type FiltroBoard } from "@backend/queries/kanban";
import { moverEtapaKanban } from "@backend/rpc/kanban";
import { PermissaoNegadaError, TransicaoInvalidaError } from "@backend/rpc/errors";

import { usePapelGlobal } from "@/hooks/use-papel-global";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { KanbanColuna } from "@/components/kanban/kanban-coluna";

export interface KanbanBoardProps {
  idProduto: number;
  filtro?: FiltroBoard;
}

const MENSAGEM_SALTO_INVALIDO = new TransicaoInvalidaError().message;
const MENSAGEM_PERMISSAO_NEGADA = new PermissaoNegadaError().message;

// Move o card otimisticamente no cache local: remove da coluna de origem,
// insere na de destino. diasNaEtapaAtual/status não são recalculados aqui --
// onSettled invalida a query e traz o estado real do servidor.
function moverCardOtimista(colunas: ColunaKanban[], idContrato: number, idEtapaDestino: number): ColunaKanban[] {
  let cardMovido: CardKanban | undefined;
  const semCard = colunas.map((coluna) => {
    const card = coluna.cards.find((c) => c.idContrato === idContrato);
    if (!card) return coluna;
    cardMovido = card;
    return { ...coluna, cards: coluna.cards.filter((c) => c.idContrato !== idContrato) };
  });
  if (!cardMovido) return colunas;

  return semCard.map((coluna) =>
    coluna.idEtapa === idEtapaDestino ? { ...coluna, cards: [...coluna.cards, cardMovido as CardKanban] } : coluna
  );
}

// T9 (KAN-01, KAN-04 a KAN-09): orquestra o board -- DndContext + useQuery
// (buscarBoardKanban) + useMutation (moverEtapaKanban), com atualização
// otimista/rollback e os 2 guards client-side de design.md (adjacência de
// coluna, papel na reversão). O servidor rejeita os dois de qualquer forma
// (KAN01/42501) -- os guards aqui só evitam o request óbvio, defesa em
// profundidade real vive na RPC (T3).
export function KanbanBoard({ idProduto, filtro }: KanbanBoardProps) {
  const { papel } = usePapelGlobal();
  const queryClient = useQueryClient();
  const queryKey = ["kanban-board", idProduto, filtro] as const;

  // Fix (UAT): sem activationConstraint, o dnd-kit trata qualquer pointerdown
  // como início de drag e o clique nunca chega no <Link> de kanban-card.tsx
  // -- exigia mover 8px antes de armar o drag, deixando um clique parado
  // (sem movimento) navegar normalmente pra ficha do contrato.
  // KeyboardSensor explícito porque especificar `sensors` substitui os
  // sensores default do DndContext por inteiro -- omiti-lo aqui removeria
  // a acessibilidade por teclado que foi um dos motivos de escolher
  // @dnd-kit/core (design.md, Tech Decisions).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const { data: colunas, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => buscarBoardKanban(createClient(), idProduto, filtro),
  });

  const { mutate } = useMutation({
    mutationFn: (input: { idContrato: number; idEtapaDestino: number }) => moverEtapaKanban(createClient(), input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const anterior = queryClient.getQueryData<ColunaKanban[]>(queryKey);
      if (anterior) {
        queryClient.setQueryData<ColunaKanban[]>(
          queryKey,
          moverCardOtimista(anterior, input.idContrato, input.idEtapaDestino)
        );
      }
      return { anterior };
    },
    onError: (error, _input, context) => {
      if (context?.anterior) {
        queryClient.setQueryData(queryKey, context.anterior);
      }
      // Falha de rede: sem toast alarmante (Edge Case, design.md) -- só
      // rollback silencioso. KAN01/42501 chegando aqui é bypass/race (o
      // guard client-side já devia ter impedido o request) -- ainda assim
      // avisa o usuário com a mesma mensagem da rejeição client-side.
      if (error instanceof TransicaoInvalidaError || error instanceof PermissaoNegadaError) {
        toast.error(error.message);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !colunas) return;

    const idContrato = Number(active.id);
    const idEtapaDestino = Number(over.id);

    const colunaOrigem = colunas.find((c) => c.cards.some((card) => card.idContrato === idContrato));
    const colunaDestino = colunas.find((c) => c.idEtapa === idEtapaDestino);
    if (!colunaOrigem || !colunaDestino || colunaOrigem.idEtapa === colunaDestino.idEtapa) return;

    const delta = colunaDestino.ordem - colunaOrigem.ordem;

    if (delta !== 1 && delta !== -1) {
      toast.error(MENSAGEM_SALTO_INVALIDO);
      return;
    }

    if (delta === -1 && papel !== "admin" && papel !== "gestora") {
      toast.error(MENSAGEM_PERMISSAO_NEGADA);
      return;
    }

    mutate({ idContrato, idEtapaDestino });
  }

  if (isLoading) {
    return <CarregandoSkeleton />;
  }

  if (isError) {
    return <ErroInline mensagem="Não foi possível carregar o Kanban do produto." onRetry={() => refetch()} />;
  }

  if (!colunas || colunas.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma etapa cadastrada"
        mensagem="Este produto ainda não tem etapas cadastradas no catálogo."
      />
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {colunas.map((coluna) => (
          <KanbanColuna key={coluna.idEtapa} coluna={coluna} />
        ))}
      </div>
    </DndContext>
  );
}
