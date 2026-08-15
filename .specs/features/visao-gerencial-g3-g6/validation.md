# Visão Gerencial G3-G6 (Tela Gerencial completa) Validation — Rodada 2 (fix-verify)

**Date**: 2026-08-15
**Spec**: `.specs/features/visao-gerencial-g3-g6/spec.md`
**Rodada anterior**: rodada 1 (❌ FAIL) preservada em `git show aeb5743:.specs/features/visao-gerencial-g3-g6/validation.md`
— este arquivo a sobrescreve como HEAD, mas o histórico do git mantém a rodada 1 intacta.
**Diff range desta rodada**: `173bd90` (Blocker: filtro Período), `784259f` (2 mutantes
sobreviventes), `dcb39be` (Cosmético: `COMMENT ON VIEW`) — os 3 commits de fix que a rodada 1
gerou. Escopo **não** é a feature inteira (30 tasks); tasks já `PASS` na rodada 1 são herdadas
sem re-verificação, conforme instrução do orquestrador.
**Verifier**: independente (author ≠ verifier), sessão fresca sem histórico da implementação
nem da rodada 1 além do que está escrito em `validation.md`/git log.

---

## Task Completion (escopo: só os 3 commits de fix)

| Commit | Achado da rodada 1 que corrige | Status |
| --- | --- | --- |
| `173bd90` | Blocker — `FiltroRecorte.mesesEvolucao` nunca era lido por nenhum consumidor | ✅ Done |
| `784259f` | Minor — 2 mutantes sobreviventes (E lógico Gestora+Mentor; paginação `.range()`) | ✅ Done |
| `dcb39be` | Cosmético — `COMMENT ON VIEW vw_resposta_formulario` desatualizado | ✅ Done |

Nenhum commit bloqueado ou parcial. `aeb5743` (topo do branch antes desta sessão) só adiciona
o `validation.md` da rodada 1 + lições — não é código, fora do escopo de re-verificação.

---

## Spec-Anchored Acceptance Criteria (só os ACs que a rodada 1 marcou GAP/gap parcial)

| Criterion | Spec-defined outcome | `file:line` + evidência | Resultado rodada 1 | Resultado rodada 2 |
| --- | --- | --- | --- | --- |
| GER-07(d): linha mensal de G3 no range do filtro Período | array de pontos varia com `mesesEvolucao` | `saude-operacao-bloco.tsx:68` — `apararUltimosMeses(dado.evolucaoMensal, filtro.mesesEvolucao)` | ❌ GAP | ✅ PASS — confirmado por leitura + runtime (ver seção Runtime abaixo) |
| GER-08(c): linha mensal de G4 no range do filtro Período | idem | `saude-operacao-bloco.tsx:125` | ❌ GAP | ✅ PASS |
| GER-12: evolução mensal G1 no range do filtro Período | idem | `carteira-ponderada-card.tsx:107` — `apararUltimosMeses(s.pontos, filtro.mesesEvolucao)` | ❌ GAP | ✅ PASS |
| GER-13: evolução mensal G2 (small multiples) no range do filtro Período | idem | `ciclo-etapa-card.tsx:83` — `apararUltimosMeses(e.pontos, filtro.mesesEvolucao)` | ❌ GAP | ✅ PASS |
| Edge Case 5 (`spec.md:202`): filtro Período afeta só os gráficos de evolução | nenhum outro bloco (G5/G6/IIP/Bloco 1/Bloco 3) reage a `mesesEvolucao` | `grep -rn "mesesEvolucao" src/frontend src/backend` (abaixo) — só os 4 sites acima + `page.tsx` (parse) + `visao-gerencial.ts` (tipo) leem/gravam o campo | ❌ GAP | ✅ PASS |
| GER-05: Gestora+Mentor = E lógico, teste discrimina AND de OR | teste falha se a interseção virar união | `visao-gerencial.test.ts:346-372` — datasets diferentes por lado (`{201,202,203}` vs `{202,203,204}`), assert final é a interseção exata `{202,203}` | ⚠️ comportamento correto / teste não discrimina | ✅ PASS — discrimina (sensor abaixo) |
| GER-19/T17: paginação de `buscarPendencias` nunca traz a tabela inteira | `.range()` chamado com os argumentos corretos por página | `visao-gerencial-g3-g6.test.ts:537-564` — `rangeChamadas` captura os args reais, `expect(rangeChamadas).toEqual([[10, 19]])` pra página 2/tamanho 10 | ⚠️ comportamento correto / teste não discrimina | ✅ PASS — discrimina (sensor abaixo) |

