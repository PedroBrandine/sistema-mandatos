import "@testing-library/jest-dom/vitest";

import { Suspense } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Aba "Fatos Geradores" do produto: Incidência de todos os mandatos, com
// filtros Gestora / Projeto / Contrato e cada item identificado pelo mandato.
// Tela de leitura (AD-046): caminho feliz de cada comportamento principal.
//
// Os selects do Radix não são o alvo aqui (filtros-fatos-geradores.test.tsx
// cobre a barra); o componente é trocado por botões que disparam `onChange`,
// para provar o que é DESTA página: como o filtro vira consulta.

const mocks = vi.hoisted(() => ({
  buscarMandatosLista: vi.fn(),
  buscarIncidenciaDoProduto: vi.fn(),
  buscarEstrategiaKpi: vi.fn(),
  buscarGestorasAtivas: vi.fn(),
  buscarProjetosAtivos: vi.fn(),
  visao: "linha-do-tempo",
}));

vi.mock("@backend/queries/mandatos-lista", () => ({ buscarMandatosLista: mocks.buscarMandatosLista }));
vi.mock("@backend/queries/incidencia-produto", () => ({ buscarIncidenciaDoProduto: mocks.buscarIncidenciaDoProduto }));
vi.mock("@backend/queries/estrategia-kpi", () => ({ buscarEstrategiaKpi: mocks.buscarEstrategiaKpi }));
vi.mock("@backend/queries/opcoes-filtro", () => ({
  buscarGestorasAtivas: mocks.buscarGestorasAtivas,
  buscarProjetosAtivos: mocks.buscarProjetosAtivos,
}));
vi.mock("@backend/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/hooks/use-produto-atual", () => ({
  useProdutoAtual: () => ({ data: { idProduto: 1, nome: "Estratégia" }, isLoading: false }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/produtos/estrategia/fatos-geradores",
  useSearchParams: () => new URLSearchParams(`visao=${mocks.visao}`),
}));

// IipCard (aba com um contrato só) bate no banco por conta própria; o que
// importa aqui é QUAL cartão a página escolhe, não o que ele lê.
vi.mock("@/components/incidencia/iip-card", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/incidencia/iip-card")>()),
  IipCard: ({ idContrato }: { idContrato: number }) => <div>IIP do contrato {idContrato}</div>,
}));

vi.mock("@/components/estrategia/filtros-fatos-geradores", () => ({
  FiltrosFatosGeradores: ({
    filtro,
    onChange,
    contratos,
  }: {
    filtro: Record<string, number[] | undefined>;
    onChange: (f: Record<string, number[] | undefined>) => void;
    contratos: { id: number; nome: string }[];
  }) => (
    <div>
      <p data-testid="opcoes-contrato">{contratos.map((c) => c.nome).join("|")}</p>
      <button type="button" onClick={() => onChange({ ...filtro, idsGestora: [5] })}>
        escolher gestora
      </button>
      <button type="button" onClick={() => onChange({ ...filtro, idsContrato: [8] })}>
        escolher contrato
      </button>
      <button type="button" onClick={() => onChange({ ...filtro, idsContrato: [7, 8] })}>
        escolher dois contratos
      </button>
    </div>
  ),
}));

import ProdutoFatosGeradoresPage from "./page";

const MANDATO_ANA = {
  idContrato: 7,
  nomeContratante: "Dep. Ana Ribeiro",
  dtInicio: "2026-01-01",
  dtFim: null,
  status: "ativo" as const,
  nomeGestora: "Gestora 1",
  nomeProjeto: null,
  nomeEtapaAtual: null,
  nomeResponsavel: null,
  atualizadoEm: "2026-09-01",
};
const MANDATO_BRUNO = { ...MANDATO_ANA, idContrato: 8, nomeContratante: "Sen. Bruno Lima", nomeProjeto: "Projeto Alfa" };

const INCIDENCIA = {
  registros: [],
  insights: [
    { idInsight: 1, conteudo: "Insight da Ana", pilar: null, ocorridoEm: "2026-09-05" },
    { idInsight: 2, conteudo: "Insight do Bruno", pilar: null, ocorridoEm: "2026-09-04" },
  ],
  fatosGeradores: [
    {
      idFatoGerador: 3,
      tipologia: "x",
      niveis: { d1: null, d2: null, d3: null },
      titulo: "Fato do Bruno",
      situacao: "realizado" as const,
      dtOcorrencia: "2026-09-06",
      dtPrevista: null,
    },
  ],
  preInsights: [],
  timeline: [
    { tipo: "insight" as const, idOrigem: 1, titulo: "Insight da Ana", dataEvento: "2026-09-05", criadoEm: null, idUsuarioAutor: null, nomeAutor: null, idContrato: 7 },
    { tipo: "insight" as const, idOrigem: 2, titulo: "Insight do Bruno", dataEvento: "2026-09-04", criadoEm: null, idUsuarioAutor: null, nomeAutor: null, idContrato: 8 },
  ],
  cadeias: [
    { idFatoGerador: 3, titulo: "Fato do Bruno", situacao: "realizado" as const, dataEvento: "2026-09-06", chaveOrigem: "fato:3", idContrato: 8, origem: null },
  ],
};

