-- =============================================================================
-- Seed de ref_projeto -- não é dado público (TSE), é dado da própria
-- organização, informado diretamente pelo usuário nesta sessão. Só `nome`
-- é preenchido; `tematica`/`id_produto_padrao`/`dt_inicio`/`dt_fim` ficam
-- NULL (ausência honesta, AD-005) até o usuário decidir preenchê-los --
-- nenhum desses campos foi informado, não são inventados aqui.
-- =============================================================================

INSERT INTO ref_projeto (nome) VALUES
  ('Imagina 1'),
  ('Bancada do Clima'),
  ('Imagina 2'),
  ('GAIA')
ON CONFLICT (nome) DO NOTHING;
