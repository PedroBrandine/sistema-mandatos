import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import {
  buscarEvolucaoGip,
  buscarEvolucaoMensal,
  buscarGradeSucessosMensais,
  buscarHistoricoAuditoria,
  buscarPessoasVinculadasAoContrato,
  buscarPlanejamentoCompleto,
  buscarPlanejamentoKpis,
  buscarPreditoresPlanejamento,
} from "./planejamento";

// Spec anchor: PLM-01 (.specs/features/planejamento-planilha-monitoramento/spec.md) --
//  - buscarPlanejamentoCompleto retorna a árvore Objetivo->Meta de um contrato,
//    mapeamento snake_case->camelCase completo, contrato sem planejamento retorna null
//  - buscarGradeSucessosMensais retorna os Sucessos Mensais das Metas informadas
//    num mês, dias_atraso/esta_atrasado derivados nunca recalculados no client
//  - Lista vazia (sem objetivos, sem idsMeta) nunca lança
// Spec anchor: PLR-13 (.specs/features/planejamento-estrategico-redesenho/spec.md) --
//  - buscarHistoricoAuditoria retorna o histórico de log_auditoria de um item, camelCase,
//    mais recente primeiro, [] quando não há histórico

// Mesmo padrão de kanban.test.ts: mock roteado por nome de tabela, fila de
// respostas quando a mesma tabela é consultada mais de uma vez.
type Chamada = { tabela: string; metodo: string; args: unknown[] };
type RespostaTabela = { data: unknown; error: { message: string } | null };

function criarClienteMock(respostasPorTabela: Record<string, RespostaTabela | RespostaTabela[]>) {
  const chamadas: Chamada[] = [];
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
      select: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "select", args });
        return builder;
      },
      eq: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "eq", args });
        return builder;
      },
      in: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "in", args });
        return builder;
      },
      or: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "or", args });
        return builder;
      },
      order: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "order", args });
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

describe("buscarPlanejamentoCompleto", () => {
  it("retorna null quando o contrato não tem dim_planejamento", async () => {
    const { client } = criarClienteMock({ dim_planejamento: { data: null, error: null } });
    const resultado = await buscarPlanejamentoCompleto(client, 999);
    expect(resultado).toBeNull();
  });

  it("retorna a árvore Objetivo->Meta completa, mapeada para camelCase", async () => {
    const { client } = criarClienteMock({
      dim_planejamento: {
        data: {
          id_planejamento: 1,
          id_contrato: 10,
          objetivo_ano: "Consolidar mandato",
          legado: null,
          analise_conjuntura: null,
          id_perfil_atuacao: 3,
          pct_atingimento: 42.5,
          atingimento_desatualizado: false,
        },
        error: null,
      },
      fat_objetivo_especifico: {
        data: [
          {
            id_objetivo: 100,
            id_planejamento: 1,
            descricao: "Aprovar projeto X",
            id_preditor_primario: 5,
            id_preditor_secundario: null,
            id_agenda: 7,
            pct_atingimento: 50,
          },
        ],
        error: null,
      },
      fat_meta: {
        data: [
          {
            id_meta: 200,
            id_objetivo: 100,
            descricao: "Realizar 3 audiências",
            classe: "programatica",
            prioridade: "alta",
            status: "ativa",
            pct_atingimento: 60,
            id_preditor_primario: 5,
            id_preditor_secundario: null,
            id_agenda: 7,
            id_usuario_responsavel: 42,
          },
        ],
        error: null,
      },
    });

    const resultado = await buscarPlanejamentoCompleto(client, 10);

    expect(resultado).not.toBeNull();
    expect(resultado?.idPlanejamento).toBe(1);
    expect(resultado?.idPerfilAtuacao).toBe(3);
    expect(resultado?.pctAtingimento).toBe(42.5);
    expect(resultado?.objetivos).toHaveLength(1);
    expect(resultado?.objetivos[0]).toEqual({
      idObjetivo: 100,
      idPlanejamento: 1,
      descricao: "Aprovar projeto X",
      idPreditorPrimario: 5,
      idPreditorSecundario: null,
      idAgenda: 7,
      pctAtingimento: 50,
      metas: [
        {
          idMeta: 200,
          idObjetivo: 100,
          descricao: "Realizar 3 audiências",
          classe: "programatica",
          prioridade: "alta",
          status: "ativa",
          pctAtingimento: 60,
          idPreditorPrimario: 5,
          idPreditorSecundario: null,
          idAgenda: 7,
          idUsuarioResponsavel: 42,
        },
      ],
    });
  });

  it("retorna objetivos: [] sem consultar fat_meta quando não há objetivo nenhum", async () => {
    const { client, chamadas } = criarClienteMock({
      dim_planejamento: {
        data: {
          id_planejamento: 1,
          id_contrato: 10,
          objetivo_ano: null,
          legado: null,
          analise_conjuntura: null,
          pct_atingimento: null,
          atingimento_desatualizado: false,
        },
        error: null,
      },
      fat_objetivo_especifico: { data: [], error: null },
    });

    const resultado = await buscarPlanejamentoCompleto(client, 10);

    expect(resultado?.objetivos).toEqual([]);
    expect(chamadas.some((c) => c.tabela === "fat_meta")).toBe(false);
  });
});

