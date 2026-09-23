import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P2: Agenda na
// ficha e Novo Agendamento" AC1 (FMC-29). tasks.md T37 Done-when:
//  - FiltroAgenda recebe idsContrato=[idContrato]; nenhum encontro de outro contrato aparece
//  - Mês sem encontro renderiza a grade completa e vazia, com o estado explicativo
//  - Navegação de mês preserva o recorte por contrato
//
// Mesmo truque de stub do Popover que /produtos/[slug]/agenda/page.test.tsx
// (T30b) usa: um render aberto do Radix custa ~50s neste harness jsdom.
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ open, children }: { open?: boolean; children: React.ReactNode }) => (
    <div data-testid="popover" data-open={open ? "true" : "false"}>
      {children}
    </div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// EncontroForm (T38 ainda não rodou quando esta task escreve seu teste) só
// precisa provar que o Dialog o monta -- a cobertura profunda do formulário
// em si é de encontro-form.test.tsx, não desta página (Check C: não duplicar
// no nível da página o que já é coberto no nível do componente).
vi.mock("@/components/incidencia/encontro-form", () => ({
  EncontroForm: () => <div data-testid="encontro-form-stub" />,
}));

const mocks = vi.hoisted(() => ({
  buscarContratoParaFicha: vi.fn(),
  buscarEncontrosDoMes: vi.fn(),
  buscarRegistrosDaAgenda: vi.fn(),
  buscarAgendaMentoriasPll: vi.fn(),
  marcarPresenca: vi.fn(),
}));

vi.mock("@backend/queries/contrato", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@backend/queries/contrato")>()),
  buscarContratoParaFicha: mocks.buscarContratoParaFicha,
}));

vi.mock("@backend/queries/agenda", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@backend/queries/agenda")>()),
  buscarEncontrosDoMes: mocks.buscarEncontrosDoMes,
}));

vi.mock("@backend/queries/registros-agenda", () => ({
  buscarRegistrosDaAgenda: mocks.buscarRegistrosDaAgenda,
}));

vi.mock("@backend/queries/pll-mentorias", () => ({
  buscarAgendaMentoriasPll: mocks.buscarAgendaMentoriasPll,
}));

// diagnostico-participante-pll: a página só precisa provar o WIRING (produto
// PLL -> monta TabelaMentoriasPll com os dados certos, sem tocar no
// calendário) -- o comportamento interno da tabela tem suíte própria.
vi.mock("@/components/pll/tabela-mentorias-pll", () => ({
  TabelaMentoriasPll: ({ idContrato, agenda }: { idContrato: number; agenda: { qtdPrevista: number } }) => (
    <div data-testid="tabela-mentorias-pll">
      idContrato:{idContrato} qtdPrevista:{agenda.qtdPrevista}
    </div>
  ),
}));

vi.mock("@backend/rpc/encontro", () => ({
  marcarPresenca: mocks.marcarPresenca,
}));

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({}),
}));

import type { ContratoParaFicha } from "@backend/queries/contrato";
import type { EncontroAgenda } from "@backend/queries/agenda";
import type { RegistroAgenda } from "@backend/queries/registros-agenda";

import ContratoAgendaPage from "./page";

const CONTRATO: ContratoParaFicha = {
  idContrato: 42,
  idProduto: 1,
  nomeProduto: "Estratégia",
  idContratante: 7,
  nomeContratante: "Dep. Ana Ribeiro",
  tipoContratante: "mandato",
};

const CONTRATO_PLL: ContratoParaFicha = {
  idContrato: 43,
  idProduto: 2,
  nomeProduto: "PLL",
  idContratante: 8,
  nomeContratante: "Mentorado Fulano",
  tipoContratante: "mandato",
  status: "ativo",
  idEtapaAtual: null,
};

const ENCONTRO_SETEMBRO: EncontroAgenda = {
  idEncontro: 501,
  idContrato: 42,
  nomeContratante: "Dep. Ana Ribeiro",
  titulo: "Mentoria 3",
  status: "planejado",
  dtPrevistaInicio: "2026-09-15T14:00:00-03:00",
  dtPrevistaFim: "2026-09-15T15:30:00-03:00",
  dtRealizada: null,
  nomeEtapa: "Diagnóstico",
  nomeTipo: "Escuta Diagnóstica",
  modalidade: "online",
  local: "Sala 2",
  temaPrioritario: "Orçamento",
  participantes: [],
};

const ENCONTRO_OUTUBRO: EncontroAgenda = {
  ...ENCONTRO_SETEMBRO,
  idEncontro: 777,
  titulo: "Devolutiva Diagnóstica",
  dtPrevistaInicio: "2026-10-08T09:30:00-03:00",
  dtPrevistaFim: "2026-10-08T11:00:00-03:00",
};

