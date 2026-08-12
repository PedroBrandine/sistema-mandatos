import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "../supabase/database.types";
import { buscarBoardKanban, buscarProjetosDoProduto } from "./kanban";

// Spec anchor: kanban-etapas T4 Done-when (.specs/features/kanban-etapas/tasks.md) --
//  - buscarBoardKanban retorna uma coluna por ref_etapa do produto, ordenada por ordem
//  - Card com id_etapa_atual preenchido cai na coluna certa; card com
//    id_etapa_atual IS NULL cai na coluna ordem=1
//  - Filtro por papel+pessoa, projeto e "minha carteira" cada um restringe
//    corretamente isoladamente, e dois juntos aplicam AND (não OR)
//  - diasNaEtapaAtual usa fat_etapa_contrato.dt_inicio da etapa atual quando
//    setado, senão fat_contrato.dt_inicio (regra do design.md)
//  - buscarProjetosDoProduto retorna só projetos distintos entre os
//    contratos do produto
//  - Produto sem nenhum contrato retorna colunas vazias (cards: []), nunca lança
//
// spec.md KAN-01, KAN-02, KAN-03, KAN-10.

type Chamada = { tabela: string; metodo: string; args: unknown[] };
type RespostaTabela = { data: unknown; error: { message: string } | null };