describe("buscarGradeSucessosMensais", () => {
  it("retorna [] sem consultar o banco quando idsMeta está vazio", async () => {
    const { client, chamadas } = criarClienteMock({});
    const resultado = await buscarGradeSucessosMensais(client, []);
    expect(resultado).toEqual([]);
    expect(chamadas).toEqual([]);
  });

  it("mapeia os Sucessos Mensais para camelCase, com dias_atraso/esta_atrasado vindos da view", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_sucesso_mensal: {
        data: [
          {
            id_sucesso: 300,
            id_meta: 200,
            descricao: "Publicar post sobre o tema",
            mes_referencia: "2026-08-01",
            dt_limite: "2026-08-15",
            peso: 100,
            pct_atingimento: 80,
            status: "realizado",
            dias_atraso: 0,
            esta_atrasado: false,
          },
        ],
        error: null,
      },
    });

    const resultado = await buscarGradeSucessosMensais(client, [200]);

    expect(resultado).toEqual([
      {
        idSucesso: 300,
        idMeta: 200,
        descricao: "Publicar post sobre o tema",
        mesReferencia: "2026-08-01",
        dtLimite: "2026-08-15",
        peso: 100,
        pctAtingimento: 80,
        status: "realizado",
        diasAtraso: 0,
        estaAtrasado: false,
        // PLV-03/PLV-12: campos novos da forma. `atrasoDias` é null porque
        // esta_atrasado é false -- realizado não está atrasado.
        idUsuarioResponsavel: null,
        atrasoDias: null,
      },
    ]);

    const chamadaIn = chamadas.find((c) => c.tabela === "vw_sucesso_mensal" && c.metodo === "in");
    expect(chamadaIn?.args).toEqual(["id_meta", [200]]);
  });

  // D-C (context.md): a query deixou de filtrar por mês de referência -- busca todos os
  // Sucessos Mensais do ciclo das Metas informadas. Substitui o teste antigo de
  // planejamento-planilha-monitoramento que verificava a chamada `.eq("mes_referencia", ...)`.
  it("retorna todos os meses do ciclo de uma Meta, sem filtrar por mes_referencia (D-C)", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_sucesso_mensal: {
        data: [
          {
            id_sucesso: 300,
            id_meta: 200,
            descricao: "Publicar post sobre o tema",
            mes_referencia: "2026-07-01",
            dt_limite: "2026-07-15",
            peso: 50,
            pct_atingimento: 100,
            status: "realizado",
            dias_atraso: 0,
            esta_atrasado: false,
          },
          {
            id_sucesso: 301,
            id_meta: 200,
            descricao: "Publicar post sobre o tema",
            mes_referencia: "2026-08-01",
            dt_limite: "2026-08-15",
            peso: 50,
            pct_atingimento: null,
            status: "pendente",
            dias_atraso: 0,
            esta_atrasado: false,
          },
        ],
        error: null,
      },
    });

    const resultado = await buscarGradeSucessosMensais(client, [200]);

    expect(resultado).toHaveLength(2);
    expect(resultado.map((linha) => linha.mesReferencia)).toEqual(["2026-07-01", "2026-08-01"]);
    expect(chamadas.some((c) => c.tabela === "vw_sucesso_mensal" && c.metodo === "eq")).toBe(false);
  });

  it("nunca lança quando a view não retorna linha nenhuma", async () => {
    const { client } = criarClienteMock({ vw_sucesso_mensal: { data: [], error: null } });
    const resultado = await buscarGradeSucessosMensais(client, [200]);
    expect(resultado).toEqual([]);
  });
});

