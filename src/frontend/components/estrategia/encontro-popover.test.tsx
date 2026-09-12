import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// O Popover do Radix é inviável neste harness jsdom: UM render aberto custa
// ~50s (12s de teste + ~38s de teardown pendurado), contra 2,5s dos 8 testes
// de conteúdo juntos. É o mesmo obstáculo já registrado na Fase 6, onde
// tse-match-search.test.tsx precisou evitar montar o <Popover> porque ele
// impedia o timer do debounce de disparar.
//
// O primitivo é stubado para que o teste de composição continue existindo e
// asserindo o que pertence a ESTA feature -- que o wrapper repassa
// encontro/registros para ConteudoEncontro. O gating open/closed é
// comportamento do Radix, dependência, fora do escopo pelo Check C.
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ open, children }: { open?: boolean; children: React.ReactNode }) => (
    <div data-testid="popover" data-open={open ? "true" : "false"}>
      {children}
    </div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import type { EncontroAgenda } from "@backend/queries/agenda";
import type { RegistroAgenda } from "@backend/queries/registros-agenda";

import { ConteudoEncontro, EncontroPopover, formatarDataHorario } from "./encontro-popover";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T28
// "Done when" (EST-13 AC1, AC2; AD-005) --
//  - Exibe status, etapa, tipo, data/horário, modalidade, local, tema e
//    participantes
//  - Contagem de registros e link aparecem quando há registros e somem
//    quando não há -- teste dos dois lados
//  - Campo nulo renderiza ausência, nunca string vazia
//
// Tela de escrita: AD-046 NÃO reduz a profundidade aqui (o corte vale só para
// telas de leitura), então cada condicional tem caso dos dois lados.

afterEach(cleanup);

const ENCONTRO: EncontroAgenda = {
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
  participantes: [
    { idParticipacao: 1, nome: "Ana Gestora", origem: "legisla", presente: true },
    { idParticipacao: 2, nome: "Assessor convidado", origem: "externo", presente: false },
  ],
};

const REGISTRO: RegistroAgenda = {
  idRegistro: 900,
  idEncontro: 501,
  idContrato: 42,
  tipoRegistro: "Escuta Diagnóstica",
  ocorridoEm: "2026-09-15T16:00:00-03:00",
  resumo: "Alinhamento de pauta",
  nomeAutor: "Ana Gestora",
};

// Campo vazio por ausência real no banco (AD-005): todos os opcionais nulos.
const ENCONTRO_SEM_DADOS: EncontroAgenda = {
  ...ENCONTRO,
  nomeEtapa: null,
  nomeTipo: null,
  dtPrevistaInicio: null,
  dtPrevistaFim: null,
  modalidade: null,
  local: null,
  temaPrioritario: null,
  participantes: [],
};

describe("formatarDataHorario (EST-13 AC1)", () => {
  it("compõe data e intervalo de horário no fuso do produto", () => {
    expect(formatarDataHorario("2026-09-15T14:00:00-03:00", "2026-09-15T15:30:00-03:00")).toBe(
      "15/09/2026 · 14:00 — 15:30"
    );
  });

  it("sem horário de fim exibe só o início", () => {
    expect(formatarDataHorario("2026-09-15T14:00:00-03:00", null)).toBe("15/09/2026 · 14:00");
  });

  it("sem data prevista devolve ausência, nunca uma data inventada (AD-005)", () => {
    expect(formatarDataHorario(null, null)).toBe("—");
  });

  it("instante em UTC é convertido para o fuso do produto, não exibido cru", () => {
    // 2026-10-01T00:00Z === 2026-09-30 21:00 no fuso do produto.
    expect(formatarDataHorario("2026-10-01T00:00:00Z", null)).toBe("30/09/2026 · 21:00");
  });
});

describe("ConteudoEncontro (EST-13 AC1) — os 8 campos que a AC nomeia", () => {
  it("exibe status, etapa, tipo, data/horário, modalidade, local, tema e participantes", () => {
    render(<ConteudoEncontro encontro={ENCONTRO} registros={[]} />);

    expect(screen.getByText("Agendada")).toBeInTheDocument();
    expect(screen.getByText("Diagnóstico")).toBeInTheDocument();
    expect(screen.getByText("Escuta Diagnóstica")).toBeInTheDocument();
    expect(screen.getByText("15/09/2026 · 14:00 — 15:30")).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText("Sala 2")).toBeInTheDocument();
    expect(screen.getByText("Orçamento")).toBeInTheDocument();
    expect(screen.getByText("Ana Gestora, Assessor convidado")).toBeInTheDocument();
  });

  it("encontro realizado exibe o status Realizada — lado oposto do status", () => {
    render(
      <ConteudoEncontro
        encontro={{ ...ENCONTRO, status: "realizado", dtRealizada: "2026-09-15T14:10:00-03:00" }}
        registros={[]}
      />
    );

    expect(screen.getByText("Realizada")).toBeInTheDocument();
    expect(screen.queryByText("Agendada")).not.toBeInTheDocument();
  });

  it("modalidade presencial sai com o rótulo próprio — lado oposto de online", () => {
    render(<ConteudoEncontro encontro={{ ...ENCONTRO, modalidade: "presencial" }} registros={[]} />);

    expect(screen.getByText("Presencial")).toBeInTheDocument();
    expect(screen.queryByText("Online")).not.toBeInTheDocument();
  });

  it("cada campo nulo renderiza ausência, nunca string vazia (AD-005)", () => {
    const { container } = render(<ConteudoEncontro encontro={ENCONTRO_SEM_DADOS} registros={[]} />);

    // Etapa, tipo, data/horário, modalidade, local, tema e participantes = 7.
    expect(screen.getAllByText("—")).toHaveLength(7);
    expect(container.textContent).not.toContain("null");
    expect(container.textContent).not.toContain("undefined");
  });

  it("participante sem nome não vira entrada vazia na lista (AD-005)", () => {
    render(
      <ConteudoEncontro
        encontro={{
          ...ENCONTRO,
          participantes: [{ idParticipacao: 3, nome: "", origem: "externo", presente: true }],
        }}
        registros={[]}
      />
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("ConteudoEncontro (EST-13 AC2) — registros vinculados", () => {
  it("COM registros exibe a contagem e o link para eles", () => {
    render(<ConteudoEncontro encontro={ENCONTRO} registros={[REGISTRO, { ...REGISTRO, idRegistro: 901 }]} />);

    const link = screen.getByRole("link", { name: "2 registros vinculados" });
    expect(link).toHaveAttribute("href", "/contratos/42/encontros");
  });

  it("UM registro sai no singular", () => {
    render(<ConteudoEncontro encontro={ENCONTRO} registros={[REGISTRO]} />);

    expect(screen.getByRole("link", { name: "1 registro vinculado" })).toBeInTheDocument();
  });

  it("SEM registros não exibe contagem nem link — lado oposto do AC2", () => {
    render(<ConteudoEncontro encontro={ENCONTRO} registros={[]} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/registro/i)).not.toBeInTheDocument();
  });
});

describe("EncontroPopover — composição", () => {
  it("repassa encontro e registros para o conteúdo, e o estado de aberto para o Popover", () => {
    render(
      <EncontroPopover encontro={ENCONTRO} registros={[REGISTRO]} aberto>
        <button type="button">Mentoria 3</button>
      </EncontroPopover>
    );

    expect(screen.getByTestId("popover")).toHaveAttribute("data-open", "true");
    expect(screen.getByRole("button", { name: "Mentoria 3" })).toBeInTheDocument();
    expect(screen.getByText("Diagnóstico")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1 registro vinculado" })).toBeInTheDocument();
  });

  it("o conteúdo do encontro chega inteiro ao ConteudoEncontro", () => {
    render(
      <EncontroPopover encontro={ENCONTRO} registros={[REGISTRO]} aberto>
        <button type="button">Mentoria 3</button>
      </EncontroPopover>
    );

    expect(screen.getByText("Diagnóstico")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1 registro vinculado" })).toBeInTheDocument();
  });
});
