import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../supabase/database.types";

// T15: buscarEncontrosDoMesPll delega em buscarEncontrosDoMes (agenda.ts) SEM
// alteração -- mockado aqui pra afirmar exatamente o que é repassado, sem
// duplicar a suíte de agenda.test.ts (já cobre buscarEncontrosDoMes em si).
const mocks = vi.hoisted(() => ({ buscarEncontrosDoMes: vi.fn() }));
vi.mock("./agenda", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./agenda")>()),
  buscarEncontrosDoMes: mocks.buscarEncontrosDoMes,
}));

import { buscarEncontrosDoMesPll, buscarOpcoesEdicaoPll, buscarOpcoesMentoradoPll } from "./pll-agenda";

// Spec anchor: pll-dashboard-agenda T14/T15 Done-when (tasks.md) -- PLL-AG-08.
// buscarOpcoesMentorPll é reexportado de pll-dashboard.ts (já coberto em
// pll-dashboard.test.ts, T12) -- não reteste aqui.
//
// Mesmo mock roteado por tabela de pll-dashboard.test.ts.

type RespostaTabela = { data: unknown; error: { message: string } | null };

function criarClienteMock(respostasPorTabela: Record<string, RespostaTabela | RespostaTabela[]>) {
  const filas = new Map<string, RespostaTabela[]>(
    Object.entries(respostasPorTabela).map(([tabela, resp]) => [tabela, Array.isArray(resp) ? [...resp] : [resp]])
  );

  function proximaResposta(tabela: string): RespostaTabela {
    const fila = filas.get(tabela);
    if (!fila || fila.length === 0) return { data: null, error: null };
    return fila.length > 1 ? fila.shift()! : fila[0];
  }

  function criarBuilder(tabela: string) {
    const resposta = proximaResposta(tabela);
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      is: () => builder,
      order: () => builder,
      not: () => builder,
      then: (resolve: (valor: RespostaTabela) => void, reject: (erro: unknown) => void) =>
        Promise.resolve(resposta).then(resolve, reject),
    };
    return builder;
  }

  const client = { from: (tabela: string) => criarBuilder(tabela) };
  return client as unknown as SupabaseClient<Database>;
}

const OK = { error: null };

describe("buscarOpcoesMentoradoPll (T14, PLL-AG-08)", () => {
  it("caminho feliz: devolve os mentorados (assessor ativo) dos contratos do produto", async () => {
    const client = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }], ...OK },
      rel_usuario_contrato: { data: [{ id_usuario: 300 }], ...OK },
      dim_usuario: { data: [{ id_usuario: 300, nome: "Ana Souza" }], ...OK },
    });

    const resultado = await buscarOpcoesMentoradoPll(client, 9);

    expect(resultado).toEqual([{ id: 300, nome: "Ana Souza" }]);
  });

  it("recorte sem nenhum contrato devolve [], nunca lança", async () => {
    const client = criarClienteMock({ fat_contrato: { data: [], ...OK } });

    expect(await buscarOpcoesMentoradoPll(client, 9)).toEqual([]);
  });

  it("erro do banco propaga", async () => {
    const client = criarClienteMock({
      fat_contrato: { data: null, error: { message: "permission denied for table fat_contrato" } },
    });

    await expect(buscarOpcoesMentoradoPll(client, 9)).rejects.toMatchObject({
      message: "permission denied for table fat_contrato",
    });
  });
});

describe("buscarOpcoesEdicaoPll (T14, PLL-AG-08)", () => {
  it("caminho feliz: devolve as edições (ref_projeto) dos contratos do produto", async () => {
    const client = criarClienteMock({
      fat_contrato: { data: [{ id_projeto: 10 }], ...OK },
      ref_projeto: { data: [{ id_projeto: 10, nome: "2026.1" }], ...OK },
    });

    const resultado = await buscarOpcoesEdicaoPll(client, 9);

    expect(resultado).toEqual([{ id: 10, nome: "2026.1" }]);
  });

  it("recorte sem projeto associado devolve []", async () => {
    const client = criarClienteMock({ fat_contrato: { data: [], ...OK } });

    expect(await buscarOpcoesEdicaoPll(client, 9)).toEqual([]);
  });
});

