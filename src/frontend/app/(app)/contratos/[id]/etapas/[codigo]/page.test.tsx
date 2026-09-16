import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: Barra de
// abas funcional da ficha" AC5 (FMC-04) + A-01: a rota
// `/contratos/[id]/etapas/[codigo]` continua existindo, alcançável por link
// direto, mesmo depois que a barra virou funcional (T22) e ganhou as 4 rotas
// novas desta task (T23) -- só sai da NAVEGAÇÃO, nunca do roteador.
// Teste explícito exigido pelo Done-when da T23 (tasks.md).
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound() chamado inesperadamente no teste");
  },
}));

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({}),
}));

const buscarContratoParaFichaMock = vi.fn();
const buscarEtapasDoProdutoMock = vi.fn();
const buscarReguaDoContratoMock = vi.fn();
const buscarRegistrosDaEtapaMock = vi.fn();

vi.mock("@backend/queries/contrato", () => ({
  buscarContratoParaFicha: (...args: unknown[]) => buscarContratoParaFichaMock(...args),
  buscarEtapasDoProduto: (...args: unknown[]) => buscarEtapasDoProdutoMock(...args),
}));

vi.mock("@backend/queries/etapa-contrato", () => ({
  buscarReguaDoContrato: (...args: unknown[]) => buscarReguaDoContratoMock(...args),
}));

vi.mock("@backend/queries/incidencia", () => ({
  buscarRegistrosDaEtapa: (...args: unknown[]) => buscarRegistrosDaEtapaMock(...args),
}));

import EtapaContratoPage from "./page";

const CONTRATO = {
  idContrato: 1,
  idProduto: 10,
  nomeProduto: "Estratégia",
  idContratante: 100,
  nomeContratante: "Mandato Fulano",
  tipoContratante: "mandato",
};

// `use(params)` suspende até a promise resolver; o protocolo de thenable já
// resolvido (`status`/`value`, ReactFiberThenable) evita que o teste fique
// preso no fallback -- mesma técnica de produtos/[slug]/agenda/page.test.tsx.
function paramsProntos(id: string, codigo: string) {
  const valor = { id, codigo };
  return Object.assign(Promise.resolve(valor), { status: "fulfilled" as const, value: valor });
}

beforeEach(() => {
  buscarContratoParaFichaMock.mockReset().mockResolvedValue(CONTRATO);
  buscarEtapasDoProdutoMock.mockReset().mockResolvedValue([
    { idEtapa: 1, codigo: "diagnostico", nome: "Diagnóstico", ordem: 1 },
  ]);
  buscarReguaDoContratoMock.mockReset().mockResolvedValue([
    {
      idEtapaContrato: 1,
      idEtapa: 1,
      codigo: "diagnostico",
      nome: "Diagnóstico",
      ordem: 1,
      status: "em_andamento",
      dtPrevistaInicio: null,
      dtPrevistaConclusao: null,
      dtInicio: null,
      dtConclusao: null,
      diasAtraso: 0,
      estaAtrasada: false,
    },
  ]);
  buscarRegistrosDaEtapaMock.mockReset().mockResolvedValue([]);
});

afterEach(cleanup);

describe("/contratos/[id]/etapas/[codigo] continua resolvendo (FMC-04 AC5, A-01)", () => {
  it("acessada diretamente por URL, a tela da etapa renderiza -- nenhuma 404", async () => {
    render(<EtapaContratoPage params={paramsProntos("1", "diagnostico")} />);

    expect(await screen.findByText("Etapa 1")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Etapa" })).toBeInTheDocument();
  });
});

// T27 (fatos-geradores-ciclo-vida, AD-057): a escrita de Registro saiu desta
// tela para a aba "Fatos Geradores e Registros" -- a régua/leitura da etapa
// continua, só o formulário de criação não mora mais aqui.
describe("/contratos/[id]/etapas/[codigo] — Registro não se cria mais aqui (AD-057, T27)", () => {
  it("não renderiza nenhum formulário de Registro; a listagem de leitura continua", async () => {
    buscarRegistrosDaEtapaMock.mockResolvedValue([
      { idRegistro: 1, tipoRegistro: "Pontapé", ocorridoEm: "2026-09-01", resumo: "Resumo", nomeAutor: "Ana" },
    ]);

    render(<EtapaContratoPage params={paramsProntos("1", "diagnostico")} />);
    await screen.findByText("Etapa 1");

    expect(screen.queryByRole("button", { name: /registrar/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tipo de Registro")).not.toBeInTheDocument();
    // Leitura permanece: o registro já existente ainda aparece na listagem.
    expect(await screen.findByText("Pontapé")).toBeInTheDocument();
  });
});
