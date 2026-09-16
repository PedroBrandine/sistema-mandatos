import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: .specs/features/fatos-geradores-ciclo-vida/spec.md, "A aba
// como casa única da Incidência" AC1; design.md "AbaIncidencia" (toggle por
// querystring, mesma forma de planejamento-abas.tsx). AD-042 integral.

let paramsAtuais = new URLSearchParams();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/contratos/7/fatos-registros",
  useSearchParams: () => paramsAtuais,
}));

import { AbaIncidencia, normalizaVisao, VISAO_PADRAO } from "./aba-incidencia";

function renderiza() {
  return render(
    <AbaIncidencia
      linhaDoTempo={<p>conteúdo da linha do tempo</p>}
      cicloDeVida={<p>conteúdo do ciclo de vida</p>}
      criar={[
        { rotulo: "Registrar Registro", conteudo: <p>form de registro</p> },
        { rotulo: "Registrar Pré-Insight", conteudo: <p>form de pré-insight</p> },
        { rotulo: "Registrar Insight", conteudo: <p>form de insight</p> },
        { rotulo: "Registrar Fato Gerador", conteudo: <p>wizard de fato gerador</p> },
      ]}
    />
  );
}

beforeEach(() => {
  paramsAtuais = new URLSearchParams();
  replaceMock.mockClear();
});

afterEach(cleanup);

describe("AbaIncidencia — normalizaVisao", () => {
  it("valor desconhecido cai no padrão (Linha do Tempo)", () => {
    expect(normalizaVisao("qualquer-coisa")).toBe(VISAO_PADRAO);
    expect(normalizaVisao(null)).toBe(VISAO_PADRAO);
  });

  it("'ciclo-de-vida' é reconhecido -- lado oposto", () => {
    expect(normalizaVisao("ciclo-de-vida")).toBe("ciclo-de-vida");
  });
});

describe("AbaIncidencia — cada visão mostra o seu e esconde o outro", () => {
  it("Linha do Tempo é a visão padrão", () => {
    renderiza();
    expect(screen.getByText("conteúdo da linha do tempo")).toBeInTheDocument();
    expect(screen.queryByText("conteúdo do ciclo de vida")).not.toBeInTheDocument();
  });

  it("clicar em 'Ciclo de Vida' chama router.replace com a querystring nova -- lado oposto", () => {
    renderiza();
    fireEvent.click(screen.getByRole("tab", { name: "Ciclo de Vida" }));

    expect(replaceMock).toHaveBeenCalledWith("/contratos/7/fatos-registros?visao=ciclo-de-vida", { scroll: false });
  });

  it("com ?visao=ciclo-de-vida já presente, mostra o Ciclo de Vida direto", () => {
    paramsAtuais = new URLSearchParams("visao=ciclo-de-vida");
    renderiza();

    expect(screen.getByText("conteúdo do ciclo de vida")).toBeInTheDocument();
    expect(screen.queryByText("conteúdo da linha do tempo")).not.toBeInTheDocument();
  });
});

describe("AbaIncidencia — menu Criar (spec.md 'aba como casa única' AC1)", () => {
  it("oferece as 4 entidades", () => {
    renderiza();
    expect(screen.getByRole("button", { name: "Registrar Registro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar Pré-Insight" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar Insight" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar Fato Gerador" })).toBeInTheDocument();
  });

  it("clicar num item abre o diálogo com o conteúdo daquele item, só", () => {
    renderiza();
    fireEvent.click(screen.getByRole("button", { name: "Registrar Insight" }));

    expect(screen.getByText("form de insight")).toBeInTheDocument();
    expect(screen.queryByText("form de registro")).not.toBeInTheDocument();
    expect(screen.queryByText("wizard de fato gerador")).not.toBeInTheDocument();
  });
});
