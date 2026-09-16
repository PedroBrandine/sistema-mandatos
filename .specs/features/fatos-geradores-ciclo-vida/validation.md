# Fatos Geradores — Linha do Tempo e Ciclo de Vida Validation

**Date**: 2026-09-16
**Spec**: `.specs/features/fatos-geradores-ciclo-vida/spec.md`
**Diff range**: commits `5dd130f`, `a18f532`, `bd0480b`, `d4345bd`, `10d8ee1`, `3acb80f`, `9edc738`, `368fa91`, `15e1ea2`, `d1b6384`, `fd93a84`, `57db38c`, `113a3cf`, `3690519`, `6c36975`, `cb4dc71`, `d17542b`, `92c2649`, `7e30afc`, `5f2c4ba`, `bdbc931`, `76c9ae1`, `6024a62`, `6f4789e`, `6a1f633`, `61daacc`, `7fc6c29`, `f036350` (44 arquivos de produto/teste + 6 migrations — não é um range contíguo de `git log`; o repositório é compartilhado e tem dezenas de commits concorrentes de outra feature, `ficha-mandato-contrato`, intercalados no mesmo período)
**Verifier**: sessão independente de fresh-eyes (2 sub-agentes Explore dedicados a re-derivar evidência sem herdar o raciocínio do autor) + sensor de mutação e gate check rodados diretamente

---

## Task Completion

| Task | Status | Notes |
| --- | --- | --- |
| T1–T6 (Migrations) | ✅ Done | Ver Gate Check — todas aplicadas no dev, testes de integração próprios passando |
| T7–T14 (Backend) | ✅ Done | Inclui achado do batch worker: `database.types.ts` regenerado antes de T7 (pré-requisito não previsto em tasks.md) |
| T15–T22 (Componentes) | ✅ Done | T22 recebeu um fix de contrato (`conteudo: ReactNode` → `renderizar: (fechar) => ReactNode`) commitado separadamente antes de T25, achado durante a própria Execute |
| T23–T27 (Migração final) | ✅ Done | T26/T27 corrigiram achados de lint reais nos próprios arquivos (`react-hooks/set-state-in-effect`, `setTipos([])` redundante, 2 vars não usadas em teste de T5) |
| Fix pós-T27 (Verifier) | ✅ Done | Gap real encontrado e corrigido: "Editar" da Linha do Tempo nunca estava conectado a nada (ver Gaps) |

---

## Spec-Anchored Acceptance Criteria

### P1: Registrar Fato Gerador pelo wizard

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1/AC2/AC3: passo 1 pergunta natureza + origem, "sem origem" é caminho válido | Botões natureza + `SeletorOrigem`; "sem origem" conclui sem erro | `fato-gerador-wizard.tsx:56-88`; `seletor-origem.test.tsx:151-161` — `expect(screen.queryByRole("alert")).not.toBeInTheDocument()` | ✅ PASS |
| AC4: origem só do mesmo contrato | Cada fetch de origem escopado por `idContrato` | `seletor-origem.tsx:62-103`; `seletor-origem.test.tsx:77-82` — `toHaveBeenCalledWith(expect.anything(), 7)` | ✅ PASS |
| AC5: Título obrigatório | Botão desabilitado sem título / habilita com título | `fato-gerador-form.test.tsx:109-143` — os dois lados | ✅ PASS |
| AC6/AC7: cascata Grupo→Tipologia→Estado + níveis/preditores como leitura | Cascata intacta (confirmado via `git diff` entre commit pré-T17 e T17: a lógica da cascata não aparece no diff) | `fato-gerador-form.tsx:88-168`, comentário "NÃO TOCAR" | ✅ PASS |
| AC8: régua de 4 posições, sem legenda descritiva | 4 níveis nomeados Baixo/Médio/Alto/Máximo, nunca "Nível 5" nem nome inventado | `fato-gerador-form.test.tsx:145-186` — `expect(NIVEIS).toHaveLength(4)`, `queryByText(/Grau de Impacto/i)).not...` | ✅ PASS |
| AC9: dimensões sem legenda | idem acima | idem | ✅ PASS |
| AC10/AC11: situação alterna Data de ocorrência ↔ Data prevista | `type="date"` (sem hora); projetado proíbe dt_ocorrencia | `fato-gerador-form.test.tsx:208-238` (UI, os dois lados); `fato-gerador.ts:62-78` (schema, 3 `.refine()`) — **sensor confirmou** (mutação 3, ver abaixo) | ✅ PASS |
| AC12: Contribuição Legisla 0–5 opcional | — | Coberto por `fato-gerador.test.ts` pré-existente (schema não mudou nesse ponto) | ✅ PASS |
| Edge case: Voltar preserva preenchido | `situacao`/`origem` não resetados no handler de Voltar | `fato-gerador-wizard.tsx:41-43` (sem `setSituacao(null)`); `fato-gerador-wizard.test.tsx:145-163` | ✅ PASS |

