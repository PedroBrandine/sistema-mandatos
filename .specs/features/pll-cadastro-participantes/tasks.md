# PLL — Cadastro de Participantes e Ficha do Mentorado Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow
and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth
for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/pll-cadastro-participantes/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase sampling. Guidelines found: `CLAUDE.md`, AD-042 (`.specs/STATE.md` — tela de
> escrita exige profundidade completa: os dois lados de cada condicional) e AD-046 (tela de leitura,
> profundidade reduzida). Import, vínculo TSE e edição de campos são **escrita** → AD-042. Os blocos só de
> leitura da Ficha (Dados TSE, Afinidade, Composição Partidária) → AD-046. Sample:
> `tse-match-search.test.tsx` (padrão de 3 blocos pra componente com debounce/Popover),
> `mandato-wizard.test.tsx`, `supabase/tests/fundacao/fn-criar-mandato.integration.test.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Schema Zod (`schemas/cadastro-participante-pll.ts`) | unit | Cada um dos 25 campos: válido + inválido; e-mail duplicado no arquivo | `src/backend/schemas/*.test.ts` | `npm run test:unit` |
| Query/write functions (`queries/pll-cadastro.ts`) | unit | AD-042: happy + erro (RLS nega, duplicidade) + AD-005 | `src/backend/queries/*.test.ts` | `npm run test:unit` |
| Migration `fat_cadastro_participante` + RLS + GRANT | integration | Insert/update por papel; `UNIQUE (id_projeto, email)`; RLS nega Assessor | `supabase/tests/pll/*.integration.test.ts` | `npm run test:integration` |
| Componentes de escrita (Upload, Lista+ações, VincularTse, Editores) | unit (component), AD-042 | Os dois lados de cada condicional: sucesso/erro, vazio/com dado, habilitado/desabilitado | `src/frontend/components/pll/*.test.tsx` | `npm run test:unit` |
| Componentes de leitura (blocos da Ficha: TSE, Afinidade, Composição) | unit (component), AD-046 | Caminho feliz por AC + estado vazio | `src/frontend/components/pll/*.test.tsx` | `npm run test:unit` |
| Páginas (`participantes`, `participantes/[id]`) | unit (component), AD-042 na de import/lista | Composição + wiring | `src/frontend/app/**/*.test.tsx` | `npm run test:unit` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Função/componente isolado com teste unitário | `npm run test:unit` |
| Full | Migration/RLS/RPC | `npm run test:unit && npm run test:integration` |
| Build | Fim de cada fase | `npm run lint:all && npm run build` |

---

## Execution Plan

### Phase 1: Schema e validação
```
T1 → T2 → T3
```

### Phase 2: Import
```
T4 → T5 → T6
```

### Phase 3: Lista de participantes
```
T7 → T8 → T9
```

### Phase 4: Vínculo TSE
```
T10 → T11 → T12
```

### Phase 5: Ficha do Mentorado — leitura
```
T13 → T14 → T15
```

### Phase 6: Ficha do Mentorado — edição
```
T16 → T17 → T18 → T19
```

---

## Task Breakdown

### T1: Spike — biblioteca de parse de planilha

**What**: Decidir e instalar a dependência de parse `.xlsx`/`.csv` no browser (SheetJS `xlsx` cobre os dois
formatos num pacote só; alternativa `papaparse` só cobre `.csv`, exigiria uma segunda lib pro `.xlsx`).
**Where**: `package.json` / `src/frontend/package.json` (workspace correto — confirmar qual antes de instalar)
**Depends on**: None
**Reuses**: nenhum
**Requirement**: PLL-CP-01

**Tools**: MCP: NONE (verificar licença/tamanho do pacote antes de instalar — decisão registrada no commit). Skill: NONE.

**Done when**:
- [x] Dependência escolhida e instalada no workspace certo (`src/frontend`, onde o parse roda no browser)
- [x] Prova de conceito: 1 arquivo `.xlsx` de teste e 1 `.csv` parseiam para array de objetos
- [x] Decisão documentada no commit message (por que essa lib, não a outra)

**Tests**: none (spike)
**Gate**: build

**Commit**: `chore(pll): adiciona biblioteca de parse de planilha para cadastro de participantes`

---

### T2: Migration `fat_cadastro_participante`

**What**: Tabela nova completa (design.md Data Models), `UNIQUE (id_projeto, email)`, RLS (Gestora/Admin
tudo; Mentor só a própria carteira depois do vínculo; ninguém além de Gestora/Admin vê linha sem vínculo),
GRANTs.
**Where**: `supabase/migrations/<timestamp>_pll_cadastro_participante_estrutura.sql` +
`<timestamp>_pll_cadastro_participante_rls.sql` + `<timestamp>_pll_cadastro_participante_grants.sql`
(3 migrations, mesmo padrão de separação de `catalogos-referencia`)
**Depends on**: None
**Reuses**: padrão `p_por_contrato` de `incidencia_encontros_rls.sql`
**Requirement**: PLL-CP-01…25 (fundação de todas)

**Tools**: MCP: `supabase`. Skill: `supabase`, `supabase-postgres-best-practices`.

**Done when**:
- [x] Tabela criada com todos os `CHECK` do design
- [x] RLS: Gestora/Admin CRUD completo; Mentor SELECT/UPDATE só onde `id_contrato` está na própria carteira
  (`rel_usuario_contrato`); linha com `id_contrato IS NULL` só visível a Gestora/Admin
- [x] GRANTs para os 3 papéis, sem abrir para Assessor (Out of Scope da spec)
- [x] Teste de integração cobre: Gestora insere; Mentor não vê linha não vinculada; Mentor vê e edita linha
  da própria carteira depois do vínculo; Assessor sem GRANT nenhum
- [x] `npm run test:integration` verde

**Tests**: integration
**Gate**: full

**Commit**: `feat(schema): fat_cadastro_participante com RLS e grants`

---

### T3: Schema Zod `cadastro-participante-pll`

**What**: Validação dos 25 campos (3 grupos do Anexo A) + regra de e-mail duplicado dentro do mesmo arquivo.
**Where**: `src/backend/schemas/cadastro-participante-pll.ts`; `.test.ts`
**Depends on**: None
**Reuses**: padrão de outros schemas em `src/backend/schemas/*`
**Requirement**: PLL-CP-01, PLL-CP-02

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [x] Um schema Zod por linha da planilha + uma validação de lote que rejeita e-mail duplicado
- [x] Teste: cada campo obrigatório ausente rejeita; nota fora de 1–5 rejeita; e-mail malformado rejeita;
  2 linhas com mesmo e-mail no lote rejeitam com os índices das duas linhas na mensagem
- [x] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): schema Zod de validação da planilha de cadastro`

---

### T4: `parseCadastroPll`

**What**: Função pura que recebe o arquivo (via lib de T1) e devolve linhas brutas antes da validação Zod.
**Where**: `src/backend/schemas/cadastro-participante-pll.ts` (mesmo arquivo de T3) ou módulo irmão;
`.test.ts`
**Depends on**: T1, T3
**Reuses**: lib escolhida em T1
**Requirement**: PLL-CP-01

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [x] `.xlsx` e `.csv` de teste (fixtures) parseiam para o mesmo formato de objeto
- [x] Cabeçalho de coluna não reconhecido gera erro nomeado (não silencioso)
- [x] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): parseCadastroPll`

---

### T5: `upsertCadastroParticipantes`

**What**: Grava/atualiza N linhas validadas (PLL-CP-03 — upsert por `(id_projeto, email)`).
**Where**: `src/backend/queries/pll-cadastro.ts` (novo); `.test.ts`
**Depends on**: T2, T3
**Reuses**: `supabase-js` `.upsert()` direto — sem RPC (AD-024 não se aplica, é 1 tabela)
**Requirement**: PLL-CP-01, PLL-CP-03, PLL-CP-04

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [x] Linha nova insere; linha com e-mail já existente no projeto atualiza (nunca duplica)
- [x] Reimportação **nunca** limpa `id_contrato`/`id_vinculo_tse` já preenchidos (edge case da spec)
- [x] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): upsertCadastroParticipantes`

---

### T6: `UploadPlanilhaCard`

**What**: Componente de upload + drag-and-drop + exibição de erro de validação + métricas de cadastro
(PLL-CP-01…04).
**Where**: `src/frontend/components/pll/upload-planilha-card.tsx`; `.test.tsx`
**Depends on**: T4, T5
**Reuses**: `EstadoVazio`/`ErroInline`
**Requirement**: PLL-CP-01…04

**Tools**: MCP: `figma` (conferir `387:4`). Skill: `figma-dominio-legisla`.

**Done when**:
- [x] Upload rejeita arquivo com erro de validação (mostra lista completa, nenhuma linha entra)
- [x] Sucesso mostra "Última importação: DD/MM/AAAA por ‹nome›" e atualiza as 3 métricas
- [x] `npm run test:unit` verde

**Tests**: unit (AD-042 — sucesso e cada tipo de erro)
**Gate**: quick

**Commit**: `feat(pll): UploadPlanilhaCard`

---

### T7: `buscarCadastroParticipantesPll`

**What**: Lista com busca (nome/e-mail/parlamentar), filtro (partido/UF), paginação (PLL-CP-05…09).
**Where**: `src/backend/queries/pll-cadastro.ts`; `.test.ts`
**Depends on**: T2
**Reuses**: nenhum
**Requirement**: PLL-CP-05, PLL-CP-06, PLL-CP-07, PLL-CP-08

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [ ] Busca por qualquer um dos 3 campos; filtro combinável; paginação com total
- [ ] Campo obrigatório vazio chega como `null` (vira `—` no componente)
- [ ] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): buscarCadastroParticipantesPll`

---

### T8: `ListaParticipantesPll`

**What**: Tabela com busca, filtros, indicador TSE ✓/✕, status de cadastro, ações (editar/ver/vincular).
**Where**: `src/frontend/components/pll/lista-participantes-pll.tsx`; `.test.tsx`
**Depends on**: T7
**Reuses**: `Table` de `components/ui`
**Requirement**: PLL-CP-05…09

**Tools**: MCP: `figma`. Skill: `figma-dominio-legisla`.

**Done when**:
- [ ] Rótulo "Parlamentar" (D-1), não "Deputado(a)"
- [ ] Célula ausente = `—`; paginação "Mostrando X–Y de N"
- [ ] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): ListaParticipantesPll`

---

### T9: Montagem da página **Participantes**

**What**: Rota `/produtos/pll/participantes`, junta `UploadPlanilhaCard` + `ListaParticipantesPll`.
**Where**: `src/frontend/app/(app)/produtos/[slug]/participantes/page.tsx` (novo, só existe para `pll`);
`page.test.tsx`. Também: liga a aba **Participantes** do `ABAS_POR_PRODUTO` (feature-irmã T2) a esta rota.
**Depends on**: T6, T8; `pll-dashboard-agenda` T2 (config de abas)
**Reuses**: `ProdutoShell`
**Requirement**: PLL-SH-02, PLL-CP-01…09

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [ ] Página monta upload + lista, RLS decide o que cada papel vê
- [ ] `npm run lint:all && npm run build && npm run test:unit` verdes

**Tests**: unit
**Gate**: build

**Commit**: `feat(pll): monta a página de Participantes`

---

### T10: `vincularParticipanteAoTse`

**What**: Orquestra `criarMandato` (existente) + atualiza a linha de staging com `id_contrato`/
`id_vinculo_tse` resultantes (PLL-CP-11).
**Where**: `src/backend/queries/pll-cadastro.ts`; `.test.ts`. **Antes de codar**: checar se
`RetornoCriarMandato`/`criarMandato` (`src/backend/rpc/mandato.ts:33-38,59-65`) já expõe `id_contrato` de
forma suficiente para esta chamada — se não, é ajuste pontual nesse arquivo, não RPC nova.
**Depends on**: T2
**Reuses**: `criarMandato`, `marcarCandidaturaVigente` de `rpc/mandato.ts`, sem RPC nova (AD-024)
**Requirement**: PLL-CP-11, PLL-CP-12, PLL-CP-13

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [ ] Chama `criarMandato` com `p_candidatura` preenchido, depois `UPDATE` na linha de staging
- [ ] Troca de vínculo (PLL-CP-12) preserva histórico em `rel_mandato_candidatura` (comportamento já
  garantido pela RPC existente — teste confirma que esta função não o quebra)
- [ ] Vínculo a candidatura já usada por outro contrato do produto propaga o erro de `dim_contratante`
  `UNIQUE`, mapeado por `mapeiaErroRpc` (mensagem clara, não genérica)
- [ ] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): vincularParticipanteAoTse`

---

### T11: `VincularTseDialog`

**What**: Dialog que abre `TseMatchSearch` pré-preenchido com nome/partido/UF autodeclarados, botão "não
encontrado" (PLL-CP-10, PLL-CP-13).
**Where**: `src/frontend/components/pll/vincular-tse-dialog.tsx`; `.test.tsx`
**Depends on**: T10
**Reuses**: `TseMatchSearch` **sem alteração**
**Requirement**: PLL-CP-10, PLL-CP-13

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [ ] Busca pré-preenchida com os campos autodeclarados
- [ ] Fechar sem escolher candidatura nem marcar "não encontrado" é bloqueado (PLL-CP-13)
- [ ] `npm run test:unit` verde (mesmo padrão de 3 blocos de `tse-match-search.test.tsx`, pelo Popover)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): VincularTseDialog`

---

### T12: Wire do vínculo na lista/página

**What**: Botão "vincular TSE" de cada linha sem vínculo abre `VincularTseDialog`; sucesso atualiza o
indicador ✓ na lista sem reload de página.
**Where**: `src/frontend/components/pll/lista-participantes-pll.tsx` (modifica, PLL-CP-10);
`src/frontend/app/(app)/produtos/[slug]/participantes/page.tsx` (modifica); testes correspondentes
**Depends on**: T8, T9, T11
**Reuses**: invalidação de query, mesmo padrão de `moverCardOtimista`/`invalidateQueries` do Dashboard de
Estratégia
**Requirement**: PLL-CP-10, PLL-CP-11, PLL-CP-12

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [ ] Vincular atualiza a linha sem recarregar a lista inteira
- [ ] `npm run lint:all && npm run build && npm run test:unit` verdes

**Tests**: unit
**Gate**: build

**Commit**: `feat(pll): liga o vínculo TSE à lista de participantes`

---

### T13: `buscarComposicaoPartidariaCasa`

**What**: Agregação de `tse.dim_candidatura` por Casa/UF/ano/cargo, eleitos por partido (PLL-CP-17…19).
**Where**: `src/backend/queries/tse.ts` (modifica); `.test.ts`
**Depends on**: None
**Reuses**: mesmo arquivo das demais leituras de TSE
**Requirement**: PLL-CP-17, PLL-CP-18, PLL-CP-19

**Tools**: MCP: `supabase` (para consultar `SELECT DISTINCT ds_sit_tot_turno` em dev antes de escrever o
filtro — Knowledge Verification Chain Step 1, ver Risks do design). Skill: `supabase`.

**Done when**:
- [ ] Valores reais de `ds_sit_tot_turno` que significam "eleito" confirmados contra a base de dev (documentar no commit quais são)
- [ ] Partido com < 3% agrupa em "Outros"
- [ ] Casa/ano sem dado devolve vazio explícito (não erro)
- [ ] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): buscarComposicaoPartidariaCasa`

---

### T14: Bloco "Dados TSE" e "Afinidade de Agenda" da Ficha

**What**: Componentes de leitura (PLL-CP-14…16), sem os 3 campos inexistentes (D-2).
**Where**: `src/frontend/components/pll/ficha-dados-tse.tsx`, `ficha-afinidade-agenda.tsx`; `.test.tsx`
**Depends on**: T2 (lê `fat_cadastro_participante` para a Afinidade)
**Reuses**: `informacoes-tse-mandato.tsx` como referência de layout
**Requirement**: PLL-CP-14, PLL-CP-15, PLL-CP-16

**Tools**: MCP: `figma`. Skill: `figma-dominio-legisla`.

**Done when**:
- [ ] Sem Número do Candidato/Classificação na Lista/Despesa de Campanha
- [ ] Participante não vinculado mostra estado vazio "Ainda não vinculado ao TSE" com atalho
- [ ] `npm run test:unit` verde (AD-046 — caminho feliz de cada AC)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): blocos Dados TSE e Afinidade de Agenda da Ficha`

---

### T15: Montagem da `FichaMentoradoPage` (leitura)

**What**: Rota `/produtos/pll/participantes/[id]`, monta os blocos de leitura (T13, T14).
**Where**: `src/frontend/app/(app)/produtos/pll/participantes/[id]/page.tsx` (novo); `page.test.tsx`
**Depends on**: T13, T14
**Reuses**: `ProdutoShell`
**Requirement**: PLL-CP-14…19

**Tools**: MCP: `figma`. Skill: `figma-dominio-legisla`.

**Done when**:
- [ ] Página monta cabeçalho + Dados TSE + Composição Partidária + Afinidade
- [ ] `npm run lint:all && npm run build && npm run test:unit` verdes

**Tests**: unit
**Gate**: build

**Commit**: `feat(pll): monta a Ficha do Mentorado (blocos de leitura)`

---

### T16: `atualizarCamposEditaveisParticipante`

**What**: `UPDATE` dos campos editáveis no sistema — desafios, destaques, ambição, SWOT (PLL-CP-20…25).
**Where**: `src/backend/queries/pll-cadastro.ts`; `.test.ts`
**Depends on**: T2
**Reuses**: `.update()` direto via `supabase-js` (1 tabela, sem RPC)
**Requirement**: PLL-CP-20, PLL-CP-21, PLL-CP-24

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [ ] Atualiza qualquer subconjunto dos 8 campos `TEXT[]`/texto sem sobrescrever os demais
- [ ] Teste: Assessor tenta escrever e recebe erro de RLS (PLL-CP-23) — mapeado, não genérico
- [ ] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): atualizarCamposEditaveisParticipante`

---

### T17: `EditorListaTexto`

**What**: Componente de lista editável genérico (adicionar/editar/remover item) — usado em Desafios e
Destaques (PLL-CP-20, PLL-CP-22).
**Where**: `src/frontend/components/pll/editor-lista-texto.tsx`; `.test.tsx`. **Antes de criar**: buscar se
já existe um componente genérico equivalente no repo (design.md Risks) — se existir, reaproveitar em vez de
duplicar.
**Depends on**: T16
**Reuses**: a confirmar na busca acima
**Requirement**: PLL-CP-20, PLL-CP-22

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [ ] Adicionar, editar, remover item; estado vazio "Nada registrado ainda" com atalho
- [ ] `npm run test:unit` verde (AD-042 — os dois lados: com item e sem item)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): EditorListaTexto (Desafios e Destaques)`

---

### T18: `EditorAmbicaoPolitica` e `EditorSwot`

**What**: Texto livre + até 3 tags (Ambição); 4 quadrantes independentes (SWOT) — PLL-CP-21, PLL-CP-24, PLL-CP-25.
**Where**: `src/frontend/components/pll/editor-ambicao-politica.tsx`, `editor-swot.tsx`; `.test.tsx`
**Depends on**: T16
**Reuses**: `EditorListaTexto` (T17) dentro de cada quadrante do SWOT
**Requirement**: PLL-CP-21, PLL-CP-24, PLL-CP-25

**Tools**: MCP: `figma` (conferir `412:3` Análise SWOT). Skill: `figma-dominio-legisla`.

**Done when**:
- [ ] Ambição limita a 3 tags; SWOT mostra estado vazio por quadrante independentemente dos outros 3
- [ ] `npm run test:unit` verde

**Tests**: unit
**Gate**: quick

**Commit**: `feat(pll): EditorAmbicaoPolitica e EditorSwot`

---

### T19: Wire dos editores na Ficha + regra de somente-leitura

**What**: Inclui os 3 blocos editáveis na `FichaMentoradoPage`; Assessor (se tiver acesso) vê tudo
somente-leitura (PLL-CP-23).
**Where**: `src/frontend/app/(app)/produtos/pll/participantes/[id]/page.tsx` (modifica); `page.test.tsx`
**Depends on**: T15, T17, T18
**Reuses**: `papel_global`/`papel_no_contrato` já disponíveis via sessão (mesmo padrão de outras telas com
controle de papel)
**Requirement**: PLL-CP-20…25

**Tools**: MCP: NONE. Skill: NONE.

**Done when**:
- [ ] Mentor/Gestora editam; Assessor não vê botão de editar em nenhum dos 3 blocos
- [ ] `npm run lint:all && npm run build && npm run test:unit` verdes

**Tests**: unit
**Gate**: build

**Commit**: `feat(pll): integra edição de Desafios/Destaques/Ambição/SWOT à Ficha`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

Phase 1:  T1 ──→ T2 ──→ T3
Phase 2:  T4 ──→ T5 ──→ T6
Phase 3:  T7 ──→ T8 ──→ T9
Phase 4:  T10 ──→ T11 ──→ T12
Phase 5:  T13 ──→ T14 ──→ T15
Phase 6:  T16 ──→ T17 ──→ T18 ──→ T19
```

19 tasks totais → 3 batches de ~6-7. Empacotamento sugerido: **Lote 1** = Fases 1–2 (T1–T6, 6 tasks);
**Lote 2** = Fases 3–4 (T7–T12, 6 tasks); **Lote 3** = Fases 5–6 (T13–T19, 7 tasks).

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | 1 dependência + prova de conceito | ✅ Granular |
| T2 | 1 tabela + RLS + grants (3 migrations coesas) | ✅ Granular |
| T3–T5 | 1 schema / 1 função / 1 função | ✅ Granular |
| T6 | 1 componente | ✅ Granular |
| T7–T8 | 1 função / 1 componente | ✅ Granular |
| T9 | 1 página | ✅ Granular |
| T10–T11 | 1 função / 1 componente | ✅ Granular |
| T12 | 1 wire (2 arquivos, mesma mudança lógica) | ✅ Granular |
| T13–T14 | 1 função / 2 componentes irmãos coesos | ✅ Granular |
| T15 | 1 página | ✅ Granular |
| T16 | 1 função | ✅ Granular |
| T17–T18 | 1 componente / 2 componentes coesos | ✅ Granular |
| T19 | 1 wire | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | — | ✅ |
| T2 | None | — | ✅ |
| T3 | None | (mesma fase, sequencial) | ✅ |
| T4 | T1, T3 | Fase 2 após Fase 1 | ✅ |
| T5 | T2, T3 | idem | ✅ |
| T6 | T4, T5 | T4→T5→T6 | ✅ |
| T7 | T2 | Fase 3 após Fase 1 | ✅ |
| T8 | T7 | T7→T8 | ✅ |
| T9 | T6, T8, spec-irmã T2 | T8→T9, nota de dependência externa | ✅ |
| T10 | T2 | Fase 4 após Fase 1 | ✅ |
| T11 | T10 | T10→T11 | ✅ |
| T12 | T8, T9, T11 | T11→T12 (T8/T9 já concluídas) | ✅ |
| T13 | None | Fase 5, sem dependência | ✅ |
| T14 | T2 | idem | ✅ |
| T15 | T13, T14 | T13→T14→T15 | ✅ |
| T16 | T2 | Fase 6 após Fase 1 | ✅ |
| T17 | T16 | T16→T17 | ✅ |
| T18 | T16 | idem | ✅ |
| T19 | T15, T17, T18 | T17/T18→T19 (T15 já concluída) | ✅ |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Dependência/spike | none | none | ✅ OK |
| T2 | Migration | integration | integration | ✅ OK |
| T3 | Schema Zod | unit | unit | ✅ OK |
| T4–T5 | Função | unit | unit | ✅ OK |
| T6 | Componente (escrita) | unit (AD-042) | unit | ✅ OK |
| T7 | Função | unit | unit | ✅ OK |
| T8 | Componente | unit | unit | ✅ OK |
| T9 | Página | unit | unit | ✅ OK |
| T10 | Função | unit | unit | ✅ OK |
| T11 | Componente (escrita) | unit (AD-042) | unit | ✅ OK |
| T12 | Wire (página+componente) | unit | unit | ✅ OK |
| T13 | Função | unit | unit | ✅ OK |
| T14 | Componente (leitura) | unit (AD-046) | unit | ✅ OK |
| T15 | Página | unit | unit | ✅ OK |
| T16 | Função | unit | unit | ✅ OK |
| T17–T18 | Componente (escrita) | unit (AD-042) | unit | ✅ OK |
| T19 | Wire | unit | unit | ✅ OK |
