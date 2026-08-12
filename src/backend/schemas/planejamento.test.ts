import { describe, expect, it } from "vitest";

import { dadosPlanejamentoSchema, metaSchema, objetivoEspecificoSchema, sucessoMensalSchema } from "./planejamento";

describe("dadosPlanejamentoSchema", () => {
  it("aceita todos os campos ausentes (planejamento recém-instanciado, tudo NULL)", () => {
    const resultado = dadosPlanejamentoSchema.safeParse({});
    expect(resultado.success).toBe(true);
  });

  it("aceita objetivo_ano/legado/analise_conjuntura preenchidos e id_perfil_atuacao selecionado", () => {
    const resultado = dadosPlanejamentoSchema.safeParse({
      objetivo_ano: "Consolidar a base eleitoral",
      legado: "Reformar a lei de licitações municipal",
      analise_conjuntura: "Ano pré-eleitoral, pauta de segurança em alta",
      id_perfil_atuacao: 3,
    });
    expect(resultado.success).toBe(true);
  });

  it("aceita explicitamente null nos 4 campos", () => {
    const resultado = dadosPlanejamentoSchema.safeParse({
      objetivo_ano: null,
      legado: null,
      analise_conjuntura: null,
      id_perfil_atuacao: null,
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita id_perfil_atuacao não positivo", () => {
    const resultado = dadosPlanejamentoSchema.safeParse({ id_perfil_atuacao: 0 });
    expect(resultado.success).toBe(false);
  });
});

describe("objetivoEspecificoSchema", () => {
  it("aceita um objetivo válido mínimo", () => {
    const resultado = objetivoEspecificoSchema.safeParse({
      id_planejamento: 1,
      descricao: "Aprovar projeto de lei X",
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita ausência de id_planejamento", () => {
    const resultado = objetivoEspecificoSchema.safeParse({ descricao: "Aprovar projeto" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita descricao vazia", () => {
    const resultado = objetivoEspecificoSchema.safeParse({ id_planejamento: 1, descricao: "" });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_objetivo_preditores: secundário exige primário
  it("rejeita id_preditor_secundario sem id_preditor_primario", () => {
    const resultado = objetivoEspecificoSchema.safeParse({
      id_planejamento: 1,
      descricao: "Aprovar projeto",
      id_preditor_secundario: 2,
    });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_objetivo_preditores: secundário não pode repetir o primário
  it("rejeita id_preditor_secundario igual a id_preditor_primario", () => {
    const resultado = objetivoEspecificoSchema.safeParse({
      id_planejamento: 1,
      descricao: "Aprovar projeto",
      id_preditor_primario: 5,
      id_preditor_secundario: 5,
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita id_preditor_primario e id_preditor_secundario distintos", () => {
    const resultado = objetivoEspecificoSchema.safeParse({
      id_planejamento: 1,
      descricao: "Aprovar projeto",
      id_preditor_primario: 5,
      id_preditor_secundario: 6,
    });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_objetivo_pct
  it("rejeita pct_atingimento acima de 100", () => {
    const resultado = objetivoEspecificoSchema.safeParse({
      id_planejamento: 1,
      descricao: "Aprovar projeto",
      pct_atingimento: 150,
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita pct_atingimento negativo", () => {
    const resultado = objetivoEspecificoSchema.safeParse({
      id_planejamento: 1,
      descricao: "Aprovar projeto",
      pct_atingimento: -1,
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita pct_atingimento nulo", () => {
    const resultado = objetivoEspecificoSchema.safeParse({
      id_planejamento: 1,
      descricao: "Aprovar projeto",
      pct_atingimento: null,
    });
    expect(resultado.success).toBe(true);
  });
});

describe("metaSchema", () => {
  it("aceita uma meta válida mínima", () => {
    const resultado = metaSchema.safeParse({ id_objetivo: 1, descricao: "Realizar 3 audiências", status: "ativa" });
    expect(resultado.success).toBe(true);
  });

  it("rejeita ausência de status (sem .default() -- ver rationale no schema)", () => {
    const resultado = metaSchema.safeParse({ id_objetivo: 1, descricao: "Realizar 3 audiências" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita ausência de id_objetivo", () => {
    const resultado = metaSchema.safeParse({ descricao: "Realizar 3 audiências", status: "ativa" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita descricao vazia", () => {
    const resultado = metaSchema.safeParse({ id_objetivo: 1, descricao: "", status: "ativa" });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_meta_classe: só 'programatica'/'governanca' -- sem restrição por
  // produto no schema (confirmado por Pedro: restrição de PLL é só na UI)
  it("aceita classe='governanca'", () => {
    const resultado = metaSchema.safeParse({
      id_objetivo: 1,
      descricao: "Organograma",
      classe: "governanca",
      status: "ativa",
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita classe fora do domínio aprovado", () => {
    const resultado = metaSchema.safeParse({
      id_objetivo: 1,
      descricao: "Organograma",
      classe: "outra",
      status: "ativa",
    });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_meta_prioridade
  it("rejeita prioridade fora do domínio aprovado", () => {
    const resultado = metaSchema.safeParse({
      id_objetivo: 1,
      descricao: "Realizar 3 audiências",
      prioridade: "urgente",
      status: "ativa",
    });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_meta_status
  it("rejeita status fora do domínio aprovado", () => {
    const resultado = metaSchema.safeParse({
      id_objetivo: 1,
      descricao: "Realizar 3 audiências",
      status: "concluida",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita status='pausada'", () => {
    const resultado = metaSchema.safeParse({
      id_objetivo: 1,
      descricao: "Realizar 3 audiências",
      status: "pausada",
    });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_meta_preditores
  it("rejeita id_preditor_secundario sem id_preditor_primario", () => {
    const resultado = metaSchema.safeParse({
      id_objetivo: 1,
      descricao: "Realizar 3 audiências",
      id_preditor_secundario: 2,
      status: "ativa",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita id_preditor_secundario igual a id_preditor_primario", () => {
    const resultado = metaSchema.safeParse({
      id_objetivo: 1,
      descricao: "Realizar 3 audiências",
      id_preditor_primario: 5,
      id_preditor_secundario: 5,
      status: "ativa",
    });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_meta_pct
  it("rejeita pct_atingimento acima de 100", () => {
    const resultado = metaSchema.safeParse({
      id_objetivo: 1,
      descricao: "Realizar 3 audiências",
      pct_atingimento: 101,
      status: "ativa",
    });
    expect(resultado.success).toBe(false);
  });
});

describe("sucessoMensalSchema", () => {
  it("aceita um sucesso mensal válido mínimo", () => {
    const resultado = sucessoMensalSchema.safeParse({
      id_meta: 1,
      descricao: "Publicar post sobre o tema",
      mes_referencia: "2026-08-01",
      peso: 100,
      status: "pendente",
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita ausência de status (sem .default() -- ver rationale no schema)", () => {
    const resultado = sucessoMensalSchema.safeParse({
      id_meta: 1,
      descricao: "Publicar post",
      mes_referencia: "2026-08-01",
      peso: 100,
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita ausência de id_meta", () => {
    const resultado = sucessoMensalSchema.safeParse({
      descricao: "Publicar post",
      mes_referencia: "2026-08-01",
      peso: 100,
      status: "pendente",
    });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_sucesso_mes: EXTRACT(DAY FROM mes_referencia) = 1
  it("rejeita mes_referencia que não é o primeiro dia do mês", () => {
    const resultado = sucessoMensalSchema.safeParse({
      id_meta: 1,
      descricao: "Publicar post",
      mes_referencia: "2026-08-15",
      peso: 100,
      status: "pendente",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita mes_referencia no primeiro dia do mês", () => {
    const resultado = sucessoMensalSchema.safeParse({
      id_meta: 1,
      descricao: "Publicar post",
      mes_referencia: "2026-08-01",
      peso: 100,
      status: "pendente",
    });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_sucesso_peso: peso >= 0 AND peso <= 100
  it("rejeita peso acima de 100", () => {
    const resultado = sucessoMensalSchema.safeParse({
      id_meta: 1,
      descricao: "Publicar post",
      mes_referencia: "2026-08-01",
      peso: 150,
      status: "pendente",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita peso negativo", () => {
    const resultado = sucessoMensalSchema.safeParse({
      id_meta: 1,
      descricao: "Publicar post",
      mes_referencia: "2026-08-01",
      peso: -10,
      status: "pendente",
    });
    expect(resultado.success).toBe(false);
  });

  // espelha ck_sucesso_pct (PLM-04: a grade replica a validação 0-100 no cliente)
  it("rejeita pct_atingimento acima de 100", () => {
    const resultado = sucessoMensalSchema.safeParse({
      id_meta: 1,
      descricao: "Publicar post",
      mes_referencia: "2026-08-01",
      peso: 100,
      pct_atingimento: 150,
      status: "pendente",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita pct_atingimento negativo", () => {
    const resultado = sucessoMensalSchema.safeParse({
      id_meta: 1,
      descricao: "Publicar post",
      mes_referencia: "2026-08-01",
      peso: 100,
      pct_atingimento: -1,
      status: "pendente",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita pct_atingimento nulo (sucesso ainda pendente)", () => {
    const resultado = sucessoMensalSchema.safeParse({
      id_meta: 1,
      descricao: "Publicar post",
      mes_referencia: "2026-08-01",
      peso: 100,
      pct_atingimento: null,
      status: "pendente",
    });
    expect(resultado.success).toBe(true);
  });

  // espelha ck_sucesso_status
  it("rejeita status fora do domínio aprovado", () => {
    const resultado = sucessoMensalSchema.safeParse({
      id_meta: 1,
      descricao: "Publicar post",
      mes_referencia: "2026-08-01",
      peso: 100,
      status: "em_andamento",
    });
    expect(resultado.success).toBe(false);
  });
});
