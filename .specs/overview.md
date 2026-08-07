# Especificações do Projeto: Sistema Mandatos

Este diretório contém a documentação das especificações e tarefas do desenvolvimento guiado por especificações (TLC Spec-Driven).

## Arquitetura do Projeto
- **`src/`**: Todo o código-fonte da aplicação.
  - **`src/frontend/`**: Componentes de interface, telas, estilo e UI.
  - **`src/backend/`**: Serviços de integração, regras de negócio e cliente Supabase.
- **`supabase/`**: Banco de dados Postgres, migrações DDL, políticas RLS e Edge Functions.
- **`.specs/`**: Documentação de arquitetura, especificações técnicas e tarefas de desenvolvimento.
- **`docs/`**: Documentação auxiliar e especificações funcionais (`schema_sistema.sql`).

## Banco de Dados Supabase

Dois projetos distintos (dev e produção) desde 06/08/2026 — refs, chaves e
regras de deploy em `docs/ambientes.md` (fonte de verdade operacional; não
duplicar os refs aqui para não desatualizar de novo).

**`docs/schema_sistema.sql` é a fonte de verdade aprovada do modelo completo** (AD-008) — **51 tabelas lógicas** (sem contar partições filhas) + **11 views/materialized views**, organizadas em 11 blocos:

- **Catálogos `ref_*` (16 tabelas):** `ref_produto`, `ref_projeto`, `ref_cargo`, `ref_partido`, `ref_etapa`, `ref_tipo_registro`, `ref_formulario`, `ref_metrica_formulario`, `ref_preditor`, `ref_agenda_tematica`, `ref_perfil_atuacao`, `ref_pilar_insight`, `ref_indicador`, `ref_nivel_iip`, `ref_tipologia`, `ref_dimensao_gip`.
- **Plataforma (3 tabelas):** `dim_usuario`, `rel_usuario_contrato`, `log_auditoria` (particionada por mês).
- **Fundação (3 tabelas):** `dim_contratante`, `dim_mandato`, `dim_coalizao`.
- **Âncora (2 tabelas):** `fat_contrato`, `rel_coalizao_membro`.
- **Espelho TSE — schema `tse`, read-only (4 tabelas + 1 tabela de vínculo):** `tse.dim_candidatura` (particionada por safra), `tse.fat_votacao_zona` (particionada), `tse.dim_perfil_eleitorado` (particionada), `tse.rel_rede_social`; `rel_mandato_candidatura` (vínculo revisado por pessoa entre `dim_mandato` e uma candidatura).
- **Operação (8 tabelas):** `fat_etapa_contrato`, `rel_formulario_contrato`, `fat_submissao`, `fat_resposta_metrica`, `fat_encontro`, `rel_encontro_participante`, `rel_integracao_contrato`, `fat_artefato`.
- **Planejamento (7 tabelas):** `dim_planejamento`, `rel_planejamento_preditor`, `fat_objetivo_especifico`, `fat_meta`, `fat_sucesso_mensal`, `fat_gip`, `fat_gip_dimensao`.
- **Incidência (5 tabelas):** `fat_registro`, `fat_insight`, `rel_insight_origem`, `fat_fato_gerador`, `rel_fato_origem`.
- **Saída (1 tabela + 6 views/MVs):** `fat_snapshot_mensal`; `vw_contrato`, `vw_etapa_contrato`, `vw_sucesso_mensal`, `mv_numeros_impacto`, `mv_iip_contrato`, `mv_avaliacao_nps`, `vw_visao_mandato`, `vw_carteira`, `vw_gip_evolucao`, `vw_pendencias`.
- **Staging (1 tabela, descartável):** `stg.map_legado`.
- **TSE — projeção agregada:** `tse.mv_candidatura_resumo` (única superfície que a aplicação consulta; nunca as tabelas `tse.*` diretamente).

**Provisionamento é incremental, não integral.** Diferente de uma versão anterior deste documento, **nem todas as 51 tabelas estão criadas no projeto Supabase hoje** — o schema acima é o modelo *aprovado*, não o estado *atual* do banco. Cada feature migra e provisiona só as tabelas (e funções/índices) de que precisa, extraídas de `docs/schema_sistema.sql`, verificando antes o que já existe no projeto remoto para não recriar nada. Ver AD-025 em `.specs/STATE.md`.


