# KPI de situação dos mandatos ativos — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name
and follow its Execute flow and Critical Rules.** Do not search for skill
files by filesystem path.

**If the skill cannot be activated, STOP and tell the user.**

---

**Design**: `.specs/features/kpi-status-mandatos-ativos/design.md`
**Status**: In Progress
**Decisões**: AD-050, AD-051 (`.specs/STATE.md`)

## Registro de execução

| Task | Status | Commit |
| --- | --- | --- |
| T1 | Seed de cenários escrito, executado em dev e testado | `b3c949b` |
| T2 | Apagamento executado em dev (autorizado por Pedro, 15/09) | `b3c949b` (registro) |
| T3 | Migration aplicada em dev, 27 testes de integração verdes | `e5f248e` |
| T4 | Feita (junto com T5) | `79da53b` |
| T5 | Feita | `79da53b` |
| T6 | Feita | `05e4e9c` |
| T7 | **Pendente — a tela abre, os números ainda não foram conferidos** | — |
| Fix 1 | Gaps da 1ª iteração do Verifier (KSM-17, borda, KSM-11, recorte) | `33c67b4` |
| Fix 2 | Borda de 'atrasado' derivada do limiar real (2ª iteração) | `03d88f6` |

**Verificação**: 2 iterações do Verifier. 1ª → FAIL (KSM-17 sem asserção e
mutante vivo; KSM-11 sem teste; limiar só testado pelo meio). 2ª → **PASS
condicionado à P4**, 7 mutantes mortos, 1 sobrevivente aceito
(`ATIVACAO_ARRASTE_PX = 1` passa — o contrato é "distância não-nula", não "8").

**Gates finais**: unit 775 ✅ · integração da view 27 ✅ · build ✅ · lint ❌
com os mesmos 10 erros pré-existentes, nenhum em arquivo desta feature.

**Bloqueio de ambiente removido em 2026-09-15/16**: a validação de T7 ficou
travada porque toda sub-rota dentro de segmento dinâmico devolvia 404 no
`next dev` (`/produtos/[slug]/dashboard`, mas também `/contratos/[id]/informacoes`
— nada a ver com esta feature). Era o **genérico do Next**, não o `not-found.tsx`
do produto: o `layout.tsx` nunca rodava, o roteador não conhecia a rota. Causa:
`.next/dev` com estado velho — tinha `produtos/[slug]/contratos/page.js`
compilado, rota que não existe mais no código. Resolvido derrubando o dev
server, apagando `src/frontend/.next/dev` e subindo de novo; as três rotas
voltaram a 200. Primo do defeito de `.specs/features/dev-server-rotas-dinamicas-500/`,
mas não o mesmo: a mitigação `workerThreads` está ativa e previne o 500 por
console morto, não este cache sujo.

**T7 continua pendente**: Pedro confirmou em 16/09 que a tela abre, mas **não
conferiu os números, nem o clique, nem o arraste**. A feature NÃO está validada
— o critério que ela própria criou (P4: pronto passa pela tela) segue sem ser
cumprido. Não tratar como concluída.

**Aberto e conhecido**:
- `handleDragEnd`/`onMoverCard` sem asserção: a metade "arrastar move a etapa"
  de KSM-17 só se prova na tela (P4). A metade "clicar não arrasta" está coberta.
- KSM-05 exercita só um limiar desligado; o edge case "os dois inativos" não
  tem teste.
- Helpers de classificação leem sempre `escopo_gestora = false`; o recorte por
  gestora é coberto por KSM-08 e pelo seed, não por asserção da quebra.
- `.specs/STATE.md` com AD-050/AD-051 **não commitado** — o arquivo carrega
  junto AD-047/048/049, de trabalho anterior de outra sessão. Aguarda decisão
  de Pedro para não misturar autoria.

**Desvio de planejamento (T4+T5 num commit só)**: remover `mandatosEmAtraso`
do tipo quebra o único componente que o consome. Commitar T4 isolada deixaria
o repo sem compilar entre os dois commits, e o gate não passaria nela. As duas
são uma mudança atômica, e a divisão em tasks separadas estava errada.

**Premissa da Fase 1 caiu**: a spec foi escrita sobre "12 contratos de teste,
10 nunca movidos" (inventário de 14/09). O inventário de 15/09 mostrou **27
mandatos ativos de Estratégia, apenas 1 sem etapa atual**, vários criados no
mesmo dia. A base de dev não estava incoerente como se supunha — o card é que
estava, e a migration de T3 já o corrigia sobre os dados reais (27 = 6+0+21).

