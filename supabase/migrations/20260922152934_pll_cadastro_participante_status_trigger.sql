-- =============================================================================
-- pll-cadastro-participantes: recomputo de fat_cadastro_participante.status_cadastro
-- (D-3 de .specs/features/pll-cadastro-participantes/spec.md).
--
-- Gap Major do Verifier (validation.md, "status_cadastro nunca sai do DEFAULT
-- 'incompleto'"): a coluna nasceu com DEFAULT estático e nenhum trigger/RPC/
-- código de aplicação jamais a recalculava, deixando a coluna "Status" da
-- lista (PLL-CP-05) e as 3 métricas do card de upload (PLL-CP-04) decorativas.
--
-- Mecanismo escolhido: trigger BEFORE INSERT OR UPDATE na própria tabela,
-- SECURITY INVOKER (padrão implícito de função sem SECURITY DEFINER). Não é
-- caso da exceção AD-035 (recômputo cross-tabela por um papel sem GRANT
-- direto): aqui o cálculo usa só colunas da MESMA linha sendo escrita, e todo
-- papel que grava na tabela (Gestora/Mentor/Admin/legisla_app) já tem GRANT
-- UPDATE na tabela inteira, incluindo status_cadastro (migration
-- 20260922072336_pll_cadastro_participante_grants.sql) -- não cruza tabela,
-- não precisa de papel elevado. AD-024 (RPC SECURITY INVOKER para invariante
-- multi-tabela) também não se aplica: não há RPC nova aqui, e não é
-- multi-tabela.
--
-- Regra (D-3): "Completo" = campos obrigatórios da planilha preenchidos E
-- vinculado ao TSE; "Incompleto" = falta campo obrigatório da planilha;
-- "Pendente de revisão" = campos obrigatórios completos, falta só o vínculo
-- TSE. "Campos obrigatórios da planilha" = exatamente os validados como
-- obrigatórios (sem `.nullable().optional()`) em
-- src/backend/schemas/cadastro-participante-pll.ts (T3): papel, nome_completo,
-- email -- os únicos 3 campos autodeclarados NOT NULL na tabela (as outras 22
-- colunas do Anexo A são opcionais tanto no Zod quanto no schema SQL). "Vínculo
-- TSE" = id_contrato IS NOT NULL, mesmo sinal que buscarCadastroParticipantesPll
-- (pll-cadastro.ts) já usa para `vinculadoTse` e que vincularParticipanteAoTse
-- grava junto com id_vinculo_tse.
--
-- Nota: como papel/nome_completo/email são NOT NULL na própria tabela (T2), a
-- checagem de "campo obrigatório vazio" abaixo é defensiva -- nunca deveria
-- disparar em produção via inserção normal (INSERT/UPDATE que violasse NOT
-- NULL já falharia antes do trigger rodar) -- mas mantém a função correta e
-- autocontida caso essas colunas percam o NOT NULL no futuro, sem depender de
-- uma constraint alheia para a regra de negócio ficar certa.
-- =============================================================================

CREATE OR REPLACE FUNCTION calcular_status_cadastro_participante()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF NEW.papel IS NULL OR btrim(NEW.papel) = ''
     OR NEW.nome_completo IS NULL OR btrim(NEW.nome_completo) = ''
     OR NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    NEW.status_cadastro := 'incompleto';
  ELSIF NEW.id_contrato IS NULL THEN
    NEW.status_cadastro := 'pendente_revisao';
  ELSE
    NEW.status_cadastro := 'completo';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION calcular_status_cadastro_participante() IS
'Recalcula fat_cadastro_participante.status_cadastro (D-3) a cada INSERT/UPDATE, a partir das colunas da própria linha -- ver comentário da migration para a regra completa.';

DROP TRIGGER IF EXISTS trg_calcular_status_cadastro_participante ON fat_cadastro_participante;
CREATE TRIGGER trg_calcular_status_cadastro_participante
  BEFORE INSERT OR UPDATE ON fat_cadastro_participante
  FOR EACH ROW
  EXECUTE FUNCTION calcular_status_cadastro_participante();

-- Corrige o passado: linhas já importadas antes deste trigger existir tinham
-- status_cadastro travado em 'incompleto' (o DEFAULT), mesmo já completas ou
-- vinculadas. UPDATE no-op de propósito (SET id_cadastro_participante =
-- id_cadastro_participante) só para disparar o BEFORE UPDATE acima e
-- recalcular todas as linhas existentes de uma vez.
UPDATE fat_cadastro_participante
   SET id_cadastro_participante = id_cadastro_participante;
