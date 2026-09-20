import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: AD-064 (.specs/STATE.md) -- iip_provisorio = soma de
// componente_d1/d2/d3; pedido de Pedro para mostrar quais dimensões os Fatos
// Geradores mais atingiram, não só o total somado.

const { mockBuscarIipContrato } = vi.hoisted(() => ({ mockBuscarIipContrato: vi.fn() }));
vi.mock("@backend/queries/incidencia", async (importOriginal) => {
  const original = await importOriginal<typeof import("@backend/queries/incidencia")>();
  return { ...original, buscarIipContrato: mockBuscarIipContrato };
});
vi.mock("@backend/rpc/iip", () => ({ atualizaIipContrato: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@backend/supabase/client", () => ({ createClient: () => ({}) }));

import { IipCard } from "./iip-card";

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("IipCard — detalhe por dimensão (AD-064)", () => {
  it("com IIP calculado, mostra D1/D2/D3 e o valor de cada um", async () => {
    mockBuscarIipContrato.mockResolvedValue({
      nrFatos: 4,
      iipProvisorio: 12,
      componenteD1: 5,
      componenteD2: 4,
      componenteD3: 3,
    });

    render(<IipCard idContrato={1} />);

    await waitFor(() => expect(screen.getByText(/IIP \(provisório\): 12/)).toBeInTheDocument());
    expect(screen.getByText("D1")).toBeInTheDocument();
    expect(screen.getByText("D2")).toBeInTheDocument();
    expect(screen.getByText("D3")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("sem fato gerador ainda, não mostra detalhe por dimensão", async () => {
    mockBuscarIipContrato.mockResolvedValue({
      nrFatos: null,
      iipProvisorio: null,
      componenteD1: null,
      componenteD2: null,
      componenteD3: null,
    });

    render(<IipCard idContrato={1} />);

    await waitFor(() => expect(screen.getByText(/sem fato gerador ainda/)).toBeInTheDocument());
    expect(screen.queryByText("D1")).not.toBeInTheDocument();
  });

  it("com fatos mas sem IIP (Assumption #1b/AD-064), não mostra detalhe por dimensão", async () => {
    mockBuscarIipContrato.mockResolvedValue({
      nrFatos: 2,
      iipProvisorio: null,
      componenteD1: null,
      componenteD2: null,
      componenteD3: null,
    });

    render(<IipCard idContrato={1} />);

    await waitFor(() => expect(screen.getByText(/sem dado suficiente/)).toBeInTheDocument());
    expect(screen.queryByText("D1")).not.toBeInTheDocument();
  });
});