**Apagamento executado mesmo assim (decisão de Pedro, 15/09)**. Levantado e
apresentado duas vezes; na primeira, a lista de dependências saiu **incompleta**
(7 tabelas / 429 linhas) porque a consulta de FKs foi lida só pelo fim. A lista
corrigida — 11 tabelas / ~485 linhas, incluindo 29 `dim_planejamento`, 13
`fat_objetivo_especifico` e 13 `fat_meta` do módulo de Planejamento em
desenvolvimento ativo — foi apresentada antes da execução, e Pedro confirmou.

- Apagados os **28 contratos de Estratégia** e dependentes, em transação única,
  ordem folha→raiz (nenhuma FK tem CASCADE). PLL (4) e Coalizão (1) intactos —
  estavam fora do escopo autorizado.
- O script de exclusão **não foi versionado**, de propósito: um arquivo de
  DELETE em massa no repo é uma arma apontada para produção. A operação fica
  registrada aqui e em `validation.md`; o repovoamento, esse sim versionado,
  é `supabase/seed_cenarios_estrategia.sql`.
- Repovoado pelo seed: 4 mandatos ativos (2 atrasados, 1 atenção, 1 normal) +
  1 encerrado fora da contagem. Os 5 estados passaram a existir — "atenção"
  estava zerado antes e agora é exercitável na tela.

**Suíte de integração completa interrompida**: rodou 1h50 acumulando 6s de CPU
(bloqueada em rede contra a Management API, não processando). Morta com
`TaskStop`; catálogo `ref_limiar_pendencia` conferido depois — os 4 limiares
seguem ativos (70/100), nada ficou desligado pela interrupção. O gate da T3
passou a ser o arquivo de integração da própria view, não a suíte inteira.

---

## Test Coverage Matrix

> Gerada por amostragem do próprio repositório. Guidelines encontradas:
> `CLAUDE.md` (comandos e regra de migrations), `vitest.config.ts`,
> `vitest.integration.config.ts`, `.specs/LESSONS.md` (nenhuma lição
> `confirmed` — candidatas **não** aplicadas como guia).
>
> **Correção de registro**: as lições candidatas L-006 e L-007 afirmam que o
> projeto não tem harness de componente. Tem — `@testing-library/react` +
> `jsdom` via `environmentMatchGlobs`, desde AD-042. Render e interação são
> testáveis e portanto exigidos aqui.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| View SQL (`vw_estrategia_kpi`) | integration | Toda AC de agregação + todo edge case listado; contagens reconstruídas por query independente escrita a partir do spec, nunca do corpo da view | `supabase/tests/estrategia/*.integration.test.ts` | `npm run test:integration` |
| Query backend (`queries/*.ts`) | unit | Caminho feliz + ausência de linha + forma do `select` | `src/backend/**/*.test.ts` | `npm run test:unit` |
| Componente React | unit (jsdom) | Presença e ausência de cada valor; rótulos; destino de navegação | `src/frontend/**/*.test.tsx` | `npm run test:unit` |
| Seed / dados de dev | integration | Os 5 casos de classificação aparecem na view após o seed | `supabase/tests/estrategia/*.integration.test.ts` | `npm run test:integration` |
| Migration DDL | none | — (provada pelos testes de integração da view) | — | gate de build |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks só com teste unitário/componente | `npm run test:unit` |
| Full | Tasks que tocam banco, view ou seed | `npm run test:unit && npm run test:integration` |
| Build | Fim de fase | `npm run lint:all && npm run test:unit && npm run test:integration && npm run build` |

---

## Execution Plan

### Fase 1: Dados de dev (pré-requisito, decisão do Pedro)

```
T1 → T2
```

### Fase 2: A definição correta, no banco

```
T3
```

### Fase 3: Camada de leitura e tela

```
T4 → T5 → T6
```

### Fase 4: Validação ao vivo

```
T7
```

---

## Task Breakdown

### T1: Seed de cenários de classificação

**What**: Criar seed idempotente que materializa em dev os 5 casos de
classificação de prazo, para que a tela tenha o que mostrar e a validação
tenha o que conferir.
**Where**: `supabase/seed_cenarios_estrategia.sql`
**Depends on**: None
**Reuses**: padrão idempotente de `supabase/seed_test.sql` (resolve por chave
estável antes de inserir)
**Requirement**: KSM-11, KSM-13

**Tools**: MCP: NONE · Skill: `supabase`

**Done when**:

- [ ] Cria contratos identificáveis por nome estável (`KPI Cenario <caso>`)
      cobrindo: atrasado, atenção, normal, sem transição, não ativo
