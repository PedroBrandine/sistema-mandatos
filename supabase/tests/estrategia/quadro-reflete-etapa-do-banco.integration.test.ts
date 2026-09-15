import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSql } from "../helpers/sql";
import { buscarQuadro } from "../../../src/backend/queries/quadro";
import type { Database } from "../../../src/backend/supabase/database.types";

// Spec anchor: .specs/features/kpi-status-mandatos-ativos/spec.md, P2 (KSM-09:
// "a contagem de cada status no card SHALL ser igual ao número de cards do
// Quadro marcados com aquele mesmo estado") e P1-B (KSM-17).
//
// POR QUE ESTE ARQUIVO EXISTE. Pedido de Pedro em 2026-09-15: "faça o teste ao
// contrário -- altere a etapa no banco e veja se altera no Kanban". É a
// verificação que faltava. Toda a suíte até aqui prova que a VIEW classifica
// certo; nada provava que a mudança no banco chega ao componente que desenha o
// card. O caminho banco -> buscarQuadro -> coluna do card ficava coberto só
// pela conferência humana, e foi exatamente uma regressão nesse trecho (o
// <Link> perdido na substituição do KanbanCard) que passou despercebida.
//
// O QUE ELE NÃO PROVA: que o ARRASTE move a etapa. Aqui a escrita é feita por
// SQL, não pelo gesto -- o caminho drag -> app.mover_etapa_kanban continua sem
// teste automatizado (não há harness que simule ponteiro sobre dnd-kit). Este
// arquivo cobre a direção oposta, que é a que a tela usa para LER.
//
// Sessão de gestora real, não service_role: vw_estrategia_kpi e as tabelas por
// trás de buscarQuadro são security_invoker, então ler com service_role
// provaria um caminho que a tela nunca percorre.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const PASSWORD = "KSM-quadro-reflete-banco-P4ssword!";
const GESTORA_EMAIL = "ksm-quadro-gestora@legislabrasil.test";

const admin = createClient(URL, SERVICE_ROLE_KEY);
const authUserIds: string[] = [];

let cliente: SupabaseClient<Database>;
let idProduto: number;
let idUsuario: number;
let idContratante: number;
let idContrato: number;
let idEtapaPrimeira: number;
let idEtapaSegunda: number;
let duracaoSegunda: number;

// Em que coluna de etapa o card deste contrato está desenhado. Devolve null
// quando o card não aparece em nenhuma -- que é um resultado possível e
// significativo (contrato fora do board), não um erro do teste.
function colunaDoCard(colunas: Awaited<ReturnType<typeof buscarQuadro>>, idContratoAlvo: number) {
  for (const coluna of colunas) {
    if (coluna.tipo !== "etapa") continue;
    if (coluna.cards.some((c) => c.idContrato === idContratoAlvo)) return coluna;
  }
  return null;
}

