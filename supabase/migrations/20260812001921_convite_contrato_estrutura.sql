-- =============================================================================
-- T1 (convite-contrato): convite_contrato + convite_tentativa.
--
-- AD-033 (5ª exceção da AD-010): convite por contrato como caminho de criação
-- de conta pra Mentor/Assessor externos, via rota de servidor service_role.
-- Esta migration cobre só a estrutura (DDL+RLS+GRANT+auditoria); os RPCs de
-- emissão/consumo/rate-limit vêm em migrations próprias (AD-024 -- SECURITY
-- INVOKER, nunca DEFINER, para escrita multi-passo).
--
-- AD-001: RLS habilitada no mesmo momento do DDL, não depois.
-- =============================================================================

CREATE TABLE convite_contrato (
  id_convite             BIGSERIAL PRIMARY KEY,
  id_contrato            BIGINT NOT NULL REFERENCES fat_contrato(id_contrato),
  email                  TEXT NOT NULL,
  papel_no_contrato      TEXT NOT NULL,
  cargo                  TEXT,
  grau_responsabilidade  texto_limpo,
  areas                  TEXT[],
  token_hash             TEXT NOT NULL UNIQUE,
  id_usuario_convidou    BIGINT NOT NULL REFERENCES dim_usuario(id_usuario),
  dt_expiracao           TIMESTAMPTZ NOT NULL,
  dt_uso                 TIMESTAMPTZ,
  criado_em              TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- guarda em camada 1 (defesa em profundidade -- a camada 2 é o RPC de
  -- consumo, app.consumir_convite, T3): nunca permite gravar um papel que não
  -- seja mentor/assessor, nem que o dado chegue aqui de forma inválida.
  CONSTRAINT ck_convite_papel  CHECK (papel_no_contrato IN ('mentor','assessor')),
  CONSTRAINT ck_convite_cargo  CHECK (cargo IS NULL OR cargo IN
    ('parlamentar','chefe_gabinete','assessor','secretaria_executiva','nao_se_aplica')),
  CONSTRAINT ck_convite_email CHECK (email = lower(btrim(email)) AND email LIKE '%@%.%')
);

CREATE INDEX ix_convite_contrato ON convite_contrato (id_contrato);
-- Suporta o UPDATE de invalidação de duplicado (app.emitir_convite, T2):
-- localizar o(s) convite(s) pendente(s) pro mesmo e-mail+contrato+papel.
CREATE INDEX ix_convite_pendente ON convite_contrato (id_contrato, email, papel_no_contrato)
  WHERE dt_uso IS NULL;

COMMENT ON TABLE convite_contrato IS
'AD-033. Convite de acesso externo (Mentor/Assessor) por contrato -- token de uso único, só o hash é gravado (token_hash). Consumido por app.consumir_convite (T3) via rota de servidor service_role.';

-- Uma linha = uma tentativa de acesso a /convite/<token>, só pra rate limit
-- (app.checar_rate_limit_convite, T4). Telemetria pura, sem relação com o
-- domínio -- não referencia convite_contrato nem nada mais.
CREATE TABLE convite_tentativa (
  id_tentativa  BIGSERIAL PRIMARY KEY,
  ip            INET NOT NULL,
  ocorrido_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_convite_tentativa_ip ON convite_tentativa (ip, ocorrido_em DESC);

COMMENT ON TABLE convite_tentativa IS
'Suporte a rate limit por IP da rota pré-sessão /convite/<token> (CVT-10). Só service_role toca esta tabela -- sem política de RLS permissiva.';

-- --- RLS ---------------------------------------------------------------
-- convite_contrato: mesmo predicado p_por_contrato já padrão em toda tabela
-- com id_contrato (docs/schema_sistema.sql:1576-1580) -- Gestora/Admin têm
-- acesso de portfólio, o resto só ao próprio contrato. Reusado literalmente,
-- não uma checagem de vínculo bespoke (design.md Tech Decisions).
ALTER TABLE convite_contrato ENABLE ROW LEVEL SECURITY;
ALTER TABLE convite_contrato FORCE ROW LEVEL SECURITY;
CREATE POLICY p_por_contrato ON convite_contrato
  USING (app.papel_atual() IN ('admin','gestora') OR id_contrato = ANY(app.contratos_do_usuario()));

-- convite_tentativa: sem política permissiva -- só service_role (que ignora
-- RLS/GRANT por conta própria, BYPASSRLS) toca esta tabela. FORCE não afeta
-- esse bypass; existe só pra fechar a tabela pra qualquer outro papel.
ALTER TABLE convite_tentativa ENABLE ROW LEVEL SECURITY;
ALTER TABLE convite_tentativa FORCE ROW LEVEL SECURITY;

-- --- GRANTs --------------------------------------------------------------
-- ALTER DEFAULT PRIVILEGES do projeto concede CRUD completo a anon/
-- authenticated em toda tabela nova de public, independente de qualquer
-- GRANT explícito desta migration (achado da Trilha C, catalogos-referencia).
-- Revoga tudo e concede de volta só o necessário.
REVOKE ALL ON convite_contrato  FROM anon, authenticated;
REVOKE ALL ON convite_tentativa FROM anon, authenticated;

-- authenticated precisa de INSERT/UPDATE direto na tabela pra
-- app.emitir_convite (SECURITY INVOKER, T2) funcionar -- SEM SELECT: não há
-- tela de listagem/revogação de convites nesta fatia (Out of Scope do
-- spec.md), então RETURNING de INSERT/UPDATE (que não exige SELECT) já basta.
GRANT INSERT, UPDATE ON convite_contrato TO authenticated;

-- convite_tentativa: nenhum GRANT a anon/authenticated -- só service_role
-- (que ignora GRANT) chama app.checar_rate_limit_convite (T4).

-- --- Auditoria -----------------------------------------------------------
-- Reusa o trigger genérico já existente (docs/schema_sistema.sql:1674-1710):
-- insert na emissão, update de dt_uso no consumo, ambos virando linha em
-- log_auditoria automaticamente -- CVT-11 sem nenhum código de auditoria novo.
CREATE TRIGGER trg_audit_convite_contrato
  AFTER INSERT OR UPDATE OR DELETE ON convite_contrato
  FOR EACH ROW EXECUTE FUNCTION app.trg_auditoria('id_convite');