const REGISTRO: RegistroAgenda = {
  idRegistro: 900,
  idEncontro: 501,
  idContrato: 42,
  tipoRegistro: "Escuta Diagnóstica",
  ocorridoEm: "2026-09-18",
  resumo: "Alinhamento estratégico com a equipe de comunicação",
  nomeAutor: "Ana Ribeiro",
};

const AGORA = new Date("2026-09-15T12:00:00Z");

function paramsProntos(id: string): Promise<{ id: string }> {
  const valor = { id };
  return Object.assign(Promise.resolve(valor), { status: "fulfilled" as const, value: valor });
}

function renderizarAgenda(id = "42") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ContratoAgendaPage params={paramsProntos(id)} />
    </QueryClientProvider>
  );
}

function aguardarGrade() {
  return screen.findByRole("grid");
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
  mocks.buscarContratoParaFicha.mockReset().mockResolvedValue(CONTRATO);
  mocks.buscarEncontrosDoMes.mockReset().mockResolvedValue([ENCONTRO_SETEMBRO]);
  mocks.buscarRegistrosDaAgenda.mockReset().mockResolvedValue([]);
  mocks.buscarAgendaMentoriasPll.mockReset();
  mocks.marcarPresenca.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ContratoAgendaPage (FMC-29 AC1) — grade recortada pelo contrato", () => {
  it("renderiza a grade do mês corrente, e não o placeholder de desenvolvimento", async () => {
    renderizarAgenda();

    expect(await aguardarGrade()).toBeInTheDocument();
    expect(screen.queryByText(/em desenvolvimento/i)).not.toBeInTheDocument();
  });

  it("consulta os encontros com idContrato no filtro -- nenhum encontro de outro contrato aparece", async () => {
    renderizarAgenda();
    await aguardarGrade();

    expect(mocks.buscarEncontrosDoMes).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idProduto: 1, idsContrato: [42], ano: 2026, mes: 9 })
    );
  });

  it("a lista de registros também é filtrada por idContrato", async () => {
    renderizarAgenda();
    await aguardarGrade();

    await waitFor(() =>
      expect(mocks.buscarRegistrosDaAgenda).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ idsContrato: [42] })
      )
    );
  });
});

describe("ContratoAgendaPage — navegação de mês preserva o recorte por contrato", () => {
  it("avançar de mês refaz a consulta com o mesmo idContrato e o mês seguinte", async () => {
    mocks.buscarEncontrosDoMes.mockImplementation(async (_cliente, filtro: { mes: number }) =>
      filtro.mes === 9 ? [ENCONTRO_SETEMBRO] : [ENCONTRO_OUTUBRO]
    );
    renderizarAgenda();
    await aguardarGrade();

    screen.getByRole("button", { name: "Próximo mês" }).click();

    await waitFor(() =>
      expect(mocks.buscarEncontrosDoMes).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ idsContrato: [42], ano: 2026, mes: 10 })
      )
    );
    expect(await screen.findByRole("grid", { name: "Agenda de Outubro de 2026" })).toBeInTheDocument();
  });

  it("voltar de mês -- lado oposto da navegação -- também preserva idContrato", async () => {
    renderizarAgenda();
    await aguardarGrade();

    screen.getByRole("button", { name: "Mês anterior" }).click();

    await waitFor(() =>
      expect(mocks.buscarEncontrosDoMes).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ idsContrato: [42], ano: 2026, mes: 8 })
      )
    );
  });
});