**Evidência do grep de completude** (nenhum consumidor a mais nem a menos lê o campo):

```
src/frontend/app/(app)/visao-gerencial/page.tsx:38        mesesEvolucao: numeroOuUndefined("periodo"),
src/frontend/components/visao-gerencial/carteira-ponderada-card.tsx:107   apararUltimosMeses(s.pontos, filtro.mesesEvolucao)...
src/frontend/components/visao-gerencial/ciclo-etapa-card.tsx:83           apararUltimosMeses(e.pontos, filtro.mesesEvolucao)...
src/frontend/components/visao-gerencial/saude-operacao-bloco.tsx:68,125   apararUltimosMeses(dado.evolucaoMensal, filtro.mesesEvolucao)...
src/backend/queries/visao-gerencial.ts:17                 mesesEvolucao?: number;   (tipo, FiltroRecorte)
```

G5/G6/IIP/Bloco 1/Bloco 3 confirmados (via `spec.md:37,`"G5 nasce sem evolução mensal, `TODO(OUT-06)`") como fora do escopo do filtro Período por desenho — não é omissão, é o range correto de consumidores.

**Status**: ✅ Todos os 7 critérios reabertos pela rodada 1 agora fecham limpo.

---

## Discrimination Sensor

Sensor rodado no arquivo real (`src/backend/queries/visao-gerencial.ts`), cada mutação
aplicada via `Edit`, teste rodado, depois revertida com `Edit` de volta ao original — `git
status`/`git diff` confirmados limpos antes e depois de cada mutação (nunca commitada).

| # | File:line | Mutação | Teste rodado | Resultado |
| --- | --- | --- | --- | --- |
| 1 | `visao-gerencial.ts:249` (`interseccionar`, dentro de `resolverIdsContratoDoRecorte`) | Interseção → união: `new Set([...ids].filter(id => novos.has(id)))` → `new Set([...ids, ...novos])` — mesma mutação que sobreviveu na rodada 1 (Mutação A) | `visao-gerencial.test.ts` | ✅ **Morto** — `idGestora + idMentor combinam por E lógico...` falhou: `expected Set{201,202,203,204} to deeply equal Set{202,203}` |
| 2 | `visao-gerencial.ts:932` (`buscarPendencias`) | Off-by-one em `.range()`: `const fim = inicio + tamanhoPagina - 1` → `const fim = inicio + tamanhoPagina` — mesma mutação que sobreviveu na rodada 1 (Mutação C) | `visao-gerencial-g3-g6.test.ts` | ✅ **Morto** — `pagina via .range()...` falhou: `expected [[10, 20]] to deeply equal [[10, 19]]` |

**Sensor depth**: lightweight (2 mutações — exatamente os 2 pontos que a rodada 1 marcou como sobreviventes; não há mutação nova a injetar no filtro Período porque `apararUltimosMeses` já tem 3 testes unitários dedicados cobrindo os 3 ramos: `undefined`, corte normal, corte maior que a série).
**Result**: 2/2 killed — ✅ PASS nesta dimensão. Os 2 sobreviventes da rodada 1 estão mortos; nenhuma mutação nova sobreviveu.

Após cada mutação: `Edit` reverteu ao texto original; `git status --short` = vazio, `git diff --stat` = vazio (confirmado ao final).

---

## Runtime Verification (achado Blocker — checagem empírica, não só estática)

O worktree desta sessão estava fixado num commit muito anterior (`0969622`, sem nenhum arquivo
de `visao-gerencial`) — precisou `git checkout aeb5743` (detached HEAD, isolado, sem tocar o
branch `develop` de outra sessão) antes de qualquer verificação. `npm install` na raiz foi
necessário (worktree novo, sem `node_modules`).

