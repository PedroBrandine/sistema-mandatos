# Introspecção do Supabase remoto — T10

Levantamento feito contra o projeto linkado `sistema-mandatos-dev` (ref
`npnvoolkebhabjkjzqwn`) antes de escrever qualquer migração da Fase 2
(T11-T19), conforme AD-025 (provisionamento incremental por feature) — cada
migração desta fase só cria o que a introspecção abaixo marca como "falta
criar".

**Comandos usados** (Management API via `supabase db query --linked` e
`supabase migration list` — sem Docker/`supabase start` neste ambiente):

```sql
SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname IN ('public','app','tse','stg') AND c.relkind IN ('r','p','m','v')
 ORDER BY 1,2;

SELECT nspname FROM pg_namespace WHERE nspname IN ('public','app','tse','stg') ORDER BY 1;
SELECT proname FROM pg_proc WHERE pronamespace = 'app'::regnamespace ORDER BY 1;
SELECT extname FROM pg_extension ORDER BY 1;
```

`supabase migration list` confirmou local/remoto sincronizados em `0001`-`0005`.

## Migrações já aplicadas (Batch 1, T1-T9 + pré-requisito)

| Arquivo | Conteúdo |
| ------- | -------- |
| `0001_plataforma_dim_usuario_prereq.sql` | `unaccent`, `app.f_unaccent`, `app.normaliza_nome`, domínio `texto_limpo`, tabela `dim_usuario` + RLS (`p_usuario`), `app.id_usuario()`/`app.papel_atual()` |
| `0002_plataforma_auth_hook.sql` | `app.custom_access_token_hook` |
| `0003_plataforma_pre_request.sql` | `app.pre_request` |
| `0004_plataforma_roles_grants.sql` | 5 ROLES (`legisla_*`) + GRANTs escopados ao que existe |
| `0005_plataforma_pre_request_wiring.sql` | wiring de `db-pre-request` via `ALTER ROLE authenticator` |

## Estado provisionado hoje (confirmado por introspecção, 2026-07-30)

| Item | Schema | Estado | Ação |
| ---- | ------ | ------ | ---- |
| Extensão `unaccent` | — | ✅ existe | nenhuma (T11 só garante idempotência) |
| Extensão `btree_gin` | — | ❌ falta | T11 cria |
| Extensão `pg_trgm` | — | ❌ falta | T11 cria |
| Schema `app` | — | ✅ existe | nenhuma |
| Schema `tse` | — | ❌ falta | T11 cria |
| Schema `stg` | — | ❌ falta | T11 cria (mesmo sem tabela nesta feature — placeholder de staging, verbatim do schema aprovado) |
| `app.f_unaccent` | app | ✅ existe | nenhuma |
| `app.normaliza_nome` | app | ✅ existe | nenhuma |
| Domínio `texto_limpo` | public | ✅ existe | nenhuma |
| `app.id_usuario()` / `app.papel_atual()` | app | ✅ existem | nenhuma |
| `app.custom_access_token_hook` | app | ✅ existe | nenhuma (Plataforma, fora desta feature) |
| `app.pre_request` | app | ✅ existe | nenhuma (Plataforma, fora desta feature) |
| 5 ROLES `legisla_*` + GRANTs escopados | — | ✅ existem | nenhuma (T16 reforça GRANT nas tabelas novas de Fundação, ver nota da migração `0004`) |
| `dim_usuario` (+ RLS `p_usuario`) | public | ✅ existe | nenhuma |
| `ref_produto`, `ref_projeto`, `ref_cargo`, `ref_partido` | public | ❌ faltam | T12 cria + seeds |
| `rel_usuario_contrato` | public | ❌ falta | T13 cria (+ RLS `p_vinculo_proprio`, por AD-001) |
| `log_auditoria` (+ partições) | public | ❌ falta | T13 cria (+ RLS `p_log_admin`, por AD-001) |
| `dim_contratante`, `dim_mandato`, `dim_coalizao`, `fat_contrato`, `rel_coalizao_membro` | public | ❌ faltam | T14 cria (DDL); RLS aplicada em T16 |
| `tse.dim_candidatura`, `tse.fat_votacao_zona`, `tse.dim_perfil_eleitorado`, `tse.rel_rede_social`, `tse.mv_candidatura_resumo` | tse | ❌ faltam | T15 cria |
| `rel_mandato_candidatura` | public | ❌ falta | T15 cria |
| RLS de Fundação (`p_vinculo_proprio`, `p_por_carteira` em `dim_contratante`/`dim_mandato`/`dim_coalizao`/`rel_mandato_candidatura`/`fat_contrato`, `p_por_contrato` em `rel_coalizao_membro`) | public | ❌ falta | T16 aplica |
| `trg_audit_dim_contratante`/`dim_coalizao`/`rel_coalizao_membro` | public | ❌ falta (gap do schema aprovado — ver design.md) | T17 cria |
| Índice GIN trigram + B-tree `(sg_uf, cd_cargo)` em `tse.mv_candidatura_resumo` | tse | ❌ falta | T18 cria |
| Seed de teste de integração (Fases 3-4) | — | ❌ falta | T19 cria |

Nenhuma tabela/função de Fundação está provisionada hoje além de `dim_usuario`
(pré-requisito de Fase 0). T11-T19 criam exatamente a fatia que falta, na
ordem acima — nenhuma colisão com o que já existe.