// Mesmo truque de agenda/page.test.tsx: `use(params)` só resolve sem suspender
// se a promise já vier no formato de thenable resolvido.
function paramsProntos(slug: string): Promise<{ slug: string }> {
  const valor = { slug };
  return Object.assign(Promise.resolve(valor), { status: "fulfilled", value: valor });
}

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>carregando</p>}>
        <ProdutoFatosGeradoresPage params={paramsProntos("estrategia")} />
      </Suspense>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.visao = "linha-do-tempo";
  mocks.buscarGestorasAtivas.mockResolvedValue([]);
  mocks.buscarProjetosAtivos.mockResolvedValue([]);
  mocks.buscarMandatosLista.mockResolvedValue([MANDATO_ANA, MANDATO_BRUNO]);
  mocks.buscarIncidenciaDoProduto.mockResolvedValue(INCIDENCIA);
  mocks.buscarEstrategiaKpi.mockResolvedValue({
    iipMedio: 8.4,
    componenteD1Medio: 2.8,
    componenteD2Medio: 3.1,
    componenteD3Medio: 2.5,
  });
});

afterEach(cleanup);

describe("Aba Fatos Geradores do produto", () => {
  it("lê a Incidência de TODOS os mandatos do produto por padrão", async () => {
    renderizar();

    await waitFor(() => expect(mocks.buscarIncidenciaDoProduto).toHaveBeenCalled());
    expect(mocks.buscarIncidenciaDoProduto.mock.calls[0][1]).toEqual([7, 8]);
    // Sem filtro de status: mandato concluído/desligado também tem histórico.
    expect(mocks.buscarMandatosLista).toHaveBeenCalledWith({}, { idProduto: 1, idsGestora: undefined, idsProjeto: undefined });
  });

  it("identifica o mandato de cada item da Linha do Tempo", async () => {
    renderizar();

    expect(await screen.findByRole("button", { name: /Insight da Ana/ })).toHaveTextContent("Dep. Ana Ribeiro");
    // Projeto entra no rótulo para distinguir dois contratos do mesmo contratante.
    expect(screen.getByRole("button", { name: /Insight do Bruno/ })).toHaveTextContent("Sen. Bruno Lima · Projeto Alfa");
  });

  it("as opções do select Contrato são os mandatos do recorte", async () => {
    renderizar();

    await waitFor(() =>
      expect(screen.getByTestId("opcoes-contrato")).toHaveTextContent("Dep. Ana Ribeiro|Sen. Bruno Lima · Projeto Alfa")
    );
  });

  it("escolher Gestora refaz a lista de mandatos com o filtro", async () => {
    renderizar();
    await screen.findByRole("button", { name: /Insight da Ana/ });

    fireEvent.click(screen.getByRole("button", { name: "escolher gestora" }));

    await waitFor(() =>
      expect(mocks.buscarMandatosLista).toHaveBeenLastCalledWith({}, { idProduto: 1, idsGestora: [5], idsProjeto: undefined })
    );
  });

  it("escolher um Contrato restringe a leitura àquele mandato", async () => {
    renderizar();
    await screen.findByRole("button", { name: /Insight da Ana/ });

    fireEvent.click(screen.getByRole("button", { name: "escolher contrato" }));

    await waitFor(() => expect(mocks.buscarIncidenciaDoProduto).toHaveBeenLastCalledWith({}, [8]));
  });

  it("trocar a Gestora mantém o Contrato escolhido enquanto ele continua no recorte", async () => {
    renderizar();
    await screen.findByRole("button", { name: /Insight da Ana/ });
    fireEvent.click(screen.getByRole("button", { name: "escolher contrato" }));
    await waitFor(() => expect(mocks.buscarIncidenciaDoProduto).toHaveBeenLastCalledWith({}, [8]));

    fireEvent.click(screen.getByRole("button", { name: "escolher gestora" }));

    // A lista de mandatos continua trazendo o 8, então a seleção não é perdida.
    await waitFor(() =>
      expect(mocks.buscarMandatosLista).toHaveBeenLastCalledWith({}, { idProduto: 1, idsGestora: [5], idsProjeto: undefined })
    );
    expect(mocks.buscarIncidenciaDoProduto).toHaveBeenLastCalledWith({}, [8]);
  });

  it("Contrato marcado que sai do recorte deixa de valer -- volta a ler o recorte inteiro", async () => {
    // Com Gestora escolhida só o mandato 7 sobra; o Contrato 8, marcado antes,
    // não está mais na lista e não pode continuar filtrando a tela.
    mocks.buscarMandatosLista.mockImplementation(async (_client: unknown, filtro: { idsGestora?: number[] }) =>
      filtro.idsGestora ? [MANDATO_ANA] : [MANDATO_ANA, MANDATO_BRUNO]
    );
    renderizar();
    await screen.findByRole("button", { name: /Insight da Ana/ });
    fireEvent.click(screen.getByRole("button", { name: "escolher contrato" }));
    await waitFor(() => expect(mocks.buscarIncidenciaDoProduto).toHaveBeenLastCalledWith({}, [8]));

    fireEvent.click(screen.getByRole("button", { name: "escolher gestora" }));

    await waitFor(() => expect(mocks.buscarIncidenciaDoProduto).toHaveBeenLastCalledWith({}, [7]));
  });

  it("escolher vários Contratos lê a Incidência só desses mandatos", async () => {
    mocks.buscarMandatosLista.mockResolvedValue([MANDATO_ANA, MANDATO_BRUNO, { ...MANDATO_ANA, idContrato: 9 }]);
    renderizar();
    await screen.findByRole("button", { name: /Insight da Ana/ });

    fireEvent.click(screen.getByRole("button", { name: "escolher dois contratos" }));

    await waitFor(() => expect(mocks.buscarIncidenciaDoProduto).toHaveBeenLastCalledWith({}, [7, 8]));
  });

  it("recorte sem nenhum mandato mostra estado vazio, não zeros", async () => {
    mocks.buscarMandatosLista.mockResolvedValue([]);
    renderizar();

    expect(await screen.findByText("Nenhum mandato neste recorte")).toBeInTheDocument();
    expect(mocks.buscarIncidenciaDoProduto).not.toHaveBeenCalled();
  });

  it("falha na leitura mostra erro com a mensagem, sem tela quebrada", async () => {
    mocks.buscarIncidenciaDoProduto.mockRejectedValue(new Error("banco fora do ar"));
    renderizar();

    expect(await screen.findByText(/banco fora do ar/)).toBeInTheDocument();
  });
});