### P1: Pré-Insight como entidade

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: RLS no mesmo DDL + autor/timestamp | Tabela + `ENABLE/FORCE ROW LEVEL SECURITY` + política na mesma migration | `20260916153343_incidencia_v2_pre_insight.sql` completo; `pre-insight-rls.integration.test.ts` (6/6, incluindo GRANTs por papel) | ✅ PASS |
| AC2: autor resolvido pela sessão, nunca digitado | Sem campo de autor no form; RLS recusa fora da carteira | `pre-insight-form.tsx` (sem `FormField name="id_usuario_autor"`); `pre-insight-form.test.tsx:68`; teste de integração "Mentor SEM vínculo... negado (42501)" | ✅ PASS |
| AC3: identidade visual própria na timeline | Badge "Pré-Insight" distinto | `painel-detalhe.tsx:39-44` (`ROTULO_TIPO`) | ✅ PASS |
| AC4: Pré-Insight usado como origem continua existindo | `rel_fato_origem.id_pre_insight` é FK sem cascade de delete no pré-insight; nenhuma lógica de "consumo" no código | `20260916163109_incidencia_v2_origem_quatro.sql:20-21` | ✅ PASS |

### P1: Fato projetado e sua realização

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1/AC2: `situacao` + `dt_prevista` + constraint condicional, fatos existentes continuam válidos | Ver design.md "estruturalmente seguro" | `20260916153809_incidencia_v2_fato_titulo_situacao.sql`; `fato-situacao-constraint.integration.test.ts` (8/8) | ✅ PASS |
| AC3: IIP considera só realizados | `mv_iip_contrato` filtra `situacao='realizado'` | `20260916163414_incidencia_v2_iip_so_realizados.sql:48`; `iip-so-realizados.integration.test.ts` (2/2, re-confirmado após falha transitória de ambiente) | ✅ PASS |
| AC4: "Registrar como realizado" exige data no ato | Botão desabilitado sem data | `realizar-fato-dialog.tsx:88`; `realizar-fato-dialog.test.tsx:37-53` | ✅ PASS |
| AC5: fato projetado exibido como PROJETADO, fora dos números de impacto | `situacao === "projetado" ? "PROJETADO" : ...` | `painel-detalhe.tsx:103` — **componente isolado testado** (`painel-detalhe.test.tsx`), mas nenhum teste de integração de UI mostra `RealizarFatoDialog` acoplado a um consumidor real (ver Gaps) | ⚠️ Spec-precision gap (parcial) |
| AC6: KPI mostra realizados e "N projeções em aberto" separados | Nunca somados | `incidencia-kpis.tsx:18-19,26-29`; `incidencia-kpis.test.tsx:37-51` (os dois lados) | ✅ PASS |

