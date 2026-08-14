-- =============================================================================
-- formularios-produto: T4 -- app.trg_extrai_metricas() (verbatim
-- docs/schema_sistema.sql:1836-1856, AD-008) + SECURITY DEFINER SET
-- search_path = public, pg_temp (conforma AD-035 -- ver design.md "Risks &
-- Concerns": a função verbatim é SECURITY INVOKER implícito e escreve em
-- fat_resposta_metrica, onde Mentor/Assessor não têm GRANT direto; sem
-- SECURITY DEFINER, qualquer envio deles com métrica ativa quebraria com
-- 42501 no meio do próprio INSERT/UPDATE, mesma classe de bug já corrigida em
-- planejamento-planilha-monitoramento).
--
-- SPEC_DEVIATION (achado ao escrever os testes de T4, Done-when "Formulário
-- fechado bloqueia INSERT" / "Contrato encerrado bloqueia INSERT novo"):
-- design.md especifica o texto da p_por_contrato de fat_submissao (T2, já
-- aplicada) só com a cláusula de autoria -- mas o Error Handling Strategy do
-- mesmo design.md ("RLS nega fat_submissao (formulário fechado...)") e
-- spec.md (P1 AC9, AC13, FRM-09/FRM-13, Edge Cases "Concurrency/ordering")
-- exigem que a escrita falhe quando `rel_formulario_contrato.estado <>
-- 'aberto'` ou `fat_contrato.status <> 'ativo'`. Nenhuma das duas tabelas
-- tinha esse texto porque design.md nunca soletrou o SQL exato dessa cláusula
-- (só a prosa). Migrations são forward-only (não se edita a policy já
-- aplicada em T2 no próprio arquivo) -- por isso o ajuste mínimo entra aqui,
-- via ALTER POLICY, no mesmo commit que os testes que o exigem. Admin/Gestora
-- continuam com bypass total (mesmo padrão já usado em toda cláusula desta
-- policy) -- a régua de estado só recai sobre quem não é admin/gestora.
-- =============================================================================

ALTER POLICY p_por_contrato ON fat_submissao
  USING (app.papel_atual() IN ('admin','gestora')
         OR id_contrato = ANY(app.contratos_do_usuario()))
  WITH CHECK ((app.papel_atual() IN ('admin','gestora')
         OR id_contrato = ANY(app.contratos_do_usuario()))
         AND (id_usuario_respondente = app.id_usuario()
              OR app.papel_atual() IN ('admin','gestora'))
         AND (app.papel_atual() IN ('admin','gestora')
              OR (
                EXISTS (
                  SELECT 1 FROM rel_formulario_contrato rfc
                   WHERE rfc.id_contrato = fat_submissao.id_contrato
                     AND rfc.id_formulario = fat_submissao.id_formulario
                     AND rfc.estado = 'aberto'
                )
                AND EXISTS (
                  SELECT 1 FROM fat_contrato c
                   WHERE c.id_contrato = fat_submissao.id_contrato
                     AND c.status = 'ativo'
                )
              )));

-- --- Extração de métricas do JSONB ------------------------------------------
-- docs/schema_sistema.sql:1833-1856. O JSONB continua sendo a verdade da
-- resposta; a tabela normalizada é a superfície de agregação.
CREATE OR REPLACE FUNCTION app.trg_extrai_metricas() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM fat_resposta_metrica WHERE id_submissao = NEW.id_submissao;

  INSERT INTO fat_resposta_metrica (id_submissao, id_metrica, valor_num, valor_bool)
  SELECT NEW.id_submissao,
         rm.id_metrica,
         CASE WHEN rm.tipo <> 'booleano' THEN (NEW.respostas ->> rm.codigo_campo)::NUMERIC END,
         CASE WHEN rm.tipo  = 'booleano' THEN (NEW.respostas ->> rm.codigo_campo)::BOOLEAN END
    FROM ref_metrica_formulario rm
   WHERE rm.id_formulario = NEW.id_formulario
     AND rm.ativo
     AND NEW.respostas ? rm.codigo_campo
     AND NULLIF(btrim(NEW.respostas ->> rm.codigo_campo), '') IS NOT NULL;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_submissao_metricas
  AFTER INSERT OR UPDATE OF respostas ON fat_submissao
  FOR EACH ROW EXECUTE FUNCTION app.trg_extrai_metricas();

COMMENT ON FUNCTION app.trg_extrai_metricas() IS
'O cast falha de propósito se uma pergunta declarada como métrica receber texto: métrica declarada que não é número é erro de configuração do formulário, e é melhor descobrir na escrita do que num painel silenciosamente vazio.';
