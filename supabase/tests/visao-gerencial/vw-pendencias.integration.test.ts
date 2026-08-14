import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: .specs/features/visao-gerencial-g3-g6/spec.md, P3 "Bloco 3 --
// Gargalos" AC1 + Edge Cases ("contrato de Coalizão... categoria cadastro
// SHALL simplesmente não gerar linha") + tasks.md T1 Done-when (GER-19) --
// migração: 20260814162237_visao_gerencial_vw_pendencias.sql.
//
//  - security_invoker = true
//  - as 6 categorias aparecem quando o dado-gatilho existe e não aparecem
//    quando não existe (1 par de casos positivo/negativo por categoria)
//  - contrato de Coalizão (sem dim_mandato) nunca gera linha 'cadastro'
//  - GRANT correto: legisla_app/admin/gestora têm SELECT; legisla_mentor/
//    assessor NÃO têm (tela 403-gated pra eles, GER-01 -- diferente do
//    padrão de vw_carteira/vw_carteira_ponderada/vw_ciclo_etapa)
//
// Trigger AFTER INSERT em fat_contrato (trg_fat_contrato_instancia,
// operacao-regua-instanciacao) já cria fat_etapa_contrato/dim_planejamento/
// rel_formulario_contrato (estado='fechado') pra todo contrato novo -- os
// testes abaixo fazem UPDATE explícito onde precisam do estado 'aberto'/
// atrasado, e limpam essas linhas geradas automaticamente no afterAll (mesmo
// achado documentado em .specs/STATE.md, handoff de convite-contrato).

let idProdutoEstrategia: number;
let idEtapaPontape: number;
let idUsuario: number;
let idContratanteMandato: number;
let idContratanteCoalizao: number;
let idContratoAtivo: number;
let idContratoCoalizao: number;
let idTipoRegistroMonitoramento: number;
let idFormulario: number;

