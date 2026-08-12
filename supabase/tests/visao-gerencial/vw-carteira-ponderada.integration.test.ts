import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/visao-gerencial-g1-g2/spec.md, P1 "G1 --
// carteira ponderada" AC1/AC4 + Edge Cases + tasks.md T5 Done-when
// (GG-05/GG-06) -- migração:
// 20260812175929_visao_gerencial_vw_carteira_ponderada.sql.
//
//  - View criada, security_invoker = true
//  - WHERE c.status = 'ativo'
//  - LEFT JOIN ref_peso_etapa (peso NULL quando falta seed, linha não desaparece)
//  - fixture com 2 contratos ativos em etapas de peso diferente confirma peso
//    correto por linha
//  - fixture com id_etapa_atual IS NULL confirma peso da 1ª etapa (ordem = 1)
//
// Fixtures próprias de ref_etapa/ref_peso_etapa (mesmo padrão de T1) -- 3
// etapas novas em "Estratégia" com ordem fora da faixa real (32200+), pra não
// colidir com o seed aprovado.

let idUsuario: number;
let idContratante: number;
let idEtapaAlto: number;
let idEtapaBaixo: number;
let idEtapaSemPeso: number;
let idProdutoEstrategia: number;
let pesoOrdem1Esperado: string;
const idsContrato: Record<string, number> = {};

