import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: .specs/features/fatos-geradores-ciclo-vida/spec.md, "A aba
// como casa única da Incidência" AC1, AC7, AC8. Substitui o placeholder que
// ficha-mandato-contrato (FMC-04) deixou nesta rota de propósito.
//
// `use(params)` suspende até a promise resolver -- protocolo de thenable já
// resolvido (`status`/`value`), mesma técnica de
// etapas/[codigo]/page.test.tsx / produtos/[slug]/agenda/page.test.tsx.
function paramsProntos(id: string) {
  const valor = { id };
  return Object.assign(Promise.resolve(valor), { status: "fulfilled" as const, value: valor });
}

let paramsAtuais = new URLSearchParams();
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/contratos/7/fatos-registros",
  useSearchParams: () => paramsAtuais,
}));

// Achado do Verifier (fix task pós-T25): abrirEdicao busca o registro cru
// direto por id (não pelo resumo já carregado, que só tem campos de
// exibição) -- roteado por tabela.
const maybeSingleMock = vi.fn();
vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: (tabela: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => maybeSingleMock(tabela),
        }),
      }),
    }),
  }),
}));

const buscarRegistrosDoContratoMock = vi.fn();
const buscarInsightsDoContratoMock = vi.fn();
const buscarFatosGeradoresDoContratoMock = vi.fn();
const buscarPreInsightsDoContratoMock = vi.fn();
const buscarTimelineIncidenciaMock = vi.fn();
const buscarCadeiasIncidenciaMock = vi.fn();

vi.mock("@backend/queries/incidencia", () => ({
  buscarRegistrosDoContrato: (...args: unknown[]) => buscarRegistrosDoContratoMock(...args),
  buscarInsightsDoContrato: (...args: unknown[]) => buscarInsightsDoContratoMock(...args),
  buscarFatosGeradoresDoContrato: (...args: unknown[]) => buscarFatosGeradoresDoContratoMock(...args),
  buscarPreInsightsDoContrato: (...args: unknown[]) => buscarPreInsightsDoContratoMock(...args),
  buscarTimelineIncidencia: (...args: unknown[]) => buscarTimelineIncidenciaMock(...args),
  buscarCadeiasIncidencia: (...args: unknown[]) => buscarCadeiasIncidenciaMock(...args),
}));

// As 4 entidades entram como stub -- cada uma já tem seu próprio teste
// (T18/T23/T24/T16). O que esta página precisa provar é a COMPOSIÇÃO: os 4
// itens de Criar existem, e concluir um deles fecha o diálogo (AC2) e
// atualiza a timeline sem recarregar a página inteira (AC8, verificado pela
// contagem de chamadas ao fetch subir de novo).
vi.mock("@/components/incidencia/registro-form", () => ({
  RegistroForm: ({ onConcluido }: { onConcluido: () => void }) => (
    <button type="button" onClick={onConcluido}>
      concluir registro
    </button>
  ),
}));
vi.mock("@/components/incidencia/pre-insight-form", () => ({
  PreInsightForm: ({ onConcluido }: { onConcluido: () => void }) => (
    <button type="button" onClick={onConcluido}>
      concluir pré-insight
    </button>
  ),
}));
vi.mock("@/components/incidencia/insight-form", () => ({
  InsightForm: ({
    onConcluido,
    insightExistente,
  }: {
    onConcluido: () => void;
    insightExistente?: { idInsight: number; conteudo: string };
  }) => (
    <div>
      {insightExistente && <p>editando insight: {insightExistente.conteudo}</p>}
      <button type="button" onClick={onConcluido}>
        concluir insight
      </button>
    </div>
  ),
}));
vi.mock("@/components/incidencia/fato-gerador-wizard", () => ({
  FatoGeradorWizard: ({ onConcluido }: { onConcluido: () => void }) => (
    <button type="button" onClick={onConcluido}>
      concluir fato gerador
    </button>
  ),
}));

import ContratoFatosRegistrosPage from "./page";

beforeEach(() => {
  paramsAtuais = new URLSearchParams();
  replaceMock.mockClear();
  buscarRegistrosDoContratoMock.mockReset().mockResolvedValue([]);
  buscarInsightsDoContratoMock.mockReset().mockResolvedValue([]);
  buscarFatosGeradoresDoContratoMock.mockReset().mockResolvedValue([]);
  buscarPreInsightsDoContratoMock.mockReset().mockResolvedValue([]);
  buscarTimelineIncidenciaMock.mockReset().mockResolvedValue([
    { tipo: "insight", idOrigem: 1, titulo: "Insight de teste", dataEvento: "2026-09-05", criadoEm: null, idUsuarioAutor: 9 },
  ]);
  buscarCadeiasIncidenciaMock.mockReset().mockResolvedValue([]);
  maybeSingleMock.mockReset().mockResolvedValue({ data: null });
});

afterEach(cleanup);

