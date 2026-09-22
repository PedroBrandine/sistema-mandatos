import "@testing-library/jest-dom/vitest";

import { Suspense } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T30b
// "Done when" (EST-12 AC1/AC3/AC4/AC5, EST-13 AC4; edge case "mês sem
// encontro") -- fecha as 5 metades que o Verifier da Fase 7
// (validation-fase7.md) reportou como "comportamento que não existe em lugar
// nenhum do código".
//
// Tela de ESCRITA: AD-046 não reduz a profundidade aqui (o corte vale só para
// telas de leitura), então cada condicional desta página tem caso dos dois
// lados, mais estado vazio e estado de erro.
//
// O <Popover> do Radix é stubado pelo mesmo motivo medido em
// encontro-popover.test.tsx (T28): UM render aberto custa ~50s neste harness
// jsdom, contra segundos do arquivo inteiro sem ele. O que esta página precisa
// provar é a COMPOSIÇÃO (clicar na grade monta o popover daquele encontro),
// não o gating open/closed do Radix, que é comportamento de dependência.
//
// Só o popover CONTROLADO (o do encontro, que recebe `open`) leva o data-testid:
// os dropdowns dos filtros (MultiSelectPesquisavel) também usam <Popover>, sem
// `open`, e não podem competir com ele em findByTestId("popover").
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
    open === undefined ? (
      <div>{children}</div>
    ) : (
      <div data-testid="popover" data-open={open ? "true" : "false"}>
        {children}
      </div>
    ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Com o Popover stubado o conteúdo dos filtros (MultiSelectPesquisavel, cmdk)
// fica montado, e o cmdk usa APIs que o jsdom não tem.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});

const mocks = vi.hoisted(() => ({
  buscarEncontrosDoMes: vi.fn(),
  buscarOpcoesGestora: vi.fn(),
  buscarOpcoesProjeto: vi.fn(),
  buscarOpcoesContrato: vi.fn(),
  buscarRegistrosDaAgenda: vi.fn(),
  marcarPresenca: vi.fn(),
  push: vi.fn(),
  buscarEncontrosDoMesPll: vi.fn(),
  buscarOpcoesMentorPll: vi.fn(),
  buscarOpcoesMentoradoPll: vi.fn(),
  buscarOpcoesEdicaoPll: vi.fn(),
  resolverIdsContratoPorMentorEMentorado: vi.fn(),
}));

// importOriginal preserva FUSO_HORARIO_PRODUTO: sem ele o offset lido por
// agenda-mes.tsx viraria 0 e o teste de fuso passaria a afirmar UTC.
//
// Ajuste de fidelidade visual — Agenda (2026-09-14): buscarOpcoesGestora/
// Projeto/Contrato também mockados -- sem isso eles chamariam `.from()` no
// client fake (`createClient: () => ({})` logo abaixo) e lançariam em toda
// consulta das 3 novas opções da barra de filtros.
vi.mock("@backend/queries/agenda", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@backend/queries/agenda")>()),
  buscarEncontrosDoMes: mocks.buscarEncontrosDoMes,
  buscarOpcoesGestora: mocks.buscarOpcoesGestora,
  buscarOpcoesProjeto: mocks.buscarOpcoesProjeto,
  buscarOpcoesContrato: mocks.buscarOpcoesContrato,
}));

vi.mock("@backend/queries/registros-agenda", () => ({
  buscarRegistrosDaAgenda: mocks.buscarRegistrosDaAgenda,
}));

// pll-dashboard-agenda T15: as 5 leituras da Agenda real do PLL.
vi.mock("@backend/queries/pll-agenda", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@backend/queries/pll-agenda")>()),
  buscarEncontrosDoMesPll: mocks.buscarEncontrosDoMesPll,
  buscarOpcoesMentorPll: mocks.buscarOpcoesMentorPll,
  buscarOpcoesMentoradoPll: mocks.buscarOpcoesMentoradoPll,
  buscarOpcoesEdicaoPll: mocks.buscarOpcoesEdicaoPll,
  resolverIdsContratoPorMentorEMentorado: mocks.resolverIdsContratoPorMentorEMentorado,
}));

vi.mock("@backend/rpc/encontro", () => ({
  marcarPresenca: mocks.marcarPresenca,
}));

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({}),
}));

