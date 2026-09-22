import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: AD-064 (.specs/STATE.md) -- iip_provisorio = soma de
// componente_d1/d2/d3; pedido de Pedro para mostrar quais dimensões os Fatos
// Geradores mais atingiram, não só o total somado. Layout: Figma 109:73.

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
  it("com IIP calculado, mostra o total, 'Somente realizados' e um badge por dimensão", async () => {
    mockBuscarIipContrato.mockResolvedValue({
      nrFatos: 4,
      iipProvisorio: 12,
      componenteD1: 5,
      componenteD2: 4,
      componenteD3: 3,
    });

    render(<IipCard idContrato={1} />);

    await waitFor(() => expect(screen.getByText("12")).toBeInTheDocument());
    expect(screen.getByText("(provisório)")).toBeInTheDocument();
    expect(screen.getByText("Somente realizados")).toBeInTheDocument();
    expect(screen.getByText("D1 5")).toBeInTheDocument();
    expect(screen.getByText("D2 4")).toBeInTheDocument();
    expect(screen.getByText("D3 3")).toBeInTheDocument();
  });

  it("sem fato gerador ainda, não mostra detalhe por dimensão nem número inventado", async () => {
    mockBuscarIipContrato.mockResolvedValue({
      nrFatos: null,
      iipProvisorio: null,
      componenteD1: null,
      componenteD2: null,
      componenteD3: null,
    });

    render(<IipCard idContrato={1} />);

    await waitFor(() => expect(screen.getByText(/sem fato gerador ainda/)).toBeInTheDocument());
    expect(screen.queryByText(/^D1/)).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
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

    await waitFor(() => expect(screen.getByText(/sem dado suficiente · 2 fatos geradores/)).toBeInTheDocument());
    expect(screen.queryByText(/^D1/)).not.toBeInTheDocument();
  });
});
