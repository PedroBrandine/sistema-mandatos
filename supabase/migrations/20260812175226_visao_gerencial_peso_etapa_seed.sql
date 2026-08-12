-- =============================================================================
-- visao-gerencial-g1-g2: T3 -- seed de ref_peso_etapa (T1/T2). Toda etapa hoje
-- existente nasce com peso = 1 (equivalente a contagem simples), até o
-- Monitoramento definir os pesos reais -- mesmo padrão já usado em
-- ref_agenda_tematica/ref_indicador/ref_tipologia (CAT-16, "nascem vazias de
-- propósito, levantamento humano sem data"). spec.md, Assumptions.
--
-- ON CONFLICT DO NOTHING -- idempotência, mesmo padrão de
-- 20260810193327_catalogos_referencia_seed.sql.
-- =============================================================================

INSERT INTO ref_peso_etapa (id_etapa, peso)
SELECT id_etapa, 1 FROM ref_etapa
ON CONFLICT (id_etapa) DO NOTHING;