describe("Quadro reflete a etapa do banco (KSM-09)", () => {
  beforeAll(async () => {
    const { data: existentes } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of existentes?.users ?? []) {
      if (user.email === GESTORA_EMAIL) {
        await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
      }
    }
    const { data: criado, error: erroAuth } = await admin.auth.admin.createUser({
      email: GESTORA_EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (erroAuth) throw erroAuth;
    authUserIds.push(criado.user.id);

    await runSql(`
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('${GESTORA_EMAIL}', 'KSM Quadro Gestora', 'gestora', true)
      ON CONFLICT (email) DO UPDATE SET papel_global = 'gestora', ativo = true;
    `);

    const [produto] = await runSql<{ id_produto: number }>(
      `SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia';`
    );
    idProduto = produto.id_produto;

    const [usuario] = await runSql<{ id_usuario: number }>(
      `SELECT id_usuario FROM dim_usuario WHERE email = '${GESTORA_EMAIL}';`
    );
    idUsuario = usuario.id_usuario;

    // As duas primeiras etapas COM duração: a de ordem 1 é onde o Kanban
    // desenha o card de um contrato sem transição (fallback), e a segunda é
    // para onde a etapa será movida no banco.
    const etapas = await runSql<{ id_etapa: number; duracao_prevista_dias: number }>(`
      SELECT id_etapa, duracao_prevista_dias FROM ref_etapa
       WHERE id_produto = ${idProduto} AND duracao_prevista_dias IS NOT NULL
       ORDER BY ordem LIMIT 2;
    `);
    idEtapaPrimeira = etapas[0].id_etapa;
    idEtapaSegunda = etapas[1].id_etapa;
    duracaoSegunda = etapas[1].duracao_prevista_dias;

    const [contratante] = await runSql<{ id_contratante: number }>(`
      WITH ct AS (
        INSERT INTO dim_contratante (tipo_contratante, nome)
        VALUES ('mandato', 'KSM Quadro Contratante Fixture')
        RETURNING id_contratante
      ), m AS (
        INSERT INTO dim_mandato (id_contratante) SELECT id_contratante FROM ct RETURNING id_contratante
      )
      SELECT id_contratante FROM ct;
    `);
    idContratante = contratante.id_contratante;

    // Sem id_etapa_atual de propósito: é o estado em que o contrato nasce, e o
    // primeiro teste depende dele para provar o fallback de coluna.
    const [contrato] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratante}, ${idProduto}, CURRENT_DATE - 3, 'ativo')
      RETURNING id_contrato;
    `);
    idContrato = contrato.id_contrato;

    await runSql(`
      INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
      VALUES (${idContrato}, ${idUsuario}, 'gestora');
    `);

    const anon = createClient(URL, ANON_KEY);
    const { error } = await anon.auth.signInWithPassword({ email: GESTORA_EMAIL, password: PASSWORD });
    if (error) throw error;
    cliente = anon as unknown as SupabaseClient<Database>;
  }, 180000);

  afterAll(async () => {
    await runSql(`
      DELETE FROM rel_usuario_contrato WHERE id_contrato = ${idContrato};
      DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
      DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
      DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
      DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};
      DELETE FROM dim_mandato WHERE id_contratante = ${idContratante};
      DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};
      DELETE FROM dim_usuario WHERE id_usuario = ${idUsuario};
    `);
    for (const id of authUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => undefined);
    }
  }, 180000);

  it("mover a etapa no banco move o card de coluna no Quadro", async () => {
    // Estado inicial: sem transição registrada, o card é desenhado na etapa de
    // ordem 1 (fallback de buscarBoardKanban).
    const antes = await buscarQuadro(cliente, { idProduto });
    const colunaAntes = colunaDoCard(antes, idContrato);
    expect(colunaAntes, "o card do contrato fixture não apareceu em nenhuma coluna").not.toBeNull();
    expect(colunaAntes?.idEtapa).toBe(idEtapaPrimeira);

    // A alteração é feita SÓ no banco -- nenhuma chamada de aplicação.
    await runSql(`
      UPDATE fat_contrato SET id_etapa_atual = ${idEtapaSegunda} WHERE id_contrato = ${idContrato};
      UPDATE fat_etapa_contrato SET dt_inicio = CURRENT_DATE - 2, status = 'em_andamento'
       WHERE id_contrato = ${idContrato} AND id_etapa = ${idEtapaSegunda};
    `);

    const depois = await buscarQuadro(cliente, { idProduto });
    const colunaDepois = colunaDoCard(depois, idContrato);
    expect(colunaDepois?.idEtapa).toBe(idEtapaSegunda);
    // E saiu mesmo da anterior -- sem isto, um card duplicado nas duas colunas
    // passaria como se fosse movimento.
    expect(colunaDepois?.idEtapa).not.toBe(colunaAntes?.idEtapa);
    expect(colunaDoCard(depois, idContrato)?.cards.filter((c) => c.idContrato === idContrato)).toHaveLength(1);
  }, 120000);

  it("os dias na etapa exibidos no card acompanham a data gravada no banco", async () => {
    await runSql(`
      UPDATE fat_contrato SET id_etapa_atual = ${idEtapaSegunda} WHERE id_contrato = ${idContrato};
      UPDATE fat_etapa_contrato SET dt_inicio = CURRENT_DATE - 9, status = 'em_andamento'
       WHERE id_contrato = ${idContrato} AND id_etapa = ${idEtapaSegunda};
    `);

    const quadro = await buscarQuadro(cliente, { idProduto });
    const card = colunaDoCard(quadro, idContrato)?.cards.find((c) => c.idContrato === idContrato);
    // 9 dias desde a transição gravada: o número que o card escreve ("N dias
    // na etapa") e o mesmo que classificarLimiar usa para pintar o badge.
    expect(card?.diasNaEtapaAtual).toBe(9);
  }, 120000);

  it("estourar a duração da etapa no banco faz o KPI contar o mandato como atrasado", async () => {
    await runSql(`
      UPDATE fat_contrato SET id_etapa_atual = ${idEtapaSegunda} WHERE id_contrato = ${idContrato};
      UPDATE fat_etapa_contrato SET dt_inicio = CURRENT_DATE - ${duracaoSegunda + 5}, status = 'em_andamento'
       WHERE id_contrato = ${idContrato} AND id_etapa = ${idEtapaSegunda};
    `);

    // A mesma leitura que a faixa de KPIs faz, pela sessão de gestora: o
    // recorte da gestora do fixture contém só este contrato.
    const { data, error } = await cliente
      .from("vw_estrategia_kpi")
      .select("mandatos_ativos, mandatos_atraso_atrasados, mandatos_atraso_atencao, mandatos_atraso_normal")
      .eq("id_produto", idProduto)
      .eq("escopo_projeto", false)
      .eq("escopo_gestora", true)
      .eq("id_usuario_gestora", idUsuario);
    if (error) throw error;

    const linha = data?.[0];
    expect(linha?.mandatos_ativos).toBe(1);
    expect(linha?.mandatos_atraso_atrasados).toBe(1);
    expect(linha?.mandatos_atraso_atencao).toBe(0);
    expect(linha?.mandatos_atraso_normal).toBe(0);
  }, 120000);

  it("o Quadro e o KPI concordam sobre o mesmo mandato, no mesmo recorte (KSM-09)", async () => {
    // Recém-entrado na etapa: o Quadro deve desenhar o card e o KPI deve
    // contá-lo em 'normal' -- os dois olhando o mesmo contrato e a mesma data.
    await runSql(`
      UPDATE fat_contrato SET id_etapa_atual = ${idEtapaSegunda} WHERE id_contrato = ${idContrato};
      UPDATE fat_etapa_contrato SET dt_inicio = CURRENT_DATE - 1, status = 'em_andamento'
       WHERE id_contrato = ${idContrato} AND id_etapa = ${idEtapaSegunda};
    `);

    const quadro = await buscarQuadro(cliente, { idProduto, filtro: { idGestora: idUsuario } });
    const cardsDaGestora = quadro
      .filter((c) => c.tipo === "etapa")
      .flatMap((c) => (c.tipo === "etapa" ? c.cards : []));

    const { data, error } = await cliente
      .from("vw_estrategia_kpi")
      .select("mandatos_ativos, mandatos_atraso_atrasados, mandatos_atraso_atencao, mandatos_atraso_normal")
      .eq("id_produto", idProduto)
      .eq("escopo_projeto", false)
      .eq("escopo_gestora", true)
      .eq("id_usuario_gestora", idUsuario);
    if (error) throw error;
    const linha = data?.[0];

    // O número grande do card é a contagem de cards do Quadro no mesmo
    // recorte: é literalmente a conferência que KSM-09 pede para ser feita a
    // olho na tela, aqui automatizada.
    expect(cardsDaGestora).toHaveLength(1);
    expect(linha?.mandatos_ativos).toBe(cardsDaGestora.length);
    expect(linha?.mandatos_atraso_normal).toBe(1);
    expect(linha?.mandatos_atraso_atrasados).toBe(0);
  }, 120000);
});
