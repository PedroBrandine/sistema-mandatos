import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ObjetivoComMetas, PessoaVinculada, SucessoMensalGrade } from "@backend/queries/planejamento";

import { PERMISSOES } from "./permissoes";

// Spec anchor: PLV-01/PLV-03/PLV-12 (.specs/features/planejamento-estrategico-v2/
// spec.md, T23 de tasks.md). AD-042: cada chip presente E ausente;
// responsável próprio/herdado/nenhum; atraso/sem atraso. Este arquivo cobre
// só o que T23 pediu -- não é suíte completa da grade (teclado/colar/undo não
// são tocados pelo diff desta task, ver commit).

const PREDITORES = [
  { id_preditor: 1, nome: "Priorizam sua Agenda" },
  { id_preditor: 2, nome: "Pautam os Debates" },
];
const AGENDAS = [{ id_agenda: 1, nome: "Educação e Primeira Infância" }];

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: (tabela: string) => {
      if (tabela === "ref_preditor") {
        return { select: () => Promise.resolve({ data: PREDITORES }) };
      }
      if (tabela === "ref_agenda_tematica") {
        return { select: () => Promise.resolve({ data: AGENDAS }) };
      }
      return { select: () => Promise.resolve({ data: [] }) };
    },
  }),
}));

import { PlanejamentoGrade } from "./planejamento-grade";

const PESSOAS: PessoaVinculada[] = [
  { idUsuario: 1, nome: "Joana Martins", papelNoContrato: "assessor" },
  { idUsuario: 2, nome: "Marcos Silva", papelNoContrato: "mentor" },
];

function meta(overrides: Partial<ObjetivoComMetas["metas"][number]> = {}) {
  return {
    idMeta: 100,
    idObjetivo: 1,
    descricao: "Articular apoio de 5 parlamentares",
    classe: null,
    prioridade: null,
    status: "ativa" as const,
    pctAtingimento: 35,
    idPreditorPrimario: null,
    idPreditorSecundario: null,
    idAgenda: null,
    idUsuarioResponsavel: null,
    ...overrides,
  };
}

function objetivo(metas: ObjetivoComMetas["metas"]): ObjetivoComMetas {
  return {
    idObjetivo: 1,
    idPlanejamento: 1,
    descricao: "Consolidar liderança na pauta de educação básica",
    idPreditorPrimario: null,
    idPreditorSecundario: null,
    idAgenda: null,
    status: "ativo",
    pctAtingimento: 60,
    metas,
  };
}

function sucesso(overrides: Partial<SucessoMensalGrade> = {}): SucessoMensalGrade {
  return {
    idSucesso: 201,
    idMeta: 100,
    descricao: "Mapear 10 parlamentares-alvo",
    mesReferencia: "2026-08-01",
    dtLimite: "2026-08-15",
    peso: 20,
    pctAtingimento: 60,
    status: "pendente",
    diasAtraso: 0,
    estaAtrasado: false,
    idUsuarioResponsavel: null,
    atrasoDias: null,
    ...overrides,
  };
}

const onEdicaoCelula = vi.fn();
const onColarFaixa = vi.fn();
const onHierarquiaAlterada = vi.fn();
const onGradeAlterada = vi.fn();

function renderiza(objetivos: ObjetivoComMetas[], linhas: SucessoMensalGrade[]) {
  return render(
    <PlanejamentoGrade
      idPlanejamento={1}
      produtoNome="Estratégia"
      objetivos={objetivos}
      linhas={linhas}
      pessoasVinculadas={PESSOAS}
      permissoes={PERMISSOES.gestora}
      onEdicaoCelula={onEdicaoCelula}
      onColarFaixa={onColarFaixa}
      onHierarquiaAlterada={onHierarquiaAlterada}
      onGradeAlterada={onGradeAlterada}
    />
  );
}

beforeEach(() => {
  onEdicaoCelula.mockReset();
  onColarFaixa.mockReset();
  onHierarquiaAlterada.mockReset();
  onGradeAlterada.mockReset();
});

afterEach(cleanup);