// Mesmo padrão de contrato.test.ts: mock roteado por nome de tabela, com
// fila de respostas quando a mesma tabela é consultada mais de uma vez na
// mesma chamada (ex.: rel_usuario_contrato pode ser consultada pelo filtro
// papel+pessoa E pelo filtro minha carteira). Estendido com `.not()` (usado
// por buscarProjetosDoProduto) e `client.auth.getUser()` (usado pelo filtro
// minha carteira).
function criarClienteMock(
  respostasPorTabela: Record<string, RespostaTabela | RespostaTabela[]>,
  emailAutenticado?: string | null
) {
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
      not: (...args: unknown[]) => {
        chamadas.push({ tabela, metodo: "not", args });
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
    auth: {
      getUser: () => Promise.resolve({ data: { user: emailAutenticado ? { email: emailAutenticado } : null } }),
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, chamadas };
}

const ETAPA_CADASTRO = { id_etapa: 10, codigo: "cadastro", nome: "Cadastro", ordem: 1 };
const ETAPA_PONTAPE = { id_etapa: 11, codigo: "pontape", nome: "Pontapé", ordem: 2 };

describe("buscarBoardKanban", () => {
  // Done-when: "retorna uma coluna por ref_etapa do produto, ordenada por ordem"
  it("retorna uma coluna por ref_etapa do produto, ordenada por ordem", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_etapa: { data: [ETAPA_CADASTRO, ETAPA_PONTAPE], error: null },
      fat_contrato: { data: [], error: null },
    });

    const resultado = await buscarBoardKanban(client, 5);

    expect(resultado.map((c) => c.ordem)).toEqual([1, 2]);
    expect(resultado[0]).toEqual({ idEtapa: 10, codigo: "cadastro", nome: "Cadastro", ordem: 1, cards: [] });
    const chamadaOrder = chamadas.find((c) => c.tabela === "ref_etapa" && c.metodo === "order");
    expect(chamadaOrder?.args).toEqual(["ordem", { ascending: true }]);
  });

  // Done-when: "Card de contrato com id_etapa_atual preenchido cai na coluna certa"
  it("posiciona o card na coluna correspondente a id_etapa_atual quando preenchido", async () => {
    const { client } = criarClienteMock({
      ref_etapa: { data: [ETAPA_CADASTRO, ETAPA_PONTAPE], error: null },
      fat_contrato: {
        data: [{ id_contrato: 100, id_etapa_atual: 11, id_contratante: 1, status: "ativo", dt_inicio: "2026-01-01" }],
        error: null,
      },
      dim_contratante: { data: [{ id_contratante: 1, nome: "Fulano" }], error: null },
      fat_etapa_contrato: { data: [{ id_contrato: 100, id_etapa: 11, dt_inicio: "2026-02-01" }], error: null },
    });

    const resultado = await buscarBoardKanban(client, 5);

    const colunaCadastro = resultado.find((c) => c.idEtapa === 10)!;
    const colunaPontape = resultado.find((c) => c.idEtapa === 11)!;
    expect(colunaCadastro.cards).toEqual([]);
    expect(colunaPontape.cards).toHaveLength(1);
    expect(colunaPontape.cards[0].idContrato).toBe(100);
  });

  // Done-when: "card com id_etapa_atual IS NULL cai na coluna da 1ª etapa (ordem = 1)"
  it("posiciona o card na coluna ordem=1 quando id_etapa_atual IS NULL", async () => {
    const { client } = criarClienteMock({
      ref_etapa: { data: [ETAPA_CADASTRO, ETAPA_PONTAPE], error: null },
      fat_contrato: {
        data: [{ id_contrato: 100, id_etapa_atual: null, id_contratante: 1, status: "ativo", dt_inicio: "2026-01-01" }],
        error: null,
      },
      dim_contratante: { data: [{ id_contratante: 1, nome: "Fulano" }], error: null },
      fat_etapa_contrato: { data: [], error: null },
    });

    const resultado = await buscarBoardKanban(client, 5);

    const colunaCadastro = resultado.find((c) => c.idEtapa === 10)!;
    expect(colunaCadastro.cards).toHaveLength(1);
    expect(colunaCadastro.cards[0].idContrato).toBe(100);
  });

  // Done-when: "Filtro por papel+pessoa ... restringe corretamente isoladamente"
  it("filtro por papel+pessoa (idGestora) restringe aos contratos com vínculo ativo daquela pessoa", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_etapa: { data: [ETAPA_CADASTRO], error: null },
      fat_contrato: {
        data: [
          { id_contrato: 100, id_etapa_atual: null, id_contratante: 1, status: "ativo", dt_inicio: "2026-01-01" },
          { id_contrato: 200, id_etapa_atual: null, id_contratante: 2, status: "ativo", dt_inicio: "2026-01-01" },
        ],
        error: null,
      },
      rel_usuario_contrato: { data: [{ id_contrato: 100 }], error: null },
      dim_contratante: { data: [{ id_contratante: 1, nome: "Fulano" }], error: null },
      fat_etapa_contrato: { data: [], error: null },
    });

    const resultado = await buscarBoardKanban(client, 5, { idGestora: 42 });

    const idsCards = resultado.flatMap((c) => c.cards.map((card) => card.idContrato));
    expect(idsCards).toEqual([100]);
    const eqsVinculo = chamadas
      .filter((c) => c.tabela === "rel_usuario_contrato" && c.metodo === "eq")
      .map((c) => c.args);
    expect(eqsVinculo).toContainEqual(["id_usuario", 42]);
    expect(eqsVinculo).toContainEqual(["papel_no_contrato", "gestora"]);
  });

  // Done-when: "Filtro por ... projeto ... restringe corretamente isoladamente"
  it("filtro por projeto aplica eq(id_projeto) na consulta de fat_contrato", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_etapa: { data: [ETAPA_CADASTRO], error: null },
      fat_contrato: {
        data: [{ id_contrato: 100, id_etapa_atual: null, id_contratante: 1, status: "ativo", dt_inicio: "2026-01-01" }],
        error: null,
      },
      dim_contratante: { data: [{ id_contratante: 1, nome: "Fulano" }], error: null },
      fat_etapa_contrato: { data: [], error: null },
    });

    await buscarBoardKanban(client, 5, { idProjeto: 7 });

    const eqsContrato = chamadas.filter((c) => c.tabela === "fat_contrato" && c.metodo === "eq").map((c) => c.args);
    expect(eqsContrato).toContainEqual(["id_projeto", 7]);
  });

  // Done-when: "Filtro por ... 'minha carteira' ... restringe corretamente isoladamente"
  it("filtro minha carteira restringe aos contratos com vínculo ativo do usuário logado", async () => {
    const { client } = criarClienteMock(
      {
        ref_etapa: { data: [ETAPA_CADASTRO], error: null },
        fat_contrato: {
          data: [
            { id_contrato: 100, id_etapa_atual: null, id_contratante: 1, status: "ativo", dt_inicio: "2026-01-01" },
            { id_contrato: 200, id_etapa_atual: null, id_contratante: 2, status: "ativo", dt_inicio: "2026-01-01" },
          ],
          error: null,
        },
        dim_usuario: { data: { id_usuario: 9 }, error: null },
        rel_usuario_contrato: { data: [{ id_contrato: 200 }], error: null },
        dim_contratante: { data: [{ id_contratante: 2, nome: "Coalizão X" }], error: null },
        fat_etapa_contrato: { data: [], error: null },
      },
      "mentor@legislabrasil.org"
    );

    const resultado = await buscarBoardKanban(client, 5, { minhaCarteira: true });

    const idsCards = resultado.flatMap((c) => c.cards.map((card) => card.idContrato));
    expect(idsCards).toEqual([200]);
  });

  // Done-when: "dois juntos aplicam AND (não OR)"
  it("dois filtros juntos (papel+pessoa e projeto) aplicam AND -- cada um restringe sua própria consulta", async () => {
    const { client, chamadas } = criarClienteMock({
      ref_etapa: { data: [ETAPA_CADASTRO], error: null },
      fat_contrato: {
        data: [{ id_contrato: 100, id_etapa_atual: null, id_contratante: 1, status: "ativo", dt_inicio: "2026-01-01" }],
        error: null,
      },
      rel_usuario_contrato: { data: [{ id_contrato: 100 }], error: null },
      dim_contratante: { data: [{ id_contratante: 1, nome: "Fulano" }], error: null },
      fat_etapa_contrato: { data: [], error: null },
    });

    await buscarBoardKanban(client, 5, { idGestora: 42, idProjeto: 7 });

    const eqsContrato = chamadas.filter((c) => c.tabela === "fat_contrato" && c.metodo === "eq").map((c) => c.args);
    expect(eqsContrato).toContainEqual(["id_produto", 5]);
    expect(eqsContrato).toContainEqual(["id_projeto", 7]);
    const eqsVinculo = chamadas
      .filter((c) => c.tabela === "rel_usuario_contrato" && c.metodo === "eq")
      .map((c) => c.args);
    expect(eqsVinculo).toContainEqual(["id_usuario", 42]);
    expect(eqsVinculo).toContainEqual(["papel_no_contrato", "gestora"]);
  });

  // Done-when: "diasNaEtapaAtual usa fat_etapa_contrato.dt_inicio da etapa atual quando setado"
  it("diasNaEtapaAtual usa fat_etapa_contrato.dt_inicio da etapa atual quando setado", async () => {
    const hoje = new Date();
    const dtInicioEtapa = new Date(hoje.getTime() - 5 * 86400000).toISOString().slice(0, 10);
    const dtInicioContrato = new Date(hoje.getTime() - 100 * 86400000).toISOString().slice(0, 10);

    const { client } = criarClienteMock({
      ref_etapa: { data: [ETAPA_CADASTRO], error: null },
      fat_contrato: {
        data: [{ id_contrato: 100, id_etapa_atual: 10, id_contratante: 1, status: "ativo", dt_inicio: dtInicioContrato }],
        error: null,
      },
      dim_contratante: { data: [{ id_contratante: 1, nome: "Fulano" }], error: null },
      fat_etapa_contrato: { data: [{ id_contrato: 100, id_etapa: 10, dt_inicio: dtInicioEtapa }], error: null },
    });

    const resultado = await buscarBoardKanban(client, 5);
    expect(resultado[0].cards[0].diasNaEtapaAtual).toBe(5);
  });

  // Done-when: "... senão fat_contrato.dt_inicio (regra do design.md)"
  it("diasNaEtapaAtual usa fat_contrato.dt_inicio quando a etapa atual nunca teve dt_inicio setado", async () => {
    const hoje = new Date();
    const dtInicioContrato = new Date(hoje.getTime() - 30 * 86400000).toISOString().slice(0, 10);

    const { client } = criarClienteMock({
      ref_etapa: { data: [ETAPA_CADASTRO], error: null },
      fat_contrato: {
        data: [
          { id_contrato: 100, id_etapa_atual: null, id_contratante: 1, status: "ativo", dt_inicio: dtInicioContrato },
        ],
        error: null,
      },
      dim_contratante: { data: [{ id_contratante: 1, nome: "Fulano" }], error: null },
      fat_etapa_contrato: { data: [], error: null },
    });

    const resultado = await buscarBoardKanban(client, 5);
    expect(resultado[0].cards[0].diasNaEtapaAtual).toBe(30);
  });

  // Done-when: "Produto sem nenhum contrato retorna colunas vazias (cards: []), nunca lança"
  it("retorna colunas vazias (cards: []), nunca lança, quando o produto não tem nenhum contrato", async () => {
    const { client } = criarClienteMock({
      ref_etapa: { data: [ETAPA_CADASTRO], error: null },
      fat_contrato: { data: [], error: null },
    });

    const resultado = await buscarBoardKanban(client, 5);
    expect(resultado).toEqual([{ idEtapa: 10, codigo: "cadastro", nome: "Cadastro", ordem: 1, cards: [] }]);
  });

  // Edge Case (spec.md): "contrato com status = 'concluido'/'nao_concluido' continua visível no
  // board, sem ser removido silenciosamente" -- validation.md Fix 1 (mutante #4 sobreviveu: um
  // filtro extra por status='ativo' passaria pelas outras 12 asserções sem quebrar nenhuma).
  it("contrato com status 'concluido' continua visível no board, preservando o status", async () => {
    const { client } = criarClienteMock({
      ref_etapa: { data: [ETAPA_CADASTRO], error: null },
      fat_contrato: {
        data: [{ id_contrato: 100, id_etapa_atual: null, id_contratante: 1, status: "concluido", dt_inicio: "2026-01-01" }],
        error: null,
      },
      dim_contratante: { data: [{ id_contratante: 1, nome: "Fulano" }], error: null },
      fat_etapa_contrato: { data: [], error: null },
    });

    const resultado = await buscarBoardKanban(client, 5);

    const colunaCadastro = resultado.find((c) => c.idEtapa === 10)!;
    expect(colunaCadastro.cards).toHaveLength(1);
    expect(colunaCadastro.cards[0].idContrato).toBe(100);
    expect(colunaCadastro.cards[0].statusContrato).toBe("concluido");
  });
});

describe("buscarProjetosDoProduto", () => {
  // Done-when: "buscarProjetosDoProduto retorna só projetos distintos entre os contratos do produto"
  it("retorna só projetos distintos entre os contratos do produto", async () => {
    const { client } = criarClienteMock({
      fat_contrato: { data: [{ id_projeto: 1 }, { id_projeto: 2 }, { id_projeto: 1 }], error: null },
      ref_projeto: {
        data: [
          { id_projeto: 1, nome: "Projeto A" },
          { id_projeto: 2, nome: "Projeto B" },
        ],
        error: null,
      },
    });

    const resultado = await buscarProjetosDoProduto(client, 5);

    expect(resultado).toEqual([
      { idProjeto: 1, nome: "Projeto A" },
      { idProjeto: 2, nome: "Projeto B" },
    ]);
  });

  it("retorna [] quando nenhum contrato do produto tem id_projeto setado", async () => {
    const { client } = criarClienteMock({ fat_contrato: { data: [], error: null } });
    const resultado = await buscarProjetosDoProduto(client, 5);
    expect(resultado).toEqual([]);
  });
});
