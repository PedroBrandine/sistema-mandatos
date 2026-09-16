-- ficha-mandato-contrato: T8 -- grants das 4 tabelas novas do lote 1
-- (fat_artefato, rel_registro_participante, rel_mandato_agenda_tematica,
-- ref_nivel_dimensao_gip). Confirmado por consulta direta antes de T7 (ver
-- commit de T7): nenhuma role legisla_* -- nem legisla_admin/legisla_gestora
-- -- tinha nenhum verbo nas 4 tabelas. "GRANT ... ON ALL TABLES IN SCHEMA
-- public" só cobre o que já existia no momento do último GRANT em bloco, e
-- T2/T3/T4/T5 (que criaram estas 4 tabelas) não reemitiram esse GRANT --
-- pendência explícita de AD-025 (design.md, "Risks & Concerns"), fechada
-- aqui.

-- Re-GRANT em bloco (AD-025), mesmo padrão de
-- 20260813192816_incidencia_encontros_grants.sql: cobre as 4 tabelas novas
-- para app/admin/gestora, que já tinham CRUD amplo em toda tabela anterior.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO legisla_app, legisla_admin, legisla_gestora;

-- Mentor/Assessor: escopo explícito de design.md ("Registro de encontro com
-- camada dinâmica") -- lançam Registro e seus artefatos no próprio contrato.
-- rel_mandato_agenda_tematica NÃO entra aqui: a edição da identidade do
-- mandato (aba Informações Gerais) é escopo de gestora/admin, já cobertos
-- pelo GRANT em bloco acima -- nenhum AC desta feature pede Mentor/Assessor
-- editando área temática do mandato.
GRANT SELECT, INSERT ON fat_artefato, rel_registro_participante TO legisla_mentor, legisla_assessor;

-- Sequences: achado conhecido (design.md "Risks & Concerns", mesma classe já
-- corrigida em incidencia-encontros) -- sem GRANT explícito de sequence, o
-- 1º INSERT do Assessor em tabela com BIGSERIAL falha em nextval() com
-- 42501, mesmo com GRANT de tabela concedido acima. Re-GRANT em bloco (não
-- scoped): rel_mandato_agenda_tematica e ref_nivel_dimensao_gip têm PK
-- composta, sem sequence própria -- nada a perder ao reemitir para todas.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO legisla_mentor, legisla_assessor;

-- ref_nivel_dimensao_gip: catálogo GRANT-only, sem RLS (AD-030), mesmo
-- padrão de 20260810192209_catalogos_referencia_grants.sql. A tabela nasceu
-- sem RLS em T5 (nunca foi ligada) -- DISABLE explícito só documenta a
-- exceção no mesmo lugar que os demais catálogos, mesmo sendo redundante.
ALTER TABLE public.ref_nivel_dimensao_gip DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.ref_nivel_dimensao_gip TO authenticated, legisla_mentor, legisla_assessor;
