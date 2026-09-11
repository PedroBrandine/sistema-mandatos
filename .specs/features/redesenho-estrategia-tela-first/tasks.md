# Redesenho tela-first do produto Estratégia — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implemente estas tasks com a skill `tlc-spec-driven`: **ative-a pelo nome e siga o fluxo de
Execute e as Critical Rules dela.** Não procure os arquivos da skill por caminho de sistema de
arquivos. A skill é a fonte de verdade do fluxo completo (ciclo por task, delegação a
sub-agentes, Verifier, sensor de discriminação).

**Se a skill não puder ser ativada, PARE e avise o usuário — não prossiga sem ela.**

---

**Design**: `.specs/features/redesenho-estrategia-tela-first/design.md`
**Status**: In Progress — Fases 0-5 (F0-F5, incluindo T18b e T21b) entregues e confirmadas na
tela por Pedro. **Fase 6 (Novo Contrato, T22-T24) em execução** — primeira tela de escrita desta
feature, profundidade de teste completa (AD-042, sem o corte de AD-046). Fases 7-8 (T25-T33)
seguem aguardando nova aprovação.

---

## Registro de execução

### Batch 1 — Fases 0 e 1 — ✅ COMPLETO (2026-09-10)

| Task | Commit | Gate | Resultado |
| :-- | :-- | :-- | :-- |
| T1 harness de componente | `53db28f` | build | unit 483/483 · lint 0 · build 0 |
| T2 `ref_limiar_pendencia` | `efbbd0c` | *reduzido* | unit 483/483 + integração própria 13/13 |
| T3 `vw_pendencias` lê limiares | `c089bdf` | full | ver desvio 2 |
| T4 renome Diagnóstico | `0d53fe7` | *reduzido* | unit 483/483 + integração própria 8/8 |
| T4b limiar percentual (AD-045) | `25b5cee` | full | **64 arquivos / 440 testes / 0 falhas** |

**Migrations aplicadas em dev** (`npnvoolkebhabjkjzqwn`): `20260910145926_estrategia_ref_limiar_pendencia` ·
`20260910152107_estrategia_vw_pendencias_limiar` · `20260910152709_estrategia_renomeia_raio_x_diagnostico` ·
`20260910201447_estrategia_limiar_etapa_percentual`.

**Desvios registrados:**

1. **Gate reduzido em T2 e T4.** `tasks.md` declarava `full` para as duas. A suíte de integração roda
   em série (`fileParallelism: false`) e leva ~20 min, acima do teto de 10 min de uma chamada em
   foreground — três execuções custariam ~60 min de espera. Autorizado concentrar o gate completo
   onde está o risco: T3 (refatora view consumida em 6 pontos) e T4b. T2 cria tabela que ninguém
   consome ainda; T4 é renome de seed com asserção de contagem dependente inalterada.

2. **T3 commitada com a suíte completa vermelha.** Execução pós-T3: 429 testes, 10 falhas.
   Classificadas por causa, nenhuma atribuível à T3 — 5 eram o teste da própria T4 falhando por a
   migration não estar aplicada (comportamento correto: prova que o teste não é tautológico), 2
   eram `Test timed out in 30000ms`, 3 eram `Internal server error` do PostgREST mais 2 cascatas.

3. **Evidência dos isolados.** Antes do commit da T3, `formularios-gip` e `fn-marcar-vigente`
   rodados isoladamente, sem nenhuma mudança de código: **9/9, 2 arquivos, 0 falhas**. A suíte
   final confirmou de novo, ainda sem mudança de código — contenção da Management API após ~40 min
   contra o projeto cloud compartilhado, modo de falha já documentado em `supabase/tests/helpers/sql.ts`.

4. **`ref-limiar-pendencia.integration.test.ts` alterado fora da lista de arquivos da T4b.** A AD-045
   superou a forma que ele asseria. A mudança **fortalece**: `dias NOT NULL` garantia só que aquela
   coluna estivesse preenchida e aceitava as duas ao mesmo tempo; `ck_limiar_base CHECK
   (num_nonnulls(dias, pct_duracao_etapa) = 1)` recusa tanto a linha sem base quanto a com duas.
   Asserido pelos dois lados em `limiar-etapa-percentual.integration.test.ts`. Diff conferido pelo
   orquestrador. Nenhuma asserção enfraquecida, apagada ou pulada em nenhuma task.

5. **Lacuna de precisão do spec, fechada no caminho.** A T2 encontrou a progressão
   `Normal → Atenção → Atrasado` sem valores definidos; semeou 30/45 como default e asseriu só a
   invariante de ordenação, sem inventar precisão. AD-045 fechou depois com 70%/100%.

**Achados para as fases seguintes:**
- O harness da T1 teve a discriminação comprovada na prática: removido o `<p>{titulo}</p>` de
  `estado-vazio.tsx`, 2 dos 5 testes falharam; restaurado, voltaram a passar. `.test.ts` seguem em
  `node` (probe confirmou `document` indefinido).
- Bug real de fixture corrigido na T2: `INSERT` e `DELETE` em CTEs do mesmo statement enxergam o
  mesmo snapshot, então a linha de teste vazava para a asserção de contagem. Vale para quem
  escrever fixtures de integração nas fases seguintes.

### Batch 2 — Fase 2 — ✅ COMPLETO (2026-09-11)

| Task | Commit | Gate | Resultado |
| :-- | :-- | :-- | :-- |
| T5 `fat_prospeccao` estrutura (AD-040) | `7417c34` | full | ver desvio 1 |
| T6 RLS + grants (AD-001) | `5de9ad6` | full | isolados 100% verdes |
| T7 RPC `converter_prospeccao` (AD-024) | `f400b44` | full | ver desvio 2 |
| — `db:types` regenerado | `acc932d` | — | manual type-check limpo |
| T8 `queries/prospeccao.ts` | `f427f06` | quick | unit 496/496 |
| T9 `rpc/prospeccao.ts` wrapper TS | `3cc2676` | quick | unit 496/496 |
| Fim de batch: suíte completa | — | build | **67/67 arquivos · 477/477 testes · 0 falhas** · lint 0 · build 0 |

**Migrations aplicadas em dev**: `20260911023609_estrategia_fat_prospeccao_estrutura` ·
`20260911024602_estrategia_fat_prospeccao_rls` · `20260911025405_estrategia_fn_converter_prospeccao`.

**Desvios registrados:**

1. **Limpeza de resíduo órfão em duas rodadas, nenhuma decisão às cegas.** Duas execuções
   anteriores (uma sob disco cheio, `ENOSPC`) deixaram fixtures órfãs — `ref_etapa`/`ref_formulario`/
   `ref_preditor`, `ref_peso_etapa`, `fat_insight`/`fat_fato_gerador`, `convite_contrato`,
   `dim_usuario` de teste, e o contrato `id_contrato=1668` inteiro. Cada limpeza foi escrita como
   `.sql` em `BEGIN`/`COMMIT` só depois de mapear **todas** as FKs apontando para as tabelas-alvo via
   `pg_constraint` (a primeira tentativa quebrou 2x por dependência não mapeada) e executada por
   Pedro — o classificador do Claude Code bloqueia `DELETE` direto via `supabase db query`. Verificada
   por `SELECT` de leitura depois de cada rodada. `t19-seed-*` preservados em ambas.

2. **Três incidentes de falha transitória na suíte de integração, mesma noite, mesmo projeto dev.**
   v1 e v2: 10 e depois novamente falhas cascateando de `planejamento-preditores` (afterAll travado
   no resíduo do item 1). v3, já com a limpeza aplicada: 472/477 — os 5 restantes eram
   `Test timed out in 30000ms` em `seed-test`, `fat-prospeccao-estrutura` e `vw-pendencias-limiar`,
   arquivos com testes irmãos passando em 17-30s cada; isolados a 30s, os 3 passaram limpos (17/17,
   9/9, contagem de seed OK). A suíte final de fechamento de batch (item abaixo) confirmou: **0
   falhas de qualquer tipo**, o que descarta regressão de lógica e fecha a hipótese de latência da
   Management API sob 3 execuções completas consecutivas de ~20 min contra o mesmo projeto cloud.

3. **Cruzamento de mensagens no fechamento do batch, não desobediência.** O worker recebeu, em
   ordem: (a) instrução com 4 passos, o último sendo "fim do batch: suíte completa"; (b) executou
   os passos 1-3 (gate da T7 isolado a 30s, commit de T7/T8/T9); (c) iniciou o passo 4 — a suíte
   final; (d) só depois chegou uma instrução do orquestrador pedindo isolamento a 60s e proibindo
   uma 4ª rodada completa, escrita sobre o resultado da v3 sem saber que o passo 4 (autorizado)
   já estava em andamento. O worker corretamente **não interrompeu** a execução em curso (matar o
   processo teria criado nova fixture órfã, como nos itens 1-2) e reportou a sequência completa
   quando questionado. Nenhum comando foi executado fora da autorização recebida no momento em que
   foi disparado; a lição é de coordenação do orquestrador (instruções cruzando em voo), não do
   worker.

**Achados para as fases seguintes:**
- O padrão de limpeza fixado nos itens 1-2 — mapear FKs via `pg_constraint` antes de escrever
  qualquer `DELETE`, escrever em arquivo para Pedro rodar, verificar com `SELECT` depois — repete o
  precedente já existente em `20260812163617_kanban_etapas_correcao_ref_etapa.sql` e deve ser o
  padrão para qualquer limpeza futura nesta feature.
- `fat_prospeccao` confirmado como a única tabela operacional sem `id_contrato` (exceção deliberada
  ao invariante do modelo, coberta pelo índice parcial `uq_prospeccao_aberta_contratante`); RLS
  por linha (não GRANT-only) validada com sessões JWT reais por papel, não só
  `has_table_privilege`.

---

### Batch 3 — Fase 3 — ✅ COMPLETO (2026-09-11)

