import "@testing-library/jest-dom/vitest";

import { Suspense } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: pll-dashboard-agenda T3 Done-when
// (.specs/features/pll-dashboard-agenda/tasks.md) -- PLL-SH-03/PLL-SH-04.
// Este arquivo cobre só o ROTEAMENTO por slug que T3 introduz: slug="pll"
// renderiza um placeholder próprio (populado em T8-T12); Estratégia/Coalizão
// continuam pelo componente existente, sem alteração de comportamento
// (regressão). Não retesta o Quadro/Pendências/KPIs em si -- já cobertos
// noutro lugar da suíte (kpi-row.test.tsx, quadro-acompanhamento.test.tsx
// etc.); aqui o que importa é: a página escolhe o componente certo, e o
// caminho do PLL não dispara nenhuma query da Estratégia.

const mocks = vi.hoisted(() => ({
  buscarEstrategiaKpi: vi.fn(),
  buscarProjetosDoProduto: vi.fn(),
  buscarLimiares: vi.fn(),
  buscarQuadro: vi.fn(),
  buscarPendenciasDashboard: vi.fn(),
  moverEtapaKanban: vi.fn(),
  buscarOpcoesMentorPll: vi.fn(),
  buscarPllKpis: vi.fn(),
  buscarStatusMentoriaPorMes: vi.fn(),
  buscarMentoradosPll: vi.fn(),
  buscarRegistrosMentores: vi.fn(),
  buscarAnaliseParticipantePll: vi.fn(),
  buscarAnaliseMandatoPll: vi.fn(),
  buscarAfinidadeAgendaPll: vi.fn(),
}));

vi.mock("@backend/queries/estrategia-kpi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@backend/queries/estrategia-kpi")>()),
  buscarEstrategiaKpi: mocks.buscarEstrategiaKpi,
}));

vi.mock("@backend/queries/kanban", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@backend/queries/kanban")>()),
  buscarProjetosDoProduto: mocks.buscarProjetosDoProduto,
}));

vi.mock("@backend/queries/limiar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@backend/queries/limiar")>()),
  buscarLimiares: mocks.buscarLimiares,
}));

vi.mock("@backend/queries/quadro", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@backend/queries/quadro")>()),
  buscarQuadro: mocks.buscarQuadro,
}));

vi.mock("@backend/queries/pendencias", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@backend/queries/pendencias")>()),
  buscarPendenciasDashboard: mocks.buscarPendenciasDashboard,
}));

vi.mock("@backend/rpc/kanban", () => ({
  moverEtapaKanban: mocks.moverEtapaKanban,
}));

// pll-dashboard-agenda T12/T19: as 8 leituras do Dashboard real do PLL (4
// blocos P1 + 3 painéis analíticos P2, Fase 5).
vi.mock("@backend/queries/pll-dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@backend/queries/pll-dashboard")>()),
  buscarOpcoesMentorPll: mocks.buscarOpcoesMentorPll,
  buscarPllKpis: mocks.buscarPllKpis,
  buscarStatusMentoriaPorMes: mocks.buscarStatusMentoriaPorMes,
  buscarMentoradosPll: mocks.buscarMentoradosPll,
  buscarRegistrosMentores: mocks.buscarRegistrosMentores,
  buscarAnaliseParticipantePll: mocks.buscarAnaliseParticipantePll,
  buscarAnaliseMandatoPll: mocks.buscarAnaliseMandatoPll,
  buscarAfinidadeAgendaPll: mocks.buscarAfinidadeAgendaPll,
}));

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/hooks/use-produto-atual", () => ({
  useProdutoAtual: () => ({ data: { idProduto: 1, nome: "Estratégia" }, isLoading: false }),
}));

// TabelaMentoradosPll (T10) navega por useRouter -- sem este mock, o
// componente monta fora de um App Router de verdade e o Next lança
// "invariant expected app router to be mounted".
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import ProdutoDashboardPage from "./page";

// Mesmo protocolo de thenable já resolvido usado em agenda/page.test.tsx
// (comentário lá explica o porquê: `use(params)` não pode suspender no
// harness de teste).
function paramsProntos(slug: string): Promise<{ slug: string }> {
  const valor = { slug };
  return Object.assign(Promise.resolve(valor), { status: "fulfilled", value: valor });
}

function renderizarComSlug(slug: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>carregando</p>}>
        <ProdutoDashboardPage params={paramsProntos(slug)} />
      </Suspense>
    </QueryClientProvider>
  );
}