describe("buscarPreditoresPlanejamento", () => {
  it("retorna os preditores prioritários ordenados, mapeados para camelCase", async () => {
    const { client, chamadas } = criarClienteMock({
      rel_planejamento_preditor: {
        data: [
          { id_preditor: 20, ordem: 2, ref_preditor: { nome: "Preditor B" } },
          { id_preditor: 10, ordem: 1, ref_preditor: { nome: "Preditor A" } },
        ],
        error: null,
      },
    });

    const resultado = await buscarPreditoresPlanejamento(client, 1);

    expect(resultado).toEqual([
      { idPreditor: 20, ordem: 2, nomePreditor: "Preditor B" },
      { idPreditor: 10, ordem: 1, nomePreditor: "Preditor A" },
    ]);
    const chamadaOrder = chamadas.find((c) => c.tabela === "rel_planejamento_preditor" && c.metodo === "order");
    expect(chamadaOrder?.args).toEqual(["ordem", { ascending: true }]);
  });

  it("retorna [] quando não há preditores prioritários definidos", async () => {
    const { client } = criarClienteMock({ rel_planejamento_preditor: { data: [], error: null } });
    const resultado = await buscarPreditoresPlanejamento(client, 1);
    expect(resultado).toEqual([]);
  });
});

describe("buscarPessoasVinculadasAoContrato", () => {
  it("retorna as pessoas com vínculo ativo, mapeadas para camelCase", async () => {
    const { client } = criarClienteMock({
      rel_usuario_contrato: {
        data: [{ id_usuario: 42, papel_no_contrato: "mentor" }],
        error: null,
      },
      dim_usuario: {
        data: [{ id_usuario: 42, nome: "Fulano Mentor" }],
        error: null,
      },
    });

    const resultado = await buscarPessoasVinculadasAoContrato(client, 10);

    expect(resultado).toEqual([{ idUsuario: 42, nome: "Fulano Mentor", papelNoContrato: "mentor" }]);
  });

  it("retorna [] sem consultar dim_usuario quando não há vínculo nenhum", async () => {
    const { client, chamadas } = criarClienteMock({ rel_usuario_contrato: { data: [], error: null } });
    const resultado = await buscarPessoasVinculadasAoContrato(client, 10);
    expect(resultado).toEqual([]);
    expect(chamadas.some((c) => c.tabela === "dim_usuario")).toBe(false);
  });
});