| Task | Commit | Gate | Resultado |
| :-- | :-- | :-- | :-- |
| T10 Topbar sem "Gestão de Usuários" | `8a690b2` | quick | unit 498/498 |
| T11 `queries/hub.ts` | `e897242` | quick | unit 506/506 |
| T12 Hub com 6 cards e contadores | `1874b30` | quick | unit 510/510 |
| T13 Aba Contratos vira Mandatos | `29a4814` | quick | unit 513/513 |
| Fim de fase: gate de build | — | build | lint raiz 0 · lint:frontend 30 problemas pré-existentes fora do escopo tocado (ver "Regra de lint desta feature") · unit **51/51 arquivos, 513/513 testes** · build 0 erros |

**Migrations**: nenhuma — Fase 3 é só frontend + 1 módulo de leitura (T11), como previsto no tasks.md.

**Desvios registrados:**

1. **`vitest.config.ts` ganhou `resolve.alias` (T10).** O smoke test de T1 (AD-042)
   só exercitava `estado-vazio.tsx`, que não importa nada por alias — o gap ficou
   invisível até o 1º teste de componente real do produto (`topbar.tsx`, que importa
   `@/lib/utils`) falhar na collect com "Failed to resolve import". Corrigido
   adicionando `resolve.alias` para `@` e `@backend` replicando verbatim os `paths`
   de `src/frontend/tsconfig.json`. Necessário para T10, T12 e T13 (todos importam
   componentes com alias); sem isso nenhum teste de componente além do smoke test
   original rodaria. Nenhuma AD nova — é extensão direta do escopo de AD-044
   ("dependências do harness vivem na raiz"), mesmo arquivo, mesma regra.

2. **Risco aceito documentado no código, não só no commit: card "Gestão de
   Usuários" do Hub (T11/T12, EST-02 AC7).** O padrão "consulta negada por
   permissão (42501) → card omitido" que rege Visão Gerencial/Números de Impacto
   (AD-036: `mv_avaliacao_nps`/`mv_numeros_impacto` nunca concedidas a
   `legisla_mentor`/`legisla_assessor`) **não se aplica** a `dim_usuario`: a
   política `p_usuario` (`app.papel_atual() IN ('admin','gestora')`) dá SELECT
   completo tanto a Admin quanto a Gestora — não existe hoje nenhuma consulta cujo
   42501 distinga as duas roles para este recurso. `queries/hub.ts` (`ehAdmin`)
   resolve o card lendo `dim_usuario.papel_global` da própria usuária autenticada
   (dado do banco, resolvido pela sessão — não um papel hardcoded/prop), mas isso
   é *UI hiding*, não enforcement de RLS: uma Gestora que ignorasse a UI e navegasse
   direto para `/usuarios` não seria barrada pelo banco hoje (mesma lacuna que já
   existia antes desta feature — `usuarios/page.tsx:35` já tinha o comentário
   "Default permissivo para interface"). Enforcement real (uma RLS/GRANT que
   realmente distinga Admin de Gestora para este recurso) fica pendente de uma
   migration futura — fora do escopo de T10-T13, que são todas `quick`/sem
   migration. Recomendação registrada, não decretada: uma feature futura que mexa
   em `dim_usuario`/`/usuarios` deveria fechar essa lacuna com uma AD nova.

3. **Where de T12 interpretado como "só `hub-card.test.tsx`" — nenhum
   `page.test.tsx` criado.** O Done-when de T12 inclui "Renderiza um card por item
   retornado, na ordem recebida (AC1, AC6)", que tecnicamente é comportamento de
   `app/(app)/page.tsx` (o `cards.map(...)`), não de `hub-card.tsx` (que renderiza
   1 card). A task só lista `hub-card.test.tsx` em "Where". Tratado como glue
   trivial já coberto por composição: a ordenação do array vem testada em
   `hub.test.ts` (T11) e a renderização de 1 card vem testada em
   `hub-card.test.tsx` (T12) — nenhum teste novo foi adicionado além do escopo
   declarado.

4. **T13 AC4 ("slug inválido retorna 404") não ganhou teste novo.**
   `ProdutoShell` recebe `slug: ProdutoSlug` já estreitado pelo tipo — não existe
   caminho de código dentro do componente para um slug inválido. A fronteira de
   validação real é `produtos/[slug]/layout.tsx` (chama `notFound()`), arquivo que
   T13 não toca e cujo comportamento é anterior a esta feature. Documentado no
   próprio `produto-shell.test.tsx`, não é lacuna silenciosa.

**Achados para as fases seguintes:**
- O gap do desvio 1 (aliases não resolvidos no Vitest) só apareceu porque T10 foi
  o primeiro componente real do produto a ser testado — toda task de componente
  em fases futuras (T16, T18, T20, T21, T22-T24, T26, T28, T30, T33) já herda a
  correção, sem trabalho extra.
- O padrão de mock de `next/navigation` (`usePathname`) e de hooks de dados
  (`vi.mock` de `@/hooks/use-produto-atual`) usado em `produto-shell.test.tsx`
  é reutilizável por qualquer componente futuro que precise de `RouteTabs` ou de
  `useProdutoAtual` sem subir um `QueryClientProvider` real.
- O desvio 2 (Gestão de Usuários) é o único ponto desta fase onde "restrição mora
  na RLS" (AD-001) não foi literalmente alcançado — vale revisar se alguma fase
  futura desta feature (ou uma feature própria de `dim_usuario`) deve fechar essa
  lacuna com uma migration dedicada.

---

### Batch 4 — Fase 4 — ✅ COMPLETO (2026-09-11)

| Task | Commit | Gate | Resultado |
| :-- | :-- | :-- | :-- |
| T14 `classificarLimiar` | `784a5c0` | quick | unit 522/522 |
| T15 `queries/quadro.ts` | `2ae4843` | quick | unit 531/531 |
| T16 `QuadroAcompanhamento` | `45a3559` | quick | unit 538/538 |
| T17 `queries/pendencias.ts` | `ddc9ad0` | quick | unit 544/544 |
| T18 `TabelaPendencias` | `ae4f67c` | quick | unit 547/547 |
| T18b Montagem da página do Dashboard | `c1150cb` | quick | unit 550/550 |
| Fim de fase: gate de build | — | build | lint raiz 0 · lint:frontend 30 problemas pré-existentes, nenhum nos arquivos desta fase (ver "Regra de lint desta feature") · unit **56/56 arquivos, 547/547 testes** · build 0 erros |

**Migrations**: nenhuma — as 5 tasks são todas `quick`, como previsto no tasks.md.

**Desvios registrados:**

