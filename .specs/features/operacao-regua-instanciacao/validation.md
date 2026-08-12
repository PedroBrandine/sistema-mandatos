# Régua de Etapas e Instanciação — Validation

**Date**: 2026-08-12
**Spec**: `.specs/features/operacao-regua-instanciacao/spec.md`
**Diff range**: commits `e643384`, `08ff545`, `b03903f`, `670346a`, `4dea444`, `ca5be45`, `5432d16`, `29d4b59`, `7dad335`, `3c53a43`, `aeb7687`, `1f35ad8` (interleaved with `convite-contrato` on `develop`; only these 12 inspected)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1   | ✅ Done | `20260812001130_regua_instanciacao_estrutura.sql` — 3 tables + view, byte-for-byte match to `docs/schema_sistema.sql:708-889,1185-1194` except intentional `IF NOT EXISTS`/`OR REPLACE` (AD-025). |
| T2   | ✅ Done | `20260812001234_regua_instanciacao_rls.sql` — `p_por_contrato` with explicit `WITH CHECK` (schema only had `USING`); confirmed live via `pg_policies.with_check IS NOT NULL` (regua-rls test). |
| T3   | ✅ Done | `20260812001310_regua_instanciacao_grants.sql` — confirmed live via `pg_class.relacl`: `legisla_app/admin/gestora` have `arwd` on all 4 objects; `legisla_mentor` has `r` on all 4; `legisla_assessor` has `r` only on `dim_planejamento`/`rel_formulario_contrato` — exact match to design.md's stated grant matrix. |
| T4   | ✅ Done | `20260812001347_regua_instanciacao_trigger_backfill.sql` — function verbatim to `docs/schema_sistema.sql:1529-1559`; trigger + backfill are the new wiring. Backfill confirmed live: sampled pre-existing contracts (id 190-226, created before this feature) all carry `fat_etapa_contrato`/`dim_planejamento` rows now. |
| T5   | ✅ Done | 9/9 call-sites across the 6 pre-existing test files fixed (see FK section below); reconfirmed via commit `1f35ad8` combining round-trips for timeout. |
| T6   | ✅ Done | 3/3 frontend delete flows fixed (see FK section below). |
| T7   | ✅ Done | `regua-instanciacao.integration.test.ts` — 7/7 green, real assertions (exact dates, exact counts). |
| T8   | ✅ Done | `regua-rls.integration.test.ts` — 7/7 green, structural + behavioral RLS proof. |
| T9   | ✅ Done | `database.types.ts` includes the 4 new objects (verified present, consumed without cast errors in T10/T11). |
| T10  | ✅ Done | `etapa-contrato.ts` + `etapa-contrato.test.ts` — 4/4 unit tests green. |
| T11  | ✅ Done | `etapas/[codigo]/page.tsx` renders the full régua; `npm run build` includes the route with no error. |

---

## Spec-Anchored Acceptance Criteria

### P1: Contrato nasce com sua régua instanciada automaticamente (RGI-01..05)

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| RGI-01: INSERT em `fat_contrato` dispara `instancia_contrato` sem chamada explícita | Trigger dispara automaticamente | `supabase/tests/operacao/regua-instanciacao.integration.test.ts:47-50` — `runSql` faz só `INSERT` cru; `expect(Number(rows[0].n)).toBe(7)` sem nenhuma chamada manual à função | ✅ PASS |
| RGI-02: 1 linha por `ref_etapa` do produto, `nao_iniciada`, datas acumuladas em sequência | 7 etapas de Estratégia, `cadastro` 2026-01-01→01-08, `replicacao` 2026-08-10→08-24 (soma 235d) | `regua-instanciacao.integration.test.ts:66-79` — `expect(rows).toHaveLength(7)`, `expect(rows[0].dt_prevista_conclusao).toBe("2026-01-08")`, `expect(ultima.dt_prevista_conclusao).toBe("2026-08-24")` | ✅ PASS |
| RGI-03: exatamente 1 linha em `dim_planejamento`, demais colunas `NULL` | count=1, `id_perfil_atuacao`/`objetivo_ano`/`pct_atingimento` NULL | `regua-instanciacao.integration.test.ts:95-98` — `expect(Number(rows[0].n)).toBe(1)`, 3× `expect(...).toBeNull()` | ✅ PASS |
| RGI-04: 1 linha em `rel_formulario_contrato` por `ref_formulario` ativo, `estado='fechado'` | 8 formulários (Estratégia), todos `fechado` | `regua-instanciacao.integration.test.ts:106-112` — `expect(Number(rows[0].n)).toBe(8)`, `expect(estados[0].estado).toBe("fechado")` | ✅ PASS |
| RGI-05: reinvocação direta não duplica (`ON CONFLICT DO NOTHING`) | Contagens inalteradas após 2ª chamada | `regua-instanciacao.integration.test.ts:115-126` — `expect(Number(rows[0].etapas)).toBe(7)` etc. após `SELECT app.instancia_contrato(...)` repetido | ✅ PASS (também confirmado pelo sensor de discriminação — mutação C abaixo) |

