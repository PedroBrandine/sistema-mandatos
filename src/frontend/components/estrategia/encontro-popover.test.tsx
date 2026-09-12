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

import {
  ConteudoEncontro,
  EncontroPopover,
  encontroVencido,
  formatarDataHorario,
  formatarModalidadeLocal,
  formatarParticipantes,
} from "./encontro-popover";

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

const HOJE = "2026-09-15";

describe("formatarDataHorario (EST-13 AC1)", () => {
  it("compõe data e intervalo de horário no fuso do produto", () => {
    expect(formatarDataHorario("2026-09-15T14:00:00-03:00", "2026-09-15T15:30:00-03:00")).toBe(
      "15/set/2026, 14:00 – 15:30"
    );
  });

  it("sem horário de fim exibe só o início", () => {
    expect(formatarDataHorario("2026-09-15T14:00:00-03:00", null)).toBe("15/set/2026, 14:00");
  });

  it("sem data prevista devolve ausência, nunca uma data inventada (AD-005)", () => {
    expect(formatarDataHorario(null, null)).toBe("—");
  });

  it("instante em UTC é convertido para o fuso do produto, não exibido cru", () => {
    // 2026-10-01T00:00Z === 2026-09-30 21:00 no fuso do produto.
    expect(formatarDataHorario("2026-10-01T00:00:00Z", null)).toBe("30/set/2026, 21:00");
  });
});

