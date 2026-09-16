import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlanejamentoCompleto } from "@backend/queries/planejamento";

// Spec anchor: PLV-14 (.specs/features/planejamento-estrategico-v2/spec.md:323),
// aba "Diagnóstico (Análise de Conjuntura)" -- AC1 (3 cartões com Editar),
// AC2 (Perfil de atuação só no PLL), AC3 (vazio mostra "—" e MANTÉM o Editar),
// AC4 (modo Ler oculta Editar).
//
// AD-042: os dois lados de cada decisão. Preenchido x vazio, PLL x Estratégia,
// Ler x Construir -- nunca só o caminho feliz.

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { nome: "Fiscalizadora" }, error: null }),
        }),
      }),
    }),
  }),
}));

import { ContextoEstrategico } from "./contexto-estrategico";
import { PERMISSOES } from "./permissoes";

const PLANO_PREENCHIDO: PlanejamentoCompleto = {
  idPlanejamento: 1,
  idContrato: 7,
  objetivoAno: "Aprovar a lei de creches",
  legado: "Mandato reconhecido pela primeira infância",
  analiseConjuntura: "Base governista fragmentada",
  idPerfilAtuacao: 3,
  pctAtingimento: 40,
  atingimentoDesatualizado: false,
  objetivos: [],
};

const PLANO_VAZIO: PlanejamentoCompleto = {
  ...PLANO_PREENCHIDO,
  objetivoAno: null,
  legado: null,
  analiseConjuntura: null,
  idPerfilAtuacao: null,
};

function renderiza(
  planejamento: PlanejamentoCompleto,
  opcoes: { produtoNome?: string; papel?: "gestora" | "assessor"; modo?: "construir" | "monitorar" | "ler" } = {}
) {
  const { produtoNome = "Estratégia", papel = "gestora", modo = "construir" } = opcoes;
  return render(
    <ContextoEstrategico
      planejamento={planejamento}
      preditoresAtuais={[]}
      evolucaoGip={[]}
      produtoNome={produtoNome}
      permissoes={PERMISSOES[papel]}
      modo={modo}
      onDadosAlterados={() => {}}
    />
  );
}

afterEach(cleanup);

describe("ContextoEstrategico — os 3 cartões (PLV-14 AC1)", () => {
  it("mostra Legado, Objetivo do ano e Análise de conjuntura com os valores do plano", () => {
    renderiza(PLANO_PREENCHIDO);
    expect(screen.getByText("Legado")).toBeInTheDocument();
    expect(screen.getByText("Objetivo do ano")).toBeInTheDocument();
    expect(screen.getByText("Análise de conjuntura")).toBeInTheDocument();
    expect(screen.getByText("Mandato reconhecido pela primeira infância")).toBeInTheDocument();
    expect(screen.getByText("Aprovar a lei de creches")).toBeInTheDocument();
    expect(screen.getByText("Base governista fragmentada")).toBeInTheDocument();
  });

  it("cada cartão traz sua própria ação Editar", () => {
    renderiza(PLANO_PREENCHIDO);
    expect(screen.getAllByRole("button", { name: "Editar" })).toHaveLength(3);
  });
});

describe("ContextoEstrategico — campo vazio (PLV-14 AC3)", () => {
  it("campo vazio mostra — em vez de sumir com o cartão", () => {
    // Independent Test da spec: "plano sem legado preenchido mostra o cartão com
    // — e o botão Editar funcionando".
    renderiza(PLANO_VAZIO);
    expect(screen.getByText("Legado")).toBeInTheDocument();
    expect(screen.getByText("Objetivo do ano")).toBeInTheDocument();
    expect(screen.getByText("Análise de conjuntura")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("campo vazio MANTÉM o Editar — o cartão em branco é o convite", () => {
    renderiza(PLANO_VAZIO);
    expect(screen.getAllByRole("button", { name: "Editar" })).toHaveLength(3);
  });

  it("vazio é —, nunca N/A nem string vazia (AD-005)", () => {
    renderiza(PLANO_VAZIO);
    expect(screen.queryByText("N/A")).not.toBeInTheDocument();
    expect(screen.queryByText(/não informado/i)).not.toBeInTheDocument();
  });
});

describe("ContextoEstrategico — Perfil de atuação (PLV-14 AC2)", () => {
  it("no PLL o cartão aparece com o nome do perfil", async () => {
    renderiza(PLANO_PREENCHIDO, { produtoNome: "PLL" });
    expect(await screen.findByText("Perfil de atuação")).toBeInTheDocument();
    expect(await screen.findByText("Fiscalizadora")).toBeInTheDocument();
  });

  it("fora do PLL o cartão não existe", () => {
    // PLR-05: Estratégia e Coalizão nunca usam a coluna id_perfil_atuacao.
    renderiza(PLANO_PREENCHIDO, { produtoNome: "Estratégia" });
    expect(screen.queryByText("Perfil de atuação")).not.toBeInTheDocument();
  });

  it("PLL sem perfil escolhido mostra —, e não some com o cartão", async () => {
    renderiza(PLANO_VAZIO, { produtoNome: "PLL" });
    expect(await screen.findByText("Perfil de atuação")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("—")).toHaveLength(4));
  });
});

describe("ContextoEstrategico — modo e papel (PLV-14 AC4)", () => {
  it("modo Ler oculta o Editar, mesmo para Gestora", () => {
    // O papel continua tendo crudHierarquia; quem esconde é o MODO. São dois
    // eixos distintos, e confundi-los deixaria a Gestora editando sem querer
    // numa tela que ela abriu para ler.
    renderiza(PLANO_PREENCHIDO, { papel: "gestora", modo: "ler" });
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(PERMISSOES.gestora.crudHierarquia).toBe(true);
  });

  it("modo Construir mostra o Editar para Gestora", () => {
    renderiza(PLANO_PREENCHIDO, { papel: "gestora", modo: "construir" });
    expect(screen.getAllByRole("button", { name: "Editar" })).toHaveLength(3);
  });

  it("Assessor não vê Editar nem em Monitorar", () => {
    // O outro eixo: sem crudHierarquia não há Editar em modo nenhum.
    renderiza(PLANO_PREENCHIDO, { papel: "assessor", modo: "monitorar" });
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("o conteúdo dos cartões continua visível em modo Ler — some a ação, não o dado", () => {
    renderiza(PLANO_PREENCHIDO, { papel: "gestora", modo: "ler" });
    expect(screen.getByText("Aprovar a lei de creches")).toBeInTheDocument();
  });
});
