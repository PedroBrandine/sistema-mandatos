-- ficha-mandato-contrato: T3 -- rel_registro_participante, tabela nova que
-- fecha TIP-07 (B-01, spec.md). Espelha rel_encontro_participante de
-- propósito (mesma forma, outro dono), mas SEM coluna `presente`: a linha É o
-- fato de ter estado presente no registro -- desmarcar alguém apaga a linha
-- (design.md, "Data Models" > rel_registro_participante). RLS fica para T7
-- (AD-001).

-- Uma linha = a presença de uma pessoa num registro (lançamento), inclusive
-- quando o registro não tem encontro de origem (A-08).
CREATE TABLE IF NOT EXISTS rel_registro_participante (
  id_participacao BIGSERIAL PRIMARY KEY,
  id_registro     BIGINT NOT NULL REFERENCES fat_registro(id_registro) ON DELETE CASCADE,
  id_usuario      BIGINT REFERENCES dim_usuario(id_usuario),
  nome_livre      texto_limpo,
  origem          TEXT   NOT NULL,
  CONSTRAINT ck_reg_part_origem CHECK (origem IN ('legisla','mandato','externo')),
  CONSTRAINT ck_reg_part_identificacao CHECK ((id_usuario IS NULL) <> (nome_livre IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reg_part_usuario
  ON rel_registro_participante (id_registro, id_usuario) WHERE id_usuario IS NOT NULL;

COMMENT ON TABLE rel_registro_participante IS
'Presença do registro (o que de fato aconteceu), distinta de rel_encontro_participante (o plano do encontro) -- A-21. Sem coluna presente: a linha é o próprio fato de ter estado presente; desmarcar apaga a linha, evitando um terceiro estado sem significado.';