describe("/contratos/[id]/fatos-registros — carregamento e composição (FGC-16)", () => {
  it("mostra a Linha do Tempo com o item carregado", async () => {
    render(<ContratoFatosRegistrosPage params={paramsProntos("7")} />);

    expect(await screen.findByText("Insight de teste")).toBeInTheDocument();
    expect(buscarTimelineIncidenciaMock).toHaveBeenCalledWith(expect.anything(), 7);
  });

  it("oferece as 4 entidades no menu Criar (spec.md AC1)", async () => {
    render(<ContratoFatosRegistrosPage params={paramsProntos("7")} />);

    await screen.findByText("Insight de teste");
    expect(screen.getByRole("button", { name: "Registrar Registro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar Pré-Insight" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar Insight" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar Fato Gerador" })).toBeInTheDocument();
  });
});

describe("/contratos/[id]/fatos-registros — concluir fecha o diálogo e atualiza sem recarregar (AC2/AC8)", () => {
  it("concluir Insight fecha o diálogo e refaz o fetch da timeline", async () => {
    render(<ContratoFatosRegistrosPage params={paramsProntos("7")} />);
    await screen.findByText("Insight de teste");

    expect(buscarTimelineIncidenciaMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Registrar Insight" }));
    expect(screen.getByRole("button", { name: "concluir insight" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "concluir insight" }));

    // Fecha o diálogo -- o stub não aparece mais.
    expect(screen.queryByRole("button", { name: "concluir insight" })).not.toBeInTheDocument();
    // Refaz o fetch (AC8) sem navegação/reload -- mesma instância de página,
    // só a contagem de chamadas sobe.
    await waitFor(() => expect(buscarTimelineIncidenciaMock).toHaveBeenCalledTimes(2));
  });
});

describe("/contratos/[id]/fatos-registros — editar a partir da Linha do Tempo (fix task pós-T25, spec.md AC2)", () => {
  it("clicar num item e em Editar abre o formulário populado com o registro verdadeiro, e salvar refaz o fetch", async () => {
    maybeSingleMock.mockImplementation((tabela: string) => {
      if (tabela === "fat_insight") {
        return Promise.resolve({
          data: {
            id_insight: 1,
            conteudo: "Conteúdo real do banco",
            desdobramentos: null,
            comprovacao_dados: null,
            ocorrido_em: "2026-09-05",
            id_pilar: null,
            id_registro: null,
          },
        });
      }
      return Promise.resolve({ data: null });
    });

    render(<ContratoFatosRegistrosPage params={paramsProntos("7")} />);
    await screen.findByText("Insight de teste");

    // Seleciona o item na timeline (abre o PainelDetalhe real, não mockado).
    fireEvent.click(screen.getByRole("button", { name: /Insight de teste/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));

    // O formulário populado NÃO vem do resumo já carregado (que só tem
    // campos de exibição) -- vem da busca fresca por id.
    expect(await screen.findByText("editando insight: Conteúdo real do banco")).toBeInTheDocument();
    expect(maybeSingleMock).toHaveBeenCalledWith("fat_insight");

    expect(buscarTimelineIncidenciaMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "concluir insight" }));

    // Fecha o diálogo de edição e refaz o fetch, mesma garantia de AC8.
    expect(screen.queryByText("editando insight: Conteúdo real do banco")).not.toBeInTheDocument();
    await waitFor(() => expect(buscarTimelineIncidenciaMock).toHaveBeenCalledTimes(2));
  });

  it("Fato Gerador não oferece Editar na timeline -- lado oposto (wizard é só criação)", async () => {
    buscarTimelineIncidenciaMock.mockResolvedValue([
      { tipo: "fato_gerador", idOrigem: 9, titulo: "Fato de teste", dataEvento: "2026-09-10", criadoEm: null, idUsuarioAutor: 9 },
    ]);

    render(<ContratoFatosRegistrosPage params={paramsProntos("7")} />);
    await screen.findByText("Fato de teste");

    fireEvent.click(screen.getByRole("button", { name: /Fato de teste/ }));

    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });
});

describe("/contratos/[id]/fatos-registros — Ciclo de Vida usa o mesmo dado carregado", () => {
  it("cadeias já vêm carregadas junto com o resto (1 chamada só) -- AbaIncidencia não refaz fetch ao alternar visão", async () => {
    render(<ContratoFatosRegistrosPage params={paramsProntos("7")} />);
    await screen.findByText("Insight de teste");

    // As duas visões (Linha do Tempo/Ciclo de Vida) são compostas uma vez,
    // no carregamento inicial (Promise.all) -- clicar na aba não dispara
    // nova busca, é troca de renderização condicional sobre o mesmo dado.
    fireEvent.click(screen.getByRole("tab", { name: "Ciclo de Vida" }));

    expect(buscarCadeiasIncidenciaMock).toHaveBeenCalledTimes(1);
  });
});
