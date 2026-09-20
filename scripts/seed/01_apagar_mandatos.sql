-- =============================================================================
-- Apaga TODOS os mandatos (dim_contratante.tipo_contratante = 'mandato') e tudo
-- que depende deles, respeitando a ordem de FK (a maioria é ON DELETE RESTRICT).
-- Escopado por tipo_contratante = 'mandato': não toca coalizão, diretório
-- partidário, partido, fundação, organização nem bancada.
--
-- NÃO É MIGRATION: só mexe em dados. Roda com
-- `supabase db query --linked --file scripts/seed/01_apagar_mandatos.sql`
-- contra DEV (confira `supabase/.temp/project-ref` antes -- docs/ambientes.md).
-- Produção não recebe seed/limpeza manual.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE t_contratante ON COMMIT DROP AS
  SELECT id_contratante FROM dim_contratante WHERE tipo_contratante = 'mandato';

CREATE TEMP TABLE t_mandato ON COMMIT DROP AS
  SELECT id_mandato FROM dim_mandato WHERE id_contratante IN (SELECT id_contratante FROM t_contratante);

CREATE TEMP TABLE t_contrato ON COMMIT DROP AS
  SELECT id_contrato FROM fat_contrato WHERE id_contratante IN (SELECT id_contratante FROM t_contratante);

CREATE TEMP TABLE t_planejamento ON COMMIT DROP AS
  SELECT id_planejamento FROM dim_planejamento WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);

CREATE TEMP TABLE t_objetivo ON COMMIT DROP AS
  SELECT id_objetivo FROM fat_objetivo_especifico WHERE id_planejamento IN (SELECT id_planejamento FROM t_planejamento);

CREATE TEMP TABLE t_meta ON COMMIT DROP AS
  SELECT id_meta FROM fat_meta WHERE id_objetivo IN (SELECT id_objetivo FROM t_objetivo);

CREATE TEMP TABLE t_sucesso ON COMMIT DROP AS
  SELECT id_sucesso FROM fat_sucesso_mensal WHERE id_meta IN (SELECT id_meta FROM t_meta);

CREATE TEMP TABLE t_encontro ON COMMIT DROP AS
  SELECT id_encontro FROM fat_encontro WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);

CREATE TEMP TABLE t_registro ON COMMIT DROP AS
  SELECT id_registro FROM fat_registro WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);

CREATE TEMP TABLE t_fato_gerador ON COMMIT DROP AS
  SELECT id_fato_gerador FROM fat_fato_gerador WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);

CREATE TEMP TABLE t_insight ON COMMIT DROP AS
  SELECT id_insight FROM fat_insight WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);

CREATE TEMP TABLE t_pre_insight ON COMMIT DROP AS
  SELECT id_pre_insight FROM fat_pre_insight WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);

CREATE TEMP TABLE t_submissao ON COMMIT DROP AS
  SELECT id_submissao FROM fat_submissao WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);

CREATE TEMP TABLE t_gip ON COMMIT DROP AS
  SELECT id_gip FROM fat_gip WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);

-- Folhas da árvore de Incidência (dependem de fato_gerador/insight/pre_insight/registro/meta/sucesso)
DELETE FROM rel_insight_origem
 WHERE id_insight IN (SELECT id_insight FROM t_insight)
    OR id_meta IN (SELECT id_meta FROM t_meta)
    OR id_sucesso IN (SELECT id_sucesso FROM t_sucesso);

DELETE FROM rel_fato_origem
 WHERE id_fato_gerador IN (SELECT id_fato_gerador FROM t_fato_gerador)
    OR id_meta IN (SELECT id_meta FROM t_meta)
    OR id_insight IN (SELECT id_insight FROM t_insight)
    OR id_pre_insight IN (SELECT id_pre_insight FROM t_pre_insight)
    OR id_registro IN (SELECT id_registro FROM t_registro);

DELETE FROM fat_gip_dimensao WHERE id_gip IN (SELECT id_gip FROM t_gip);
DELETE FROM rel_registro_participante WHERE id_registro IN (SELECT id_registro FROM t_registro);
DELETE FROM rel_encontro_participante WHERE id_encontro IN (SELECT id_encontro FROM t_encontro);

-- fat_insight referencia fat_registro (id_registro): apagar antes de fat_registro
DELETE FROM fat_insight WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);
DELETE FROM fat_pre_insight WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);
DELETE FROM fat_fato_gerador WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);
DELETE FROM fat_registro WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);

DELETE FROM fat_resposta_metrica WHERE id_submissao IN (SELECT id_submissao FROM t_submissao);
-- fat_gip referencia fat_submissao: apagar antes
DELETE FROM fat_gip WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);
DELETE FROM fat_submissao WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);

-- fat_registro.id_encontro referencia fat_encontro: fat_registro já foi apagado acima
DELETE FROM fat_encontro WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);

-- Planejamento estratégico, de baixo para cima
DELETE FROM fat_sucesso_mensal WHERE id_meta IN (SELECT id_meta FROM t_meta);
DELETE FROM fat_meta WHERE id_objetivo IN (SELECT id_objetivo FROM t_objetivo);
DELETE FROM fat_objetivo_especifico WHERE id_planejamento IN (SELECT id_planejamento FROM t_planejamento);
DELETE FROM rel_planejamento_preditor WHERE id_planejamento IN (SELECT id_planejamento FROM t_planejamento);
DELETE FROM dim_planejamento WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);

-- Resto do que pendura em fat_contrato
DELETE FROM fat_artefato WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);
DELETE FROM fat_etapa_contrato WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);
DELETE FROM convite_contrato WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);
DELETE FROM rel_usuario_contrato WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);
DELETE FROM rel_coalizao_membro WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);
DELETE FROM rel_formulario_contrato WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);

DELETE FROM fat_prospeccao
 WHERE id_contratante IN (SELECT id_contratante FROM t_contratante)
    OR id_contrato_gerado IN (SELECT id_contrato FROM t_contrato);

-- fat_contrato tem FK nela mesma (id_contrato_anterior): quebra a corrente antes de apagar
UPDATE fat_contrato SET id_contrato_anterior = NULL
 WHERE id_contrato_anterior IN (SELECT id_contrato FROM t_contrato);
DELETE FROM fat_contrato WHERE id_contrato IN (SELECT id_contrato FROM t_contrato);

DELETE FROM rel_mandato_candidatura WHERE id_mandato IN (SELECT id_mandato FROM t_mandato);
DELETE FROM rel_mandato_agenda_tematica WHERE id_mandato IN (SELECT id_mandato FROM t_mandato);
DELETE FROM dim_mandato WHERE id_contratante IN (SELECT id_contratante FROM t_contratante);
DELETE FROM dim_contratante WHERE id_contratante IN (SELECT id_contratante FROM t_contratante);

COMMIT;