describe("buscarEncontrosDoMesPll (T15, PLL-AG-08)", () => {
  it("sem idsMentor/idsMentorado, delega direto -- idsContrato undefined, idsProjeto repassado", async () => {
    mocks.buscarEncontrosDoMes.mockReset().mockResolvedValue([]);
    const clienteInerte = {} as unknown as SupabaseClient<Database>;

    await buscarEncontrosDoMesPll(clienteInerte, { idProduto: 9, ano: 2026, mes: 9, idsProjeto: [10] });

    expect(mocks.buscarEncontrosDoMes).toHaveBeenCalledWith(clienteInerte, {
      idProduto: 9,
      ano: 2026,
      mes: 9,
      idsProjeto: [10],
      idsContrato: undefined,
    });
  });

  it("com idsMentor, resolve o idsContrato (interseção com o produto) antes de delegar", async () => {
    mocks.buscarEncontrosDoMes.mockReset().mockResolvedValue([]);
    const client = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }, { id_contrato: 2 }], ...OK },
      rel_usuario_contrato: { data: [{ id_contrato: 1 }], ...OK },
    });

    await buscarEncontrosDoMesPll(client, { idProduto: 9, ano: 2026, mes: 9, idsMentor: [200] });

    expect(mocks.buscarEncontrosDoMes).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ idsContrato: [1] })
    );
  });

  it("com idsMentor E idsMentorado, a interseção dos dois vale (AND)", async () => {
    mocks.buscarEncontrosDoMes.mockReset().mockResolvedValue([]);
    const client = criarClienteMock({
      fat_contrato: { data: [{ id_contrato: 1 }, { id_contrato: 2 }], ...OK },
      rel_usuario_contrato: [
        { data: [{ id_contrato: 1 }, { id_contrato: 2 }], ...OK }, // mentor: ambos
        { data: [{ id_contrato: 2 }], ...OK }, // mentorado: só o 2
      ],
    });

    await buscarEncontrosDoMesPll(client, { idProduto: 9, ano: 2026, mes: 9, idsMentor: [200], idsMentorado: [300] });

    expect(mocks.buscarEncontrosDoMes).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ idsContrato: [2] })
    );
  });

  it("erro do banco na resolução propaga sem chegar a chamar buscarEncontrosDoMes", async () => {
    mocks.buscarEncontrosDoMes.mockReset();
    const client = criarClienteMock({
      fat_contrato: { data: null, error: { message: "permission denied for table fat_contrato" } },
    });

    await expect(
      buscarEncontrosDoMesPll(client, { idProduto: 9, ano: 2026, mes: 9, idsMentor: [200] })
    ).rejects.toMatchObject({ message: "permission denied for table fat_contrato" });
    expect(mocks.buscarEncontrosDoMes).not.toHaveBeenCalled();
  });

  it("D-6(a): cada Encontro sai com nomeMentor do contrato, null quando não há mentor pareado (AD-005)", async () => {
    const ENCONTRO_BASE = {
      idEncontro: 1,
      idContrato: 1,
      nomeContratante: "Dep. Ana Ribeiro",
      titulo: "Mentoria 1",
      status: "planejado" as const,
      dtPrevistaInicio: "2026-09-10T14:00:00-03:00",
      dtPrevistaFim: null,
      dtRealizada: null,
      nomeEtapa: null,
      nomeTipo: "Mentoria",
      modalidade: null,
      local: null,
      temaPrioritario: null,
      participantes: [],
    };
    mocks.buscarEncontrosDoMes
      .mockReset()
      .mockResolvedValue([ENCONTRO_BASE, { ...ENCONTRO_BASE, idEncontro: 2, idContrato: 2 }]);
    const client = criarClienteMock({
      rel_usuario_contrato: { data: [{ id_contrato: 1, id_usuario: 500 }], ...OK },
      dim_usuario: { data: [{ id_usuario: 500, nome: "Carla Mentora" }], ...OK },
    });

    const resultado = await buscarEncontrosDoMesPll(client, { idProduto: 9, ano: 2026, mes: 9 });

    expect(resultado.find((e) => e.idContrato === 1)?.nomeMentor).toBe("Carla Mentora");
    expect(resultado.find((e) => e.idContrato === 2)?.nomeMentor).toBeNull();
  });
});
