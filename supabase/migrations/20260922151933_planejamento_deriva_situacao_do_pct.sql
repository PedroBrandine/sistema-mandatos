-- =============================================================================
-- Bug relatado pelo Pedro (2026-09-22): editar o % de Atingimento direto na
-- grade (PlanejamentoGrade/CelulaPct) nunca muda a Situação do Sucesso
-- Mensal, nem colado em faixa. A derivação só existia no frontend
-- (sucesso-mensal-form.tsx:derivaSituacao, T8/PF-02), e só roda quando a
-- edição passa pelo modal "Detalhes" -- os outros três caminhos de escrita de
-- pct_atingimento (handleEdicaoCelula/UPDATE direto na grade,
-- app.atualiza_sucessos_mensais_lote/colar em faixa e aplicar em massa, e
-- app.cria_sucessos_mensais_lote) nunca tocavam em `status`. Resultado:
-- Situação ficava dessincronizada do % sempre que a edição não passasse pelo
-- modal -- exatamente o bug original de PF-02, reaberto pelos caminhos que
-- T8 não cobriu.
--
-- Em vez de duplicar `derivaSituacao` em mais três lugares (handleEdicaoCelula
-- e handleColarFaixa em page.tsx, e dentro da RPC de lote), a derivação sobe
-- pro único ponto por onde TODA escrita de pct_atingimento passa: a própria
-- tabela. BEFORE ROW, não AFTER STATEMENT como as triggers de
-- atingimento_desatualizado (20260812145917) -- esta precisa reescrever
-- NEW.status antes do INSERT/UPDATE persistir, não reagir depois.
--
-- Mesma regra de sucesso-mensal-form.tsx: >=100 é 'realizado', qualquer outro
-- valor (inclusive NULL, sem medição ainda) é 'pendente'. 'nao_realizado'
-- nunca foi alcançável por nenhuma tela em produção (SucessoMensalFormCriar
-- fixa 'pendente' e não desenha Select de status -- ver comentário em
-- sucesso-mensal-form.tsx), então recalcular em toda escrita não tira
-- capacidade nenhuma do usuário.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.trg_deriva_situacao_sm() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.status := CASE WHEN NEW.pct_atingimento >= 100 THEN 'realizado' ELSE 'pendente' END;
  RETURN NEW;
END $$;

-- "OF pct_atingimento" só restringe o UPDATE (INSERT sempre dispara) -- uma
-- edição de peso/descrição/prazo que não toque em pct_atingimento não deve
-- reescrever Situação por baixo do usuário.
CREATE TRIGGER trg_sm_deriva_situacao BEFORE INSERT OR UPDATE OF pct_atingimento ON fat_sucesso_mensal
  FOR EACH ROW EXECUTE FUNCTION app.trg_deriva_situacao_sm();
