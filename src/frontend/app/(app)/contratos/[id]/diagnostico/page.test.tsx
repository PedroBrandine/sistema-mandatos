import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DIAG-01..DIAG-20 (.specs/features/diagnostico-mandato-estrategia/spec.md).
// Substitui o teste do placeholder puro (FMC-04 AC6) -- agora a rota busca
// dados (buscarDiagnosticoMandato) e monta 3 blocos para contrato de
// mandato: CardDiagnosticoMandato, CardSwotMandato e InformacoesTseMandato
// (movido de Informações Gerais). Contrato de coalizão (sem dim_mandato,
// query devolve null) continua caindo no placeholder <EmDesenvolvimento>,
// mesma AC6 original.

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({}),
}));

const buscarDiagnosticoMandatoMock = vi.fn();

vi.mock("@backend/queries/ficha-mandato", () => ({
  buscarDiagnosticoMandato: (...args: unknown[]) => buscarDiagnosticoMandatoMock(...args),
}));

vi.mock("@/components/fundacao/card-diagnostico-mandato", () => ({
  CardDiagnosticoMandato: ({ idMandato, principaisDestaques }: { idMandato: number; principaisDestaques: string[] | null }) => (
    <div data-testid="card-diagnostico-mandato">
      {idMandato}:{(principaisDestaques ?? []).join(",")}
    </div>
  ),
}));

vi.mock("@/components/fundacao/card-swot-mandato", () => ({
  CardSwotMandato: ({ idMandato, swotForcas }: { idMandato: number; swotForcas: string[] | null }) => (
    <div data-testid="card-swot-mandato">
      {idMandato}:{(swotForcas ?? []).join(",")}
    </div>
  ),
}));

vi.mock("@/components/fundacao/informacoes-tse-mandato", () => ({
  InformacoesTseMandato: ({ idMandato }: { idMandato: number }) => (
    <div data-testid="informacoes-tse-mandato">{idMandato}</div>
  ),
}));

import ContratoDiagnosticoPage from "./page";

const DIAGNOSTICO_BASE = {
  idMandato: 200,
  principaisDestaques: ["Aprovou a Lei X"],
  cargosLegislatura: ["Vice-líder"],
  principaisPls: ["PL 123/2026"],
  principaisNoticias: [{ titulo: "Matéria", url: "https://exemplo.com" }],
  swotForcas: ["Boa base eleitoral"],
  swotFraquezas: [],
  swotOportunidades: [],
  swotAmeacas: [],
};

function paramsProntos(id: string): Promise<{ id: string }> {
  const valor = { id };
  return Object.assign(Promise.resolve(valor), { status: "fulfilled" as const, value: valor });
}

beforeEach(() => {
  buscarDiagnosticoMandatoMock.mockReset();
});

afterEach(cleanup);

describe("/contratos/[id]/diagnostico — carregando e erro", () => {
  it("enquanto carrega, renderiza <CarregandoSkeleton>", () => {
    buscarDiagnosticoMandatoMock.mockReturnValue(new Promise(() => {}));

    render(<ContratoDiagnosticoPage params={paramsProntos("1")} />);

    expect(screen.getByRole("status", { name: "Carregando" })).toBeInTheDocument();
  });

  it("falha em buscarDiagnosticoMandato renderiza <ErroInline>", async () => {
    buscarDiagnosticoMandatoMock.mockRejectedValue(new Error("RLS negou a leitura"));

    render(<ContratoDiagnosticoPage params={paramsProntos("1")} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("RLS negou a leitura");
  });
});

describe("/contratos/[id]/diagnostico — contrato de coalizão (FMC-04 AC6)", () => {
  it("sem dim_mandato associado, renderiza o placeholder com título 'Diagnóstico'", async () => {
    buscarDiagnosticoMandatoMock.mockResolvedValue(null);

    render(<ContratoDiagnosticoPage params={paramsProntos("2")} />);

    expect(await screen.findByText("Diagnóstico")).toBeInTheDocument();
    expect(screen.queryByTestId("card-diagnostico-mandato")).not.toBeInTheDocument();
  });
});

describe("/contratos/[id]/diagnostico — mandato (DIAG-01..DIAG-20)", () => {
  it("monta CardDiagnosticoMandato, CardSwotMandato e InformacoesTseMandato com os dados do mandato", async () => {
    buscarDiagnosticoMandatoMock.mockResolvedValue(DIAGNOSTICO_BASE);

    render(<ContratoDiagnosticoPage params={paramsProntos("1")} />);

    expect(await screen.findByTestId("card-diagnostico-mandato")).toHaveTextContent("200:Aprovou a Lei X");
    expect(screen.getByTestId("card-swot-mandato")).toHaveTextContent("200:Boa base eleitoral");
    expect(screen.getByTestId("informacoes-tse-mandato")).toHaveTextContent("200");
  });
});
