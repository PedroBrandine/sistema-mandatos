import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import {
  buscarCandidaturas,
  buscarComposicaoPartidariaCasa,
  buscarPerfilCandidatura,
  buscarPerfilEleitoradoCandidatura,
} from "./tse";

type Chamada = { metodo: string; args: unknown[] };
type LinhaMv = Database["tse"]["Views"]["mv_candidatura_resumo"]["Row"];
type LinhaDimCandidatura = Database["tse"]["Tables"]["dim_candidatura"]["Row"];
type LinhaPerfilEleitorado = Database["tse"]["Views"]["mv_perfil_eleitorado_candidatura"]["Row"];

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

function linhaDimCandidatura(sobrescreve: Partial<LinhaDimCandidatura> = {}): LinhaDimCandidatura {
  return {
    ano_eleicao: 2020,
    carregado_em: "2024-01-01T00:00:00Z",
    cd_cargo: 11,
    cd_eleicao: 1,
    ds_cargo: "Vereador",
    ds_cor_raca: "Parda",
    ds_eleicao: "Eleições Municipais 2020",
    ds_genero: "Feminino",
    ds_grau_instrucao: "Superior completo",
    ds_ocupacao: "Advogada",
    ds_sit_tot_turno: "Eleito",
    ds_situacao_candidatura: "Deferido",
    dt_nascimento: "1980-05-20",
    nm_candidato: "Fulana de Tal",
    nm_coligacao: "Coligação Exemplo",
    nm_social: null,
    nm_ue: "São Paulo",
    nm_urna: "Fulana",
    nr_partido: 13,
    nr_titulo_eleitoral: "123456789012",
    nr_turno: 1,
    sg_federacao: null,
    sg_partido: "PT",
    sg_ue: "SP",
    sg_uf: "SP",
    sq_candidato: 1,
    ...sobrescreve,
  };
}

function linhaPerfilEleitorado(sobrescreve: Partial<LinhaPerfilEleitorado> = {}): LinhaPerfilEleitorado {
  return {
    ano_eleicao: 2020,
    categoria: "Feminino",
    dimensao: "genero",
    nr_turno: 1,
    qt_eleitores: 1000,
    sq_candidato: 1,
    ...sobrescreve,
  };
}

