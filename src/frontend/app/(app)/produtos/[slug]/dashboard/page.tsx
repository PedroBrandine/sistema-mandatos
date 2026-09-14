"use client";

import { use, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@backend/supabase/client";
import { buscarEstrategiaKpi } from "@backend/queries/estrategia-kpi";
import { buscarProjetosDoProduto } from "@backend/queries/kanban";
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
import { FiltroDashboard, type OpcaoFiltroDashboard, type ValorFiltroDashboard } from "@/components/estrategia/filtro-dashboard";
import { KpiRow } from "@/components/estrategia/kpi-row";
import { QuadroAcompanhamento } from "@/components/estrategia/quadro-acompanhamento";
import { TabelaPendencias } from "@/components/estrategia/tabela-pendencias";

// Ajuste de fidelidade visual, 2026-09-14 (Figma 44:29 "filter-bar"). Lista de
// gestoras ativas do sistema (não escopada a este produto -- mesma consulta
// de mandatos/page.tsx `buscarGestoras`, duplicada aqui de propósito: aquele
// arquivo está fora dos arquivos permitidos para edição neste ajuste
// paralelo, mesmo raciocínio de ROTULO_CATEGORIA em tabela-pendencias.tsx).
async function buscarGestorasAtivas(): Promise<OpcaoFiltroDashboard[]> {
  const { data, error } = await createClient()
    .from("dim_usuario")
    .select("id_usuario, nome")
    .eq("papel_global", "gestora")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data ?? []).map((u) => ({ id: u.id_usuario, nome: u.nome }));
}

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
// Ajuste de fidelidade visual, 2026-09-14 (Figma 44:29 "filter-bar"): a barra
// de filtros de gestora/projeto que faltava por inteiro na tela agora existe
// e filtra de verdade -- buscarQuadro, buscarEstrategiaKpi e
// buscarPendenciasDashboard já aceitavam idGestora/idProjeto desde a Fase 8
// (EST-08 AC3), então ligar os três às duas Selects é passar o filtro
// adiante, não inventar filtragem client-side nova.
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

  const [filtro, setFiltro] = useState<ValorFiltroDashboard>({});

  const queryClient = useQueryClient();
  const quadroQueryKey = ["quadro-acompanhamento", idProduto, filtro] as const;

  const {
    data: colunas,
    isLoading: carregandoQuadro,
    isError: erroQuadro,
    refetch: refetchQuadro,
  } = useQuery({
    queryKey: quadroQueryKey,
    queryFn: () =>
      buscarQuadro(createClient(), {
        idProduto: idProduto as number,
        filtro: { idGestora: filtro.idGestora, idProjeto: filtro.idProjeto },
      }),
    enabled: idProduto !== undefined,
  });

  // EST-08 (T33b). Os 6 KPIs da faixa do topo, recortados pelos mesmos
  // filtros de gestora/projeto da FiltroDashboard acima do Quadro.
  const {
    data: kpi,
    isLoading: carregandoKpi,
    isError: erroKpi,
    refetch: refetchKpi,
  } = useQuery({
    queryKey: ["estrategia-kpi", idProduto, filtro],
    queryFn: () =>
      buscarEstrategiaKpi(createClient(), {
        idProduto: idProduto as number,
        idGestora: filtro.idGestora,
        idProjeto: filtro.idProjeto,
      }),
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
    queryKey: ["pendencias-dashboard", idProduto, filtro],
    queryFn: () =>
      buscarPendenciasDashboard(createClient(), {
        idProduto: idProduto as number,
        idGestora: filtro.idGestora,
        idProjeto: filtro.idProjeto,
      }),
    enabled: idProduto !== undefined,
  });

  // Opções das duas Selects. Gestoras: lista global de usuários com papel
  // gestora (mesma consulta de mandatos/page.tsx, duplicada -- ver
  // buscarGestorasAtivas acima). Projetos: escopados ao produto atual via
  // buscarProjetosDoProduto (KAN-03, já existia em queries/kanban.ts para
  // popular exatamente este tipo de Select).
  const { data: gestoras } = useQuery({
    queryKey: ["dashboard-filtro-gestoras"],
    queryFn: buscarGestorasAtivas,
  });

  const { data: projetosDoProduto } = useQuery({
    queryKey: ["dashboard-filtro-projetos", idProduto],
    queryFn: () => buscarProjetosDoProduto(createClient(), idProduto as number),
    enabled: idProduto !== undefined,
  });

  const opcoesProjeto = useMemo<OpcaoFiltroDashboard[]>(
    () => (projetosDoProduto ?? []).map((p) => ({ id: p.idProjeto, nome: p.nome })),
    [projetosDoProduto]
  );

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
      {/* Barra de filtros (Figma 44:29), acima da faixa de KPIs. */}
      <FiltroDashboard filtro={filtro} onChange={setFiltro} gestoras={gestoras ?? []} projetos={opcoesProjeto} />

      {/* Faixa de KPIs acima do Quadro (Figma 44:5). Falha de leitura vira
          ErroInline próprio, no mesmo padrão das Pendências: um KPI que não
          carregou não pode derrubar o Quadro, que é o centro da tela. */}
      {erroKpi ? (
        <ErroInline mensagem="Não foi possível carregar os KPIs." onRetry={() => refetchKpi()} />
      ) : (
        kpi && <KpiRow kpi={kpi} />
      )}

      <div className="grid gap-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-bold uppercase tracking-wide text-secondary">Quadro de acompanhamento</h2>
          <ChevronDown className="size-3.5 text-secondary" aria-hidden="true" />
        </div>

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
      </div>

      <div className="grid gap-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-bold uppercase tracking-wide text-secondary">Pendências</h2>
          <ChevronDown className="size-3.5 text-secondary" aria-hidden="true" />
        </div>

        {erroPendencias ? (
          <ErroInline mensagem="Não foi possível carregar as Pendências." onRetry={() => refetchPendencias()} />
        ) : (
          <TabelaPendencias pendencias={pendencias ?? []} />
        )}
      </div>
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