// Catálogos + fixture inteira reduzidos ao mínimo de chamadas a runSql() --
// cada chamada spawna um processo `supabase db query --linked` novo (custo
// fixo de vários segundos por round trip contra a Management API, banco de
// dev compartilhado por múltiplas sessões em paralelo agora). A 1ª versão
// desta fixture fazia 16 chamadas sequenciais no beforeAll e estourou o
// hookTimeout de 120s numa execução real -- consolidada via WITH/CTE e
// statements múltiplos por chamada (mesmo padrão já usado em
// vw-ciclo-etapa.integration.test.ts), agora em 5 chamadas.
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
  idProdutoEstrategia = catalogo.id_produto;
  idEtapaPontape = catalogo.id_etapa_pontape;
  idTipoRegistroMonitoramento = catalogo.id_tipo_registro;
  idFormulario = catalogo.id_formulario;

  // dim_mandato só existe para o contratante 'mandato' -- é o que garante,
  // por construção, que o contratante 'coalizao' nunca gera linha 'cadastro'.
  const [entidades] = await runSql<{
    id_usuario: number;
    id_contratante_mandato: number;
    id_contratante_coalizao: number;
  }>(`
    WITH u AS (
      INSERT INTO dim_usuario (email, nome, papel_global, ativo)
      VALUES ('gg3-t1-vw-pendencias@legislabrasil.test', 'GG3 T1 Gestora Fixture', 'gestora', true)
      ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id_usuario
    ), ctm AS (
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('mandato', 'GG3 T1 Contratante Mandato Fixture')
      RETURNING id_contratante
    ), ctc AS (
      INSERT INTO dim_contratante (tipo_contratante, nome) VALUES ('coalizao', 'GG3 T1 Contratante Coalizao Fixture')
      RETURNING id_contratante
    ), m AS (
      INSERT INTO dim_mandato (id_contratante) SELECT id_contratante FROM ctm RETURNING id_contratante
    )
    SELECT u.id_usuario, ctm.id_contratante AS id_contratante_mandato, ctc.id_contratante AS id_contratante_coalizao
    FROM u, ctm, ctc;
  `);
  idUsuario = entidades.id_usuario;
  idContratanteMandato = entidades.id_contratante_mandato;
  idContratanteCoalizao = entidades.id_contratante_coalizao;

  // idContratoAtivo: dt_inicio 60 dias atrás (usado pelas asserções de
  // dias_em_aberto de cadastro/sem_registro_recente). idContratoCoalizao:
  // dt_inicio = hoje -- o trigger de instanciação agenda dt_prevista_conclusao
  // de TODAS as etapas de forma cumulativa a partir de dt_inicio; com 60 dias
  // atrás, várias etapas estariam "naturalmente" atrasadas, contaminando os
  // casos negativos de etapa_atrasada. Com dt_inicio = hoje, nenhuma etapa tem
  // dt_prevista_conclusao no passado.
  const contratos = await runSql<{ id_contrato: number; localizador_legado: string }>(`
    INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status, localizador_legado)
    SELECT ${idContratanteMandato}, ${idProdutoEstrategia}, CURRENT_DATE - 60, 'ativo', 'ativo'
    UNION ALL
    SELECT ${idContratanteCoalizao}, ${idProdutoEstrategia}, CURRENT_DATE, 'ativo', 'coalizao'
    RETURNING id_contrato, localizador_legado;
  `);
  idContratoAtivo = contratos.find((c) => c.localizador_legado === "ativo")!.id_contrato;
  idContratoCoalizao = contratos.find((c) => c.localizador_legado === "coalizao")!.id_contrato;

  await runSql(`
    INSERT INTO rel_usuario_contrato (id_contrato, id_usuario, papel_no_contrato)
    VALUES (${idContratoAtivo}, ${idUsuario}, 'gestora');

    -- Categoria 2 (formulario_aberto): o trigger de instanciação já abriu o
    -- rel_formulario_contrato como 'fechado' -- abrimos explicitamente há 40 dias.
    UPDATE rel_formulario_contrato SET estado = 'aberto', dt_abertura = now() - INTERVAL '40 days'
     WHERE id_contrato = ${idContratoAtivo} AND id_formulario = ${idFormulario};

    -- Categoria 3 (etapa_atrasada): pontape não-concluída com previsão vencida.
    UPDATE fat_etapa_contrato SET dt_prevista_conclusao = CURRENT_DATE - 5
     WHERE id_contrato = ${idContratoAtivo} AND id_etapa = ${idEtapaPontape};

    -- Categoria 4 (encontro_vencido): encontro planejado com data prevista no passado.
    INSERT INTO fat_encontro (id_contrato, id_tipo_registro, titulo, status, dt_prevista_inicio)
    VALUES (${idContratoAtivo}, ${idTipoRegistroMonitoramento}, 'GG3 T1 Encontro Vencido Fixture', 'planejado', now() - INTERVAL '5 days');
  `);

  // Categoria 5 (sem_registro_recente): nenhum fat_registro inserido -- o
  // COALESCE cai no dt_inicio (60 dias atrás), que já é > 45 dias.

  // Categoria 6 (sucesso_mensal_atrasado): planejamento -> objetivo -> meta -> sucesso vencido.
  await runSql(`
    WITH o AS (
      INSERT INTO fat_objetivo_especifico (id_planejamento, descricao)
      SELECT id_planejamento, 'GG3 T1 Objetivo Fixture' FROM dim_planejamento WHERE id_contrato = ${idContratoAtivo}
      RETURNING id_objetivo
    ), mt AS (
      INSERT INTO fat_meta (id_objetivo, descricao)
      SELECT id_objetivo, 'GG3 T1 Meta Fixture' FROM o
      RETURNING id_meta
    )
    INSERT INTO fat_sucesso_mensal (id_meta, descricao, mes_referencia, dt_limite, peso, status)
    SELECT id_meta, 'GG3 T1 Sucesso Mensal Fixture', date_trunc('month', CURRENT_DATE), CURRENT_DATE - 3, 100, 'pendente' FROM mt;
  `);
}, 150000);