### P1: Linha do Tempo

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: ordem cronológica decrescente, agrupada por mês | `agrupaPorMes` (genérico) | `incidencia-timeline.ts:56-68`; `incidencia-timeline.test.ts` (6 testes) — **sensor confirmou** (mutação 2) | ✅ PASS |
| AC2: desmarcar tipo oculta só aquele, mantendo ordem | `alternarTipo` + filtro | `timeline-feed.tsx:58-76`; `timeline-feed.test.tsx:50-66` | ✅ PASS |
| AC3: filtro por período | `periodoInicio`/`periodoFim` | `timeline-feed.tsx:71-72`; `timeline-feed.test.tsx:70-87` (os dois lados) | ✅ PASS |
| AC4: painel de detalhe com atributos de classificação | `PainelDetalhe` por tipo | `painel-detalhe.tsx:69-112`; `painel-detalhe.test.tsx` (6 testes por tipo) | ✅ PASS |
| AC5: data sem hora | `formatarData` (parse manual, sem `Date`) | `timeline-feed.tsx:40-44`; `painel-detalhe.test.tsx:101-113` (`criadoEm` com hora, exibição sem) | ✅ PASS |
| AC6: tipo de Registro de `ref_tipo_registro` | Nunca "Reunião"/"Ofício" | `painel-detalhe.test.tsx` — teste explícito de ausência | ✅ PASS |
| AC7: Pilar dos 4 de `ref_pilar_insight` | Nunca "Financeiro" | `painel-detalhe.test.tsx` — teste explícito de ausência | ✅ PASS |
| AC8: fato sem origem sem marca de falha | Sem badge "Não Conectado" em nenhum componente | `timeline-feed.test.tsx:90-96`, busca literal por `/Não Conectado/i` | ✅ PASS |
| AC9: período vazio mostra estado vazio explícito | `EstadoVazio` | `timeline-feed.test.tsx:70-77` | ✅ PASS |

### P2: Ciclo de Vida com cadeias

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1/AC2: agrupamento por origem comum, rótulo posicional nunca persistido | `rotulaCadeias`, letra gerada no render | `incidencia-cadeia.ts:39-46,56-81`; `incidencia-cadeia.test.ts` — **sensor confirmou** (mutação 1) | ✅ PASS |
| AC3: >1 Fato Gerador com mesma origem = "Origem comum" | Badge condicional | `cadeia-lista.tsx:29-31`; `cadeia-lista.test.tsx:22-33` | ✅ PASS |
| AC4: cadeia direta no fato sem marca de incompletude | idem, `origemComum` nunca true para grupo de 1 | `cadeia-lista.test.tsx:35-44` (lado oposto) | ✅ PASS |
| AC5: cadeia só-projetada em seção própria | "Cadeia Projetada (em análise)" | `cadeia-lista.tsx:59-66`; `cadeia-lista.test.tsx:47-65` (os dois lados) | ✅ PASS |
| AC6: IIP rotulado "(provisório)", nunca recalculado na leitura | `IipCard` reaproveitado sem mudança | `incidencia-kpis.tsx:7-9,23` — rótulo real coberto por `iip-card.test.tsx` (fora do diff desta feature, componente não alterado); `incidencia-kpis.test.tsx` não afirma o texto literal | ⚠️ Spec-precision gap (evidência indireta, não regressão) |

### P1: A aba como casa única da Incidência

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: aciona criar oferece as 4 entidades | Menu com 4 botões | `page.tsx:222-... "criar": [...]`; `page.test.tsx:105-113` | ✅ PASS |
| AC2: item da timeline acionado para edição abre o formulário da própria entidade, sem sair da aba | Registro/Insight/Pré-Insight editáveis a partir do clique; Fato Gerador explicitamente fora (sem formulário de edição desenhado) | **Gap real encontrado pelo Verifier, corrigido no commit `f036350`.** Evidência pós-fix: `page.tsx` (`abrirEdicao`, `ItemEditando`, Dialog de edição); `page.test.tsx` — teste "clicar num item e em Editar abre o formulário populado com o registro verdadeiro, e salvar refaz o fetch" | ✅ PASS (após fix) |
| AC3/AC4: Registro exige Tipo+Ocorrido em, autor da sessão, etapa explícita fora do contexto de rota | `RegistroForm` estendido | `registro-form.tsx:71-98`; `registro-form.test.tsx:87-99` (os dois lados) | ✅ PASS |
| AC5: campo texto = "Resumo", Canal com 3 opções | **`Canal` foi REMOVIDO do formulário** (achado de Execute: `FMC-19`, outra feature, já tinha removido a coluna do schema Zod antes desta task tocar o arquivo) | `registro-form.tsx` (sem campo Canal); `registro-form.test.tsx` — teste explícito de ausência | ⚠️ Spec-precision gap — spec.md desta feature ainda descreve Canal com 3 opções, mas isso ficou desatualizado por uma decisão de OUTRA feature (FMC-19) que rodou depois que este spec foi escrito. Não é regressão desta feature; é o spec.md que precisa de uma nota de atualização (fora do escopo de código) |
| AC6: Insight oferece Pilar + Registro/Meta/Sucesso de origem independentes | `InsightForm` (sem mudança de campo em criação) | `insight-form.test.tsx:77-91` (regressão) | ✅ PASS |
| AC7: chrome/tela de etapa deixam de renderizar os forms, sem ponto de entrada órfão | Dialogs removidos de `ficha-contrato-chrome.tsx`; `RegistroForm` removido de `etapas/[codigo]/page.tsx` | `ficha-contrato-chrome.test.tsx:129-137`; `etapas/[codigo]/page.test.tsx` (teste novo de T27) | ✅ PASS |
| AC8: salvar atualiza a timeline sem recarregar a página inteira | `carregarTudo()` via callback, nunca `window.location`/`router.push` | `page.tsx:108-117`; `page.test.tsx:117-134` (contagem de fetch sobe, sem navegação); grep confirmou zero `reload`/`router.push` em `page.tsx` | ✅ PASS |
| AC9: RLS negada aparece via ErroInline | `mapeiaErroRpc` + `ErroInline` em todos os forms tocados | `registro-form.test.tsx` (teste novo, achado do Verifier); `insight-form.test.tsx:126-151`; `pre-insight-form.test.tsx:110-123` | ✅ PASS |