**Status**: ✅ All ACs covered

### P1: Contratos já existentes recebem a régua retroativamente (RGI-06)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: migration chama `instancia_contrato` para todo `id_contrato` já existente | Todo contrato pré-existente ganha régua | `supabase/migrations/20260812001347_regua_instanciacao_trigger_backfill.sql:72-79` (`DO $$ ... FOR r IN SELECT id_contrato FROM fat_contrato LOOP PERFORM app.instancia_contrato(r.id_contrato) ...`) — efeito de migration one-shot, não re-testável por suíte automatizada; reconfirmado nesta verificação via `supabase db query --linked` em contratos com `criado_em < 2026-08-11` (ids 190-226): todos com `n_etapas` > 0 (5 ou 7, conforme produto) | ✅ PASS (evidência estrutural + estado vivo do banco, não teste automatizado repetível) |
| AC2: reaplicar o backfill não duplica | Contagens inalteradas | `regua-instanciacao.integration.test.ts:128-146` — reexecuta o loop completo de backfill (mesmo texto da migration) contra o dev real, `expect(Number(rows[0].etapas)).toBe(7)` | ✅ PASS |

**Status**: ✅ All ACs covered (AC1 com nota: efeito de migration, evidenciado por estado do banco em vez de teste repetível — inerente à natureza de um backfill único)

### P1: RLS das 3 tabelas novas segue o padrão do projeto (RGI-07/08)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| RGI-07: leitura filtrada por vínculo; Admin/Gestora sempre passam | Mentor só vê contrato vinculado; Gestora vê ambos | `supabase/tests/operacao/regua-rls.integration.test.ts:131-141` (mentor: `idsVistos.has(a)===true`, `has(b)===false`) e `:179-189` (gestora: ambos `true`) | ✅ PASS |
| RGI-08: `INSERT`/`UPDATE` direto rejeitado via `WITH CHECK` explícito (não reuso implícito) | `pg_policies.with_check IS NOT NULL`; Mentor sem GRANT de escrita recebe `42501` | `regua-rls.integration.test.ts:104-116` (`expect(row.with_check).not.toBeNull()` para as 3 tabelas) + `:161-177` (`expect(error?.code).toBe("42501")`) | ✅ PASS |
| RGI-08 AC3: Admin/Gestora escrevem sem restrição de vínculo | Gestora grava em contrato sem vínculo pessoal | `regua-rls.integration.test.ts:191-198` — `expect(error).toBeNull()` | ✅ PASS |

**Status**: ✅ All ACs covered

### P2: Tela da régua no detalhe do contrato (RGI-09/10)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| RGI-09: lista etapas do produto ordenadas por `ordem`, com status/previsto/realizado | Ordenação por `ref_etapa.ordem`; colunas Etapa/Status/Previsto/Realizado | Camada de dados: `src/backend/queries/etapa-contrato.test.ts:101-104` — `expect(chamadaOrder?.args).toEqual(["ordem", { ascending: true }])`. Renderização: `src/frontend/app/(app)/contratos/[id]/etapas/[codigo]/page.tsx:92-131` (leitura de código — sem teste de componente automatizado) | ⚠️ PASS na camada de dados; renderização verificada só por leitura de código (ver nota abaixo) |
| RGI-10: atraso derivado (`esta_atrasada`/`dias_atraso`), nunca recalculado no cliente | Badge destrutivo só quando `esta_atrasada`; valor de `dias_atraso` da view | Fonte de dado: `src/backend/queries/etapa-contrato.ts:52-53` mapeia direto de `linha.dias_atraso`/`linha.esta_atrasada` sem transformação — morto pelo sensor de discriminação (mutação A abaixo). Renderização: `page.tsx:121-126` (leitura de código) | ⚠️ PASS na fonte do dado; renderização verificada só por leitura de código |
| AC3: régua com todas as etapas `nao_iniciada` renderiza normalmente, não como vazio | Não trata como erro/estado vazio | `etapa-contrato.test.ts:108-133` — `resultado` com 1 linha `nao_iniciada` retorna normalmente, sem lançar | ✅ PASS |

