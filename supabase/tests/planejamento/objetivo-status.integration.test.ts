import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: PLV-02 AC1 (.specs/features/planejamento-estrategico-v2/spec.md)
//   "WHEN a migration é aplicada THEN fat_objetivo_especifico SHALL ter
//    status TEXT NOT NULL DEFAULT 'ativo' restrito a ativo | pausado | descartado."
//
// Gênero masculino é decisão registrada (context.md D-1): a Meta usa o feminino
// (ck_meta_status: ativa/pausada/descartada) e o Objetivo NÃO o aceita -- por
// isso 'ativa' entra na lista de valores recusados, e não só um termo qualquer
// fora do conjunto.
//
// "Objetivos preexistentes ficam 'ativo' sem quebrar" (T1) é garantido pelo par
// DEFAULT + NOT NULL: o DEFAULT é exatamente o mecanismo que o ALTER TABLE usa
// para preencher as linhas que já existiam, e o NOT NULL impede que alguma fique
// sem valor. Os dois são exercitados abaixo (default ao inserir sem a coluna;
// 23502 ao tentar gravar NULL explicitamente).

interface Fixture {
  idContratante: number;
  idContrato: number;
  idPlanejamento: number;
}

let f: Fixture;

describe("planejamento-estrategico-v2 -- status no Objetivo Específico (PLV-02 AC1)", () => {
  beforeAll(async () => {
    const [{ id_contratante: idContratante }] = await runSql<{ id_contratante: number }>(`
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'PLV Objetivo Status')
      RETURNING id_contratante;
    `);
    const [{ id_contrato: idContrato }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratante}, (SELECT id_produto FROM ref_produto WHERE nome = 'Estratégia'), CURRENT_DATE, 'ativo')
      RETURNING id_contrato;
    `);
    const [{ id_planejamento: idPlanejamento }] = await runSql<{ id_planejamento: number }>(`
      SELECT id_planejamento FROM dim_planejamento WHERE id_contrato = ${idContrato};
    `);

    f = { idContratante, idContrato, idPlanejamento };
  }, 120000);

  afterAll(async () => {
    await runSql(`
      DELETE FROM fat_etapa_contrato WHERE id_contrato = ${f.idContrato};
      DELETE FROM rel_formulario_contrato WHERE id_contrato = ${f.idContrato};
      DELETE FROM dim_planejamento WHERE id_contrato = ${f.idContrato};
    `);
    await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${f.idContrato};`);
    await runSql(`DELETE FROM dim_contratante WHERE id_contratante = ${f.idContratante};`);
  }, 120000);

  it(
    "AC1: objetivo inserido sem informar status nasce 'ativo' (DEFAULT -- o mesmo que preencheu as linhas preexistentes)",
    async () => {
      const [linha] = await runSql<{ status: string }>(`
        INSERT INTO fat_objetivo_especifico (id_planejamento, descricao)
        VALUES (${f.idPlanejamento}, 'Objetivo sem status explícito')
        RETURNING status;
      `);
      expect(linha.status).toBe("ativo");
    },
    60000
  );

  it(
    "AC1: os 3 valores do conjunto são aceitos e gravados verbatim",
    async () => {
      const linhas = await runSql<{ status: string }>(`
        INSERT INTO fat_objetivo_especifico (id_planejamento, descricao, status)
        VALUES (${f.idPlanejamento}, 'Objetivo ativo', 'ativo'),
               (${f.idPlanejamento}, 'Objetivo pausado', 'pausado'),
               (${f.idPlanejamento}, 'Objetivo descartado', 'descartado')
        RETURNING status;
      `);
      expect(linhas.map((l) => l.status).sort()).toEqual(["ativo", "descartado", "pausado"]);
    },
    60000
  );

  it(
    "AC1: valor fora do conjunto é recusado por ck_objetivo_status (23514) -- inclusive o feminino da Meta",
    async () => {
      for (const invalido of ["ativa", "arquivado"]) {
        await expect(
          runSql(`
            INSERT INTO fat_objetivo_especifico (id_planejamento, descricao, status)
            VALUES (${f.idPlanejamento}, 'Objetivo inválido ${invalido}', '${invalido}');
          `)
        ).rejects.toThrow(/23514|ck_objetivo_status/);
      }
    },
    60000
  );

  it(
    "AC1: status é NOT NULL -- gravar NULL explicitamente é recusado (23502)",
    async () => {
      await expect(
        runSql(`
          INSERT INTO fat_objetivo_especifico (id_planejamento, descricao, status)
          VALUES (${f.idPlanejamento}, 'Objetivo com status nulo', NULL);
        `)
      ).rejects.toThrow(/23502/);
    },
    60000
  );
});