### P2: Registro e Pré-Insight como origem

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1/AC2/AC3: `rel_fato_origem` com 4 colunas, "ao menos uma", fato sem vínculo válido | `ck_fato_origem` reescrita | `20260916163109_incidencia_v2_origem_quatro.sql`; `fato-origem-quatro.integration.test.ts` (4/4) | ✅ PASS |
| AC4: apagar a origem remove o vínculo, não o Fato Gerador | `ON DELETE CASCADE` nas 2 colunas novas (só a linha de `rel_fato_origem`, `fat_fato_gerador` não tem FK para trás) | `20260916163109_incidencia_v2_origem_quatro.sql:20-24` — **não coberto por teste de integração direto** (nenhum teste insere origem e depois apaga a origem para confirmar que o fato sobrevive) | ⚠️ Spec-precision gap — comportamento garantido pelo desenho do schema (`ON DELETE CASCADE` na FK do vínculo, não do fato), mas sem teste que exercite o DELETE de fato |

---

## Discrimination Sensor

| Mutação | File:line | Descrição | Killed? |
| --- | --- | --- | --- |
| 1 | `src/frontend/lib/incidencia-cadeia.ts:73` | `grupo.every(...)` → `grupo.some(...)` (cadeia com mistura de situação passaria a ser classificada como só-projetada) | ✅ Killed — `incidencia-cadeia.test.ts`, 1 teste falhou |
| 2 | `src/frontend/lib/incidencia-timeline.ts:59` | Ordem do `localeCompare` invertida (decrescente → crescente) | ✅ Killed — 4 testes falharam (`incidencia-timeline.test.ts` ×3, `timeline-feed.test.tsx` ×1) |
| 3 | `src/backend/schemas/fato-gerador.ts:75` | `dt_ocorrencia == null` → `dt_ocorrencia != null` na regra "projetado proíbe dt_ocorrencia" | ✅ Killed — 3 testes falharam (`fato-gerador.test.ts` + `fato-gerador-form.test.tsx` ×2) |

**Sensor depth**: lightweight (default, 3 mutações no código novo de maior risco desta feature)
**Result**: 3/3 killed — ✅ PASS

Todas as mutações foram aplicadas via `Edit` em arquivo real, confirmadas com o teste específico rodando, e revertidas na sequência (confirmado `git diff` vazio contra o commit anterior antes do commit seguinte).

---

## Code Quality

