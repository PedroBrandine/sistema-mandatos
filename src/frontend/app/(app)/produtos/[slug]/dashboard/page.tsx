"use client";

import { use, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@backend/supabase/client";
import { buscarEstrategiaKpi } from "@backend/queries/estrategia-kpi";
import { buscarProjetosDoProduto } from "@backend/queries/kanban";
import { buscarLimiares } from "@backend/queries/limiar";
import {
  buscarAfinidadeAgendaPll,
  buscarAnaliseMandatoPll,
  buscarAnaliseParticipantePll,
  buscarMentoradosPll,
  buscarOpcoesMentorPll,
  buscarPllKpis,
  buscarRegistrosMentores,
  buscarStatusMentoriaPorMes,
} from "@backend/queries/pll-dashboard";
import type { ColunaEtapaQuadro, ColunaQuadro } from "@backend/queries/quadro";
import { buscarQuadro } from "@backend/queries/quadro";
import { buscarPendenciasDashboard } from "@backend/queries/pendencias";
import type { ProdutoSlug } from "@backend/queries/produto";
import { moverEtapaKanban } from "@backend/rpc/kanban";
import { PermissaoNegadaError, TransicaoInvalidaError } from "@backend/rpc/errors";

import { useProdutoAtual } from "@/hooks/use-produto-atual";
import type { LimiaresEtapa } from "@/lib/limiar";
import { hojeNoFusoDoProduto } from "@/components/estrategia/agenda-mes";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import {
  FiltroDashboard,
  intervaloDataDoFiltro,
  type OpcaoFiltroDashboard,
  type ValorFiltroDashboard,
} from "@/components/estrategia/filtro-dashboard";
import { KpiRow } from "@/components/estrategia/kpi-row";
import { QuadroAcompanhamento } from "@/components/estrategia/quadro-acompanhamento";
import { TabelaPendencias } from "@/components/estrategia/tabela-pendencias";
import { Button } from "@/components/ui/button";
import { listaOuUndefined, MultiSelectPesquisavel, opcoesDeIdNome } from "@/components/ui/multi-select-pesquisavel";
import { FeedRegistrosMentores } from "@/components/pll/feed-registros-mentores";
import { PainelAfinidadeAgenda } from "@/components/pll/painel-afinidade-agenda";
import { PainelAnaliseMandato } from "@/components/pll/painel-analise-mandato";
import { PainelAnaliseParticipante } from "@/components/pll/painel-analise-participante";
import { PllKpiRow } from "@/components/pll/pll-kpi-row";
import { PllStatusMensalChart } from "@/components/pll/pll-status-mensal-chart";
import { TabelaMentoradosPll } from "@/components/pll/tabela-mentorados-pll";

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

  // pll-dashboard-agenda T3 (PLL-SH-03, PLL-SH-04): o PLL não reaproveita o
  // Quadro de Acompanhamento/Pendências da Estratégia (D-8, spec.md) -- rota
  // própria por slug, mesmo padrão do design.md ("Tech Decisions": roteamento
  // por slug decide o componente). T12 monta o Dashboard real do PLL.
  // Estratégia e Coalizão seguem pelo componente existente, sem alteração de
  // comportamento.
  if (slug === "pll") {
    return <PllDashboardPage />;
  }

  return <EstrategiaDashboardPage slug={slug} />;
}

function EstrategiaDashboardPage({ slug }: { slug: ProdutoSlug }) {
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
        filtro: { idsGestora: filtro.idsGestora, idsProjeto: filtro.idsProjeto, ...intervaloDataDoFiltro(filtro) },
      }),
    enabled: idProduto !== undefined,
  });

  // EST-08 (T33b). Os 6 KPIs da faixa do topo, recortados pelos mesmos
  // filtros de gestora/projeto da FiltroDashboard acima do Quadro, mais o
  // intervalo de data (2026-09-22): sem ele, um mandatário com mais de um
  // contrato de Estratégia (renovação, ciclo anterior) mistura os números do
  // contrato antigo na média/soma do período atual (fn_estrategia_kpi não
  // filtra por status). O Quadro (buscarQuadro, abaixo) e Pendências
  // (buscarPendenciasDashboard, mais abaixo) recortam pelo mesmo intervalo --
  // contrato fora do período não deve aparecer em nenhum dos três blocos.
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
        idsGestora: filtro.idsGestora,
        idsProjeto: filtro.idsProjeto,
        ...intervaloDataDoFiltro(filtro),
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
        idsGestora: filtro.idsGestora,
        idsProjeto: filtro.idsProjeto,
        ...intervaloDataDoFiltro(filtro),
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

