import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EncontroAgenda } from "@backend/queries/agenda";
import { AgendaMes, diaNoFusoDoProduto } from "./agenda-mes";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T26
// "Done when" (EST-12 AC1, AC2, AC3, AC6 + edge case do mês vazio) --
//  - Encontro aparece na célula do dia correto
//  - Cor reflete o status Agendada/Realizada, um caso por status
//  - Navegar de mês recarrega os encontros
//  - Célula de hoje destacada, com hoje DENTRO e FORA do mês exibido (L-002)
//  - Mês vazio renderiza a grade completa
//
// `hoje` entra sempre por prop: nenhum teste aqui congela relógio nem depende
// da data em que roda.

afterEach(cleanup);

const ENCONTRO_BASE: EncontroAgenda = {
  idEncontro: 501,
  idContrato: 1,
  nomeContratante: "Dep. Ana Ribeiro",
  titulo: "Mentoria 3",
  status: "planejado",
  dtPrevistaInicio: "2026-09-15T14:00:00-03:00",
  dtPrevistaFim: "2026-09-15T15:30:00-03:00",
  dtRealizada: null,
  nomeEtapa: "Diagnóstico",
  nomeTipo: "Escuta",
  modalidade: "online",
  local: null,
  temaPrioritario: "Orçamento",
  participantes: [],
};

function celula(dia: string): HTMLElement | null {
  return document.querySelector(`[data-dia="${dia}"]`);
}

describe("diaNoFusoDoProduto (EST-12 AC1) — posição no fuso do produto", () => {
  it("instante já no fuso do produto fica no próprio dia", () => {
    expect(diaNoFusoDoProduto("2026-09-15T14:00:00-03:00")).toBe("2026-09-15");
  });

  it("21h de 30/09 no fuso do produto não vaza para outubro, mesmo sendo 01/10 em UTC", () => {
    // 2026-09-30T21:00-03:00 === 2026-10-01T00:00Z. Converter pelo UTC cru
    // colocaria o encontro na célula de 01/10 -- o dia errado da grade.
    expect(diaNoFusoDoProduto("2026-10-01T00:00:00Z")).toBe("2026-09-30");
  });

  it("meia-noite e um minuto do dia 1 fica no dia 1", () => {
    expect(diaNoFusoDoProduto("2026-09-01T00:01:00-03:00")).toBe("2026-09-01");
  });
});