1. **T14 ganhou o parâmetro `duracaoPrevistaDias`, ausente da assinatura de
   `classificarLimiar` em design.md.** design.md descreve
   `classificarLimiar(diasNaEtapa, limiares)`, escrito antes de AD-045 (limiar
   virou percentual da duração prevista da etapa, não dias absolutos). Sem a
   duração da etapa não há base para calcular percentual nenhum — a própria
   migration `20260910201447` já antecipa isso ("regra de apresentação e vive
   na função pura do frontend, T14"). Assinatura final:
   `classificarLimiar(diasNaEtapa, duracaoPrevistaDias, limiares)`. Testado dos
   dois lados de cada fronteira (69/70 para Atenção, 99/100 para Atrasado, com
   `duracaoPrevistaDias = 100` deixando dias == percentual) e com limiar/duração
   ausentes ou nulos devolvendo `normal`, nunca lançando (AD-005).

2. **T15 buscou cargo/partido e `duracao_prevista_dias`, além do que "Reuses"
   listava** (`buscarBoardKanban`, `ColunaKanban`, `CardKanban`,
   `buscarProspeccoesAbertas`). EST-07 AC2 exige o card com "contratante,
   cargo/partido e dias na etapa", e a classificação por limiar (T16) depende
   de `duracaoPrevistaDias` por etapa — nenhuma das duas informações está em
   `CardKanban`/`ColunaKanban` hoje, e T16 ("Where": só o arquivo do
   componente) não tem onde buscá-las. Resolvido dentro de `quadro.ts`, único
   ponto de composição entre a leitura e o componente: uma consulta extra a
   `ref_etapa` (duração) e uma a `fat_contrato`/`dim_mandato` (cargo/partido),
   restrita aos ids que já apareceram nas colunas — nunca varre o produto
   inteiro. Contratante sem `dim_mandato` (ex.: Coalizão) devolve
   `cargoAtual`/`partidoAtual` nulos, nunca lança.

3. **`QuadroAcompanhamento` (T16) é presentational + interativo via callback,
   não um container que busca dados.** design.md lista `moverEtapaKanban` em
   "Reuses" e cita `queries/limiar.ts` como dependência — mas nenhuma task do
   escopo aprovado (T14-T18) cria `queries/limiar.ts`, e a leitura real de
   `ref_limiar_pendencia` (limiares em produção) não tem onde acontecer dentro
   de T14-T18. O componente recebe `colunas` (já resolvidas por `buscarQuadro`,
   T15) e `limiares` como props, e devolve a intenção de mover um card via
   `onMoverCard` opcional — sem `useQuery`/`useMutation` embutidos. A
   orquestração real (buscar `ref_limiar_pendencia`, disparar `moverEtapaKanban`
   no `onMoverCard`) fica para a task que montar a página do Dashboard,
   explicitamente fora deste batch. Consequência: o card do Quadro não reusa
   `KanbanCard` verbatim (badge é por limiar, não por status; há linha de
   cargo/partido que `KanbanCard` não tem) — o que é reusado literalmente é o
   esqueleto de DnD de `KanbanBoard`/`KanbanColuna` (sensors, `useDraggable`,
   `useDroppable`). "Não arrastável" da raia de Prospecção (AD-040) foi testado
   por ausência de `useDraggable`/classe `cursor-grab` no card, não por
   simulação de gesto de drag (sem harness de drag no projeto).

4. **T17 não reusa `buscarPendencias` de `queries/visao-gerencial.ts`,
   apesar do "Reuses" apontar para esse consumo.** A função existente está
   atrás de `FiltroRecorte` e `resolverIdsContratoDoRecorte`, ambos privados
   àquele arquivo — fora do "Where" desta task (só `queries/pendencias.ts`).
   Reimplementado com a mesma regra de interseção AND (nunca união OR) entre
   gestora e projeto já estabelecida em `visao-gerencial.ts`, testada
   explicitamente com um cenário onde a união produziria um resultado diferente
   da interseção (Done-when da task). A função nunca filtra por categoria —
   repassa o que `vw_pendencias` devolver, para não hardcodar a enumeração
   (AD-004); o "5 categorias" do Done-when e de design.md diverge das 6
   categorias reais que a view emite desde a T3 (`sucesso_mensal_atrasado`
   incluída) — tratado como imprecisão herdada do texto da task/design.md, não
   corrigido silenciosamente: a função não impõe nenhum dos dois números.

5. **T18b não ganhou `dashboard/page.test.tsx`.** Mesmo raciocínio do desvio 3
   deste batch (T12): a orquestração da página é glue trivial sobre peças já
   testadas isoladamente -- `QuadroAcompanhamento` (7 testes, inclusive raia
   de Prospecção e badge por estado), `TabelaPendencias` (3 testes) e
   `moverEtapaKanban` (`rpc/kanban.test.ts`). Testar a página exigiria montar
   `QueryClientProvider` + mock de 3 queries + harness de DnD sem nenhum AC
   novo que essas peças não cubram -- nenhum dos Done-when de T18b introduz
   comportamento que não seja composição do que já está testado. `queries/
   limiar.ts` (única peça nova de lógica) ganhou `limiar.test.ts` (3 testes:
   leitura das 4 linhas com as duas bases mapeadas, `data: null` -> `[]`,
   erro propaga como throw). Layout conferido no Figma `44:5`: Quadro em
   cima, Pendências abaixo, largura total -- a fileira de KPIs e a barra de
   filtros de gestora/projeto que o mesmo frame mostra pertencem à Fase 8
   (T31-T33, ainda sem aprovação) e ao antigo filtro papel+pessoa+projeto do
   Kanban, fora do Done-when desta task; omitidos de propósito, não por
   esquecimento.

**Achados para as fases seguintes:**
- **`queries/limiar.ts` não existe.** design.md cita o arquivo como dependência
  de `QuadroAcompanhamento`, mas nenhuma task de T14-T18 o cria. A task que
  montar a página do Dashboard precisa: (a) criar essa leitura de
  `ref_limiar_pendencia` (filtrando `codigo IN ('etapa_atencao',
  'etapa_atrasado')` e `ativo`), (b) chamar `buscarQuadro` (T15) e
  `buscarPendenciasDashboard` (T17), e (c) wirear `onMoverCard` do
  `QuadroAcompanhamento` a `moverEtapaKanban` — nenhuma dessas três
  orquestrações foi feita neste batch, de propósito (fora do escopo aprovado).
- A página `produtos/[slug]/dashboard/page.tsx` já existe (da feature
  `kanban-etapas`) e hoje renderiza o `KanbanBoard` antigo — ela não foi tocada
  neste batch e continua funcionando como está até a fase que a substituir por
  `QuadroAcompanhamento` + `TabelaPendencias`.
- O padrão de mock de `useRouter` (`vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }) }))`) usado em `tabela-pendencias.test.tsx` é
  reutilizável por qualquer componente futuro com linha clicável fora de
  `<Link>` (mesmo padrão de `GargalosTabela`, que usa `usePathname`/`useRouter`
  da mesma família).
- A discrepância "5 vs. 6 categorias" (desvio 4) vale uma correção de texto em
  spec.md/design.md numa passada de revisão futura — não foi corrigida aqui
  para não editar spec/design fora do que a task pedia.

---

### Fase 5 — ✅ COMPLETO (2026-09-11)

| Task | Commit | Gate | Resultado |
| :-- | :-- | :-- | :-- |
| T19 `queries/mandatos-lista.ts` | `b63af58` | quick | unit 58/58 arquivos, 561/561 testes |
| T20 `ListaMandatos` | `c6da40d` | quick | unit 59/59 arquivos, 567/567 testes |
| T21 `FiltrosMandatos` | `256eeca` | quick | unit 60/60 arquivos, 570/570 testes |
| T21b Montagem da página de Mandatos | `c6f2f5d` | quick | unit 60/60 arquivos, 570/570 testes |
| Fim de fase: gate de build | — | build | lint raiz 0 · lint:frontend 30 problemas pré-existentes, nenhum nos arquivos desta fase (ver "Regra de lint desta feature") · unit **60/60 arquivos, 570/570 testes** · build 0 erros |

**Migrations**: nenhuma — as 4 tasks são todas `quick`, como previsto no tasks.md.

**Desvios registrados:**

1. **Nomes reconciliados entre design.md e tasks.md, mesmo tipo de ajuste de
   TIP-05/06/07 (commit `2e2ea36`).** design.md ("ListaMandatos", T6) descreve
   `buscarMandatos(client, filtros): Promise<ContratoCard[]>`; T21b ("Reuses")
   nomeia explicitamente `buscarMandatosLista`. Mantido `ContratoCard` (nome
   de design.md, mais descritivo do view-model) e `buscarMandatosLista` (nome
   de T21b, que é quem efetivamente a task pedia pra existir) — os dois nomes
   nunca colidiam, só precisavam ser escolhidos de forma consistente.

2. **"Responsável" (EST-09 AC1) mapeado para `papel_no_contrato = 'mentor'`
   com vínculo ativo.** Nenhum AC nem design.md nomeia a origem literal do
   campo — só o Figma `202:554` mostra "Responsável" como rótulo, num campo
   distinto de "Gestão" no mesmo card. `rel_usuario_contrato` (docs/
   schema_sistema.sql) tem 4 papéis (`gestora`, `mentor`, `assessor`,
   `leitura`); como "Gestão" já cobre `gestora`, `mentor` é a leitura mais
   próxima de "responsável do dia a dia pelo mandato" entre as opções
   restantes. Risco aceito: se a intenção do Figma fosse outro papel (ex.
   `assessor`), a correção é trocar uma string em
   `buscarPessoaAtivaPorPapel(client, ids, "mentor")` — mudança local, sem
   impacto de schema.

3. **Filtro "Data" (EST-09 AC3, 1 dos 5 filtros) implementado como intervalo
   sobre `fat_contrato.dt_inicio`** (`dtInicioDe`/`dtInicioAte` em
   `FiltroMandatosLista`), não sobre `dt_fim` nem sobre uma vigência
   sobreposta. O Figma mostra dois seletores de calendário lado a lado na
   mesma faixa "Período e gestão", sem rótulo de campo capturado pelo
   `get_metadata` (só a largura dos nós); nenhum AC/design.md define a
   semântica. `dt_inicio` foi escolhido por ser o campo mais natural pra "ver
   mandatos que começaram nesse período" e por já ter precedente de filtro de
   data em `dt_inicio` noutras queries do produto. Mudança de semântica, se
   necessária, é local a `buscarMandatosLista` e `FiltrosMandatos`.

4. **T21b não ganhou `page.test.tsx`**, mesmo raciocínio do desvio 5 da Fase 4
   (T18b): a página é glue trivial sobre peças já testadas isoladamente --
   `buscarMandatosLista` (11 testes, inclusive os 5 filtros isolados + AND),
   `ListaMandatos` (6 testes) e `FiltrosMandatos` (3 testes). Testar a página
   exigiria montar `QueryClientProvider` + mock de 4 queries sem nenhum AC
   novo que essas peças não cubram -- nenhum Done-when de T21b introduz
   comportamento que não seja composição do que já está testado.

5. **Bug de fuso horário evitado em `ListaMandatos` (T20), não corrigido
   depois.** A primeira versão de `formatarData` usava
   `new Date(data).toLocaleDateString("pt-BR")`; como `dt_inicio`/`dt_fim` são
   `DATE` puro (sem hora), `new Date("2026-01-10")` vira meia-noite UTC, e em
   fuso a oeste de UTC (ex. `America/Sao_Paulo`, o fuso deste ambiente de
   teste) `toLocaleDateString` mostra o dia anterior -- pego pelo teste de
   AC1 antes do commit, não em produção. Corrigido formatando a string
   `YYYY-MM-DD` direto (split + remontagem), sem passar por `Date`. Mesma
   classe de risco que L-001 (comparação de data) documenta para
   `Date`/fuso horário -- candidato a lição reusável se aparecer de novo
   noutro componente desta feature.

**Achados para as fases seguintes:**
- **`FiltrosMandatos` mantém o filtro em estado local da página (`useState`),
  não na URL.** Diferente de `BarraRecorte` (visão gerencial, que grava os 5
  filtros em `searchParams`), aqui o filtro se perde ao navegar pra fora da
  aba Mandatos e voltar. Decisão implícita de T21 ("Reuses: Select, Input",
  sem menção a `useSearchParams`) e consistente com o padrão presentational +
  callback já usado por `QuadroAcompanhamento` (Fase 4) -- mas vale registrar
  como trade-off caso uma fase futura queira link compartilhável com filtro
  aplicado.
- Os desvios 2 e 3 (mapeamento de "Responsável" e semântica do filtro "Data")
  são as duas maiores lacunas de precisão herdadas do Figma nesta fase --
  nenhuma tem um AC ou nota de design.md que as resolva sem ambiguidade. Boas
  candidatas a confirmar com Pedro antes de uma eventual Fase 8 (KPIs/filtros
  do Dashboard) que reuse o mesmo vocabulário.

---

## Test Coverage Matrix

> Gerada a partir do codebase, das guidelines do projeto e do spec — confirmar antes de Execute.
> Guidelines encontradas: `CLAUDE.md`, `vitest.config.ts`, `vitest.integration.config.ts`,
> `.github/workflows/ci.yml`, `docs/fluxo-de-trabalho.md`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| :-- | :-- | :-- | :-- | :-- |
| Migration / DDL / RLS / GRANT | integration | Toda tabela nova: estrutura, CHECKs, índice parcial, trigger de auditoria. Toda RLS/GRANT: uma asserção por role × operação | `supabase/tests/**/*.integration.test.ts` | `npm run test:integration` |
| View / RPC Postgres | integration | Todo caminho da view (as 6 categorias de `vw_pendencias`); RPC: caminho feliz + cada erro tipado + idempotência | `supabase/tests/**/*.integration.test.ts` | `npm run test:integration` |
| Seed / catálogo `ref_*` | integration | Valores esperados + contagem de linhas dependentes inalterada | `supabase/tests/**/*.integration.test.ts` | `npm run test:integration` |
| `src/backend/queries/**` | unit | Todas as ramificações; 1:1 com ACs do spec; todo edge case listado. Cliente Supabase mockado por nome de tabela (padrão de `queries/kanban.test.ts`) | `src/backend/queries/*.test.ts` | `npm run test:unit` |
| `src/backend/rpc/**` | unit | Parâmetros passados verbatim (L-004) + mapeamento de cada erro de constraint (L-003) | `src/backend/rpc/*.test.ts` | `npm run test:unit` |
| `src/backend/schemas/**` | unit | Aceite e recusa por campo, incluindo limites | `src/backend/schemas/*.test.ts` | `npm run test:unit` |
| Funções puras de frontend | unit | Todas as ramificações, incluindo os dois lados de comparação de data (L-001) | `src/frontend/**/*.test.ts` | `npm run test:unit` |
| **Componentes React — telas de escrita** (T22-T24, T28-T30) | **unit (AD-042)** | Todo elemento que uma AC nomeia é asserido; toda ramificação de render tem caso dos dois lados; estado vazio e estado de erro cobertos | `src/frontend/**/*.test.tsx` | `npm run test:unit` |
| **Componentes React — telas de leitura** (T10-T21, T25-T27, T31-T33) | **unit (reduzido — AD-046)** | **Só o caminho feliz de cada AC** — um teste por comportamento principal. Pares positivo/negativo de condicional (ex. "card some quando negado") **não exigidos**; lacuna vira nota de risco aceito no commit, não fica implícita | `src/frontend/**/*.test.tsx` | `npm run test:unit` |
| Config / tipos gerados | none | — (build gate) | — | build gate |

**Nota de provenance:** o piso de qualidade vem dos testes existentes (13 em `queries/`, 13 em
`rpc/`, 12 em `schemas/`, e o padrão "Spec anchor" no cabeçalho de cada um, que amarra o teste ao
ID de requisito). A linha de **Componentes React** não tem piso no repo — é o débito L-006/L-007
que AD-042 encerra, e é alvo, não reflexo do que existe.

## Gate Check Commands

> Extraídos de `package.json` e `.github/workflows/ci.yml` — confirmar antes de Execute.

| Gate Level | When to Use | Command |
| :-- | :-- | :-- |
| **quick** | Tasks só com teste unitário (queries, rpc, schemas, componentes) | `npm run test:unit` |
| **full** | Tasks com migration, view, RPC Postgres, RLS ou GRANT | `npm run test:unit && npm run test:integration` |
| **build** | Fim de fase, ou task de config | `npm run lint && npm run test:unit && npm run build` |

**Regra de lint desta feature:** `lint-frontend` é `continue-on-error: true` no CI, com o
comentário *"as telas de `src/frontend` ainda vão ser redesenhadas"* — que descreve exatamente
esta feature. Dos 30 problemas atuais, **~13 estão em arquivos que esta feature toca**
(`tse-match-search.tsx`, `mandato-wizard.tsx`, `contrato-form.tsx`, `contratante-fields.tsx`,
`mandato-card.tsx`, `encontro-form.tsx`, `encontros-lista.tsx`). **Todo arquivo criado ou
modificado por esta feature sai com `npm run lint:frontend` limpo.** Os problemas restantes
vivem em telas fora do escopo (`mandatos/`, `contratos/`, `coalizoes/`, `usuarios/`); remover o
`continue-on-error` global é decisão separada, depois que a UI estabilizar.

---

## Execution Plan

Fases são ordenadas e rodam em sequência; tasks dentro de uma fase rodam em ordem.

### Fase 0: Harness de teste de componente
```
T1
```

### Fase 1: Banco — limiares e renome da régua
```
T2 → T3 → T4 → T4b
```

### Fase 2: Banco — Prospecção pré-contrato
```
T5 → T6 → T7 → T8 → T9
```

### Fase 3: Shell — Topbar, Hub e aba Mandatos
```
T10 → T11 → T12 → T13
```

### Fase 4: Dashboard — Quadro de Acompanhamento e Pendências
```
T14 → T15 → T16 → T17 → T18 → T18b
```

### Fase 5: Mandatos — lista e filtros
```
T19 → T20 → T21 → T21b
```

### Fase 6: Novo Contrato — busca TSE e formulário
```
T22 → T23 → T24
```

### Fase 7: Agenda — calendário, registros e presença
```
T25 → T26 → T27 → T28 → T29 → T30
```

### Fase 8: KPIs do Dashboard
```
T31 → T32 → T33
```

---

## Task Breakdown

### T1: Harness de teste de componente

**What**: Instalar `@testing-library/react` (linha compatível com React 19), `@testing-library/jest-dom` e `jsdom`; incluir `**/*.test.tsx` em `vitest.config.ts` com ambiente `jsdom` via `environmentMatchGlobs` (API válida no Vitest 2.1.9); escrever um teste de componente de fumaça sobre um componente já existente.
**Where**: `package.json`, `vitest.config.ts`, `src/frontend/components/ui/estado-vazio.test.tsx`
**Depends on**: None
**Reuses**: `components/ui/estado-vazio.tsx` como alvo do smoke test
**Requirement**: EST-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `npm run test:unit` coleta e executa `.test.tsx` (EST-01 AC1)
- [ ] O smoke test renderiza via `@testing-library/react` em `jsdom` (EST-01 AC2)
- [ ] Remover o texto renderizado de `estado-vazio.tsx` faz o teste falhar (EST-01 AC3) — verificado manualmente e desfeito
- [ ] `.test.ts` existentes continuam em `node`; contagem de testes anterior preservada
- [ ] Gate: `npm run lint && npm run test:unit && npm run build`

**Tests**: unit · **Gate**: build
**Commit**: `chore(teste): harness de componente -- jsdom + testing-library (AD-042)`

---

### T2: `ref_limiar_pendencia` — estrutura, GRANT e seed

**What**: Migration criando a tabela de limiares, com GRANT-only (AD-030) e seed dos 4 limiares.
**Where**: `supabase/migrations/<ts>_estrategia_ref_limiar_pendencia.sql`, `supabase/tests/estrategia/ref-limiar-pendencia.integration.test.ts`
**Depends on**: None
**Reuses**: padrão de `20260810192209_catalogos_referencia_grants.sql`; teste espelha `catalogos-referencia-grants.integration.test.ts`
**Requirement**: EST-06

**Tools**: MCP: NONE · Skill: `supabase`

**Done when**:
- [ ] Tabela criada com `CHECK (dias > 0)` e `codigo` UNIQUE
- [ ] Seed: `formulario_aberto=30`, `sem_registro_recente=45`, `etapa_atencao`, `etapa_atrasado`
- [ ] GRANT SELECT para `authenticated` + as 5 roles `legisla_*`; `anon` sem SELECT (AD-030)
- [ ] Teste de integração assere estrutura, seed e uma linha por role × privilégio
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration · **Gate**: full
**Commit**: `feat(estrategia): ref_limiar_pendencia com GRANT-only (AD-041)`

---

### T3: `vw_pendencias` passa a ler os limiares

**What**: Migration substituindo os `INTERVAL` cravados por leitura de `ref_limiar_pendencia`.
**Where**: `supabase/migrations/<ts>_estrategia_vw_pendencias_limiar.sql`, `supabase/tests/estrategia/vw-pendencias-limiar.integration.test.ts`
**Depends on**: T2
**Reuses**: corpo atual da view (`20260814162237_visao_gerencial_vw_pendencias.sql`)
**Requirement**: EST-06

**Tools**: MCP: NONE · Skill: `supabase`, `supabase-postgres-best-practices`

**Done when**:
- [ ] Nenhum literal `INTERVAL '<n> days'` permanece no corpo da view (AD-004)
- [ ] As 6 categorias continuam retornando as mesmas linhas com o seed padrão (não-regressão)
- [ ] Alterar `ref_limiar_pendencia.dias` muda o resultado da view sem deploy (EST-06 / edge case)
- [ ] `security_invoker = true` preservado
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration · **Gate**: full
**Commit**: `refactor(estrategia): vw_pendencias le limiares de tabela (AD-041)`

---

### T4: Renome Raio-X → Diagnóstico

**What**: Migration de seed renomeando `ref_etapa.nome` de "Raio-X" para "Diagnóstico" nos produtos Estratégia e Coalizão, preservando `codigo = 'raio_x'`.
**Where**: `supabase/migrations/<ts>_estrategia_renomeia_raio_x_diagnostico.sql`, `supabase/tests/estrategia/renome-etapa-diagnostico.integration.test.ts`, `docs/schema_sistema.sql`
**Depends on**: None
**Reuses**: padrão de `20260812163617_kanban_etapas_correcao_ref_etapa.sql` (correção de conteúdo, não de estrutura)
**Requirement**: EST-14

**Tools**: MCP: NONE · Skill: `supabase`

**Done when**:
- [ ] `SELECT nome FROM ref_etapa WHERE codigo='raio_x'` retorna "Diagnóstico" nos 2 produtos (EST-14 AC1, AC4)
- [ ] `codigo` inalterado; contagem de `ref_tipo_registro`, `ref_formulario` e `fat_etapa_contrato` por etapa idêntica à de antes (EST-14 AC2)
- [ ] Migration é idempotente sob `supabase db reset` (roda do zero no CI)
- [ ] `docs/schema_sistema.sql` (bloco de seed de `ref_etapa`, ~linha 2234) passa a dizer "Diagnóstico" — o modelo aprovado não pode divergir do banco (AD-008)
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration · **Gate**: full
**Commit**: `feat(estrategia): renomeia etapa Raio-X para Diagnostico (EST-14)`

---

### T4b: Limiar de etapa passa a ser percentual da duração prevista

**What**: Migration ajustando `ref_limiar_pendencia` para que os limiares de etapa (`etapa_atencao`, `etapa_atrasado`) sejam **percentuais de `ref_etapa.duracao_prevista_dias`**, não dias absolutos. Os limiares de pendência (`formulario_aberto`, `sem_registro_recente`) continuam em dias absolutos.
**Where**: `supabase/migrations/<ts>_estrategia_limiar_etapa_percentual.sql`, `supabase/tests/estrategia/limiar-etapa-percentual.integration.test.ts`, `docs/schema_sistema.sql`
**Depends on**: T2
**Reuses**: `ref_limiar_pendencia` (T2), `ref_etapa.duracao_prevista_dias`
**Requirement**: EST-06, EST-07

**Tools**: MCP: NONE · Skill: `supabase`

**Contexto da decisão (Pedro, 2026-09-10):** limiar absoluto não distingue contexto — 120 dias em Monitoramento é normal, em Pontapé é abandono. O corte escolhido é **70% da duração prevista para Atenção** e **100% para Atrasado**. Ex.: Diagnóstico (21 dias) → amarelo aos 15, vermelho aos 22; Monitoramento (120) → amarelo aos 84.

**Done when**:
- [ ] A tabela distingue as duas bases de limiar (dias absolutos × percentual da duração da etapa), sem coluna ambígua
- [ ] `etapa_atencao = 70`, `etapa_atrasado = 100`, ambos expressos como percentual
- [ ] `formulario_aberto = 30` e `sem_registro_recente = 45` seguem em dias absolutos e a `vw_pendencias` da T3 continua verde (não-regressão)
- [ ] Nenhum percentual e nenhuma duração fica escrita em código (AD-004)
- [ ] `docs/schema_sistema.sql` reflete a forma final da tabela (AD-008)
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration · **Gate**: full
**Commit**: `feat(estrategia): limiar de etapa como percentual da duracao prevista (AD-045)`

---

### T5: `fat_prospeccao` — estrutura, índice parcial e auditoria

**What**: Migration criando a tabela de prospecção pré-contrato, com o índice parcial de unicidade e o trigger de auditoria.
**Where**: `supabase/migrations/<ts>_estrategia_fat_prospeccao_estrutura.sql`, `supabase/tests/estrategia/fat-prospeccao-estrutura.integration.test.ts`
**Depends on**: None
**Reuses**: `app.trg_auditoria()`; padrão de `20260813191715_incidencia_encontros_estrutura.sql`
**Requirement**: EST-04

**Tools**: MCP: NONE · Skill: `supabase`, `supabase-postgres-best-practices`

**Done when**:
- [ ] Tabela criada **sem** `id_contrato`, com os 3 CHECKs do design
- [ ] `uq_prospeccao_aberta_contratante` recusa a 2ª prospecção aberta do mesmo contratante+produto (EST-04 edge case)
- [ ] `trg_audit_fat_prospeccao` grava em `log_auditoria` no INSERT e no UPDATE (EST-04 AC2 / AD-006)
- [ ] `docs/schema_sistema.sql` recebe a tabela com comentário referenciando AD-040 (AD-008)
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration · **Gate**: full
**Commit**: `feat(estrategia): fat_prospeccao -- prospeccao pre-contrato (AD-040)`

---

### T6: RLS e GRANT de `fat_prospeccao`

**What**: Migration com as políticas de RLS e os GRANTs da tabela, no espírito de AD-001.
**Where**: `supabase/migrations/<ts>_estrategia_fat_prospeccao_rls.sql`, `supabase/tests/estrategia/fat-prospeccao-rls.integration.test.ts`
**Depends on**: T5
**Reuses**: padrão de `20260813192341_incidencia_encontros_rls.sql`
**Requirement**: EST-04

**Tools**: MCP: NONE · Skill: `supabase`

**Done when**:
- [ ] RLS habilitada; leitura permitida a Gestora/Admin e ao `id_usuario_resp`; negada às demais (EST-04 AC6)
- [ ] Escrita restrita às roles que podem criar contrato; `anon` sem nenhum privilégio (AD-002)
- [ ] Teste com sessão JWT real por papel, não só `has_table_privilege`
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration · **Gate**: full
**Commit**: `feat(estrategia): RLS e grants de fat_prospeccao (AD-001)`

---

### T7: RPC `app.converter_prospeccao`

**What**: Função Postgres `SECURITY INVOKER` que cria o `fat_contrato` e marca a prospecção como convertida, na mesma transação.
**Where**: `supabase/migrations/<ts>_estrategia_fn_converter_prospeccao.sql`, `supabase/tests/estrategia/fn-converter-prospeccao.integration.test.ts`
**Depends on**: T6
**Reuses**: padrão de `app.mover_etapa_kanban` (`20260812091115`); AD-024
**Requirement**: EST-04

**Tools**: MCP: NONE · Skill: `supabase`, `supabase-postgres-best-practices`

**Done when**:
- [ ] `SECURITY INVOKER` explícito; `SECURITY DEFINER` ausente (AD-024)
- [ ] Caminho feliz: cria contrato, seta `status='convertida'`, `id_contrato_gerado` e `dt_desfecho` (EST-04 AC3)
- [ ] Segunda conversão da mesma prospecção falha com erro tipado, sem criar contrato (EST-04 AC4)
- [ ] Falha no meio não deixa contrato órfão — asserido com rollback forçado
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration · **Gate**: full
**Commit**: `feat(estrategia): RPC converter_prospeccao transacional (AD-024)`

---

### T8: `queries/prospeccao.ts`

**What**: Leitura das prospecções abertas de um produto, para alimentar a raia do Quadro.
**Where**: `src/backend/queries/prospeccao.ts`, `src/backend/queries/prospeccao.test.ts`
**Depends on**: T6
**Reuses**: padrão de mock por nome de tabela de `queries/kanban.test.ts`
**Requirement**: EST-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Retorna só `status='aberta'` do produto pedido
- [ ] Produto sem prospecção retorna `[]`, nunca lança (padrão de `buscarBoardKanban`)
- [ ] Erro do PostgREST propaga como `throw` (padrão do projeto)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): query de prospeccoes abertas`

---

### T9: `rpc/prospeccao.ts`

**What**: Wrapper TypeScript da RPC de conversão, com mapeamento dos erros para mensagem.
**Where**: `src/backend/rpc/prospeccao.ts`, `src/backend/rpc/prospeccao.test.ts`
**Depends on**: T7, T8
**Reuses**: `rpc/errors.ts` (`mapearErroConstraint`); padrão de `rpc/kanban.ts`
**Requirement**: EST-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Cada parâmetro é repassado verbatim à RPC e asserido individualmente (lição L-004)
- [ ] Cada erro tipado da T7 mapeia para mensagem própria, uma asserção por erro (lição L-003)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): wrapper TS de converter_prospeccao`