1. `.env.local` de dev (`src/frontend/.env.local`) copiado (somente leitura da origem) do
   checkout principal — confirmado apontar pra `sistema-mandatos-dev`
   (`npnvoolkebhabjkjzqwn`, não produção) via `docs/ambientes.md`.
2. `npm run dev` (background) em `src/frontend`, `http://localhost:3000` respondendo.
3. Login via bypass dev: `POST /admin/acesso/entrar` com
   `email=smoke-test-verifier-r2@legislabrasil.org` → `303 → /`, cookie de sessão setado.
   Confirma-se em `supabase/migrations/0018_provisiona_usuario_dominio_legisla.sql` que
   qualquer primeiro login `@legislabrasil.org` ganha `dim_usuario` automático com
   `papel_global='gestora'` (não é mentor/assessor, logo não é bloqueado por GER-01).
4. `GET /visao-gerencial` (sem `periodo`) vs `GET /visao-gerencial?periodo=3`, mesmo cookie —
   comparado o array de pontos da série "Cobertura" (G3, `SaudeOperacaoBloco`) via grep no HTML
   servido (RSC payload embutido):

   | Request | Meses presentes na série | Contagem |
   | --- | --- | --- |
   | sem `periodo` | `2026-05`, `2026-06`, `2026-07`, `2026-08` | 4 |
   | `?periodo=3` | `2026-06`, `2026-07`, `2026-08` | 3 |

   `periodo=3` derruba exatamente o mês mais antigo (`2026-05`) e mantém os 3 mais recentes —
   bate exatamente com `apararUltimosMeses`'s `.slice(-mesesEvolucao)`. **Confirma
   empiricamente, contra o banco de dev real, que o Select "Período" agora tem efeito real
   sobre o gráfico de evolução** — não é mais um controle inerte.
5. Limpeza: dev server derrubado (`taskkill` no processo `node.exe` remanescente — o `TaskStop`
   do shell wrapper não bastou, comum no Windows quando o processo filho sobrevive ao pai).
   `dim_usuario`/`auth.users` consultados via `supabase db query --linked` (Management API, sem
   precisar da senha do Postgres) — **1 linha `smoke-test-%` própria desta sessão removida de
   `dim_usuario`**, e **5 linhas órfãs `smoke-test-%` em `auth.users`** (a minha + 4 de sessões
   anteriores, provavelmente da própria rodada 1 ou de outra sessão paralela, nunca limpas)
   também removidas — confirmado `0` restantes em ambas as tabelas após a limpeza. `.env.local`
   copiado e `supabase/.temp/` (link) removidos do worktree ao final; `git status` = limpo.

**Nota operacional (não é achado de código, não gera lição via script)**: as 4 linhas órfãs de
`auth.users` de sessões anteriores confirmam que a instrução de limpeza de `smoke-test-%` nem
sempre foi seguida à risca em rodadas passadas — mencionado aqui só como observação de
higiene, sem impacto no veredito desta feature.

---

## Comentário Cosmético (achado 4)

`supabase/migrations/20260814232339_visao_gerencial_fix_comment_vw_resposta_formulario.sql`
substitui o `COMMENT ON VIEW` por texto que descreve o comportamento real: "respondido = existe
ao menos uma linha em fat_submissao pra esse (id_contrato, id_formulario), **sem checar
enviada_em nem posterioridade** em relação a dt_abertura". Conferido contra o `SELECT`/`EXISTS`
real da view original (`20260814210823_visao_gerencial_vw_resposta_formulario.sql:26-30`): o
`EXISTS` filtra só por `id_contrato`/`id_formulario`, nenhuma cláusula de data — o novo texto
bate exatamente.

**Confirmado aplicado no banco de dev real** (não só o arquivo da migration):

```sql
SELECT obj_description('vw_resposta_formulario'::regclass);
-- "G4 (Bloco 0, GER-08). 1 linha por abertura de formulário × contrato. respondido = existe ao
--  menos uma linha em fat_submissao pra esse (id_contrato, id_formulario), sem checar
--  enviada_em nem posterioridade em relação a dt_abertura (toda submissão já nasce com
--  enviada_em preenchido, não há rascunho). Agregação por formulário fica na camada de query TS."
```

