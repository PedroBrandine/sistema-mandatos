-- =============================================================================
-- planejamento-planilha-monitoramento: T4 -- Cascata de atingimento, verbatim
-- (docs/schema_sistema.sql:1476-1525 e :1738-1831). Não redesenhada (AD-008)
-- -- a fórmula já estava aprovada, o spec.md original só não tinha lido esta
-- parte do documento (ver design.md "Achado de Design mais importante").
--
-- app.recalcula_pendentes é extraída por completude (AD-008: texto aprovado
-- não se edita por omissão) mesmo sem consumidor nesta feature -- ver
-- design.md Tech Decisions ("Recálculo"): esta feature chama
-- app.recalcula_atingimento síncrono ao abrir a tela, não via pg_cron.
--
-- Todas SECURITY INVOKER (sem cláusula) -- AD-024 proíbe SECURITY DEFINER em
-- escrita de negócio multi-tabela.
-- =============================================================================

-- Recalcula a cascata inteira em três UPDATEs, sem recursão de trigger.
CREATE OR REPLACE FUNCTION app.recalcula_atingimento(p_id_planejamento BIGINT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Nível 1: Meta = média dos Sucessos Mensais ponderada pelo Peso
  UPDATE fat_meta m
     SET pct_atingimento = s.pct
    FROM (SELECT sm.id_meta,
                 CASE WHEN SUM(sm.peso) > 0
                      THEN ROUND(SUM(sm.peso * COALESCE(sm.pct_atingimento, 0)) / SUM(sm.peso), 2)
                 END AS pct
            FROM fat_sucesso_mensal sm
            JOIN fat_meta mm               ON mm.id_meta = sm.id_meta
            JOIN fat_objetivo_especifico oo ON oo.id_objetivo = mm.id_objetivo
           WHERE oo.id_planejamento = p_id_planejamento
           GROUP BY sm.id_meta) s
   WHERE m.id_meta = s.id_meta;

  -- Nível 2: Objetivo Específico = média das Metas ativas
  UPDATE fat_objetivo_especifico o
     SET pct_atingimento = t.pct
    FROM (SELECT mm.id_objetivo, ROUND(AVG(COALESCE(mm.pct_atingimento, 0)), 2) AS pct
            FROM fat_meta mm
            JOIN fat_objetivo_especifico oo ON oo.id_objetivo = mm.id_objetivo
           WHERE oo.id_planejamento = p_id_planejamento
             AND mm.status = 'ativa'
           GROUP BY mm.id_objetivo) t
   WHERE o.id_objetivo = t.id_objetivo;

  -- Raiz: Planejamento = média dos Objetivos Específicos
  UPDATE dim_planejamento p
     SET pct_atingimento = (SELECT ROUND(AVG(COALESCE(o.pct_atingimento, 0)), 2)
                              FROM fat_objetivo_especifico o
                             WHERE o.id_planejamento = p.id_planejamento),
         atingimento_desatualizado = false,
         atualizado_em = now()
   WHERE p.id_planejamento = p_id_planejamento;
END $$;

-- Job curto de fundo: recalcula só o que foi marcado. Sem consumidor nesta
-- feature (nenhum pg_cron provisionado no projeto) -- extraída por
-- completude do texto aprovado.
CREATE OR REPLACE FUNCTION app.recalcula_pendentes(p_limite INT DEFAULT 200)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_id BIGINT; v_n INT := 0;
BEGIN
  FOR v_id IN SELECT id_planejamento FROM dim_planejamento
               WHERE atingimento_desatualizado ORDER BY atualizado_em LIMIT p_limite LOOP
    PERFORM app.recalcula_atingimento(v_id);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;

-- --- Cascata: marcação em nível de statement, nunca recálculo síncrono -------
-- Duas funções em vez de uma com IF: tabela de transição inexistente num
-- branch não executado é armadilha silenciosa.

CREATE OR REPLACE FUNCTION app.trg_marca_desatualizado_novos() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE dim_planejamento p SET atingimento_desatualizado = true
   WHERE p.id_planejamento IN (
     SELECT DISTINCT o.id_planejamento
       FROM novos n
       JOIN fat_meta m                ON m.id_meta = n.id_meta
       JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo);
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION app.trg_marca_desatualizado_antigos() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE dim_planejamento p SET atingimento_desatualizado = true
   WHERE p.id_planejamento IN (
     SELECT DISTINCT o.id_planejamento
       FROM antigos a
       JOIN fat_meta m                ON m.id_meta = a.id_meta
       JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo);
  RETURN NULL;
END $$;

-- PostgreSQL proíbe AFTER UPDATE OF <colunas> junto com REFERENCING: o filtro
-- de "quais colunas mudaram" desce para dentro da função, comparando as duas
-- tabelas de transição. Fica mais preciso do que a cláusula OF, que dispara
-- mesmo quando o UPDATE grava o mesmo valor.
CREATE OR REPLACE FUNCTION app.trg_marca_desatualizado_upd() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE dim_planejamento p SET atingimento_desatualizado = true
   WHERE p.id_planejamento IN (
     SELECT DISTINCT o.id_planejamento
       FROM novos n
       JOIN antigos a                 ON a.id_sucesso = n.id_sucesso
       JOIN fat_meta m                ON m.id_meta = n.id_meta
       JOIN fat_objetivo_especifico o ON o.id_objetivo = m.id_objetivo
      WHERE n.pct_atingimento IS DISTINCT FROM a.pct_atingimento
         OR n.peso            IS DISTINCT FROM a.peso
         OR n.status          IS DISTINCT FROM a.status
         OR n.id_meta         IS DISTINCT FROM a.id_meta);
  RETURN NULL;
END $$;

CREATE TRIGGER trg_sm_ins AFTER INSERT ON fat_sucesso_mensal
  REFERENCING NEW TABLE AS novos
  FOR EACH STATEMENT EXECUTE FUNCTION app.trg_marca_desatualizado_novos();

CREATE TRIGGER trg_sm_upd AFTER UPDATE ON fat_sucesso_mensal
  REFERENCING NEW TABLE AS novos OLD TABLE AS antigos
  FOR EACH STATEMENT EXECUTE FUNCTION app.trg_marca_desatualizado_upd();

CREATE TRIGGER trg_sm_del AFTER DELETE ON fat_sucesso_mensal
  REFERENCING OLD TABLE AS antigos
  FOR EACH STATEMENT EXECUTE FUNCTION app.trg_marca_desatualizado_antigos();

-- Mudança de status ou de pai da Meta altera a média do Objetivo — nos dois
-- objetivos envolvidos, quando a meta troca de objetivo.
CREATE OR REPLACE FUNCTION app.trg_marca_por_meta_upd() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE dim_planejamento p SET atingimento_desatualizado = true
   WHERE p.id_planejamento IN (
     SELECT DISTINCT o.id_planejamento
       FROM (SELECT n.id_objetivo
               FROM metas_novas n JOIN metas_antigas a ON a.id_meta = n.id_meta
              WHERE n.status IS DISTINCT FROM a.status OR n.id_objetivo IS DISTINCT FROM a.id_objetivo
              UNION
             SELECT a.id_objetivo
               FROM metas_novas n JOIN metas_antigas a ON a.id_meta = n.id_meta
              WHERE n.status IS DISTINCT FROM a.status OR n.id_objetivo IS DISTINCT FROM a.id_objetivo) x
       JOIN fat_objetivo_especifico o ON o.id_objetivo = x.id_objetivo);
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION app.trg_marca_por_meta_ins() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE dim_planejamento p SET atingimento_desatualizado = true
   WHERE p.id_planejamento IN (
     SELECT DISTINCT o.id_planejamento
       FROM metas_novas n
       JOIN fat_objetivo_especifico o ON o.id_objetivo = n.id_objetivo);
  RETURN NULL;
END $$;

CREATE TRIGGER trg_meta_upd AFTER UPDATE ON fat_meta
  REFERENCING NEW TABLE AS metas_novas OLD TABLE AS metas_antigas
  FOR EACH STATEMENT EXECUTE FUNCTION app.trg_marca_por_meta_upd();

CREATE TRIGGER trg_meta_ins AFTER INSERT ON fat_meta
  REFERENCING NEW TABLE AS metas_novas
  FOR EACH STATEMENT EXECUTE FUNCTION app.trg_marca_por_meta_ins();
