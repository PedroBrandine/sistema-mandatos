-- =============================================================================
-- redesenho-estrategia-tela-first (.specs/features/redesenho-estrategia-tela-first/):
-- T2 -- ref_limiar_pendencia (EST-06, AD-041).
--
-- Por que a tabela existe: vw_pendencias (20260814162237) tem
-- INTERVAL '30 days' e INTERVAL '45 days' cravados no corpo -- violação
-- direta de AD-004 ("limiar vive em tabela de referência editável"). O
-- sintoma medido: o Figma do Dashboard escreve "há 60 dias" enquanto a view
-- dispara aos 45. Tela e banco discordavam e a operação não tinha como
-- corrigir sem deploy. Esta migração cria o lugar certo do número; a T3
-- (20260910..._estrategia_vw_pendencias_limiar.sql) tira os literais da view.
--
-- Estrutura verbatim design.md ("ref_limiar_pendencia (novo -- AD-041)").
--
-- Controle de acesso GRANT-only, não RLS (AD-030): catálogo ref_* somente-
-- leitura, sem id_contrato/carteira pra filtrar por linha. Mesmo padrão de
-- 20260810192209_catalogos_referencia_grants.sql +
-- 20260810193545_catalogos_referencia_revoke_default_privileges.sql, e pelas
-- mesmas razões -- inclusive o REVOKE, que NÃO é redundante: o ALTER DEFAULT
-- PRIVILEGES de baseline do projeto Supabase concede arwdDxtm a anon e a
-- authenticated em TODA tabela nova de `public`, independente dos GRANTs
-- escritos aqui. anon fica sem nenhum privilégio (AD-002, sem exceção).
--
-- Seed: formulario_aberto=30 e sem_registro_recente=45 são os valores hoje
-- cravados na view -- entram idênticos de propósito, para que a T3 seja
-- refactor puro (mesmas linhas retornadas com o seed padrão). etapa_atencao/
-- etapa_atrasado alimentam o badge do Quadro de Acompanhamento (EST-07 AC3);
-- o spec define a progressão Normal -> Atenção -> Atrasado mas não os números,
-- então estes são default operacional editável -- que é exatamente o ponto de
-- AD-004: mudar o número é UPDATE nesta tabela, não deploy.
--
-- ativo: reservado para desligar um limiar sem apagar a linha (histórico); a
-- T3 lê apenas linhas ativas.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ref_limiar_pendencia (
  id_limiar BIGSERIAL PRIMARY KEY,
  codigo    TEXT     NOT NULL UNIQUE,
  nome      TEXT     NOT NULL,
  dias      SMALLINT NOT NULL,
  ativo     BOOLEAN  NOT NULL DEFAULT true,
  CONSTRAINT ck_limiar_dias CHECK (dias > 0)
);

COMMENT ON TABLE ref_limiar_pendencia IS
'Limiares editáveis de pendência e de estado de etapa (AD-041, correção da violação de AD-004 em vw_pendencias). Catálogo GRANT-only, sem RLS (AD-030). Alterar `dias` muda o comportamento de vw_pendencias e do badge do Quadro sem deploy.';

-- Idempotente: ON CONFLICT no UNIQUE de codigo. `supabase db reset` roda a
-- migração do zero; um re-run não duplica nem sobrescreve valor já ajustado
-- pela operação (que é o cenário que AD-004 existe para permitir).
INSERT INTO ref_limiar_pendencia (codigo, nome, dias) VALUES
  ('formulario_aberto',    'Formulário aberto há mais de N dias',        30),
  ('sem_registro_recente', 'Contrato ativo sem registro há mais de N dias', 45),
  ('etapa_atencao',        'Dias na etapa a partir dos quais o card entra em Atenção', 30),
  ('etapa_atrasado',       'Dias na etapa a partir dos quais o card fica Atrasado',    45)
ON CONFLICT (codigo) DO NOTHING;

-- Exceção AD-030 explicitada em SQL (redundante para tabela nova -- RLS já
-- nasce desligada -- e escrita de propósito, como em 20260810192209).
ALTER TABLE public.ref_limiar_pendencia DISABLE ROW LEVEL SECURITY;

-- Re-GRANT obrigatório (AD-025): "ALL TABLES IN SCHEMA public" só cobriu as
-- tabelas existentes no momento dos GRANTs anteriores.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;

-- Leitura ampla: authenticated + as 5 roles legisla_* (mentor/assessor não
-- entram no GRANT em bloco acima).
GRANT SELECT ON public.ref_limiar_pendencia
  TO authenticated, legisla_mentor, legisla_assessor;

REVOKE ALL    ON public.ref_limiar_pendencia FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.ref_limiar_pendencia FROM authenticated;