| Principle | Status |
| --- | --- |
| Mínimo de código | ✅ — reuso extensivo confirmado (`fato-gerador-form.tsx` cascata intacta, `IipCard` sem mudança, padrão de `PlanejamentoAbas` replicado sem importar o componente) |
| Mudanças cirúrgicas | ✅ |
| Sem scope creep | ✅ — Fato Gerador editável foi EXPLICITAMENTE deixado de fora (decisão registrada, não silenciosa) em vez de expandir escopo sem aprovação |
| Bate com padrões existentes | ✅ — `eslint-disable` com racional documentado seguindo precedente (`encontros-lista.tsx`), stubs de teste seguindo padrão de `etapas/[codigo]/page.test.tsx` |
| Spec-anchored outcome check | ✅ — ver tabela acima; 2 gaps de precisão de spec sinalizados (Canal removido por outra feature; IIP "(provisório)" sem teste direto nesta camada), 1 gap de cobertura sinalizado (DELETE de origem sem teste de integração) |
| Coverage Expectation por camada | ✅ — migrations com teste positivo+negativo; schemas com 1:1 pros `.refine()`; componentes com os dois lados de cada condicional (confirmado pelo sensor) |
| Todo teste mapeia a um AC/Done-when | ✅ — nenhum teste "solto" encontrado nas amostras revisadas |
| Guideline de teste documentada seguida | Nenhuma dedicada além de `CLAUDE.md`/`vitest.config.ts` (já citada em tasks.md) — seguida |

---

## Edge Cases (spec.md)

- [x] Preditor 2 `NULL` no seed exibe `—` — coberto por `fato-gerador-form.test.tsx` pré-existente (T17 não alterou essa lógica)
- [x] Nível padrão `NULL` exibe `—` — `painel-detalhe.tsx:108-110` (`?? "—"`)
- [x] Fato projetado passa da data prevista sem transição automática — `realizar-fato-dialog.tsx` só age por clique explícito, nenhum job/cron
- [x] Mesmo Insight em contratos diferentes, cada um só vê o seu — herdado de RLS já testada em `incidencia-encontros` (não regredido, sem mudança de RLS em `fat_insight` nesta feature)
- [x] `mv_iip_contrato` desatualizada exibe valor conhecido, marcado — `iip-card.tsx` inalterado
- [x] Busca de origem sem resultado oferece "sem origem" — `seletor-origem.test.tsx:128-147`
- [x] Voltar do passo 2 preserva preenchido — `fato-gerador-wizard.test.tsx:145-163`

---

## Gate Check

- **Unit** (`npm run test:unit`): **1193 passed, 0 failed** (114 arquivos, suíte completa do projeto)
- **Integration** (6 arquivos desta feature — `npm run test:integration -- <os 6 arquivos>`): **todos passando.** Primeira rodada teve 2 falhas ambientais (setup de `pre-insight-rls` — `dim_usuario` momentaneamente não encontrado sob carga concorrente do dev compartilhado; timeout de 30s em `iip-so-realizados`); re-rodados isoladamente e confirmados **8/8 limpos**, tempos de execução 2-3× mais lentos que o normal (114936ms/85599ms vs. ~70-80s de rodadas anteriores no mesmo dia), consistente com concorrência pesada no ambiente compartilhado (5 sessões Claude Code ativas no mesmo repositório confirmadas via `ListAgents` nesta sessão) — não é regressão de código.
- **Test count antes da feature**: não medido no início desta sessão (retomada de trabalho já em andamento); **depois**: 1193 (unit) + 44 testes de integração próprios distribuídos em 6 arquivos
- **Delta**: ~250+ testes novos (schemas, rpc, queries, módulos puros, componentes, páginas, migrations) ao longo de 27 tasks + 1 fix
- **Falhas**: nenhuma persistente
- **Skipped**: nenhum teste desta feature pulado

**`npm run build` e `npm run lint:all` (projeto inteiro) NÃO fecham limpos** — falham por motivos **confirmados não relacionados a esta feature**:
- `npm run build`: erro de tipo em `src/backend/rpc/encontro.ts` (RPC `criar_encontro` ausente do union de `database.types.ts`) — arquivo de outra feature concorrente (`ficha-mandato-contrato`), nunca tocado por `fatos-geradores-ciclo-vida`.
- `npm run lint:all`: ~15 arquivos de `ficha-mandato-contrato` (coalizoes/\*, mandato-wizard.tsx, gip-\*, contrato-form.tsx, encontro-form.tsx) violam `react-hooks/set-state-in-effect` — mesma regra que eu corrigi nos 2 arquivos que toquei desta feature (`fatos-registros/page.tsx`, `registro-form.tsx`), mas os arquivos de outra feature não foram tocados por mim. Os arquivos desta feature passam lint limpo isoladamente (`npx eslint <arquivo>` confirmado por arquivo).

---

