-- Migration 0024: Desabilitar RLS e garantir GRANT de leitura nos catálogos de referência (ref_*)

ALTER TABLE public.ref_cargo DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_partido DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_produto DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_projeto DISABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.ref_cargo, public.ref_partido, public.ref_produto, public.ref_projeto TO authenticated, anon, legisla_app, legisla_admin, legisla_gestora;