- [ ] Datas ancoradas em `CURRENT_DATE - N`, nunca literais — o seed não
      envelhece
- [ ] Rodar duas vezes seguidas não duplica linha nem viola CHECK/UNIQUE
- [ ] Nenhuma alteração de schema no arquivo (é seed, não migration)
- [ ] Gate full passa

**Tests**: integration
**Gate**: full

---

### T2: Recomposição dos dados incoerentes de dev

**What**: Remover os contratos de teste que hoje deixam dev incoerente (os
que nunca foram movidos e não representam operação real) e repovoar com T1.
**Where**: banco de dev (via `supabase db query --linked`), script em
`supabase/seed_cenarios_estrategia.sql`
**Depends on**: T1
**Requirement**: KSM-12

**Tools**: MCP: NONE · Skill: `supabase`

**Done when**:

- [ ] `cat supabase/.temp/project-ref` conferido contra `docs/ambientes.md` e
      **confirmado que é dev**
- [ ] Lista exata do que será apagado apresentada ao Pedro e **confirmada por
      ele na hora** — aprovação em princípio não basta para operação
      destrutiva em banco compartilhado
- [ ] Nenhum `db reset`; nenhuma alteração de schema
- [ ] Após a recomposição, a view devolve os 5 casos
- [ ] Gate full passa (a suíte de integração existente continua verde)

**Tests**: integration
**Gate**: full

---

### T3: Migration — classificação por etapa de referência

**What**: `CREATE OR REPLACE VIEW vw_estrategia_kpi` com `etapa_referencia`
(fallback para a etapa de ordem 1, AD-051) e as 3 colunas de quebra
particionando os mandatos ativos; `COMMENT ON VIEW` reescrito registrando que
`mandatos_em_atraso` ficou órfã.
**Where**: `supabase/migrations/<timestamp>_estrategia_kpi_situacao_mandatos.sql`,
`supabase/tests/estrategia/vw-estrategia-kpi.integration.test.ts`
**Depends on**: None (validação real depende de T2)
**Reuses**: corpo de `20260914161230_estrategia_vw_kpi_quebra_atraso.sql`;
fallback de `queries/kanban.ts:172-178`
**Requirement**: KSM-02, KSM-03, KSM-04, KSM-05, KSM-07, KSM-08

**Tools**: MCP: NONE · Skill: `supabase`, `supabase-postgres-best-practices`

**Done when**:

- [ ] Arquivo criado por `supabase migration new` (prefixo de timestamp),
      forward-only — nenhuma migration existente editada
- [ ] `CREATE OR REPLACE` (nunca `DROP`), ACL preservada
- [ ] Aplicada em dev por `supabase db push` com o ref conferido
- [ ] Teste assere `atrasados + atenção + normal = mandatos_ativos` em
      **toda** linha da view, não só na linha total
- [ ] Teste de fallback: contrato com `id_etapa_atual` nulo e início antigo
      aparece em `atrasados`
- [ ] Teste de limiar inativo: coluna vira `NULL` e o fechamento se mantém
      nas colunas restantes
- [ ] Teste de recorte: projeto e gestora fecham, e nenhum valor de recorte
      excede a linha total
- [ ] Contagens reconstruídas por query independente escrita a partir do
      spec, não copiada do corpo da view
- [ ] Gate full passa

**Tests**: integration
**Gate**: full

---

### T4: Query — remover a métrica órfã

**What**: Tirar `mandatosEmAtraso` de `EstrategiaKpi`, `RowEstrategiaKpi`,
`KPI_AUSENTE`, do `select` literal e do mapeamento.
**Where**: `src/backend/queries/estrategia-kpi.ts`,
`src/backend/queries/estrategia-kpi.test.ts`
**Depends on**: T3
**Requirement**: KSM-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `select` continua string literal inline (a inferência de tipo do
      supabase-js depende disso)
- [ ] Nenhuma referência a `mandatosEmAtraso` sobra no TS
- [ ] Teste de linha ausente continua provando que todos os campos viram
      `null`, nunca `0`
- [ ] Gate quick passa

**Tests**: unit
**Gate**: quick

---

### T5: Card "Mandatos ativos" com quebra por status

**What**: Substituir `KpiMandatosAtraso` por `KpiMandatosAtivos` (número
grande = mandatos ativos + 3 linhas de status) e remover o card de atraso da
faixa, que passa a ter 5 cards.
**Where**: `src/frontend/components/estrategia/kpi-row.tsx`,
`src/frontend/components/estrategia/kpi-row.test.tsx`
**Depends on**: T4
**Reuses**: `ESTADO_BREAKDOWN`, `ValorOuAusencia`, `formatar` do próprio
arquivo
**Requirement**: KSM-01, KSM-02

