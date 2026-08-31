import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import {
  buscarEvolucaoGip,
  buscarGradeSucessosMensais,
  buscarHistoricoAuditoria,
  buscarPessoasVinculadasAoContrato,
  buscarPlanejamentoCompleto,
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
            oportunidade: "Janela eleitoral favorável",
            ameaca: "Oposição articulada",
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
      oportunidade: "Janela eleitoral favorável",
      ameaca: "Oposição articulada",
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