beforeAll(async () => {
  const [{ id_usuario, id_contratante }] = await runSql<{ id_usuario: number; id_contratante: number }>(`
    WITH u AS (
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('gg-t5-vw-carteira-ponderada@legislabrasil.test', 'GG T5 Gestora Fixture', 'gestora', true)
      ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id_usuario
    ), ct AS (
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'GG T5 Contratante Fixture')
      RETURNING id_contratante
    )
    SELECT u.id_usuario, ct.id_contratante FROM u, ct;
  `);
  idUsuario = id_usuario;
  idContratante = id_contratante;

  const etapas = await runSql<{ id_etapa: number; codigo: string; id_produto: number }>(`
    WITH p AS (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia')
    INSERT INTO ref_etapa (id_produto, codigo, nome, ordem)
    SELECT p.id_produto, v.codigo, v.nome, v.ordem
      FROM p, (VALUES
        ('fixture_gg_t5_etapa_alto',    'Fixture GG-T5 Etapa Alto Peso',   32200::smallint),
        ('fixture_gg_t5_etapa_baixo',   'Fixture GG-T5 Etapa Baixo Peso',  32201),
        ('fixture_gg_t5_etapa_sempeso', 'Fixture GG-T5 Etapa Sem Peso',    32202)
      ) AS v(codigo, nome, ordem)
    RETURNING id_etapa, codigo, id_produto;
  `);
  idEtapaAlto = etapas.find((e) => e.codigo === "fixture_gg_t5_etapa_alto")!.id_etapa;
  idEtapaBaixo = etapas.find((e) => e.codigo === "fixture_gg_t5_etapa_baixo")!.id_etapa;
  idEtapaSemPeso = etapas.find((e) => e.codigo === "fixture_gg_t5_etapa_sempeso")!.id_etapa;
  idProdutoEstrategia = etapas[0].id_produto;

  await runSql(`
    INSERT INTO ref_peso_etapa (id_etapa, peso) VALUES (${idEtapaAlto}, 10), (${idEtapaBaixo}, 3)
    ON CONFLICT (id_etapa) DO UPDATE SET peso = EXCLUDED.peso;
  `);

  const [{ peso: pesoOrdem1 }] = await runSql<{ peso: string | null }>(`
    SELECT rpe.peso::text AS peso
      FROM ref_etapa e LEFT JOIN ref_peso_etapa rpe ON rpe.id_etapa = e.id_etapa
     WHERE e.id_produto = ${idProdutoEstrategia} AND e.ordem = 1;
  `);
  pesoOrdem1Esperado = pesoOrdem1 as string;

  // localizador_legado carrega o rótulo da fixture pra mapear id_contrato de
  // volta sem depender de ordem de scan do INSERT ... SELECT ... FROM VALUES.
  const contratos = await runSql<{ id_contrato: number; localizador_legado: string }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status, id_etapa_atual, localizador_legado)
    SELECT ${idContratante}, ${idProdutoEstrategia}, CURRENT_DATE, v.status, v.id_etapa_atual, v.label
      FROM (VALUES
        ('alto',            'ativo',     ${idEtapaAlto}::bigint),
        ('baixo',           'ativo',     ${idEtapaBaixo}::bigint),
        ('sem_etapa_atual', 'ativo',     NULL::bigint),
        ('sem_peso',        'ativo',     ${idEtapaSemPeso}::bigint),
        ('inativo',         'concluido', ${idEtapaAlto}::bigint)
      ) AS v(label, status, id_etapa_atual)
    RETURNING id_contrato, localizador_legado;
  `);
  for (const row of contratos) {
    idsContrato[row.localizador_legado] = row.id_contrato;
  }

  await runSql(`
    INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
    SELECT id_contrato, ${idUsuario}, 'gestora' FROM unnest(ARRAY[${Object.values(idsContrato).join(",")}]) AS id_contrato;
  `);
}, 120000);

afterAll(async () => {
  const todosContratos = Object.values(idsContrato).join(",");
  const todasEtapas = [idEtapaAlto, idEtapaBaixo, idEtapaSemPeso].join(",");
  await runSql(`DELETE FROM rel_usuario_contrato WHERE id_contrato = ANY(ARRAY[${todosContratos}]);`);
  // fat_etapa_contrato: cobre tanto as linhas geradas pela instanciação
  // automática dos nossos 5 contratos quanto qualquer linha que uma
  // instanciação concorrente de outro contrato de "Estratégia" tenha gerado
  // apontando pra estas 3 etapas fixture (mesmo achado de T1).
  await runSql(`
    DELETE FROM fat_etapa_contrato WHERE id_contrato = ANY(ARRAY[${todosContratos}]) OR id_etapa = ANY(ARRAY[${todasEtapas}]);
    DELETE FROM rel_formulario_contrato WHERE id_contrato = ANY(ARRAY[${todosContratos}]);
    DELETE FROM dim_planejamento WHERE id_contrato = ANY(ARRAY[${todosContratos}]);
  `);
  await runSql(`DELETE FROM ref_peso_etapa WHERE id_etapa = ANY(ARRAY[${idEtapaAlto}, ${idEtapaBaixo}]);`);
  await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ANY(ARRAY[${todosContratos}]);`);
  await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${idContratante};`);
  await runSql(`DELETE FROM ref_etapa WHERE id_etapa = ANY(ARRAY[${todasEtapas}]);`);
  await runSql(`DELETE FROM dim_usuario WHERE id_usuario = ${idUsuario};`);
}, 120000);

describe("visao-gerencial-g1-g2 T5 -- vw_carteira_ponderada (GG-05, GG-06)", () => {
  it("security_invoker = true", async () => {
    const rows = await runSql<{ reloptions: string[] }>(`
      SELECT reloptions FROM pg_class WHERE relname = 'vw_carteira_ponderada';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].reloptions).toContain("security_invoker=true");
  });

  it("resolve o peso correto por linha para 2 contratos em etapas de peso diferente", async () => {
    const rows = await runSql<{ id_contrato: number; peso: string | null }>(`
      SELECT id_contrato, peso FROM vw_carteira_ponderada
       WHERE id_contrato IN (${idsContrato.alto}, ${idsContrato.baixo});
    `);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id_contrato === idsContrato.alto)?.peso).toBe("10.00");
    expect(rows.find((r) => r.id_contrato === idsContrato.baixo)?.peso).toBe("3.00");
  });

  it("id_etapa_atual IS NULL resolve o peso da 1ª etapa do produto (ordem = 1)", async () => {
    const rows = await runSql<{ peso: string | null }>(`
      SELECT peso FROM vw_carteira_ponderada WHERE id_contrato = ${idsContrato.sem_etapa_atual};
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].peso).toBe(pesoOrdem1Esperado);
  });

  it("lacuna de seed em ref_peso_etapa: LEFT JOIN preserva a linha com peso NULL (não desaparece)", async () => {
    const rows = await runSql<{ id_contrato: number; peso: string | null }>(`
      SELECT id_contrato, peso FROM vw_carteira_ponderada WHERE id_contrato = ${idsContrato.sem_peso};
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].peso).toBeNull();
  });

  it("WHERE c.status = 'ativo': contrato não-ativo não aparece na view", async () => {
    const rows = await runSql<{ id_contrato: number }>(`
      SELECT id_contrato FROM vw_carteira_ponderada WHERE id_contrato = ${idsContrato.inativo};
    `);
    expect(rows).toHaveLength(0);
  });
});
