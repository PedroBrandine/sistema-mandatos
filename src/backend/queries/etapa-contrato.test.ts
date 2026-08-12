import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarReguaDoContrato } from "./etapa-contrato";

type RespostaTabela = { data: unknown; error: { message: string } | null };

// Mock de client de tabela única -- mesmo padrão de queries/tse.test.ts (aqui só
// vw_etapa_contrato é consultada).
function criarClienteMock(resposta: RespostaTabela) {
  const chamadas: { metodo: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {
    select: (...args: unknown[]) => {
      chamadas.push({ metodo: "select", args });
      return builder;
    },
    eq: (...args: unknown[]) => {
      chamadas.push({ metodo: "eq", args });
      return builder;
    },
    order: (...args: unknown[]) => {
      chamadas.push({ metodo: "order", args });
      return Promise.resolve(resposta);
    },
  };
  const client = { from: () => builder };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

describe("buscarReguaDoContrato", () => {
  // Done-when: "mapeia as colunas da view para o view-model, ordenado por ordem"
  it("mapeia as colunas de vw_etapa_contrato para EtapaRegua", async () => {
    const { client, chamadas } = criarClienteMock({
      data: [
        {
          id_etapa_contrato: 1,
          id_etapa: 10,
          codigo_etapa: "cadastro",
          nome_etapa: "Cadastro",
          ordem: 1,
          status: "nao_iniciada",
          dt_prevista_inicio: "2026-01-01",
          dt_prevista_conclusao: "2026-01-08",
          dt_inicio: null,
          dt_conclusao: null,
          dias_atraso: 5,
          esta_atrasada: true,
        },
        {
          id_etapa_contrato: 2,
          id_etapa: 11,
          codigo_etapa: "pontape",
          nome_etapa: "Pontapé",
          ordem: 2,
          status: "concluida",
          dt_prevista_inicio: "2026-01-08",
          dt_prevista_conclusao: "2026-01-22",
          dt_inicio: "2026-01-08",
          dt_conclusao: "2026-01-20",
          dias_atraso: 0,
          esta_atrasada: false,
        },
      ],
      error: null,
    });

    const resultado = await buscarReguaDoContrato(client, 42);

    expect(resultado).toEqual([
      {
        idEtapaContrato: 1,
        idEtapa: 10,
        codigo: "cadastro",
        nome: "Cadastro",
        ordem: 1,
        status: "nao_iniciada",
        dtPrevistaInicio: "2026-01-01",
        dtPrevistaConclusao: "2026-01-08",
        dtInicio: null,
        dtConclusao: null,
        diasAtraso: 5,
        estaAtrasada: true,
      },
      {
        idEtapaContrato: 2,
        idEtapa: 11,
        codigo: "pontape",
        nome: "Pontapé",
        ordem: 2,
        status: "concluida",
        dtPrevistaInicio: "2026-01-08",
        dtPrevistaConclusao: "2026-01-22",
        dtInicio: "2026-01-08",
        dtConclusao: "2026-01-20",
        diasAtraso: 0,
        estaAtrasada: false,
      },
    ]);

    const chamadaEq = chamadas.find((c) => c.metodo === "eq");
    expect(chamadaEq?.args).toEqual(["id_contrato", 42]);
    const chamadaOrder = chamadas.find((c) => c.metodo === "order");
    expect(chamadaOrder?.args).toEqual(["ordem", { ascending: true }]);
  });

  // Done-when: "AC3 -- contrato com todas as etapas nao_iniciada não é tratado como vazio"
  it("retorna a régua completa mesmo quando nenhuma etapa saiu de nao_iniciada", async () => {
    const { client } = criarClienteMock({
      data: [
        {
          id_etapa_contrato: 1,
          id_etapa: 10,
          codigo_etapa: "cadastro",
          nome_etapa: "Cadastro",
          ordem: 1,
          status: "nao_iniciada",
          dt_prevista_inicio: "2026-01-01",
          dt_prevista_conclusao: "2026-01-08",
          dt_inicio: null,
          dt_conclusao: null,
          dias_atraso: 0,
          esta_atrasada: false,
        },
      ],
      error: null,
    });

    const resultado = await buscarReguaDoContrato(client, 42);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].status).toBe("nao_iniciada");
  });

  // Done-when: "retorna [] (não lança) quando o contrato não tem etapa instanciada"
  it("retorna lista vazia quando o contrato não tem nenhuma linha na view", async () => {
    const { client } = criarClienteMock({ data: [], error: null });
    const resultado = await buscarReguaDoContrato(client, 999);
    expect(resultado).toEqual([]);
  });

  // Done-when: "propaga o erro do PostgREST em vez de engolir"
  it("lança quando a consulta retorna erro", async () => {
    const { client } = criarClienteMock({ data: null, error: { message: "boom" } });
    await expect(buscarReguaDoContrato(client, 1)).rejects.toEqual({ message: "boom" });
  });
});
