# Redesenho tela-first do produto Estratégia — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implemente estas tasks com a skill `tlc-spec-driven`: **ative-a pelo nome e siga o fluxo de
Execute e as Critical Rules dela.** Não procure os arquivos da skill por caminho de sistema de
arquivos. A skill é a fonte de verdade do fluxo completo (ciclo por task, delegação a
sub-agentes, Verifier, sensor de discriminação).

**Se a skill não puder ser ativada, PARE e avise o usuário — não prossiga sem ela.**

---

**Design**: `.specs/features/redesenho-estrategia-tela-first/design.md`
**Status**: In Progress — **as 9 fases (F0-F8, 37 tasks) estão entregues.** F0-F5
confirmadas na tela por Pedro. F6 (Novo Contrato), F8 (KPIs) e F7 (Agenda, T25-T30,
2026-09-12) entregues e **ainda não confirmadas na tela**. Verifier pendente sobre
F5-F8 — o validation.md em disco cobre só T1-T18.

> ### ⏭️ PENDENTE — Verifier final (adiado para 2026-09-13 por limite de créditos)
>
> Decisão do Pedro em 2026-09-12: o Verifier final roda **amanhã, quando os créditos
> resetarem**. Ele ainda **não rodou** sobre F5-F8 — `validation.md` em disco cobre
> apenas T1-T18 (Fases 0-4), com diff range `53db28f`..`ae4f67c`.
>
> O que ele precisa cobrir quando rodar:
> - **Mais de 25 commits sem auditoria independente**: Fases 5, 6, 7 e 8, mais as
>   quatro tasks de montagem de página (T18b, T21b, T30b, T33b) e as correções de
>   2026-09-12 (`b4afcea` recorte de mês, `1f8ee44` estado vazio da grade).
> - **EST-01 a EST-14 inteiros**, não só os requisitos de F0-F4.
> - **Telas de escrita em profundidade integral** (Novo Contrato T22-T24, popover de
>   presença T28-T30) — AD-046 não as alcança.
> - **As ACs cortadas por AD-046** nas telas de leitura, que devem aparecer como
>   spec-precision gaps explícitos, nunca como "coberto".
> - **2 dos 3 gaps herdados fechados em 2026-09-14**: "Gestão de Usuários" (era
>   diagnóstico invertido, não RLS faltando — ver desvio 2 do Batch 3) e slug
>   inválido → 404 (ganhou `layout.test.ts` — ver desvio 4 do Batch 3). Resta
>   EST-13 AC6, ainda parcial, arrumo a seguir.
> - **Por que os testes não pegaram o que o Pedro pegou**: em 2026-09-12, quatro
>   defeitos reais foram encontrados por ele abrindo a tela, não por gate nenhum —
>   Agenda nunca montada, bug da coalizão (`id_contratante` onde a FK pedia
>   `id_coalizao`), lista de registros sem recorte de mês, e grade vazia sem
>   estado explícito. Vale o Verifier olhar para esse padrão, não só para ACs.

> ### Sobre as marcações `[x]` deste documento
>
> Em 2026-09-12, a pedido do Pedro, os 150 critérios de "Done when" que seguiam
> desmarcados foram marcados **em bloco**. A evidência usada foi indireta: toda task
> tem commit próprio, gate registrado como verde no Registro de execução da sua fase,
> e desvios documentados. **Não** houve re-verificação item a item — isso é justamente
> o trabalho do Verifier final acima.
>
> Um único critério foi deixado **desmarcado de propósito**: T30, "Adicionar registro
> abre a criação já vinculada ao encontro e contrato" (EST-13 AC6), porque está
> declarado PARCIAL no desvio 10 da Fase 7. Marcá-lo seria registrar como feito algo
> que o próprio worker documentou como não feito.
>
> Leia as marcações como "a task foi entregue e passou no gate", não como "cada
> critério foi conferido individualmente".

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

2. **RESOLVIDO em 2026-09-14 — o "risco aceito" abaixo (texto original de
   2026-09-11) tinha o diagnóstico invertido.** A análise original concluía que
   faltava "uma RLS que distinga Admin de Gestora" para o card "Gestão de
   Usuários". Pedro corrigiu: Gestora **deve** gerenciar usuários — a política
   `p_usuario` já implementa exatamente isso (SELECT/UPDATE completos a Admin e
   Gestora; só a promoção de alguém a admin/gestora é restrita a quem já é admin,
   via `WITH CHECK`), e `/usuarios/page.tsx` (`souAdmin`) já respeita essa
   distinção fina havia tempo. **O único lugar com o critério errado era o card do
   Hub** (`queries/hub.ts`, `ehAdmin` restringia a só-Admin) — que por sua vez
   só reproduzia um AC do `spec.md` (EST-02 AC7) que eu, ao escrever o spec,
   registrei errado. Corrigido: `ehAdmin` → `podeGerenciarUsuarios` (Admin OU
   Gestora), `spec.md` EST-02 AC7 e EST-05 AC3 com nota de correção datada,
   teste do Hub trocado (Gestora agora tem caso "vê o card"; Mentor ganhou o
   par negativo que faltava). Nenhuma migration necessária — a RLS já estava
   certa; o código é que divergia dela. Ver histórico abaixo por transparência,
   mas a recomendação de "AD nova" nele **não se aplica mais**.

   <details><summary>Texto original do desvio (2026-09-11, mantido para histórico)</summary>

   Risco aceito documentado no código, não só no commit: card "Gestão de
   Usuários" do Hub (T11/T12, EST-02 AC7). O padrão "consulta negada por
   permissão (42501) → card omitido" que rege Visão Gerencial/Números de Impacto
   (AD-036: `mv_avaliacao_nps`/`mv_numeros_impacto` nunca concedidas a
   `legisla_mentor`/`legisla_assessor`) não se aplica a `dim_usuario`: a
   política `p_usuario` (`app.papel_atual() IN ('admin','gestora')`) dá SELECT
   completo tanto a Admin quanto a Gestora — não existe hoje nenhuma consulta cujo
   42501 distinga as duas roles para este recurso. `queries/hub.ts` (`ehAdmin`)
   resolve o card lendo `dim_usuario.papel_global` da própria usuária autenticada
   (dado do banco, resolvido pela sessão — não um papel hardcoded/prop), mas isso
   é UI hiding, não enforcement de RLS: uma Gestora que ignorasse a UI e navegasse
   direto para `/usuarios` não seria barrada pelo banco hoje (mesma lacuna que já
   existia antes desta feature — `usuarios/page.tsx:35` já tinha o comentário
   "Default permissivo para interface"). Enforcement real (uma RLS/GRANT que
   realmente distinga Admin de Gestora para este recurso) fica pendente de uma
   migration futura — fora do escopo de T10-T13, que são todas `quick`/sem
   migration. Recomendação registrada, não decretada: uma feature futura que mexa
   em `dim_usuario`/`/usuarios` deveria fechar essa lacuna com uma AD nova.

   </details>

3. **Where de T12 interpretado como "só `hub-card.test.tsx`" — nenhum
   `page.test.tsx` criado.** O Done-when de T12 inclui "Renderiza um card por item
   retornado, na ordem recebida (AC1, AC6)", que tecnicamente é comportamento de
   `app/(app)/page.tsx` (o `cards.map(...)`), não de `hub-card.tsx` (que renderiza
   1 card). A task só lista `hub-card.test.tsx` em "Where". Tratado como glue
   trivial já coberto por composição: a ordenação do array vem testada em
   `hub.test.ts` (T11) e a renderização de 1 card vem testada em
   `hub-card.test.tsx` (T12) — nenhum teste novo foi adicionado além do escopo
   declarado.

4. **FECHADO em 2026-09-14.** T13 AC4 ("slug inválido retorna 404") não tinha
   teste novo — `ProdutoShell` recebe `slug: ProdutoSlug` já estreitado pelo tipo
   (não existe caminho de código dentro dele para slug inválido); a fronteira
   real é `produtos/[slug]/layout.tsx` (`notFound()`), anterior a esta feature.
   Pedro pediu para fechar: `layout.test.ts` novo, chamando o Server Component
   direto (função async, sem `@testing-library/react` — não há nada para
   renderizar em jsdom aqui). Trava o `digest` real do Next
   (`"NEXT_HTTP_ERROR_FALLBACK;404"`, não um throw genérico) para slug inválido,
   e o lado oposto (slug válido monta `ProdutoShell` com slug e children certos).
   Sensor: `isProdutoSlug` mutado para sempre `true`, o teste do lado inválido
   morreu; restaurado, voltou a passar. Gate: unit 739/739.

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

### Fase 8 — ✅ COMPLETO (2026-09-11)

| Task | Commit | Gate | Resultado |
| :-- | :-- | :-- | :-- |
| T31 `vw_estrategia_kpi` | `2f7ec59` | full | unit 575/575 · integração 485 passes + 3 timeouts (ver desvio 1) · teste próprio 11/11 |
| T32 `queries/estrategia-kpi.ts` | `d00d3a6` | quick | unit **63 arquivos, 588/588 testes** |
| — correção de tipo em T32 | `152ba51` | build | ver desvio 3 |
| T33 `KpiRow` | `5eba92c` | build | unit **63 arquivos, 590/590 testes** |
| T33b Montagem da faixa no Dashboard | `a37878e` | build | lint raiz 0 · `lint:frontend` 29 problemas pré-existentes, nenhum nos arquivos desta fase · unit **590/590** · build 0 erros |

**Migrations aplicadas em dev** (`npnvoolkebhabjkjzqwn`, project-ref conferido
imediatamente antes do `db push`): `20260911210203_estrategia_vw_kpi`.
`docs/schema_sistema.sql` atualizado no mesmo commit (AD-008).

**Desvios registrados:**

