-- =============================================================================
-- incidencia-encontros: T5 -- grants das 7 tabelas criadas em T2.
--
-- Re-GRANT em bloco (AD-025): "ALL TABLES/SEQUENCES IN SCHEMA public" só cobre
-- o que já existia no momento do GRANT anterior -- mesmo padrão de toda
-- migration que já criou tabela nova em public (ex.:
-- 20260812145817_planejamento_planilha_grants.sql).
--
-- Mentor: subconjunto do GRANT aprovado (docs/schema_sistema.sql:2080-2083)
-- restrito às 7 tabelas que existem agora -- fat_sucesso_mensal/fat_submissao
-- da mesma linha já foram concedidas por features anteriores, fora de escopo
-- aqui. Verbatim: SELECT+INSERT+UPDATE nas 7 (inclui fat_encontro/
-- rel_encontro_participante, já no texto aprovado -- não é o SPEC_DEVIATION,
-- que é sobre Assessor, ver abaixo).
--
-- Assessor: schema_sistema.sql:2093-2098 (aprovado) nunca deu a este papel
-- nenhum acesso às 7 tabelas de Incidência -- o spec.md desta feature (P1:
-- "Assessor/Mentor/Gestora conseguem lançar um Registro/Insight/Fato
-- Gerador") e o SPEC_DEVIATION de Encontro aprovado em design.md exigem
-- estender. SELECT+INSERT em fat_registro/fat_insight/fat_fato_gerador/
-- rel_insight_origem/rel_fato_origem; SELECT+INSERT+UPDATE em fat_encontro/
-- rel_encontro_participante (mesmos 3 verbos do Mentor -- Encontro é
-- "planejar e depois marcar como realizado", por isso UPDATE; SELECT porque
-- sem leitura o Assessor não consegue listar/optar entre os Encontros do
-- próprio contrato antes de vincular um Registro a eles).
--
-- Achado novo (design.md, Risks & Concerns): legisla_assessor nunca teve
-- INSERT real em nenhuma migration anterior -- sem GRANT USAGE, SELECT ON
-- ALL SEQUENCES explícito, o 1º INSERT do Assessor falha em nextval() com
-- 42501 (mesma classe de achado já corrigida pro Mentor em
-- planejamento-planilha-monitoramento, nunca corrigida pro Assessor porque
-- nenhuma feature anterior tinha dado a ele um INSERT de verdade). Mentor
-- também precisa do re-GRANT de sequences aqui -- as 7 sequences novas de T2
-- não existiam quando o GRANT anterior a ele foi feito.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;

GRANT SELECT, INSERT, UPDATE ON
  fat_registro, fat_insight, fat_fato_gerador, rel_fato_origem, rel_insight_origem,
  fat_encontro, rel_encontro_participante
  TO legisla_mentor;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_mentor;

GRANT SELECT, INSERT ON
  fat_registro, fat_insight, fat_fato_gerador, rel_insight_origem, rel_fato_origem
  TO legisla_assessor;
GRANT SELECT, INSERT, UPDATE ON fat_encontro, rel_encontro_participante TO legisla_assessor;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_assessor;