describe("buscarHistoricoAuditoria", () => {
  it("retorna [] sem consultar dim_usuario quando não há histórico", async () => {
    const { client, chamadas } = criarClienteMock({ log_auditoria: { data: [], error: null } });
    const resultado = await buscarHistoricoAuditoria(client, "fat_meta", 200);
    expect(resultado).toEqual([]);
    expect(chamadas.some((c) => c.tabela === "dim_usuario")).toBe(false);
  });

  it("retorna o histórico mapeado para camelCase, mais recente primeiro, com o nome do usuário resolvido", async () => {
    const { client, chamadas } = criarClienteMock({
      log_auditoria: {
        data: [
          {
            id_log: 900,
            id_usuario: 42,
            ocorrido_em: "2026-08-13T10:00:00Z",
            acao: "update",
            valor_anterior: { pct_atingimento: 60 },
            valor_novo: { pct_atingimento: 80 },
          },
          {
            id_log: 899,
            id_usuario: 42,
            ocorrido_em: "2026-08-01T09:00:00Z",
            acao: "insert",
            valor_anterior: null,
            valor_novo: { pct_atingimento: 60 },
          },
        ],
        error: null,
      },
      dim_usuario: {
        data: [{ id_usuario: 42, nome: "Fulano Mentor" }],
        error: null,
      },
    });

    const resultado = await buscarHistoricoAuditoria(client, "fat_meta", 200);

    expect(resultado).toEqual([
      {
        idLog: 900,
        quem: "Fulano Mentor",
        quando: "2026-08-13T10:00:00Z",
        acao: "update",
        valorAnterior: { pct_atingimento: 60 },
        valorNovo: { pct_atingimento: 80 },
      },
      {
        idLog: 899,
        quem: "Fulano Mentor",
        quando: "2026-08-01T09:00:00Z",
        acao: "insert",
        valorAnterior: null,
        valorNovo: { pct_atingimento: 60 },
      },
    ]);

    const chamadaEqTabela = chamadas.find(
      (c) => c.tabela === "log_auditoria" && c.metodo === "eq" && c.args[0] === "tabela"
    );
    expect(chamadaEqTabela?.args).toEqual(["tabela", "fat_meta"]);
    const chamadaEqRegistro = chamadas.find(
      (c) => c.tabela === "log_auditoria" && c.metodo === "eq" && c.args[0] === "id_registro_alvo"
    );
    expect(chamadaEqRegistro?.args).toEqual(["id_registro_alvo", 200]);
    const chamadaOrder = chamadas.find((c) => c.tabela === "log_auditoria" && c.metodo === "order");
    expect(chamadaOrder?.args).toEqual(["ocorrido_em", { ascending: false }]);
  });

  it("usa string vazia como quem quando o usuário não é encontrado em dim_usuario", async () => {
    const { client } = criarClienteMock({
      log_auditoria: {
        data: [
          {
            id_log: 900,
            id_usuario: 999,
            ocorrido_em: "2026-08-13T10:00:00Z",
            acao: "update",
            valor_anterior: null,
            valor_novo: null,
          },
        ],
        error: null,
      },
      dim_usuario: { data: [], error: null },
    });

    const resultado = await buscarHistoricoAuditoria(client, "fat_meta", 200);

    expect(resultado[0].quem).toBe("");
  });
});

// Spec anchor: saida-numeros-impacto T9 Done-when (.specs/features/saida-numeros-impacto/tasks.md) --
//  - Mapeia todas as colunas de LinhaEvolucaoGip (design.md), momento/situacao como union types
//  - regua_sonhos presente e onde_chegamos/gap/situacao null quando só há momento='inicio'
//    (spec.md P3.AC2 -- aspiração pactuada, ainda sem medição)
//  - Lista vazia quando não há fat_gip pro contrato (spec.md P3.AC3)
//
// spec.md SAI-08, SAI-09, SAI-10.

