-- =============================================================================
-- redesenho-estrategia-tela-first (.specs/features/redesenho-estrategia-tela-first/):
-- T5 -- fat_prospeccao, estrutura + indice parcial + auditoria (EST-04, AD-040).
--
-- Por que a tabela existe: D4 de docs/schema_sistema.sql removeu 'prospeccao'
-- do CHECK de fat_contrato e registrou a consequencia -- "o sistema nao guarda
-- material anterior a assinatura. Se a operacao precisar disso, volta como
-- tabela propria". AD-040 e exatamente essa volta: as telas T3 (Quadro de
-- Acompanhamento) e T6 (Mandatos) mostram Prospeccao como primeira coluna do
-- fluxo, e a operacao trabalha o mandato antes da assinatura. Prospeccao NAO
-- volta como status de fat_contrato nem como linha de ref_etapa -- o CHECK de
-- fat_contrato.status e a regua de etapas ficam intactos.
--
-- Estrutura verbatim design.md ("## Data Models -- fat_prospeccao (novo --
-- AD-040)").
--
-- SEM id_contrato: excecao deliberada a invariante "toda tabela de operacao
-- carrega id_contrato NOT NULL", porque a prospeccao existe ANTES do contrato.
-- id_contrato_gerado e o ponteiro do desfecho, nao a ancora -- por isso e
-- anulavel e so passa a ser obrigatorio quando status = 'convertida'
-- (ck_prospeccao_convertida).
--
-- uq_prospeccao_aberta_contratante: indice UNIQUE parcial sobre as linhas
-- abertas. E a trava do edge case de conversao simultanea (spec.md, "Edge
-- Cases"): duas prospeccoes abertas do mesmo contratante no mesmo produto nao
-- coexistem, entao nao ha duas conversoes concorrentes gerando dois contratos.
-- Linha convertida/descartada sai do indice -- o mesmo contratante pode ser
-- prospectado de novo depois.
--
-- Auditoria (AD-006): trg_audit_fat_prospeccao chama app.trg_auditoria()
-- (0012_fundacao_auditoria_gap.sql), a mesma funcao ligada as 7 tabelas de
-- Incidencia em 20260813192032_incidencia_encontros_triggers.sql. Mesmo padrao
-- idempotente (IF NOT EXISTS via pg_trigger). E o que satisfaz EST-04 AC2
-- ("a linha registra autor e timestamp") sem INSERT explicito em nenhum lugar.
--
-- Controle de acesso: a RLS de verdade e os GRANTs vem na T6
-- (<ts>_estrategia_fat_prospeccao_rls.sql) -- fat_prospeccao NAO e catalogo
-- ref_*, entao nao cabe o modelo GRANT-only de AD-030; prospeccao tem dono
-- (id_usuario_resp) e a policy e por linha. O REVOKE abaixo, porem, nao pode
-- esperar pela T6: o ALTER DEFAULT PRIVILEGES de baseline do projeto Supabase
-- concede arwdDxtm a anon e a authenticated em TODA tabela nova de `public`
-- (mesmo achado documentado em 20260910145926_estrategia_ref_limiar_pendencia.sql).
-- Sem ele a tabela nasceria publica entre esta migration e a T6 -- exatamente
-- o que AD-001/AD-002 proibem. Entre T5 e T6 a tabela fica acessivel apenas ao
-- dono: nenhum papel de aplicacao tem privilegio ainda.
-- =============================================================================

-- Uma linha = um mandato/organizacao em prospeccao para um produto, antes de
-- existir contrato.
CREATE TABLE IF NOT EXISTS fat_prospeccao (
  id_prospeccao      BIGSERIAL PRIMARY KEY,
  id_contratante     BIGINT NOT NULL REFERENCES dim_contratante(id_contratante) ON DELETE RESTRICT,
  id_produto         BIGINT NOT NULL REFERENCES ref_produto(id_produto),
  id_projeto         BIGINT REFERENCES ref_projeto(id_projeto),
  id_usuario_resp    BIGINT REFERENCES dim_usuario(id_usuario),
  status             TEXT NOT NULL DEFAULT 'aberta',
  dt_abertura        DATE NOT NULL DEFAULT CURRENT_DATE,
  dt_desfecho        DATE,
  id_contrato_gerado BIGINT REFERENCES fat_contrato(id_contrato),
  observacao         texto_limpo,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por         BIGINT REFERENCES dim_usuario(id_usuario),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_prospeccao_status CHECK (status IN ('aberta','convertida','descartada')),
  CONSTRAINT ck_prospeccao_convertida CHECK (status <> 'convertida' OR id_contrato_gerado IS NOT NULL),
  CONSTRAINT ck_prospeccao_desfecho CHECK (status = 'aberta' OR dt_desfecho IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_prospeccao_aberta_contratante
  ON fat_prospeccao (id_contratante, id_produto) WHERE status = 'aberta';

COMMENT ON TABLE fat_prospeccao IS
'Mandato em trabalho antes da assinatura (AD-040). Reabre D4 pelo caminho que a propria D4 deixou aberto: prospeccao volta como tabela propria, nao como status de fat_contrato. Unica tabela de operacao sem id_contrato — a prospeccao existe antes do contrato. Consultas de carteira (vw_carteira, mv_numeros_impacto, lista de Mandatos) NAO a incluem por padrao: nenhum numero de impacto ou vigencia existe para algo que ainda nao foi assinado.';

COMMENT ON COLUMN fat_prospeccao.id_contrato_gerado IS
'Ponteiro do desfecho, nao ancora. Anulavel enquanto a prospeccao esta aberta ou foi descartada; obrigatorio quando status = convertida (ck_prospeccao_convertida). Preenchido por app.converter_prospeccao, na mesma transacao que cria o contrato.';

COMMENT ON COLUMN fat_prospeccao.id_usuario_resp IS
'Dono da prospeccao. Como nao ha id_contrato, e este campo — nao rel_usuario_contrato — que a RLS usa para recortar a leitura por pessoa (AD-040 + AD-001).';

-- app.trg_auditoria() (0012_fundacao_auditoria_gap.sql) reaplicada a mais uma
-- tabela -- mesma funcao, sem alteracao, mesmo padrao idempotente de
-- 20260813192032_incidencia_encontros_triggers.sql.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_fat_prospeccao') THEN
    CREATE TRIGGER trg_audit_fat_prospeccao AFTER INSERT OR UPDATE OR DELETE ON fat_prospeccao
      FOR EACH ROW EXECUTE FUNCTION app.trg_auditoria('id_prospeccao');
  END IF;
END $$;

-- AD-002, sem excecao: anon nunca tem privilegio. authenticated tambem nao --
-- o acesso passa pelas roles legisla_* (T6). Nao e redundante; desfaz o
-- ALTER DEFAULT PRIVILEGES de baseline do Supabase.
REVOKE ALL ON public.fat_prospeccao FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.fat_prospeccao_id_prospeccao_seq FROM anon, authenticated;
