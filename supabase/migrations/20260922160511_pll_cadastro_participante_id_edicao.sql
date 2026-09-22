-- Correção forward-only (não edita 20260922072328, já aplicada): substitui
-- id_projeto por id_edicao em fat_cadastro_participante. id_projeto era o
-- placeholder de "edição" antes de fat_edicao existir (comentário original:
-- "a coluna é anulável no schema para cobrir produtos futuros sem edição") --
-- agora que a edição é entidade própria, o vínculo direto correto é com ela.
--
-- Sem backfill: as únicas linhas hoje em dev têm id_projeto NULL (scratch de
-- teste de integração, nunca tiveram edição real).

ALTER TABLE fat_cadastro_participante
  ADD COLUMN IF NOT EXISTS id_edicao BIGINT REFERENCES fat_edicao(id_edicao);

DROP INDEX IF EXISTS uq_cadastro_participante_email_projeto;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cadastro_participante_email_edicao
  ON fat_cadastro_participante (id_edicao, email);

ALTER TABLE fat_cadastro_participante DROP COLUMN IF EXISTS id_projeto;

COMMENT ON COLUMN fat_cadastro_participante.id_edicao IS
'Edição do produto (fat_edicao) a que este cadastro pertence. Anulável no schema (cobre produtos futuros sem edição), obrigatório na aplicação (upsertCadastroParticipantes).';