vi.mock("@/hooks/use-produto-atual", () => ({
  useProdutoAtual: () => ({ data: { idProduto: 1, nome: "Estratégia" }, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

import type { EncontroAgenda } from "@backend/queries/agenda";
import type { RegistroAgenda } from "@backend/queries/registros-agenda";
import { PermissaoNegadaError } from "@backend/rpc/errors";

import { hojeNoFusoDoProduto } from "@/components/estrategia/agenda-mes";

import ProdutoAgendaPage from "./page";

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
  participantes: [{ idParticipacao: 1, nome: "Ana Gestora", origem: "legisla", presente: true }],
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

// 15/09/2026 às 12:00 UTC = 09:00 no fuso do produto. Mês corrente: setembro.
const AGORA = new Date("2026-09-15T12:00:00Z");

// `use(params)` suspende até a promise resolver, e no harness de teste esse
// "até" nunca chega: o React só retoma o trabalho suspenso quando alguém
// processa o tick, e o render do Testing Library termina antes disso — a
// árvore fica presa no fallback. A saída é entregar a promise no formato que
// o próprio React trata como já resolvida (`status`/`value` do protocolo de
// thenable, ReactFiberThenable), que é também o formato em que o Next.js
// entrega `params` já resolvidos em runtime: `use` lê o valor direto, sem
// suspender. Nada na página muda por isso — ela continua recebendo uma
// Promise e chamando `use`.
function paramsProntos(slug: string): Promise<{ slug: string }> {
  const valor = { slug };
  return Object.assign(Promise.resolve(valor), { status: "fulfilled", value: valor });
}

function renderizarAgenda() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>carregando</p>}>
        <ProdutoAgendaPage params={paramsProntos("estrategia")} />
      </Suspense>
    </QueryClientProvider>
  );
}

/** Espera a grade aparecer — a página começa em skeleton enquanto as queries resolvem. */
function aguardarGrade() {
  return screen.findByRole("grid");
}

// O chip da grade expõe "<Status>: <hora> <título>" (Figma 163:4 põe a hora
// antes do título). Uma string exata aqui casaria só por acidente, então a
// busca é por status E título, que é o que cada teste quer discriminar; a
// hora fica livre no meio.
function botaoDoEncontro(nomeAcessivel: string | RegExp) {
  if (typeof nomeAcessivel === "string" && nomeAcessivel.includes(": ")) {
    const [status, ...resto] = nomeAcessivel.split(": ");
    return screen.getByRole("button", { name: regexDoChip(status, resto.join(": ")) });
  }
  // Botões comuns do popover ("Adicionar registro", "Marcar presença") não
  // têm prefixo de status: casam pelo nome exato, como antes.
  return screen.getByRole("button", { name: nomeAcessivel });
}

function regexDoChip(status: string, titulo: string): RegExp {
  const escapar = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escapar(status)}:.*${escapar(titulo)}$`);
}

beforeEach(() => {
  // Só o relógio é congelado (`toFake: ["Date"]`): setTimeout e companhia
  // continuam reais, senão o react-query e o waitFor do Testing Library
  // ficariam sem quem os acorde. A página lê `new Date()` uma vez, então
  // congelar Date basta para o mês corrente ser determinístico.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
  mocks.buscarEncontrosDoMes.mockReset().mockResolvedValue([ENCONTRO_SETEMBRO]);
  mocks.buscarOpcoesGestora.mockReset().mockResolvedValue([{ id: 1, nome: "Ana Gestora" }]);
  mocks.buscarOpcoesProjeto.mockReset().mockResolvedValue([{ id: 10, nome: "Projeto Alfa" }]);
  mocks.buscarOpcoesContrato.mockReset().mockResolvedValue([{ id: 42, nome: "Dep. Ana Ribeiro" }]);
  mocks.buscarRegistrosDaAgenda.mockReset().mockResolvedValue([]);
  mocks.marcarPresenca.mockReset().mockResolvedValue(undefined);
  mocks.push.mockReset();
  mocks.buscarEncontrosDoMesPll.mockReset().mockResolvedValue([]);
  mocks.buscarOpcoesMentorPll.mockReset().mockResolvedValue([]);
  mocks.buscarOpcoesMentoradoPll.mockReset().mockResolvedValue([]);
  mocks.buscarOpcoesEdicaoPll.mockReset().mockResolvedValue([]);
  mocks.resolverIdsContratoPorMentorEMentorado.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("hojeNoFusoDoProduto (T30b) — a data de referência da página", () => {
  it("converte o instante para o fuso do produto antes de cortar o dia", () => {
    // 01/10 00:30 UTC ainda é 30/09 no fuso do produto (-03:00). Sem a
    // conversão, a página abriria em outubro e destacaria o dia errado.
    expect(hojeNoFusoDoProduto(new Date("2026-10-01T00:30:00Z"))).toBe("2026-09-30");
  });

  it("instante no meio do dia permanece no mesmo dia", () => {
    expect(hojeNoFusoDoProduto(new Date("2026-09-30T12:00:00Z"))).toBe("2026-09-30");
  });
});

describe("Agenda (EST-12 AC1) — abre no mês corrente com os encontros do mês", () => {
  it("renderiza a grade com os encontros reais, e não o placeholder de desenvolvimento", async () => {
    renderizarAgenda();

    expect(await screen.findByRole("grid", { name: "Agenda de Setembro de 2026" })).toBeInTheDocument();
    expect(botaoDoEncontro("Agendada: Mentoria 3")).toBeInTheDocument();
    expect(screen.queryByText(/em desenvolvimento/i)).not.toBeInTheDocument();
  });

  it("consulta exatamente o mês corrente do produto", async () => {
    renderizarAgenda();
    await aguardarGrade();

    expect(mocks.buscarEncontrosDoMes).toHaveBeenCalledWith(expect.anything(), {
      idProduto: 1,
      ano: 2026,
      mes: 9,
    });
  });

  it("o mês corrente sai do fuso do produto, não do relógio da máquina (L-002)", async () => {
    // 01/10 00:30 UTC = 30/09 21:30 no fuso do produto: a Agenda abre em
    // SETEMBRO. Lida em UTC, abriria em outubro e a grade viria vazia.
    vi.setSystemTime(new Date("2026-10-01T00:30:00Z"));
    renderizarAgenda();

    expect(await screen.findByRole("grid", { name: "Agenda de Setembro de 2026" })).toBeInTheDocument();
    expect(mocks.buscarEncontrosDoMes).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ano: 2026, mes: 9 })
    );
  });

  it("a célula de hoje é a do dia corrente no fuso do produto (EST-12 AC6)", async () => {
    renderizarAgenda();
    await aguardarGrade();

    const marcadas = document.querySelectorAll("[data-hoje='true']");
    expect(marcadas).toHaveLength(1);
    expect(marcadas[0]).toHaveAttribute("data-dia", "2026-09-15");
  });
});

describe("Agenda (EST-12 AC3) — navegar de mês refaz a consulta", () => {
  it("avançar um mês busca o mês seguinte e troca os encontros da grade", async () => {
    mocks.buscarEncontrosDoMes.mockImplementation(async (_cliente, filtro: { mes: number }) =>
      filtro.mes === 9 ? [ENCONTRO_SETEMBRO] : [ENCONTRO_OUTUBRO]
    );
    renderizarAgenda();
    await aguardarGrade();

    botaoDoEncontro("Próximo mês").click();

    expect(await screen.findByRole("grid", { name: "Agenda de Outubro de 2026" })).toBeInTheDocument();
    expect(mocks.buscarEncontrosDoMes).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ano: 2026, mes: 10 })
    );
    expect(botaoDoEncontro("Agendada: Devolutiva Diagnóstica")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: regexDoChip("Agendada", "Mentoria 3") })).not.toBeInTheDocument();
  });

  it("voltar um mês consulta o mês anterior — lado oposto da navegação", async () => {
    renderizarAgenda();
    await aguardarGrade();

    botaoDoEncontro("Mês anterior").click();

    await waitFor(() =>
      expect(mocks.buscarEncontrosDoMes).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ ano: 2026, mes: 8 })
      )
    );
  });
});

describe("Agenda (EST-12 AC4/AC5) — seleção de encontro, popover e filtro da lista", () => {
  it("sem seleção não há popover e a lista não filtra por encontro", async () => {
    renderizarAgenda();
    await aguardarGrade();

    expect(screen.queryByTestId("popover")).not.toBeInTheDocument();
    expect(mocks.buscarRegistrosDaAgenda).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idEncontro: undefined })
    );
  });

  it("clicar no encontro abre o popover daquele encontro e filtra os registros por ele", async () => {
    mocks.buscarRegistrosDaAgenda.mockResolvedValue([REGISTRO]);
    renderizarAgenda();
    await aguardarGrade();

    botaoDoEncontro("Agendada: Mentoria 3").click();

    expect(await screen.findByTestId("popover")).toHaveAttribute("data-open", "true");
    // Campos do encontro clicado, não de outro: etapa e horário vêm do 501.
    expect(screen.getByText("Diagnóstico")).toBeInTheDocument();
    expect(screen.getByText("15/set/2026, 14:00 – 15:30")).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.buscarRegistrosDaAgenda).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ idEncontro: 501 })
      )
    );
  });

  it("o filtro ativo aparece como chip removível e some ao ser removido (EST-12 AC5)", async () => {
    renderizarAgenda();
    await aguardarGrade();

    botaoDoEncontro("Agendada: Mentoria 3").click();
    expect(await screen.findByText(/Mostrando registros de:/)).toHaveTextContent("Mentoria 3");

    botaoDoEncontro("Remover filtro de encontro").click();

    await waitFor(() => expect(screen.queryByText(/Mostrando registros de:/)).not.toBeInTheDocument());
    expect(screen.queryByTestId("popover")).not.toBeInTheDocument();
    expect(mocks.buscarRegistrosDaAgenda).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ idEncontro: undefined })
    );
  });

  it("trocar de mês desfaz a seleção, para a lista não filtrar por encontro fora da grade", async () => {
    renderizarAgenda();
    await aguardarGrade();

    botaoDoEncontro("Agendada: Mentoria 3").click();
    await screen.findByTestId("popover");

    botaoDoEncontro("Próximo mês").click();

    await waitFor(() => expect(screen.queryByTestId("popover")).not.toBeInTheDocument());
    expect(screen.queryByText(/Mostrando registros de:/)).not.toBeInTheDocument();
  });
});

describe("Agenda (EST-13 AC4) — marcar presença", () => {
  const VENCIDO: EncontroAgenda = {
    ...ENCONTRO_SETEMBRO,
    dtPrevistaInicio: "2026-09-10T14:00:00-03:00",
    dtPrevistaFim: "2026-09-10T15:30:00-03:00",
  };

  async function abrirPopoverDoVencido() {
    renderizarAgenda();
    await aguardarGrade();
    botaoDoEncontro("Agendada: Mentoria 3").click();
    await screen.findByTestId("popover");
  }

  it("clicar em Marcar presença chama a RPC com o encontro aberto", async () => {
    mocks.buscarEncontrosDoMes.mockResolvedValue([VENCIDO]);
    await abrirPopoverDoVencido();

    botaoDoEncontro("Marcar presença").click();

    await waitFor(() =>
      expect(mocks.marcarPresenca).toHaveBeenCalledWith(expect.anything(), { idEncontro: 501 })
    );
  });

  it("depois da escrita o encontro aparece como Realizada na grade e no popover", async () => {
    let noBanco: EncontroAgenda[] = [VENCIDO];
    mocks.buscarEncontrosDoMes.mockImplementation(async () => noBanco);
    mocks.marcarPresenca.mockImplementation(async () => {
      noBanco = [{ ...VENCIDO, status: "realizado", dtRealizada: "2026-09-14T10:00:00-03:00" }];
    });
    await abrirPopoverDoVencido();

    botaoDoEncontro("Marcar presença").click();

    expect(await screen.findByRole("button", { name: regexDoChip("Realizada", "Mentoria 3") })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: regexDoChip("Agendada", "Mentoria 3") })).not.toBeInTheDocument();
    // O popover aberto acompanha: o aviso de encontro vencido some junto.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Marcar presença" })).not.toBeInTheDocument()
    );
  });

  it("encontro futuro não oferece a ação — lado oposto de EST-13 AC3 na página montada", async () => {
    mocks.buscarEncontrosDoMes.mockResolvedValue([ENCONTRO_SETEMBRO]);
    await abrirPopoverDoVencido();

    expect(screen.queryByRole("button", { name: "Marcar presença" })).not.toBeInTheDocument();
  });
});

describe("Agenda (EST-13 AC4) — o erro da escrita nunca some em silêncio", () => {
  const VENCIDO: EncontroAgenda = { ...ENCONTRO_SETEMBRO, dtPrevistaInicio: "2026-09-10T14:00:00-03:00" };

  async function tentarMarcarPresenca() {
    mocks.buscarEncontrosDoMes.mockResolvedValue([VENCIDO]);
    renderizarAgenda();
    await aguardarGrade();
    botaoDoEncontro("Agendada: Mentoria 3").click();
    await screen.findByTestId("popover");
    botaoDoEncontro("Marcar presença").click();
  }

  it("erro tipado da RPC chega traduzido ao popover", async () => {
    mocks.marcarPresenca.mockRejectedValue(new PermissaoNegadaError());
    await tentarMarcarPresenca();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Você não tem permissão para realizar esta operação."
    );
    expect(screen.getByText("Não foi possível marcar presença")).toBeInTheDocument();
  });

  it("objeto cru do PostgREST — que NÃO é Error em runtime — não vira mensagem genérica", async () => {
    // Reproduz o achado de errors.ts: `{data, error}` do postgrest-js vem de
    // JSON.parse, então `error instanceof Error` é false. Antes da T24 isso
    // caía num texto genérico e descartava a causa (AD-005).
    mocks.marcarPresenca.mockRejectedValue({ code: "P0001", message: "encontro bloqueado" });
    await tentarMarcarPresenca();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O banco recusou a operação (código P0001): encontro bloqueado"
    );
  });

  it("escrita bem-sucedida não deixa alerta na tela — lado oposto", async () => {
    await tentarMarcarPresenca();

    await waitFor(() => expect(mocks.marcarPresenca).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Agenda (EST-13 AC6) — adicionar registro", () => {
  it("leva ao contrato e ao encontro de origem", async () => {
    renderizarAgenda();
    await aguardarGrade();
    botaoDoEncontro("Agendada: Mentoria 3").click();
    await screen.findByTestId("popover");

    botaoDoEncontro("Adicionar registro").click();

    expect(mocks.push).toHaveBeenCalledWith("/contratos/42/encontros");
  });
});

describe("Agenda — lista de Registros", () => {
  it("exibe tipo, data, descrição e responsável de cada registro", async () => {
    mocks.buscarRegistrosDaAgenda.mockResolvedValue([REGISTRO]);
    renderizarAgenda();
    await aguardarGrade();

    expect(await screen.findByText("1 registro encontrado")).toBeInTheDocument();
    expect(screen.getByText("Escuta Diagnóstica")).toBeInTheDocument();
    // DATE puro formatado sem passar por new Date(): 18/09, nunca 17/09.
    expect(screen.getByText("18/09/2026")).toBeInTheDocument();
    expect(screen.getByText("Alinhamento estratégico com a equipe de comunicação")).toBeInTheDocument();
    expect(screen.getByText("Ana Ribeiro")).toBeInTheDocument();
  });

  it("registro sem descrição renderiza ausência, nunca célula em branco (AD-005)", async () => {
    mocks.buscarRegistrosDaAgenda.mockResolvedValue([{ ...REGISTRO, resumo: null }]);
    renderizarAgenda();
    await aguardarGrade();

    expect(await screen.findByText("—")).toBeInTheDocument();
  });

  it("mês SEM encontro renderiza a grade completa e o estado explicativo na lista", async () => {
    mocks.buscarEncontrosDoMes.mockResolvedValue([]);
    renderizarAgenda();

    // A grade continua inteira: o mês vazio não some da tela (AD-005).
    const grade = await aguardarGrade();
    expect(grade.querySelectorAll("[data-dia]")).toHaveLength(30);
    expect(await screen.findByText("Nenhum encontro neste mês")).toBeInTheDocument();
    expect(screen.getByText(/Este mês não tem encontro agendado/)).toBeInTheDocument();
  });

  it("mês COM encontro e sem registro explica a outra causa — lado oposto do vazio", async () => {
    renderizarAgenda();
    await aguardarGrade();

    expect(await screen.findByText("Nenhum registro no recorte")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum encontro neste mês")).not.toBeInTheDocument();
  });
});

describe("Agenda — estados de falha de leitura", () => {
  it("falha ao carregar os encontros mostra erro com retry, nunca grade vazia silenciosa", async () => {
    mocks.buscarEncontrosDoMes.mockRejectedValue(new Error("timeout"));
    renderizarAgenda();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os encontros da Agenda."
    );
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it("falha só nos registros preserva a grade e isola o erro na lista", async () => {
    mocks.buscarRegistrosDaAgenda.mockRejectedValue(new Error("timeout"));
    renderizarAgenda();

    expect(await aguardarGrade()).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os registros da Agenda."
    );
  });
});

// Ajuste de fidelidade visual — Agenda (2026-09-14). Pedro: "os filtros de
// gestora, projeto e contrato também não aparecem como foi definido no
// Figma" (163:4). `FiltroAgenda` (queries/agenda.ts) já aceitava os três
// recortes -- esta seção cobre só a UI nova: a barra de filtros, o botão
// "+ Novo agendamento" (SPEC-PRECISION GAP: sem tela de criação de encontro
// no nível do produto, o botão exige um contrato escolhido no filtro) e o
// badge/avatar da tabela de registros.
describe("Ajuste de fidelidade visual — Agenda (2026-09-14)", () => {
  it("a barra de filtros mostra os 3 dropdowns do Figma, cada um com o próprio rótulo por padrão", async () => {
    renderizarAgenda();
    await aguardarGrade();

    expect(screen.getByRole("combobox", { name: "Filtrar por gestora" })).toHaveTextContent(
      "Filtrar por gestora"
    );
    expect(screen.getByRole("combobox", { name: "Filtrar por projeto" })).toHaveTextContent(
      "Filtrar por projeto"
    );
    expect(screen.getByRole("combobox", { name: "Filtrar por contrato" })).toHaveTextContent(
      "Filtrar por contrato"
    );
  });

  it("'+ Novo agendamento' existe mas começa desabilitado -- nenhum contrato foi escolhido no filtro ainda", async () => {
    renderizarAgenda();
    await aguardarGrade();

    const botao = screen.getByRole("button", { name: /Novo agendamento/ });
    expect(botao).toBeDisabled();

    botao.click();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("registros da tabela mostram badge de tipo colorido e avatar de iniciais do responsável", async () => {
    mocks.buscarRegistrosDaAgenda.mockResolvedValue([REGISTRO]);
    renderizarAgenda();
    await aguardarGrade();

    const badge = await screen.findByText("Escuta Diagnóstica");
    // Badge com cor de marca (paleta de globals.css), não a variante cinza
    // genérica que a tabela usava antes deste ajuste.
    expect(badge.className).toMatch(/bg-(secondary|chart-\d|primary)/);

    // "Ana Ribeiro" -> avatar com a inicial "A" ao lado do nome.
    expect(screen.getByText("A", { selector: "span[aria-hidden='true']" })).toBeInTheDocument();
  });
});

// FMC-33 (spec.md P2 Agenda AC7, T39): "Descrição" e "Responsável" nunca
// existiram no domínio de Registro -- fat_registro.resumo é Resumo,
// fat_registro.id_usuario_autor é Autor. Origem da correção: EST-12.
describe("Agenda — rótulos da lista de Registros (FMC-33)", () => {
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

// pll-dashboard-agenda T3 (PLL-SH-03, PLL-SH-04): roteamento por slug -- "pll"
// renderiza a Agenda real do PLL (T15); os demais slugs continuam pelo
// componente existente da Estratégia/Coalizão, sem alteração de
// comportamento (regressão coberta pelos describes acima, que usam
// renderizarAgenda() -> slug "estrategia").
describe("Agenda — roteamento por slug (pll-dashboard-agenda T3)", () => {
  function renderizarComSlug(slug: string) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<p>carregando</p>}>
          <ProdutoAgendaPage params={paramsProntos(slug)} />
        </Suspense>
      </QueryClientProvider>
    );
  }

  it("slug='pll' renderiza a Agenda real do PLL, sem tocar nas queries da Estratégia", async () => {
    renderizarComSlug("pll");

    expect(await screen.findByRole("combobox", { name: "Filtrar por mentor(a)" })).toBeInTheDocument();
    expect(mocks.buscarEncontrosDoMes).not.toHaveBeenCalled();
  });

  it("slug='coalizao' continua pelo componente existente (grade renderiza como na Estratégia)", async () => {
    renderizarComSlug("coalizao");

    expect(await aguardarGrade()).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Filtrar por mentor(a)" })).not.toBeInTheDocument();
  });
});

// pll-dashboard-agenda T15 (PLL-AG-01…12). AD-042 (não AD-046): esta página
// grava (marcar presença), mesmo raciocínio já registrado no topo do arquivo
// para EstrategiaAgendaPage -- mas o recorte aqui é o caminho feliz de cada
// AC novo (grade, filtros, lista, D-10), não uma réplica integral da suíte
// de EST-12/EST-13 (já coberta acima para o motor compartilhado).
describe("Agenda do PLL (T15)", () => {
  const ENCONTRO_PLL: EncontroAgenda & { nomeMentor: string | null } = {
    idEncontro: 900,
    idContrato: 50,
    nomeContratante: "Dep. João Silva",
    titulo: "Mentoria 2",
    status: "planejado",
    dtPrevistaInicio: "2026-09-15T14:00:00-03:00",
    dtPrevistaFim: null,
    dtRealizada: null,
    nomeEtapa: null,
    nomeTipo: "Mentoria",
    modalidade: null,
    local: null,
    temaPrioritario: null,
    participantes: [],
    nomeMentor: "Carla Mentora",
  };

  function renderizarAgendaPll() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<p>carregando</p>}>
          <ProdutoAgendaPage params={paramsProntos("pll")} />
        </Suspense>
      </QueryClientProvider>
    );
  }

  it("monta a grade, os 3 filtros e a lista 'Encontros do mês' (PLL-AG-01/08/09)", async () => {
    mocks.buscarEncontrosDoMesPll.mockResolvedValue([ENCONTRO_PLL]);
    mocks.buscarOpcoesMentorPll.mockResolvedValue([{ id: 1, nome: "Carla Mentora" }]);
    mocks.buscarOpcoesMentoradoPll.mockResolvedValue([{ id: 2, nome: "Ana Souza" }]);
    mocks.buscarOpcoesEdicaoPll.mockResolvedValue([{ id: 10, nome: "2026.1" }]);

    renderizarAgendaPll();

    expect(await screen.findByRole("grid")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por mentor(a)" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por mentorado" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por edição" })).toBeInTheDocument();
    expect(screen.getByText("Encontros do mês")).toBeInTheDocument();
    expect(screen.getByText("1 encontro neste mês")).toBeInTheDocument();
    // Coluna Mentor(a) da lista (D-6a) -- "Carla Mentora" aparece pelo menos
    // na linha da lista (pode repetir se também vier no filtro).
    expect(screen.getAllByText("Carla Mentora").length).toBeGreaterThan(0);
  });

  it("mês sem Encontro no recorte mostra o estado explicativo na lista (PLL-AG-10)", async () => {
    mocks.buscarEncontrosDoMesPll.mockResolvedValue([]);

    renderizarAgendaPll();
    await screen.findByRole("grid");

    expect(screen.getByText("Nenhum encontro neste mês")).toBeInTheDocument();
  });

  it("'Novo agendamento' fica desabilitado sem exatamente 1 mentorado no filtro (D-10)", async () => {
    renderizarAgendaPll();
    await screen.findByRole("grid");

    const botao = screen.getByRole("button", { name: /Novo agendamento/ });
    expect(botao).toBeDisabled();
  });

  it("com exatamente 1 mentorado no filtro, o botão habilita e navega pro contrato dele (D-10)", async () => {
    mocks.buscarOpcoesMentoradoPll.mockResolvedValue([{ id: 2, nome: "Ana Souza" }]);
    mocks.resolverIdsContratoPorMentorEMentorado.mockResolvedValue([50]);

    renderizarAgendaPll();
    await screen.findByRole("grid");

    // O Popover é mockado no topo do arquivo para renderizar o conteúdo
    // direto (sem gating open/closed) quando não recebe `open` -- mesmo
    // padrão comprovado em multi-select-pesquisavel.test.tsx: a opção já está
    // acessível por role sem precisar abrir o combobox antes, e a seleção
    // exige `fireEvent.click` (Radix reage a pointer events, não ao `.click()`
    // sintético do DOM puro).
    fireEvent.click(await screen.findByRole("option", { name: "Ana Souza" }));

    const botao = await screen.findByRole("button", { name: /Novo agendamento/ });
    await waitFor(() => expect(botao).not.toBeDisabled());

    fireEvent.click(botao);
    expect(mocks.push).toHaveBeenCalledWith("/contratos/50/encontros");
  });
});