function criarClienteMock<T>(resultado: { data: T[] | null; error: { message: string } | null }) {
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

  // PF2-05 (.specs/features/pente-fino-2026-09-23/spec.md) AC1: cargo/
  // situação da candidatura mapeados de mv_candidatura_resumo, já expostos
  // pela MV (migration 0010) -- sem migration nova.
  it("mapeia ds_cargo/ds_sit_tot_turno para dsCargo/dsSitTotTurno", async () => {
    const { client } = criarClienteMock({
      data: [linha({ ds_cargo: "Deputado(a) Estadual", ds_sit_tot_turno: "Suplente" })],
      error: null,
    });
    const resultado = await buscarCandidaturas(client, { nome: "Fulano" });

    expect(resultado[0].dsCargo).toBe("Deputado(a) Estadual");
    expect(resultado[0].dsSitTotTurno).toBe("Suplente");
  });

  // PF2-05 AC3: linha antiga/incompleta da carga -- nulo passa nulo, sem
  // sentinela nem erro.
  it("ds_cargo/ds_sit_tot_turno nulos mapeiam para null, sem quebrar", async () => {
    const { client } = criarClienteMock({
      data: [linha({ ds_cargo: null, ds_sit_tot_turno: null })],
      error: null,
    });
    const resultado = await buscarCandidaturas(client, { nome: "Fulano" });

    expect(resultado[0].dsCargo).toBeNull();
    expect(resultado[0].dsSitTotTurno).toBeNull();
  });

  // PF2-05 AC2: candidatura duplicada do mesmo nome em anos diferentes --
  // nenhuma deduplicação, os 2 resultados continuam distintos.
  it("candidaturas do mesmo nome/UF/partido em anos diferentes continuam como 2 resultados distintos", async () => {
    const { client } = criarClienteMock({
      data: [
        linha({ sq_candidato: 1, ano_eleicao: 2020, ds_sit_tot_turno: "Suplente" }),
        linha({ sq_candidato: 2, ano_eleicao: 2024, ds_sit_tot_turno: "Eleito" }),
      ],
      error: null,
    });
    const resultado = await buscarCandidaturas(client, { nome: "Fulano" });

    expect(resultado).toHaveLength(2);
    expect(resultado.map((c) => c.anoEleicao).sort()).toEqual([2020, 2024]);
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

describe("buscarPerfilCandidatura", () => {
  const CHAVE = { anoEleicao: 2020, sqCandidato: 1, nrTurno: 1 };

  // Done-when: "Retorna null quando não há linha correspondente (sem lançar erro)"
  it("retorna null quando não há linha correspondente", async () => {
    const { client } = criarClienteMock<LinhaDimCandidatura>({ data: [], error: null });
    const resultado = await buscarPerfilCandidatura(client, CHAVE);
    expect(resultado).toBeNull();
  });

  // Done-when: "Retorna idade null quando dt_nascimento é null"
  it("retorna idade null quando dt_nascimento é null", async () => {
    const { client } = criarClienteMock({
      data: [linhaDimCandidatura({ dt_nascimento: null })],
      error: null,
    });
    const resultado = await buscarPerfilCandidatura(client, CHAVE);
    expect(resultado?.idade).toBeNull();
  });

  // Done-when: "Retorna idade calculada corretamente quando dt_nascimento existe"
  // dt_nascimento 1980-05-20, ano_eleicao 2020: aniversário de maio já passou
  // na referência (1º de outubro do ano da eleição) -> 40 anos completos.
  it("retorna idade calculada corretamente quando dt_nascimento existe", async () => {
    const { client } = criarClienteMock({
      data: [linhaDimCandidatura({ dt_nascimento: "1980-05-20", ano_eleicao: 2020 })],
      error: null,
    });
    const resultado = await buscarPerfilCandidatura(client, CHAVE);
    expect(resultado?.idade).toBe(40);
  });

  it("mapeia gênero, cor/raça, grau de instrução, ocupação e coligação", async () => {
    const { client } = criarClienteMock({
      data: [
        linhaDimCandidatura({
          ds_genero: "Feminino",
          ds_cor_raca: "Parda",
          ds_grau_instrucao: "Superior completo",
          ds_ocupacao: "Advogada",
          nm_coligacao: "Coligação Exemplo",
        }),
      ],
      error: null,
    });
    const resultado = await buscarPerfilCandidatura(client, CHAVE);
    expect(resultado).toMatchObject({
      genero: "Feminino",
      corRaca: "Parda",
      grauInstrucao: "Superior completo",
      ocupacao: "Advogada",
      coligacao: "Coligação Exemplo",
    });
  });

  // Done-when: "Lança o erro do Supabase (não engole) quando a query falha"
  it("lança o erro do Supabase em vez de engolir a falha", async () => {
    const { client } = criarClienteMock<LinhaDimCandidatura>({ data: null, error: { message: "boom" } });
    await expect(buscarPerfilCandidatura(client, CHAVE)).rejects.toEqual({ message: "boom" });
  });

  it("filtra por ano_eleicao, sq_candidato e nr_turno (chave da candidatura)", async () => {
    const { client, chamadas } = criarClienteMock({ data: [linhaDimCandidatura()], error: null });
    await buscarPerfilCandidatura(client, CHAVE);

    const eqs = chamadas.filter((c) => c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["ano_eleicao", 2020]);
    expect(eqs).toContainEqual(["sq_candidato", 1]);
    expect(eqs).toContainEqual(["nr_turno", 1]);
  });
});

describe("buscarPerfilEleitoradoCandidatura", () => {
  const CHAVE = { anoEleicao: 2020, sqCandidato: 1, nrTurno: 1 };

  // Done-when: "Retorna null quando a view não tem nenhuma linha pra essa
  // chave" (candidatura sem município principal identificável, CAD-12)
  it("retorna null quando não há nenhuma linha pra essa chave", async () => {
    const { client } = criarClienteMock<LinhaPerfilEleitorado>({ data: [], error: null });
    const resultado = await buscarPerfilEleitoradoCandidatura(client, CHAVE);
    expect(resultado).toBeNull();
  });

  // Done-when: "Agrupa corretamente linhas de dimensões diferentes nas 3 listas certas"
  it("agrupa linhas de gênero, faixa etária e escolaridade nas 3 listas certas", async () => {
    const { client } = criarClienteMock({
      data: [
        linhaPerfilEleitorado({ dimensao: "genero", categoria: "Feminino", qt_eleitores: 600 }),
        linhaPerfilEleitorado({ dimensao: "genero", categoria: "Masculino", qt_eleitores: 400 }),
        linhaPerfilEleitorado({ dimensao: "faixa_etaria", categoria: "25 a 34 anos", qt_eleitores: 300 }),
        linhaPerfilEleitorado({ dimensao: "grau_escolaridade", categoria: "Ensino médio", qt_eleitores: 500 }),
      ],
      error: null,
    });
    const resultado = await buscarPerfilEleitoradoCandidatura(client, CHAVE);

    expect(resultado?.genero).toEqual([
      { categoria: "Feminino", qtEleitores: 600 },
      { categoria: "Masculino", qtEleitores: 400 },
    ]);
    expect(resultado?.faixaEtaria).toEqual([{ categoria: "25 a 34 anos", qtEleitores: 300 }]);
    expect(resultado?.grauEscolaridade).toEqual([{ categoria: "Ensino médio", qtEleitores: 500 }]);
  });

  // Done-when: "Lança o erro do Supabase (não engole) quando a query falha"
  it("lança o erro do Supabase em vez de engolir a falha", async () => {
    const { client } = criarClienteMock<LinhaPerfilEleitorado>({ data: null, error: { message: "boom" } });
    await expect(buscarPerfilEleitoradoCandidatura(client, CHAVE)).rejects.toEqual({ message: "boom" });
  });

  it("filtra por ano_eleicao, sq_candidato e nr_turno (chave da candidatura)", async () => {
    const { client, chamadas } = criarClienteMock({ data: [linhaPerfilEleitorado()], error: null });
    await buscarPerfilEleitoradoCandidatura(client, CHAVE);

    const eqs = chamadas.filter((c) => c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["ano_eleicao", 2020]);
    expect(eqs).toContainEqual(["sq_candidato", 1]);
    expect(eqs).toContainEqual(["nr_turno", 1]);
  });
});

describe("buscarComposicaoPartidariaCasa", () => {
  const FILTRO = { anoEleicao: 2022, cdCargo: 7, sgUf: "SP" };
  type LinhaComposicao = { sg_partido: string | null; ds_sit_tot_turno: string | null };

  // Done-when: "Casa/ano sem dado devolve vazio explícito (não erro)".
  it("devolve lista vazia quando não há nenhum candidato pra Casa/UF/ano", async () => {
    const { client } = criarClienteMock<LinhaComposicao>({ data: [], error: null });
    const resultado = await buscarComposicaoPartidariaCasa(client, FILTRO);
    expect(resultado).toEqual([]);
  });

  // Done-when: "Valores reais de ds_sit_tot_turno que significam 'eleito'
  // confirmados contra a base de dev" -- SUPLENTE/NÃO ELEITO/#NULO nunca
  // contam, só ELEITO/ELEITO POR QP/ELEITO POR MÉDIA (valores reais
  // confirmados em dev, 22/09/2026, ver comentário em tse.ts).
  it("conta só ELEITO/ELEITO POR QP/ELEITO POR MÉDIA, ignora SUPLENTE/NÃO ELEITO/#NULO", async () => {
    const { client } = criarClienteMock<LinhaComposicao>({
      data: [
        { sg_partido: "PT", ds_sit_tot_turno: "ELEITO POR QP" },
        { sg_partido: "PT", ds_sit_tot_turno: "ELEITO POR MÉDIA" },
        { sg_partido: "PSDB", ds_sit_tot_turno: "ELEITO" },
        { sg_partido: "PT", ds_sit_tot_turno: "SUPLENTE" },
        { sg_partido: "PSDB", ds_sit_tot_turno: "NÃO ELEITO" },
        { sg_partido: "MDB", ds_sit_tot_turno: "#NULO" },
      ],
      error: null,
    });
    const resultado = await buscarComposicaoPartidariaCasa(client, FILTRO);

    // Só 3 linhas contam como eleitas (2 PT + 1 PSDB) -- total = 3.
    expect(resultado).toEqual([
      { siglaPartido: "PT", quantidade: 2, percentual: (2 / 3) * 100 },
      { siglaPartido: "PSDB", quantidade: 1, percentual: (1 / 3) * 100 },
    ]);
  });

  // Done-when: "Partido com < 3% agrupa em 'Outros'".
  it("agrupa partidos com menos de 3% da composição em 'Outros'", async () => {
    const linhasPT = Array.from({ length: 95 }, () => ({ sg_partido: "PT", ds_sit_tot_turno: "ELEITO" }));
    const linhasPSDB = Array.from({ length: 2 }, () => ({ sg_partido: "PSDB", ds_sit_tot_turno: "ELEITO" }));
    const linhasPV = Array.from({ length: 2 }, () => ({ sg_partido: "PV", ds_sit_tot_turno: "ELEITO" }));
    const linhasMDB = [{ sg_partido: "MDB", ds_sit_tot_turno: "ELEITO" }];
    const { client } = criarClienteMock<LinhaComposicao>({
      data: [...linhasPT, ...linhasPSDB, ...linhasPV, ...linhasMDB],
      error: null,
    });

    const resultado = await buscarComposicaoPartidariaCasa(client, FILTRO);

    expect(resultado).toEqual([
      { siglaPartido: "PT", quantidade: 95, percentual: 95 },
      { siglaPartido: "Outros", quantidade: 5, percentual: 5 },
    ]);
  });

  it("ordena os partidos por quantidade de eleitos, decrescente", async () => {
    const { client } = criarClienteMock<LinhaComposicao>({
      data: [
        { sg_partido: "PSDB", ds_sit_tot_turno: "ELEITO" },
        { sg_partido: "PT", ds_sit_tot_turno: "ELEITO POR QP" },
        { sg_partido: "PT", ds_sit_tot_turno: "ELEITO POR MÉDIA" },
      ],
      error: null,
    });
    const resultado = await buscarComposicaoPartidariaCasa(client, FILTRO);
    expect(resultado.map((r) => r.siglaPartido)).toEqual(["PT", "PSDB"]);
  });

  it("lança o erro do Supabase em vez de engolir a falha", async () => {
    const { client } = criarClienteMock<LinhaComposicao>({ data: null, error: { message: "boom" } });
    await expect(buscarComposicaoPartidariaCasa(client, FILTRO)).rejects.toEqual({ message: "boom" });
  });

  it("filtra por ano_eleicao, cd_cargo e sg_uf", async () => {
    const { client, chamadas } = criarClienteMock<LinhaComposicao>({
      data: [{ sg_partido: "PT", ds_sit_tot_turno: "ELEITO" }],
      error: null,
    });
    await buscarComposicaoPartidariaCasa(client, FILTRO);

    const eqs = chamadas.filter((c) => c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["ano_eleicao", 2022]);
    expect(eqs).toContainEqual(["cd_cargo", 7]);
    expect(eqs).toContainEqual(["sg_uf", "SP"]);
  });
});