1. **Gate `full` de T31 fechou com 3 arquivos falhando, todos por timeout — não
   por regressão.** `tse-busca-indices`, `auth-hook` e `peso-etapa-seed`
   falharam com `Test timed out in 30000ms`; **zero `AssertionError`** em toda a
   suíte. A execução levou **6454s (107 min)** contra os ~20 min típicos, sob
   latência da Management API com uso concorrente do projeto de dev. Conforme o
   protocolo de coordenação, os 3 arquivos foram rodados **isolados** em vez de
   repetir a suíte: **10/10 verdes**, incluindo os 3 testes exatos que
   estouraram. Nenhum deles toca `vw_estrategia_kpi`. A suíte completa rodou
   **uma única vez**, e o arquivo novo foi validado isolado **antes** dela, para
   não gastar o recurso compartilhado com um erro próprio.

2. **`nr_fatos_geradores` é `NUMERIC`, não `BIGINT`.** `SUM(bigint)` devolve
   `numeric` em Postgres, então a coluna saiu com tipo diferente das outras duas
   contagens (`COUNT` → `bigint`). Corrigir exigiria `DROP` + `CREATE` da view
   numa segunda migration (`CREATE OR REPLACE` não muda tipo de coluna), com o
   risco de perder a ACL recém-configurada. Impacto real avaliado como nulo: o
   tipo gerado em `database.types.ts` é `number | null` nos dois casos e o
   PostgREST serializa ambos como número. Mantido deliberadamente, não por
   omissão.

3. **Um commit a mais que o previsto: `152ba51`, fix de tipo em T32.** A lista de
   colunas do `select` estava numa constante montada por concatenação; o
   supabase-js parseia essa string **em tempo de tipo**, e uma concatenação não é
   literal para o compilador — a inferência degradava para `GenericStringError[]`
   e o cast virava erro de type check. Não apareceu no gate `quick` de T32 porque
   `src/backend/**` só é type-checado quando tem consumidor no frontend
   (`CLAUDE.md`); T33b deu o primeiro, e o erro surgiu no `next build` seguinte.
   Quebra o "um commit por task" de propósito: T32 já estava commitada e
   migrations/histórico são forward-only, então a correção é commit novo.
   **Lição reutilizável**: query nova em `src/backend/queries/` só prova que
   compila quando alguma tela a importa — rodar `next build` logo após a task de
   montagem, não antes.

4. **Rótulos e cores passaram por uma segunda rodada, depois que Pedro conferiu a
   tela.** A primeira versão saiu com os números em `--foreground` (quase preto)
   e rótulos derivados do enunciado de EST-08 AC1, porque o node do Figma não tem
   file key registrada no repositório e `get_variable_defs` devolve `{}` — o
   arquivo **não tem variáveis de design**, então todo mapeamento hex→token é
   manual. Corrigido para `--secondary` (vinho `#571730`) no número e `--primary`
   (teal `#035252`) na barra, sempre por token e nunca por hex cru, conferindo
   contra `globals.css` em vez de transcrever do screenshot. Também entraram a
   barra de progresso do atingimento e a grafia abreviada dos rótulos
   ("IIP — Índ. de impacto", "Atingimento plan.", "Fatos geradores reg."), com
   caixa alta aplicada por CSS e não no texto — rótulo escrito em maiúsculas de
   verdade faz leitor de tela soletrar sigla e perde a acentuação.