---

### T10: Topbar sem "Gestão de Usuários"

> **AD-046**: teste de componente reduzido ao caminho feliz nesta task (tela de leitura). Pares positivo/negativo de condicional não exigidos.

**What**: Remover o item da Topbar, deixando marca + "Hub" + avatar.
**Where**: `src/frontend/components/app-shell/topbar.tsx`, `topbar.test.tsx`
**Depends on**: T1
**Reuses**: `Topbar` atual
**Requirement**: EST-05

**Tools**: MCP: `Figma` (T1 `59:4` para conferir a barra) · Skill: `ui-ux-pro-max`

**Done when**:
- [ ] Topbar renderiza marca, "Hub" e avatar (EST-05 AC1)
- [ ] Topbar **não** renderiza "Gestão de Usuários" — asserção negativa explícita (EST-05 AC2)
- [ ] `npm run lint:frontend` limpo neste arquivo
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `refactor(shell): Gestao de Usuarios sai da topbar (EST-05)`

---

### T11: `queries/hub.ts` — cards derivados por leitura

> **AD-046**: teste de componente reduzido ao caminho feliz nesta task (tela de leitura). Pares positivo/negativo de condicional não exigidos.

**What**: Montar a lista de cards do Hub, omitindo aquele cuja consulta de contador é negada pelo banco.
**Where**: `src/backend/queries/hub.ts`, `src/backend/queries/hub.test.ts`
**Depends on**: T1
**Reuses**: `PRODUTO_SLUGS`; `mv_numeros_impacto`, `mv_avaliacao_nps`
**Requirement**: EST-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Ordem fixa: Estratégia, PLL, Coalizão, Visão Gerencial, Números de Impacto, Gestão de Usuários (EST-02 AC6)
- [ ] Consulta negada por permissão → card omitido; erro de outra natureza → propaga (EST-02 AC2, AC7)
- [ ] `tipo: 'produto' | 'ferramenta'` correto por card
- [ ] Contagens de mandatos ativos e fatos geradores vêm da consulta, nunca fixas (EST-02 AC3, AC4)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(hub): cards derivados do que a role consegue ler (AD-001)`

---

### T12: Hub com 6 cards e contadores

> **AD-046**: teste de componente reduzido ao caminho feliz nesta task (tela de leitura). Pares positivo/negativo de condicional não exigidos.

**What**: Reescrever a página do Hub consumindo `buscarCardsHub`.
**Where**: `src/frontend/app/(app)/page.tsx`, `src/frontend/components/app-shell/hub-card.tsx`, `hub-card.test.tsx`
**Depends on**: T11
**Reuses**: `Card`, `EstadoVazio`, `CarregandoSkeleton`
**Requirement**: EST-02

**Tools**: MCP: `Figma` (T1 `59:4`) · Skill: `ui-ux-pro-max`, `frontend-design`

**Done when**:
- [ ] Renderiza um card por item retornado, na ordem recebida (EST-02 AC1, AC6)
- [ ] Card exibe badge de contador quando presente e o omite quando ausente — caso de teste dos dois lados
- [ ] Subtítulo revisto: não diz mais "Escolha um produto" (risco registrado no design)
- [ ] Clique navega para a rota do destino (EST-02 AC5)
- [ ] `lint:frontend` limpo nos arquivos tocados
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(hub): 6 cards com contadores reais (EST-02)`