const KPI_VAZIO = {
  totalMentorados: 0,
  distribuicaoStatus: { ativo: 0, desistente: 0, desligado: 0, concluido: 0 },
  mentoriasRealizadas: 0,
  mentoriasPlanejadas: 0,
  atingimentoMedio: null,
  fatosGeradoresRegistrados: 0,
};

// T19 (Fase 5): defaults vazios/suprimidos dos 3 painéis analíticos --
// mesma forma de DistribuicaoDemografica/DistribuicaoCategorica de
// pll-dashboard.ts (T16/T17).
const DISTRIBUICAO_VAZIA = { n: 0, semResposta: 0, suprimido: true, categorias: [] };
const DISTRIBUICAO_CATEGORICA_VAZIA = { n: 0, suprimido: true, categorias: [] };
const ANALISE_PARTICIPANTE_VAZIA = {
  participantesAtivos: 0,
  identidadeGenero: DISTRIBUICAO_VAZIA,
  orientacaoSexual: DISTRIBUICAO_VAZIA,
  corRaca: DISTRIBUICAO_VAZIA,
  tempoNaPolitica: DISTRIBUICAO_VAZIA,
};
const ANALISE_MANDATO_VAZIA = {
  corRacaParlamentar: DISTRIBUICAO_VAZIA,
  partidoPolitico: DISTRIBUICAO_VAZIA,
  estadoEleicao: DISTRIBUICAO_VAZIA,
  cargosAnteriores: DISTRIBUICAO_CATEGORICA_VAZIA,
  mandatosAnteriores: DISTRIBUICAO_CATEGORICA_VAZIA,
};
const AFINIDADE_VAZIA = {
  pautas: [
    { pauta: "Educação", n: 0, suprimido: true, distribuicaoNotas: [] },
    { pauta: "Segurança Pública", n: 0, suprimido: true, distribuicaoNotas: [] },
    { pauta: "Modernização do Estado", n: 0, suprimido: true, distribuicaoNotas: [] },
    { pauta: "Clima", n: 0, suprimido: true, distribuicaoNotas: [] },
  ],
  outrasPautas: { n: 0, suprimido: true, itens: [] },
};

beforeEach(() => {
  mocks.buscarEstrategiaKpi.mockReset().mockResolvedValue(null);
  mocks.buscarProjetosDoProduto.mockReset().mockResolvedValue([]);
  mocks.buscarLimiares.mockReset().mockResolvedValue([]);
  mocks.buscarQuadro.mockReset().mockResolvedValue([]);
  mocks.buscarPendenciasDashboard.mockReset().mockResolvedValue([]);
  mocks.moverEtapaKanban.mockReset().mockResolvedValue(undefined);
  mocks.buscarOpcoesMentorPll.mockReset().mockResolvedValue([]);
  mocks.buscarPllKpis.mockReset().mockResolvedValue(KPI_VAZIO);
  mocks.buscarStatusMentoriaPorMes.mockReset().mockResolvedValue([]);
  mocks.buscarMentoradosPll.mockReset().mockResolvedValue([]);
  mocks.buscarRegistrosMentores.mockReset().mockResolvedValue([]);
  mocks.buscarAnaliseParticipantePll.mockReset().mockResolvedValue(ANALISE_PARTICIPANTE_VAZIA);
  mocks.buscarAnaliseMandatoPll.mockReset().mockResolvedValue(ANALISE_MANDATO_VAZIA);
  mocks.buscarAfinidadeAgendaPll.mockReset().mockResolvedValue(AFINIDADE_VAZIA);
});

afterEach(cleanup);

describe("Dashboard — roteamento por slug (pll-dashboard-agenda T3, PLL-SH-03/PLL-SH-04)", () => {
  it("slug='pll' renderiza o Dashboard real do PLL, sem disparar nenhuma query da Estratégia", async () => {
    renderizarComSlug("pll");

    expect(await screen.findByText("Total de mentorados")).toBeInTheDocument();
    expect(mocks.buscarQuadro).not.toHaveBeenCalled();
    expect(mocks.buscarEstrategiaKpi).not.toHaveBeenCalled();
    expect(mocks.buscarPendenciasDashboard).not.toHaveBeenCalled();
  });

  it("slug='estrategia' continua pelo componente existente (Quadro de acompanhamento renderiza)", async () => {
    renderizarComSlug("estrategia");

    expect(await screen.findByText("Quadro de acompanhamento")).toBeInTheDocument();
    expect(screen.queryByText("Total de mentorados")).not.toBeInTheDocument();
  });

  it("slug='coalizao' continua pelo componente existente (regressão)", async () => {
    renderizarComSlug("coalizao");

    expect(await screen.findByText("Quadro de acompanhamento")).toBeInTheDocument();
    expect(screen.queryByText("Total de mentorados")).not.toBeInTheDocument();
  });
});

