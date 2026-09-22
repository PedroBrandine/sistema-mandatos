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
  vincularParticipanteAoTse: vi.fn(),
  toastError: vi.fn(),
  respostaEdicoes: { data: [{ id_projeto: 10, nome: "2026.1" }], error: null } as {
    data: { id_projeto: number; nome: string }[] | null;
    error: null;
  },
  respostaCargos: { data: [], error: null } as { data: { id_cargo: number; cd_cargo_tse: number | null }[] | null; error: null },
  respostaPartidos: { data: [], error: null } as { data: { id_partido: number; sigla: string }[] | null; error: null },
}));

vi.mock("@backend/queries/pll-cadastro", () => ({
  buscarCadastroParticipantesPll: mocks.buscarCadastroParticipantesPll,
  buscarMetricasCadastroPll: mocks.buscarMetricasCadastroPll,
  upsertCadastroParticipantes: mocks.upsertCadastroParticipantes,
  vincularParticipanteAoTse: mocks.vincularParticipanteAoTse,
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

// Builder encadeável (select/eq/order, todos retornando o mesmo objeto, que
// também é `.then()`-ável) roteado por nome de tabela -- ref_projeto usa
// `.order()`, ref_cargo/ref_partido não (buscarCargosAtivos/buscarPartidosAtivos
// terminam em `.eq()`), então o builder precisa resolver em QUALQUER ponto da
// cadeia, não só no fim fixo de um método.
vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: (tabela: string) => {
      const resposta =
        tabela === "ref_cargo"
          ? mocks.respostaCargos
          : tabela === "ref_partido"
            ? mocks.respostaPartidos
            : mocks.respostaEdicoes;
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
          Promise.resolve(resposta).then(resolve, reject),
      };
      return builder;
    },
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
    onVincularTse?: (p: unknown) => void;
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
      <button type="button" onClick={() => props.onVincularTse?.(props.participantes[0])}>
        Simular vincular TSE
      </button>
    </div>
  ),
}));

vi.mock("@/components/pll/vincular-tse-dialog", () => ({
  VincularTseDialog: (props: {
    participante: { nomeCompleto: string };
    onConfirmar: (c: unknown) => void | Promise<void>;
    onNaoEncontrado: () => void | Promise<void>;
  }) => (
    <div data-testid="vincular-tse-dialog">
      <p>Vincular: {props.participante.nomeCompleto}</p>
      {/* .catch aqui mimetiza o try/catch interno do VincularTseDialog real
          (T11): erro de onConfirmar não deve escapar como unhandled --
          quem trata é a página (toast), o dialog real só evita fechar. */}
      <button
        type="button"
        onClick={() => {
          Promise.resolve(props.onConfirmar({ sgPartido: "PT", cdCargo: 7 })).catch(() => {});
        }}
      >
        Simular confirmar candidatura
      </button>
      <button
        type="button"
        onClick={() => {
          Promise.resolve(props.onNaoEncontrado()).catch(() => {});
        }}
      >
        Simular não encontrado
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
  mocks.vincularParticipanteAoTse.mockReset().mockResolvedValue({
    idContratante: 5,
    idMandato: 9,
    idVinculoTse: 77,
    idContrato: 42,
  });
  mocks.toastError.mockReset();
  mocks.respostaEdicoes = { data: [{ id_projeto: 10, nome: "2026.1" }], error: null };
  mocks.respostaCargos = { data: [{ id_cargo: 1, cd_cargo_tse: 7 }], error: null };
  mocks.respostaPartidos = { data: [{ id_partido: 2, sigla: "PT" }], error: null };
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

// Spec anchor: tasks.md T12 "Done when" (PLL-CP-10, PLL-CP-11, PLL-CP-12):
//  - Botão "vincular TSE" de cada linha sem vínculo abre VincularTseDialog
//  - Sucesso atualiza o indicador ✓ sem reload de página (refetch da MESMA
//    queryKey da lista, não window.reload nem remontagem)
describe("ProdutoParticipantesPage — wiring do vínculo TSE (T12)", () => {
  it("clicar em 'vincular TSE' na lista abre o VincularTseDialog do participante certo", async () => {
    renderizarPagina();
    await screen.findByTestId("lista-participantes-pll");

    fireEvent.click(screen.getByRole("button", { name: "Simular vincular TSE" }));

    expect(await screen.findByTestId("vincular-tse-dialog")).toBeInTheDocument();
    expect(screen.getByText("Vincular: Fulana de Tal")).toBeInTheDocument();
  });

  it("confirmar candidatura chama vincularParticipanteAoTse com idProduto/idProjeto/candidatura resolvidos e recarrega a lista sem reload de página", async () => {
    renderizarPagina();
    await screen.findByTestId("lista-participantes-pll");
    fireEvent.click(screen.getByRole("button", { name: "Simular vincular TSE" }));
    await screen.findByTestId("vincular-tse-dialog");
    const chamadasAntes = mocks.buscarCadastroParticipantesPll.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Simular confirmar candidatura" }));

    await waitFor(() =>
      expect(mocks.vincularParticipanteAoTse).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          idCadastroParticipante: 1,
          idProduto: 7,
          idProjeto: 10,
          // Partido "PT" -> id_partido 2, cargo TSE 7 -> id_cargo 1 (ref mockada).
          mandato: expect.objectContaining({ id_partido_atual: 2, id_cargo_atual: 1 }),
        })
      )
    );
    // Mesma queryKey da lista é invalidada -- refetch, nunca reload de página.
    await waitFor(() =>
      expect(mocks.buscarCadastroParticipantesPll.mock.calls.length).toBeGreaterThan(chamadasAntes)
    );
  });

  it("lado oposto: erro ao confirmar mostra toast e NÃO fecha o dialog (PLL-CP-13)", async () => {
    mocks.vincularParticipanteAoTse.mockRejectedValue(new Error("Este contratante já tem um mandato cadastrado."));
    renderizarPagina();
    await screen.findByTestId("lista-participantes-pll");
    fireEvent.click(screen.getByRole("button", { name: "Simular vincular TSE" }));
    await screen.findByTestId("vincular-tse-dialog");

    fireEvent.click(screen.getByRole("button", { name: "Simular confirmar candidatura" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Este contratante já tem um mandato cadastrado.")
    );
    expect(screen.getByTestId("vincular-tse-dialog")).toBeInTheDocument();
  });

  it("marcar 'não encontrado' não chama vincularParticipanteAoTse (fechar é responsabilidade do próprio VincularTseDialog, T11)", async () => {
    renderizarPagina();
    await screen.findByTestId("lista-participantes-pll");
    fireEvent.click(screen.getByRole("button", { name: "Simular vincular TSE" }));
    await screen.findByTestId("vincular-tse-dialog");

    fireEvent.click(screen.getByRole("button", { name: "Simular não encontrado" }));

    expect(mocks.vincularParticipanteAoTse).not.toHaveBeenCalled();
  });

  it("sem nenhuma linha selecionada pra vincular, o dialog não é montado", async () => {
    renderizarPagina();
    await screen.findByTestId("lista-participantes-pll");

    expect(screen.queryByTestId("vincular-tse-dialog")).not.toBeInTheDocument();
  });
});
