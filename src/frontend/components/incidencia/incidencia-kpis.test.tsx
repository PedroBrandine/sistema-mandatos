import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FatoGeradorResumo } from "@backend/queries/incidencia";

// Spec anchor: .specs/features/fatos-geradores-ciclo-vida/spec.md, "P1: Fato
// projetado e sua realização" AC6 -- realizados e "N projeções em aberto"
// SEMPRE separados, nunca somados num único número.

vi.mock("@backend/queries/incidencia", async (importOriginal) => {
  const original = await importOriginal<typeof import("@backend/queries/incidencia")>();
  return { ...original, buscarIipContrato: vi.fn().mockResolvedValue({ nrFatos: null, iipProvisorio: null }) };
});
vi.mock("@backend/rpc/iip", () => ({ atualizaIipContrato: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@backend/supabase/client", () => ({ createClient: () => ({}) }));

import { IncidenciaKpis } from "./incidencia-kpis";

function fato(situacao: "realizado" | "projetado"): FatoGeradorResumo {
  return {
    idFatoGerador: Math.random(),
    tipologia: "x",
    niveis: { d1: "baixo", d2: null, d3: null },
    titulo: "t",
    situacao,
    dtOcorrencia: situacao === "realizado" ? "2026-09-01" : null,
    dtPrevista: situacao === "projetado" ? "2026-10-01" : null,
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("IncidenciaKpis — contagem separada (spec.md AC6)", () => {
  it("mostra realizados e projeções em aberto como números distintos", async () => {
    render(
      <IncidenciaKpis idContrato={7} fatosGeradores={[fato("realizado"), fato("realizado"), fato("projetado")]} />
    );

    await waitFor(() => expect(screen.getByText("2 fatos geradores realizados")).toBeInTheDocument());
    expect(screen.getByText("1 projeções em aberto")).toBeInTheDocument();
  });

  it("sem nenhum fato, mostra 0 e 0 -- lado oposto (nunca oculta o card)", async () => {
    render(<IncidenciaKpis idContrato={7} fatosGeradores={[]} />);

    await waitFor(() => expect(screen.getByText("0 fatos geradores realizados")).toBeInTheDocument());
    expect(screen.getByText("0 projeções em aberto")).toBeInTheDocument();
  });
});