---

### T13: Aba "Contratos" vira "Mandatos"

> **AD-046**: teste de componente reduzido ao caminho feliz nesta task (tela de leitura). Pares positivo/negativo de condicional não exigidos.

**What**: Renomear a aba no `ProdutoShell` e mover a rota `contratos/` para `mandatos/` no produto.
**Where**: `src/frontend/components/produtos/produto-shell.tsx`, `produto-shell.test.tsx`, `src/frontend/app/(app)/produtos/[slug]/mandatos/page.tsx`
**Depends on**: T1
**Reuses**: `RouteTabs`, `ProdutoShell`
**Requirement**: EST-03

**Tools**: MCP: `Figma` (T6 `202:554`) · Skill: NONE

**Done when**:
- [ ] As 4 abas renderizam com "Mandatos" no lugar de "Contratos" (EST-03 AC1)
- [ ] Aba ativa marcada e as demais não — teste dos dois lados (EST-03 AC2)
- [ ] "Voltar ao hub" navega para `/` (EST-03 AC3)
- [ ] Slug inválido retorna 404 (EST-03 AC4)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `refactor(estrategia): aba Contratos vira Mandatos (EST-03)`

---

### T14: `classificarLimiar` — função pura

> **AD-046**: teste de componente reduzido ao caminho feliz nesta task (tela de leitura). Pares positivo/negativo de condicional não exigidos.