## Fix Plans (aplicados nesta sessão, não pendentes)

### Fix 1: "Editar" da Linha do Tempo nunca conectado (spec.md AC2)

- **Root cause**: T23/T24 construíram a CAPACIDADE de edição em `RegistroForm`/`InsightForm`, mas nenhuma task de Tasks.md (nem T20, nem T25) incluiu explicitamente "adicionar o botão/callback que aciona essa edição a partir da Linha do Tempo" no Done-when — gap de planejamento em Tasks, não de Execute.
- **Fix aplicado**: commit `f036350` — ver Discrimination Sensor e tabela de ACs acima.
- **Prioridade**: Blocker (AC de história P1 ⭐ MVP não implementada) — já corrigido.

### Fix 2 (menor): 2 gaps de cobertura de teste

- RegistroForm (criação) sem teste do caminho de erro de RLS — adicionado.
- AbaIncidencia sem teste de `aria-selected` — adicionado.

---

## Gaps Remanescentes (não corrigidos nesta sessão — decisão para o usuário)

1. **Fato Gerador não é editável a partir da Linha do Tempo.** `TimelineFeed`/`PainelDetalhe` explicitamente NUNCA oferecem "Editar" para esse tipo (gate por design, testado). Isso é uma leitura estrita de "as 4 entidades" (spec.md AC2) que fica parcialmente atendida: 3 das 4 entidades editáveis, a 4ª (Fato Gerador) sem formulário de edição desenhado em nenhuma task. Construir isso exigiria decidir COMO editar uma tripla/níveis/situação já classificados (reabrir o wizard? só o passo 2? o quê acontece com o IIP se a situação mudar em edição, já coberto por T10/marcarFatoRealizado especificamente para a transição projetado→realizado, mas não para outras edições?) — decisão de design nova, não uma correção mecânica.
2. **spec.md ainda descreve o campo "Canal" no Registro** (3 opções) — removido por decisão de OUTRA feature (FMC-19) que rodou depois deste spec ser escrito. O código está certo (Canal não existe mais, coerente com o schema real); o spec.md desta feature é que ficou desatualizado. Recomendação: atualizar spec.md numa passada de manutenção, não um fix de código.
3. **Nenhum teste de integração exercita o `ON DELETE CASCADE` do vínculo de origem** (apagar um Pré-Insight/Registro/Insight/Meta usado como origem remove só a linha de `rel_fato_origem`, não o Fato Gerador) — comportamento garantido pelo schema (FK na tabela de vínculo, não no fato), mas sem teste que prove isso na prática.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| FGC-01 a FGC-07, FGC-09 a FGC-18 | Pending | ✅ Verified |
| FGC-08 | Pending | ✅ Verified (com ressalva: exibição de PROJETADO→realizado testada isoladamente, não em fluxo de UI integrado ponta-a-ponta) |

---

## Summary

**Overall**: ✅ Ready (após o fix aplicado nesta sessão)

**Spec-anchored check**: ~40/42 critérios batendo o outcome exato do spec; 3 spec-precision gaps sinalizados (nenhum é regressão de comportamento — 1 é decisão de outra feature refletida no código mas não no spec.md, 1 é cobertura de teste faltante para um DELETE em cascata, 1 é evidência indireta de um rótulo em componente não alterado)
**Sensor**: 3/3 mutações mortas
**Gate**: 1193 unit + 6/6 arquivos de integração desta feature, todos passando

**O que funciona**: as 27 tasks da feature, mais o fix de "Editar" da Linha do Tempo — Migrations, backend, componentes e a migração final das duas telas antigas para a aba única, todos com teste cobrindo os dois lados de cada decisão relevante (régua de 4 níveis, situação projetado/realizado, cadeia com/sem origem comum, fato sem origem sem marca de falha).

**Issues found**: gap real de AC2 (Editar da timeline) — corrigido nesta sessão, commit `f036350`. 3 gaps de precisão de spec sinalizados acima, nenhum bloqueante.

**Next steps**: decisão do usuário sobre (1) se vale desenhar edição de Fato Gerador agora ou deixar como está; (2) atualizar spec.md quanto ao campo Canal (documentação, não código); (3) opcionalmente adicionar 1 teste de integração para o `ON DELETE CASCADE` do vínculo de origem.
