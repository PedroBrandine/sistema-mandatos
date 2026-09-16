-- ficha-mandato-contrato: T10 -- seed dos 30 temas de ref_agenda_tematica
-- (Anexo B de spec.md), fechando CAT-16 por decisão de produto (A-06,
-- aceita por Pedro em 2026-09-15). Alimenta FMC-09 (seletor de áreas
-- temáticas do mandato).
--
-- ON CONFLICT (nome) DO NOTHING: ref_agenda_tematica.nome já é UNIQUE
-- (docs/schema_sistema.sql:239) -- idempotente sob reaplicação/db reset,
-- mesmo padrão de todo seed de catálogo do projeto.
INSERT INTO ref_agenda_tematica (nome, ordem) VALUES
  ('Educação', 1),
  ('Saúde', 2),
  ('Assistência e Desenvolvimento Social', 3),
  ('Segurança Pública', 4),
  ('Justiça e Cidadania', 5),
  ('Direitos Humanos', 6),
  ('Meio Ambiente e Clima', 7),
  ('Mulheres', 8),
  ('Igualdade Racial', 9),
  ('LGBTQIA+', 10),
  ('Infância e Juventude', 11),
  ('Pessoa com Deficiência', 12),
  ('Povos Indígenas e Comunidades Tradicionais', 13),
  ('Trabalho, Emprego e Renda', 14),
  ('Cidades, Mobilidade e Moradia', 15),
  ('Cultura', 16),
  ('Esporte e Lazer', 17),
  ('Ciência, Tecnologia e Inovação', 18),
  ('Democracia e Reforma Política', 19),
  ('Transparência e Controle Social', 20),
  ('Pessoa Idosa', 21),
  ('Agricultura Familiar e Segurança Alimentar', 22),
  ('Economia e Desenvolvimento Produtivo', 23),
  ('Tributação e Justiça Fiscal', 24),
  ('Saneamento e Recursos Hídricos', 25),
  ('Energia e Transição Energética', 26),
  ('Saúde Mental', 27),
  ('Migração e Refúgio', 28),
  ('Proteção e Bem-Estar Animal', 29),
  ('Defesa do Consumidor', 30)
ON CONFLICT (nome) DO NOTHING;
