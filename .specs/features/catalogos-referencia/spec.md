# Catálogos de Referência (Trilha C) Specification

## Problem Statement

O banco tem hoje 17 das 51 tabelas do modelo aprovado (`.specs/roadmap.md` §1.2). Dos 16 catálogos `ref_*` previstos em `docs/schema_sistema.sql`, só 4 existem (`ref_produto`, `ref_projeto`, `ref_cargo`, `ref_partido`). As 12 que faltam — `ref_etapa`, `ref_tipo_registro`, `ref_formulario`, `ref_metrica_formulario`, `ref_preditor`, `ref_agenda_tematica`, `ref_perfil_atuacao`, `ref_pilar_insight`, `ref_indicador`, `ref_nivel_iip`, `ref_tipologia`, `ref_dimensao_gip` — são pré-requisito estrutural de **tudo** que vem depois: nenhuma tabela de Operação, Planejamento ou Incidência (roadmap §5 e §6) pode ser criada sem o catálogo que ela referencia por FK. Enquanto essas 12 tabelas não existirem, a régua de etapas, os 16 formulários, a hierarquia de Planejamento e o cálculo do IIP não têm onde se apoiar — é o gargalo estrutural nº 1 do roadmap hoje.

Esta é também a aplicação concreta da regra inegociável da Constituição (§6, regra 6): *"Limiar e regra de negócio não são código — vivem em tabela de referência editável."* Sem essas 12 tabelas, qualquer regra de negócio que dependa delas (peso de etapa, peso do IIP, tempo esperado por etapa, tipologia dos fatos geradores) teria de nascer hardcoded, violando essa regra desde o primeiro dia.

## Goals

- [ ] As 12 tabelas `ref_*` existem no schema `public`, com colunas, `CHECK`, `UNIQUE` e `FOREIGN KEY` idênticos ao aprovado em `docs/schema_sistema.sql`.
- [ ] As 12 tabelas têm um padrão de acesso uniforme (RLS desabilitada + GRANT por papel, consistente com o precedente das 4 já existentes) — nenhuma fica de fora por esquecimento.
- [ ] As 9 tabelas cujo conteúdo real já está aprovado verbatim no schema (`docs/schema_sistema.sql` §16) nascem semeadas — não vazias esperando um segundo passo evitável.
- [ ] As 3 tabelas cujo conteúdo depende de levantamento com o time de Monitoramento (`ref_agenda_tematica`, `ref_indicador`, `ref_tipologia`) existem prontas para receber esse conteúdo, sem bloquear a criação da estrutura.
- [ ] Um smoke test de leitura por papel confirma que cada uma das 5 roles `legisla_*` lê as 12 tabelas, e que acesso não autenticado é negado.

## Out of Scope

Explicitamente excluído. Documentado para prevenir scope creep.

| Feature | Reason |
| ------- | ------ |
| `/admin/catalogos` (CRUD administrado dos catálogos via UI) | Roadmap §4 Trilha C: "fora de escopo nesta fatia... a tela de edição é conveniência e entra quando o Admin tiver mais o que administrar". Mesma exclusão já registrada em `fundacao-entidades-pessoas` (FND-05). A regra constitucional (§6, AD-004) exige tabela editável — que passa a existir aqui —, não necessariamente edição via tela. |
| Conteúdo real de `ref_agenda_tematica`, `ref_indicador`, `ref_tipologia` | Levantamento de dado com o time de Monitoramento — trabalho humano, não deste agente. Ver CAT-16. As tabelas nascem estruturadas, o conteúdo é follow-up rastreado. |
| Seed de `ref_etapa` para o produto Coalizão | **D9 resolvida por Pedro em 2026-08-10: clona a régua da Estratégia.** Segue como migração de seed separada (CAT-17), não incluída na migração de estrutura desta fatia. |
| Aritmética final do IIP (D2) | `.specs/roadmap.md` §2: "não bloqueia — o número entra rotulado como provisório na onda de Incidência". `ref_indicador.peso_iip` existe como coluna; o valor real de cada peso é parte do levantamento (CAT-16), não da fórmula. |
| RPC `app.instanciar_contrato`, `dim_planejamento`, régua no detalhe do contrato | Roadmap §5.1 (Onda de Operação) — depende desta feature existir primeiro, não o contrário. |
| Qualquer tabela de Operação/Planejamento/Incidência que referencia estes catálogos (`fat_etapa_contrato`, `dim_planejamento`, `fat_meta`, `fat_fato_gerador` etc.) | Fora da Trilha C — entram nas ondas §5/§6 do roadmap. |
| Migração real, execução no banco, fases Tasks/Execute | Esta sessão para em Design (restrição explícita da task) — não escrever em `supabase/migrations/`, não tocar o banco. |
| Correção do gap de "escrita só para admin" nos 4 catálogos já existentes (`ref_produto`/`ref_projeto`/`ref_cargo`/`ref_partido`) | Tensão documentada em `context.md`; exigiria migração tocando tabela que não é desta feature — candidato a item avulso de Trilha E. |

