"use client";

import { use } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createClient } from "@backend/supabase/client";
import { buscarEstrategiaKpi } from "@backend/queries/estrategia-kpi";
import { buscarLimiares } from "@backend/queries/limiar";
import type { ColunaEtapaQuadro, ColunaQuadro } from "@backend/queries/quadro";
import { buscarQuadro } from "@backend/queries/quadro";
import { buscarPendenciasDashboard } from "@backend/queries/pendencias";
import type { ProdutoSlug } from "@backend/queries/produto";
import { moverEtapaKanban } from "@backend/rpc/kanban";
import { PermissaoNegadaError, TransicaoInvalidaError } from "@backend/rpc/errors";

import { useProdutoAtual } from "@/hooks/use-produto-atual";
import type { LimiaresEtapa } from "@/lib/limiar";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { KpiRow } from "@/components/estrategia/kpi-row";
import { QuadroAcompanhamento } from "@/components/estrategia/quadro-acompanhamento";
import { TabelaPendencias } from "@/components/estrategia/tabela-pendencias";

// EST-07 (T18b, .specs/features/redesenho-estrategia-tela-first/tasks.md).
// Fecha a lacuna de planejamento de T14-T18: aqueles componentes ficaram
// prontos e testados isoladamente, mas nenhuma task os ligava a esta
// página, que seguia servindo o dashboard antigo da feature kanban-etapas
// (Contratos ativos / Assessores ativos / NPS). Substituído por inteiro
// pelo Quadro de Acompanhamento + Tabela de Pendências (Figma 44:5),
// empilhados verticalmente na mesma ordem do design: Quadro em cima,
// Pendências abaixo, ambos ocupando a largura total.
//
// A faixa de KPIs que este comentário listava como fora de escopo chegou na
// Fase 8 (T33b, EST-08): KpiRow fica acima do Quadro, como no Figma 44:5, e
// lê vw_estrategia_kpi por buscarEstrategiaKpi -- nenhum dos 6 números é
// calculado aqui (AD-003).
//
// Continua fora de escopo: a barra de filtros de gestora/projeto que o Figma
// mostra acima do Quadro. A view e a query já aceitam os dois recortes
// (EST-08 AC3), então ligar os controles é só passar idGestora/idProjeto no
// filtro -- mas nenhuma task da Fase 8 os desenha, e inventá-los aqui seria
// scope creep.
//
// AD-046: tela de leitura -- caminho feliz de cada AC, sem par
// positivo/negativo de cada condicional exigido no teste de componente.
export default function ProdutoDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params) as { slug: ProdutoSlug };
  const { data: produto, isLoading: carregandoProduto } = useProdutoAtual(slug);
  const idProduto = produto?.idProduto;

  const queryClient = useQueryClient();
  const quadroQueryKey = ["quadro-acompanhamento", idProduto] as const;

  const {
    data: colunas,
    isLoading: carregandoQuadro,
    isError: erroQuadro,
    refetch: refetchQuadro,
  } = useQuery({
    queryKey: quadroQueryKey,
    queryFn: () => buscarQuadro(createClient(), { idProduto: idProduto as number }),
    enabled: idProduto !== undefined,
  });

  // EST-08 (T33b). Os 6 KPIs da faixa do topo. idProduto é o único recorte
  // hoje: os filtros de gestora/projeto que a view suporta (AC3) ainda não
  // têm controle na tela.
  const {
    data: kpi,
    isLoading: carregandoKpi,
    isError: erroKpi,
    refetch: refetchKpi,
  } = useQuery({
    queryKey: ["estrategia-kpi", idProduto],
    queryFn: () => buscarEstrategiaKpi(createClient(), { idProduto: idProduto as number }),
    enabled: idProduto !== undefined,
  });

  const {
    data: limiaresBrutos,
    isLoading: carregandoLimiares,
  } = useQuery({
    queryKey: ["limiares-pendencia"],
    queryFn: () => buscarLimiares(createClient()),
  });

  const {
    data: pendencias,
    isLoading: carregandoPendencias,
    isError: erroPendencias,
    refetch: refetchPendencias,
  } = useQuery({
    queryKey: ["pendencias-dashboard", idProduto],
    queryFn: () => buscarPendenciasDashboard(createClient(), { idProduto: idProduto as number }),
    enabled: idProduto !== undefined,
  });

  // AD-004: os dois percentuais de etapa (etapa_atencao/etapa_atrasado)
  // chegam da tabela, nunca cravados aqui -- classificarLimiar (T14) só
  // recebe o que buscarLimiares (T18b) devolveu.
  const limiares: LimiaresEtapa | undefined = limiaresBrutos && {
    atencaoPct: limiaresBrutos.find((l) => l.codigo === "etapa_atencao" && l.ativo)?.pctDuracaoEtapa ?? null,
    atrasadoPct: limiaresBrutos.find((l) => l.codigo === "etapa_atrasado" && l.ativo)?.pctDuracaoEtapa ?? null,
  };

  const { mutate: moverCard } = useMutation({
    mutationFn: (input: { idContrato: number; idEtapaDestino: number }) => moverEtapaKanban(createClient(), input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: quadroQueryKey });
      const anterior = queryClient.getQueryData<ColunaQuadro[]>(quadroQueryKey);
      if (anterior) {
        queryClient.setQueryData<ColunaQuadro[]>(
          quadroQueryKey,
          moverCardOtimista(anterior, input.idContrato, input.idEtapaDestino)
        );
      }
      return { anterior };
    },
    onError: (error, _input, context) => {
      if (context?.anterior) {
        queryClient.setQueryData(quadroQueryKey, context.anterior);
      }
      if (error instanceof TransicaoInvalidaError || error instanceof PermissaoNegadaError) {
        toast.error(error.message);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: quadroQueryKey });
    },
  });

  if (carregandoProduto || carregandoQuadro || carregandoLimiares || carregandoPendencias || carregandoKpi) {
    return <CarregandoSkeleton variante="cards" />;
  }

  if (erroQuadro) {
    return (
      <ErroInline
        mensagem="Não foi possível carregar o Quadro de Acompanhamento."
        onRetry={() => refetchQuadro()}
      />
    );
  }

  return (
    <div className="grid gap-6">
      {/* Faixa de KPIs acima do Quadro (Figma 44:5). Falha de leitura vira
          ErroInline próprio, no mesmo padrão das Pendências: um KPI que não
          carregou não pode derrubar o Quadro, que é o centro da tela. */}
      {erroKpi ? (
        <ErroInline mensagem="Não foi possível carregar os KPIs." onRetry={() => refetchKpi()} />
      ) : (
        kpi && <KpiRow kpi={kpi} />
      )}

      {!colunas || colunas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma etapa cadastrada"
          mensagem="Este produto ainda não tem etapas cadastradas no catálogo."
        />
      ) : (
        <QuadroAcompanhamento
          colunas={colunas}
          limiares={limiares}
          onMoverCard={(input) => moverCard(input)}
        />
      )}

      {erroPendencias ? (
        <ErroInline mensagem="Não foi possível carregar as Pendências." onRetry={() => refetchPendencias()} />
      ) : (
        <TabelaPendencias pendencias={pendencias ?? []} />
      )}
    </div>
  );
}

// Mesmo padrão de moverCardOtimista de KanbanBoard (kanban-board.tsx):
// remove da coluna de origem, insere na coluna de destino -- adaptado para
// ColunaQuadro porque só colunas do tipo "etapa" recebem/perdem card (a
// raia de Prospecção nunca é destino nem origem de drag, AD-040).
function moverCardOtimista(colunas: ColunaQuadro[], idContrato: number, idEtapaDestino: number): ColunaQuadro[] {
  let cardMovido: ColunaEtapaQuadro["cards"][number] | undefined;
  const semCard = colunas.map((coluna) => {
    if (coluna.tipo !== "etapa") return coluna;
    const card = coluna.cards.find((c) => c.idContrato === idContrato);
    if (!card) return coluna;
    cardMovido = card;
    return { ...coluna, cards: coluna.cards.filter((c) => c.idContrato !== idContrato) };
  });
  if (!cardMovido) return colunas;

  return semCard.map((coluna) =>
    coluna.tipo === "etapa" && coluna.idEtapa === idEtapaDestino
      ? { ...coluna, cards: [...coluna.cards, cardMovido as ColunaEtapaQuadro["cards"][number]] }
      : coluna
  );
}
