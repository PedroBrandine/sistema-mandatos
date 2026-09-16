import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: fatos-geradores-ciclo-vida T5 Done-when
// (.specs/features/fatos-geradores-ciclo-vida/tasks.md), migration
// 20260916164239_incidencia_v2_views_timeline_cadeia.sql --
//  - vw_timeline_incidencia retorna os 4 tipos com data e tipo discriminador
//  - vw_cadeia_incidencia agrupa por origem comum sem persistir "cadeia"
//  - 4 cenários de cadeia (1 fato, N-fatos-origem-comum, direta no fato,
//    só-projetada) + timeline com os 4 tipos + filtro por período
//
// spec.md P1 "Linha do Tempo" AC1/AC3; P2 "Ciclo de Vida com cadeias"
// AC1/AC3/AC4/AC5.

interface Fixture {
  idContratante: number;
  idContrato: number;
}

async function makeFixture(label: string): Promise<Fixture> {
  const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
    INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'FGC T5 ${label}')
    RETURNING id_contratante;
  `);
  const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
    VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
    RETURNING id_contrato;
  `);
  return { idContratante, idContrato };
}

let fixture: Fixture;
let idTipologia: number;
let idUsuario: number;
let idPreInsight: number;
let idRegistro: number;
let idInsightComum: number;
let idFatoOrigemComumA: number;
let idFatoOrigemComumB: number;
let idFatoDireto: number;
let idFatoSoProjetada: number;
const idsFatoCriados: number[] = [];
const idsVinculoCriados: number[] = [];