**Tools**: MCP: NONE · Skill: `figma-dominio-legisla` (conferir rótulos)

**Done when**:

- [ ] Nenhum elemento com o rótulo "Mandatos em atraso" é renderizado
- [ ] Faixa renderiza 5 cards (`lg:grid-cols-5`)
- [ ] Card mostra número grande + 3 linhas, cada uma com seu próprio `—`
      quando aquele valor vem `null`
- [ ] `0` renderiza `0`, não `—` (AD-005)
- [ ] Gate quick passa

**Tests**: unit (jsdom)
**Gate**: quick

---

### T6: Card do Quadro navega para o mandato

**What**: Envolver o conteúdo do card arrastável em `<Link href="/contratos/[id]">`,
restaurando o comportamento perdido na substituição do `KanbanCard`.
**Where**: `src/frontend/components/estrategia/quadro-acompanhamento.tsx`,
`src/frontend/components/estrategia/quadro-acompanhamento.test.tsx`
**Depends on**: None
**Reuses**: `src/frontend/components/kanban/kanban-card.tsx` (padrão e o
motivo documentado do `activationConstraint`)
**Requirement**: KSM-16, KSM-17, KSM-18, KSM-19

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `<Link>` fica **dentro** do nó arrastável, não em volta dele
- [ ] `activationConstraint: { distance: 8 }` confirmado no `PointerSensor` —
      sem ele o clique nunca chega ao link
- [ ] Teste assere o `href` de cada card, inclusive de contrato não ativo
- [ ] Link alcançável por teclado, com foco visível
- [ ] Gate quick passa

**Tests**: unit (jsdom)
**Gate**: quick

---

### T7: Validação ao vivo

**What**: Conferir os números na tela renderizada, sem filtro e com filtro, e
registrar o observado.
**Where**: `.specs/features/kpi-status-mandatos-ativos/validation.md`
**Depends on**: T1, T2, T3, T4, T5, T6
**Requirement**: KSM-09, KSM-14, KSM-15

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Números observados no Dashboard registrados por recorte (sem filtro,
      um filtro de gestora, um de projeto)
- [ ] Soma das 3 linhas conferida contra o número grande em cada recorte
- [ ] Contagem por status conferida contra os chips do Quadro no mesmo filtro
- [ ] Clique num card conferido na tela
- [ ] Arraste conferido junto (o card não some ao ser arrastado — risco de
      overflow sem `DragOverlay` registrado na spec)
- [ ] Divergência entre tela e view reprova, mesmo com gate verde
- [ ] Gate build passa

**Tests**: none (validação humana)
**Gate**: build

---

## Check 2 — Diagram × Definition Cross-Check

| Task | Diagrama | `Depends on` | OK |
| --- | --- | --- | --- |
| T1 | início da Fase 1 | None | ✅ |
| T2 | T1 → T2 | T1 | ✅ |
| T3 | Fase 2, isolada | None | ✅ |
| T4 | início da Fase 3 | T3 | ✅ |
| T5 | T4 → T5 | T4 | ✅ |
| T6 | T5 → T6 | None (ordem por coesão de fase, não dependência) | ✅ |
| T7 | Fase 4 | T1–T6 | ✅ |

## Check 3 — Test Co-location Validation

| Task | Camada tocada | Tipo exigido pela matriz | Tipo na task | OK |
| --- | --- | --- | --- | --- |
| T1 | Seed | integration | integration | ✅ |
| T2 | Seed / dados | integration | integration | ✅ |
| T3 | View SQL | integration | integration | ✅ |
| T4 | Query backend | unit | unit | ✅ |
| T5 | Componente React | unit (jsdom) | unit (jsdom) | ✅ |
| T6 | Componente React | unit (jsdom) | unit (jsdom) | ✅ |
| T7 | — | none | none | ✅ |

## Check 1 — Granularidade

7 tasks, cada uma com um entregável único (um arquivo de seed, uma operação
de dados, uma migration, uma query, um componente, um componente, um
relatório). Cabe em um único batch (~7) — **execução inline, sem
sub-agentes**.

---

## Cobertura de requisitos

19 requisitos, 19 mapeados. KSM-10 (troca de filtro sem recarga) é satisfeito
por construção — a `queryKey` do Dashboard já inclui `filtro` — e está
declarado como **spec-precision gap** no design, não como teste dedicado que
só restataria a arquitetura.