describe("ContratoAgendaPage (edge case da spec) — mês sem encontro", () => {
  it("renderiza a grade completa e vazia, com o estado explicativo", async () => {
    mocks.buscarEncontrosDoMes.mockResolvedValue([]);
    renderizarAgenda();

    const grade = await aguardarGrade();
    expect(grade.querySelectorAll("[data-dia]")).toHaveLength(30);
    expect(await screen.findByText("Nenhum encontro neste mês")).toBeInTheDocument();
    expect(screen.getByText(/Este mês não tem encontro agendado/)).toBeInTheDocument();
  });

  it("mês COM encontro e sem registro explica a outra causa -- lado oposto do vazio", async () => {
    renderizarAgenda();
    await aguardarGrade();

    expect(await screen.findByText("Nenhum registro no recorte")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum encontro neste mês")).not.toBeInTheDocument();
  });
});

describe("ContratoAgendaPage — composição com o popover do encontro", () => {
  it("clicar num encontro da grade abre o popover daquele encontro", async () => {
    renderizarAgenda();
    await aguardarGrade();

    screen.getByRole("button", { name: /Mentoria 3/ }).click();

    expect(await screen.findByTestId("popover")).toHaveAttribute("data-open", "true");
  });
});

describe("ContratoAgendaPage — 'Novo agendamento' abre o modal", () => {
  it("clicar em 'Novo agendamento' monta o Dialog com o formulário de encontro", async () => {
    renderizarAgenda();
    await aguardarGrade();

    screen.getByRole("button", { name: /Novo agendamento/ }).click();

    expect(await screen.findByText("Novo Agendamento")).toBeInTheDocument();
    expect(screen.getByTestId("encontro-form-stub")).toBeInTheDocument();
  });
});

describe("ContratoAgendaPage — estados de falha de leitura", () => {
  it("falha ao carregar os encontros mostra erro com retry, nunca grade vazia silenciosa", async () => {
    mocks.buscarEncontrosDoMes.mockRejectedValue(new Error("timeout"));
    renderizarAgenda();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os encontros da Agenda."
    );
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it("falha só nos registros preserva a grade e isola o erro na lista -- lado oposto", async () => {
    mocks.buscarRegistrosDaAgenda.mockRejectedValue(new Error("timeout"));
    renderizarAgenda();

    expect(await aguardarGrade()).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os registros da Agenda."
    );
  });
});

// FMC-33 (spec.md P2 Agenda AC7, T39): "Descrição" e "Responsável" nunca
// existiram no domínio de Registro -- fat_registro.resumo é Resumo,
// fat_registro.id_usuario_autor é Autor. Origem da correção: EST-12.
describe("ContratoAgendaPage — rótulos da lista de Registros (FMC-33)", () => {
  it("os cabeçalhos são Resumo e Autor", async () => {
    mocks.buscarRegistrosDaAgenda.mockResolvedValue([REGISTRO]);
    renderizarAgenda();
    await aguardarGrade();

    expect(await screen.findByRole("columnheader", { name: "Resumo" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Autor" })).toBeInTheDocument();
  });

  it("nenhuma ocorrência de 'Descrição' ou 'Responsável' na tabela", async () => {
    mocks.buscarRegistrosDaAgenda.mockResolvedValue([REGISTRO]);
    renderizarAgenda();
    await aguardarGrade();

    expect(screen.queryByText("Descrição")).not.toBeInTheDocument();
    expect(screen.queryByText("Responsável")).not.toBeInTheDocument();
  });
});

// diagnostico-participante-pll (Agenda PLL, Figma 328:1262 + decisão do
// Pedro, 23/09): contrato PLL substitui o calendário pela grade fixa de
// Mentorias -- TabelaMentoriasPll, sem buscarEncontrosDoMes/buscarRegistrosDaAgenda.
describe("ContratoAgendaPage — contrato do PLL (grade fixa de Mentorias)", () => {
  it("monta TabelaMentoriasPll com os dados resolvidos, sem chamar buscarEncontrosDoMes/buscarRegistrosDaAgenda", async () => {
    mocks.buscarContratoParaFicha.mockResolvedValue(CONTRATO_PLL);
    mocks.buscarAgendaMentoriasPll.mockResolvedValue({
      idEtapa: 900,
      idTipoRegistro: 901,
      qtdPrevista: 5,
      nomeMentor: "Carlos Mendes",
      slots: [],
    });

    renderizarAgenda("43");

    expect(await screen.findByTestId("tabela-mentorias-pll")).toHaveTextContent("idContrato:43 qtdPrevista:5");
    expect(mocks.buscarEncontrosDoMes).not.toHaveBeenCalled();
    expect(mocks.buscarRegistrosDaAgenda).not.toHaveBeenCalled();
  });

  it("sem etapa/tipo de registro de Mentoria provisionados, mostra estado vazio explicativo", async () => {
    mocks.buscarContratoParaFicha.mockResolvedValue(CONTRATO_PLL);
    mocks.buscarAgendaMentoriasPll.mockResolvedValue(null);

    renderizarAgenda("43");

    expect(await screen.findByText("Agenda indisponível")).toBeInTheDocument();
    expect(screen.queryByTestId("tabela-mentorias-pll")).not.toBeInTheDocument();
  });

  it("falha ao carregar a Agenda de Mentorias mostra ErroInline com retry", async () => {
    mocks.buscarContratoParaFicha.mockResolvedValue(CONTRATO_PLL);
    mocks.buscarAgendaMentoriasPll.mockRejectedValue(new Error("RLS negou a leitura"));

    renderizarAgenda("43");

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar a Agenda de Mentorias.");
  });
});
