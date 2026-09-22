import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CAMADAS_DADO, ENTREGUE, FALTA } from "@/lib/apresentacao-funcionalidades";
import ApresentacaoFuncionalidadesPage from "./page";

// Pedido de Pedro (2026-09-22): botão no Hub que abre uma visualização do
// que foi entregue e do que falta. Página estática (sem busca de dado, sem
// interação) -- o teste cobre o caminho feliz único (AD-046: tela de
// leitura sem lógica condicional própria além de `.map` sobre dado
// constante).
afterEach(cleanup);

describe("ApresentacaoFuncionalidadesPage", () => {
  it("renderiza o título da página", () => {
    render(<ApresentacaoFuncionalidadesPage />);

    expect(screen.getByRole("heading", { name: /apresentação.*funcionalidades/i, level: 1 })).toBeInTheDocument();
  });

  it("renderiza os números de resumo derivados do conteúdo estático", () => {
    render(<ApresentacaoFuncionalidadesPage />);

    const totalEntregue = ENTREGUE.reduce((soma, bloco) => soma + bloco.itens.length, 0);
    const totalFalta = FALTA.reduce((soma, bloco) => soma + bloco.itens.length, 0);
    const camadasCompletas = CAMADAS_DADO.filter((c) => c.status === "completo").length;

    expect(screen.getByText(`${camadasCompletas}/${CAMADAS_DADO.length}`)).toBeInTheDocument();
    expect(screen.getByText(String(totalEntregue))).toBeInTheDocument();
    expect(screen.getByText(String(totalFalta))).toBeInTheDocument();
  });

  it("lista o título de cada camada de dado", () => {
    render(<ApresentacaoFuncionalidadesPage />);

    for (const camada of CAMADAS_DADO) {
      expect(screen.getByText(camada.nome)).toBeInTheDocument();
    }
  });

  it("lista o título de cada bloco de funcionalidades entregues", () => {
    render(<ApresentacaoFuncionalidadesPage />);

    for (const bloco of ENTREGUE) {
      expect(screen.getByText(bloco.titulo)).toBeInTheDocument();
    }
  });

  it("lista o título de cada bloco do que ainda falta", () => {
    render(<ApresentacaoFuncionalidadesPage />);

    for (const bloco of FALTA) {
      expect(screen.getByText(bloco.titulo)).toBeInTheDocument();
    }
  });
});