**What**: Traduzir dias na etapa + limiares em `normal | atencao | atrasado`.
**Where**: `src/frontend/lib/limiar.ts`, `src/frontend/lib/limiar.test.ts`
**Depends on**: T2
**Reuses**: padrão de utilitário puro ao lado do consumidor (`planejamento-formato.ts`)
**Requirement**: EST-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Um caso de teste **de cada lado** de cada limiar, incluindo o valor exato de fronteira (lição L-001)
- [ ] Limiar ausente ou nulo devolve `normal`, nunca lança
- [ ] Nenhum número mágico no arquivo — limiares chegam por parâmetro (AD-004)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): classificacao de limiar de etapa`

---

### T15: `queries/quadro.ts` — colunas com raia de Prospecção

> **AD-046**: teste de componente reduzido ao caminho feliz nesta task (tela de leitura). Pares positivo/negativo de condicional não exigidos.

**What**: Compor as colunas de `ref_etapa` com a raia de prospecção numa estrutura só.
**Where**: `src/backend/queries/quadro.ts`, `src/backend/queries/quadro.test.ts`
**Depends on**: T8, T14
**Reuses**: `buscarBoardKanban`, `ColunaKanban`, `CardKanban`, `buscarProspeccoesAbertas`
**Requirement**: EST-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Raia de Prospecção vem primeiro; demais colunas por `ref_etapa.ordem` (EST-07 AC1)
- [ ] Para a Estratégia com o seed atual retorna **7 colunas** (EST-07 AC1)
- [ ] Etapa sem contrato retorna coluna vazia com contador 0 (edge case)
- [ ] Contrato sem `id_etapa_atual` cai em coluna "Sem etapa", nunca some (edge case)
- [ ] Adicionar linha em `ref_etapa` muda a contagem de colunas sem tocar em código (EST-07 AC1b)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): quadro com raia de prospeccao e colunas data-driven`

---

### T16: Componente `QuadroAcompanhamento`

> **AD-046**: teste de componente reduzido ao caminho feliz nesta task (tela de leitura). Pares positivo/negativo de condicional não exigidos.

**What**: Renderizar o board com badge de estado por limiar; prospect não arrastável.
**Where**: `src/frontend/components/estrategia/quadro-acompanhamento.tsx`, `.test.tsx`
**Depends on**: T15
**Reuses**: `KanbanBoard`, `KanbanColuna`, `KanbanCard`, `moverEtapaKanban`, `classificarLimiar`
**Requirement**: EST-07

**Tools**: MCP: `Figma` (T3 `44:5`) · Skill: `ui-ux-pro-max`

**Done when**:
- [ ] Card exibe contratante, cargo/partido e dias na etapa (EST-07 AC2)
- [ ] Badge reflete o estado do limiar — um caso de teste por estado (EST-07 AC3)
- [ ] Card da raia de Prospecção não é arrastável para coluna de etapa (AD-040)
- [ ] Estado vazio por coluna renderiza, não some
- [ ] `lint:frontend` limpo
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): Quadro de Acompanhamento (EST-07)`

---

### T17: `queries/pendencias.ts`

> **AD-046**: teste de componente reduzido ao caminho feliz nesta task (tela de leitura). Pares positivo/negativo de condicional não exigidos.

**What**: Ler `vw_pendencias` com os filtros do Dashboard.
**Where**: `src/backend/queries/pendencias.ts`, `.test.ts`
**Depends on**: T3
**Reuses**: consumo já existente em `queries/visao-gerencial.ts`
**Requirement**: EST-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Retorna as 5 categorias com mandato, tipo, detalhe e data de referência (EST-07 AC4)
- [ ] Sem pendências retorna `[]` (EST-07 AC6)
- [ ] Filtros de gestora e projeto aplicam AND, não OR
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): query de pendencias do dashboard`

---

### T18: Componente `TabelaPendencias`

> **AD-046**: teste de componente reduzido ao caminho feliz nesta task (tela de leitura). Pares positivo/negativo de condicional não exigidos.

**What**: Tabela acionável das pendências.
**Where**: `src/frontend/components/estrategia/tabela-pendencias.tsx`, `.test.tsx`
**Depends on**: T17
**Reuses**: `Table`, `Badge`, `EstadoVazio`
**Requirement**: EST-07

**Tools**: MCP: `Figma` (T3 `44:5`) · Skill: `ui-ux-pro-max`

**Done when**:
- [ ] Uma linha por pendência, com badge por tipo (EST-07 AC4)
- [ ] Clique navega para o contrato correspondente (EST-07 AC5)
- [ ] Lista vazia renderiza `EstadoVazio`, não tabela vazia (EST-07 AC6)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): tabela de pendencias acionavel (EST-07)`

---

### T18b: Montagem da página `/produtos/[slug]/dashboard`

> **Lacuna de planejamento, não de execução.** T14-T18 construíram `QuadroAcompanhamento` e
> `TabelaPendencias` como componentes isolados, cada um com teste unitário verde — mas nenhuma
> task ligava esses componentes à página real. `dashboard/page.tsx` seguiu servindo o dashboard
> antigo da feature `kanban-etapas` (Contratos ativos / Assessores ativos / NPS), e foi assim que
> Pedro encontrou ao conferir a tela em 2026-09-11. Corrigido no mesmo dia, mesma conversa.

**What**: Criar `queries/limiar.ts` (busca os 4 limiares reais de `ref_limiar_pendencia`, T2/T4b),
orquestrar `buscarQuadro` (T15) + `buscarPendenciasDashboard` (T17) + os limiares na página, ligar
o callback de `QuadroAcompanhamento` a `moverEtapaKanban` (já existe, feature `kanban-etapas`), e
reescrever `produtos/[slug]/dashboard/page.tsx` para renderizar `QuadroAcompanhamento` +
`TabelaPendencias` no lugar do dashboard antigo.
**Where**: `src/backend/queries/limiar.ts`, `.test.ts`, `src/frontend/app/(app)/produtos/[slug]/dashboard/page.tsx`
**Depends on**: T15, T16, T17, T18
**Reuses**: `moverEtapaKanban`, `QuadroAcompanhamento`, `TabelaPendencias`, `buscarQuadro`, `buscarPendenciasDashboard`
**Requirement**: EST-07

**Tools**: MCP: `Figma` (T3 `44:5`) · Skill: `ui-ux-pro-max`

**Done when**:
- [x] `queries/limiar.ts` lê os 4 limiares de `ref_limiar_pendencia`, nenhum número mágico no componente (AD-004)
- [x] `/produtos/estrategia/dashboard` renderiza o Quadro com a raia de Prospecção e os badges de limiar, não o dashboard antigo
- [x] Tabela de Pendências renderizada na mesma página, abaixo ou ao lado do Quadro (conferir posição no Figma `44:5`)
- [x] Arrastar um card de etapa chama `moverEtapaKanban` e a coluna atualiza (EST-07 AC2/AC3, ponta a ponta)
- [x] `lint:frontend` limpo nos arquivos tocados
- [x] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): monta pagina do Dashboard com Quadro e Pendencias (EST-07)`

---

### T19: `queries/mandatos-lista.ts`

> **AD-046**: teste de componente reduzido ao caminho feliz nesta task (tela de leitura). Pares positivo/negativo de condicional não exigidos.

**What**: Listar contratos do produto com os 5 filtros do Figma.
**Where**: `src/backend/queries/mandatos-lista.ts`, `.test.ts`
**Depends on**: T13
**Reuses**: `queries/contrato.ts`, `vw_contrato`
**Requirement**: EST-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Cada filtro (data, gestora, projeto, etapa, status) restringe isoladamente (EST-09 AC3)
- [ ] Dois filtros juntos aplicam AND
- [ ] Prospecções **não** aparecem (EST-04 AC5)
- [ ] Contagem total acompanha o filtro (EST-09 AC2)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): query da lista de mandatos com filtros`

---

### T20: Componente `ListaMandatos`

> **AD-046**: teste de componente reduzido ao caminho feliz nesta task (tela de leitura). Pares positivo/negativo de condicional não exigidos.

**What**: Grade de cards de contrato.
**Where**: `src/frontend/components/estrategia/lista-mandatos.tsx`, `.test.tsx`
**Depends on**: T19
**Reuses**: `Card`, `Badge`, `EstadoVazio`
**Requirement**: EST-09

**Tools**: MCP: `Figma` (T6 `202:554`) · Skill: `ui-ux-pro-max`

**Done when**:
- [ ] Card exibe contratante, vigência, status, gestora, projeto, etapa e responsável (EST-09 AC1)
- [ ] `dt_fim` nula renderiza "—" (EST-09 AC5 / AD-005)
- [ ] Status traduz `ativo|concluido|nao_concluido` para Ativo|Finalizado|Desligado — um caso por status
- [ ] Lista vazia renderiza estado vazio explicativo (EST-09 AC6)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): lista de mandatos em cards (EST-09)`

---

### T21: Barra de filtros da lista

> **AD-046**: teste de componente reduzido ao caminho feliz nesta task (tela de leitura). Pares positivo/negativo de condicional não exigidos.

**What**: Os 5 filtros mais "Limpar filtros" e a contagem.
**Where**: `src/frontend/components/estrategia/filtros-mandatos.tsx`, `.test.tsx`
**Depends on**: T20
**Reuses**: `Select`, `Input`
**Requirement**: EST-09

**Tools**: MCP: `Figma` (T6 `202:554`) · Skill: `ui-ux-pro-max`