// pll-dashboard-agenda T12 (design.md "Tech Decisions", PLL-DB-01). Dashboard
// real do PLL (Figma 44:477): 2 filtros (mentor(a)/edição, D-4) recortando os
// 4 blocos P1 (T8-T11) -- os 3 painéis analíticos (T16-T19, Fase 5) ainda não
// entram aqui, spec.md marca a aba como P2.
//
// Filtro achatado {idsMentor, idsProjeto} -- mesma forma de FiltroPllDashboard
// (queries/pll-dashboard.ts). "Edição" é ref_projeto (D-4): reaproveita
// buscarProjetosDoProduto (kanban.ts), já escopado ao produto -- mesma query
// que EstrategiaDashboardPage usa para o dropdown "Filtrar por projeto".
// "Mentor(a)" usa buscarOpcoesMentorPll (queries/pll-dashboard.ts, mesma
// família das outras 4 leituras do Dashboard PLL -- vive lá, não aqui, pra
// ficar mockável no teste desta página no mesmo padrão das outras 4 queries).
interface ValorFiltroPllDashboard {
  idsMentor?: number[];
  idsProjeto?: number[];
}

// AD-046: tela de leitura -- caminho feliz de cada AC, sem par
// positivo/negativo de cada condicional exigido no teste de componente.
function PllDashboardPage() {
  const { data: produto, isLoading: carregandoProduto } = useProdutoAtual("pll");
  const idProduto = produto?.idProduto;

  // L-002: o relógio é lido AQUI, uma vez, e desce por prop -- FeedRegistrosMentores
  // não chama `new Date()` internamente (mesmo padrão de AgendaMes.hoje).
  const hoje = useMemo(() => hojeNoFusoDoProduto(new Date()), []);

  const [filtro, setFiltro] = useState<ValorFiltroPllDashboard>({});
  const filtroConsulta = { idProduto: idProduto as number, idsMentor: filtro.idsMentor, idsProjeto: filtro.idsProjeto };

  const { data: mentores } = useQuery({
    queryKey: ["pll-dashboard-opcoes-mentor", idProduto],
    queryFn: () => buscarOpcoesMentorPll(createClient(), idProduto as number),
    enabled: idProduto !== undefined,
  });

  const { data: edicoes } = useQuery({
    queryKey: ["pll-dashboard-opcoes-edicao", idProduto],
    queryFn: () => buscarProjetosDoProduto(createClient(), idProduto as number),
    enabled: idProduto !== undefined,
  });
  const opcoesEdicao: OpcaoFiltroDashboard[] = (edicoes ?? []).map((p) => ({ id: p.idProjeto, nome: p.nome }));

  const {
    data: kpi,
    isLoading: carregandoKpi,
    isError: erroKpi,
    refetch: refetchKpi,
  } = useQuery({
    queryKey: ["pll-kpis", filtroConsulta],
    queryFn: () => buscarPllKpis(createClient(), filtroConsulta),
    enabled: idProduto !== undefined,
  });

  const {
    data: serieStatus,
    isLoading: carregandoSerie,
    isError: erroSerie,
    refetch: refetchSerie,
  } = useQuery({
    queryKey: ["pll-status-mensal", filtroConsulta],
    queryFn: () => buscarStatusMentoriaPorMes(createClient(), filtroConsulta),
    enabled: idProduto !== undefined,
  });

  const {
    data: mentorados,
    isLoading: carregandoMentorados,
    isError: erroMentorados,
    refetch: refetchMentorados,
  } = useQuery({
    queryKey: ["pll-mentorados", filtroConsulta],
    queryFn: () => buscarMentoradosPll(createClient(), filtroConsulta),
    enabled: idProduto !== undefined,
  });

  const {
    data: registros,
    isLoading: carregandoRegistros,
    isError: erroRegistros,
    refetch: refetchRegistros,
  } = useQuery({
    queryKey: ["pll-registros-mentores", filtroConsulta],
    queryFn: () => buscarRegistrosMentores(createClient(), { ...filtroConsulta, limite: 10 }),
    enabled: idProduto !== undefined,
  });

  // T19 (PLL-DB-15…19, Fase 5): os 3 painéis analíticos, abaixo do feed
  // (Figma 44:477). Mesmo padrão de erro por bloco dos 4 blocos P1 acima --
  // uma falha de leitura em `fat_cadastro_participante` (painéis de
  // participante/afinidade, T16) não derruba o painel de mandato (T17), que
  // não depende dela.
  const {
    data: analiseParticipante,
    isLoading: carregandoAnaliseParticipante,
    isError: erroAnaliseParticipante,
    refetch: refetchAnaliseParticipante,
  } = useQuery({
    queryKey: ["pll-analise-participante", filtroConsulta],
    queryFn: () => buscarAnaliseParticipantePll(createClient(), filtroConsulta),
    enabled: idProduto !== undefined,
  });

  const {
    data: analiseMandato,
    isLoading: carregandoAnaliseMandato,
    isError: erroAnaliseMandato,
    refetch: refetchAnaliseMandato,
  } = useQuery({
    queryKey: ["pll-analise-mandato", filtroConsulta],
    queryFn: () => buscarAnaliseMandatoPll(createClient(), filtroConsulta),
    enabled: idProduto !== undefined,
  });

  const {
    data: afinidadeAgenda,
    isLoading: carregandoAfinidadeAgenda,
    isError: erroAfinidadeAgenda,
    refetch: refetchAfinidadeAgenda,
  } = useQuery({
    queryKey: ["pll-afinidade-agenda", filtroConsulta],
    queryFn: () => buscarAfinidadeAgendaPll(createClient(), filtroConsulta),
    enabled: idProduto !== undefined,
  });

  if (carregandoProduto) {
    return <CarregandoSkeleton variante="cards" />;
  }

  return (
    <div className="grid gap-6">
      {/* D-4: só 2 filtros no Dashboard (mentor(a)/edição) -- "gestora" e
          "contrato" não existem no PLL (spec.md D-4). Composição inline, no
          mesmo espírito de FiltroDashboard, sem reaproveitar o componente
          (rótulos e recorte diferentes). */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
        <MultiSelectPesquisavel
          className="flex-1"
          opcoes={opcoesDeIdNome(mentores ?? [])}
          valores={filtro.idsMentor ?? []}
          onChange={(v) => setFiltro((f) => ({ ...f, idsMentor: listaOuUndefined(v) }))}
          placeholder="Filtrar por mentor(a)"
          rotuloPlural="mentores"
        />
        <MultiSelectPesquisavel
          className="flex-1"
          opcoes={opcoesDeIdNome(opcoesEdicao)}
          valores={filtro.idsProjeto ?? []}
          onChange={(v) => setFiltro((f) => ({ ...f, idsProjeto: listaOuUndefined(v) }))}
          placeholder="Filtrar por edição"
          rotuloPlural="edições"
        />
        <Button
          type="button"
          variant="ghost"
          className="font-semibold text-secondary hover:text-secondary sm:w-auto"
          onClick={() => setFiltro({})}
        >
          Limpar filtros
        </Button>
      </div>

      {/* PLL-DB-01: falha de 1 bloco não derruba os outros -- ErroInline
          local por bloco (AD-029), mesmo padrão do Dashboard de Estratégia. */}
      {erroKpi ? (
        <ErroInline mensagem="Não foi possível carregar os KPIs." onRetry={() => refetchKpi()} />
      ) : carregandoKpi || !kpi ? (
        <CarregandoSkeleton variante="cards" />
      ) : (
        <PllKpiRow kpi={kpi} />
      )}

      {erroSerie ? (
        <ErroInline mensagem="Não foi possível carregar o gráfico de status por mês." onRetry={() => refetchSerie()} />
      ) : carregandoSerie || !serieStatus ? (
        <CarregandoSkeleton variante="cards" />
      ) : (
        <PllStatusMensalChart serie={serieStatus} />
      )}

      {erroMentorados ? (
        <ErroInline mensagem="Não foi possível carregar a tabela de mentorados." onRetry={() => refetchMentorados()} />
      ) : carregandoMentorados || !mentorados ? (
        <CarregandoSkeleton variante="cards" />
      ) : (
        <TabelaMentoradosPll mentorados={mentorados} />
      )}

      {erroRegistros ? (
        <ErroInline mensagem="Não foi possível carregar os registros dos mentores." onRetry={() => refetchRegistros()} />
      ) : carregandoRegistros || !registros ? (
        <CarregandoSkeleton variante="cards" />
      ) : (
        <FeedRegistrosMentores registros={registros} hoje={hoje} />
      )}

      {/* T19 (PLL-DB-15…19): 3 painéis analíticos, na ordem do Figma
          (participante, mandato, afinidade de agenda). */}
      {erroAnaliseParticipante ? (
        <ErroInline
          mensagem="Não foi possível carregar a análise do participante."
          onRetry={() => refetchAnaliseParticipante()}
        />
      ) : carregandoAnaliseParticipante || !analiseParticipante ? (
        <CarregandoSkeleton variante="cards" />
      ) : (
        <PainelAnaliseParticipante analise={analiseParticipante} />
      )}

      {erroAnaliseMandato ? (
        <ErroInline mensagem="Não foi possível carregar a análise do mandato." onRetry={() => refetchAnaliseMandato()} />
      ) : carregandoAnaliseMandato || !analiseMandato ? (
        <CarregandoSkeleton variante="cards" />
      ) : (
        <PainelAnaliseMandato analise={analiseMandato} />
      )}

      {erroAfinidadeAgenda ? (
        <ErroInline
          mensagem="Não foi possível carregar a afinidade de agenda temática."
          onRetry={() => refetchAfinidadeAgenda()}
        />
      ) : carregandoAfinidadeAgenda || !afinidadeAgenda ? (
        <CarregandoSkeleton variante="cards" />
      ) : (
        <PainelAfinidadeAgenda afinidade={afinidadeAgenda} />
      )}
    </div>
  );
}