describe("Aba Fatos Geradores do produto — Ciclo de Vida", () => {
  beforeEach(() => {
    mocks.visao = "ciclo-de-vida";
  });

  it("KPIs contam a Incidência de todos os mandatos e a cadeia diz de qual mandato é", async () => {
    renderizar();

    const insights = await screen.findByRole("group", { name: "Insights" });
    expect(insights).toHaveTextContent("2");
    expect(screen.getByRole("group", { name: "Fatos Geradores" })).toHaveTextContent("1/1");
    expect(screen.getByText("Sen. Bruno Lima · Projeto Alfa")).toBeInTheDocument();
  });

  it("sem Contrato escolhido, o IIP é a média dos mandatos do recorte", async () => {
    renderizar();

    const iip = await screen.findByRole("group", { name: /IIP médio/ });
    expect(iip).toHaveTextContent("8,4");
    expect(iip).toHaveTextContent("D1 2,8");
    expect(mocks.buscarEstrategiaKpi).toHaveBeenCalledWith(
      {},
      { idProduto: 1, idsGestora: undefined, idsProjeto: undefined, idsContrato: undefined }
    );
  });

  it("com VÁRIOS Contratos escolhidos, o IIP é a média deles, calculada no banco (não soma de cartões)", async () => {
    renderizar();
    await screen.findByRole("group", { name: /IIP médio/ });

    fireEvent.click(screen.getByRole("button", { name: "escolher dois contratos" }));

    await waitFor(() =>
      expect(mocks.buscarEstrategiaKpi).toHaveBeenLastCalledWith(
        {},
        { idProduto: 1, idsGestora: undefined, idsProjeto: undefined, idsContrato: [7, 8] }
      )
    );
    expect(screen.getByRole("group", { name: /IIP médio/ })).toBeInTheDocument();
    expect(screen.queryByText(/IIP do contrato/)).not.toBeInTheDocument();
  });

  it("com um Contrato escolhido, o IIP passa a ser o do próprio contrato", async () => {
    renderizar();
    await screen.findByRole("group", { name: /IIP médio/ });

    fireEvent.click(screen.getByRole("button", { name: "escolher contrato" }));

    expect(await screen.findByText("IIP do contrato 8")).toBeInTheDocument();
  });
});
