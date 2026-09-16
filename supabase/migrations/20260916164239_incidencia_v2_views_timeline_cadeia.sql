-- =============================================================================
-- fatos-geradores-ciclo-vida: T5 -- vw_timeline_incidencia + vw_cadeia_incidencia
-- (AD-003, AD-053, FGC-13). Views novas, security_invoker=true (mesmo padrão
-- de vw_iip_contrato/vw_carteira) -- nenhuma lógica de RLS própria: cada
-- SELECT de base já é escopado por id_contrato via a policy p_por_contrato/
-- p_heranca das 4 tabelas de origem (fat_pre_insight T1, fat_registro/
-- fat_insight/fat_fato_gerador/rel_fato_origem já existentes).
--
-- vw_timeline_incidencia: união das 4 entidades com data e tipo unificados,
-- sem paginação embutida (design.md -- client pagina). data_evento é sempre
-- DATE (sem hora, FGC-12) -- hora só sobrevive em criado_em (metadado de
-- auditoria, spec.md P1 AC5). Pré-Insight/Insight têm ocorrido_em nullable
-- no schema (nenhuma tela força o preenchimento); COALESCE com criado_em::date
-- garante todo item tenha data para caber em "ordem cronológica decrescente,
-- agrupados por mês" (spec.md P1 AC1) -- sem esse fallback, um item com
-- ocorrido_em NULL sumiria do agrupamento por mês.
--
-- vw_cadeia_incidencia: 1 linha por Fato Gerador (não por cadeia -- AD-053,
-- "cadeia" não é objeto persistido). chave_origem agrupa pela origem em
-- comum (LEFT JOIN rel_fato_origem, que a RPC app.criar_fato_gerador sempre
-- grava como no máximo 1 linha por fato -- T6 mantém essa invariante);
-- quando não há linha de vínculo, cada fato cai no próprio id como chave
-- (fato:<id>), o que já produz uma cadeia de 1 elemento "direta no fato" sem
-- marca de incompletude (spec.md P2 AC4). O agrupamento por chave_origem, a
-- letra posicional (Cadeia A/B/C) e a separação "só-projetada" (todo membro
-- do grupo com situacao='projetado') ficam para o módulo puro
-- rotulaCadeias (T14) -- esta view não produz nome nem ordem de exibição.
-- =============================================================================

CREATE VIEW vw_timeline_incidencia WITH (security_invoker = true) AS
SELECT p.id_contrato,
       'pre_insight'::text                       AS tipo,
       p.id_pre_insight                           AS id_origem,
       p.conteudo                                 AS titulo,
       COALESCE(p.ocorrido_em, p.criado_em::date) AS data_evento,
       p.criado_em,
       p.id_usuario_autor
FROM fat_pre_insight p

UNION ALL

SELECT r.id_contrato,
       'registro'::text          AS tipo,
       r.id_registro             AS id_origem,
       r.resumo                  AS titulo,
       r.ocorrido_em::date       AS data_evento,
       r.criado_em,
       r.id_usuario_autor
FROM fat_registro r

UNION ALL

SELECT i.id_contrato,
       'insight'::text                            AS tipo,
       i.id_insight                                AS id_origem,
       i.conteudo                                   AS titulo,
       COALESCE(i.ocorrido_em, i.criado_em::date)   AS data_evento,
       i.criado_em,
       i.id_usuario_autor
FROM fat_insight i

UNION ALL

SELECT f.id_contrato,
       'fato_gerador'::text                             AS tipo,
       f.id_fato_gerador                                 AS id_origem,
       COALESCE(f.titulo, f.descricao_evidencia)         AS titulo,
       COALESCE(f.dt_ocorrencia, f.dt_prevista)           AS data_evento,
       f.criado_em,
       f.id_usuario_autor
FROM fat_fato_gerador f;

COMMENT ON VIEW vw_timeline_incidencia IS
'FGC-10/FGC-13. União de Pré-Insight/Registro/Insight/Fato Gerador com data (sem hora, FGC-12) e tipo discriminador unificados -- sem paginação embutida, o client pagina (design.md). Escopo por contrato herdado das 4 tabelas de origem, todas com RLS própria.';

CREATE VIEW vw_cadeia_incidencia WITH (security_invoker = true) AS
SELECT f.id_contrato,
       f.id_fato_gerador,
       COALESCE(f.titulo, f.descricao_evidencia)  AS titulo,
       f.situacao,
       COALESCE(f.dt_ocorrencia, f.dt_prevista)    AS data_evento,
       CASE
         WHEN r.id_meta        IS NOT NULL THEN 'meta:'        || r.id_meta
         WHEN r.id_insight     IS NOT NULL THEN 'insight:'     || r.id_insight
         WHEN r.id_pre_insight IS NOT NULL THEN 'pre_insight:' || r.id_pre_insight
         WHEN r.id_registro    IS NOT NULL THEN 'registro:'    || r.id_registro
         ELSE                                     'fato:'      || f.id_fato_gerador
       END AS chave_origem
FROM fat_fato_gerador f
LEFT JOIN rel_fato_origem r ON r.id_fato_gerador = f.id_fato_gerador;

COMMENT ON VIEW vw_cadeia_incidencia IS
'FGC-13/AD-053. 1 linha por Fato Gerador, nunca por cadeia -- nenhuma coluna de nome/letra. chave_origem agrupa fatos com a mesma origem (Meta/Insight/Pré-Insight/Registro); sem linha em rel_fato_origem, o fato cai na própria chave (cadeia direta, sem marca de incompletude). Rótulo posicional e separação de cadeias só-projetadas são responsabilidade do render (rotulaCadeias, T14), não desta view.';

-- Re-GRANT em bloco (AD-025) + explícito a mentor/assessor, mesmos papéis
-- que já leem as 4 tabelas de origem.
--
-- "ALL TABLES IN SCHEMA public" também alcança as 2 views criadas acima
-- (mesmo achado do T4, 20260916163414_incidencia_v2_iip_so_realizados.sql) --
-- REVOKE explícito do INSERT/UPDATE/DELETE que o bloco genérico concede por
-- engano a view. Views de leitura não são destino de escrita.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;

REVOKE INSERT, UPDATE, DELETE ON vw_timeline_incidencia, vw_cadeia_incidencia
FROM legisla_app, legisla_admin, legisla_gestora;

GRANT SELECT ON vw_timeline_incidencia, vw_cadeia_incidencia TO legisla_mentor, legisla_assessor;
