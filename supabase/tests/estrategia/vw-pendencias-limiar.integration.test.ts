import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/redesenho-estrategia-tela-first/spec.md, EST-06
// + Edge Case "WHEN um limiar é editado em ref_limiar_pendencia THEN a
// classificação SHALL mudar sem deploy" (AD-041, correção da violação de
// AD-004). Migração: 20260910152107_estrategia_vw_pendencias_limiar.sql.
//
// A não-regressão é provada por comparação direta: a definição ANTERIOR da
// view (20260814162237, com INTERVAL '30 days'/'45 days' cravados) é
// reproduzida verbatim como CTE `legado` e confrontada com a view refatorada
// via EXCEPT ALL nos dois sentidos, sobre o banco INTEIRO -- não só sobre a
// fixture. Zero linha de diferença nos dois sentidos = mesmas linhas em todas
// as 6 categorias com o seed padrão. A fixture existe para garantir que a
// comparação não seja vazia e que as 6 categorias estejam de fato exercidas.
//
// O par positivo/negativo por categoria continua em
// supabase/tests/visao-gerencial/vw-pendencias.integration.test.ts, que roda
// inalterado -- este arquivo não o duplica, cobre o que é novo (limiar lido de
// tabela) e a igualdade com o comportamento anterior.

// Corpo da view ANTES do refactor, verbatim de
// 20260814162237_visao_gerencial_vw_pendencias.sql -- os dois INTERVAL
// cravados são justamente o que se quer confrontar.
const DEFINICAO_LEGADA = `
WITH contrato_base AS (
  SELECT c.id_contrato, c.id_contratante, c.dt_inicio, c.status,
         ct.nome AS nome_contratante,
         v.id_usuario AS id_usuario_gestora,
         u.nome AS nome_gestora
  FROM fat_contrato c
  JOIN dim_contratante ct ON ct.id_contratante = c.id_contratante
  LEFT JOIN rel_usuario_contrato v ON v.id_contrato = c.id_contrato AND v.papel_no_contrato = 'gestora'
                                    AND (v.dt_fim IS NULL OR v.dt_fim >= CURRENT_DATE)
  LEFT JOIN dim_usuario u ON u.id_usuario = v.id_usuario
)
SELECT cb.id_contrato, cb.nome_contratante, 'cadastro'::text AS categoria, x.campo AS detalhe,
       cb.dt_inicio AS dt_referencia,
       (CURRENT_DATE - cb.dt_inicio) AS dias_em_aberto,
       cb.id_usuario_gestora, cb.nome_gestora
FROM contrato_base cb
JOIN dim_mandato m ON m.id_contratante = cb.id_contratante
CROSS JOIN LATERAL (VALUES
    ('ds_genero',        m.ds_genero IS NULL),
    ('ds_raca',          m.ds_raca IS NULL),
    ('fl_pcd',           m.fl_pcd IS NULL),
    ('confianca',        m.confianca IS NULL),
    ('titulo_eleitoral', m.nr_titulo_eleitoral IS NULL)
  ) AS x(campo, vazio)
WHERE x.vazio AND cb.status = 'ativo'
UNION ALL
SELECT cb.id_contrato, cb.nome_contratante, 'formulario_aberto', rf.codigo,
       f.dt_abertura::date AS dt_referencia,
       (CURRENT_DATE - f.dt_abertura::date) AS dias_em_aberto,
       cb.id_usuario_gestora, cb.nome_gestora
FROM rel_formulario_contrato f
JOIN contrato_base cb ON cb.id_contrato = f.id_contrato
JOIN ref_formulario rf ON rf.id_formulario = f.id_formulario
WHERE f.estado = 'aberto' AND f.dt_abertura < now() - INTERVAL '30 days'
UNION ALL
SELECT cb.id_contrato, cb.nome_contratante, 'etapa_atrasada', vec.codigo_etapa,
       vec.dt_prevista_conclusao AS dt_referencia,
       vec.dias_atraso AS dias_em_aberto,
       cb.id_usuario_gestora, cb.nome_gestora
FROM vw_etapa_contrato vec
JOIN contrato_base cb ON cb.id_contrato = vec.id_contrato
WHERE vec.status NOT IN ('concluida', 'dispensada') AND vec.dt_prevista_conclusao < CURRENT_DATE
UNION ALL
SELECT cb.id_contrato, cb.nome_contratante, 'encontro_vencido', en.titulo,
       en.dt_prevista_inicio::date AS dt_referencia,
       (CURRENT_DATE - en.dt_prevista_inicio::date) AS dias_em_aberto,
       cb.id_usuario_gestora, cb.nome_gestora
FROM fat_encontro en
JOIN contrato_base cb ON cb.id_contrato = en.id_contrato
WHERE en.status = 'planejado' AND en.dt_prevista_inicio < now()
UNION ALL
SELECT cb.id_contrato, cb.nome_contratante, 'sem_registro_recente', NULL::text AS detalhe,
       COALESCE(reg.ultimo_registro::date, cb.dt_inicio) AS dt_referencia,
       (CURRENT_DATE - COALESCE(reg.ultimo_registro::date, cb.dt_inicio)) AS dias_em_aberto,
       cb.id_usuario_gestora, cb.nome_gestora
FROM contrato_base cb
CROSS JOIN LATERAL (
  SELECT MAX(r.ocorrido_em) AS ultimo_registro FROM fat_registro r WHERE r.id_contrato = cb.id_contrato
) reg
WHERE cb.status = 'ativo'
  AND COALESCE(reg.ultimo_registro, cb.dt_inicio::timestamptz) < now() - INTERVAL '45 days'
UNION ALL
SELECT cb.id_contrato, cb.nome_contratante, 'sucesso_mensal_atrasado', sm.descricao,
       sm.dt_limite AS dt_referencia,
       (CURRENT_DATE - sm.dt_limite) AS dias_em_aberto,
       cb.id_usuario_gestora, cb.nome_gestora
FROM fat_sucesso_mensal sm
JOIN fat_meta mt               ON mt.id_meta = sm.id_meta
JOIN fat_objetivo_especifico o ON o.id_objetivo = mt.id_objetivo
JOIN dim_planejamento pl       ON pl.id_planejamento = o.id_planejamento
JOIN contrato_base cb          ON cb.id_contrato = pl.id_contrato
WHERE sm.status = 'pendente' AND sm.dt_limite < CURRENT_DATE
`;