**Status**: ⚠️ Spec-precision não se aplica (a spec define o outcome com precisão) — mas há um **gap de cobertura de teste automatizado** para a renderização (JSX) em si: a ordenação e a fonte do dado (`esta_atrasada`/`dias_atraso`) são garantidas por teste unitário/integração, porém nenhuma asserção automatizada cobre "a Badge aparece na tela quando `esta_atrasada=true`". Isto **não é uma regressão introduzida por esta feature**: o repositório inteiro não tem nenhum arquivo `*.test.tsx` ou teste de componente/renderização (`Glob` confirmou zero ocorrências) — é o padrão vigente do projeto, e o próprio `tasks.md` (T11 Done-when) já escopou esta verificação como "leitura de código", não teste de componente. Registrado aqui como observação, não como Blocker.

---

## Discrimination Sensor

Todas as 3 mutações foram aplicadas em estado descartável (arquivo TS revertido por `Edit`; SQL revertido por `supabase db query --linked` com o texto original verbatim da migration correspondente, imediatamente após confirmar o kill) e o estado final do repositório/banco foi reconfirmado limpo (testes voltam a passar 100% depois de cada reversão).

| # | File:line | Mutação | Teste usado | Killed? |
| - | --- | --- | --- | --- |
| 1 | `src/backend/queries/etapa-contrato.ts:53` | `estaAtrasada: linha.esta_atrasada ?? false` → hardcoded `false` (ignora a coluna da view) | `npx vitest run --config vitest.config.ts src/backend/queries/etapa-contrato.test.ts` | ✅ Killed — `expected false to be true` no primeiro registro do fixture |
| 2 | `vw_etapa_contrato` (view, `20260812001130_...sql`) | `dt_prevista_conclusao < CURRENT_DATE` → `>` (inverte a condição de `esta_atrasada`) | `regua-instanciacao.integration.test.ts -t "vw_etapa_contrato deriva"` (SQL aplicado/revertido via `supabase db query --linked` no dev, `npnvoolkebhabjkjzqwn`) | ✅ Killed — `expected false to be true` |
| 3 | `app.instancia_contrato` (função, `20260812001347_...sql`) | Removido `ON CONFLICT (id_contrato, id_etapa) DO NOTHING` do `INSERT` em `fat_etapa_contrato` | `regua-instanciacao.integration.test.ts -t "RGI-05"` (SQL aplicado/revertido via `supabase db query --linked` no dev) | ✅ Killed — `23505: duplicate key value violates unique constraint "uq_etapa_contrato"` na 2ª chamada |

**Sensor depth**: lightweight (3 mutações, código novo desta feature — 1 TS + 2 SQL comportamentais, conforme sugerido pela tarefa)
**Result**: 3/3 killed — PASS ✅

**Nota**: a lógica de exibição visual em `page.tsx` (Badge de atraso) não foi escolhida como 4ª mutação porque não há nenhum teste automatizado que a exercite (ver gap de RGI-09/10 acima) — mutá-la produziria um sobrevivente garantido por ausência total de cobertura, não por fraqueza de asserção; o achado já está registrado como gap de cobertura, não repetido aqui como "mutante sobrevivente".

---

## Achado de Design — FK `ON DELETE RESTRICT` (verificação exaustiva)

Grep exaustivo no repositório inteiro por `DELETE FROM fat_contrato` e `.from("fat_contrato").delete(`:

- **3 frontend** (`contratos/page.tsx:108`, `mandatos/page.tsx:109`, `mandatos/[id]/page.tsx:312`) — todos precedidos pelas 3 linhas de limpeza (`fat_etapa_contrato`/`rel_formulario_contrato`/`dim_planejamento`), confirmadas via leitura direta do código (commit `ca5be45`).
- **9 call-sites em 6 arquivos de teste de fundação** (plataforma-tabelas ×1, fundacao-tabelas ×2, fundacao-rls ×1, fn-substituir-vinculo ×1, fn-criar-mandato ×1, auditoria-gap ×3) — todos com a limpeza de 3 tabelas imediatamente antes, confirmados via diff do commit `4dea444` linha a linha, e reconfirmados verdes no gate check (ver abaixo).
- **2 call-sites da feature paralela `convite-contrato`** (`supabase/tests/convite/fn-emitir-convite.integration.test.ts:130`, `fn-consumir-convite.integration.test.ts:120`) — fora do escopo desta feature, mas verificados: ambos **já** limpam as 3 tabelas antes (com comentário explícito citando `trg_fat_contrato_instancia`/`operacao-regua-instanciacao`), evidenciando que a sessão de `convite-contrato` coordenou com este achado de design. Não é uma lacuna desta feature.
- **Nenhum `DELETE FROM fat_contrato` em migrations SQL** (grep em `supabase/migrations/` sem resultado) e **nenhum outro `.from("fat_contrato").delete(` no `src/`** além dos 3 já listados (`Grep` multiline confirmou exatamente 3 arquivos).

