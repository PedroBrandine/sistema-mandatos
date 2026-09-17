# Planejamento Estratégico v2 Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** Do not search for skill files by
filesystem path. The skill is the source of truth for the full flow (per-task
cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed.**

---

**Design**: `.specs/features/planejamento-estrategico-v2/design.md`
**Status**: In Progress — **Fases 1 a 4 completas + emenda AD-059, Fase 5 iniciada** (19/26 tarefas)
**Gate AD-039**: ✅ satisfeito (Pedro, 2026-09-15)

### Progresso

| Fase | Tarefas | Situação |
| --- | --- | --- |
| 1 — Schema | T1–T5 | ✅ **completa**, 5 commits, 37 testes de integração |
| 2 — Backend TS | T6–T10 | ✅ **completa**, 5 commits, 845 unitários |
| 3 — Módulos puros | T11–T13 | ✅ **completa**, 3 commits, 881 unitários |
| 4 — Permissões/abas | T14–T16 | ✅ **completa**, 3 commits, 912 unitários |
| 4b — Emenda AD-059 | T26–T27 | ✅ **completa**, 2 commits, 957 unitários |
| 5 — Modais | T17–T20 | 🔶 em andamento, T17 completa |
| 6 — Tela | T21–T23, T25 | ⬜ |

| Task | Commit | Testes |
| --- | --- | --- |
| T1 status no Objetivo | `9969aaa` | 4 integração |
| T2 cascata + AD-035 + trigger | `34d27b6` | 7 integração |
| T3 responsável no SM | `597b8b3` | 4 integração |
| T4 views KPI/evolução | `ce6b1c7` | 11 integração |
| T5 RPCs lote/mover | `e0d145e` | 11 integração |
| T6 schemas Zod | `1ca6665` | 56 unitários no arquivo |
| T7 query de KPIs | `ceec549` | 5 unitários |
| T8 query de evolução | `1a578ef` | 8 unitários |
| T9 grade: atraso + responsável | `c0acdbb` | 7 unitários |
| T10 wrappers de RPC | `8fef623` | 7 unitários |
| T11 avanço mensal | `45300b5` | 11 unitários |
| T12 expansão de lote | `3ff7085` | 15 unitários |
| T13 responsável herdado | `37bbf4b` | 10 unitários |
| T14 capacidade moveHierarquia | `86ffdce` | 53 no arquivo |
| T15 abas diagnóstico/estrutura | `0d6221d` | 10 de render |
| T16 aba Diagnóstico em cartões | `749a568` | 12 de render |
| T26 remove seletor de modo (AD-059) | `32b7d83` | 957 unitários |
| T27 cartões fiéis ao `57:671` | `32b7d83` | 11 de render |
| T17 status e preditores no ObjetivoForm | `3ce25a9`* | 11 de render |
| Fix: remove GIP duplicado do Diagnóstico | `5483f97` | — (remoção) |

\* **Atribuição incorreta, registrada aqui para quem ler o histórico depois.**
`3ce25a9` tem mensagem `feat(ficha): formulario de registro com camada
dinamica e presentes` e é de outra sessão/feature. Concorrência entre sessões
Claude Code ativas simultaneamente no mesmo working directory: T17 foi
staged (`git add`) e, antes do `git commit` desta sessão rodar, a outra
sessão commitou primeiro — um `git commit` sem pathspec inclui todo o índice
compartilhado, não só os arquivos que aquela sessão pretendia. O código está
correto e testado (11/11 passando, ver diff do commit); só a mensagem e a
autoria do commit não correspondem ao conteúdo de `objetivo-form.tsx`/
`.test.tsx`. Não revertido nem re-commitado: o branch já avançou por cima
desse commit, e reescrever histórico compartilhado é mais arriscado que
conviver com a mensagem errada. Commits seguintes desta sessão passam a usar
`git commit -F- -- <arquivos>` (pathspec explícito) para que isto não se
repita.

**Todas as 5 migrations aplicadas em dev** (`npnvoolkebhabjkjzqwn`), uma de cada
vez, com gate escopado entre elas. Produção intocada.

**Gate Build de fim de Fase 1** (2026-09-16): `npm run build` ✅ · suíte completa
de integração **551 testes, 548 passaram**. As 3 falhas
(`vw-pendencias-limiar`, `auditoria-gap`, `fn-marcar-vigente`) foram
**timeouts transitórios**, não regressões: re-rodadas isoladas dão **22/22, exit 0**.
Nenhuma é de planejamento. A corrida levou 2h15 em série contra a nuvem, com
outra sessão disputando o mesmo banco de dev — condição exata que o
`vitest.integration.config.ts` documenta como origem de falha transitória.

> ⚠️ **Gate Build bloqueado por defeito pré-existente.** `npm run build` passa,
> mas `npm run lint:all` falha com **10 erros** em `src/frontend/app/(app)/coalizoes/`
> — `setState` síncrono dentro de effect e afins. Verificado: os **mesmos 10
> erros já existiam em `b3c949b`**, o HEAD do início da sessão, e nenhum arquivo
> de frontend foi tocado pela Fase 1 (os 5 commits mexem só em `supabase/`).
> Não é regressão desta feature e consertar seria scope creep em área alheia —
> mas **o gate Build não fecha nesta branch** até alguém tratar isso.

> ⚠️ **Ambiente**: confira `cat supabase/.temp/project-ref` antes de qualquer
> `db push`. Deve ser `npnvoolkebhabjkjzqwn` (**dev**). Produção é
> `dgoutrbqfuyaroobhxdq` e **nunca** recebe push manual — `deploy-db.yml` faz
> isso no merge em `master`. Migration nova só com `supabase migration new`.

---

## Test Coverage Matrix

> Gerada de código + diretrizes do projeto + spec. **Diretrizes encontradas:**
> `CLAUDE.md` (comandos), `vitest.config.ts` + `vitest.integration.config.ts`
> (includes e ambientes), e as decisões **AD-042** (harness obrigatório, AC de
> UI só conta com teste de render), **AD-044** (deps na raiz) e **AD-046**
> (corte de profundidade — **não se aplica a esta feature**, é restrito a
> `redesenho-estrategia-tela-first`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Migration / DDL / constraint | integration | Cada constraint aceita os valores válidos **e** recusa os inválidos; default verificado | `supabase/tests/**/*.integration.test.ts` | `npm run test:integration` |
| Função Postgres (cascata, RPC) | integration | Todos os ramos + atomicidade + caso de borda de cada AC | `supabase/tests/**/*.integration.test.ts` | `npm run test:integration` |
| View SQL | integration | Cada regra da AC: filtro de status, `COALESCE`, `P=0` → NULL, filtro por responsável | `supabase/tests/**/*.integration.test.ts` | `npm run test:integration` |
| Schema Zod | unit | 1:1 com as constraints espelhadas; caminho válido e inválido de cada `.refine()` | `src/backend/schemas/*.test.ts` | `npm run test:unit` |
| Backend query / rpc wrapper | unit | Caminhos-chave + mapeamento de erro; nome de RPC e serialização snake_case asseridos | `src/backend/{queries,rpc}/*.test.ts` | `npm run test:unit` |
| Módulo puro de frontend | unit | Todos os ramos; 1:1 com as ACs da spec; cada edge case listado | `src/frontend/**/*.test.ts` | `npm run test:unit` |
| Componente React | component (jsdom) | **Profundidade integral AD-042**: os dois lados de cada condicional, estado vazio e estado de erro | `src/frontend/**/*.test.tsx` | `npm run test:unit` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tarefas só com teste unitário/componente | `npm run test:unit` |
| Full | Tarefas que tocam SQL (migration, função, view) | `npm run test:unit && npm run test:integration -- supabase/tests/planejamento` |
| Build | **Fim de fase** | `npm run lint:all && npm run build && npm run test:unit && npm run test:integration` (suíte **inteira**) |

> **Escopo do gate Full ajustado em 2026-09-16, achado de execução.** A suíte de
> integração roda **75 arquivos em série** contra o projeto Supabase de dev na
> nuvem (sem Docker local) — uma execução leva ~30 min, e o próprio
> `vitest.integration.config.ts` documenta que paralelizar derrubava o CLI sob
> carga. Rodar a suíte inteira nas 5 tarefas da Fase 1 custaria horas de relógio
> e aumentaria a chance de falha transitória de rede ser lida como regressão.
>
> Por tarefa, o gate roda os testes de integração **da feature**; a suíte
> completa roda **uma vez, no gate Build de fim de fase**, que é onde a
> regressão em outra área precisa aparecer. O sinal de regressão global é
> preservado no limite que importa, sem pagá-lo cinco vezes.

---

## Execution Plan

### Phase 1: Schema (5)
```
T1 → T2 → T3 → T4 → T5
```
### Phase 2: Backend TypeScript (5)
```
T6 → T7 → T8 → T9 → T10
```
### Phase 3: Módulos puros (3)
```
T11 → T12 → T13
```
### Phase 4: Permissões, abas e Diagnóstico (3)
```
T14 → T15 → T16
```
### Phase 5: Modais (4)
```
T17 → T18 → T19 → T20
```
### Phase 6: Tela (4)
```
T21 → T22 → T23 → T25
```
> **T24 removida em 2026-09-16** (decisão de Pedro: não é preciso mover itens
> nesta página). PLV-10 foi para Out of Scope na `spec.md`. A numeração das
> demais **não muda** — renumerar quebraria as referências já despachadas ao
> worker do Lote 1.

---

## Task Breakdown

### T1: Coluna `status` no Objetivo Específico
**What**: migration que adiciona `status` + `ck_objetivo_status`.
**Where**: `supabase/migrations/<ts>_planejamento_v2_objetivo_status.sql`
**Depends on**: None · **Requirement**: PLV-02
**Done when**:
- [ ] `status TEXT NOT NULL DEFAULT 'ativo'` criado
- [ ] `ck_objetivo_status CHECK (status IN ('ativo','pausado','descartado'))`
- [ ] Integration test: os 3 valores passam, um 4º é recusado, default é `ativo`
- [ ] Objetivos preexistentes ficam `ativo` sem quebrar
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration · **Gate**: full
**Commit**: `feat(planejamento): status no objetivo especifico (PLV-02)`

---
### T2: Emenda a `app.recalcula_atingimento`
**What**: `CREATE OR REPLACE` filtrando `status='ativo'` no nível raiz.
**Where**: `supabase/migrations/<ts>_planejamento_v2_cascata_status_objetivo.sql`
**Depends on**: T1 · **Requirement**: PLV-02 (AD-052)

> **Acrescentado em 2026-09-16, achado do worker do Lote 1 — gap do meu design:**
> `CREATE OR REPLACE FUNCTION` **reseta todo atributo não declarado**, e
> `app.recalcula_atingimento` é `SECURITY DEFINER SET search_path` desde
> **AD-035**. Omitir isso reintroduz exatamente o `42501` que AD-035 foi criada
> para consertar — o que quebra Assessor e Mentor escrevendo na planilha, a
> tela mais acessada do sistema. **Re-declarar é obrigatório**, com teste que
> fixa o atributo.
>
> Também: a **AC3** de PLV-02 ("objetivo não-ativo marca o planejamento como
> desatualizado") não tem trigger hoje e nenhuma outra task a cobre. Sem ela a
> cascata muda o número mas a faixa "Recalcular agora" nunca aparece. O trigger
> espelha `app.trg_marca_por_meta_upd`, que já existe.

**Done when**:
- [ ] Nível raiz passa a ter `AND o.status = 'ativo'`; níveis 1 e 2 **intactos**
- [ ] Função re-declarada como `SECURITY DEFINER` com `SET search_path` (AD-035)
- [ ] Teste de integração **fixa** o atributo `SECURITY DEFINER` (não só o resultado)
- [ ] Teste de integração: Assessor consegue escrever em `fat_sucesso_mensal` sem `42501`
- [ ] Trigger de marcação em `fat_objetivo_especifico` cobrindo a AC3, espelhando `trg_marca_por_meta_upd`
- [ ] Integration: 2 objetivos (100% e 0%) → plano 50%; pausar o de 0% → 100%
- [ ] Integration: todos os objetivos não-ativos → `pct_atingimento` **NULL**, não 0
- [ ] Integration: regressão — cascata de Meta/SM segue com o resultado anterior
- [ ] Comentário no arquivo cita AD-052 e por que emenda decisão anterior
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration · **Gate**: full
**Commit**: `feat(planejamento): cascata exclui objetivo nao-ativo (AD-052)`

---
### T3: `id_usuario_responsavel` no Sucesso Mensal
**What**: migration com a coluna de responsável.
**Where**: `supabase/migrations/<ts>_planejamento_v2_sucesso_responsavel.sql`
**Depends on**: None · **Requirement**: PLV-03

> **Alterado em 2026-09-16** (decisão de Pedro): a coluna `ordem` saiu desta
> tarefa junto com PLV-10. Sem o arrastar, ela nasceria sem consumidor — e
> migration é forward-only: coluna morta só sai com outro arquivo.

**Done when**:
- [ ] `id_usuario_responsavel BIGINT REFERENCES dim_usuario(id_usuario)` nullable
- [ ] **Nenhuma** coluna `ordem` criada
- [ ] `atualizado_por` **preservado** (auditoria, AD-006) — não é a mesma coisa
- [ ] Integration: FK recusa usuário inexistente; aceita NULL
- [ ] Gate: full

**Tests**: integration · **Gate**: full
**Commit**: `feat(planejamento): responsavel no sucesso mensal (PLV-03)`

---
### T4: Views de KPI, evolução mensal e atraso
**What**: `vw_planejamento_kpi`, `vw_planejamento_evolucao_mensal`, atraso na grade.
**Where**: `supabase/migrations/<ts>_planejamento_v2_views_kpi_evolucao.sql`
**Depends on**: T3 · **Requirement**: PLV-11, PLV-12, PLV-13
**Done when**:
- [ ] Séries Esperado/Atingido conforme a fórmula do design
- [ ] Integration: SM de Meta **não-ativa** fica fora das duas séries (AC4)
- [ ] Integration: `pct` NULL conta 0 (AC6, mesmo `COALESCE` da cascata)
- [ ] Integration: `P=0` devolve **NULL**, não 0% (AC7)
- [ ] Integration: filtro por responsável recalcula `P` no subconjunto (AC5)
- [ ] **Nenhuma coluna `atraso_dias` nova.** `vw_sucesso_mensal` já expõe `esta_atrasado` = `(status = 'pendente' AND dt_limite < CURRENT_DATE)` — que é exatamente a regra de PLV-12 AC1. O defeito está só em `dias_atraso` (`GREATEST` devolve **0** com `dt_limite` NULL). Criar um gêmeo `atraso_dias` ao lado de `dias_atraso` na mesma view deixaria dois nomes quase idênticos para sempre, e alguém escolheria o errado. O par existente resolve: **T9 deriva** `atrasoDias = esta_atrasado ? dias_atraso : null`
- [ ] `dias_atraso` e `esta_atrasado` ficam **inalterados** — há consumidor vivo
- [ ] Integration: KPI com plano sem metas devolve NULL (PLV-11 AC4)
- [ ] Gate: full

**Tests**: integration · **Gate**: full
**Commit**: `feat(planejamento): views de kpi, evolucao mensal e atraso (PLV-11/12/13)`

---
### T5: RPCs de lote e de mover na hierarquia
**What**: `app.cria_sucessos_mensais_lote` e `app.move_item_hierarquia`, `SECURITY INVOKER`.
**Where**: `supabase/migrations/<ts>_planejamento_v2_rpc_lote_e_mover.sql`
**Depends on**: T2, T3 · **Requirement**: PLV-06, PLV-09 (AD-024)
**Done when**:
- [ ] Ambas `SECURITY INVOKER` (AD-024) — RLS do usuário continua valendo
- [ ] Lote: N meses → N linhas irmãs, mesma descrição/peso/responsável
- [ ] Lote: dispara **uma** cascata, não N (AC6)
- [ ] Lote: atômica — falha no meio não deixa linha parcial
- [ ] Lote: recusa lista vazia e limita a 12 meses
- [ ] Mover: atualiza a FK e marca origem **e** destino desatualizados
- [ ] Mover: recusa destino de outro contrato (PLV-09 AC4)
- [ ] Integration cobrindo cada item acima
- [ ] Gate: full

**Tests**: integration · **Gate**: full
**Commit**: `feat(planejamento): rpc de lote e de mover hierarquia (PLV-06/PLV-09)`

---
### T6: Schemas Zod atualizados
**What**: `status` no objetivo; `id_usuario_responsavel`/`ordem` no SM; schema do lote.
**Where**: `src/backend/schemas/planejamento.ts` (modificar)
**Depends on**: T1, T3 · **Requirement**: PLV-02, PLV-03, PLV-06
**Done when**:
- [ ] `objetivoEspecificoSchema.status` enum `ativo|pausado|descartado`, sem `.default()` (convenção do arquivo)
- [ ] `sucessoMensalSchema` ganha **`id_usuario_responsavel`** opcional (sem `ordem` — PLV-10 cortada)
- [ ] `sucessoMensalLoteSchema` com `meses: string[]` — cada um `YYYY-MM-01`, 1..12 itens
- [ ] SWOT continua ausente (AD-049)
- [ ] Unit: válido e inválido de cada enum e do `.refine()` dos meses
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(planejamento): schemas para status, responsavel e lote (PLV-02/03/06)`

---
### T7: Query de KPIs
**What**: `buscarPlanejamentoKpis` + tipo.
**Where**: `src/backend/queries/planejamento.ts` (modificar)
**Depends on**: T4 · **Requirement**: PLV-11
**Done when**:
- [ ] Lê `vw_planejamento_kpi`; nunca agrega no cliente (AD-003)
- [ ] Devolve camelCase, mantendo a convenção do arquivo
- [ ] `null` preservado como `null` (não vira 0)
- [ ] Unit: caminho feliz + plano vazio + erro
- [ ] Gate: quick

**Tests**: unit · **Gate**: quick
**Commit**: `feat(planejamento): query de kpis do plano (PLV-11)`

---
### T8: Query da evolução mensal
**What**: `buscarEvolucaoMensal(client, idPlanejamento, idResponsavel?)`.
**Where**: `src/backend/queries/planejamento.ts` (modificar)
**Depends on**: T4 · **Requirement**: PLV-13
**Done when**:
- [ ] Lê `vw_planejamento_evolucao_mensal`, repassando o filtro de responsável
- [ ] Unit: com e sem filtro; série vazia; `P=0` devolve vazio, não linha 0
- [ ] Gate: quick

**Tests**: unit · **Gate**: quick
**Commit**: `feat(planejamento): query da evolucao mensal (PLV-13)`

---
### T9: Grade com atraso e responsável
**What**: estender `buscarGradeSucessosMensais` com `atrasoDias` e responsável.
**Where**: `src/backend/queries/planejamento.ts` (modificar)
**Depends on**: T4 · **Requirement**: PLV-03, PLV-12
**Done when**:
- [ ] Tipo `SucessoMensalGrade` ganha `atrasoDias` e `idUsuarioResponsavel`
- [ ] `atrasoDias = esta_atrasado ? dias_atraso : null` — combina as **duas** colunas que a view já tem, sem coluna nova (ver T4)
- [ ] Unit: SM atrasado → número; no prazo → `null`; **sem `dt_limite` → `null`** (não 0, que é o que `dias_atraso` devolve sozinho); **realizado e vencido → `null`**

> ⚠️ **Contrato real da view, achado do worker do Lote 1 em 2026-09-16 — não
> inventar a fixture.** Com `dt_limite` NULL, `esta_atrasado` vem **`null`, não
> `false`**: em SQL, `status = 'pendente' AND NULL` é `NULL` (lógica de três
> valores), e só vira `false` quando o status não é pendente. Ou seja, as duas
> colunas falham de formas **diferentes** na mesma linha — `dias_atraso` devolve
> `0` e `esta_atrasado` devolve `null`.
>
> A derivação `esta_atrasado ? dias_atraso : null` trata isso certo, porque
> `null` é falsy. Mas o **teste** tem que usar `estaAtrasado: null` nessa
> fixture, não `false` — senão estará verificando um formato que a view nunca
> produz, e passaria mesmo se a implementação estivesse errada. As cinco
> combinações estão fixadas no teste de integração da T4; use-o como contrato.
- [ ] Nenhum consumidor existente quebra
- [ ] Gate: quick

**Tests**: unit · **Gate**: quick
**Commit**: `feat(planejamento): grade com atraso e responsavel (PLV-03/PLV-12)`

---
### T10: Wrappers de RPC
**What**: `criarSucessosEmLote` e `moverItemHierarquia`.
**Where**: `src/backend/rpc/planejamento.ts` (modificar)
**Depends on**: T5, T6 · **Requirement**: PLV-06, PLV-09
**Done when**:
- [ ] Seguem o padrão de `atualizarSucessosEmLote` (schema `app`, snake_case)
- [ ] Erro passa por `mapeiaErroRpc`
- [ ] Unit: nome da RPC e **cada parâmetro** asserido (lição L-004), erro mapeado
- [ ] Gate: quick

**Tests**: unit · **Gate**: quick
**Commit**: `feat(planejamento): wrappers de lote e mover (PLV-06/PLV-09)`

---
### T11: `calculaAvancoMensal`
**What**: módulo puro do delta mês a mês.
**Where**: `src/frontend/components/planejamento/planejamento-series.ts`
**Depends on**: T8 · **Requirement**: PLV-13
**Done when**:
- [ ] `Atingido(M) − Atingido(M−1)`; primeiro mês = o próprio valor
- [ ] Unit: série normal, série de 1 ponto, série vazia, ponto NULL no meio
- [ ] Gate: quick

**Tests**: unit · **Gate**: quick
**Commit**: `feat(planejamento): avanco mensal como funcao pura (PLV-13)`

---
### T12: `expandeMesesEmSucessos`
**What**: expande a base + N meses em N payloads.
**Where**: `src/frontend/components/planejamento/planejamento-lote.ts`
**Depends on**: T6 · **Requirement**: PLV-06
**Done when**:
- [ ] N meses → N payloads com mesma descrição/peso/responsável e `mes_referencia` distinto
- [ ] Todo mês sai como `YYYY-MM-01`
- [ ] Unit: 1 mês, 6 meses, 12 meses, lista vazia (erro), mês duplicado (dedupe)
- [ ] Gate: quick

**Tests**: unit · **Gate**: quick
**Commit**: `feat(planejamento): expansao de lote de meses (PLV-06)`

---
### T13: `resolveResponsavel`
**What**: resolve responsável próprio vs. herdado da Meta.
**Where**: `src/frontend/components/planejamento/planejamento-responsavel.ts`
**Depends on**: T9 · **Requirement**: PLV-03
**Done when**:
- [ ] Devolve `{ pessoa, herdado }`; próprio → `herdado:false`; só Meta → `herdado:true`; nenhum → `pessoa:null`
- [ ] Unit: os 4 casos da AC (próprio, herdado, nenhum, pessoa sem vínculo)
- [ ] Gate: quick

**Tests**: unit · **Gate**: quick
**Commit**: `feat(planejamento): resolucao de responsavel herdado (PLV-03)`

---
### T14: Capacidade `moveHierarquia` em `PERMISSOES`
**What**: `moveHierarquia` nos 4 papéis.
**Where**: `src/frontend/components/planejamento/permissoes.ts` (modificar)
**Depends on**: None · **Requirement**: PLV-09

> **Alterado em 2026-09-16**: `reordenaItens` saiu junto com PLV-10.

**Done when**:
- [ ] `moveHierarquia` nos 4 papéis, coerente com `crudHierarquia`
- [ ] Unit: matriz papel×capacidade completa estendida (arquivo já tem 44 casos)
- [ ] Nenhum componente passa a checar `papel === "..."` direto (regra PLR-07)
- [ ] Gate: quick

**Tests**: unit · **Gate**: quick
**Commit**: `feat(planejamento): capacidade de mover na hierarquia (PLV-09)`

---
### T15: `PlanejamentoAbas` + estado na página
**What**: componente de abas e fiação com querystring.
**Where**: `src/frontend/components/planejamento/planejamento-abas.tsx` (novo) + `page.tsx`
**Depends on**: None · **Requirement**: PLV-14
**Done when**:
- [ ] Duas abas: "Diagnóstico (Análise de Conjuntura)" e "Construir a estrutura"
- [ ] Aba ativa persiste na querystring
- [ ] Component test: cada aba renderiza seu conteúdo **e** oculta o outro; aba inválida cai no default
- [ ] Gate: quick

**Tests**: component · **Gate**: quick
**Commit**: `feat(planejamento): abas de diagnostico e estrutura (PLV-14)`

---
### T16: Aba Diagnóstico
**What**: `ContextoEstrategico` como conteúdo da aba, em cartões.
**Where**: `src/frontend/components/planejamento/contexto-estrategico.tsx` (modificar)
**Depends on**: T15 · **Requirement**: PLV-14
**Done when**:
- [ ] 3 cartões (Legado, Objetivo do ano, Análise de conjuntura) com ação Editar
- [ ] Campo vazio mostra `—` e **mantém** o Editar (AC3)
- [ ] Perfil de atuação só no PLL — comportamento existente preservado (AC2)
- [ ] Modo Ler oculta Editar (AC4)
- [ ] Component test: preenchido vs. vazio; PLL vs. Estratégia; Ler vs. Construir
- [ ] Gate: quick

**Tests**: component · **Gate**: quick
**Commit**: `feat(planejamento): aba diagnostico com contexto estrategico (PLV-14)`

---
### T17: `objetivo-form` com status
**What**: campo Status + garantir preditores e agenda.
**Where**: `src/frontend/components/planejamento/objetivo-form.tsx` (modificar)
**Depends on**: T6 · **Requirement**: PLV-07, PLV-02
**Done when**:
- [ ] Rótulo **Descrição do Objetivo**; Status com os 3 valores
- [ ] Preditor primário/secundário e Agenda temática presentes
- [ ] Secundário desabilitado sem primário e sem repetir o escolhido
- [ ] Agenda marcada como catálogo pendente (CAT-16), sem valor de exemplo
- [ ] Sem Oportunidade/Ameaça (AD-049)
- [ ] Component test: os 2 lados do gate do secundário; status renderizado; ausência de SWOT
- [ ] Gate: quick

**Tests**: component · **Gate**: quick
**Commit**: `feat(planejamento): status e preditores no form de objetivo (PLV-02/PLV-07)`

---
### T18: `meta-form` com vocabulário canônico
**What**: corrigir rótulos e completar campos.
**Where**: `src/frontend/components/planejamento/meta-form.tsx` (modificar)
**Depends on**: T6 · **Requirement**: PLV-01, PLV-08
**Done when**:
- [ ] **Classe** (não "Tipo") com Programática/Governança; Governança omitida no PLL
- [ ] **Preditor primário/secundário** (não "Predicado"), com as 5 frases inteiras
- [ ] Status Ativa/Pausada/Descartada; Prioridade Alta/Média/Baixa
- [ ] `%` de atingimento travado: sem foco por Tab, sem clique, hachura + `fx`
- [ ] Component test: Governança presente em Estratégia **e ausente** em PLL; célula de % não focável; rótulos canônicos
- [ ] Gate: quick

**Tests**: component · **Gate**: quick
**Commit**: `feat(planejamento): vocabulario canonico no form de meta (PLV-01/PLV-08)`

---
### T19: `sucesso-mensal-form` com Peso, Mês e lote
**What**: campos obrigatórios + grade de meses na criação.
**Where**: `src/frontend/components/planejamento/sucesso-mensal-form.tsx` (modificar)
**Depends on**: T12, T10 · **Requirement**: PLV-04, PLV-05, PLV-06
**Done when**:
- [ ] **Peso (0–100)** obrigatório; salvar bloqueado sem ele
- [ ] **Mês de referência** (seletor mês/ano, `set/2026`) distinto de **Prazo (opcional)**
- [ ] `%` de atingimento **editável** aqui (único nível digitado)
- [ ] Criação: grade de meses múltipla → `expandeMesesEmSucessos` → `criarSucessosEmLote`
- [ ] Edição: seletor de **um** mês
- [ ] Status Pendente/Realizado/Não realizado
- [ ] Component test: salvar sem peso falha **e** com peso passa; multi só na criação **e** single na edição; % editável
- [ ] Gate: quick

**Tests**: component · **Gate**: quick
**Commit**: `feat(planejamento): peso, mes e criacao em lote no sucesso mensal (PLV-04/05/06)`

---
### T20: Vinculação nos modais
**What**: mover Meta/SM; Objetivo do SM como leitura.
**Where**: `meta-form.tsx`, `sucesso-mensal-form.tsx` (modificar)
**Depends on**: T10, T14, T18, T19 · **Requirement**: PLV-09
**Done when**:
- [ ] Meta: select de Objetivo → `moverItemHierarquia`
- [ ] SM: select de Meta editável; **Objetivo como leitura** (AC3)
- [ ] Ambos só com `permissoes.moveHierarquia`
- [ ] Component test: Objetivo do SM **não** é combobox; controles ausentes sem permissão
- [ ] Gate: quick

**Tests**: component · **Gate**: quick
**Commit**: `feat(planejamento): vinculacao hierarquica nos modais (PLV-09)`

---
### T21: `PlanejamentoKpis`
**What**: faixa de 4 cartões.
**Where**: `src/frontend/components/planejamento/planejamento-kpis.tsx` (novo)
**Depends on**: T7 · **Requirement**: PLV-11
**Done when**:
- [ ] 4 cartões; Fatos Geradores como placeholder até a outra feature
- [ ] Vazio é `—`, nunca `0` (AC4)
- [ ] Component test: com dado **e** vazio; placeholder presente
- [ ] Gate: quick

**Tests**: component · **Gate**: quick
**Commit**: `feat(planejamento): faixa de kpis do plano (PLV-11)`

---
### T22: `FiltroObjetivos`
**What**: cartões de Objetivo que filtram a árvore.
**Where**: `src/frontend/components/planejamento/filtro-objetivos.tsx` (novo)
**Depends on**: None · **Requirement**: PLV-11
**Done when**:
- [ ] Um cartão por Objetivo com % e estado ativo visível
- [ ] Clicar filtra; clicar de novo limpa
- [ ] Component test: selecionado vs. não; sem objetivos → estado vazio
- [ ] Gate: quick

**Tests**: component · **Gate**: quick
**Commit**: `feat(planejamento): filtro por objetivo especifico (PLV-11)`

---
### T23: Linha da Meta com chips, responsável e atraso
**What**: render da grade com classificações inline.
**Where**: `src/frontend/components/planejamento/planejamento-grade.tsx` (modificar)
**Depends on**: T9, T13 · **Requirement**: PLV-01, PLV-03, PLV-12
**Done when**:
- [ ] Chips de Status, Prioridade, Classe, Preditor 1º/2º e Agenda na linha da Meta
- [ ] Chip ausente quando o campo é nulo — **não** renderiza `—` dentro de chip
- [ ] Coluna RESP. com herdado marcado; sem nenhum → `—`
- [ ] Coluna ATRASO em coral; sem atraso → `—`
- [ ] Teclado, colar e undo **inalterados** (PLR-15/16 não regridem)
- [ ] Ordenação: Objetivo/Meta por `ordem` (colunas que já existem), Sucesso Mensal por `mes_referencia`
- [ ] **Não renderizar** o texto "Arraste os itens para reordenar" do mockup — a tela não faz isso (PLV-10 fora de escopo)
- [ ] Component test: cada chip presente **e** ausente; responsável próprio/herdado/nenhum; atraso/sem atraso
- [ ] Gate: quick

**Tests**: component · **Gate**: quick
**Commit**: `feat(planejamento): chips, responsavel e atraso na grade (PLV-01/03/12)`

---
### T25: `EvolucaoMensal`
**What**: gráfico de duas curvas + avanço do mês.
**Where**: `src/frontend/components/planejamento/evolucao-mensal.tsx` (novo)
**Depends on**: T8, T11 · **Requirement**: PLV-13
**Done when**:
- [ ] Duas séries com `recharts` + `ui/chart.tsx` — **nenhuma dependência nova**
- [ ] Avanço do mês exibido na inspeção (AC3), vindo de `calculaAvancoMensal`
- [ ] Filtro de responsável refaz a consulta (AC5)
- [ ] `P=0` → `EstadoVazio`, nunca linha em 0% (AC7)
- [ ] Esperado vai até o último mês com SM; Atingido para no mês corrente (AC8)
- [ ] Component test: série normal, série vazia, filtro aplicado, avanço correto
- [ ] Gate: quick

**Tests**: component · **Gate**: quick
**Commit**: `feat(planejamento): grafico de evolucao mensal (PLV-13)`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

Phase 1:  T1 ─→ T2 ─→ T3 ─→ T4 ─→ T5
Phase 2:  T6 ─→ T7 ─→ T8 ─→ T9 ─→ T10
Phase 3:  T11 ─→ T12 ─→ T13
Phase 4:  T14 ─→ T15 ─→ T16
Phase 5:  T17 ─→ T18 ─→ T19 ─→ T20
Phase 6:  T21 ─→ T22 ─→ T23 ─→ T25
```

**Empacotamento previsto** (~7 tarefas por lote, fases inteiras):
Lote 1 = Fase 1 (5) · Lote 2 = Fase 2 (5) · Lote 3 = Fases 3+4 (6) ·
Lote 4 = Fase 5 (4) · Lote 5 = Fase 6 (4). **24 tarefas → 5 lotes.**

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1, T3 | 1 migration, 1-2 colunas | ✅ |
| T2 | 1 função | ✅ |
| T4 | 3 views coesas, 1 arquivo | ⚠️ OK — coesas e interdependentes (o atraso é coluna da mesma leitura) |
| T5 | 2 RPCs, 1 arquivo | ⚠️ OK — mesma migration, mesmo invariante de cascata |
| T6–T13 | 1 schema / 1 query / 1 módulo cada | ✅ |
| T14–T16 | 1 arquivo cada | ✅ |
| T17–T19 | 1 form cada | ✅ |
| T20 | 2 forms, 1 conceito (vinculação) | ⚠️ OK — o mesmo comportamento nos dois lados |
| T21, T22, T23, T25 | 1 componente cada | ✅ |

Nenhum ❌.

---

## Diagram-Definition Cross-Check

| Task | Depends On (corpo) | Diagrama | Status |
| --- | --- | --- | --- |
| T1 | None | início da Fase 1 | ✅ |
| T2 | T1 | T1→T2 | ✅ |
| T3 | None | T2→T3 (ordem, sem dependência real) | ✅ sequencial |
| T4 | T3 | T3→T4 | ✅ |
| T5 | T2, T3 | T4→T5 (mesma fase, ambas anteriores) | ✅ |
| T6 | T1, T3 | Fase 2 após Fase 1 | ✅ |
| T7 | T4 | Fase 2 após Fase 1 | ✅ |
| T8 | T4 | idem | ✅ |
| T9 | T4 | idem | ✅ |
| T10 | T5, T6 | T6→…→T10, mesma fase | ✅ |
| T11 | T8 | Fase 3 após Fase 2 | ✅ |
| T12 | T6 | idem | ✅ |
| T13 | T9 | idem | ✅ |
| T14 | None | início da Fase 4 | ✅ |
| T15 | None | idem | ✅ |
| T16 | T15 | T15→T16 | ✅ |
| T17 | T6 | Fase 5 após Fase 2 | ✅ |
| T18 | T6 | idem | ✅ |
| T19 | T12, T10 | Fases 2 e 3 anteriores | ✅ |
| T20 | T10, T14, T18, T19 | todas anteriores ou na mesma fase | ✅ |
| T21 | T7 | Fase 6 após Fase 2 | ✅ |
| T22 | None | início possível da Fase 6 | ✅ |
| T23 | T9, T13 | Fases 2 e 3 anteriores | ✅ |
| T25 | T8, T11 | Fases 2 e 3 anteriores | ✅ |

> T24 removida. Nenhuma tarefa restante dependia dela — T25 dependia de T8/T11,
> nunca de T24 —, então nada ficou órfão.

Nenhuma dependência aponta para fase posterior.

---

## Test Co-location Validation

| Task | Camada | Matriz exige | Task diz | Status |
| --- | --- | --- | --- | --- |
| T1 | Migration/constraint | integration | integration | ✅ |
| T2 | Função Postgres | integration | integration | ✅ |
| T3 | Migration | integration | integration | ✅ |
| T4 | View | integration | integration | ✅ |
| T5 | Função Postgres | integration | integration | ✅ |
| T6 | Schema Zod | unit | unit | ✅ |
| T7–T9 | Backend query | unit | unit | ✅ |
| T10 | RPC wrapper | unit | unit | ✅ |
| T11–T13 | Módulo puro | unit | unit | ✅ |
| T14 | Módulo puro | unit | unit | ✅ |
| T15, T16 | Componente React | component | component | ✅ |
| T17–T20 | Componente React | component | component | ✅ |
| T21, T22, T23, T25 | Componente React | component | component | ✅ |

Nenhuma ❌ VIOLATION. Nenhum `Tests: none` — não há camada com "none" nesta feature.

---

## Ferramentas por tarefa

| Camada | Ferramenta |
| --- | --- |
| Migrations (T1–T5) | **Bash** + CLI `supabase` (`supabase migration new`, `db push`). **O MCP do Supabase não está autenticado nesta sessão** e não será usado |
| Backend/Frontend (T6–T25) | Edit/Write + Bash para gates |
| Skill | `tlc-spec-driven` em todas; `figma-dominio-legisla` em T17–T25 (toda AC de vocabulário) |
