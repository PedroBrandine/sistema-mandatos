import "@testing-library/jest-dom/vitest";

import { Suspense } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: tasks.md T15 "Done when" (PLL-CP-14…19):
//  - Página monta cabeçalho + Dados TSE + Composição Partidária + Afinidade
//  - npm run lint:all && npm run build && npm run test:unit verdes
// FichaDadosTse/FichaAfinidadeAgenda já têm suíte própria (T14) -- aqui elas
// são mockadas por stand-ins que expõem os props recebidos, provando a
// COMPOSIÇÃO (dado real chega no componente certo), não repetindo o
// comportamento interno de cada uma.

const mocks = vi.hoisted(() => ({
  buscarTodasCandidaturasPorTitulo: vi.fn(),
  buscarPerfilCandidatura: vi.fn(),
  buscarComposicaoPartidariaCasa: vi.fn(),
  push: vi.fn(),
  respostaCadastro: null as unknown,
  respostaVinculo: null as unknown,
  respostaMandato: null as unknown,
  respostaVigente: null as unknown,
}));

vi.mock("@backend/queries/tse", () => ({
  buscarTodasCandidaturasPorTitulo: mocks.buscarTodasCandidaturasPorTitulo,
  buscarPerfilCandidatura: mocks.buscarPerfilCandidatura,
  buscarComposicaoPartidariaCasa: mocks.buscarComposicaoPartidariaCasa,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

// Builder encadeável roteado por nome de tabela, no mesmo padrão de
// participantes/page.test.tsx.
vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: (tabela: string) => {
      const resposta =
        tabela === "fat_cadastro_participante"
          ? mocks.respostaCadastro
          : tabela === "rel_mandato_candidatura"
            ? // 1ª chamada busca id_mandato pelo vínculo, 2ª busca o vigente --
              // ambas passam por `.eq()` duas vezes; resolve pela presença de
              // `id_mandato` na resposta configurada em cada teste.
              mocks.respostaVinculo
            : mocks.respostaMandato;
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => Promise.resolve(resposta),
        then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
          Promise.resolve(resposta).then(resolve, reject),
      };
      return builder;
    },
  }),
}));

vi.mock("@/components/pll/ficha-dados-tse", () => ({
  FichaDadosTse: (props: {
    vinculadoTse: boolean;
    candidaturas: { anoEleicao: number; votosRecebidos: number }[];
    onVincular?: () => void;
  }) => (
    <div data-testid="ficha-dados-tse">
      <p>Vinculado: {String(props.vinculadoTse)}</p>
      <p>Candidaturas: {props.candidaturas.length}</p>
      <button type="button" onClick={() => props.onVincular?.()}>
        Simular vincular
      </button>
    </div>
  ),
}));

vi.mock("@/components/pll/ficha-afinidade-agenda", () => ({
  FichaAfinidadeAgenda: (props: { notaEducacao: number | null; outrasPautas: string[] }) => (
    <div data-testid="ficha-afinidade-agenda">
      <p>Nota Educação: {props.notaEducacao ?? "—"}</p>
      <p>Outras pautas: {props.outrasPautas.join(",")}</p>
    </div>
  ),
}));

import FichaMentoradoPage from "./page";

function paramsProntos(id: string): Promise<{ id: string }> {
  const valor = { id };
  return Object.assign(Promise.resolve(valor), { status: "fulfilled", value: valor });
}

function renderizarPagina(id = "1") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>carregando</p>}>
        <FichaMentoradoPage params={paramsProntos(id)} />
      </Suspense>
    </QueryClientProvider>
  );
}

const PARTICIPANTE_VINCULADO = {
  id_cadastro_participante: 1,
  nome_completo: "Fulana de Tal",
  papel: "mentorado",
  id_vinculo_tse: 77,
  nota_educacao: 5,
  nota_seguranca_publica: 3,
  nota_modernizacao_estado: 2,
  nota_clima: 4,
  outras_pautas: ["Saúde"],
  especifique_pauta: null,
  desafios: [],
  destaques: [],
  ambicao_texto: null,
  ambicao_tags: [],
  swot_forcas: [],
  swot_fraquezas: [],
  swot_oportunidades: [],
  swot_ameacas: [],
};

const PARTICIPANTE_NAO_VINCULADO = { ...PARTICIPANTE_VINCULADO, id_vinculo_tse: null };

