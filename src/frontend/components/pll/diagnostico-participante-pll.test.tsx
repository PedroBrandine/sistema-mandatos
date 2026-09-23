import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Recharts precisa de ResizeObserver em jsdom (mesmo stub de
// composicao-partidaria-casa.test.tsx).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver ?? ResizeObserverStub;

const mocks = vi.hoisted(() => ({
  buscarCadastroParticipanteFicha: vi.fn(),
  buscarDadosTseFicha: vi.fn(),
  papelGlobal: { papel: "mentor" as string | null, carregando: false },
}));

vi.mock("@backend/queries/pll-ficha", () => ({
  buscarCadastroParticipanteFicha: mocks.buscarCadastroParticipanteFicha,
  buscarDadosTseFicha: mocks.buscarDadosTseFicha,
}));
vi.mock("@backend/queries/pll-cadastro", () => ({
  atualizarCamposEditaveisParticipante: vi.fn(),
}));
vi.mock("@backend/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/hooks/use-papel-global", () => ({ usePapelGlobal: () => mocks.papelGlobal }));

import { DiagnosticoParticipantePll } from "./diagnostico-participante-pll";

// PF3-02 (.specs/features/pente-fino-2026-09-23-lote2/spec.md AC3):
// DiagnosticoParticipantePll é o MESMO componente reaproveitado por
// /produtos/pll/participantes/[id] e por /contratos/[id]/diagnostico
// (diagnostico-participante-pll.tsx:22-31) -- cada rota já prova, no seu
// próprio teste de página, que monta este componente; este teste prova, em
// isolamento, que o componente em si renderiza o gráfico donut da
// Composição Partidária, fechando as duas pontas de AC3 sem duplicar setup
// de roteamento.

const PARTICIPANTE = {
  idCadastroParticipante: 1,
  nomeCompleto: "Fulana de Tal",
  papel: "mentorado" as const,
  idVinculoTse: 55,
  notaEducacao: null,
  notaSegurancaPublica: null,
  notaModernizacaoEstado: null,
  notaClima: null,
  outrasPautas: [],
  especifiquePauta: null,
  desafios: [],
  destaques: [],
  ambicaoTexto: null,
  ambicaoTags: [],
  swotForcas: [],
  swotFraquezas: [],
  swotOportunidades: [],
  swotAmeacas: [],
};

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DiagnosticoParticipantePll idCadastroParticipante={1} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mocks.buscarCadastroParticipanteFicha.mockReset().mockResolvedValue(PARTICIPANTE);
  mocks.buscarDadosTseFicha.mockReset().mockResolvedValue({
    candidaturas: [],
    composicao: [{ siglaPartido: "PT", quantidade: 10, percentual: 50 }],
  });
});

afterEach(cleanup);

describe("DiagnosticoParticipantePll (PF3-02 AC3)", () => {
  it("participante vinculado ao TSE renderiza o gráfico donut da Composição Partidária", async () => {
    renderizar();

    expect(await screen.findByRole("img", { name: "Composição Partidária da Casa" })).toBeInTheDocument();
    expect(screen.getByText("PT")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });
});