describe("buscarEvolucaoGip", () => {
  it("mapeia todas as colunas de vw_gip_evolucao para camelCase, filtrando por id_contrato e ordenando por momento+ordem", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_gip_evolucao: {
        data: [
          {
            id_contrato: 10,
            momento: "meio",
            aplicado_em: "2026-06-01",
            dimensao: "qualidade_planejamento",
            nome_dimensao: "Qualidade do Planejamento",
            ordem: 1,
            regua_sonhos: 2,
            onde_chegamos: 3,
            gap: 1,
            situacao: "atingiu",
            quadrante: "Q1 - Estrutura e entrega",
          },
        ],
        error: null,
      },
    });

    const resultado = await buscarEvolucaoGip(client, 10);

    expect(resultado).toEqual([
      {
        idContrato: 10,
        momento: "meio",
        aplicadoEm: "2026-06-01",
        dimensao: "qualidade_planejamento",
        nomeDimensao: "Qualidade do Planejamento",
        ordem: 1,
        reguaSonhos: 2,
        ondeChegamos: 3,
        gap: 1,
        situacao: "atingiu",
        quadrante: "Q1 - Estrutura e entrega",
      },
    ]);
    const eqChamada = chamadas.find((c) => c.tabela === "vw_gip_evolucao" && c.metodo === "eq");
    expect(eqChamada?.args).toEqual(["id_contrato", 10]);
    const orderChamadas = chamadas.filter((c) => c.tabela === "vw_gip_evolucao" && c.metodo === "order");
    expect(orderChamadas.map((c) => c.args)).toEqual([["momento"], ["ordem"]]);
  });

  it("momento='inicio' isolado: regua_sonhos presente e onde_chegamos/gap/situacao ausentes (null), nunca 0 (spec.md P3.AC2)", async () => {
    const { client } = criarClienteMock({
      vw_gip_evolucao: {
        data: [
          {
            id_contrato: 10,
            momento: "inicio",
            aplicado_em: "2026-01-01",
            dimensao: "qualidade_planejamento",
            nome_dimensao: "Qualidade do Planejamento",
            ordem: 1,
            regua_sonhos: 2,
            onde_chegamos: null,
            gap: null,
            situacao: null,
            quadrante: "Q1 - Estrutura e entrega",
          },
        ],
        error: null,
      },
    });

    const resultado = await buscarEvolucaoGip(client, 10);

    expect(resultado[0].reguaSonhos).toBe(2);
    expect(resultado[0].ondeChegamos).toBeNull();
    expect(resultado[0].gap).toBeNull();
    expect(resultado[0].situacao).toBeNull();
  });

  it("retorna [] sem lançar quando não há aplicação de GIP para o contrato (spec.md P3.AC3)", async () => {
    const { client } = criarClienteMock({ vw_gip_evolucao: { data: [], error: null } });

    const resultado = await buscarEvolucaoGip(client, 999);

    expect(resultado).toEqual([]);
  });
});

// Spec anchor: PLV-11 (.specs/features/planejamento-estrategico-v2/spec.md) --
// os KPIs saem de vw_planejamento_kpi (AD-003), e `null` é preservado como
// `null` para a tela exibir `—` (AD-005), nunca convertido para 0.
// nrFatosGeradores (AD-064, 20260920) é independente da árvore de Metas --
// vem de mv_iip_contrato por id_contrato, não de fat_objetivo_especifico/
// fat_meta -- por isso pode ser não-null mesmo quando as outras 4 colunas
// são (plano sem Meta, mas contrato com Fato Gerador realizado) e vice-versa.
describe("buscarPlanejamentoKpis (PLV-11)", () => {
  const linha = {
    id_planejamento: 10,
    id_contrato: 3,
    pct_atingimento: 62,
    metas_ativas: 7,
    metas_prioritarias: 3,
    sucessos_mensais: 12,
    nr_fatos_geradores: 5,
  };

  it("lê da view vw_planejamento_kpi, não de tabela transacional (AD-003)", async () => {
    const { client, chamadas } = criarClienteMock({ vw_planejamento_kpi: { data: linha, error: null } });
    await buscarPlanejamentoKpis(client, 10);
    expect(chamadas.map((c) => c.tabela)).toContain("vw_planejamento_kpi");
  });

  it("mapeia snake_case -> camelCase preservando cada valor", async () => {
    const { client } = criarClienteMock({ vw_planejamento_kpi: { data: linha, error: null } });
    const kpi = await buscarPlanejamentoKpis(client, 10);
    expect(kpi).toEqual({
      idPlanejamento: 10,
      idContrato: 3,
      pctAtingimento: 62,
      metasAtivas: 7,
      metasPrioritarias: 3,
      sucessosMensais: 12,
      nrFatosGeradores: 5,
    });
  });

  // PLV-11 AC4: plano sem Meta exibe `—`, não `0`. Converter null em 0 aqui
  // afirmaria desempenho zero onde não há o que medir.
  it("preserva null como null -- plano sem Meta nenhuma não vira 0", async () => {
    const vazio = {
      id_planejamento: 11,
      id_contrato: 4,
      pct_atingimento: null,
      metas_ativas: null,
      metas_prioritarias: null,
      sucessos_mensais: null,
      nr_fatos_geradores: null,
    };
    const { client } = criarClienteMock({ vw_planejamento_kpi: { data: vazio, error: null } });
    const kpi = await buscarPlanejamentoKpis(client, 11);
    expect(kpi?.pctAtingimento).toBeNull();
    expect(kpi?.metasAtivas).toBeNull();
    expect(kpi?.metasPrioritarias).toBeNull();
    expect(kpi?.sucessosMensais).toBeNull();
    expect(kpi?.nrFatosGeradores).toBeNull();
  });

  it("retorna null quando o planejamento não existe", async () => {
    const { client } = criarClienteMock({ vw_planejamento_kpi: { data: null, error: null } });
    expect(await buscarPlanejamentoKpis(client, 999)).toBeNull();
  });

  it("propaga erro do banco em vez de devolver dado parcial", async () => {
    const { client } = criarClienteMock({
      vw_planejamento_kpi: { data: null, error: { message: "permission denied" } },
    });
    await expect(buscarPlanejamentoKpis(client, 10)).rejects.toMatchObject({ message: "permission denied" });
  });
});