let idProduto: number;
let idEtapaPontape: number;
let idUsuario: number;
let idContratante: number;
let idContrato: number;
let idTipoRegistro: number;
let idFormulario: number;

// Fixture consolidada em poucas chamadas -- cada runSql spawna um processo
// `supabase db query --linked` (ver supabase/tests/helpers/sql.ts). Mesma
// receita já provada em vw-pendencias.integration.test.ts: contrato de 60
// dias com dim_mandato de campos vazios (cadastro + sem_registro_recente),
// formulário aberto há 40 dias, etapa vencida, encontro vencido e sucesso
// mensal vencido -- as 6 categorias de uma vez.
beforeAll(async () => {
  const [catalogo] = await runSql<{
    id_produto: number;
    id_etapa_pontape: number;
    id_tipo_registro: number;
    id_formulario: number;
  }>(`
    WITH p AS (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia')
    SELECT p.id_produto,
           (SELECT id_etapa FROM ref_etapa WHERE id_produto = p.id_produto AND codigo = 'pontape') AS id_etapa_pontape,
           (SELECT tr.id_tipo_registro FROM ref_tipo_registro tr JOIN ref_etapa e ON e.id_etapa = tr.id_etapa
             WHERE e.id_produto = p.id_produto AND tr.codigo = 'monitoramento') AS id_tipo_registro,
           (SELECT f.id_formulario FROM ref_formulario f JOIN ref_etapa e ON e.id_etapa = f.id_etapa
             WHERE e.id_produto = p.id_produto AND f.ativo LIMIT 1) AS id_formulario
    FROM p;
  `);
  idProduto = catalogo.id_produto;
  idEtapaPontape = catalogo.id_etapa_pontape;
  idTipoRegistro = catalogo.id_tipo_registro;
  idFormulario = catalogo.id_formulario;

  const [entidades] = await runSql<{ id_usuario: number; id_contratante: number }>(`
    WITH u AS (
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('t3-limiar-vw-pendencias@legislabrasil.test', 'T3 Limiar Gestora Fixture', 'gestora', true)
      ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id_usuario
    ), ct AS (
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'T3 Limiar Contratante Fixture')
      RETURNING id_contratante
    ), m AS (
      INSERT INTO dim_mandato (id_contratante) SELECT id_contratante FROM ct RETURNING id_contratante
    )
    SELECT u.id_usuario, ct.id_contratante FROM u, ct;
  `);
  idUsuario = entidades.id_usuario;
  idContratante = entidades.id_contratante;

  const [contrato] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status, localizador_legado)
    VALUES (${idContratante}, ${idProduto}, CURRENT_DATE - 60, 'ativo', 't3-limiar')
    RETURNING id_contrato;
  `);
  idContrato = contrato.id_contrato;

  await runSql(`
    INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
    VALUES (${idContrato}, ${idUsuario}, 'gestora');

    UPDATE rel_formulario_contrato SET estado = 'aberto', dt_abertura = now() - INTERVAL '40 days'
     WHERE id_contrato = ${idContrato} AND id_formulario = ${idFormulario};

    UPDATE fat_etapa_contrato SET dt_prevista_conclusao = CURRENT_DATE - 5
     WHERE id_contrato = ${idContrato} AND id_etapa = ${idEtapaPontape};

    INSERT INTO fat_encontro (id_contrato, id_tipo_registro, titulo, status, dt_prevista_inicio)
    VALUES (${idContrato}, ${idTipoRegistro}, 'T3 Limiar Encontro Vencido Fixture', 'planejado', now() - INTERVAL '5 days');
  `);

  await runSql(`
    WITH o AS (
      INSERT INTO fat_objetivo_especifico (id_planejamento, descricao)
      SELECT id_planejamento, 'T3 Limiar Objetivo Fixture' FROM dim_planejamento WHERE id_contrato = ${idContrato}
      RETURNING id_objetivo
    ), mt AS (
      INSERT INTO fat_meta (id_objetivo, descricao)
      SELECT id_objetivo, 'T3 Limiar Meta Fixture' FROM o
      RETURNING id_meta
    )
    INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, dt_limite, peso, status)
    SELECT id_meta, 'T3 Limiar Sucesso Mensal Fixture', date_trunc('month', CURRENT_DATE), CURRENT_DATE - 3, 100, 'pendente' FROM mt;
  `);
}, 150000);

afterAll(async () => {
  await runSql(`
    UPDATE ref_limiar_pendencia SET dias = 30, ativo = true WHERE codigo = 'formulario_aberto';
    UPDATE ref_limiar_pendencia SET dias = 45, ativo = true WHERE codigo = 'sem_registro_recente';
    DELETE FROM fat_insight WHERE id_contrato = ${idContrato};
    DELETE FROM fat_fato_gerador WHERE id_contrato = ${idContrato};
    DELETE FROM fat_sucesso_mensal WHERE id_meta IN (SELECT id_meta FROM fat_meta WHERE id_objetivo IN (
      SELECT id_objetivo FROM fat_objetivo_especifico WHERE id_planejamento = (SELECT id_planejamento FROM dim_planejamento WHERE id_contrato = ${idContrato})
    ));
    DELETE FROM fat_meta WHERE id_objetivo IN (
      SELECT id_objetivo FROM fat_objetivo_especifico WHERE id_planejamento = (SELECT id_planejamento FROM dim_planejamento WHERE id_contrato = ${idContrato})
    );
    DELETE FROM fat_objetivo_especifico WHERE id_planejamento = (SELECT id_planejamento FROM dim_planejamento WHERE id_contrato = ${idContrato});
    DELETE FROM fat_encontro WHERE id_contrato = ${idContrato};
    DELETE FROM rel_usuario_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
    DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};
    DELETE FROM dim_mandato WHERE id_contratante = ${idContratante};
    DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};
    DELETE FROM dim_usuario WHERE id_usuario = ${idUsuario};
  `);
}, 150000);

describe("vw_pendencias lê os limiares de ref_limiar_pendencia (EST-06, AD-041)", () => {
  it("AD-004: nenhum literal INTERVAL '<n> days' permanece no corpo da view", async () => {
    const [row] = await runSql<{ definicao: string }>(`
      SELECT pg_get_viewdef('vw_pendencias'::regclass, true) AS definicao;
    `);
    expect(row.definicao).not.toMatch(/interval\s+'[^']*\bday/i);
    expect(row.definicao).not.toContain("30 days");
    expect(row.definicao).not.toContain("45 days");
  });

  it("a view passa a depender de ref_limiar_pendencia", async () => {
    const [row] = await runSql<{ definicao: string }>(`
      SELECT pg_get_viewdef('vw_pendencias'::regclass, true) AS definicao;
    `);
    expect(row.definicao).toContain("ref_limiar_pendencia");

    const dependencias = await runSql<{ tabela: string }>(`
      SELECT DISTINCT cl.relname AS tabela
        FROM pg_depend d
        JOIN pg_rewrite rw ON rw.oid = d.objid
        JOIN pg_class cl   ON cl.oid = d.refobjid
       WHERE rw.ev_class = 'vw_pendencias'::regclass
         AND cl.relname = 'ref_limiar_pendencia';
    `);
    expect(dependencias).toHaveLength(1);
  });

  it("security_invoker = true preservado pelo refactor", async () => {
    const rows = await runSql<{ reloptions: string[] }>(`
      SELECT reloptions FROM pg_class WHERE relname = 'vw_pendencias';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].reloptions).toContain("security_invoker=true");
  });

  it("a fixture exercita as 6 categorias -- a comparação de não-regressão não é vazia", async () => {
    const rows = await runSql<{ categoria: string }>(`
      SELECT DISTINCT categoria FROM vw_pendencias WHERE id_contrato = ${idContrato} ORDER BY categoria;
    `);
    expect(rows.map((r) => r.categoria)).toEqual([
      "cadastro",
      "encontro_vencido",
      "etapa_atrasada",
      "formulario_aberto",
      "sem_registro_recente",
      "sucesso_mensal_atrasado",
    ]);
  });

  it("não-regressão: com o seed padrão a view refatorada devolve exatamente as mesmas linhas da definição anterior, em todo o banco", async () => {
    const [row] = await runSql<{
      so_na_nova: number;
      so_na_legada: number;
      total_nova: number;
    }>(`
      WITH legado AS (${DEFINICAO_LEGADA})
      SELECT
        (SELECT count(*) FROM (SELECT * FROM vw_pendencias EXCEPT ALL SELECT * FROM legado) a) AS so_na_nova,
        (SELECT count(*) FROM (SELECT * FROM legado EXCEPT ALL SELECT * FROM vw_pendencias) b) AS so_na_legada,
        (SELECT count(*) FROM vw_pendencias) AS total_nova;
    `);
    expect(row.so_na_nova).toBe(0);
    expect(row.so_na_legada).toBe(0);
    expect(row.total_nova).toBeGreaterThan(0);
  });

  it("EST-06: subir o limiar 'formulario_aberto' acima dos 40 dias em aberto tira a linha da view, sem deploy", async () => {
    try {
      const antes = await runSql<{ id_contrato: number }>(`
        SELECT id_contrato FROM vw_pendencias
         WHERE id_contrato = ${idContrato} AND categoria = 'formulario_aberto';
      `);
      expect(antes).toHaveLength(1);

      await runSql(`UPDATE ref_limiar_pendencia SET dias = 50 WHERE codigo = 'formulario_aberto';`);
      const depois = await runSql<{ id_contrato: number }>(`
        SELECT id_contrato FROM vw_pendencias
         WHERE id_contrato = ${idContrato} AND categoria = 'formulario_aberto';
      `);
      expect(depois).toHaveLength(0);
    } finally {
      await runSql(`UPDATE ref_limiar_pendencia SET dias = 30 WHERE codigo = 'formulario_aberto';`);
    }

    const restaurado = await runSql<{ id_contrato: number }>(`
      SELECT id_contrato FROM vw_pendencias
       WHERE id_contrato = ${idContrato} AND categoria = 'formulario_aberto';
    `);
    expect(restaurado).toHaveLength(1);
  });

  it("EST-06: subir o limiar 'sem_registro_recente' acima dos 60 dias do contrato tira a linha da view, sem deploy", async () => {
    try {
      const antes = await runSql<{ id_contrato: number }>(`
        SELECT id_contrato FROM vw_pendencias
         WHERE id_contrato = ${idContrato} AND categoria = 'sem_registro_recente';
      `);
      expect(antes).toHaveLength(1);

      await runSql(`UPDATE ref_limiar_pendencia SET dias = 70 WHERE codigo = 'sem_registro_recente';`);
      const depois = await runSql<{ id_contrato: number }>(`
        SELECT id_contrato FROM vw_pendencias
         WHERE id_contrato = ${idContrato} AND categoria = 'sem_registro_recente';
      `);
      expect(depois).toHaveLength(0);
    } finally {
      await runSql(`UPDATE ref_limiar_pendencia SET dias = 45 WHERE codigo = 'sem_registro_recente';`);
    }

    const restaurado = await runSql<{ id_contrato: number }>(`
      SELECT id_contrato FROM vw_pendencias
       WHERE id_contrato = ${idContrato} AND categoria = 'sem_registro_recente';
    `);
    expect(restaurado).toHaveLength(1);
  });

  it("baixar o limiar 'formulario_aberto' faz a linha aparecer para um formulário mais novo (o outro lado da fronteira)", async () => {
    // Formulário aberto há 40 dias já aparece com 30; para provar o sentido
    // oposto, sobe-se o limiar a 45 (some) e depois baixa-se a 35 (volta) --
    // sem nenhum deploy entre as duas leituras.
    try {
      await runSql(`UPDATE ref_limiar_pendencia SET dias = 45 WHERE codigo = 'formulario_aberto';`);
      const some = await runSql<{ id_contrato: number }>(`
        SELECT id_contrato FROM vw_pendencias
         WHERE id_contrato = ${idContrato} AND categoria = 'formulario_aberto';
      `);
      expect(some).toHaveLength(0);

      await runSql(`UPDATE ref_limiar_pendencia SET dias = 35 WHERE codigo = 'formulario_aberto';`);
      const volta = await runSql<{ id_contrato: number }>(`
        SELECT id_contrato FROM vw_pendencias
         WHERE id_contrato = ${idContrato} AND categoria = 'formulario_aberto';
      `);
      expect(volta).toHaveLength(1);
    } finally {
      await runSql(`UPDATE ref_limiar_pendencia SET dias = 30 WHERE codigo = 'formulario_aberto';`);
    }
  });

  it("limiar inativo desliga a categoria correspondente, sem afetar as outras", async () => {
    try {
      await runSql(`UPDATE ref_limiar_pendencia SET ativo = false WHERE codigo = 'formulario_aberto';`);
      const rows = await runSql<{ categoria: string }>(`
        SELECT DISTINCT categoria FROM vw_pendencias WHERE id_contrato = ${idContrato} ORDER BY categoria;
      `);
      expect(rows.map((r) => r.categoria)).toEqual([
        "cadastro",
        "encontro_vencido",
        "etapa_atrasada",
        "sem_registro_recente",
        "sucesso_mensal_atrasado",
      ]);
    } finally {
      await runSql(`UPDATE ref_limiar_pendencia SET ativo = true WHERE codigo = 'formulario_aberto';`);
    }
  });
});