**Done when**:
- [ ] Cada filtro altera a consulta e a contagem exibida (EST-09 AC2, AC3)
- [ ] "Limpar filtros" devolve todos ao estado inicial (EST-09 AC4)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): filtros da lista de mandatos (EST-09)`

---

### T21b: Montagem da página `/produtos/[slug]/mandatos`

> **Mesma lacuna de planejamento de T18b.** T19-T21 constroem `ListaMandatos` e a barra de
> filtros isolados; nenhuma delas ligava à página real. T13 apenas renomeou a aba e moveu a rota
> de `contratos/` para `mandatos/`, preservando o conteúdo antigo (lista simples, sem os 5
> filtros do Figma `202:554`). Corrigido junto com T18b, mesma causa raiz.

**What**: Reescrever `produtos/[slug]/mandatos/page.tsx` para renderizar a barra de filtros (T21)
acima de `ListaMandatos` (T20), consumindo `buscarMandatosLista` (T19) com o estado dos filtros.
**Where**: `src/frontend/app/(app)/produtos/[slug]/mandatos/page.tsx`
**Depends on**: T19, T20, T21
**Reuses**: `ListaMandatos`, `FiltrosMandatos`, `buscarMandatosLista`
**Requirement**: EST-09

**Tools**: MCP: `Figma` (T6 `202:554`) · Skill: `ui-ux-pro-max`

**Done when**:
- [ ] `/produtos/estrategia/mandatos` renderiza a barra de filtros + a grade de cards, não a lista antiga
- [ ] Mudar um filtro refaz a consulta e atualiza a contagem exibida (EST-09 AC2/AC3, ponta a ponta)
- [ ] "Limpar filtros" devolve a lista completa (EST-09 AC4)
- [ ] `lint:frontend` limpo
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): monta pagina da lista de Mandatos com filtros (EST-09)`

---

### T22: Novo Contrato — estado de busca TSE

**What**: Estado inicial da tela: busca com mínimo de 3 letras e saída para cadastro manual.
**Where**: `src/frontend/components/produtos/novo-contrato-view.tsx`, `.test.tsx`, `components/fundacao/tse-match-search.tsx`
**Depends on**: T13
**Reuses**: `queries/tse.ts`, `TseMatchSearch`
**Requirement**: EST-10

**Tools**: MCP: `Figma` (T4 `188:192`) · Skill: `ui-ux-pro-max`

**Done when**:
- [ ] Menos de 3 letras não dispara busca; 3 ou mais dispara — teste dos dois lados (EST-10 AC1, AC2)
- [ ] Falha da busca renderiza `ErroInline` e mantém "Cadastro manual" acessível (EST-10 AC8)
- [ ] `lint:frontend` limpo em `tse-match-search.tsx` (2 problemas atuais resolvidos)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): busca TSE do Novo Contrato (EST-10)`

---

### T23: Novo Contrato — formulário em 4 seções

**What**: Formulário preenchido, com campos do TSE somente leitura.
**Where**: `src/frontend/components/fundacao/mandato-wizard.tsx`, `.test.tsx`
**Depends on**: T22
**Reuses**: `schemas/mandato.ts`, `schemas/contrato.ts`, `contratante-fields.tsx`, `contrato-form.tsx`
**Requirement**: EST-10, EST-11

**Tools**: MCP: `Figma` (T2 `188:5`) · Skill: `ui-ux-pro-max`

**Done when**:
- [ ] As 4 seções do Figma renderizam com os campos do design
- [ ] Campos vindos do TSE são `readOnly`; no modo manual são editáveis — teste dos dois lados (EST-10 AC3, AC4)
- [ ] "Cancelar e buscar novamente" desfaz o vínculo e reabre a busca (EST-10 AC5)
- [ ] Schema Zod **importado**, não redeclarado inline (lição L-005)
- [ ] `lint:frontend` limpo nos arquivos tocados
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): formulario de Novo Contrato em 4 secoes (EST-10)`

---

### T24: Novo Contrato — submissão transacional

**What**: Ligar o formulário à RPC que cria mandato e contrato juntos, com tratamento de erro.
**Where**: `src/frontend/components/fundacao/mandato-wizard.tsx` (modificar), `.test.tsx`
**Depends on**: T23
**Reuses**: `rpc/mandato.ts`, `rpc/errors.ts`
**Requirement**: EST-11

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Submissão chama a RPC única; nunca dois inserts sequenciais (EST-11 AC6 / AD-024)
- [ ] Título duplicado exibe mensagem específica e preserva o formulário (EST-11 AC7)
- [ ] Erro propaga por `ErroInline`, o componente padrão (lição L-008)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): submissao transacional de mandato e contrato (EST-11)`

---

### T25: `queries/agenda.ts` — encontros do mês

> **AD-046**: teste de componente reduzido ao caminho feliz nesta task (tela de leitura). Pares positivo/negativo de condicional não exigidos.

**What**: Buscar encontros de um mês para o produto, com os filtros da tela.
**Where**: `src/backend/queries/agenda.ts`, `.test.ts`
**Depends on**: T13
**Reuses**: `queries/incidencia.ts`, `fat_encontro`
**Requirement**: EST-12

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Retorna só encontros dentro do intervalo do mês pedido — teste de fronteira nos dois extremos (lição L-001)
- [ ] Mês sem encontros retorna `[]`, nunca lança (EST-12 / edge case)
- [ ] Filtros de gestora, projeto e contrato aplicam AND
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(agenda): query de encontros do mes`

---

### T26: Componente `AgendaMes`

> **AD-046**: teste de componente reduzido ao caminho feliz nesta task (tela de leitura). Pares positivo/negativo de condicional não exigidos.

**What**: Grade mensal com os encontros posicionados e navegação entre meses.
**Where**: `src/frontend/components/estrategia/agenda-mes.tsx`, `.test.tsx`
**Depends on**: T25
**Reuses**: `Card`, `Badge`
**Requirement**: EST-12

**Tools**: MCP: `Figma` (T5 `163:4`) · Skill: `ui-ux-pro-max`, `frontend-design`

**Done when**:
- [ ] Encontro aparece na célula do dia correto (EST-12 AC1)
- [ ] Cor reflete o status Agendada/Realizada — um caso por status (EST-12 AC2)
- [ ] Navegar de mês recarrega os encontros (EST-12 AC3)
- [ ] Célula de hoje destacada; caso de teste com hoje dentro e fora do mês exibido (EST-12 AC6, lição L-002 — data de referência explícita, nunca `now()` implícito)
- [ ] Mês vazio renderiza a grade completa (edge case)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(agenda): grade mensal de encontros (EST-12)`

---

### T27: `queries/registros-agenda.ts`

> **AD-046**: teste de componente reduzido ao caminho feliz nesta task (tela de leitura). Pares positivo/negativo de condicional não exigidos.

**What**: Listar registros, opcionalmente filtrados por encontro.
**Where**: `src/backend/queries/registros-agenda.ts`, `.test.ts`
**Depends on**: T25
**Reuses**: `fat_registro`, `ref_tipo_registro`
**Requirement**: EST-12

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Sem filtro retorna todos do recorte; com `idEncontro` retorna só os dele (EST-12 AC5)
- [ ] Retorna tipo, data, descrição e responsável
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(agenda): query de registros da agenda`

---

### T28: Componente `EncontroPopover`

**What**: Popover de detalhe do encontro (leitura).
**Where**: `src/frontend/components/estrategia/encontro-popover.tsx`, `.test.tsx`
**Depends on**: T26, T27
**Reuses**: `Popover`, `Badge`, `encontros-lista.tsx`
**Requirement**: EST-13

**Tools**: MCP: `Figma` (T7 `90:206`) · Skill: `ui-ux-pro-max`

**Done when**:
- [ ] Exibe status, etapa, tipo, data/horário, modalidade, local, tema e participantes (EST-13 AC1)
- [ ] Contagem de registros vinculados e link aparecem quando há registros e somem quando não há — teste dos dois lados (EST-13 AC2)
- [ ] Campo nulo renderiza ausência, nunca string vazia (AD-005)
- [ ] `lint:frontend` limpo em `encontros-lista.tsx`
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(agenda): popover de detalhe do encontro (EST-13)`

---

### T29: RPC `app.marcar_presenca` + wrapper

**What**: Função Postgres que fecha o encontro como realizado e grava presença, mais o wrapper TS.
**Where**: `supabase/migrations/<ts>_estrategia_fn_marcar_presenca.sql`, `supabase/tests/estrategia/fn-marcar-presenca.integration.test.ts`, `src/backend/rpc/encontro.ts`, `.test.ts`
**Depends on**: T28
**Reuses**: `app.trg_auditoria()`, padrão de `app.mover_etapa_kanban`
**Requirement**: EST-13

**Tools**: MCP: NONE · Skill: `supabase`

**Done when**:
- [ ] `SECURITY INVOKER` (AD-024); grava `status='realizado'` e `dt_realizada` (EST-13 AC4)
- [ ] Autor e timestamp registrados em `log_auditoria` (AD-006)
- [ ] Chamada em encontro já realizado é idempotente — não duplica transição (EST-13 AC5)
- [ ] Wrapper assere cada parâmetro repassado (lição L-004)
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration + unit · **Gate**: full
**Commit**: `feat(agenda): RPC marcar_presenca idempotente (EST-13)`

---

### T30: Ação de presença e registro no popover

**What**: Ligar "Marcar presença" e "Adicionar registro" no popover.
**Where**: `src/frontend/components/estrategia/encontro-popover.tsx` (modificar), `.test.tsx`
**Depends on**: T29
**Reuses**: `rpc/encontro.ts`, `encontro-form.tsx`
**Requirement**: EST-13

**Tools**: MCP: `Figma` (T7 `90:206`) · Skill: NONE

**Done when**:
- [ ] Aviso e ação aparecem só quando a data passou e o status é `planejado` — teste dos dois lados (EST-13 AC3)
- [ ] Marcar presença atualiza o status na grade (EST-13 AC4)
- [ ] "Adicionar registro" abre a criação já vinculada ao encontro e contrato (EST-13 AC6)
- [ ] `lint:frontend` limpo em `encontro-form.tsx`
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(agenda): marcar presenca e adicionar registro no popover (EST-13)`

---

### T31: View `vw_estrategia_kpi`