**Conclusão**: os 9+3 pontos declarados no design.md estão corrigidos, e a varredura exaustiva não encontrou nenhum ponto residual — nem dentro nem fora do escopo desta feature.

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ — DDL/função/trigger extraídos verbatim (diff linha a linha contra `docs/schema_sistema.sql` confere); nenhuma tabela/coluna nova além do aprovado |
| Surgical changes | ✅ — T5/T6 tocam só as linhas de cleanup necessárias pela FK nova; T11 preenche exatamente o placeholder já existente, sem tocar `ficha-contrato-chrome.tsx`/`contratos/[id]/page.tsx` (ambos com edição não commitada de outra sessão, citados e evitados em design.md) |
| No scope creep | ✅ — TanStack Query/Table deliberadamente não adotado (SPEC_DEVIATION registrada e justificada em design.md, coerente com o padrão `useEffect`/`useState` já usado pelo componente pai) |
| Matches patterns | ✅ — RLS replica literalmente `p_por_contrato` de `rel_coalizao_membro`; query segue o padrão de `buscarEtapasDoProduto`/`contrato.ts`; UI usa shadcn `Table`+`Badge` já em uso no restante do app |
| Spec-anchored outcome check (asserted values match spec) | ✅ — datas/contagens exatas (2026-01-08, 235 dias, 7/8/1 linhas) batem com os valores computados manualmente a partir do seed de `ref_etapa`/`ref_formulario` de Estratégia |
| Per-layer Coverage Expectation met (domain 1:1 ACs; routes happy+edge+error) | ⚠️ Parcial — camada de dados (SQL + query TS) tem 1:1 com RGI-01..08; camada de UI (RGI-09/10 renderização) não tem teste dedicado, mas consistente com o padrão vigente do projeto (zero testes de componente em todo o repositório) |
| Every test maps to a spec requirement — no unclaimed tests | ✅ — cada `it()` novo cita o RGI correspondente em comentário/nome |
| Documented guidelines followed | `.claude/skills/tlc-spec-driven/references/coding-principles.md` — aderente (sem abstração de uso único, sem feature além do pedido, revert cirúrgico do sensor confirmado sem diff residual) |

---

## Edge Cases

- [x] Produto sem `ref_etapa` → instanciação sem erro, contrato nasce sem etapas: **não testado explicitamente**, mas garantido por construção (a query de `INSERT ... SELECT ... WHERE e.id_produto = v_id_produto` retorna 0 linhas sem lançar exceção quando não há `ref_etapa`; é o comportamento padrão de um `INSERT INTO ... SELECT` vazio no Postgres). Risco baixo — os 3 produtos já têm régua seedada.
- [x] Trigger falha → `fat_contrato` falha junto (mesma transação): garantido pela semântica nativa de `AFTER INSERT` trigger do Postgres (exceção no trigger reverte a transação inteira) — não é lógica de aplicação a testar, é comportamento do motor.
- [x] Dois contratos em lote → cada um isolado: coberto indiretamente por `regua-instanciacao.integration.test.ts:128-146` (RGI-06 AC2), que reexecuta o loop de backfill sobre **todo** `fat_contrato` do banco de dev e confirma que o contrato da fixture continua com exatamente 7/1 linhas — sem contaminação cruzada.
- [~] Coalizão sem planejamento próprio ainda instancia normalmente: exercitado indiretamente por `fn-criar-mandato.integration.test.ts` (fixture `CMU-05`, cria contrato via `p_coalizao`) — o `afterAll` precisa limpar `fat_etapa_contrato`/`dim_planejamento` para essa fixture (prova de que o trigger populou as tabelas sem erro de FK), mas **não há asserção dedicada de contagem** para o caso `coalizao` como há para `mandato` em RGI-01..04. Risco baixo: a função não discrimina por `tipo_contratante`, só por `id_produto`. Registrado como observação menor, não Blocker.