5. **A faixa tem 6 KPIs; o Figma mostra 5. Mantidos os 6, por decisão do spec.**
   O node `44:227` não desenha "Mandatos em atraso", mas EST-08 AC1 o nomeia
   explicitamente ("mandatos ativos, IIP, **mandatos em atraso**, NPS das
   imersões, atingimento do planejamento e fatos geradores"). O spec manda no
   conjunto de KPIs e remover o card faria a tela deixar de cumprir uma AC
   aprovada. Confirmado depois que aquele frame está **desatualizado** por outras
   três marcas: mostra "COALIZÃO", a coluna "Rota-X" (typo já corrigido para
   "Diagnóstico", migration `20260910152709`) e a aba "Contratos" (hoje
   "Mandatos", EST-03). O `design.md` referencia `44:5`, não `44:227`.

6. **NPS renderiza só o número: sem a barra segmentada
   (Promotores/Neutros/Detratores) nem o selo "N avaliações" do Figma.** O dado
   não passa por `vw_estrategia_kpi`. Ele **existe** na origem —
   `mv_avaliacao_nps` tem `promotores`, `neutros`, `detratores` e `nr_respostas`
   — e o que falta é agregá-las na view (migration nova, forward-only),
   propagá-las pela query e pelo tipo, e então desenhar a barra. Enquanto isso o
   KPI renderiza `—`, nunca um zero ou uma barra vazia (AD-005). Nota de
   contexto: `mv_avaliacao_nps` tem **0 linhas em dev**, então este KPI seria `—`
   hoje de qualquer forma, e o lado "com valor" do NPS não é exercitável sem
   fixture de submissão de formulário — **spec-precision gap** declarado, não
   lacuna silenciosa.

7. **NPS não é recortável por gestora, e a view diz isso com `NULL`.**
   `mv_avaliacao_nps` agrega por (formulário × projeto × métrica) e não carrega
   `id_contrato`; o vínculo de gestora é por contrato, então ele não sobrevive à
   agregação. Em vez de repetir o número do produto inteiro dentro do recorte de
   uma gestora — que seria um número **errado** exibido como se fosse dela — as
   linhas de `escopo_gestora` devolvem `nps_medio NULL`. Resolver exigiria
   `id_contrato` em `mv_avaliacao_nps`, mudança na Incidência/Formulários fora do
   escopo de EST-08.

8. **Achado para as fases seguintes: o bloco `.dark` de `globals.css` define
   `--secondary` como `oklch(0.269 0 0)` (cinza escuro).** Um número em
   `text-secondary` sobre card escuro ficaria quase ilegível. Sem impacto hoje —
   não há `ThemeProvider` nem toggle de tema no código (os únicos hits de busca
   estão no cache do `.next`), logo `.dark` nunca é aplicado, e o próprio
   `globals.css` documenta que o bloco "permanece intocado (decisão de design)".
   Registrado porque deixa de ser inofensivo no dia em que o tema escuro entrar.
   Nada foi alterado em `globals.css`.

9. **Filtros de gestora/projeto: suportados no banco e na query, sem controle na
   tela.** `vw_estrategia_kpi` emite a linha dos quatro recortes e
   `buscarEstrategiaKpi` já os traduz (EST-08 AC3, coberto por teste unitário),
   mas nenhuma task da Fase 8 desenha a barra de filtros que o Figma mostra acima
   do Quadro — desenhá-la aqui seria scope creep. Ligar os controles é passar
   `idGestora`/`idProjeto` no filtro.

**Achados (não são desvios):**

- **A view agrega por escopo em vez de por produto, e isso foi escolha forçada
  por AD-003.** O caminho óbvio — view no grão de contrato, agregada no
  TypeScript — faria a média de IIP e a de atingimento existirem dentro de um
  componente React, que é literalmente a "agregação inventada pela tela" que a AD
  proíbe. Os escopos são colunas **booleanas** e não o `NULL` de um `ROLLUP`/
  `CUBE` porque em `id_projeto` o `NULL` já significa "contrato sem projeto":
  reaproveitá-lo para "todos os projetos" tornaria os dois casos indistinguíveis
  do lado do PostgREST.
- **A distinção entre contagem-zero e média-nula é visível no próprio banco de
  dev, sem fixture**: a linha de total do produto Estratégia tem
  `nr_fatos_geradores = 1` e `iip_medio = NULL` ao mesmo tempo (o único fato
  gerador existente não tem níveis d1/d2/d3 lançados). É o par que AD-005 exige
  distinguir, ocorrendo naturalmente.
- **`mentor` e `assessor` ficaram fora do GRANT por necessidade, não por
  preferência.** Eles já não leem `vw_pendencias` nem `mv_avaliacao_nps`; com
  `security_invoker`, conceder a view sem conceder as fontes trocaria "o número
  não aparece" por erro `42501` no meio da agregação.
- **`lint:frontend` caiu de 30 para 29 problemas pré-existentes** (a redução veio
  de fora desta fase); nenhum dos 29 está em arquivo que a Fase 8 tocou.

---

### Fase 6 — ✅ COMPLETO (2026-09-11)

| Task | Commit | Gate | Resultado |
| :-- | :-- | :-- | :-- |
| — alargamento do contêiner do produto (T13, ver desvio 1) | `3d7a8d6` | quick | unit **595/595** |
| T22 Busca TSE do Novo Contrato | `f796c23` | quick | unit **63 arquivos, 595/595** · eslint 0 erros nos arquivos da task |
| T23 Formulário em 4 seções | `88506fe` | build | unit **64 arquivos, 603/603** · eslint 0 erros · build 0 erros |
| T24 Submissão transacional + bug de produção | `a23531c` | build | unit **64 arquivos, 621/621** · eslint 0 erros · build 0 erros |

Fase de **tela de escrita**: AD-042 integral, sem o corte de AD-046. Os dois
lados de cada condicional, estado vazio e estado de erro estão cobertos em
`tse-match-search.test.tsx` (10 casos), `mandato-wizard.test.tsx` (16) e
`errors.test.ts` (19, sendo 10 novos).

**Desvios registrados:**

1. **`produto-shell.tsx` saiu em commit próprio, antes da T22, e levou junto
   `novo-contrato/page.tsx`.** O alargamento do contêiner (`max-w-6xl` →
   `w-full max-w-[1800px]`) é da T13, não desta fase: o Quadro de
   Acompanhamento tem colunas de largura fixa e mostrava 3,5 delas, cortando a
   4ª na borda — confirmado no screenshot do Pedro, coluna "Governança"
   cortada. As 4 abas foram conferidas uma a uma; a única que regredia era
   Novo Contrato, porque formulário em 1800px fica ilegível. O wrapper
   `max-w-6xl` que a aba passou a aplicar entrou **no mesmo commit**, e não na
   T22, porque não implementa nenhum critério de EST-10/EST-11 — é a
   compensação inseparável da mudança de layout, e separá-la deixaria um
   commit que quebra uma tela.

2. **Retomada depois de interrupção: o trabalho não commitado foi auditado,
   não herdado.** Um worker anterior parou no meio e deixou
   `tse-match-search.tsx` modificado e um `.test.tsx` novo (5 casos). A
   auditoria confirmou o que estava certo — a extração de `useBuscaTse`, com
   o achado empírico de que o `<Popover>` impede o timer do debounce de
   disparar em jsdom, e a correção do `w-full` que cortava UF e Ano — e achou
   **uma lacuna real**: nenhum teste asseria que o `ErroInline` de AC8
   *renderiza*, só que o estado `erro` era preenchido; o estado vazio também
   não tinha asserção de DOM. Verifiquei que `<Command>` sozinho (sem o
   Popover em volta) monta normalmente em jsdom, extraí `ResultadosBuscaTse`
   e cobri os 4 estados da lista no DOM de verdade. A `.test.tsx` foi de 5
   para 10 casos.

3. **Bug de produção (parte da T24): a coalizão era enviada com a chave
   errada.** O `<Select>` "Coalizão existente" lia `dim_contratante` e usava
   `id_contratante` como valor; esse número ia para `coalizao.id_coalizao`,
   que `app.criar_mandato` grava em `rel_coalizao_membro.id_coalizao` —
   coluna com FK para `dim_coalizao(id_coalizao)`, uma chave surrogate
   diferente. "bancada do clima" é `id_contratante` 447 e `id_coalizao` 104,
   então o insert estourava `23503`. Confirmado em dev que **nenhum** dos 12
   `id_contratante` de coalizão coincide com um `id_coalizao` existente: toda
   seleção de coalizão falhava, sempre. Corrigido lendo `dim_coalizao` com
   join para o nome.

4. **O encobrimento do erro era um defeito próprio, e foi corrigido junto.**
   `mapeiaErroRpc` terminava em `return error`, devolvendo o objeto do
   PostgREST cru. O `.d.ts` declara `class PostgrestError extends Error`, mas
   em runtime (postgrest-js 2.111.0, `dist/index.mjs:419`) o objeto vem de
   `JSON.parse(body)` — `new PostgrestError` só é construído sob
   `shouldThrowOnError`. Verificado contra o banco de dev:
   `error instanceof Error === false`, `constructor.name === "Object"`. Por
   isso o `e instanceof Error ? e.message : "<genérico>"` do wizard caía
   sempre no genérico. Agora 23503 vira `ViolacaoChaveEstrangeiraError` e
   todo o resto vira `ErroBancoNaoMapeadoError`, com SQLSTATE e mensagem do
   banco; `details` e `hint` ficam fora de propósito, porque carregam valores
   da linha recusada. AD-005 no espírito: erro explícito, nunca mensagem que
   finge saber a causa.

5. **Por que o bug escapou dos testes existentes.** Os wrappers RPC eram
   testados com dublês que devolviam `{ code, message }` — fiéis ao formato
   do PostgREST, e por isso a diferença de *tipo* nunca aparecia: nenhum
   teste levava o erro até a camada que consulta `instanceof`. E nenhum teste
   de componente cobria a submissão do wizard. O bug vivia exatamente no vão
   entre as duas suítes. Pior: 10 testes afirmavam "código não mapeado é
   relançado **sem alteração**" com `toEqual` contra o objeto cru, ou seja,
   **documentavam o defeito como se fosse o contrato desejado** — e um deles
   se chamava "nunca engolido em silêncio", descrevendo a intenção oposta ao
   que o código fazia. Foram reescritos para o contrato novo e mais forte
   (instanceof Error, código e mensagem preservados), não afrouxados.

6. **L-005 estava registrada apontando para este arquivo e nunca fora
   aplicada.** A lição cita `mandato-wizard.tsx:56-60,30-51`, e os blocos
   `contrato` e `coalizao` seguiam declarados inline lá. T23 moveu os dois
   para `src/backend/schemas/` (`aberturaContratoSchema`,
   `vinculoCoalizaoSchema`). De quebra, a versão compartilhada passou a
   espelhar `ck_membro_grupo` como a equivalência que ela é — a cópia inline
   só validava um dos lados.

7. **AC3 cobria só 1 dos 6 campos antes desta fase.** A tela dizia "Nome, UF,
   município, título, cargo e partido vieram do TSE — somente leitura", mas
   apenas o título eleitoral estava travado. Os `<Input>` usam `readOnly` (e
   não `disabled`) para continuarem focalizáveis e copiáveis; cargo e partido
   são `<Select>` do Radix, que não tem `readOnly`, então usam `disabled`.

8. **Sensor de discriminação rodado à mão na T23.** Fixar
   `vindoDoTse = false` mata o caso de AC3, confirmando que o teste observa o
   comportamento e não a implementação. Mutação descartada em seguida.

9. **`lint:all` caiu de 29 para 25 problemas.** Os 3 erros pré-existentes dos
   arquivos tocados (`any` em `ContratanteFieldsProps` e em `ZonaEyebrow`,
   `catch(e)` sem uso) foram zerados. Sobra, em `mandato-wizard.tsx`, um
   aviso do React Compiler sobre `form.watch()` — inerente ao
   react-hook-form, não removível sem trocar a API. Nenhum dos 25 restantes
   está em arquivo desta fase.

10. **Nenhuma migration nesta fase**, portanto a suíte de integração não foi
    executada. O diagnóstico do bug foi feito com leituras somente-leitura
    contra dev (e a inspeção do runtime do postgrest-js), sem DML. O SQL de
    confirmação com `BEGIN … ROLLBACK` ficou preparado para o Pedro rodar,
    mas a causa já estava provada por duas evidências independentes — o
    catálogo de dev e a leitura da própria função.

---

### Fase 7 — ✅ COMPLETO (2026-09-12)

| Task | Commit | Gate | Resultado |
| :-- | :-- | :-- | :-- |
| T25 `queries/agenda.ts` | `0356335` | quick | unit **65 arquivos, 635/635** |
| T26 `AgendaMes` | `12a214a` | quick | unit **66 arquivos, 650/650** · lint limpo no arquivo novo |
| T27 `queries/registros-agenda.ts` | `ac6a45d` | quick | unit **67 arquivos, 659/659** |
| T28 `EncontroPopover` | `6ca81ea` | quick | unit **68 arquivos, 673/673** · `encontros-lista.tsx` sem lint |
| T29 RPC `marcar_presenca` | `8f2eaf4` | *reduzido* | integração própria 6/6 · unit 678/678 · build 0 (ver desvio 1) |
| T30 Presença e registro no popover | `e2f0b05` | build | lint raiz 0 · unit **69 arquivos, 692/692** · build 0 erros |
| T30b Montagem da página `/produtos/[slug]/agenda` | *(este commit)* | build | lint 0 nos arquivos tocados · unit **70 arquivos, 717/717** · build 0 erros · sensor 3/3 mutações mortas |

**Migration aplicada em dev** (`npnvoolkebhabjkjzqwn`, project-ref conferido
imediatamente antes do `db push`): `20260912023810_estrategia_fn_marcar_presenca`.
`database.types.ts` regenerado no mesmo commit da T29 — separar deixaria um
commit que não type-checa.

**Desvios registrados:**

1. **Gate reduzido em T29, autorizado por Pedro.** `tasks.md` declarava `full`.
   A suíte de integração completa passou de **1h16 sem emitir saída** — mesmo
   modo de latência da Management API que a Fase 8 registrou em 107 min, com o
   projeto cloud de dev compartilhado. Evidência aceita no lugar: teste de
   integração próprio isolado **6/6 verdes** (SECURITY INVOKER, AC4, auditoria,
   idempotência dos dois lados, 42501), unit 678/678, build 0. A função é nova
   e nenhum outro objeto a consome, então não pode regredir comportamento
   existente — mesmo racional de concentração de gate usado em T2/T4.

   **Desfecho (2026-09-12 01:45).** A suíte terminou sozinha depois de **7083s
   (118 min)**: **490/494**, 67 de 69 arquivos verdes, **0 `AssertionError` em
   toda a execução**. As 4 falhas são `Test timed out` puro — 1 no próprio
   `fn-marcar-presenca` (o teste da AC4, verde 6/6 isolado às 23:43) e 3 em
   `fn-marcar-vigente`, o mesmo arquivo que o desvio 3 do Batch 1 já havia
   documentado como falso-positivo sob contenção da Management API. O gate
   completo não produziu nenhuma informação em nível de asserção que os
   isolados já não tivessem dado — a redução autorizada está confirmada por
   dados, não por argumento.

2. **O teste de auditoria da T29 provou não ser tautológico.** Falhou na
   primeira execução esperando 1 linha e encontrando 2: a segunda era o
   `insert` da própria fixture. A consulta foi corrigida para `acao='update'`,
   que é o que AC4 exige auditar — asserção ficou mais precisa, não mais frouxa.

3. **T27 exportou `resolverIdsContratoDoFiltro` de `agenda.ts`, fora do seu
   "Where".** Uma palavra, sem mudança de comportamento. A alternativa era
   clonar ~30 linhas com o mesmo tipo `FiltroAgenda` — a duplicata equivalente
   que deriva em silêncio da lição L-005. Diferente do precedente
   `pendencias.ts` vs `visao-gerencial.ts`, onde os tipos de filtro eram
   distintos e o clone se justificou.

4. **O `<Popover>` do Radix é inviável neste harness jsdom.** Medido: UM render
   aberto custa ~50s (12s de teste + ~38s de teardown pendurado) contra 2,5s
   dos 8 testes de conteúdo juntos — levaria a suíte de 22s para 54s. O
   conteúdo foi separado em `ConteudoEncontro` e o primitivo é stubado no teste
   de composição, que segue asserindo a fiação da feature. É o mesmo obstáculo
   que a Fase 6 já havia encontrado em `tse-match-search.tsx`.

5. **SPEC-PRECISION GAPS abertos nesta fase** (nenhum silencioso):
   - **Fuso horário.** `dt_prevista_inicio` é TIMESTAMPTZ e o spec pede "dia
     correto" (EST-12 AC1) sem nomear fuso; o projeto não tinha convenção.
     Escolhido `-03:00` numa constante única (`FUSO_HORARIO_PRODUTO`),
     congelada por teste. Um encontro às 21h de 30/09 cairia em outubro se
     lido em UTC.
   - **Status fora de AC2.** EST-12 AC2 nomeia só Agendada/Realizada, mas
     `ck_encontro_status` permite 4. `cancelado`/`remarcado` recebem rótulo
     próprio e cor neutra em vez de sumirem da grade.
   - **Encontro cancelado + marcar presença.** EST-13 não define o caso;
     `app.marcar_presenca` não inventa regra e transiciona como qualquer
     não-realizado. Registrado no `COMMENT ON FUNCTION`.

6. **`encontro-form.tsx` sai com 0 erros, não "limpo".** Resta o warning 45:18
   do React Compiler sobre `form.watch()`, inerente ao react-hook-form e não
   corrigível sem trocar a biblioteca — mesma linha que a Fase 6 aceitou em
   `mandato-wizard.tsx` 152:31. Total do frontend: 25 → 24 problemas, 11 → 10
   erros.

**Achados para quem seguir:**
- **A Fase 7 não tem task de montagem de página.** F4, F5 e F8 ganharam
  T18b/T21b/T33b exatamente para isso; a rota `/produtos/[slug]/agenda` segue
  como `EmDesenvolvimento`. Do jeito que o plano está, F7 entrega componentes
  que nada renderiza. **Fechado pela T30b** — ver desvios 7 a 11.
- **`RegistroForm` exige `idEtapa`**, que `EncontroAgenda` não carrega. A T30
  entrega o payload que AC6 nomeia (`idEncontro` + `idContrato`); quem montar
  a tela precisa resolver a etapa. **Confirmado na T30b e não resolvido lá** —
  ver desvio 10.

---

#### Desvios da T30b (montagem da página)

7. **Dois arquivos fora do "Where" da task, ambos mínimos.**
   - `page.test.tsx` (novo): a task declarava só `page.tsx`, mas AD-042 exige
     teste de render para AC de interface, e AD-046 mantém profundidade
     **integral** aqui porque a tela grava. É o primeiro `.test.tsx` de página
     do projeto — `vitest.config.ts` já o coleta (`src/frontend/**/*.test.tsx`),
     inclusive dentro do segmento `[slug]`, verificado na execução.
   - `agenda-mes.tsx` (+12 linhas): `hojeNoFusoDoProduto(agora: Date)`
     exportada ao lado de `diaNoFusoDoProduto`/`horaNoFusoDoProduto`. A página
     precisa de "hoje" no fuso do produto, e o comentário da própria T26 diz
     que a aritmética de offset vive nesse arquivo justamente para não ser
     reimplementada por consumidor (lição L-005). Duplicar a regex de offset na
     página seria a duplicata que deriva em silêncio. O instante entra por
     parâmetro — a função não lê o relógio (L-002).

8. **O popover não ancora na célula do encontro.** `AgendaMes` entrega o
   encontro clicado (`onSelecionarEncontro`), não o elemento DOM dele, e
   envolver o calendário inteiro num `PopoverTrigger` faria cada clique numa
   célula alternar o popover pelo toggle do Radix
   (`@radix-ui/react-popover/dist/index.mjs:96`). O gatilho é um âncora
   `sr-only` logo abaixo da grade: EST-12 AC4 ("abre o popover de detalhe") é
   cumprida, e nenhuma AC define a posição. Ancorar na célula exigiria mudar o
   contrato de `AgendaMes`, fora desta task.

9. **A lista "Registros de Agenda" nasceu aqui, dentro da página.** O Verifier
   da Fase 7 registrou que ela não existia em lugar nenhum ("não existe
   componente de lista de Registros da Agenda"), e é ela que fecha EST-12 AC5
   (filtro ativo removível) e o edge case do spec (mês sem encontro →
   "estado explicativo na lista"). Ficou como função local em vez de componente
   próprio em `components/estrategia/` para respeitar o "Where"; se uma segunda
   tela precisar dela, extrair é o movimento seguinte.

10. **EST-13 AC6 fica PARCIAL — spec-precision gap, declarado, não silencioso.**
    A AC pede "abrir a criação de registro **já vinculada** àquele encontro e
    contrato". O payload existe e é testado desde a T30, mas nenhuma tela de
    destino aceita o vínculo: `RegistroForm` exige `idEtapa`, `EncontroAgenda`
    não carrega etapa (só `nomeEtapa`), e a rota que hospeda o formulário é
    `/contratos/[id]/etapas/[codigo]`, que precisa do **código** da etapa.
    Implementado o máximo honesto: "Adicionar registro" navega para
    `/contratos/{idContrato}/encontros`, o mesmo destino que a T28 já escolheu
    para o link de registros vinculados. Fechar a AC de verdade pede uma task
    própria: expor a etapa em `EncontroAgenda` (T25) **e** fazer o formulário
    aceitar encontro pré-selecionado.

11. **`use(params)` prende a árvore no Suspense dentro do harness jsdom.** O
    render do Testing Library termina antes de o React retomar o trabalho
    suspenso, e a página fica no fallback para sempre — 23 de 25 testes
    falharam assim na primeira execução. Resolvido entregando `params` no
    formato que o React trata como já resolvido (`status`/`value` do protocolo
    de thenable), que é o mesmo formato em que o Next.js entrega `params`
    resolvidos em runtime: `use` lê o valor direto, sem suspender. **A página
    não muda por isso** — segue recebendo uma `Promise` e chamando `use`. Vale
    para qualquer teste de página futura deste App Router.

**Sensor de discriminação da T30b** (estado descartável, backup no scratchpad,
restauração conferida por `git status` após cada mutação): 3 mutações, 3 mortas.
Remover o filtro `idEncontro` da consulta de registros → 1 falha; remover a
invalidação da grade após marcar presença → 1 falha dirigida ("depois da
escrita o encontro aparece como Realizada"); trocar a tradução do erro por
texto genérico → 2 falhas, incluindo a do objeto cru do PostgREST.

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
T25 → T26 → T27 → T28 → T29 → T30 → T30b
```

### Fase 8: KPIs do Dashboard
```
T31 → T32 → T33 → T33b
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
- [x] `npm run test:unit` coleta e executa `.test.tsx` (EST-01 AC1)
- [x] O smoke test renderiza via `@testing-library/react` em `jsdom` (EST-01 AC2)
- [x] Remover o texto renderizado de `estado-vazio.tsx` faz o teste falhar (EST-01 AC3) — verificado manualmente e desfeito
- [x] `.test.ts` existentes continuam em `node`; contagem de testes anterior preservada
- [x] Gate: `npm run lint && npm run test:unit && npm run build`

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
- [x] Tabela criada com `CHECK (dias > 0)` e `codigo` UNIQUE
- [x] Seed: `formulario_aberto=30`, `sem_registro_recente=45`, `etapa_atencao`, `etapa_atrasado`
- [x] GRANT SELECT para `authenticated` + as 5 roles `legisla_*`; `anon` sem SELECT (AD-030)
- [x] Teste de integração assere estrutura, seed e uma linha por role × privilégio
- [x] Gate: `npm run test:unit && npm run test:integration`

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
- [x] Nenhum literal `INTERVAL '<n> days'` permanece no corpo da view (AD-004)
- [x] As 6 categorias continuam retornando as mesmas linhas com o seed padrão (não-regressão)
- [x] Alterar `ref_limiar_pendencia.dias` muda o resultado da view sem deploy (EST-06 / edge case)
- [x] `security_invoker = true` preservado
- [x] Gate: `npm run test:unit && npm run test:integration`

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
- [x] `SELECT nome FROM ref_etapa WHERE codigo='raio_x'` retorna "Diagnóstico" nos 2 produtos (EST-14 AC1, AC4)
- [x] `codigo` inalterado; contagem de `ref_tipo_registro`, `ref_formulario` e `fat_etapa_contrato` por etapa idêntica à de antes (EST-14 AC2)
- [x] Migration é idempotente sob `supabase db reset` (roda do zero no CI)
- [x] `docs/schema_sistema.sql` (bloco de seed de `ref_etapa`, ~linha 2234) passa a dizer "Diagnóstico" — o modelo aprovado não pode divergir do banco (AD-008)
- [x] Gate: `npm run test:unit && npm run test:integration`

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
- [x] A tabela distingue as duas bases de limiar (dias absolutos × percentual da duração da etapa), sem coluna ambígua
- [x] `etapa_atencao = 70`, `etapa_atrasado = 100`, ambos expressos como percentual
- [x] `formulario_aberto = 30` e `sem_registro_recente = 45` seguem em dias absolutos e a `vw_pendencias` da T3 continua verde (não-regressão)
- [x] Nenhum percentual e nenhuma duração fica escrita em código (AD-004)
- [x] `docs/schema_sistema.sql` reflete a forma final da tabela (AD-008)
- [x] Gate: `npm run test:unit && npm run test:integration`

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
- [x] Tabela criada **sem** `id_contrato`, com os 3 CHECKs do design
- [x] `uq_prospeccao_aberta_contratante` recusa a 2ª prospecção aberta do mesmo contratante+produto (EST-04 edge case)
- [x] `trg_audit_fat_prospeccao` grava em `log_auditoria` no INSERT e no UPDATE (EST-04 AC2 / AD-006)
- [x] `docs/schema_sistema.sql` recebe a tabela com comentário referenciando AD-040 (AD-008)
- [x] Gate: `npm run test:unit && npm run test:integration`

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
- [x] RLS habilitada; leitura permitida a Gestora/Admin e ao `id_usuario_resp`; negada às demais (EST-04 AC6)
- [x] Escrita restrita às roles que podem criar contrato; `anon` sem nenhum privilégio (AD-002)
- [x] Teste com sessão JWT real por papel, não só `has_table_privilege`
- [x] Gate: `npm run test:unit && npm run test:integration`

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
- [x] `SECURITY INVOKER` explícito; `SECURITY DEFINER` ausente (AD-024)
- [x] Caminho feliz: cria contrato, seta `status='convertida'`, `id_contrato_gerado` e `dt_desfecho` (EST-04 AC3)
- [x] Segunda conversão da mesma prospecção falha com erro tipado, sem criar contrato (EST-04 AC4)
- [x] Falha no meio não deixa contrato órfão — asserido com rollback forçado
- [x] Gate: `npm run test:unit && npm run test:integration`

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
- [x] Retorna só `status='aberta'` do produto pedido
- [x] Produto sem prospecção retorna `[]`, nunca lança (padrão de `buscarBoardKanban`)
- [x] Erro do PostgREST propaga como `throw` (padrão do projeto)
- [x] Gate: `npm run test:unit`

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
- [x] Cada parâmetro é repassado verbatim à RPC e asserido individualmente (lição L-004)
- [x] Cada erro tipado da T7 mapeia para mensagem própria, uma asserção por erro (lição L-003)
- [x] Gate: `npm run test:unit`

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
- [x] Topbar renderiza marca, "Hub" e avatar (EST-05 AC1)
- [x] Topbar **não** renderiza "Gestão de Usuários" — asserção negativa explícita (EST-05 AC2)
- [x] `npm run lint:frontend` limpo neste arquivo
- [x] Gate: `npm run test:unit`

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
- [x] Ordem fixa: Estratégia, PLL, Coalizão, Visão Gerencial, Números de Impacto, Gestão de Usuários (EST-02 AC6)
- [x] Consulta negada por permissão → card omitido; erro de outra natureza → propaga (EST-02 AC2, AC7)
- [x] `tipo: 'produto' | 'ferramenta'` correto por card
- [x] Contagens de mandatos ativos e fatos geradores vêm da consulta, nunca fixas (EST-02 AC3, AC4)
- [x] Gate: `npm run test:unit`

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
- [x] Renderiza um card por item retornado, na ordem recebida (EST-02 AC1, AC6)
- [x] Card exibe badge de contador quando presente e o omite quando ausente — caso de teste dos dois lados
- [x] Subtítulo revisto: não diz mais "Escolha um produto" (risco registrado no design)
- [x] Clique navega para a rota do destino (EST-02 AC5)
- [x] `lint:frontend` limpo nos arquivos tocados
- [x] Gate: `npm run test:unit`

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
- [x] As 4 abas renderizam com "Mandatos" no lugar de "Contratos" (EST-03 AC1)
- [x] Aba ativa marcada e as demais não — teste dos dois lados (EST-03 AC2)
- [x] "Voltar ao hub" navega para `/` (EST-03 AC3)
- [x] Slug inválido retorna 404 (EST-03 AC4)
- [x] Gate: `npm run test:unit`

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
- [x] Um caso de teste **de cada lado** de cada limiar, incluindo o valor exato de fronteira (lição L-001)
- [x] Limiar ausente ou nulo devolve `normal`, nunca lança
- [x] Nenhum número mágico no arquivo — limiares chegam por parâmetro (AD-004)
- [x] Gate: `npm run test:unit`

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
- [x] Raia de Prospecção vem primeiro; demais colunas por `ref_etapa.ordem` (EST-07 AC1)
- [x] Para a Estratégia com o seed atual retorna **7 colunas** (EST-07 AC1)
- [x] Etapa sem contrato retorna coluna vazia com contador 0 (edge case)
- [x] Contrato sem `id_etapa_atual` cai em coluna "Sem etapa", nunca some (edge case)
- [x] Adicionar linha em `ref_etapa` muda a contagem de colunas sem tocar em código (EST-07 AC1b)
- [x] Gate: `npm run test:unit`

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
- [x] Card exibe contratante, cargo/partido e dias na etapa (EST-07 AC2)
- [x] Badge reflete o estado do limiar — um caso de teste por estado (EST-07 AC3)
- [x] Card da raia de Prospecção não é arrastável para coluna de etapa (AD-040)
- [x] Estado vazio por coluna renderiza, não some
- [x] `lint:frontend` limpo
- [x] Gate: `npm run test:unit`

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
- [x] Retorna as 5 categorias com mandato, tipo, detalhe e data de referência (EST-07 AC4)
- [x] Sem pendências retorna `[]` (EST-07 AC6)
- [x] Filtros de gestora e projeto aplicam AND, não OR
- [x] Gate: `npm run test:unit`

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
- [x] Uma linha por pendência, com badge por tipo (EST-07 AC4)
- [x] Clique navega para o contrato correspondente (EST-07 AC5)
- [x] Lista vazia renderiza `EstadoVazio`, não tabela vazia (EST-07 AC6)
- [x] Gate: `npm run test:unit`

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
- [x] Cada filtro (data, gestora, projeto, etapa, status) restringe isoladamente (EST-09 AC3)
- [x] Dois filtros juntos aplicam AND
- [x] Prospecções **não** aparecem (EST-04 AC5)
- [x] Contagem total acompanha o filtro (EST-09 AC2)
- [x] Gate: `npm run test:unit`

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
- [x] Card exibe contratante, vigência, status, gestora, projeto, etapa e responsável (EST-09 AC1)
- [x] `dt_fim` nula renderiza "—" (EST-09 AC5 / AD-005)
- [x] Status traduz `ativo|concluido|nao_concluido` para Ativo|Finalizado|Desligado — um caso por status
- [x] Lista vazia renderiza estado vazio explicativo (EST-09 AC6)
- [x] Gate: `npm run test:unit`

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
- [x] Cada filtro altera a consulta e a contagem exibida (EST-09 AC2, AC3)
- [x] "Limpar filtros" devolve todos ao estado inicial (EST-09 AC4)
- [x] Gate: `npm run test:unit`

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
- [x] `/produtos/estrategia/mandatos` renderiza a barra de filtros + a grade de cards, não a lista antiga
- [x] Mudar um filtro refaz a consulta e atualiza a contagem exibida (EST-09 AC2/AC3, ponta a ponta)
- [x] "Limpar filtros" devolve a lista completa (EST-09 AC4)
- [x] `lint:frontend` limpo
- [x] Gate: `npm run test:unit`

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
- [x] Menos de 3 letras não dispara busca; 3 ou mais dispara — teste dos dois lados (EST-10 AC1, AC2)
- [x] Falha da busca renderiza `ErroInline` e mantém "Cadastro manual" acessível (EST-10 AC8)
- [x] `lint:frontend` limpo em `tse-match-search.tsx` (2 problemas atuais resolvidos)
- [x] Gate: `npm run test:unit`

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
- [x] As 4 seções do Figma renderizam com os campos do design
- [x] Campos vindos do TSE são `readOnly`; no modo manual são editáveis — teste dos dois lados (EST-10 AC3, AC4)
- [x] "Cancelar e buscar novamente" desfaz o vínculo e reabre a busca (EST-10 AC5)
- [x] Schema Zod **importado**, não redeclarado inline (lição L-005)
- [x] `lint:frontend` limpo nos arquivos tocados
- [x] Gate: `npm run test:unit`

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
- [x] Submissão chama a RPC única; nunca dois inserts sequenciais (EST-11 AC6 / AD-024)
- [x] Título duplicado exibe mensagem específica e preserva o formulário (EST-11 AC7)
- [x] Erro propaga por `ErroInline`, o componente padrão (lição L-008)
- [x] Gate: `npm run test:unit`

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
- [x] Retorna só encontros dentro do intervalo do mês pedido — teste de fronteira nos dois extremos (lição L-001)
- [x] Mês sem encontros retorna `[]`, nunca lança (EST-12 / edge case)
- [x] Filtros de gestora, projeto e contrato aplicam AND
- [x] Gate: `npm run test:unit`

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
- [x] Encontro aparece na célula do dia correto (EST-12 AC1)
- [x] Cor reflete o status Agendada/Realizada — um caso por status (EST-12 AC2)
- [x] Navegar de mês recarrega os encontros (EST-12 AC3)
- [x] Célula de hoje destacada; caso de teste com hoje dentro e fora do mês exibido (EST-12 AC6, lição L-002 — data de referência explícita, nunca `now()` implícito)
- [x] Mês vazio renderiza a grade completa (edge case)
- [x] Gate: `npm run test:unit`

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
- [x] Sem filtro retorna todos do recorte; com `idEncontro` retorna só os dele (EST-12 AC5)
- [x] Retorna tipo, data, descrição e responsável
- [x] Gate: `npm run test:unit`

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
- [x] Exibe status, etapa, tipo, data/horário, modalidade, local, tema e participantes (EST-13 AC1)
- [x] Contagem de registros vinculados e link aparecem quando há registros e somem quando não há — teste dos dois lados (EST-13 AC2)
- [x] Campo nulo renderiza ausência, nunca string vazia (AD-005)
- [x] `lint:frontend` limpo em `encontros-lista.tsx`
- [x] Gate: `npm run test:unit`

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
- [x] `SECURITY INVOKER` (AD-024); grava `status='realizado'` e `dt_realizada` (EST-13 AC4)
- [x] Autor e timestamp registrados em `log_auditoria` (AD-006)
- [x] Chamada em encontro já realizado é idempotente — não duplica transição (EST-13 AC5)
- [x] Wrapper assere cada parâmetro repassado (lição L-004)
- [x] Gate: `npm run test:unit && npm run test:integration`

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
- [x] Aviso e ação aparecem só quando a data passou e o status é `planejado` — teste dos dois lados (EST-13 AC3)
- [x] Marcar presença atualiza o status na grade (EST-13 AC4)
- [ ] "Adicionar registro" abre a criação já vinculada ao encontro e contrato (EST-13 AC6)
- [x] `lint:frontend` limpo em `encontro-form.tsx`
- [x] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(agenda): marcar presenca e adicionar registro no popover (EST-13)`

---

### T30b: Montagem da página `/produtos/[slug]/agenda`

> **Quarta ocorrência do mesmo padrão, e a que mais incomoda.** T18b, T21b e T33b foram criadas
> hoje justamente para fechar essa lacuna — mas só nas fases que o orquestrador tinha em mãos. A
> Fase 7 rodou em sessão paralela, com um plano que nunca recebeu a task equivalente, e o resultado
> foi idêntico: T25-T30 entregaram queries, RPC e componentes testados, e `agenda/page.tsx` seguiu
> servindo o placeholder `<EmDesenvolvimento titulo="Agenda em desenvolvimento" />` de `13d72f2`.
> Pedro encontrou abrindo a aba. **Lição: quando um padrão de lacuna é identificado, a varredura
> tem que cobrir todas as fases abertas, não só as da frente.**

**What**: Reescrever `produtos/[slug]/agenda/page.tsx` para renderizar a grade mensal com o popover
de encontro, orquestrando `buscarEncontrosDoMes` (T25), `buscarRegistrosDaAgenda` (T27) e
`marcarPresenca` (T29), com o estado de mês e de encontro selecionado.
**Where**: `src/frontend/app/(app)/produtos/[slug]/agenda/page.tsx`
**Depends on**: T25, T26, T27, T28, T29, T30
**Reuses**: `AgendaMes`, `EncontroPopover`, `buscarEncontrosDoMes`, `buscarRegistrosDaAgenda`,
`marcarPresenca`, o padrão de orquestração já montado em T18b (`dashboard/page.tsx`)
**Requirement**: EST-12, EST-13

**Tools**: MCP: `Figma` (T5 `163:4` Agenda, T7 `90:206` popover) · Skill: `ui-ux-pro-max`

**Profundidade de teste**: o popover **grava** (`marcarPresenca`, adicionar registro). AD-046 **não**
se aplica a essa parte — vale AD-042 integral.

**Done when**:
- [x] `/produtos/estrategia/agenda` renderiza a grade mensal com encontros reais, não o placeholder
- [x] Navegar de mês refaz a consulta e atualiza a grade (EST-12)
- [x] Clicar num encontro abre o popover com os registros daquele encontro (EST-13)
- [x] Marcar presença chama a RPC e reflete na tela; erro aparece traduzido, nunca silencioso
- [x] `hoje` é passado explicitamente, nunca lido do relógio dentro do componente (L-002)
- [x] Mês sem encontro renderiza estado vazio explícito, nunca grade em branco sem explicação
- [x] `lint:frontend` limpo — 0 problemas nos arquivos tocados; os 24 restantes são a baseline pré-existente, em arquivos que esta task não toca
- [x] Gate: `npm run lint && npm run test:unit && npm run build`

**Tests**: unit · **Gate**: build
**Commit**: `feat(agenda): monta pagina da Agenda com grade e popover (EST-12/EST-13)`

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
- [x] Os 6 KPIs saem da view, nenhum calculado fora dela (AD-003)
- [x] View só lê e agrega; não recalcula o IIP (AD-014, AD-015)
- [x] Sem dado suficiente devolve `NULL`, nunca `0` (AD-005 / EST-08 AC2)
- [x] `security_invoker = true`; grants coerentes com os `REVOKE` existentes
- [x] Gate: `npm run test:unit && npm run test:integration`

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
- [x] Filtros recalculam o recorte (EST-08 AC3)
- [x] `NULL` do banco chega como ausência, não como `0` (EST-08 AC2)
- [x] Gate: `npm run test:unit`

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
- [x] Os 6 KPIs renderizam com os rótulos do Figma (EST-08 AC1)
- [x] Ausência renderiza "—" e presença renderiza o número — teste dos dois lados (EST-08 AC2)
- [x] `lint:frontend` limpo
- [x] Gate: `npm run lint && npm run test:unit && npm run build`

**Tests**: unit · **Gate**: build
**Commit**: `feat(estrategia): faixa de KPIs do dashboard (EST-08)`

---

### T33b: Montagem da faixa de KPIs no Dashboard

> **Lacuna prevenida, não corrigida.** T18b e T21b nasceram de um erro já cometido: componente
> pronto e testado, nunca ligado à página. Aqui o mesmo padrão foi identificado **antes** de a
> fase rodar — T33 constrói `KpiRow` mas nenhuma task o ligava a `dashboard/page.tsx`.

**What**: Inserir `KpiRow` no topo da página do Dashboard, acima do `QuadroAcompanhamento`,
consumindo `buscarEstrategiaKpi` (T32). Conferir a posição contra o Figma `44:5`, onde a faixa de
KPIs aparece acima do quadro.
**Where**: `src/frontend/app/(app)/produtos/[slug]/dashboard/page.tsx`
**Depends on**: T31, T32, T33
**Reuses**: `KpiRow`, `buscarEstrategiaKpi`, a orquestração já montada por T18b
**Requirement**: EST-08

**Tools**: MCP: `Figma` (T3 `44:5`) · Skill: `ui-ux-pro-max`

**Done when**:
- [x] `/produtos/estrategia/dashboard` renderiza a faixa de KPIs acima do Quadro, com números reais
- [x] A orquestração de T18b (Quadro + Pendências + limiares) segue intacta — nenhuma regressão
- [x] KPI ausente renderiza "—", nunca zero inventado (AD-005)
- [x] `lint:frontend` limpo
- [x] Gate: `npm run lint && npm run test:unit && npm run build`

**Tests**: unit · **Gate**: build
**Commit**: `feat(estrategia): monta faixa de KPIs no Dashboard (EST-08)`

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

---

### Ajuste de fidelidade visual — Mandatos (2026-09-14)

Pedro reportou: "está bem feio também. Os filtros estão tortos e não é a
mesma tela que está no Figma." Escopo: `produtos/[slug]/mandatos` (T19/T20/
T21/T21b). Seguido o protocolo `figma-design-to-code` (G1: `get_design_context`
no node 202:554, arquivo `eS5CdQrl6yUdYctZwlDzps`, chamado antes de qualquer
código).

**O que mudou**

- `filtros-mandatos.tsx`: grid 2×4 com `<Label>` empilhado → barra compacta
  de 2 linhas dentro de um único container (`border`/`rounded-xl`/`p-3`,
  Figma "Filtros"). Os `<Label>` viraram `sr-only` (não removidos —
  `getByLabelText` e leitor de tela continuam funcionando, só o visual
  muda). Placeholders dos 4 `Select` passaram a reproduzir o texto do
  Figma 1:1 ("Todas as gestoras", "Todos os projetos", "Todas as etapas",
  "Todos os status: ativo, finalizado, desligado"). "Limpar filtros" virou
  `variant="ghost"` (texto puro, sem borda, como no Figma). Contagem
  ("N mandatos") saiu da faixa cinza pequena e virou a linha "Resumo" do
  Figma (bold, 16px), com "Mais recentes primeiro" ao lado.
- `lista-mandatos.tsx`: badge de status ganhou dot colorido por status
  (Ativo=emerald, Finalizado=muted, Desligado=`variant="destructive"` do
  Badge — que já usa o token `--destructive`/#EB5454, o mesmo vermelho do
  Figma). Nome do mandato ganhou o prefixo "Contrato" (vínculo visual mais
  forte com o card, Figma "Identificação"). Card deixou de ser um `<Link>`
  inteiro — só "Ver contrato →" no rodapé é link explícito agora (Figma
  "Rodapé do contrato"). Rodapé mostra texto por status: "Atualizado há X
  dias"/"Atualizado hoje" (ativo), "Encerrado em DD/MM" (concluído),
  "Desligado em DD/MM" (desligado).
- `queries/mandatos-lista.ts`: `ContratoCard` ganhou `atualizadoEm` (lido de
  `fat_contrato.atualizado_em`, coluna já existente no schema aprovado e no
  banco provisionado — `database.types.ts` confirma — não é dado novo
  inventado, só não estava sendo selecionado).
- `produtos/[slug]/mandatos/page.tsx`: adicionado o bloco "Mandatos" +
  "Acompanhe vigência, etapa e responsáveis de todos os contratos." (Figma
  "Introdução"), que faltava desde T21b — `ProdutoShell` só renderiza o
  título do produto e as abas, nunca o título da aba corrente.

**Gaps declarados (spec-precision)**

1. Os dois campos de data (`filtro-data-de`/`filtro-data-ate`) não
   reproduzem "Data inicial"/"Data final" como texto visível dentro da
   caixa: `input[type="date"]` não suporta placeholder customizado em
   nenhum browser principal (Chrome/Firefox renderizam só o formato nativo,
   ex. "dd/mm/aaaa"). Limitação de plataforma, não escolha de
   implementação — os 4 `Select` da mesma barra atingem fidelidade 1:1
   porque `SelectValue placeholder` não tem essa limitação.
2. "Mais recentes primeiro ⌄" no Figma sugere um controle de ordenação
   (chevron de dropdown). Virou rótulo estático descrevendo a ordenação fixa
   que `buscarMandatosLista` já aplica (`order("dt_inicio", { ascending:
   false })`) — nenhum AC/design.md pede um seletor de ordenação
   interativo, e a query não aceita outro campo de `order`. Implementá-lo
   seria inventar comportamento sem lastro (mesmo raciocínio já registrado
   no comentário de `dashboard/page.tsx` sobre a barra de filtros de
   gestora/projeto fora de escopo).
3. Ativo/Finalizado no badge de status usam a paleta padrão do Tailwind
   (emerald/muted), não um token do design system: `globals.css` não define
   token de sucesso/neutro dedicado (só `--primary`/`--secondary`/
   `--destructive`). Desligado usa `--destructive` (token real, bate 1:1
   com o Figma). Mesma escolha que o código anterior já fazia para o dot
   (`bg-emerald-500`).

**Gate**

- `lint:frontend` limpo nos 4 arquivos tocados (`page.tsx`,
  `filtros-mandatos.tsx`, `lista-mandatos.tsx`, `mandatos-lista.ts` +
  `.test.ts`/`.test.tsx`).
- `test:unit`: 24/24 nos arquivos tocados (`mandatos-lista.test.ts`,
  `filtros-mandatos.test.tsx`, `lista-mandatos.test.tsx`), incluindo 4
  testes novos (link explícito "Ver contrato", rodapé por status). Suíte
  completa: 764/765 — a 1 falha é em `kpi-row.test.tsx` (Dashboard, fora de
  escopo, explicitamente vedado tocar), e o arquivo aparece concorrentemente
  modificado por outro worker no mesmo `git status` desta sessão — não
  causada por este ajuste.
- `npm run build` **não foi rodado** (workers de Dashboard/Agenda em
  paralelo no mesmo working directory — aguardando OK explícito antes de
  rodar).

---

### Ajuste de fidelidade visual — Agenda (2026-09-14)

Pedro reportou: "os filtros de gestora, projeto e contrato também não
aparecem como foi definido no Figma." Escopo: `produtos/[slug]/agenda`
(T25-T30/T30b). Seguido o protocolo `figma-design-to-code` (G1:
`get_design_context` no node `163:4`, arquivo `eS5CdQrl6yUdYctZwlDzps`,
chamado antes de qualquer código — a skill em si não estava disponível nem
como slash command nem como recurso MCP `skill://figma/figma-design-to-code/
SKILL.md` neste ambiente; G2-G5 seguidos pelo protocolo descrito na própria
tarefa, na ausência do texto da skill).

**O que mudou**

- `queries/agenda.ts`: três funções novas — `buscarOpcoesGestora`,
  `buscarOpcoesProjeto`, `buscarOpcoesContrato` — que alimentam os 3
  dropdowns do Figma. Nenhuma mudança no encanamento de filtro que já
  existia: `FiltroAgenda`/`resolverIdsContratoDoFiltro` já aceitavam
  `idGestora`/`idProjeto`/`idContrato` por interseção (inclusive `idContrato`
  isolado, linha 120-122 do arquivo) desde T25 — a lacuna reportada pelo
  Pedro era só a UI nunca ter sido desenhada (comentário explícito em
  `page.tsx`, removido nesta task, que citava a barra de filtros como "fora
  de escopo" da Fase 7).
- `components/estrategia/filtros-agenda.tsx` (novo): barra de 3 `Select`
  (Gestora/Projeto/Contrato), padrão copiado — não importado — de
  `filtros-mandatos.tsx` (sentinela `"todos"`, mesmo texto usado em
  `mandatos/page.tsx` e `contratos/page.tsx`). Diferença deliberada: o
  item-sentinela usa o PRÓPRIO texto do rótulo ("Filtrar por gestora") como
  label, porque é esse o texto que o Figma desenha no estado sem filtro —
  não um genérico "Todas as gestoras".
- `components/estrategia/agenda-mes.tsx`: botão "+ Novo agendamento" (Figma
  "btn-add"), agora na mesma linha do título do mês + setas, ao lado das
  legendas "Agendada"/"Realizada" (Figma "header-right"). Três props novas,
  todas opcionais (`onNovoAgendamento`, `novoAgendamentoDesabilitado`,
  `motivoNovoAgendamentoDesabilitado`) — sem handler o botão não desenha,
  mesma convenção de `onMudarMes`/`onSelecionarEncontro`.
- `produtos/[slug]/agenda/page.tsx`: estado de filtro (`ValorFiltrosAgenda`)
  ligado às duas queries existentes (`buscarEncontrosDoMes`,
  `buscarRegistrosDaAgenda`) por spread — filtro vazio não acrescenta
  nenhuma chave, então a consulta do mês corrente continua idêntica à de
  antes desta task. `onNovoAgendamento` navega para
  `/contratos/{idContrato}/encontros` usando o contrato do FILTRO ativo
  (mesma rota que "Adicionar registro" do popover já usa, EST-13 AC6).
  Tabela de "Registros de Agenda": badge de Tipo colorido (paleta fixa de
  6 cores da marca, `globals.css`, escolhida por hash determinístico do
  nome do tipo) e avatar circular com a inicial do responsável, ao lado do
  nome (Figma "cell-tipo"/"cell-responsavel").

**Gaps declarados (spec-precision)**

1. **"+ Novo agendamento" sem tela de criação no nível do produto.** Nem a
   Fase 7 nem Incidência (INC-15..18) têm uma tela de criar encontro sem
   contrato já conhecido — `encontroSchema` (`schemas/encontro.ts`) exige
   `id_contrato`, e a única superfície de criação hoje é o Dialog de
   `EncontroForm` em `/contratos/[id]/encontros`. O botão reaproveita essa
   rota com o contrato do filtro ativo e fica **desabilitado** (nunca
   escondido, AD-005) até a usuária escolher um contrato, com o motivo no
   `title`. Construir uma tela de criação de encontro a partir do produto
   (sem contrato pré-selecionado) estava fora do Where desta task.
2. **Cor do badge de Tipo não vem do banco.** `ref_tipo_registro`
   (`docs/schema_sistema.sql`) não tem coluna de cor, e os nomes reais do
   catálogo (`catalogos_referencia_seed.sql`: "Sprint", "Monitoramento
   mensal", "Diagnóstico de Organograma" etc.) não batem literalmente com
   os rótulos do mock do Figma ("Sprint", "Monitoramento", "Diagnóstico",
   "Planejamento", "Organograma"). Em vez de uma tabela nome→cor que
   quebraria silenciosamente a cada tipo novo do catálogo, a cor sai de
   hash determinístico do nome sobre uma paleta fixa das 6 cores da marca —
   mesmo tipo sempre pinta igual, tipo novo nunca fica sem cor.
3. **Avatar é iniciial, não foto.** `RegistroAgenda.nomeAutor` não carrega
   URL de foto — `dim_usuario` (`docs/schema_sistema.sql`) não tem essa
   coluna. O círculo mostra a inicial do nome, nunca uma imagem inventada.
4. **Opções dos 3 dropdowns não são cascateadas.** Selecionar uma gestora
   não restringe as opções de Contrato às dela (e vice-versa) — mesma
   convenção de `filtros-mandatos.tsx`, cujas opções de gestora/projeto/
   etapa também não se filtram entre si. Nenhum AC ou design.md pede
   cascateamento; implementá-lo seria inventar comportamento sem lastro.
5. O chip "Mostrando registros de: {título} [×]" (item 3 do pedido do
   Pedro) já existia desde T30b (`ListaRegistros`, badge + botão de limpar)
   e não foi alterado — conferido contra o Figma e já reproduz "Mostrando
   registros de: X — [x]" com o mesmo comportamento (aparece só com encontro
   selecionado, remove a seleção ao fechar).

**Gate**

- `lint:frontend` limpo nos arquivos tocados (`agenda/page.tsx`,
  `agenda-mes.tsx`, `filtros-agenda.tsx`, `queries/agenda.ts` +
  `.test.ts`/`.test.tsx`) — os 24 problemas que `lint:frontend` reporta no
  repo inteiro estão todos em arquivos não tocados por esta task
  (`mandatos/page.tsx`, `usuarios/page.tsx`, `contrato-form.tsx`,
  `mandato-card.tsx`, `mandato-wizard.tsx`, `encontro-form.tsx`,
  `iip-card.tsx`).
- `test:unit`: 78/78 nos arquivos tocados (`agenda.test.ts` 23,
  `agenda-mes.test.tsx` 24, `filtros-agenda.test.tsx` 3 novo,
  `page.test.tsx` 28), incluindo testes novos para as 3 queries de opções,
  o botão Novo agendamento (presente/ausente/desabilitado) e badge+avatar
  da tabela. Suíte completa: 764/765 — a mesma 1 falha pré-existente de
  `kpi-row.test.tsx` (Dashboard, fora de escopo, explicitamente vedado
  tocar) já registrada no fechamento de Mandatos acima; não causada por
  este ajuste.
- `npm run build` **não foi rodado** (aguardando OK explícito do Pedro —
  workers de Dashboard/Mandatos em paralelo no mesmo working directory).

### Ajuste de fidelidade visual — Dashboard (2026-09-14)

Pedro reportou 2026-09-14: "faltando em vários elementos, como filtros,
cores, tipo de letra, etc." no `/produtos/[slug]/dashboard` (Figma 44:5),
mais o pedido explícito de `max-height` + scroll interno no Kanban e na
tabela de Pendências. Protocolo `figma-design-to-code`: G1 (`get_design_context`
no node `44:5`, arquivo `eS5CdQrl6yUdYctZwlDzps`, chamado antes de qualquer
código) confirmou a lacuna real de cada item abaixo contra o markup/CSS de
referência devolvido, não contra a descrição resumida do pedido.

**O que mudou**

- `components/estrategia/filtro-dashboard.tsx` (novo) + `.test.tsx`: barra de
  filtros Gestora/Projeto (Figma 44:29 "filter-bar") que não existia. Ao
  contrário do texto do pedido original ("presentational primeiro... se as
  queries não aceitarem filtro, diga que é trabalho futuro"), `buscarQuadro`
  (via `FiltroBoard`), `buscarEstrategiaKpi` e `buscarPendenciasDashboard` já
  aceitavam `idGestora`/`idProjeto` desde a Fase 8 (EST-08 AC3) — então a
  filtragem foi ligada de verdade em `page.tsx`, não deixada só como UI.
  Componente novo em vez de reusar `filtros-mandatos.tsx` (fora dos arquivos
  permitidos para edição nesta task, e tem 5 campos, não 2).
- `produtos/[slug]/dashboard/page.tsx`: estado `filtro` (`ValorFiltroDashboard`),
  duas queries novas para popular as Selects (`buscarGestorasAtivas` — nova,
  duplica `buscarGestoras` de `mandatos/page.tsx` de propósito, arquivo fora
  do escopo permitido — e `buscarProjetosDoProduto`, que já existia em
  `queries/kanban.ts` para exatamente este uso), as 3 query keys dos dados
  do Dashboard passaram a incluir `filtro` para reativar no `onValueChange`,
  e títulos de seção "Quadro de acompanhamento"/"Pendências" (Figma
  "section-title-kanban"/"section-title-pendencias") que não existiam.
- `components/estrategia/kpi-row.tsx` + `.test.tsx`: `font-heading` explícito
  nos 6 números grandes (não estava em nenhum, apesar do commit `770bb00`
  minutos antes já ter corrigido a variável) e rótulo em `font-bold` (era
  `font-medium`) para bater com Commissioner Bold do Figma. "Mandatos em
  atraso" e "NPS das imersões" deixaram de ser stat tiles genéricos e
  ganharam o layout próprio do Figma (86:44 e 44:53): quebra por status com
  3 linhas (dot colorido + rótulo) e barra segmentada + rótulos de
  percentual + chip de nº de avaliações, respectivamente — ver gap 1 abaixo.
- `components/estrategia/quadro-acompanhamento.tsx`: badge do card virou chip
  com fundo na cor do estado a 14% de opacidade (Figma usa
  `rgba(33,184,89,0.14)`/`rgba(235,178,26,0.14)`/`rgba(224,56,54,0.14)`) —
  antes era só dot + texto solto, sem fundo. Mapeado para
  `bg-emerald-500/14`/`bg-amber-500/14`/`bg-destructive/14` (reaproveita as
  mesmas classes de paleta que `ESTADO_DOT_CLASS` já usava, nenhum hex cru
  novo). Texto "N dias na etapa" ganhou `text-secondary` (Figma pinta em
  vinho, estava sem cor). **Max-height + scroll interno do Kanban** (pedido
  explícito do Pedro): cada coluna (`ColunaEtapa`/`ColunaProspeccao`) ganhou
  altura fixa (`h-[520px]`, constante `ALTURA_COLUNA`) em vez de esticar com
  o conteúdo — só a lista de cards dentro dela rola (`overflow-y-auto` +
  `min-h-0` no `flex-1`), cabeçalho da coluna sempre visível.
- `components/estrategia/tabela-pendencias.tsx`: wrapper com borda
  arredondada (Figma "table-container") que não existia, cabeçalho `sticky`
  com `bg-background`/uppercase/bold (era o estilo default do shadcn table,
  sem essas 3 diferenças), badge de categoria com `rounded-md`/`font-bold`
  em vez do pill default do componente `Badge` (só via `className`, o
  componente compartilhado não foi tocado). **Max-height + scroll interno da
  tabela** (pedido explícito do Pedro, independente do Kanban): wrapper
  `max-h-[420px] overflow-y-auto` em volta do `<Table>`, cabeçalho fixo no
  topo da rolagem.
- `components/produtos/produto-shell.tsx` e `components/app-shell/route-tabs.tsx`:
  título "ESTRATÉGIA" e aba ativa estavam em `text-primary` (teal) — Figma
  44:19/44:20 pinta os dois em `secondary` (vinho). Título também ganhou
  `uppercase` (não tinha) e foi de `text-3xl` para `text-4xl` (mais perto do
  44px do Figma). Esses dois arquivos são chrome compartilhado por
  Agenda/Mandatos (não são "páginas" dessas features, que a task pediu para
  não tocar) — mudança é só cor/tamanho, não estrutura ou comportamento, e
  `produto-shell.test.tsx` foi ajustado (asserção de classe, não de
  comportamento) para a nova cor.

**Gaps declarados (spec-precision)**

1. **Quebra por status de "Mandatos em atraso" e segmentação de "NPS das
   imersões" não vêm da view.** `vw_estrategia_kpi` (EST-08/T31) expõe só
   `mandatos_em_atraso` (total) e `nps_medio` (média) — nenhuma contagem por
   status (atrasado/atenção/normal) nem segmentação promotor/neutro/detrator
   nem contagem de avaliações. O layout das duas peças existe (3 linhas de
   status, barra segmentada, rótulos de percentual, chip de avaliações) e
   não desaparece, mas cada parte sem dado de origem mostra "—" em vez de
   uma proporção ou contagem inventada (AD-005). Fechar este gap de verdade
   exige uma coluna/view nova — fora do Where desta task de fidelidade
   visual.
2. **Filtro de Gestora/Projeto não tem "Limpar filtros".** O Figma 44:29 só
   desenha as 2 Selects, sem botão de reset (ao contrário de
   `filtros-mandatos.tsx`, que tem 5 campos e "Limpar filtros"). Implementado
   literalmente como o Figma desenha; se Pedro quiser o reset, é um pedido
   novo, não uma correção de fidelidade.
3. **Chevron ao lado de "Quadro de acompanhamento"/"Pendências" é
   decorativo.** O Figma desenha um `chevron-down` nos dois títulos de
   seção, sugerindo colapsar/expandir, mas nenhum AC ou design.md desta
   feature pede essa interação (AD-046: tela de leitura). Implementado só
   como ícone, sem `onClick` nem estado — inventar collapse seria
   comportamento sem lastro no spec.

**Gate**

- `lint:frontend` limpo nos arquivos tocados. Rodado duas vezes
  (`lint:frontend` e `lint:all`): os mesmos 24 problemas pré-existentes (10
  erros, 14 warnings) nas duas rodadas, todos em arquivos não tocados por
  esta task (`mandatos/page.tsx`, `usuarios/page.tsx`, `contrato-form.tsx`,
  `mandato-card.tsx`, `mandato-wizard.tsx`, `encontro-form.tsx`,
  `iip-card.tsx`) — nenhum problema novo introduzido.
- `test:unit`: suíte completa 73/73 arquivos, 765/765 testes, incluindo os
  2 testes novos de `filtro-dashboard.test.tsx` e as 2 asserções novas em
  `kpi-row.test.tsx` cobrindo os dois lados do gap 1 (layout presente com
  "—" nas partes sem dado). A 1 falha transitória em `kpi-row.test.tsx` que
  os fechamentos de Mandatos/Agenda registram como "pré-existente, fora de
  escopo" era este mesmo arquivo sendo editado por este worker enquanto os
  outros dois rodavam suite no mesmo working directory — artefato de
  paralelismo, não uma falha real: a suíte está 100% verde ao final deste
  ajuste.
- `npm run build` **não foi rodado** — aguardando OK explícito do Pedro,
  mesma razão dos outros dois workers (working directory compartilhado).

---

### ⏭️ PENDENTE — 5 falhas novas no CI, além das 8 herdadas (2026-09-14)

O push `0a33d3b..50ee834` (fidelidade visual) disparou o CI (run `34864384234`) contra o banco
efêmero (reconstrói do zero, seed mínimo — diferente do dev, que acumula estado). Resultado: **10
arquivos falharam, 9 testes individuais**, além dos 8 arquivos historicamente vermelhos
(`visao-gerencial/*`, `saida/*`, documentados em 2026-09-11 como dívida herdada não-nossa).

**2 são de trabalho de ontem (Fase 7/8), nunca antes rodado contra banco limpo:**
- `vw-estrategia-kpi.integration.test.ts` — "Independent Test do spec" falhou:
  `expected cobertura.produtos to be greater than 1`, recebeu `1`. Hipótese: `seed_test.sql` não
  tem dado suficiente para mais de um produto no banco efêmero do CI — cobertura de seed, não bug
  na view (a view em si não foi tocada por esta investigação). **Não confirmado.**
- `fn-marcar-presenca.integration.test.ts` (T29) — falha de idempotência
  (`EST-13 AC5: segunda chamada é idempotente`). **Não investigado.**

**3 são de código muito mais antigo (Kanban/Régua, agosto), nunca antes vistas falhando em CI:**
- `fn-mover-etapa-kanban.integration.test.ts` — `expected 2026-09-14T00:00:00.000Z to be
  '2026-09-14'`. Formato sugere um `Date` serializado via `.toISOString()` em vez de string de
  data pura — mesma classe de bug já documentada em `supabase/tests/helpers/sql.ts` (Date do JS
  interpolado onde se espera string). Data coincide com o dia real da execução do CI, o que é
  suspeito: pode ser um teste que calcula "hoje" incorretamente, só visível quando roda no dia
  exato em que o teste foi escrito.
- `kanban-etapas-rls-grants.integration.test.ts` — mentor com vínculo ativo, UPDATE negado.
- `regua-instanciacao.integration.test.ts` — RGI-02, contagem de linhas por etapa.

**Decisão de Pedro (2026-09-14)**: não bloquear o trabalho em andamento (migration de
`vw_estrategia_kpi` para expor atrasado/atenção/normal) por causa disso — seguir com a migration,
tratar este achado como investigação separada. **Ninguém deve considerar isso resolvido até
alguém rodar os 5 arquivos isolados contra o CI (não só contra dev) e classificar cada um.**