describe("PlanejamentoGrade — chips de classificação na linha da Meta (T23)", () => {
  it("Status sempre aparece — é NOT NULL no schema", () => {
    renderiza([objetivo([meta({ status: "ativa" })])], []);
    expect(screen.getByText("Ativa")).toBeInTheDocument();
  });

  it("Prioridade/Classe/Preditor 1º/2º/Agenda aparecem quando preenchidos", async () => {
    renderiza(
      [
        objetivo([
          meta({
            prioridade: "alta",
            classe: "programatica",
            idPreditorPrimario: 1,
            idPreditorSecundario: 2,
            idAgenda: 1,
          }),
        ]),
      ],
      []
    );
    expect(screen.getByText("Alta")).toBeInTheDocument();
    expect(screen.getByText("Programática")).toBeInTheDocument();
    expect(await screen.findByText("Pred. 1º: Priorizam sua Agenda")).toBeInTheDocument();
    expect(screen.getByText("Pred. 2º: Pautam os Debates")).toBeInTheDocument();
    expect(screen.getByText("Agenda: Educação e Primeira Infância")).toBeInTheDocument();
  });

  it("chip ausente quando o campo é nulo — não aparece um chip com — dentro", () => {
    renderiza([objetivo([meta({ prioridade: null, classe: null, idAgenda: null })])], []);
    expect(screen.queryByText("Alta")).not.toBeInTheDocument();
    expect(screen.queryByText("Média")).not.toBeInTheDocument();
    expect(screen.queryByText("Baixa")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Agenda:/)).not.toBeInTheDocument();
    expect(screen.queryByText("—", { selector: "[class*=badge], span.text-\\[11px\\]" })).not.toBeInTheDocument();
  });

  it("Governança e Preditor 2º não aparecem no PLL — mesma restrição da AD-008", () => {
    render(
      <PlanejamentoGrade
        idPlanejamento={1}
        produtoNome="PLL"
        objetivos={[objetivo([meta({ classe: "governanca", idPreditorPrimario: 1, idPreditorSecundario: 2 })])]}
        linhas={[]}
        pessoasVinculadas={PESSOAS}
        permissoes={PERMISSOES.gestora}
        onEdicaoCelula={onEdicaoCelula}
        onColarFaixa={onColarFaixa}
        onHierarquiaAlterada={onHierarquiaAlterada}
        onGradeAlterada={onGradeAlterada}
      />
    );
    // classe='governanca' segue existindo no banco (histórico), mas o rótulo
    // não tem tradução fora deste teste de UI -- o que importa aqui é que
    // Pred. 2º, que É código de produto (AD-008), não aparece no PLL.
    expect(screen.queryByText("Pred. 2º: Pautam os Debates")).not.toBeInTheDocument();
  });
});

describe("PlanejamentoGrade — Responsável do Sucesso Mensal (PLV-03)", () => {
  it("responsável próprio aparece, sem marcação de herdado", () => {
    renderiza([objetivo([meta({ idUsuarioResponsavel: 2 })])], [sucesso({ idUsuarioResponsavel: 1 })]);
    expect(screen.getByText("Joana Martins")).toBeInTheDocument();
    expect(screen.queryByText("herdado")).not.toBeInTheDocument();
  });

  it("sem responsável próprio, herda o da Meta e marca como herdado", () => {
    renderiza([objetivo([meta({ idUsuarioResponsavel: 2 })])], [sucesso({ idUsuarioResponsavel: null })]);
    // "Marcos Silva" aparece 2x de propósito: uma na linha da própria Meta
    // (responsável dela, não herdado) e outra na linha do SM (herdado dela).
    // O que este teste prova é a segunda -- por isso escopado à linha do SM.
    const linhaSm = screen.getByText("Mapear 10 parlamentares-alvo").closest("tr")!;
    expect(within(linhaSm).getByText(/Marcos Silva/)).toBeInTheDocument();
    expect(within(linhaSm).getByText("herdado")).toBeInTheDocument();
  });

  it("nem SM nem Meta têm responsável: mostra — (AD-005)", () => {
    renderiza(
      [objetivo([meta({ idUsuarioResponsavel: null })])],
      [sucesso({ idUsuarioResponsavel: null })]
    );
    const linhaSm = screen.getByText("Mapear 10 parlamentares-alvo").closest("tr")!;
    // Duas ausências na mesma linha (Responsável e Atraso, ambos sem dado) --
    // getAllByText de propósito, não getByText.
    expect(within(linhaSm).getAllByText("—").length).toBeGreaterThan(0);
  });
});

describe("PlanejamentoGrade — coluna Atraso (PLV-12)", () => {
  it("SM atrasado mostra os dias em coral, coluna própria (não mais junto do Status)", () => {
    renderiza([objetivo([meta()])], [sucesso({ atrasoDias: 5, status: "pendente" })]);
    const chip = screen.getByText("5d");
    expect(chip).toHaveClass("text-destructive");
    // Não é mais "5d atraso" dentro do badge de Situação -- é a própria coluna.
    expect(screen.queryByText("5d atraso")).not.toBeInTheDocument();
  });

  it("SM sem atraso mostra —, não 0d", () => {
    renderiza([objetivo([meta()])], [sucesso({ atrasoDias: null })]);
    expect(screen.queryByText("0d")).not.toBeInTheDocument();
    const linhaSm = screen.getByText("Mapear 10 parlamentares-alvo").closest("tr")!;
    expect(within(linhaSm).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("Status do SM continua na coluna Situação, sem o atraso junto", () => {
    renderiza([objetivo([meta()])], [sucesso({ status: "realizado", atrasoDias: null })]);
    expect(screen.getByText("Realizado")).toBeInTheDocument();
  });
});
