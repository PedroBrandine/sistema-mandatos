import "@testing-library/jest-dom/vitest";

import { Suspense } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: tasks.md T9 "Done when" (PLL-SH-02, PLL-CP-01…09):
//  - Página monta upload + lista, RLS decide o que cada papel vê
//  - npm run lint:all && npm run build && npm run test:unit verdes
// Test Coverage Matrix: "Páginas (participantes, participantes/[id])" --
// unit (component), AD-042 na de import/lista -- composição + wiring.
//
// UploadPlanilhaCard e ListaParticipantesPll já têm suíte própria (T6/T8);
// aqui eles são mockados por stand-ins que expõem os props recebidos via
// botões de teste, para provar a COMPOSIÇÃO (dado real chega no componente
// certo, callback volta pra mutação certa), não repetir o comportamento
// interno de cada um.

const mocks = vi.hoisted(() => ({
  buscarCadastroParticipantesPll: vi.fn(),
  buscarMetricasCadastroPll: vi.fn(),
  upsertCadastroParticipantes: vi.fn(),
  respostaEdicoes: { data: [{ id_projeto: 10, nome: "2026.1" }], error: null } as {
    data: { id_projeto: number; nome: string }[] | null;
    error: null;
  },
}));

vi.mock("@backend/queries/pll-cadastro", () => ({
  buscarCadastroParticipantesPll: mocks.buscarCadastroParticipantesPll,
  buscarMetricasCadastroPll: mocks.buscarMetricasCadastroPll,
  upsertCadastroParticipantes: mocks.upsertCadastroParticipantes,
}));

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve(mocks.respostaEdicoes),
        }),
      }),
    }),
  }),
}));

vi.mock("@/hooks/use-produto-atual", () => ({
  useProdutoAtual: () => ({ data: { idProduto: 7, nome: "PLL" }, isLoading: false }),
}));

vi.mock("@/components/pll/upload-planilha-card", () => ({
  UploadPlanilhaCard: (props: {
    metricas: { participantesCadastrados: number; pendentesRevisao: number; comDadosIncompletos: number };
    ultimaImportacao: { data: string; nomeUsuario: string } | null;
    onImportar: (linhas: unknown[]) => void | Promise<void>;
  }) => (
    <div data-testid="upload-planilha-card">
      <p>Cadastrados: {props.metricas.participantesCadastrados}</p>
      <p>Pendentes: {props.metricas.pendentesRevisao}</p>
      <p>Incompletos: {props.metricas.comDadosIncompletos}</p>
      <p>Última: {props.ultimaImportacao ? `${props.ultimaImportacao.data} por ${props.ultimaImportacao.nomeUsuario}` : "—"}</p>
      <button type="button" onClick={() => props.onImportar([{ papel: "mentorado" }])}>
        Simular importação
      </button>
    </div>
  ),
}));

vi.mock("@/components/pll/lista-participantes-pll", () => ({
  ListaParticipantesPll: (props: {
    participantes: { idCadastroParticipante: number; nomeCompleto: string }[];
    total: number;
    partidos: string[];
    ufs: string[];
    onFiltroChange: (f: { busca?: string }) => void;
    onPaginaChange: (p: number) => void;
  }) => (
    <div data-testid="lista-participantes-pll">
      <p>Total: {props.total}</p>
      <p>Partidos: {props.partidos.join(",")}</p>
      <p>UFs: {props.ufs.join(",")}</p>
      <ul>
        {props.participantes.map((p) => (
          <li key={p.idCadastroParticipante}>{p.nomeCompleto}</li>
        ))}
      </ul>
      <button type="button" onClick={() => props.onFiltroChange({ busca: "ped" })}>
        Simular busca
      </button>
      <button type="button" onClick={() => props.onPaginaChange(2)}>
        Simular próxima página
      </button>
    </div>
  ),
}));

import ProdutoParticipantesPage from "./page";

function paramsProntos(slug: string): Promise<{ slug: string }> {
  const valor = { slug };
  return Object.assign(Promise.resolve(valor), { status: "fulfilled", value: valor });
}

function renderizarPagina(slug = "pll") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>carregando</p>}>
        <ProdutoParticipantesPage params={paramsProntos(slug)} />
      </Suspense>
    </QueryClientProvider>
  );
}

const RESULTADO_PADRAO = {
  linhas: [
    {
      idCadastroParticipante: 1,
      papel: "mentorado" as const,
      nomeCompleto: "Fulana de Tal",
      siglaPartido: "PT",
      siglaUf: "SP",
      nomeParlamentar: "Dep. Fulano",
      email: "fulana@teste.com",
      telefone: null,
      nomeMentorPareado: null,
      vinculadoTse: false,
      statusCadastro: "incompleto" as const,
      idContrato: null,
    },
  ],
  total: 1,
};

const METRICAS_PADRAO = {
  participantesCadastrados: 1,
  pendentesRevisao: 0,
  comDadosIncompletos: 1,
  ultimaImportacao: { data: "2026-09-20T10:00:00Z", nomeUsuario: "Ana Gestora" },
};

