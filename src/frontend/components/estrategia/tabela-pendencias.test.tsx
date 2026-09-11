import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/tasks.md, T18
// "Done when" (EST-07 AC4, AC5, AC6, AD-046 -- tela de leitura, caminho
// feliz de cada AC).
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import type { Pendencia } from "@backend/queries/pendencias";
import { TabelaPendencias } from "./tabela-pendencias";

afterEach(cleanup);

const PENDENCIA_BASE: Pendencia = {
  idContrato: 42,
  nomeContratante: "Dep. Ana Ribeiro",
  categoria: "formulario_aberto",
  detalhe: "Formulário de imersão",
  dtReferencia: "2026-07-02",
  diasEmAberto: 30,
};

describe("TabelaPendencias (EST-07)", () => {
  it("renderiza uma linha por pendência, com mandato, badge por tipo e detalhe (AC4)", () => {
    render(<TabelaPendencias pendencias={[PENDENCIA_BASE]} />);

    expect(screen.getByText("Dep. Ana Ribeiro")).toBeInTheDocument();
    expect(screen.getByText("Formulário aberto")).toBeInTheDocument();
    expect(screen.getByText("Formulário de imersão")).toBeInTheDocument();
  });

  it("clique na linha navega para o contrato correspondente (AC5)", () => {
    render(<TabelaPendencias pendencias={[PENDENCIA_BASE]} />);

    screen.getByRole("link", { name: /Dep\. Ana Ribeiro/ }).click();

    expect(push).toHaveBeenCalledWith("/contratos/42");
  });

  it("lista vazia renderiza EstadoVazio, não uma tabela vazia (AC6)", () => {
    render(<TabelaPendencias pendencias={[]} />);

    expect(screen.getByText("Sem pendências")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