describe("ConteudoEncontro (EST-13 AC1) — os 8 campos que a AC nomeia", () => {
  it("exibe status, etapa, tipo, data/horário, modalidade, local, tema e participantes", () => {
    render(<ConteudoEncontro encontro={ENCONTRO} registros={[]} hoje={HOJE} />);

    expect(screen.getByText("Agendada")).toBeInTheDocument();
    expect(screen.getByText("Diagnóstico")).toBeInTheDocument();
    expect(screen.getByText("Escuta Diagnóstica")).toBeInTheDocument();
    expect(screen.getByText("15/set/2026, 14:00 – 15:30")).toBeInTheDocument();
    expect(screen.getByText("Online · Sala 2")).toBeInTheDocument();
    expect(screen.getByText("Orçamento")).toBeInTheDocument();
    expect(screen.getByText("Ana Gestora, Assessor convidado")).toBeInTheDocument();
  });

  it("encontro realizado exibe o status Realizada — lado oposto do status", () => {
    render(
      <ConteudoEncontro
        encontro={{ ...ENCONTRO, status: "realizado", dtRealizada: "2026-09-15T14:10:00-03:00" }}
        registros={[]}
        hoje={HOJE}
      />
    );

    expect(screen.getByText("Realizada")).toBeInTheDocument();
    expect(screen.queryByText("Agendada")).not.toBeInTheDocument();
  });

  it("modalidade presencial sai com o rótulo próprio — lado oposto de online", () => {
    render(<ConteudoEncontro encontro={{ ...ENCONTRO, modalidade: "presencial" }} registros={[]} hoje={HOJE} />);

    expect(screen.getByText("Presencial · Sala 2")).toBeInTheDocument();
    expect(screen.queryByText(/^Online/)).not.toBeInTheDocument();
  });

  it("cada campo nulo renderiza ausência, nunca string vazia (AD-005)", () => {
    const { container } = render(<ConteudoEncontro encontro={ENCONTRO_SEM_DADOS} registros={[]} hoje={HOJE} />);

    // Etapa, tipo, data/horário, modalidade(+local numa linha só), tema e
    // participantes = 6 campos (Figma 90:206 funde modalidade e local).
    expect(screen.getAllByText("—")).toHaveLength(6);
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
        hoje={HOJE}
      />
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("ConteudoEncontro (EST-13 AC2) — registros vinculados", () => {
  it("COM registros exibe a contagem e o link para eles", () => {
    render(<ConteudoEncontro encontro={ENCONTRO} registros={[REGISTRO, { ...REGISTRO, idRegistro: 901 }]} hoje={HOJE} />);

    // Figma 90:206 separa as duas metades de AC2: a contagem à esquerda e o
    // link "Ver registros" à direita. As duas continuam asseridas.
    expect(screen.getByText("2 registros vinculados")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Ver registros/ });
    expect(link).toHaveAttribute("href", "/contratos/42/encontros");
  });

  it("UM registro sai no singular", () => {
    render(<ConteudoEncontro encontro={ENCONTRO} registros={[REGISTRO]} hoje={HOJE} />);

    expect(screen.getByText("1 registro vinculado")).toBeInTheDocument();
  });

  it("SEM registros não exibe contagem nem link — lado oposto do AC2", () => {
    render(<ConteudoEncontro encontro={ENCONTRO} registros={[]} hoje={HOJE} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    // Precisa mirar a contagem, não qualquer texto com "registro": a ação
    // "Adicionar registro" (AC6) é sempre renderizada e não é a contagem.
    expect(screen.queryByText(/registros? vinculados?/i)).not.toBeInTheDocument();
  });
});

describe("EncontroPopover — composição", () => {
  it("repassa encontro e registros para o conteúdo, e o estado de aberto para o Popover", () => {
    render(
      <EncontroPopover encontro={ENCONTRO} registros={[REGISTRO]} hoje={HOJE} aberto>
        <button type="button">Mentoria 3</button>
      </EncontroPopover>
    );

    expect(screen.getByTestId("popover")).toHaveAttribute("data-open", "true");
    expect(screen.getByRole("button", { name: "Mentoria 3" })).toBeInTheDocument();
    expect(screen.getByText("Diagnóstico")).toBeInTheDocument();
    expect(screen.getByText("1 registro vinculado")).toBeInTheDocument();
  });

  it("o conteúdo do encontro chega inteiro ao ConteudoEncontro", () => {
    render(
      <EncontroPopover encontro={ENCONTRO} registros={[REGISTRO]} hoje={HOJE} aberto>
        <button type="button">Mentoria 3</button>
      </EncontroPopover>
    );

    expect(screen.getByText("Diagnóstico")).toBeInTheDocument();
    expect(screen.getByText("1 registro vinculado")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T30 — Spec anchor: tasks.md T30 "Done when" (EST-13 AC3, AC4, AC6) --
//  - Aviso e ação aparecem só quando a data passou E o status é planejado,
//    teste dos dois lados
//  - Marcar presença atualiza o status na grade
//  - "Adicionar registro" abre a criação já vinculada ao encontro e contrato
//
// AC3 é uma conjunção: as duas metades são verificadas independentemente
// (lição L-036), não só a combinação verdadeira.
// ---------------------------------------------------------------------------

const DEPOIS_DO_ENCONTRO = "2026-09-20";

describe("encontroVencido (EST-13 AC3) — as duas metades da conjunção", () => {
  it("data passou E planejado: vencido", () => {
    expect(encontroVencido(ENCONTRO, DEPOIS_DO_ENCONTRO)).toBe(true);
  });

  it("data NÃO passou, ainda que planejado: não vencido", () => {
    expect(encontroVencido(ENCONTRO, "2026-09-10")).toBe(false);
  });

  it("data passou mas status é realizado: não vencido", () => {
    expect(encontroVencido({ ...ENCONTRO, status: "realizado" }, DEPOIS_DO_ENCONTRO)).toBe(false);
  });

  it("o próprio dia do encontro ainda não conta como passado (fronteira)", () => {
    expect(encontroVencido(ENCONTRO, HOJE)).toBe(false);
  });

  it("sem data prevista nunca é vencido, nunca lança", () => {
    expect(encontroVencido({ ...ENCONTRO, dtPrevistaInicio: null }, DEPOIS_DO_ENCONTRO)).toBe(false);
  });
});

describe("ConteudoEncontro (EST-13 AC3) — aviso e ação de presença", () => {
  it("encontro vencido e planejado exibe o aviso e a ação Marcar presença", () => {
    render(<ConteudoEncontro encontro={ENCONTRO} registros={[]} hoje={DEPOIS_DO_ENCONTRO} />);

    expect(screen.getByText(/data prevista já passou/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar presença" })).toBeInTheDocument();
  });

  it("encontro futuro não exibe aviso nem ação — lado oposto da metade da data", () => {
    render(<ConteudoEncontro encontro={ENCONTRO} registros={[]} hoje="2026-09-10" />);

    expect(screen.queryByText(/data prevista já passou/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar presença" })).not.toBeInTheDocument();
  });

  it("encontro vencido já realizado não exibe aviso nem ação — lado oposto da metade do status", () => {
    render(
      <ConteudoEncontro
        encontro={{ ...ENCONTRO, status: "realizado", dtRealizada: "2026-09-16T10:00:00-03:00" }}
        registros={[]}
        hoje={DEPOIS_DO_ENCONTRO}
      />
    );

    expect(screen.queryByText(/data prevista já passou/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar presença" })).not.toBeInTheDocument();
  });
});

describe("ConteudoEncontro (EST-13 AC4) — marcar presença", () => {
  it("clicar em Marcar presença entrega o idEncontro a quem chama a RPC", () => {
    const onMarcarPresenca = vi.fn();
    render(
      <ConteudoEncontro
        encontro={ENCONTRO}
        registros={[]}
        hoje={DEPOIS_DO_ENCONTRO}
        onMarcarPresenca={onMarcarPresenca}
      />
    );

    screen.getByRole("button", { name: "Marcar presença" }).click();

    expect(onMarcarPresenca).toHaveBeenCalledWith({ idEncontro: 501 });
  });

  it("durante a escrita a ação fica desabilitada, sem permitir dupla submissão", () => {
    const onMarcarPresenca = vi.fn();
    render(
      <ConteudoEncontro
        encontro={ENCONTRO}
        registros={[]}
        hoje={DEPOIS_DO_ENCONTRO}
        marcandoPresenca
        onMarcarPresenca={onMarcarPresenca}
      />
    );

    const botao = screen.getByRole("button", { name: "Marcando…" });
    expect(botao).toBeDisabled();
    botao.click();
    expect(onMarcarPresenca).not.toHaveBeenCalled();
  });

  it("falha da RPC é exibida pelo ErroInline, o componente padrão (L-008)", () => {
    render(
      <ConteudoEncontro
        encontro={ENCONTRO}
        registros={[]}
        hoje={DEPOIS_DO_ENCONTRO}
        erroPresenca="Você não tem permissão para realizar esta operação."
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Você não tem permissão para realizar esta operação."
    );
    expect(screen.getByText("Não foi possível marcar presença")).toBeInTheDocument();
  });

  it("sem erro, nenhum alerta é renderizado — lado oposto", () => {
    render(<ConteudoEncontro encontro={ENCONTRO} registros={[]} hoje={DEPOIS_DO_ENCONTRO} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("ConteudoEncontro (EST-13 AC6) — adicionar registro", () => {
  it("a criação nasce vinculada ao encontro E ao contrato, os dois ids no payload", () => {
    const onAdicionarRegistro = vi.fn();
    render(
      <ConteudoEncontro
        encontro={ENCONTRO}
        registros={[]}
        hoje={HOJE}
        onAdicionarRegistro={onAdicionarRegistro}
      />
    );

    screen.getByRole("button", { name: "Adicionar registro" }).click();

    expect(onAdicionarRegistro).toHaveBeenCalledWith({ idEncontro: 501, idContrato: 42 });
  });

  it("a ação existe mesmo em encontro já realizado — registrar não depende de estar vencido", () => {
    render(
      <ConteudoEncontro
        encontro={{ ...ENCONTRO, status: "realizado", dtRealizada: "2026-09-15T14:10:00-03:00" }}
        registros={[]}
        hoje={HOJE}
      />
    );

    expect(screen.getByRole("button", { name: "Adicionar registro" })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Conformidade com o Figma 90:206 — as duas funções puras que a mudança de
// desenho introduziu. Ambas são caminhos de ausência (AD-005), então cada
// ramificação tem caso próprio.
// ---------------------------------------------------------------------------

describe("formatarModalidadeLocal (Figma 90:206) — modalidade e local numa linha", () => {
  it("com os dois, junta com separador do design", () => {
    expect(formatarModalidadeLocal("presencial", "Gabinete 312")).toBe("Presencial · Gabinete 312");
  });

  it("só modalidade não deixa separador solto", () => {
    expect(formatarModalidadeLocal("online", null)).toBe("Online");
  });

  it("só local não deixa separador solto — lado oposto", () => {
    expect(formatarModalidadeLocal(null, "Gabinete 312")).toBe("Gabinete 312");
  });

  it("nenhum dos dois vira ausência, nunca string vazia (AD-005)", () => {
    expect(formatarModalidadeLocal(null, null)).toBe("—");
  });

  it("local em branco conta como ausente, não como local vazio", () => {
    expect(formatarModalidadeLocal("online", "   ")).toBe("Online");
  });

  it("modalidade fora do catálogo passa adiante crua, nunca some", () => {
    expect(formatarModalidadeLocal("hibrido", null)).toBe("hibrido");
  });
});

describe("formatarParticipantes (Figma 90:206) — resumo com +N", () => {
  it("lista vazia vira ausência (AD-005)", () => {
    expect(formatarParticipantes([])).toBe("—");
  });

  it("um participante sai sozinho", () => {
    expect(formatarParticipantes(["Ana Ribeiro"])).toBe("Ana Ribeiro");
  });

  it("dois cabem inteiros, sem +N", () => {
    expect(formatarParticipantes(["Ana Ribeiro", "Carlos Mendes"])).toBe(
      "Ana Ribeiro, Carlos Mendes"
    );
  });

  it("acima de dois, o excedente vira +N — fronteira do truncamento", () => {
    expect(
      formatarParticipantes(["Ana Ribeiro", "Carlos Mendes", "João Silva", "Maria Souza"])
    ).toBe("Ana Ribeiro, Carlos Mendes, +2");
  });

  it("exatamente três resume um só", () => {
    expect(formatarParticipantes(["Ana", "Carlos", "João"])).toBe("Ana, Carlos, +1");
  });
});