beforeEach(() => {
  mocks.buscarCadastroParticipantesPll.mockReset().mockResolvedValue(RESULTADO_PADRAO);
  mocks.buscarMetricasCadastroPll.mockReset().mockResolvedValue(METRICAS_PADRAO);
  mocks.upsertCadastroParticipantes.mockReset().mockResolvedValue({ inseridos: 1, atualizados: 0 });
  mocks.respostaEdicoes = { data: [{ id_projeto: 10, nome: "2026.1" }], error: null };
});

afterEach(cleanup);

describe("ProdutoParticipantesPage — roteamento por slug (T9)", () => {
  it("slug='pll' monta upload + lista", async () => {
    renderizarPagina("pll");

    expect(await screen.findByTestId("upload-planilha-card")).toBeInTheDocument();
    expect(await screen.findByTestId("lista-participantes-pll")).toBeInTheDocument();
  });

  it("lado oposto: outro slug mostra o estado explicativo, sem chamar nenhuma query do PLL", async () => {
    renderizarPagina("estrategia");

    expect(await screen.findByText("Participantes é exclusivo do PLL")).toBeInTheDocument();
    expect(mocks.buscarCadastroParticipantesPll).not.toHaveBeenCalled();
  });
});

describe("ProdutoParticipantesPage — composição com dado real", () => {
  it("passa as métricas e a última importação reais pro UploadPlanilhaCard", async () => {
    renderizarPagina();

    expect(await screen.findByText("Cadastrados: 1")).toBeInTheDocument();
    expect(screen.getByText("Pendentes: 0")).toBeInTheDocument();
    expect(screen.getByText("Incompletos: 1")).toBeInTheDocument();
    expect(screen.getByText("Última: 2026-09-20T10:00:00Z por Ana Gestora")).toBeInTheDocument();
  });

  it("passa as linhas e o total reais pra ListaParticipantesPll", async () => {
    renderizarPagina();

    expect(await screen.findByText("Total: 1")).toBeInTheDocument();
    expect(screen.getByText("Fulana de Tal")).toBeInTheDocument();
  });

  it("opções de partido/UF do filtro vêm dos dados carregados", async () => {
    renderizarPagina();

    await screen.findByTestId("lista-participantes-pll");
    expect(screen.getByText("Partidos: PT")).toBeInTheDocument();
    expect(screen.getByText("UFs: SP")).toBeInTheDocument();
  });
});

describe("ProdutoParticipantesPage — wiring de importação", () => {
  it("onImportar do UploadPlanilhaCard chama upsertCadastroParticipantes com idProduto/idProjeto certos", async () => {
    renderizarPagina();

    fireEvent.click(await screen.findByRole("button", { name: "Simular importação" }));

    await waitFor(() =>
      expect(mocks.upsertCadastroParticipantes).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ idProduto: 7, idProjeto: 10, linhas: [{ papel: "mentorado" }] })
      )
    );
  });

  it("depois de importar, a lista e as métricas são recarregadas (mais chamadas de leitura)", async () => {
    renderizarPagina();
    await screen.findByTestId("lista-participantes-pll");

    const chamadasAntes = mocks.buscarCadastroParticipantesPll.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Simular importação" }));

    await waitFor(() =>
      expect(mocks.buscarCadastroParticipantesPll.mock.calls.length).toBeGreaterThan(chamadasAntes)
    );
  });
});

describe("ProdutoParticipantesPage — wiring de busca e paginação", () => {
  it("mudar a busca na lista refaz a consulta com o novo termo e volta pra página 1", async () => {
    renderizarPagina();
    await screen.findByTestId("lista-participantes-pll");
    mocks.buscarCadastroParticipantesPll.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Simular busca" }));

    await waitFor(() =>
      expect(mocks.buscarCadastroParticipantesPll).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ busca: "ped", pagina: 1 })
      )
    );
  });

  it("mudar de página refaz a consulta com a nova página", async () => {
    renderizarPagina();
    await screen.findByTestId("lista-participantes-pll");
    mocks.buscarCadastroParticipantesPll.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Simular próxima página" }));

    await waitFor(() =>
      expect(mocks.buscarCadastroParticipantesPll).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ pagina: 2 })
      )
    );
  });
});

describe("ProdutoParticipantesPage — falha ao carregar a lista", () => {
  it("mostra ErroInline com retry, e o upload continua acessível", async () => {
    mocks.buscarCadastroParticipantesPll.mockRejectedValue(new Error("timeout"));
    renderizarPagina();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar a lista de participantes."
    );
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeInTheDocument();
    expect(screen.getByTestId("upload-planilha-card")).toBeInTheDocument();
  });

  it("lado oposto: sucesso não mostra nenhum alerta", async () => {
    renderizarPagina();
    await screen.findByTestId("lista-participantes-pll");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("ProdutoParticipantesPage — sem edição ativa cadastrada", () => {
  it("mostra o estado explicativo e não monta upload/lista", async () => {
    mocks.respostaEdicoes = { data: [], error: null };

    renderizarPagina();

    expect(await screen.findByText("Nenhuma edição cadastrada")).toBeInTheDocument();
    expect(screen.queryByTestId("upload-planilha-card")).not.toBeInTheDocument();
  });

  it("lado oposto: com edição cadastrada, upload e lista montam normalmente", async () => {
    renderizarPagina();

    expect(await screen.findByTestId("upload-planilha-card")).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma edição cadastrada")).not.toBeInTheDocument();
  });
});