beforeEach(() => {
  mocks.push.mockReset();
  mocks.buscarTodasCandidaturasPorTitulo.mockReset().mockResolvedValue([
    {
      anoEleicao: 2022,
      sqCandidato: 1,
      nrTurno: 1,
      nrTituloEleitoral: "123",
      nmCandidato: "Fulana",
      nmUrna: "Fulana",
      sgUf: "SP",
      nmUe: "SP",
      nmMunicipioPrincipal: "São Paulo",
      sgPartido: "PT",
      cdCargo: 7,
      dsCargo: "Deputado Federal",
      dsGenero: null,
      dsCorRaca: null,
      dsGrauInstrucao: null,
      dsOcupacao: null,
      dsSituacaoCandidatura: "Deferido",
      dsSitTotTurno: "Eleito",
      qtVotosTotal: 45000,
    },
  ]);
  mocks.buscarPerfilCandidatura.mockReset().mockResolvedValue({
    idade: 40,
    genero: "Feminino",
    corRaca: "Parda",
    grauInstrucao: "Superior",
    ocupacao: "Advogada",
    coligacao: "Coligação Exemplo",
    nmUe: "São Paulo",
  });
  mocks.buscarComposicaoPartidariaCasa.mockReset().mockResolvedValue([
    { siglaPartido: "PT", quantidade: 10, percentual: 50 },
  ]);
  mocks.respostaCadastro = { data: PARTICIPANTE_VINCULADO, error: null };
  mocks.respostaVinculo = { data: { id_mandato: 9, ano_eleicao: 2022 }, error: null };
  mocks.respostaMandato = { data: { nr_titulo_eleitoral: "123" }, error: null };
});

afterEach(cleanup);

describe("FichaMentoradoPage — cabeçalho e composição (T15)", () => {
  it("monta cabeçalho com nome/papel + Dados TSE + Afinidade + Composição Partidária", async () => {
    renderizarPagina();

    expect(await screen.findByText("Fulana de Tal")).toBeInTheDocument();
    expect(screen.getByText("Mentorado")).toBeInTheDocument();
    expect(await screen.findByTestId("ficha-dados-tse")).toBeInTheDocument();
    expect(await screen.findByTestId("ficha-afinidade-agenda")).toBeInTheDocument();
    expect(await screen.findByText("Composição Partidária da Casa")).toBeInTheDocument();
  });

  it("passa candidaturas resolvidas (situação/coligação/votos) pro bloco Dados TSE", async () => {
    renderizarPagina();

    expect(await screen.findByText("Vinculado: true")).toBeInTheDocument();
    expect(await screen.findByText("Candidaturas: 1")).toBeInTheDocument();
  });

  it("passa as notas e outras pautas reais pro bloco Afinidade de Agenda", async () => {
    renderizarPagina();

    expect(await screen.findByText("Nota Educação: 5")).toBeInTheDocument();
    expect(screen.getByText("Outras pautas: Saúde")).toBeInTheDocument();
  });

  it("composição partidária real (do mandato vigente) aparece na tela", async () => {
    renderizarPagina();

    expect(await screen.findByText("PT")).toBeInTheDocument();
    expect(screen.getByText("10 (50.0%)")).toBeInTheDocument();
  });
});

describe("FichaMentoradoPage — participante não vinculado ao TSE (PLL-CP-15)", () => {
  it("Dados TSE mostra vinculadoTse=false; Composição Partidária não aparece", async () => {
    mocks.respostaCadastro = { data: PARTICIPANTE_NAO_VINCULADO, error: null };
    renderizarPagina();

    expect(await screen.findByText("Vinculado: false")).toBeInTheDocument();
    expect(screen.queryByText("Composição Partidária da Casa")).not.toBeInTheDocument();
  });

  it("clicar em 'vincular' no bloco Dados TSE leva pra lista de participantes", async () => {
    mocks.respostaCadastro = { data: PARTICIPANTE_NAO_VINCULADO, error: null };
    renderizarPagina();

    (await screen.findByRole("button", { name: "Simular vincular" })).click();
    expect(mocks.push).toHaveBeenCalledWith("/produtos/pll/participantes");
  });
});

describe("FichaMentoradoPage — participante inexistente", () => {
  it("mostra estado explicativo quando o id não corresponde a nenhum participante", async () => {
    mocks.respostaCadastro = { data: null, error: null };
    renderizarPagina("999");

    expect(await screen.findByText("Participante não encontrado")).toBeInTheDocument();
  });
});