Texto do catálogo em produção-de-dev == texto da migration. ✅ PASS.

---

## Code Quality (só os arquivos tocados pelos 3 commits)

| Principle | Status | Notas |
| --- | --- | --- |
| Minimum code | ✅ | `apararUltimosMeses` é 1 função de 2 linhas, genérica só no necessário (`<T>` porque os 3 consumidores têm formatos de ponto diferentes); nenhuma abstração extra |
| Surgical changes | ✅ | Cada fix só toca os arquivos do achado correspondente — nenhum arquivo fora dos 3 `git show --stat` foi alterado |
| No scope creep | ✅ | Nenhuma refatoração adjacente; `criarClienteMock` ganhou suporte a fila de respostas (array) só porque o teste de AND/OR precisava, documentado no comentário do diff |
| Matches patterns | ✅ | `apararUltimosMeses` segue o padrão já usado no resto do projeto (corte de exibição no último elo antes do componente, nunca reprocessando a query — mesma decisão de `context.md` citada no comentário do arquivo) |
| Spec-anchored outcome check | ✅ | Ver tabela de ACs acima — todos os 7 critérios reabertos fecham com evidência `file:line` + comportamento runtime confirmado |
| Per-layer Coverage Expectation | ✅ | `periodo.ts`: 3 testes cobrindo os 3 ramos (undefined/corte normal/corte maior que a série); mutantes: sensor mata os 2 pontos de risco |
| Every test maps to a spec requirement | ✅ | `periodo.test.ts` cita GER-07(d)/GER-08(c)/GER-12/GER-13 + Edge Case 5 no cabeçalho; os 2 testes de mutante citam a rodada 1 explicitamente |
| Documented guidelines followed | ✅ | Migration nova (nunca edita a aplicada) — `CLAUDE.md` "Migrations são forward-only"; `supabase migration new` gerou o timestamp correto |

Nenhum achado novo de qualidade nos arquivos tocados por esta rodada.

---

## Edge Cases (só o que a rodada 1 marcou como falho)

- [x] Edge Case 5 (`spec.md:202`): filtro Período afeta só os gráficos de evolução — **agora implementado e confirmado em runtime** (ver seção acima). Os demais 6 edge cases da rodada 1 (1,2,3,4,6,7) não foram tocados por nenhum dos 3 commits de fix e são herdados como estavam (5 PASS, 1 parcial documentado — timestamp de refresh do IIP, fora do escopo desta rodada).

---

## Gate Check

- **Gate command**: `npm run test:unit` (raiz) + `cd src/frontend && npm run build` + `npx eslint` nos arquivos tocados pelos 3 commits (não `npm run lint:all` — instrução explícita do orquestrador: falha hoje por arquivos de outra feature em `components/incidencia/` e `components/fundacao/tse-match-search.tsx`, fora de escopo).
- **`npm run test:unit`**: ✅ **446 passed, 0 failed**, 39 arquivos de teste (+3 vs. os 443 da rodada 1: os 3 novos testes de `periodo.test.ts`; os 2 arquivos de mutante ganharam asserções mais fortes sem mudar de contagem de `it()`).
- **`cd src/frontend && npm run build`**: ✅ exit 0 — Next.js 16.2.12/Turbopack, TypeScript limpo, 17 rotas geradas incluindo `/visao-gerencial` (dinâmica). (Precisou `npm install` na raiz primeiro — worktree novo sem `node_modules`, não é um achado do código.)
- **`npx eslint`** nos 7 arquivos tocados (`carteira-ponderada-card.tsx`, `ciclo-etapa-card.tsx`, `periodo.ts`, `periodo.test.ts`, `saude-operacao-bloco.tsx`, `visao-gerencial.test.ts`, `visao-gerencial-g3-g6.test.ts`): ✅ **zero erros, zero warnings**.
- **`test:integration`**: não rodado (instrução explícita do orquestrador — ~80min, risco de colisão com sessões paralelas no Supabase de dev compartilhado; falha conhecida e não relacionada em `regua-instanciacao.integration.test.ts` por fixture órfã de outra sessão, `id_etapa=377`, não é responsabilidade desta verificação).
- **Test count before esta rodada**: 443 (registrado na rodada 1).
- **Test count after esta rodada**: 446 (+3, todos em `periodo.test.ts` — os 2 arquivos de mutante ganharam asserções mais rígidas sem adicionar `it()` novo).
- **Skipped tests**: nenhum.
- **Failures**: nenhuma nos 3 comandos rodados.

