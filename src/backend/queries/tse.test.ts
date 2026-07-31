import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarCandidaturas } from "./tse";

type Chamada = { metodo: string; args: unknown[] };
type LinhaMv = Database["tse"]["Views"]["mv_candidatura_resumo"]["Row"];

function linha(sobrescreve: Partial<LinhaMv> = {}): LinhaMv {
  return {
    ano_eleicao: 2024,
    cd_cargo: 11,
    ds_cargo: "Vereador",
    ds_sit_tot_turno: "Eleito",
    ds_situacao_candidatura: "Deferido",
    nm_candidato: "Fulano de Tal",
    nm_municipio_principal: "São Paulo",
    nm_urna: "Fulano",
    nr_partido: 13,
    nr_titulo_eleitoral: "123456789012",
    nr_turno: 1,
    qt_votos_total: 1000,
    sg_partido: "PT",
    sg_uf: "SP",
    sq_candidato: 1,
    ...sobrescreve,
  };
}

function criarClienteMock(resultado: { data: LinhaMv[] | null; error: { message: string } | null }) {
  const chamadas: Chamada[] = [];
  const builder: Record<string, unknown> = {
    select: (...args: unknown[]) => {
      chamadas.push({ metodo: "select", args });
      return builder;
    },
    ilike: (...args: unknown[]) => {
      chamadas.push({ metodo: "ilike", args });
      return builder;
    },
    eq: (...args: unknown[]) => {
      chamadas.push({ metodo: "eq", args });
      return builder;
    },
    then: (resolve: (value: typeof resultado) => void, reject: (erro: unknown) => void) =>
      Promise.resolve(resultado).then(resolve, reject),
  };
  const client = {
    schema: (nome: string) => {
      chamadas.push({ metodo: "schema", args: [nome] });
      return {
        from: (tabela: string) => {
          chamadas.push({ metodo: "from", args: [tabela] });
          return builder;
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

describe("buscarCandidaturas", () => {
  // Done-when: "Retorna lista vazia (não erro) quando nada é encontrado"
  it("retorna lista vazia quando nenhuma candidatura é encontrada", async () => {
    const { client } = criarClienteMock({ data: [], error: null });
    const resultado = await buscarCandidaturas(client, { nome: "Ninguém" });
    expect(resultado).toEqual([]);
  });

  it("lança o erro do Supabase em vez de engolir a falha", async () => {
    const { client } = criarClienteMock({ data: null, error: { message: "boom" } });
    await expect(buscarCandidaturas(client, { nome: "X" })).rejects.toEqual({ message: "boom" });
  });

  // Done-when: "Aceita busca só por nome (fuzzy)"
  it("busca só por nome não aplica filtro de UF/cargo/ano", async () => {
    const { client, chamadas } = criarClienteMock({ data: [linha()], error: null });
    await buscarCandidaturas(client, { nome: "Fulano" });

    const ilike = chamadas.find((c) => c.metodo === "ilike");
    expect(ilike?.args).toEqual(["nm_urna", "%Fulano%"]);
    expect(chamadas.filter((c) => c.metodo === "eq")).toHaveLength(0);
  });

  // Done-when: "e busca combinada nome+UF+cargo"
  it("busca combinada nome+UF+cargo aplica os 3 filtros", async () => {
    const { client, chamadas } = criarClienteMock({ data: [linha()], error: null });
    await buscarCandidaturas(client, { nome: "Fulano", sgUf: "SP", idCargo: 11 });

    const eqs = chamadas.filter((c) => c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["sg_uf", "SP"]);
    expect(eqs).toContainEqual(["cd_cargo", 11]);
  });

  it("aplica filtro de ano de eleição quando informado", async () => {
    const { client, chamadas } = criarClienteMock({ data: [linha()], error: null });
    await buscarCandidaturas(client, { anoEleicao: 2024 });

    const eqs = chamadas.filter((c) => c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["ano_eleicao", 2024]);
  });

  it("mapeia um resultado único para CandidaturaSugerida (metodoMatch='nome_uf_cargo')", async () => {
    const { client } = criarClienteMock({ data: [linha({ nm_urna: "Fulano" })], error: null });
    const resultado = await buscarCandidaturas(client, { nome: "Fulano" });

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      anoEleicao: 2024,
      sqCandidato: 1,
      nrTurno: 1,
      sgUf: "SP",
      metodoMatch: "nome_uf_cargo",
      confianca: "alta",
    });
  });

  // Done-when: "múltiplos resultados ordenados por confiança"
  it("ordena múltiplos resultados por confiança (alta antes de média antes de baixa)", async () => {
    const { client } = criarClienteMock({
      data: [
        linha({ sq_candidato: 1, nm_urna: "Fulano de Tal e Mais Alguma Coisa Bem Diferente" }),
        linha({ sq_candidato: 2, nm_urna: "Fulano" }),
        linha({ sq_candidato: 3, nm_urna: "Fulano Sobrenome" }),
      ],
      error: null,
    });

    const resultado = await buscarCandidaturas(client, { nome: "Fulano" });

    expect(resultado.map((c) => c.sqCandidato)).toEqual([2, 3, 1]);
    expect(resultado[0].confianca).toBe("alta");
    expect(resultado[2].confianca).toBe("baixa");
  });

  // Spec-precision gap documentado em tse.ts: sem termo de nome, não há sinal
  // para avaliar confiança -- classificado como 'baixa'.
  it("classifica confiança como 'baixa' quando a busca não tem termo de nome", async () => {
    const { client } = criarClienteMock({ data: [linha()], error: null });
    const resultado = await buscarCandidaturas(client, { sgUf: "SP" });
    expect(resultado[0].confianca).toBe("baixa");
  });
});
