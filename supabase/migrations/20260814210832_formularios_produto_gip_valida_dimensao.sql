-- =============================================================================
-- formularios-produto: T9 (achado real, descoberto rodando o teste de
-- integração desta task, não por leitura de código) -- app.trg_valida_gip_
-- dimensao() e o trigger trg_gip_dimensao_faixa (verbatim
-- docs/schema_sistema.sql:1864-1877) nunca foram provisionados.
--
-- design.md assumia "trigger já existe, reaproveitada sem alteração" --
-- errado: o alvo do trigger é fat_gip_dimensao, tabela que só passou a
-- existir com T5 desta mesma feature. Nenhuma feature anterior poderia tê-lo
-- criado (o objeto que ele valida não existia). Sem isso, um valor de
-- dimensão fora da faixa 1-4 era aceito silenciosamente -- FRM-18 (spec.md
-- P2 AC4) não estava de fato coberto.
--
-- Sem SECURITY DEFINER: é trigger BEFORE de validação pura (só lê
-- ref_dimensao_gip, catálogo com leitura liberada a todos os papéis
-- autenticados, AD-030), nunca escreve em tabela nenhuma -- roda dentro do
-- mesmo contexto de privilégio de quem já estiver inserindo em
-- fat_gip_dimensao (hoje, sempre app.trg_deriva_gip, já SECURITY DEFINER).
-- =============================================================================

CREATE OR REPLACE FUNCTION app.trg_valida_gip_dimensao() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_min SMALLINT; v_max SMALLINT;
BEGIN
  SELECT valor_min, valor_max INTO v_min, v_max
    FROM ref_dimensao_gip WHERE id_dimensao = NEW.id_dimensao;
  IF NEW.valor < v_min OR NEW.valor > v_max THEN
    RAISE EXCEPTION 'Valor % fora da faixa (%..%) da dimensão %', NEW.valor, v_min, v_max, NEW.id_dimensao;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_gip_dimensao_faixa BEFORE INSERT OR UPDATE ON fat_gip_dimensao
  FOR EACH ROW EXECUTE FUNCTION app.trg_valida_gip_dimensao();