// Spec anchor: PLV-13 / AD-056 (.specs/features/planejamento-estrategico-v2/spec.md).
// A view guarda os dois escopos na MESMA tabela, discriminados por
// `escopo_responsavel` -- filtrar só por id_usuario_responsavel misturaria o
// total do plano com o recorte da pessoa.
describe("buscarEvolucaoMensal (PLV-13)", () => {
  const serie = [
    { mes: "2026-08-01", pct_esperado: 50, pct_atingido: 50 },
    { mes: "2026-09-01", pct_esperado: 100, pct_atingido: 50 },
  ];

  it("lê da view, não de tabela transacional (AD-003)", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_planejamento_evolucao_mensal: { data: serie, error: null },
    });
    await buscarEvolucaoMensal(client, 10);
    expect(chamadas.map((c) => c.tabela)).toContain("vw_planejamento_evolucao_mensal");
  });

  it("sem responsável, fixa escopo_responsavel=false (o plano inteiro)", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_planejamento_evolucao_mensal: { data: serie, error: null },
    });
    await buscarEvolucaoMensal(client, 10);
    const eqs = chamadas.filter((c) => c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["escopo_responsavel", false]);
    expect(eqs.some((a) => a[0] === "id_usuario_responsavel")).toBe(false);
  });

  it("com responsável, fixa escopo_responsavel=true E o id da pessoa (AC5)", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_planejamento_evolucao_mensal: { data: serie, error: null },
    });
    await buscarEvolucaoMensal(client, 10, 7);
    const eqs = chamadas.filter((c) => c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["escopo_responsavel", true]);
    expect(eqs).toContainEqual(["id_usuario_responsavel", 7]);
  });

  it("null no responsável equivale a sem filtro -- não vira escopo de pessoa", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_planejamento_evolucao_mensal: { data: serie, error: null },
    });
    await buscarEvolucaoMensal(client, 10, null);
    const eqs = chamadas.filter((c) => c.metodo === "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["escopo_responsavel", false]);
  });

  it("mapeia para camelCase preservando os valores", async () => {
    const { client } = criarClienteMock({
      vw_planejamento_evolucao_mensal: { data: serie, error: null },
    });
    expect(await buscarEvolucaoMensal(client, 10)).toEqual([
      { mes: "2026-08-01", pctEsperado: 50, pctAtingido: 50 },
      { mes: "2026-09-01", pctEsperado: 100, pctAtingido: 50 },
    ]);
  });

  // PLV-13 AC8: mês futuro tem Esperado mas não Atingido.
  it("preserva pct_atingido nulo no mês futuro -- não vira 0", async () => {
    const comFuturo = [{ mes: "2026-12-01", pct_esperado: 100, pct_atingido: null }];
    const { client } = criarClienteMock({
      vw_planejamento_evolucao_mensal: { data: comFuturo, error: null },
    });
    const linhas = await buscarEvolucaoMensal(client, 10);
    expect(linhas[0].pctAtingido).toBeNull();
    expect(linhas[0].pctEsperado).toBe(100);
  });

  // PLV-13 AC7: P=0 devolve NULL nas duas séries; sem SM nenhum não há linha.
  it("série vazia devolve [] em vez de lançar", async () => {
    const { client } = criarClienteMock({ vw_planejamento_evolucao_mensal: { data: [], error: null } });
    expect(await buscarEvolucaoMensal(client, 10)).toEqual([]);
  });

  it("propaga erro do banco", async () => {
    const { client } = criarClienteMock({
      vw_planejamento_evolucao_mensal: { data: null, error: { message: "permission denied" } },
    });
    await expect(buscarEvolucaoMensal(client, 10)).rejects.toMatchObject({ message: "permission denied" });
  });
});

