-- =============================================================================
-- Seed de ref_partido -- schema_sistema.sql não define um seed aprovado pra
-- este catálogo (só ref_produto/ref_cargo tinham seed em 0007). Sem isso, o
-- dropdown de partido no cadastro manual de mandato (MandatoWizard) ficava
-- vazio.
--
-- Fonte dos dados: nr_partido/sg_partido DISTINCT já presentes em
-- tse.dim_candidatura (dado real já importado nesta base, safras 2022/2024),
-- não inventado. `nome` (razão social do partido) fica NULL -- a UI e o
-- restante do schema (mv_candidatura_resumo, vw_*) já exibem só a sigla, e
-- não há fonte confiável carregada neste projeto pro nome por extenso de
-- cada partido (evita registrar dado errado, AD-005 trata NULL como ausência
-- honesta, não texto adivinhado). `dt_inicio_sigla` fica NULL pelo mesmo
-- motivo -- não temos a data exata de cada troca de sigla carregada aqui.
--
-- Duas fusões partidárias reais aparecem nos dados entre 2022 e 2024 (mesmo
-- nº TSE, sigla diferente por ano): nº 20 era PSC em 2022 e passou a ser
-- PODE em 2024 (fusão); nº 33 era PMN em 2022 e passou a ser MOBILIZA em
-- 2024. Sigla é distinta em ambos os casos, então não colide com
-- uq_partido_sigla_vigencia (sigla, dt_inicio_sigla) -- ambas as siglas
-- entram, sem inventar data exata de transição. PODE também aparece com
-- nº 19 em 2022 (designação anterior à fusão) -- omitido aqui de propósito
-- (manteria o MESMO sigla='PODE' duas vezes com dt_inicio_sigla NULL nos
-- dois, o que colidiria de verdade); fica só o nº 20 (designação atual,
-- 2024), que é o que importa pra cadastro de mandato vigente.
-- =============================================================================

INSERT INTO ref_partido (sigla, numero) VALUES
  ('REPUBLICANOS', 10), ('PP', 11), ('PDT', 12), ('PT', 13), ('PTB', 14),
  ('MDB', 15), ('PSTU', 16), ('REDE', 18), ('PSC', 20), ('PODE', 20),
  ('PCB', 21), ('PL', 22), ('CIDADANIA', 23), ('PRD', 25),
  ('DC', 27), ('PRTB', 28), ('PCO', 29), ('NOVO', 30), ('PMN', 33),
  ('MOBILIZA', 33), ('PMB', 35), ('AGIR', 36), ('PSB', 40), ('PV', 43),
  ('UNIÃO', 44), ('PSDB', 45), ('PSOL', 50), ('PATRIOTA', 51), ('PSD', 55),
  ('PC do B', 65), ('AVANTE', 70), ('SOLIDARIEDADE', 77), ('UP', 80), ('PROS', 90)
ON CONFLICT (sigla, dt_inicio_sigla) DO NOTHING;
