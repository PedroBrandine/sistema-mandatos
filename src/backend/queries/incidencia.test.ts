import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import {
  buscarIipContrato,
  buscarNiveisIip,
  buscarPilaresInsight,
  buscarTiposRegistroDaEtapa,
  buscarTipologiasAtivas,
} from "./incidencia";

// Spec anchor: incidencia-encontros T26 Done-when (.specs/features/incidencia-encontros/tasks.md) --
//  - Cada função mapeia snake_case -> camelCase/shape do design.md
//  - `if (!data) return []`/`null` quando a consulta não retorna linha
//  - Campos NULL-safe (AD-005): nrFatos/iipProvisorio ficam null, nunca 0
//
// spec.md INC-04, INC-05, INC-07, INC-08, INC-09.

type RespostaTabela = { data: unknown; error: { message: string } | null };
type Chamada = { tabela: string; metodo: string; args: unknown[] };

// Mesmo padrão de kanban.test.ts: mock roteado por nome de tabela, builder
// thenable (resolve direto quando aguardado sem `.maybeSingle()`).
function criarClienteMock(respostasPorTabela: Record<string, RespostaTabela>) {
  const chamadas: Chamada[] = [];

  function criarBuilder(tabela: string) {
    const resposta = respostasPorTabela[tabela] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {
      select: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "select", args });
        return builder;
      },
      eq: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "eq", args });
        return builder;
      },
      maybeSingle: () => {
        chamadas.push({ tabela, metodo: "maybeSingle", args: [] });
        return Promise.resolve(resposta);
      },
      then: (resolve: (valor: RespostaTabela) => void, reject: (erro: unknown) => void) =>
        Promise.resolve(resposta).then(resolve, reject),
    };
    return builder;
  }

  const client = {
    from: (tabela: string) => {
      chamadas.push({ tabela, metodo: "from", args: [tabela] });
      return criarBuilder(tabela);
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

describe("buscarIipContrato", () => {
  it("mapeia nr_fatos/iip_provisorio de vw_iip_contrato para o view-model", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_iip_contrato: { data: { nr_fatos: 3, iip_provisorio: 12 }, error: null },
    });

    const resultado = await buscarIipContrato(client, 42);

    expect(resultado).toEqual({ nrFatos: 3, iipProvisorio: 12 });
    const chamadaEq = chamadas.find((c) => c.tabela === "vw_iip_contrato" && c.metodo === "eq");
    expect(chamadaEq?.args).toEqual(["id_contrato", 42]);
  });

  // AD-005/Edge Case: contrato sem Fato Gerador -- nr_fatos/iip_provisorio NULL, nunca 0.
  it("retorna nrFatos/iipProvisorio null quando o contrato não tem Fato Gerador", async () => {
    const { client } = criarClienteMock({
      vw_iip_contrato: { data: { nr_fatos: null, iip_provisorio: null }, error: null },
    });

    const resultado = await buscarIipContrato(client, 42);
    expect(resultado).toEqual({ nrFatos: null, iipProvisorio: null });
  });

  it("retorna null quando a view não tem nenhuma linha para o contrato", async () => {
    const { client } = criarClienteMock({ vw_iip_contrato: { data: null, error: null } });
    const resultado = await buscarIipContrato(client, 999);
    expect(resultado).toBeNull();
  });

  it("propaga o erro do PostgREST em vez de engolir", async () => {
    const { client } = criarClienteMock({ vw_iip_contrato: { data: null, error: { message: "boom" } } });
    await expect(buscarIipContrato(client, 1)).rejects.toEqual({ message: "boom" });
  });
});

describe("buscarTipologiasAtivas", () => {
  it("concatena grupo · tipologia · estado em nome (catálogo sem campo único de rótulo)", async () => {
    const { client } = criarClienteMock({
      ref_tipologia: {
        data: [{ id_tipologia: 1, grupo: "1. Planejamento e Agenda", tipologia: "Pautar Debates", estado: "Iniciado" }],
        error: null,
      },
    });

    const resultado = await buscarTipologiasAtivas(client);
    expect(resultado).toEqual([{ id: 1, nome: "1. Planejamento e Agenda · Pautar Debates · Iniciado" }]);
  });

  it("retorna [] quando não há nenhuma ref_tipologia ativa", async () => {
    const { client } = criarClienteMock({ ref_tipologia: { data: [], error: null } });
    expect(await buscarTipologiasAtivas(client)).toEqual([]);
  });
});

describe("buscarPilaresInsight", () => {
  it("mapeia id_pilar/nome para RefOption", async () => {
    const { client } = criarClienteMock({
      ref_pilar_insight: { data: [{ id_pilar: 1, nome: "Consciência" }], error: null },
    });

    expect(await buscarPilaresInsight(client)).toEqual([{ id: 1, nome: "Consciência" }]);
  });

  it("retorna [] quando não há nenhum ref_pilar_insight ativo", async () => {
    const { client } = criarClienteMock({ ref_pilar_insight: { data: [], error: null } });
    expect(await buscarPilaresInsight(client)).toEqual([]);
  });
});

describe("buscarNiveisIip", () => {
  it("mapeia codigo/rotulo de ref_nivel_iip", async () => {
    const { client } = criarClienteMock({
      ref_nivel_iip: {
        data: [
          { codigo: "baixo", rotulo: "Baixo" },
          { codigo: "maximo", rotulo: "Máximo" },
        ],
        error: null,
      },
    });

    expect(await buscarNiveisIip(client)).toEqual([
      { codigo: "baixo", rotulo: "Baixo" },
      { codigo: "maximo", rotulo: "Máximo" },
    ]);
  });

  it("retorna [] quando ref_nivel_iip não tem nenhuma linha", async () => {
    const { client } = criarClienteMock({ ref_nivel_iip: { data: [], error: null } });
    expect(await buscarNiveisIip(client)).toEqual([]);
  });
});

describe("buscarTiposRegistroDaEtapa", () => {
  it("mapeia id_tipo_registro/nome de ref_tipo_registro filtrado pela etapa", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_tipo_registro: { data: [{ id_tipo_registro: 5, nome: "Monitoramento mensal" }], error: null },
    });

    const resultado = await buscarTiposRegistroDaEtapa(client, 10);

    expect(resultado).toEqual([{ id: 5, nome: "Monitoramento mensal" }]);
    const eqs = chamadas.filter((c) => c.tabela === "ref_tipo_registro" && c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["id_etapa", 10]);
  });

  // Edge Case (spec.md): Coalizão não tem ref_tipo_registro seedado -- retorna [], não erro.
  it("retorna [] quando a etapa não tem nenhum tipo de registro cadastrado (ex.: Coalizão)", async () => {
    const { client } = criarClienteMock({ ref_tipo_registro: { data: [], error: null } });
    expect(await buscarTiposRegistroDaEtapa(client, 999)).toEqual([]);
  });
});