---

## Achados Novos (fora dos 4 da rodada 1)

Nenhum achado novo de código nos arquivos tocados pelos 3 commits de fix. A única observação
nova é operacional (linhas órfãs `smoke-test-%` de sessões anteriores em `auth.users`, já
limpas — ver seção Runtime), não um achado de implementação.

---

## Requirement Traceability Update

| Requirement | Status rodada 1 | Status rodada 2 |
| --- | --- | --- |
| GER-05 | ⚠️ Verified (comportamento correto, teste não discrimina) | ✅ Verified (teste discrimina — sensor confirma) |
| GER-07 | ❌ Needs Fix (Período) | ✅ Verified |
| GER-08 | ❌ Needs Fix (Período) | ✅ Verified |
| GER-12 | ❌ Needs Fix (Período) | ✅ Verified |
| GER-13 | ❌ Needs Fix (Período) | ✅ Verified |
| GER-19 (paginação, T17) | ⚠️ comportamento correto, teste não discrimina | ✅ Verified (teste discrimina) |

Demais 16 requisitos (GER-01..04, 06, 09, 10, 11, 14..18, 20..22) não foram tocados pelos 3
commits de fix — herdados como a rodada 1 os deixou (inclusive os 2 `SPEC_DEVIATION`
documentados de GER-10/GER-11 e o spec-precision gap de GER-18, nenhum dos quais fazia parte
dos 4 achados desta rodada e portanto não foram re-verificados).

**22/22 requisitos agora ✅ Verified ou ⚠️ Verified-com-desvio-documentado — 0/22 com gap real aberto.**

---

## Summary

**Overall**: ✅ Ready — os 4 achados da rodada 1 (1 Blocker + 2 Minor + 1 Cosmético) estão
corrigidos, confirmados por leitura de código, suíte de testes (446/446), sensor de
discriminação (2/2 mutantes mortos, exatamente os 2 que sobreviveram na rodada 1) e, no caso do
Blocker, por checagem em runtime real contra o banco de dev (não só estática).

**Spec-anchored check**: 7/7 critérios reabertos pela rodada 1 fecham ✅ PASS. 22/22 requisitos
do spec agora ✅ Verified (16 já vinham limpos da rodada 1 + 6 fechados nesta rodada) ou ⚠️
Verified-com-desvio-documentado (2 `SPEC_DEVIATION` + 1 spec-precision gap, nenhum dos 3
pertencente ao escopo desta rodada).
**Sensor**: 2/2 mutações mortas (as mesmas 2 que sobreviveram na rodada 1).
**Gate**: `test:unit` 446/446, `build` limpo, `eslint` nos arquivos tocados 0 erros/warnings.
`test:integration` não rodado por instrução explícita (custo/risco de colisão).

**What works**: os 3 fixes resolvem exatamente as causas raiz que a rodada 1 diagnosticou, sem
introduzir escopo extra nem tocar arquivo fora do necessário. O fix do Blocker foi confirmado
não só por leitura mas empiricamente, batendo cookie de sessão real contra o dev Supabase
compartilhado e comparando o payload servido com/sem o filtro.

**Issues found**: nenhum novo. Os 2 desvios documentados (`SPEC_DEVIATION` GER-10/GER-11) e o
spec-precision gap (GER-18, timestamp proxy do IIP) continuam de pé como a rodada 1 os deixou —
fora do escopo desta rodada de fix-verify, não bloqueantes (já documentados no próprio código).

**Next steps**: nenhum fix pendente desta rodada. Fica a critério do Pedro decidir se GER-10/
GER-11 (documentados como `SPEC_DEVIATION`) merecem uma rodada própria de fix ou permanecem como
estão. Recomendado UAT manual real no navegador antes do merge pra `master`, como a rodada 1 já
recomendava (nenhuma verificação estática/runtime pontual desta sessão substitui isso).