describe("fatos-geradores-ciclo-vida T5 -- vw_timeline_incidencia + vw_cadeia_incidencia", () => {
  beforeAll(async () => {
    fixture = await makeFixture("A");
    idTipologia = (
      await runSql<{ id_tipologia: number }>(`SELECT id_tipologia FROM ref_tipologia ORDER BY id_tipologia LIMIT 1;`)
    )[0].id_tipologia;
    idUsuario = (await runSql<{ id_usuario: number }>(`SELECT id_usuario FROM dim_usuario ORDER BY id_usuario LIMIT 1;`))[0]
      .id_usuario;
    const idTipoRegistro = (
      await runSql<{ id_tipo_registro: number }>(`SELECT id_tipo_registro FROM ref_tipo_registro ORDER BY id_tipo_registro LIMIT 1;`)
    )[0].id_tipo_registro;

    idPreInsight = (
      await runSql<{ id_pre_insight: number }>(`
        INSERT INTO fat_pre_insight (id_contrato, conteudo, ocorrido_em, id_usuario_autor)
        VALUES (${fixture.idContrato}, 'FGC T5 pre-insight', '2026-08-01', ${idUsuario})
        RETURNING id_pre_insight;
      `)
    )[0].id_pre_insight;

    idRegistro = (
      await runSql<{ id_registro: number }>(`
        INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, resumo, id_usuario_autor)
        VALUES (${fixture.idContrato}, ${idTipoRegistro}, '2026-08-05T10:00:00Z', 'FGC T5 registro', ${idUsuario})
        RETURNING id_registro;
      `)
    )[0].id_registro;

    idInsightComum = (
      await runSql<{ id_insight: number }>(`
        INSERT INTO fat_insight (id_contrato, conteudo, ocorrido_em, id_usuario_autor)
        VALUES (${fixture.idContrato}, 'FGC T5 insight origem comum', '2026-08-10', ${idUsuario})
        RETURNING id_insight;
      `)
    )[0].id_insight;

    // Cenário "N-fatos-origem-comum": 2 fatos gerador ligados ao mesmo insight.
    idFatoOrigemComumA = (
      await runSql<{ id_fato_gerador: number }>(`
        INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, titulo, dt_ocorrencia)
        VALUES (${fixture.idContrato}, ${idTipologia}, 'baixo', 'FGC T5 fato origem comum A', '2026-09-01')
        RETURNING id_fato_gerador;
      `)
    )[0].id_fato_gerador;
    idFatoOrigemComumB = (
      await runSql<{ id_fato_gerador: number }>(`
        INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, titulo, dt_ocorrencia)
        VALUES (${fixture.idContrato}, ${idTipologia}, 'baixo', 'FGC T5 fato origem comum B', '2026-09-02')
        RETURNING id_fato_gerador;
      `)
    )[0].id_fato_gerador;
    idsFatoCriados.push(idFatoOrigemComumA, idFatoOrigemComumB);

    for (const idFato of [idFatoOrigemComumA, idFatoOrigemComumB]) {
      const [{ id_vinculo: idVinculo }] = await runSql<{ id_vinculo: number }>(`
        INSERT INTO rel_fato_origem (id_fato_gerador, id_insight) VALUES (${idFato}, ${idInsightComum})
        RETURNING id_vinculo;
      `);
      idsVinculoCriados.push(idVinculo);
    }

    // Cenário "cadeia direta no fato": sem linha em rel_fato_origem.
    idFatoDireto = (
      await runSql<{ id_fato_gerador: number }>(`
        INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, titulo, dt_ocorrencia)
        VALUES (${fixture.idContrato}, ${idTipologia}, 'baixo', 'FGC T5 fato direto', '2026-09-03')
        RETURNING id_fato_gerador;
      `)
    )[0].id_fato_gerador;
    idsFatoCriados.push(idFatoDireto);

    // Cenário "cadeia só-projetada": fato isolado com situacao='projetado'.
    idFatoSoProjetada = (
      await runSql<{ id_fato_gerador: number }>(`
        INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, titulo, situacao, dt_prevista)
        VALUES (${fixture.idContrato}, ${idTipologia}, 'baixo', 'FGC T5 fato projetado', 'projetado', '2026-12-01')
        RETURNING id_fato_gerador;
      `)
    )[0].id_fato_gerador;
    idsFatoCriados.push(idFatoSoProjetada);
  }, 120000);

  afterAll(async () => {
    if (idsVinculoCriados.length > 0) {
      await runSql(`DELETE FROM rel_fato_origem WHERE id_vinculo IN (${idsVinculoCriados.join(",")});`);
    }
    if (idsFatoCriados.length > 0) {
      await runSql(`DELETE FROM fat_fato_gerador WHERE id_fato_gerador IN (${idsFatoCriados.join(",")});`);
    }
    await runSql(`DELETE FROM fat_insight WHERE id_contrato = ${fixture.idContrato};`);
    await runSql(`DELETE FROM fat_registro WHERE id_contrato = ${fixture.idContrato};`);
    await runSql(`DELETE FROM fat_pre_insight WHERE id_contrato = ${fixture.idContrato};`);
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato = ${fixture.idContrato};
      DELETE FROM rel_formulario_contrato WHERE id_contrato = ${fixture.idContrato};
      DELETE FROM dim_planejamento WHERE id_contrato = ${fixture.idContrato};
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${fixture.idContrato};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${fixture.idContratante};`);
  }, 120000);

  it("vw_timeline_incidencia retorna os 4 tipos do contrato com data e tipo discriminador", async () => {
    const rows = await runSql<{ tipo: string; id_origem: number; data_evento: string }>(`
      SELECT tipo, id_origem, data_evento FROM vw_timeline_incidencia
       WHERE id_contrato = ${fixture.idContrato} ORDER BY tipo;
    `);
    const tipos = new Set(rows.map((r) => r.tipo));
    expect(tipos).toEqual(new Set(["pre_insight", "registro", "insight", "fato_gerador"]));
    for (const row of rows) {
      expect(row.data_evento).not.toBeNull();
    }
  });

  it("vw_timeline_incidencia respeita filtro por período (data_evento dentro do intervalo)", async () => {
    const rows = await runSql<{ tipo: string }>(`
      SELECT tipo FROM vw_timeline_incidencia
       WHERE id_contrato = ${fixture.idContrato}
         AND data_evento BETWEEN '2026-09-01' AND '2026-09-03';
    `);
    // Só os 3 fatos gerador de setembro (origem comum A/B + direto) caem no período -- pre_insight (ago),
    // registro (ago), insight (ago) e o fato projetado (dez, dt_prevista) ficam de fora.
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.tipo === "fato_gerador")).toBe(true);
  });

  it("cadeia com origem comum: 2 fatos ligados ao mesmo insight compartilham chave_origem", async () => {
    const rows = await runSql<{ id_fato_gerador: number; chave_origem: string }>(`
      SELECT id_fato_gerador, chave_origem FROM vw_cadeia_incidencia
       WHERE id_fato_gerador IN (${idFatoOrigemComumA}, ${idFatoOrigemComumB});
    `);
    expect(rows).toHaveLength(2);
    expect(rows[0].chave_origem).toBe(`insight:${idInsightComum}`);
    expect(rows[1].chave_origem).toBe(`insight:${idInsightComum}`);
  });

  it("cadeia direta no fato (sem rel_fato_origem): chave_origem cai no próprio id, isolada das demais", async () => {
    const [row] = await runSql<{ chave_origem: string }>(`
      SELECT chave_origem FROM vw_cadeia_incidencia WHERE id_fato_gerador = ${idFatoDireto};
    `);
    expect(row.chave_origem).toBe(`fato:${idFatoDireto}`);
  });

  it("cadeia de 1 fato: chave_origem do fato direto não é compartilhada por nenhum outro fato do contrato", async () => {
    const rows = await runSql<{ id_fato_gerador: number }>(`
      SELECT id_fato_gerador FROM vw_cadeia_incidencia
       WHERE chave_origem = 'fato:${idFatoDireto}';
    `);
    expect(rows).toHaveLength(1);
  });

  it("cadeia só-projetada: fato isolado com situacao='projetado' aparece na view com a situacao correta", async () => {
    const [row] = await runSql<{ situacao: string; chave_origem: string }>(`
      SELECT situacao, chave_origem FROM vw_cadeia_incidencia WHERE id_fato_gerador = ${idFatoSoProjetada};
    `);
    expect(row.situacao).toBe("projetado");
    expect(row.chave_origem).toBe(`fato:${idFatoSoProjetada}`);
  });
});