---

## Assumptions & Open Questions

Toda ambiguidade é resolvida ou registrada aqui — nada fica silenciosamente pouco claro.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | --------------- | --------- | ---------- |
| RLS vs. GRANT nas 12 tabelas novas | RLS desabilitada, controle só por GRANT | Precedente de código (`0024_ref_tables_rls_fix.sql`) + o próprio `docs/schema_sistema.sql` nunca liga RLS em `ref_*` (§11) e isenta catálogo da asserção de deploy de RLS (§15, filtra por `id_contrato`). AD-008 trata o schema aprovado como fonte de verdade do desenho. | y (agent's discretion, ver ressalva a Pedro em `context.md`) |
| `anon` no GRANT das 12 tabelas novas | Excluído — diferente do precedente de `0024` | AD-002 é regra inegociável sem exceção documentada para catálogo: "nenhum acesso é anônimo — nem leitura". Usuário autenticado sem papel específico (`authenticated`) já é suficiente para qualquer combobox do frontend, que nunca opera sem sessão. | y (agent's discretion, decisão mais restritiva prevalece sobre replicar o gap) |
| Escopo de leitura por papel | `SELECT` para as 5 roles `legisla_*` (app, admin, gestora, mentor, assessor) | Completa a lacuna do precedente de `0024` (que só cobria app/admin/gestora) — o próprio §14 do schema aprovado já concede leitura ampla de catálogo a mentor e a itens específicos de catálogo a assessor. | y (agent's discretion) |
| Escopo de escrita por papel | `INSERT/UPDATE/DELETE` para app/admin/gestora (mesmo padrão do GRANT em bloco já em vigor desde `0004`), só `SELECT` para mentor/assessor | Replica o padrão real já em produção (não o comentário "escrita só para admin" do §14, que já está divergente nos 4 catálogos existentes). Corrigir esse gap nos 4 antigos é fora de escopo. | y (agent's discretion, ver ressalva a Pedro) |
| Seed das 9 tabelas com conteúdo já aprovado | Entra nesta feature, via `INSERT ... ON CONFLICT DO NOTHING` na própria migração (nunca `seed_test.sql`) | É dado de negócio aprovado (`docs/schema_sistema.sql` §16, verbatim), não dado de teste — vale para dev e produção igualmente, mesmo padrão de `0007`/`0020`/`0021`. | y |
| Seed de `ref_agenda_tematica`/`ref_indicador`/`ref_tipologia` | Fora desta feature — tabelas nascem vazias, conteúdo é follow-up | O próprio schema aprovado admite que esse conteúdo "vêm por ETL/carga" — nem o autor do schema o inventou. É levantamento com Monitoramento, trabalho humano. | y |
| Seed de `ref_etapa` para Coalizão | Clona a régua da Estratégia (`INSERT` de `docs/schema_sistema.sql:2254-2259`), como migração de seed separada | Ver seção D9 abaixo — decisão de Pedro, registrada. | y (Pedro, 2026-08-10) |
| Agrupamento das 12 tabelas em uma ou mais migrações | Fica com o Design | Decisão técnica sem impacto de produto; `context.md` já registra como discrição do agente. | y (agent's discretion) |
| Local dos testes de smoke/integração | Fica com o Design | Idem — decisão técnica. | y (agent's discretion) |
| Emenda formal a AD-001 explicitando a exceção de catálogo | Não feita nesta sessão | `STATE.md` é read-only para este agente (restrição explícita da task); registrado como recomendação no relatório final. | y (assumption logged, not asked) |

**Open questions:**

### D9 — Régua de etapas da Coalizão — **RESOLVIDA (Pedro, 2026-08-10)**

A régua de etapas da Coalizão (`ref_etapa` para o produto "Coalizão") **clona a régua da Estratégia** (Cadastro → Pontapé → Raio-X → Imersão → Governança/Organograma → Monitoramento → Replicação) — Pedro confirmou a hipótese que `docs/schema_sistema.sql` (D9, linha 35) já deixava pronta, com o `INSERT` de clonagem escrito e comentado (linhas 2251-2262). CAT-17 deixa de estar bloqueado e segue para Design como qualquer outro requisito desta feature — como migração de seed separada da estrutura das 12 tabelas (mesma lógica das 9 tabelas de P1: dado de negócio aprovado, não schema novo).

---

## User Stories

### P1: As 12 tabelas existem com a estrutura aprovada, acesso uniforme e smoke test ⭐ MVP

**User Story**: Como sistema (e como qualquer feature futura de Operação/Planejamento/Incidência), preciso que as 12 tabelas `ref_*` faltantes existam com a estrutura exata do modelo aprovado, um padrão de RLS/GRANT consistente e testável por papel, para que eu tenha uma FK válida para apontar quando cada camada acima for construída.

**Why P1**: É o pré-requisito estrutural não-negociável do roadmap (§4 Trilha C) — nenhuma tabela de Operação/Planejamento/Incidência pode nascer sem o catálogo que referencia.

**Acceptance Criteria**:

1. WHEN a migração desta feature roda contra um banco que já tem os 4 catálogos e a Fundação provisionados THEN o sistema SHALL criar as 12 tabelas com as colunas, `DEFAULT`, `CHECK` e `UNIQUE` exatamente como em `docs/schema_sistema.sql:170-301`, sem alterar nenhuma das 4 tabelas já existentes.
2. WHEN `ref_etapa` é criada THEN o sistema SHALL aplicar `FOREIGN KEY (id_produto) REFERENCES ref_produto(id_produto)`, `UNIQUE (id_produto, codigo)`, `UNIQUE (id_produto, ordem)` e `CHECK (duracao_prevista_dias IS NULL OR duracao_prevista_dias > 0)`.
3. WHEN `ref_tipo_registro` é criada THEN o sistema SHALL aplicar `FOREIGN KEY (id_etapa) REFERENCES ref_etapa(id_etapa)`, `UNIQUE (id_etapa, codigo)` e `CHECK (qtd_prevista IS NULL OR permite_multiplos)`.
4. WHEN `ref_formulario` é criada THEN o sistema SHALL aplicar `FOREIGN KEY (id_etapa) REFERENCES ref_etapa(id_etapa)`, `UNIQUE (codigo)` e `CHECK (respondente IS NULL OR respondente IN ('assessor','cargo_cg_parlamentar','gestora','mentor','mentorado','mandato'))`.
5. WHEN `ref_metrica_formulario` é criada THEN o sistema SHALL aplicar `FOREIGN KEY (id_formulario) REFERENCES ref_formulario(id_formulario) ON DELETE CASCADE`, `UNIQUE (id_formulario, codigo_campo)`, `CHECK (tipo IN ('escala_0_10','escala_1_5','booleano','numero'))` e o índice único parcial `WHERE eh_nps` (só uma métrica NPS por formulário).
6. WHEN `ref_preditor` é criada THEN o sistema SHALL aplicar `UNIQUE (nome)`.
7. WHEN `ref_agenda_tematica` é criada THEN o sistema SHALL aplicar `UNIQUE (nome)`.
8. WHEN `ref_perfil_atuacao` é criada THEN o sistema SHALL aplicar `UNIQUE (nome)`.
9. WHEN `ref_pilar_insight` é criada THEN o sistema SHALL aplicar `UNIQUE (codigo)` e `UNIQUE (nome)`.
10. WHEN `ref_indicador` é criada THEN o sistema SHALL aplicar `UNIQUE (nome)` e `CHECK (peso_iip >= 0)`.
11. WHEN `ref_nivel_iip` é criada THEN o sistema SHALL usar `codigo TEXT PRIMARY KEY` (chave natural, não `BIGSERIAL`) e `CHECK (valor >= 0)`.
12. WHEN `ref_tipologia` é criada THEN o sistema SHALL aplicar `FOREIGN KEY (id_preditor_1)`/`(id_preditor_2) REFERENCES ref_preditor`, `FOREIGN KEY (nivel_d1_padrao)`/`(nivel_d2_padrao)`/`(nivel_d3_padrao) REFERENCES ref_nivel_iip(codigo)`, `FOREIGN KEY (id_indicador) REFERENCES ref_indicador`, `UNIQUE (grupo, tipologia, estado)` e `CHECK (id_preditor_2 IS NULL OR (id_preditor_1 IS NOT NULL AND id_preditor_2 <> id_preditor_1))`.
13. WHEN `ref_dimensao_gip` é criada THEN o sistema SHALL aplicar `UNIQUE (codigo)` e `CHECK (valor_max > valor_min)`.
14. WHEN qualquer uma das 12 tabelas é consultada por `legisla_app`, `legisla_admin`, `legisla_gestora`, `legisla_mentor` ou `legisla_assessor` (autenticado, via PostgREST) THEN o sistema SHALL retornar as linhas sem erro de permissão.
15. WHEN uma requisição chega sem sessão autenticada (role `anon`) THEN o sistema SHALL negar leitura nas 12 tabelas novas (`permission denied`, nunca 200 com dado).
16. WHEN `legisla_mentor` ou `legisla_assessor` tenta `INSERT`/`UPDATE`/`DELETE` em qualquer uma das 12 tabelas THEN o sistema SHALL negar a escrita.
17. WHEN a migração é reaplicada por engano (idempotência) THEN o sistema SHALL não falhar — `CREATE TABLE IF NOT EXISTS` e `INSERT ... ON CONFLICT DO NOTHING` no mesmo padrão de `0007_catalogos_fundacao.sql`.
18. WHEN o `drift-check` semanal roda depois desta migração THEN o sistema SHALL reportar dev e produção idênticos (nenhuma tabela criada fora de arquivo de migração).

**Independent Test**: Rodar `supabase db push` num banco de dev limpo (só Fundação + 4 catálogos existentes), confirmar que as 12 tabelas aparecem com as constraints certas via `\d ref_etapa` etc., e que um `SELECT` autenticado como cada uma das 5 roles funciona enquanto um `SELECT` sem sessão falha.

---

### P1: Seed das 9 tabelas com conteúdo já aprovado

**User Story**: Como time de Monitoramento, quero que as tabelas cujo conteúdo real já está fechado no schema aprovado (`docs/schema_sistema.sql` §16) nasçam semeadas, para não ter dropdown vazio em nenhuma tela futura que dependa desse catálogo desde o primeiro dia em que a tabela existir.

**Why P1**: Sem isso, cada uma das 9 tabelas exigiria um segundo passo manual (replicando o gap que `0020_seed_ref_partido.sql`/`0021_seed_ref_projeto.sql` tiveram de corrigir depois, para os 4 catálogos antigos) — evitável porque o conteúdo já está aprovado e verbatim no schema.

**Acceptance Criteria**:

1. WHEN `ref_nivel_iip` é semeada THEN o sistema SHALL inserir `baixo`/`medio`/`alto` com `valor` 1/2/3 e `ordem` 1/2/3 (`docs/schema_sistema.sql:2178-2180`).
2. WHEN `ref_preditor` é semeada THEN o sistema SHALL inserir os 5 preditores do GIP na ordem aprovada (`:2182-2188`).
3. WHEN `ref_perfil_atuacao` é semeada THEN o sistema SHALL inserir Fiscalizadora/Legisladora/Articuladora-Mobilizadora (`:2190-2192`).
4. WHEN `ref_pilar_insight` é semeada THEN o sistema SHALL inserir os 4 pilares confirmados pela decisão D5 (`:2195-2200`).
5. WHEN `ref_dimensao_gip` é semeada THEN o sistema SHALL inserir as 4 dimensões da régua de diagnóstico do gabinete, faixa 1-4 (`:2203-2208`).
6. WHEN `ref_etapa` é semeada THEN o sistema SHALL inserir as 7 etapas da Estratégia e as 5 etapas do PLL (`:2224-2249`); a clonagem para o produto Coalizão (D9, resolvida) roda como migração de seed separada — ver CAT-17.
7. WHEN `ref_tipo_registro` é semeada THEN o sistema SHALL inserir os 11 tipos derivados das abas "Registros Slack"/`f_mentorias` (`:2265-2283`), vinculados às etapas de Estratégia/PLL já semeadas.
8. WHEN `ref_formulario` é semeada THEN o sistema SHALL inserir os 16 formulários aprovados (`:2286-2309`), cada um vinculado à sua etapa.
9. WHEN `ref_metrica_formulario` é semeada THEN o sistema SHALL inserir a métrica `nps_recomendacao` para todo formulário cujo `codigo` começa com `avaliacao` (`:2312-2316`).
10. WHEN qualquer um dos 9 `INSERT`s acima roda numa segunda vez (reaplicação) THEN o sistema SHALL não duplicar linha nem falhar (`ON CONFLICT DO NOTHING` na chave natural de cada tabela).

**Independent Test**: Depois da migração, contar linhas de cada uma das 9 tabelas e comparar com o número exato do schema aprovado (ex.: 16 formulários, 12 etapas — 7+5, não 19 — pois Coalizão fica de fora).

---

### P2: Levantamento e seed de conteúdo pendente (`ref_agenda_tematica`, `ref_indicador`, `ref_tipologia`)

**User Story**: Como time de Monitoramento, preciso levantar e validar o conteúdo real de agendas temáticas, pesos de indicador no IIP e a tripla grupo/tipologia/estado dos fatos geradores (com preditores e níveis padrão), para que essas 3 tabelas deixem de estar vazias.

**Why P2**: Não bloqueia a criação da estrutura (CAT-06, CAT-09, CAT-11 entram como P1) nem qualquer uma das outras 9 tabelas — mas bloqueia qualquer feature futura que precise ler conteúdo real dessas 3 (ex.: cálculo do IIP na Incidência, §6.2 do roadmap). É trabalho humano do time de Monitoramento, fora do que este agente pode produzir.

**Acceptance Criteria**:

1. WHEN o time de Monitoramento entrega a lista real de agendas temáticas THEN uma migração de seed separada (mesmo padrão de `0020`/`0021`) SHALL popular `ref_agenda_tematica` — fora desta feature.
2. WHEN o time de Monitoramento confirma o peso de cada indicador no IIP THEN uma migração de seed separada SHALL popular `ref_indicador` — fora desta feature.
3. WHEN o time de Monitoramento confirma a tripla grupo/tipologia/estado (com preditores associados e níveis D1/D2/D3 padrão) THEN uma migração de seed separada SHALL popular `ref_tipologia` — fora desta feature.
4. WHEN nenhum dos três levantamentos acima chegou ainda THEN o sistema SHALL manter as 3 tabelas vazias sem erro — ausência de linha é estado válido, nunca um valor sentinela (AD-005).

**Independent Test**: Não aplicável nesta feature — este bloco é rastreamento de dependência externa, não código a verificar aqui.

---

### P2: Semear a régua da Coalizão (D9 resolvida — clona a Estratégia)

**User Story**: Como sistema, preciso que a régua de etapas da Coalizão exista clonada da Estratégia, para que a instanciação de contrato de Coalizão (roadmap §5.1) tenha o que instanciar.

**Why P2**: Não bloqueia nenhuma das outras 11 tabelas nem as etapas de Estratégia/PLL em `ref_etapa` — sem esta seed, só a Coalizão como produto com planejamento próprio fica sem régua.

**Acceptance Criteria**:

1. WHEN esta feature avança para Design/Tasks THEN o `INSERT` já escrito e comentado em `docs/schema_sistema.sql:2254-2259` SHALL rodar como migração de seed separada, sem alteração de estrutura.
2. WHEN a migração de seed roda uma segunda vez (reaplicação) THEN o sistema SHALL não duplicar linha (`ON CONFLICT DO NOTHING` na chave natural).
3. WHEN a régua da Coalizão ainda não tiver rodado (ordem de execução dentro do Design) THEN o sistema SHALL continuar funcionando para Estratégia e PLL sem degradação — `ref_etapa` sem linha para Coalizão não impede leitura nem escrita nas outras linhas.

**Independent Test**: Depois da migração, `SELECT` em `ref_etapa WHERE id_produto = (SELECT id_produto FROM ref_produto WHERE nome = 'Coalizão')` retorna as mesmas 7 etapas da Estratégia (nomes e ordem idênticos).

---

## Edge Cases

- WHEN a migração tenta criar `ref_tipo_registro`/`ref_formulario` antes de `ref_etapa` existir na mesma transação THEN o sistema SHALL falhar por FK inexistente — mitigado pela ordem interna correta dentro do(s) arquivo(s) de migração (Design define o agrupamento).
- WHEN a migração tenta semear `ref_tipologia` antes de `ref_preditor`/`ref_nivel_iip`/`ref_indicador` existirem THEN o sistema SHALL falhar por FK inexistente — não aplicável nesta feature porque `ref_tipologia` não é semeada aqui (conteúdo pendente, CAT-16), mas a tabela deve ser criada depois das 3 na ordem de `CREATE TABLE`.
- WHEN alguém tenta inserir uma segunda métrica NPS (`eh_nps = true`) no mesmo formulário THEN o sistema SHALL rejeitar via o índice único parcial `uq_metrica_nps_por_formulario`.
- WHEN alguém tenta inserir `ref_tipologia` com `id_preditor_2 = id_preditor_1` THEN o sistema SHALL rejeitar via `ck_tipologia_preditores`.
- WHEN alguém tenta inserir `ref_dimensao_gip` com `valor_max <= valor_min` THEN o sistema SHALL rejeitar via `ck_dimensao_faixa`.
- WHEN um papel sem GRANT nenhum (ex.: role Postgres nova, não listada) tenta ler qualquer uma das 12 tabelas THEN o sistema SHALL negar (`permission denied for table`), nunca retornar linha vazia silenciosa.
- WHEN o smoke test roda contra `ref_agenda_tematica`/`ref_indicador`/`ref_tipologia` (vazias) THEN o sistema SHALL retornar 0 linhas sem erro — tabela vazia é estado válido enquanto o levantamento (CAT-16) não chega.

---

## Requirement Traceability

Cada requisito recebe um ID único para rastreamento entre design, tasks e validação.

| Requirement ID | Story | Phase | Status |
| --------------- | ----- | ------ | ------ |
| CAT-01 | P1: Estrutura das 12 tabelas — `ref_etapa` | Execute | ✅ Verified (`50640f7`; teste de `uq_etapa_produto_ordem` fechado em `38da907`) |
| CAT-02 | P1: Estrutura das 12 tabelas — `ref_tipo_registro` | Execute | ✅ Verified (`50640f7`; teste de `uq_tipo_registro_etapa_codigo` fechado em `38da907`) |
| CAT-03 | P1: Estrutura das 12 tabelas — `ref_formulario` | Execute | ✅ Verified (`50640f7`; teste de FK `id_etapa` fechado em `38da907`) |
| CAT-04 | P1: Estrutura das 12 tabelas — `ref_metrica_formulario` | Execute | ✅ Verified (`50640f7`; mutante do índice parcial morto + `uq_metrica_form_campo` testada em `38da907`, ver `validation.md` Round 2) |
| CAT-05 | P1: Estrutura das 12 tabelas — `ref_preditor` | Execute | ✅ Verified (`50640f7`) |
| CAT-06 | P1: Estrutura das 12 tabelas — `ref_agenda_tematica` | Execute | ✅ Verified (`50640f7`) |
| CAT-07 | P1: Estrutura das 12 tabelas — `ref_perfil_atuacao` | Execute | ✅ Verified (`50640f7`) |
| CAT-08 | P1: Estrutura das 12 tabelas — `ref_pilar_insight` | Execute | ✅ Verified (`50640f7`; teste de UNIQUE(`nome`) fechado em `38da907`) |
| CAT-09 | P1: Estrutura das 12 tabelas — `ref_indicador` | Execute | ✅ Verified (`50640f7`) |
| CAT-10 | P1: Estrutura das 12 tabelas — `ref_nivel_iip` | Execute | ✅ Verified (`50640f7`) |
| CAT-11 | P1: Estrutura das 12 tabelas — `ref_tipologia` | Execute | ✅ Verified (`50640f7`; FKs de `nivel_d2/d3_padrao`, `id_indicador`, `id_preditor_1` fechadas em `38da907` — nota residual de baixíssima materialidade: `id_preditor_2` individual segue sem teste próprio, ver `validation.md` Round 2) |
| CAT-12 | P1: Estrutura das 12 tabelas — `ref_dimensao_gip` | Execute | ✅ Verified (`50640f7`) |
| CAT-13 | P1: Padrão de acesso uniforme (RLS desabilitada + GRANT por papel) | Execute | ✅ Verified (`d996a67`) |
| CAT-14 | P1: Provisionamento incremental (AD-025) — migração nova, sem redesenhar o aprovado, sem tocar os 4 catálogos existentes | Execute | ✅ Verified (`50640f7`) |
| CAT-15 | P1: Seed real das 9 tabelas com conteúdo já aprovado (§16 do schema) | Execute | ✅ Verified (`e88ac11`; AC10 estendido às 9 tabelas em `38da907`) |
| CAT-16 | P2: Levantamento com Monitoramento + seed futuro de `ref_agenda_tematica`/`ref_indicador`/`ref_tipologia` | Execute | Pending (bloco de rastreamento — trabalho humano fora desta feature, ver `tasks.md` Notes) |
| CAT-17 | P2: D9 — régua de etapas da Coalizão (clona Estratégia) | Execute | ✅ Verified (`93e5e67`) |
| CAT-18 | P1: Smoke test de leitura por papel (5 roles `legisla_*` + `anon` negado) | Execute | ✅ Verified (`d996a67`) |

**ID format:** `CAT-[NÚMERO]` (Catálogos).

**Status values:** Pending → In Design → In Tasks → Implementing → Verified.

**Coverage:** 18 total, 18 especificados, 18 desenhados (`design.md`), 4 tasks executadas (`tasks.md`) cobrindo os 17 requisitos de código (CAT-16 é rastreamento, sem código). Verificado por Verifier independente em 2026-08-10 (`validation.md`): Round 1 — 11/17 ✅ Verified, 6/17 ❌ Needs Fix. Round 2 (fix→re-verify, commit `38da907`) — **17/17 ✅ Verified**, discrimination sensor 3/3 mortas, gate da fatia da feature 56/56 verde, `npx eslint supabase/tests/catalogos/` limpo — ver `validation.md` Round 2 para evidência completa.

---

## Success Criteria

Como saberemos que a feature foi bem-sucedida (quando as fases Tasks/Execute rodarem, fora desta sessão):

- [ ] `supabase db push` aplica as 12 tabelas num banco de dev limpo sem erro, e o `drift-check` seguinte reporta dev e produção idênticos.
- [ ] As 9 tabelas com conteúdo aprovado têm exatamente o número de linhas do schema aprovado (16 formulários, 12 etapas — 7 Estratégia + 5 PLL —, 5 preditores, 3 perfis, 4 pilares, 4 dimensões GIP, 3 níveis IIP, 11 tipos de registro, 1 métrica NPS por formulário de avaliação).
- [ ] Nenhuma das 4 tabelas já existentes (`ref_produto`, `ref_projeto`, `ref_cargo`, `ref_partido`) é alterada por esta feature.
- [ ] O smoke test de leitura por papel roda verde para as 5 roles `legisla_*` e confirma negação para `anon`.
- [x] D9 resolvida por Pedro em 2026-08-10 (clona a régua da Estratégia) — não decidido por suposição, não silenciosamente adiado sem rastro.