// Spec anchor: PLV-03 / PLV-12 (.specs/features/planejamento-estrategico-v2/spec.md).
//
// CONTRATO REAL DA VIEW, confirmado em teste de integração (T4): com dt_limite
// NULL, `esta_atrasado` vem **null**, não false -- `status = 'pendente' AND NULL`
// é NULL em SQL. As duas colunas falham de formas diferentes na mesma linha:
// dias_atraso devolve 0 e esta_atrasado devolve null. As fixturas abaixo usam
// o formato que a view realmente produz; usar `false` testaria um formato
// inexistente e passaria mesmo com a derivação errada.
describe("buscarGradeSucessosMensais -- atraso e responsável (PLV-03/PLV-12)", () => {
  function linha(extra: Record<string, unknown>) {
    return {
      id_sucesso: 1,
      id_meta: 5,
      descricao: "Mapear parlamentares",
      mes_referencia: "2026-09-01",
      dt_limite: "2026-09-30",
      peso: 50,
      pct_atingimento: 20,
      status: "pendente",
      dias_atraso: 0,
      esta_atrasado: false,
      id_usuario_responsavel: null,
      ...extra,
    };
  }

  async function primeira(extra: Record<string, unknown>) {
    const { client } = criarClienteMock({ vw_sucesso_mensal: { data: [linha(extra)], error: null } });
    const linhas = await buscarGradeSucessosMensais(client, [5]);
    return linhas[0];
  }

  it("atrasado: devolve os dias corridos", async () => {
    expect((await primeira({ dias_atraso: 5, esta_atrasado: true })).atrasoDias).toBe(5);
  });

  it("no prazo: devolve null, não 0", async () => {
    expect((await primeira({ dias_atraso: 0, esta_atrasado: false })).atrasoDias).toBeNull();
  });

  // O caso que a coluna dias_atraso sozinha erra: GREATEST ignora NULL e devolve 0.
  it("sem dt_limite: devolve null mesmo com dias_atraso=0 e esta_atrasado=null", async () => {
    const sm = await primeira({ dt_limite: null, dias_atraso: 0, esta_atrasado: null });
    expect(sm.atrasoDias).toBeNull();
  });

  // O outro caso que dias_atraso sozinha erra: não olha o status.
  it("realizado e vencido: não está atrasado", async () => {
    const sm = await primeira({ status: "realizado", dias_atraso: 12, esta_atrasado: false });
    expect(sm.atrasoDias).toBeNull();
  });

  it("expõe o responsável próprio do Sucesso Mensal", async () => {
    expect((await primeira({ id_usuario_responsavel: 7 })).idUsuarioResponsavel).toBe(7);
  });

  it("sem responsável próprio devolve null -- a herança da Meta é da camada de exibição", async () => {
    expect((await primeira({ id_usuario_responsavel: null })).idUsuarioResponsavel).toBeNull();
  });

  it("pede id_usuario_responsavel no select", async () => {
    const { client, chamadas } = criarClienteMock({
      vw_sucesso_mensal: { data: [linha({})], error: null },
    });
    await buscarGradeSucessosMensais(client, [5]);
    const select = chamadas.find((c) => c.metodo === "select");
    expect(String(select?.args[0])).toContain("id_usuario_responsavel");
  });
});
