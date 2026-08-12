-- =============================================================================
-- Fix T1 (convite-contrato): GRANT correto aos roles legisla_* em
-- convite_contrato/convite_tentativa.
--
-- Gap descoberto rodando o teste de integração de T2 (app.emitir_convite):
-- o efetivo executor de qualquer request autenticada nunca é o role genérico
-- `authenticated` -- é sempre um dos 5 legisla_* (app.custom_access_token_hook,
-- 0002_plataforma_auth_hook.sql, sobrescreve a claim `role` do JWT com
-- 'legisla_' || papel_global, com fallback pra 'legisla_app'). A migration T1
-- concedeu INSERT/UPDATE a `authenticated`, que nunca é o role que de fato
-- executa a chamada -- daí o 42501 "permission denied for table
-- convite_contrato" mesmo pra Gestora com vínculo correto (RLS nunca chegou a
-- ser avaliada; a negação foi de GRANT, uma camada antes).
--
-- Mesma exigência de AD-025 já documentada em 0004/20260810192209
-- (catalogos_referencia): "ALL TABLES IN SCHEMA public" só cobre as tabelas
-- que já existiam no momento do GRANT anterior -- toda tabela nova precisa
-- re-rodar esse GRANT em bloco.
-- =============================================================================

REVOKE INSERT, UPDATE ON convite_contrato FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;

-- legisla_mentor/legisla_assessor: nenhum GRANT em convite_contrato -- só
-- quem emite (Gestora/Admin) precisa escrever; ninguém lê via PostgREST
-- (Out of Scope do spec.md -- sem tela de listagem/revogação).
-- convite_tentativa: mesma observação de T1 -- o GRANT em bloco acima
-- inevitavelmente também cobre esta tabela, mas RLS+FORCE sem nenhuma
-- política permissiva continua negando toda linha pra qualquer role que não
-- seja BYPASSRLS (service_role) -- o GRANT de tabela não abre a RLS.