describe("AgendaMes (EST-12)", () => {
  it("posiciona o encontro na célula do dia correto (AC1)", () => {
    render(<AgendaMes ano={2026} mes={9} encontros={[ENCONTRO_BASE]} hoje="2026-09-15" />);

    expect(celula("2026-09-15")).toHaveTextContent("Mentoria 3");
    expect(celula("2026-09-16")).not.toHaveTextContent("Mentoria 3");
  });

  it("encontro na virada do mês cai no dia do fuso do produto, não no dia UTC (AC1)", () => {
    render(
      <AgendaMes
        ano={2026}
        mes={9}
        encontros={[{ ...ENCONTRO_BASE, dtPrevistaInicio: "2026-10-01T00:00:00Z" }]}
        hoje="2026-09-15"
      />
    );

    expect(celula("2026-09-30")).toHaveTextContent("Mentoria 3");
  });

  it("encontro agendado (planejado) sai com o rótulo e a cor de Agendada (AC2)", () => {
    render(<AgendaMes ano={2026} mes={9} encontros={[ENCONTRO_BASE]} hoje="2026-09-15" />);

    // Figma 163:4 pinta o chip com o vinho da marca (--secondary), não com
    // paleta genérica do Tailwind.
    const botao = screen.getByRole("button", { name: /Agendada:.*Mentoria 3/ });
    expect(botao.className).toContain("bg-secondary");
  });

  it("o chip mostra a hora antes do título, no fuso do produto (Figma 163:4)", () => {
    render(<AgendaMes ano={2026} mes={9} encontros={[ENCONTRO_BASE]} hoje="2026-09-15" />);

    expect(celula("2026-09-15")).toHaveTextContent("14:00 Mentoria 3");
  });

  it("encontro sem hora prevista mostra só o título, nunca uma hora inventada (AD-005)", () => {
    render(
      <AgendaMes
        ano={2026}
        mes={9}
        encontros={[{ ...ENCONTRO_BASE, dtPrevistaInicio: null }]}
        hoje="2026-09-15"
      />
    );

    expect(screen.queryByRole("button", { name: /Mentoria 3/ })).not.toBeInTheDocument();
  });

  // AD-005: mês sem encontro diz que está vazio, em vez de mostrar uma grade
  // muda que parece tela quebrada (leitura do Pedro em 2026-09-12).
  it("mês sem encontro diz explicitamente que está vazio, nomeando o mês", () => {
    render(<AgendaMes ano={2026} mes={9} encontros={[]} hoje="2026-09-15" />);

    expect(screen.getByText("Nenhum encontro em Setembro de 2026.")).toBeInTheDocument();
  });

  // Lado oposto: havendo encontro, a frase de vazio some -- senão ela apareceria
  // junto dos chips e diria o contrário do que a tela mostra.
  it("mês com encontro não exibe a frase de vazio", () => {
    render(<AgendaMes ano={2026} mes={9} encontros={[ENCONTRO_BASE]} hoje="2026-09-15" />);

    expect(screen.queryByText(/Nenhum encontro em/)).not.toBeInTheDocument();
  });

  it("a grade começa na segunda-feira, com os rótulos do Figma em caixa alta", () => {
    render(<AgendaMes ano={2026} mes={9} encontros={[]} hoje="2026-09-15" />);

    const colunas = screen.getAllByRole("columnheader").map((c) => c.textContent);
    expect(colunas).toEqual(["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"]);
  });

  it("01/09/2026 é uma terça e cai na segunda coluna da grade (início na segunda)", () => {
    render(<AgendaMes ano={2026} mes={9} encontros={[]} hoje="2026-09-15" />);

    const primeiraLinha = screen.getAllByRole("row")[1];
    const celulas = Array.from(primeiraLinha.querySelectorAll("[role='gridcell']"));
    expect(celulas[0].hasAttribute("data-dia")).toBe(false);
    expect(celulas[1]).toHaveAttribute("data-dia", "2026-09-01");
  });

  it("encontro realizado sai com o rótulo e a cor de Realizada — lado oposto do AC2", () => {
    render(
      <AgendaMes
        ano={2026}
        mes={9}
        encontros={[
          {
            ...ENCONTRO_BASE,
            status: "realizado",
            dtRealizada: "2026-09-15T14:10:00-03:00",
          },
        ]}
        hoje="2026-09-15"
      />
    );

    const botao = screen.getByRole("button", { name: /Realizada:.*Mentoria 3/ });
    expect(botao.className).toContain("bg-chart-4");
    expect(botao.className).not.toContain("bg-secondary");
  });

  it("avançar um mês pede o mês seguinte a quem monta a página (AC3)", () => {
    const onMudarMes = vi.fn();
    render(
      <AgendaMes ano={2026} mes={9} encontros={[]} hoje="2026-09-15" onMudarMes={onMudarMes} />
    );

    screen.getByRole("button", { name: "Próximo mês" }).click();

    expect(onMudarMes).toHaveBeenCalledWith({ ano: 2026, mes: 10 });
  });

  it("voltar de janeiro atravessa a virada de ano (AC3, lado oposto)", () => {
    const onMudarMes = vi.fn();
    render(
      <AgendaMes ano={2026} mes={1} encontros={[]} hoje="2026-01-15" onMudarMes={onMudarMes} />
    );

    screen.getByRole("button", { name: "Mês anterior" }).click();

    expect(onMudarMes).toHaveBeenCalledWith({ ano: 2025, mes: 12 });
  });

  it("avançar de dezembro atravessa a virada de ano para frente (AC3)", () => {
    const onMudarMes = vi.fn();
    render(
      <AgendaMes ano={2026} mes={12} encontros={[]} hoje="2026-12-15" onMudarMes={onMudarMes} />
    );

    screen.getByRole("button", { name: "Próximo mês" }).click();

    expect(onMudarMes).toHaveBeenCalledWith({ ano: 2027, mes: 1 });
  });

  it("hoje DENTRO do mês exibido destaca exatamente aquela célula (AC6)", () => {
    render(<AgendaMes ano={2026} mes={9} encontros={[]} hoje="2026-09-15" />);

    expect(celula("2026-09-15")).toHaveAttribute("data-hoje", "true");
    expect(document.querySelectorAll("[data-hoje='true']")).toHaveLength(1);
  });

  it("hoje FORA do mês exibido não destaca nenhuma célula (AC6, lado oposto)", () => {
    render(<AgendaMes ano={2026} mes={9} encontros={[]} hoje="2026-11-03" />);

    expect(document.querySelectorAll("[data-hoje='true']")).toHaveLength(0);
  });

  it("clicar num encontro entrega o encontro inteiro a quem monta a página (AC4)", () => {
    const onSelecionarEncontro = vi.fn();
    render(
      <AgendaMes
        ano={2026}
        mes={9}
        encontros={[ENCONTRO_BASE]}
        hoje="2026-09-15"
        onSelecionarEncontro={onSelecionarEncontro}
      />
    );

    screen.getByRole("button", { name: /Mentoria 3/ }).click();

    expect(onSelecionarEncontro).toHaveBeenCalledWith(ENCONTRO_BASE);
  });

  it("mês sem nenhum encontro renderiza a grade completa, com todos os dias (edge case)", () => {
    render(<AgendaMes ano={2026} mes={9} encontros={[]} hoje="2026-09-15" />);

    expect(document.querySelectorAll("[data-dia]")).toHaveLength(30);
    expect(celula("2026-09-01")).toBeInTheDocument();
    expect(celula("2026-09-30")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mentoria/ })).not.toBeInTheDocument();
  });

  it("fevereiro de ano bissexto rende 29 células de dia", () => {
    render(<AgendaMes ano={2028} mes={2} encontros={[]} hoje="2028-02-10" />);

    expect(document.querySelectorAll("[data-dia]")).toHaveLength(29);
  });
});