afterAll(async () => {
  const contratos = `${idContratoAtivo}, ${idContratoCoalizao}`;
  // Defensivo (mesmo padrão de vw-carteira.integration.test.ts, que também
  // limpa log_auditoria independente de causalidade direta): o banco de dev é
  // compartilhado por múltiplas sessões/features em paralelo agora (.specs/
  // STATE.md, "trabalho paralelo confirmado"). Observado em execução real
  // (múltiplas rodadas de debug desta task): linhas em fat_insight/
  // fat_fato_gerador referenciando este id_contrato apareceram entre a
  // criação da fixture e este afterAll, quebrando o DELETE de fat_contrato
  // por FK -- nenhum teste deste arquivo escreve em nenhuma das duas tabelas
  // (ambas de Incidência).
  await runSql(`
    DELETE FROM fat_insight WHERE id_contrato IN (${contratos});
    DELETE FROM fat_fato_gerador WHERE id_contrato IN (${contratos});
    DELETE FROM fat_sucesso_mensal WHERE id_meta IN (SELECT id_meta FROM fat_meta WHERE id_objetivo IN (
      SELECT id_objetivo FROM fat_objetivo_especifico WHERE id_planejamento = (SELECT id_planejamento FROM dim_planejamento WHERE id_contrato = ${idContratoAtivo})
    ));
    DELETE FROM fat_meta WHERE id_objetivo IN (
      SELECT id_objetivo FROM fat_objetivo_especifico WHERE id_planejamento = (SELECT id_planejamento FROM dim_planejamento WHERE id_contrato = ${idContratoAtivo})
    );
    DELETE FROM fat_objetivo_especifico WHERE id_planejamento = (SELECT id_planejamento FROM dim_planejamento WHERE id_contrato = ${idContratoAtivo});
    DELETE FROM fat_encontro WHERE id_contrato = ${idContratoAtivo};
    DELETE FROM rel_usuario_contrato WHERE id_contrato IN (${contratos});
    DELETE FROM fat_etapa_contrato WHERE id_contrato IN (${contratos});
    DELETE FROM rel_formulario_contrato WHERE id_contrato IN (${contratos});
    DELETE FROM dim_planejamento WHERE id_contrato IN (${contratos});
    DELETE FROM fat_contrato WHERE id_contrato IN (${contratos});
    DELETE FROM dim_mandato WHERE id_contratante = ${idContratanteMandato};
    DELETE FROM dim_contratante WHERE id_contratante IN (${idContratanteMandato}, ${idContratanteCoalizao});
    DELETE FROM dim_usuario WHERE id_usuario = ${idUsuario};
  `);
}, 150000);

