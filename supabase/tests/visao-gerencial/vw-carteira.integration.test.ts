import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/visao-gerencial-g1-g2/spec.md, P1 "vw_carteira
// reduzida (AD-032)" AC1/AC2 + tasks.md T4 Done-when -- migração:
// 20260812175507_visao_gerencial_vw_carteira.sql.
//
//  - View criada com as colunas do design.md (sem iip_provisorio/nr_fatos/
//    dt_ultimo_registro)
//  - CREATE VIEW roda sem erro (sem depender de mv_iip_contrato/fat_registro)
//    -- já demonstrado pelo `supabase db push` desta migração; aqui a
//    existência da view + shape de colunas prova o mesmo indiretamente
//  - Fixture real (1 vínculo + 1 contrato ativo) retorna a linha esperada
//
// Estendido por incidencia-encontros T15 (.specs/features/incidencia-encontros/
// tasks.md, INC-06) -- migração 20260813194335_incidencia_encontros_vw_carteira_completa.sql
// SUBSTITUI a vw_carteira reduzida pela versão completa aprovada (spec.md AC8),
// resolvendo AD-032: iip_provisorio/nr_fatos/dt_ultimo_registro agora EXISTEM.
// A asserção original "as 3 colunas NÃO existem" era o estado ANTES desta
// feature -- correta até T9, incorreta a partir dele (T9 já as adicionou);
// o título e as colunas esperadas abaixo foram atualizados para o estado
// atual (verbatim docs/schema_sistema.sql:1327-1352), sem remover nenhuma das
// asserções de fixture já existentes no arquivo.

const COLUNAS_ESPERADAS = [
  "atingimento_desatualizado",
  "dt_ultimo_registro",
  "etapa_atual",
  "id_contrato",
  "id_usuario",
  "iip_provisorio",
  "nome_contratante",
  "nome_produto",
  "nome_projeto",
  "nr_fatos",
  "papel_no_contrato",
  "pct_atingimento",
  "status",
].sort();