// Ajuste de fidelidade visual — Agenda (2026-09-14, Figma 163:4 "btn-add"):
// "+ Novo agendamento" na mesma linha do título do mês. Quem monta a página
// decide destino e estado de desabilitado (page.tsx) -- aqui só o contrato de
// props: sem handler o botão não desenha, com handler ele desenha e repassa
// clique/estado.
describe("AgendaMes — botão Novo agendamento (ajuste de fidelidade visual 2026-09-14)", () => {
  it("sem onNovoAgendamento o botão não é desenhado", () => {
    render(<AgendaMes ano={2026} mes={9} encontros={[]} hoje="2026-09-15" />);

    expect(screen.queryByRole("button", { name: /Novo agendamento/ })).not.toBeInTheDocument();
  });

  it("com onNovoAgendamento o botão aparece e chama o callback ao ser clicado", () => {
    const onNovoAgendamento = vi.fn();
    render(
      <AgendaMes
        ano={2026}
        mes={9}
        encontros={[]}
        hoje="2026-09-15"
        onNovoAgendamento={onNovoAgendamento}
      />
    );

    screen.getByRole("button", { name: /Novo agendamento/ }).click();

    expect(onNovoAgendamento).toHaveBeenCalledTimes(1);
  });

  it("novoAgendamentoDesabilitado desenha o botão desabilitado, nunca escondido (AD-005)", () => {
    render(
      <AgendaMes
        ano={2026}
        mes={9}
        encontros={[]}
        hoje="2026-09-15"
        onNovoAgendamento={vi.fn()}
        novoAgendamentoDesabilitado
        motivoNovoAgendamentoDesabilitado="Selecione um contrato."
      />
    );

    const botao = screen.getByRole("button", { name: /Novo agendamento/ });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAttribute("title", "Selecione um contrato.");
  });
});