describe("visao-gerencial-g3-g6 T1 -- vw_pendencias (GER-19)", () => {
  it("security_invoker = true", async () => {
    const rows = await runSql<{ reloptions: string[] }>(`
      SELECT reloptions FROM pg_class WHERE relname = 'vw_pendencias';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].reloptions).toContain("security_invoker=true");
  });

  it("categoria 'cadastro': contrato de mandato com campos vazios gera 5 linhas (1 por campo)", async () => {
    const rows = await runSql<{ detalhe: string; dt_referencia: string; dias_em_aberto: number }>(`
      SELECT detalhe, dt_referencia, dias_em_aberto FROM vw_pendencias
       WHERE id_contrato = ${idContratoAtivo} AND categoria = 'cadastro'
       ORDER BY detalhe;
    `);
    expect(rows.map((r) => r.detalhe).sort()).toEqual(
      ["confianca", "ds_genero", "ds_raca", "fl_pcd", "titulo_eleitoral"].sort()
    );
    // dt_inicio foi CURRENT_DATE - 60 -- dias_em_aberto deve refletir isso.
    expect(rows[0].dias_em_aberto).toBe(60);
  });

  it("Edge Case: contrato de Coalizão (sem dim_mandato) nunca gera linha 'cadastro'", async () => {
    const rows = await runSql<{ id_contrato: number }>(`
      SELECT id_contrato FROM vw_pendencias WHERE id_contrato = ${idContratoCoalizao} AND categoria = 'cadastro';
    `);
    expect(rows).toHaveLength(0);
  });

  it("categoria 'formulario_aberto': formulário aberto há 40 dias (>30) aparece", async () => {
    const rows = await runSql<{ dias_em_aberto: number }>(`
      SELECT dias_em_aberto FROM vw_pendencias
       WHERE id_contrato = ${idContratoAtivo} AND categoria = 'formulario_aberto';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].dias_em_aberto).toBeGreaterThanOrEqual(40);
  });

  it("categoria 'formulario_aberto': não aparece quando não existe formulário aberto (contrato de Coalizão, todos 'fechado')", async () => {
    const rows = await runSql<{ id_contrato: number }>(`
      SELECT id_contrato FROM vw_pendencias WHERE id_contrato = ${idContratoCoalizao} AND categoria = 'formulario_aberto';
    `);
    expect(rows).toHaveLength(0);
  });

  it("categoria 'etapa_atrasada': etapa não concluída com dt_prevista_conclusao vencida aparece", async () => {
    // Filtra por detalhe = 'pontape' (a etapa manipulada explicitamente no
    // beforeAll) em vez de assumir que é a única atrasada: idContratoAtivo
    // usa dt_inicio = CURRENT_DATE - 60 (necessário pras asserções de
    // cadastro/sem_registro_recente) e o agendamento cumulativo de
    // dt_prevista_conclusao das outras etapas do produto naturalmente também
    // já pode estar vencido depois de 60 dias -- comportamento correto da
    // view, só não é o que esta asserção específica quer verificar.
    const rows = await runSql<{ detalhe: string; dias_em_aberto: number }>(`
      SELECT detalhe, dias_em_aberto FROM vw_pendencias
       WHERE id_contrato = ${idContratoAtivo} AND categoria = 'etapa_atrasada' AND detalhe = 'pontape';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].dias_em_aberto).toBe(5);
  });

  it("categoria 'etapa_atrasada': não aparece quando dt_prevista_conclusao não venceu (contrato de Coalizão)", async () => {
    const rows = await runSql<{ id_contrato: number }>(`
      SELECT id_contrato FROM vw_pendencias WHERE id_contrato = ${idContratoCoalizao} AND categoria = 'etapa_atrasada';
    `);
    expect(rows).toHaveLength(0);
  });

  it("categoria 'encontro_vencido': encontro planejado com dt_prevista_inicio no passado aparece", async () => {
    const rows = await runSql<{ detalhe: string; dias_em_aberto: number }>(`
      SELECT detalhe, dias_em_aberto FROM vw_pendencias
       WHERE id_contrato = ${idContratoAtivo} AND categoria = 'encontro_vencido';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].detalhe).toBe("GG3 T1 Encontro Vencido Fixture");
    expect(rows[0].dias_em_aberto).toBe(5);
  });

  it("categoria 'encontro_vencido': não aparece quando não há encontro planejado vencido (contrato de Coalizão)", async () => {
    const rows = await runSql<{ id_contrato: number }>(`
      SELECT id_contrato FROM vw_pendencias WHERE id_contrato = ${idContratoCoalizao} AND categoria = 'encontro_vencido';
    `);
    expect(rows).toHaveLength(0);
  });

  it("categoria 'sem_registro_recente': contrato ativo sem nenhum fat_registro, dt_inicio > 45 dias, aparece com dt_referencia = dt_inicio", async () => {
    const rows = await runSql<{ dt_referencia: string; dias_em_aberto: number }>(`
      SELECT dt_referencia, dias_em_aberto FROM vw_pendencias
       WHERE id_contrato = ${idContratoAtivo} AND categoria = 'sem_registro_recente';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].dias_em_aberto).toBe(60);
  });

  it("categoria 'sem_registro_recente': não aparece quando dt_inicio é recente (< 45 dias, contrato de Coalizão)", async () => {
    // idContratoCoalizao também nasceu há 60 dias -- então ele TAMBÉM teria essa
    // pendência. Testa o caso negativo com um 3º contrato, recente.
    const [{ id_contrato: idRecente }] = await runSql<{ id_contrato: number }>(`
      INSERT INTO fat_contrato (id_contratante, id_produto, dt_inicio, status)
      VALUES (${idContratanteMandato}, ${idProdutoEstrategia}, CURRENT_DATE - 10, 'ativo')
      RETURNING id_contrato;
    `);
    try {
      const rows = await runSql<{ id_contrato: number }>(`
        SELECT id_contrato FROM vw_pendencias WHERE id_contrato = ${idRecente} AND categoria = 'sem_registro_recente';
      `);
      expect(rows).toHaveLength(0);
    } finally {
      await runSql(`
        DELETE FROM fat_etapa_contrato WHERE id_contrato = ${idRecente};
        DELETE FROM rel_formulario_contrato WHERE id_contrato = ${idRecente};
        DELETE FROM dim_planejamento WHERE id_contrato = ${idRecente};
      `);
      await runSql(`DELETE FROM fat_contrato WHERE id_contrato = ${idRecente};`);
    }
  });

  it("categoria 'sucesso_mensal_atrasado': sucesso pendente com dt_limite vencida aparece", async () => {
    const rows = await runSql<{ detalhe: string; dias_em_aberto: number }>(`
      SELECT detalhe, dias_em_aberto FROM vw_pendencias
       WHERE id_contrato = ${idContratoAtivo} AND categoria = 'sucesso_mensal_atrasado';
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].detalhe).toBe("GG3 T1 Sucesso Mensal Fixture");
    expect(rows[0].dias_em_aberto).toBe(3);
  });

  it("categoria 'sucesso_mensal_atrasado': não aparece quando não há sucesso mensal pendente vencido (contrato de Coalizão)", async () => {
    const rows = await runSql<{ id_contrato: number }>(`
      SELECT id_contrato FROM vw_pendencias WHERE id_contrato = ${idContratoCoalizao} AND categoria = 'sucesso_mensal_atrasado';
    `);
    expect(rows).toHaveLength(0);
  });

  it("id_usuario_gestora/nome_gestora resolvem o vínculo ativo do contrato", async () => {
    const rows = await runSql<{ id_usuario_gestora: number; nome_gestora: string }>(`
      SELECT DISTINCT id_usuario_gestora, nome_gestora FROM vw_pendencias WHERE id_contrato = ${idContratoAtivo};
    `);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.id_usuario_gestora).toBe(idUsuario);
      expect(row.nome_gestora).toBe("GG3 T1 Gestora Fixture");
    }
  });

  it("GRANT: legisla_app/legisla_admin/legisla_gestora têm SELECT; legisla_mentor/legisla_assessor NÃO têm (tela 403-gated, GER-01)", async () => {
    const rows = await runSql<{ role: string; can_select: boolean }>(`
      SELECT r.role, has_table_privilege(r.role, 'vw_pendencias', 'SELECT') AS can_select
        FROM unnest(ARRAY['legisla_app','legisla_admin','legisla_gestora','legisla_mentor','legisla_assessor']) AS r(role);
    `);
    const porRole = Object.fromEntries(rows.map((r) => [r.role, r.can_select]));
    expect(porRole.legisla_app).toBe(true);
    expect(porRole.legisla_admin).toBe(true);
    expect(porRole.legisla_gestora).toBe(true);
    expect(porRole.legisla_mentor).toBe(false);
    expect(porRole.legisla_assessor).toBe(false);
  });
});