// pll-dashboard-agenda T12 (PLL-DB-01). AD-046: tela de leitura, caminho
// feliz de cada AC.
describe("Dashboard do PLL (T12, PLL-DB-01)", () => {
  it("monta os 2 filtros e os 4 blocos com o dado das 5 queries", async () => {
    mocks.buscarOpcoesMentorPll.mockResolvedValue([{ id: 1, nome: "Carla Mentora" }]);
    mocks.buscarPllKpis.mockResolvedValue({ ...KPI_VAZIO, totalMentorados: 5 });
    mocks.buscarMentoradosPll.mockResolvedValue([
      {
        idContrato: 1,
        nomeMentorado: "Ana Souza",
        nomeParlamentar: "Dep. João Silva",
        siglaPartido: "PT",
        siglaUf: "SP",
        nomeMentor: "Carla Mentora",
        mentoriasRealizadas: 3,
        pctAtingimento: 60,
        status: "ativo",
        nomeEdicao: "2026.1",
      },
    ]);
    mocks.buscarRegistrosMentores.mockResolvedValue([
      { idRegistro: 1, nomeAutor: "Carla Mentora", nomeMentorado: "Ana Souza", ocorridoEm: "2026-09-18T10:00:00-03:00", resumo: "Encontro produtivo." },
    ]);

    renderizarComSlug("pll");

    expect(await screen.findByRole("combobox", { name: "Filtrar por mentor(a)" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por edição" })).toBeInTheDocument();
    expect(await screen.findByText("5")).toBeInTheDocument(); // Total de mentorados
    expect(screen.getByText("Ana Souza")).toBeInTheDocument(); // tabela
    expect(screen.getByText("Encontro produtivo.")).toBeInTheDocument(); // feed
  });

  it("falha de 1 bloco (KPIs) não derruba os outros -- ErroInline local", async () => {
    mocks.buscarPllKpis.mockRejectedValue(new Error("timeout"));
    mocks.buscarMentoradosPll.mockResolvedValue([
      {
        idContrato: 1,
        nomeMentorado: "Ana Souza",
        nomeParlamentar: "Dep. João Silva",
        siglaPartido: "PT",
        siglaUf: "SP",
        nomeMentor: null,
        mentoriasRealizadas: 0,
        pctAtingimento: null,
        status: "ativo",
        nomeEdicao: null,
      },
    ]);

    renderizarComSlug("pll");

    expect(await screen.findByText("Não foi possível carregar os KPIs.")).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
  });
});

// pll-dashboard-agenda T19 (PLL-DB-15…19, Fase 5). AD-046: tela de leitura,
// caminho feliz de cada AC.
describe("Dashboard do PLL — painéis de análise (T19, PLL-DB-15…19)", () => {
  it("monta os 3 painéis abaixo do feed, na ordem do Figma (participante, mandato, afinidade)", async () => {
    mocks.buscarAnaliseParticipantePll.mockResolvedValue({
      ...ANALISE_PARTICIPANTE_VAZIA,
      participantesAtivos: 7,
    });
    mocks.buscarAnaliseMandatoPll.mockResolvedValue(ANALISE_MANDATO_VAZIA);
    mocks.buscarAfinidadeAgendaPll.mockResolvedValue(AFINIDADE_VAZIA);

    renderizarComSlug("pll");

    expect(await screen.findByText("Análise do participante")).toBeInTheDocument();
    expect(screen.getByText("7 Participantes Ativos")).toBeInTheDocument();
    expect(screen.getByText("Análise do mandato")).toBeInTheDocument();
    expect(screen.getByText("Afinidade de agenda temática")).toBeInTheDocument();

    // Ordem no DOM: participante -> mandato -> afinidade (Figma 44:477).
    const titulos = screen.getAllByText(/^(Análise do participante|Análise do mandato|Afinidade de agenda temática)$/);
    expect(titulos.map((t) => t.textContent)).toEqual([
      "Análise do participante",
      "Análise do mandato",
      "Afinidade de agenda temática",
    ]);
  });

  it("falha em 1 painel (participante) não derruba os outros dois -- ErroInline local", async () => {
    mocks.buscarAnaliseParticipantePll.mockRejectedValue(new Error("timeout"));

    renderizarComSlug("pll");

    expect(await screen.findByText("Não foi possível carregar a análise do participante.")).toBeInTheDocument();
    expect(screen.getByText("Análise do mandato")).toBeInTheDocument();
    expect(screen.getByText("Afinidade de agenda temática")).toBeInTheDocument();
  });
});