describe("visao-gerencial-g1-g2 T4 + incidencia-encontros T15 -- vw_carteira completa (GG-01, AD-032 resolvida)", () => {
  it("expõe exatamente as colunas esperadas -- iip_provisorio/nr_fatos/dt_ultimo_registro existem (AD-032 resolvida)", async () => {
    const rows = await runSql<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'vw_carteira';
    `);
    const colunas = rows.map((r) => r.column_name).sort();
    expect(colunas).toEqual(COLUNAS_ESPERADAS);
  });

  describe("fixture: 1 vínculo (gestora) + 1 contrato ativo", () => {
    let idContratante: number;
    let idContrato: number;
    let idUsuario: number;

    beforeAll(async () => {
      const [{ id_usuario }] = await runSql<{ id_usuario: number }>(`
        INSERT INTO dim_usuario (email, nome, papel_global, ativo)
        VALUES ('gg-t4-vw-carteira@legislabrasil.test', 'GG T4 Gestora Fixture', 'gestora', true)
        ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
        RETURNING id_usuario;
      `);
      idUsuario = id_usuario;

      const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'GG T4 Contratante Fixture')
        RETURNING id_contratante;
      `);
      idContratante = id_contratante;

      const [{ id_contrato }] = await runSql<{ id_contrato: number }>(`
        INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
        VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
        RETURNING id_contrato;
      `);
      idContrato = id_contrato;

      await runSql(`
        INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
        VALUES (${idContrato}, ${idUsuario}, 'gestora');
      `);
    }, 60000);

    afterAll(async () => {
      await runSql(`DELETE FROM rel_usuario_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`
        DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
        DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
        DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
      `);
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
      await runSql(`DELETE FROM dim_usuario WHERE id_usuario = ${idUsuario};`);
    }, 60000);

    it("retorna a linha esperada para o vínculo ativo do contrato ativo", async () => {
      const rows = await runSql<{
        id_usuario: number;
        papel_no_contrato: string;
        id_contrato: number;
        nome_contratante: string;
        nome_produto: string;
        status: string;
        etapa_atual: string | null;
        pct_atingimento: number | null;
        iip_provisorio: string | null;
        nr_fatos: number | null;
        dt_ultimo_registro: string | null;
      }>(`
        SELECT id_usuario, papel_no_contrato, id_contrato, nome_contratante, nome_produto, status, etapa_atual, pct_atingimento,
               iip_provisorio, nr_fatos, dt_ultimo_registro
          FROM vw_carteira WHERE id_contrato = ${idContrato};
      `);
      expect(rows).toHaveLength(1);
      expect(rows[0].id_usuario).toBe(idUsuario);
      expect(rows[0].papel_no_contrato).toBe("gestora");
      expect(rows[0].nome_contratante).toBe("GG T4 Contratante Fixture");
      expect(rows[0].nome_produto).toBe("Estratégia");
      expect(rows[0].status).toBe("ativo");
      expect(rows[0].etapa_atual).toBeNull(); // id_etapa_atual ainda NULL, sem transição de Kanban
      expect(rows[0].pct_atingimento).toBeNull(); // dim_planejamento nasce com pct_atingimento NULL (RGI-03)
      // incidencia-encontros T15 (INC-06): este contrato não tem nenhum
      // fat_fato_gerador/fat_registro -- as 3 colunas novas devem ser NULL,
      // nunca 0 (AD-005, spec.md Edge Case "contrato sem Fato Gerador").
      expect(rows[0].iip_provisorio).toBeNull();
      expect(rows[0].nr_fatos).toBeNull();
      expect(rows[0].dt_ultimo_registro).toBeNull();
    });
  });

  // incidencia-encontros T15 (INC-06) -- valor REAL (não NULL) das 3 colunas
  // novas. Também é o "Independent Test" de spec.md P1 "Fato Gerador
  // validado por Tipologia + cálculo do IIP": "roda o refresh de
  // mv_iip_contrato, confirma que vw_carteira (versão completa) retorna
  // nr_fatos = 1 e iip_provisorio não nulo para aquele contrato".
  //
  // ref_indicador/ref_tipologia de teste (não é dado de negócio -- CAT-16
  // segue sem levantamento real, Assumption #1b; toda ref_tipologia seedada
  // aprovada continua com id_indicador NULL). Fixture própria, isolada,
  // removida no afterAll -- mesmo padrão de "fixture própria de ref_etapa"
  // em supabase/tests/visao-gerencial/peso-etapa-estrutura.integration.test.ts.
  describe("fixture: 1 vínculo (gestora) + Fatos Geradores reais + Registro real (iip_provisorio/nr_fatos/dt_ultimo_registro não nulos)", () => {
    let idContratante: number;
    let idContrato: number;
    let idUsuario: number;
    let idIndicador: number;
    let idTipologia: number;
    let idTipoRegistro: number;

    beforeAll(async () => {
      const [{ id_usuario }] = await runSql<{ id_usuario: number }>(`
        INSERT INTO dim_usuario (email, nome, papel_global, ativo)
        VALUES ('inc-t15-vw-carteira@legislabrasil.test', 'INC T15 Gestora Fixture', 'gestora', true)
        ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
        RETURNING id_usuario;
      `);
      idUsuario = id_usuario;

      const [{ id_contratante }] = await runSql<{ id_contratante: number }>(`
        INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'INC T15 Contratante Fixture')
        RETURNING id_contratante;
      `);
      idContratante = id_contratante;

      const [{ id_contrato }] = await runSql<{ id_contrato: number }>(`
        INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
        VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
        RETURNING id_contrato;
      `);
      idContrato = id_contrato;

      await runSql(`
        INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
        VALUES (${idContrato}, ${idUsuario}, 'gestora');
      `);

      const [{ id_indicador }] = await runSql<{ id_indicador: number }>(`
        INSERT INTO ref_indicador (nome, peso_iip) VALUES ('INC T15 Indicador Teste', 100)
        RETURNING id_indicador;
      `);
      idIndicador = id_indicador;

      const [{ id_tipologia }] = await runSql<{ id_tipologia: number }>(`
        INSERT INTO ref_tipologia (grupo, tipologia, estado, id_indicador)
        VALUES ('INC T15 Grupo Teste', 'INC T15 Tipologia Teste', 'INC T15 Estado Teste', ${idIndicador})
        RETURNING id_tipologia;
      `);
      idTipologia = id_tipologia;

      // fato 1: nivel_d1='baixo' (valor 1) -> componente = 1*100/100 = 1.
      // fato 2: nivel_d1='alto'  (valor 3) -> componente = 3*100/100 = 3.
      // iip_provisorio esperado = 1 + 3 = 4; nr_fatos esperado = 2.
      await runSql(`
        INSERT INTO fat_fato_gerador (id_contrato, id_tipologia, nivel_d1, dt_ocorrencia) VALUES
          (${idContrato}, ${idTipologia}, 'baixo', '2026-08-01'),
          (${idContrato}, ${idTipologia}, 'alto', '2026-08-05');
      `);

      idTipoRegistro = (
        await runSql<{ id_tipo_registro: number }>(`
        SELECT tr.id_tipo_registro FROM ref_tipo_registro tr
          JOIN ref_etapa e ON e.id_etapa = tr.id_etapa
          JOIN ref_produto p ON p.id_produto = e.id_produto
         WHERE p.nome = 'Estratégia' AND tr.codigo = 'monitoramento';
      `)
      )[0].id_tipo_registro;

      // 2 registros em datas diferentes -- dt_ultimo_registro deve escolher o MAX.
      await runSql(`
        INSERT INTO fat_registro (id_contrato, id_tipo_registro, ocorrido_em, id_usuario_autor) VALUES
          (${idContrato}, ${idTipoRegistro}, '2026-08-01T10:00:00Z', ${idUsuario}),
          (${idContrato}, ${idTipoRegistro}, '2026-08-10T10:00:00Z', ${idUsuario});
      `);

      await runSql(`SELECT app.atualiza_iip_contrato();`);
    }, 60000);

    afterAll(async () => {
      await runSql(`DELETE FROM fat_registro WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM fat_fato_gerador WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM ref_tipologia WHERE id_tipologia = ${idTipologia};`);
      await runSql(`DELETE FROM ref_indicador WHERE id_indicador = ${idIndicador};`);
      await runSql(`DELETE FROM rel_usuario_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`
        DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idContrato};
        DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idContrato};
        DELETE FROM dim_planejamento WHERE id_contrato = ${idContrato};
      `);
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idContrato};`);
      await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
      await runSql(`DELETE FROM log_auditoria WHERE id_usuario = ${idUsuario} OR id_usuario_impersonado = ${idUsuario};`);
      await runSql(`DELETE FROM dim_usuario WHERE id_usuario = ${idUsuario};`);
    }, 60000);

    it("nr_fatos=2, iip_provisorio=4 (fórmula verbatim) e dt_ultimo_registro=MAX(ocorrido_em)", async () => {
      const rows = await runSql<{
        nr_fatos: number | null;
        iip_provisorio: string | null;
        dt_ultimo_registro: string | null;
      }>(`
        SELECT nr_fatos, iip_provisorio, dt_ultimo_registro FROM vw_carteira WHERE id_contrato = ${idContrato};
      `);
      expect(rows).toHaveLength(1);
      expect(rows[0].nr_fatos).toBe(2);
      expect(rows[0].iip_provisorio).not.toBeNull();
      expect(Number(rows[0].iip_provisorio)).toBe(4);
      expect(rows[0].dt_ultimo_registro).not.toBeNull();
      expect(new Date(rows[0].dt_ultimo_registro as string).toISOString()).toBe(new Date("2026-08-10T10:00:00Z").toISOString());
    });
  });
});
