import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: PLV-14 (.specs/features/planejamento-estrategico-v2/spec.md:323)
// -- "Como Gestora, quero ler e editar o contexto estratégico do plano numa aba
// própria, separada da estrutura de objetivos", com AC5: "a aba ativa SHALL
// persistir na navegação".
//
// AD-042: teste de render de verdade, com os dois lados de cada decisão --
// cada aba mostra o SEU conteúdo e esconde o outro, não só "renderiza sem
// quebrar".

let paramsAtuais = new URLSearchParams();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/contratos/7/planejamento",
  useSearchParams: () => paramsAtuais,
}));

import { ABA_PADRAO, normalizaAba, PlanejamentoAbas } from "./planejamento-abas";

function renderiza() {
  return render(
    <PlanejamentoAbas
      diagnostico={<p>conteúdo do diagnóstico</p>}
      estrutura={<p>conteúdo da estrutura</p>}
    />
  );
}

beforeEach(() => {
  paramsAtuais = new URLSearchParams();
  replaceMock.mockClear();
});

afterEach(cleanup);

describe("PlanejamentoAbas — rótulos (PLV-14 AC1/AC5)", () => {
  it("mostra as duas abas com os rótulos da spec", () => {
    renderiza();
    expect(screen.getByRole("tab", { name: "Diagnóstico (Análise de Conjuntura)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Construir a estrutura" })).toBeInTheDocument();
  });
});

describe("PlanejamentoAbas — cada aba mostra o seu e esconde o outro", () => {
  it("aba diagnóstico mostra o diagnóstico e oculta a estrutura", () => {
    paramsAtuais = new URLSearchParams("aba=diagnostico");
    renderiza();
    expect(screen.getByText("conteúdo do diagnóstico")).toBeInTheDocument();
    expect(screen.queryByText("conteúdo da estrutura")).not.toBeInTheDocument();
  });

  it("aba estrutura mostra a estrutura e oculta o diagnóstico (AC5)", () => {
    paramsAtuais = new URLSearchParams("aba=estrutura");
    renderiza();
    expect(screen.getByText("conteúdo da estrutura")).toBeInTheDocument();
    expect(screen.queryByText("conteúdo do diagnóstico")).not.toBeInTheDocument();
  });

  it("marca como selecionada só a aba ativa", () => {
    paramsAtuais = new URLSearchParams("aba=estrutura");
    renderiza();
    expect(screen.getByRole("tab", { name: "Construir a estrutura" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Diagnóstico (Análise de Conjuntura)" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });
});

describe("PlanejamentoAbas — querystring é a fonte da aba ativa", () => {
  it("sem parâmetro, cai no Diagnóstico — é onde o usuário entra", () => {
    renderiza();
    expect(screen.getByText("conteúdo do diagnóstico")).toBeInTheDocument();
    expect(ABA_PADRAO).toBe("diagnostico");
  });

  it("valor desconhecido cai no padrão, em vez de tela em branco", () => {
    // Link colado, histórico antigo, digitação. Uma aba "nenhuma" seria um
    // terceiro estado que a AC não prevê.
    paramsAtuais = new URLSearchParams("aba=swot");
    renderiza();
    expect(screen.getByText("conteúdo do diagnóstico")).toBeInTheDocument();
    expect(screen.queryByText("conteúdo da estrutura")).not.toBeInTheDocument();
  });

  it("clicar numa aba grava o identificador na querystring", () => {
    renderiza();
    fireEvent.click(screen.getByRole("tab", { name: "Construir a estrutura" }));
    expect(replaceMock).toHaveBeenCalledWith("/contratos/7/planejamento?aba=estrutura", { scroll: false });
  });

  it("trocar de aba preserva os outros parâmetros já na URL", () => {
    // A tela carrega filtros e recortes por querystring; a aba não pode
    // atropelá-los ao ser clicada.
    paramsAtuais = new URLSearchParams("aba=diagnostico&busca=saude");
    renderiza();
    fireEvent.click(screen.getByRole("tab", { name: "Construir a estrutura" }));
    const [url] = replaceMock.mock.calls[0];
    expect(url).toContain("busca=saude");
    expect(url).toContain("aba=estrutura");
  });
});

describe("normalizaAba", () => {
  it("aceita os dois identificadores válidos", () => {
    expect(normalizaAba("diagnostico")).toBe("diagnostico");
    expect(normalizaAba("estrutura")).toBe("estrutura");
  });

  it("nulo, vazio e desconhecido caem no padrão", () => {
    expect(normalizaAba(null)).toBe("diagnostico");
    expect(normalizaAba(undefined)).toBe("diagnostico");
    expect(normalizaAba("")).toBe("diagnostico");
    expect(normalizaAba("Diagnóstico (Análise de Conjuntura)")).toBe("diagnostico");
  });
});