> **AD-046**: teste de componente reduzido ao caminho feliz nesta task (tela de leitura). Pares positivo/negativo de condicional não exigidos.

**What**: Agregar por produto os 6 números do topo do Dashboard.
**Where**: `supabase/migrations/<ts>_estrategia_vw_kpi.sql`, `supabase/tests/estrategia/vw-estrategia-kpi.integration.test.ts`
**Depends on**: T3, T5
**Reuses**: `mv_iip_contrato`, `mv_avaliacao_nps`, `vw_pendencias`, `dim_planejamento`
**Requirement**: EST-08

**Tools**: MCP: NONE · Skill: `supabase`, `supabase-postgres-best-practices`

**Done when**:
- [ ] Os 6 KPIs saem da view, nenhum calculado fora dela (AD-003)
- [ ] View só lê e agrega; não recalcula o IIP (AD-014, AD-015)
- [ ] Sem dado suficiente devolve `NULL`, nunca `0` (AD-005 / EST-08 AC2)
- [ ] `security_invoker = true`; grants coerentes com os `REVOKE` existentes
- [ ] Gate: `npm run test:unit && npm run test:integration`

**Tests**: integration · **Gate**: full
**Commit**: `feat(estrategia): vw_estrategia_kpi na camada Saida (AD-003)`

---

### T32: `queries/estrategia-kpi.ts`

> **AD-046**: teste de componente reduzido ao caminho feliz nesta task (tela de leitura). Pares positivo/negativo de condicional não exigidos.

**What**: Ler a view com os filtros de gestora e projeto.
**Where**: `src/backend/queries/estrategia-kpi.ts`, `.test.ts`
**Depends on**: T31
**Reuses**: padrão de `queries/numeros-impacto.ts`
**Requirement**: EST-08

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Filtros recalculam o recorte (EST-08 AC3)
- [ ] `NULL` do banco chega como ausência, não como `0` (EST-08 AC2)
- [ ] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(estrategia): query dos KPIs do dashboard`

---

### T33: Componente `KpiRow`

> **AD-046**: teste de componente reduzido ao caminho feliz nesta task (tela de leitura). Pares positivo/negativo de condicional não exigidos.

**What**: Faixa dos 6 KPIs no topo do Dashboard.
**Where**: `src/frontend/components/estrategia/kpi-row.tsx`, `.test.tsx`
**Depends on**: T32
**Reuses**: `Card`, `chart.tsx`
**Requirement**: EST-08

**Tools**: MCP: `Figma` (T3 `44:5`) · Skill: `ui-ux-pro-max`, `dataviz`

**Done when**:
- [ ] Os 6 KPIs renderizam com os rótulos do Figma (EST-08 AC1)
- [ ] Ausência renderiza "—" e presença renderiza o número — teste dos dois lados (EST-08 AC2)
- [ ] `lint:frontend` limpo
- [ ] Gate: `npm run lint && npm run test:unit && npm run build`

**Tests**: unit · **Gate**: build
**Commit**: `feat(estrategia): faixa de KPIs do dashboard (EST-08)`

---

## Phase Execution Map

```
Fase 0 → Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5 → Fase 6 → Fase 7 → Fase 8

Fase 0:  T1
Fase 1:  T2 ──→ T3 ──→ T4
Fase 2:  T5 ──→ T6 ──→ T7 ──→ T8 ──→ T9
Fase 3:  T10 ─→ T11 ─→ T12 ─→ T13
Fase 4:  T14 ─→ T15 ─→ T16 ─→ T17 ─→ T18
Fase 5:  T19 ─→ T20 ─→ T21
Fase 6:  T22 ─→ T23 ─→ T24
Fase 7:  T25 ─→ T26 ─→ T27 ─→ T28 ─→ T29 ─→ T30
Fase 8:  T31 ─→ T32 ─→ T33
```

Dependências que cruzam fases: T14←T2 · T15←T8,T14 · T16←T15 · T17←T3 · T19←T13 ·
T22←T13 · T25←T13 · T31←T3,T5 · T10/T11/T13←T1

---

## Task Granularity Check

| Task | Escopo | Status |
| :-- | :-- | :-- |
| T1 | config + 1 smoke test | ✅ coeso |
| T2, T3, T4 | 1 migration cada | ✅ granular |
| T5, T6, T7 | 1 migration cada | ✅ granular |
| T8, T9 | 1 módulo cada | ✅ granular |
| T10–T13 | 1 componente/módulo cada | ✅ granular |
| T14–T18 | 1 função/módulo/componente cada | ✅ granular |
| T19–T21 | 1 módulo/componente cada | ✅ granular |
| T22–T24 | 1 estado/seção/ligação cada | ✅ granular |
| T25–T28, T30 | 1 módulo/componente cada | ✅ granular |
| T29 | RPC + wrapper (2 arquivos, 1 conceito) | ⚠️ coeso — wrapper sem RPC é intestável |
| T31–T33 | 1 view/módulo/componente cada | ✅ granular |

Nenhum ❌. T29 é a única task multi-arquivo, justificada pela regra de resolução de dependência
de compilação: o wrapper não é testável antes da RPC existir, então merge backward.

---

## Diagram-Definition Cross-Check

| Task | Depends on (corpo) | Diagrama | Status |
| :-- | :-- | :-- | :-- |
| T1 | None | início da Fase 0 | ✅ |
| T2 | None | início da Fase 1 | ✅ |
| T3 | T2 | T2→T3 | ✅ |
| T4 | None | T3→T4 (ordem, não dependência) | ✅ |
| T5 | None | início da Fase 2 | ✅ |
| T6 | T5 | T5→T6 | ✅ |
| T7 | T6 | T6→T7 | ✅ |
| T8 | T6 | T7→T8 (ordem) + nota de cruzamento | ✅ |
| T9 | T7, T8 | T8→T9 | ✅ |
| T10 | T1 | Fase 0→3, nota de cruzamento | ✅ |
| T11 | T1 | T10→T11 (ordem) + nota | ✅ |
| T12 | T11 | T11→T12 | ✅ |
| T13 | T1 | T12→T13 (ordem) + nota | ✅ |
| T14 | T2 | nota de cruzamento T14←T2 | ✅ |
| T15 | T8, T14 | T14→T15 + nota | ✅ |
| T16 | T15 | T15→T16 | ✅ |
| T17 | T3 | nota de cruzamento T17←T3 | ✅ |
| T18 | T17 | T17→T18 | ✅ |
| T19 | T13 | nota de cruzamento T19←T13 | ✅ |
| T20 | T19 | T19→T20 | ✅ |
| T21 | T20 | T20→T21 | ✅ |
| T22 | T13 | nota de cruzamento T22←T13 | ✅ |
| T23 | T22 | T22→T23 | ✅ |
| T24 | T23 | T23→T24 | ✅ |
| T25 | T13 | nota de cruzamento T25←T13 | ✅ |
| T26 | T25 | T25→T26 | ✅ |
| T27 | T25 | T26→T27 (ordem) + nota | ✅ |
| T28 | T26, T27 | T27→T28 | ✅ |
| T29 | T28 | T28→T29 | ✅ |
| T30 | T29 | T29→T30 | ✅ |
| T31 | T3, T5 | nota de cruzamento | ✅ |
| T32 | T31 | T31→T32 | ✅ |
| T33 | T32 | T32→T33 | ✅ |

Nenhuma dependência aponta para fase posterior. Nenhum ❌.

---

## Test Co-location Validation

| Task | Camada criada/modificada | Matrix exige | Task diz | Status |
| :-- | :-- | :-- | :-- | :-- |
| T1 | config + componente | unit | unit | ✅ |
| T2 | migration/DDL/GRANT | integration | integration | ✅ |
| T3 | view | integration | integration | ✅ |
| T4 | seed | integration | integration | ✅ |
| T5 | migration/DDL | integration | integration | ✅ |
| T6 | RLS/GRANT | integration | integration | ✅ |
| T7 | RPC Postgres | integration | integration | ✅ |
| T8 | `queries/**` | unit | unit | ✅ |
| T9 | `rpc/**` | unit | unit | ✅ |
| T10 | componente React | unit | unit | ✅ |
| T11 | `queries/**` | unit | unit | ✅ |
| T12 | componente React | unit | unit | ✅ |
| T13 | componente React | unit | unit | ✅ |
| T14 | função pura frontend | unit | unit | ✅ |
| T15 | `queries/**` | unit | unit | ✅ |
| T16 | componente React | unit | unit | ✅ |
| T17 | `queries/**` | unit | unit | ✅ |
| T18 | componente React | unit | unit | ✅ |
| T19 | `queries/**` | unit | unit | ✅ |
| T20 | componente React | unit | unit | ✅ |
| T21 | componente React | unit | unit | ✅ |
| T22 | componente React | unit | unit | ✅ |
| T23 | componente React | unit | unit | ✅ |
| T24 | componente React | unit | unit | ✅ |
| T25 | `queries/**` | unit | unit | ✅ |
| T26 | componente React | unit | unit | ✅ |
| T27 | `queries/**` | unit | unit | ✅ |
| T28 | componente React | unit | unit | ✅ |
| T29 | RPC Postgres + `rpc/**` | integration (mais alto) | integration + unit | ✅ |
| T30 | componente React | unit | unit | ✅ |
| T31 | view | integration | integration | ✅ |
| T32 | `queries/**` | unit | unit | ✅ |
| T33 | componente React | unit | unit | ✅ |

Nenhuma ❌ VIOLATION. Nenhum `Tests: none`.

---

## Empacotamento em batches

33 tasks. Empacotando fases inteiras a ~7 tasks por worker, sem nunca dividir uma fase:

| Batch | Fases | Tasks | N |
| :-- | :-- | :-- | :-- |
| 1 | F0 + F1 | T1–T4 | 4 |
| 2 | F2 | T5–T9 | 5 |
| 3 | F3 | T10–T13 | 4 |
| 4 | F4 | T14–T18 | 5 |
| 5 | F5 + F6 | T19–T24 | 6 |
| 6 | F7 | T25–T30 | 6 |
| 7 | F8 | T31–T33 | 3 |

Batches rodam em sequência. Depois do último commit, o **Verifier** roda automaticamente.