---

## Gate Check

- **Gate commands**:
  1. `npx vitest run --config vitest.integration.config.ts supabase/tests/operacao/regua-instanciacao.integration.test.ts supabase/tests/operacao/regua-rls.integration.test.ts`
  2. `npx vitest run --config vitest.integration.config.ts supabase/tests/fundacao/plataforma-tabelas.integration.test.ts supabase/tests/fundacao/fundacao-tabelas.integration.test.ts supabase/tests/fundacao/auditoria-gap.integration.test.ts supabase/tests/fundacao/fn-criar-mandato.integration.test.ts supabase/tests/fundacao/fn-substituir-vinculo.integration.test.ts supabase/tests/fundacao/fundacao-rls.integration.test.ts`
  3. `npm run test:unit`
  4. `npm run build`
  5. `npm run lint:all`
- **Result (1)**: 2 files, 14 tests, 14 passed, 0 failed
- **Result (2)**: 6 files, 53 tests, 53 passed, 0 failed
- **Result (3)**: 19 files, 158 tests, 158 passed, 0 failed (inclui os 4 novos de `etapa-contrato.test.ts`)
- **Result (4)**: build verde, inclui `ƒ /contratos/[id]/etapas/[codigo]` sem erro (Turbopack, TypeScript check limpo)
- **Result (5)**: 27 problemas (13 erros, 14 warnings) — **idêntico** à baseline pré-existente documentada; nenhum problema novo cai em linha tocada por esta feature (conferido arquivo a arquivo contra os diffs de T6/T11)
- **Skipped tests**: nenhum
- **Failures**: nenhuma

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| RGI-01 | Design | ✅ Verified |
| RGI-02 | Design | ✅ Verified |
| RGI-03 | Design | ✅ Verified |
| RGI-04 | Design | ✅ Verified |
| RGI-05 | Design | ✅ Verified |
| RGI-06 | Design | ✅ Verified |
| RGI-07 | Design | ✅ Verified |
| RGI-08 | Design | ✅ Verified |
| RGI-09 | Design | ✅ Verified (dados); renderização por leitura de código, sem teste de componente |
| RGI-10 | Design | ✅ Verified (dados); renderização por leitura de código, sem teste de componente |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 10/10 ACs de dados/backend com outcome preciso batendo o teste; RGI-09/10 têm a camada de renderização (JSX) verificada só por leitura de código — sem teste de componente, consistente com o padrão vigente de zero testes de UI em todo o projeto (não é regressão desta feature)
**Sensor**: 3/3 mutações mortas (1 TS em `buscarReguaDoContrato`, 2 SQL em `vw_etapa_contrato`/`app.instancia_contrato`) — todas revertidas, banco de dev confirmado limpo
**Gate**: 5/5 comandos verdes (14+53+158 testes automatizados, build ok, lint na mesma baseline de 27)

**What works**: Trigger + backfill instanciam a régua automaticamente e retroativamente, com idempotência garantida por `ON CONFLICT`; RLS das 3 tabelas novas com `WITH CHECK` explícito, provado nos dois sentidos (nega Mentor sem vínculo, permite Admin/Gestora); os 12 pontos afetados pela FK `ON DELETE RESTRICT` (3 frontend + 9 testes) estão corrigidos, e a varredura exaustiva não encontrou nenhum ponto residual, inclusive na feature paralela `convite-contrato`; a tela da régua consome `vw_etapa_contrato` sem recalcular atraso no cliente.

**Issues found**: nenhum Blocker/Major. Duas observações Minor, ambas pré-existentes ao padrão do projeto, não introduzidas por esta feature:
1. RGI-09/10 — renderização da UI (Badge de atraso, tabela) sem teste de componente automatizado (só leitura de código); mitigado por T11 já ter escopado isso assim no `tasks.md` e pelo projeto inteiro não ter nenhum teste de UI ainda.
2. Edge case "coalizão sem planejamento próprio" tem cobertura indireta (sem erro de FK) mas nenhuma asserção dedicada de contagem, diferente do caso "mandato" que tem RGI-01..04 explícitos.

**Next steps**: nenhuma ação bloqueante. Se o projeto adotar testes de componente no futuro (ex.: quando o Kanban precisar de interação real na mesma árvore), a tela de régua é candidata natural a ganhar cobertura de renderização junto.
