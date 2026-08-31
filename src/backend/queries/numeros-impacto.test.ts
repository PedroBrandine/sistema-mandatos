import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarNumerosImpacto } from "./numeros-impacto";

// Spec anchor: saida-numeros-impacto T7 Done-when (.specs/features/saida-numeros-impacto/tasks.md) --
//  - Mapeia todas as colunas de mv_numeros_impacto (design.md, LinhaNumerosImpacto) de
//    snake_case para camelCase
//  - Ordena por nomeContratante (a MV não define ordem própria)
//  - nr_contratos_contratante/ordem_contrato repassados sem recálculo
//
// spec.md P1 AC1/AC3.

function criarClienteMock(resultado: { data: unknown; error: { message: string } | null }) {
  const client = {
    from: (_tabela: string) => ({
      select: (_colunas: string) => Promise.resolve(resultado),
    }),
  };
  return { client: client as unknown as SupabaseClient<Database> };
}

const LINHA_COMPLETA = {
  id_contrato: 10,
  id_contratante: 1,
  nome_contratante: "Mandato Exemplo",
  tipo_contratante: "mandato",
  sg_uf: "SP",
  nm_municipio: "São Paulo",
  nome_produto: "Estratégia",
  nome_projeto: "Projeto X",
  tematica: "Saúde",
  dt_inicio: "2025-01-10",
  dt_fim: null,
  ano_inicio: 2025,
  status: "ativo",
  cargo_no_contrato: "Vereador(a)",
  partido_no_contrato: "PT",
  nr_contratos_contratante: 1,
  dt_primeira_contratacao: "2025-01-10",
  ordem_contrato: 1,
};

describe("buscarNumerosImpacto", () => {
  it("mapeia todas as colunas de mv_numeros_impacto para camelCase", async () => {
    const { client } = criarClienteMock({ data: [LINHA_COMPLETA], error: null });

    const resultado = await buscarNumerosImpacto(client);

    expect(resultado).toEqual([
      {
        idContrato: 10,
        idContratante: 1,
        nomeContratante: "Mandato Exemplo",
        tipoContratante: "mandato",
        sgUf: "SP",
        nmMunicipio: "São Paulo",
        nomeProduto: "Estratégia",
        nomeProjeto: "Projeto X",
        tematica: "Saúde",
        dtInicio: "2025-01-10",
        dtFim: null,
        anoInicio: 2025,
        status: "ativo",
        cargoNoContrato: "Vereador(a)",
        partidoNoContrato: "PT",
        nrContratosContratante: 1,
        dtPrimeiraContratacao: "2025-01-10",
        ordemContrato: 1,
      },
    ]);
  });

  it("ordena o resultado por nomeContratante (a MV não define ordem própria)", async () => {
    const { client } = criarClienteMock({
      data: [
        { ...LINHA_COMPLETA, id_contrato: 1, nome_contratante: "Zulu Contratante" },
        { ...LINHA_COMPLETA, id_contrato: 2, nome_contratante: "Alfa Contratante" },
        { ...LINHA_COMPLETA, id_contrato: 3, nome_contratante: "Mike Contratante" },
      ],
      error: null,
    });

    const resultado = await buscarNumerosImpacto(client);

    expect(resultado.map((r) => r.nomeContratante)).toEqual(["Alfa Contratante", "Mike Contratante", "Zulu Contratante"]);
  });

  it("repassa nr_contratos_contratante/ordem_contrato tal como vêm da MV, sem recalcular no backend", async () => {
    // Valores deliberadamente "impossíveis" de derivar só olhando para 1 linha
    // (nr_contratos_contratante = 5 com uma única linha retornada) -- se a
    // função recalculasse localmente, o valor sairia 1, nunca 5.
    const { client } = criarClienteMock({
      data: [{ ...LINHA_COMPLETA, nr_contratos_contratante: 5, ordem_contrato: 3 }],
      error: null,
    });

    const resultado = await buscarNumerosImpacto(client);

    expect(resultado[0].nrContratosContratante).toBe(5);
    expect(resultado[0].ordemContrato).toBe(3);
  });
});
