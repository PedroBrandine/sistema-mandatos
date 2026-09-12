# Redesenho Estratégia tela-first — Validação da Fase 7 (T25–T30)

**Data**: 2026-09-12
**Spec**: `.specs/features/redesenho-estrategia-tela-first/spec.md` — requisitos **EST-12** e **EST-13**
**Intervalo de commits**: `a76beb7..d1f9f50` (código: `0356335`, `12a214a`, `ac6a45d`, `6ca81ea`, `8f2eaf4`, `e2f0b05`; `d1f9f50` é só documentação)
**Verifier**: sub-agente independente (autor ≠ verificador). Cobertura re-derivada do spec, sem herdar o raciocínio do autor.
**Escopo**: camada de leitura T25–T27 (AD-046, caminho feliz) + camada de escrita T28–T30 (profundidade integral de AD-042).

> Este arquivo é **novo** e não substitui `validation.md`, que cobre T1–T18 e é de outro escopo.

---

## Veredito

**❌ FAIL** — não por fragilidade dos testes do que foi construído (o sensor matou 7/7 mutações e
os gates estão verdes), mas porque **5 dos 12 critérios de aceite de EST-12/EST-13 só têm metade
coberta**. As metades faltantes não são testes ausentes: são comportamento que **não existe em
lugar nenhum do código** — a Fase 7 não tem task de montagem de página e a rota
`src/frontend/app/(app)/produtos/[slug]/agenda/page.tsx:5` ainda renderiza `EmDesenvolvimento`.
Nenhum arquivo importa `AgendaMes`, `EncontroPopover`, `buscarEncontrosDoMes`,
`buscarRegistrosDaAgenda` ou `marcarPresenca` fora dos próprios testes (verificado por grep em
`src/`).

O autor declarou isto em `tasks.md` ("Achados para quem seguir": *"A Fase 7 não tem task de
montagem de página… F7 entrega componentes que nada renderiza"*). O registro é honesto; a
consequência para a rastreabilidade é que **EST-12 e EST-13 não podem ser marcados como
Verified** enquanto a tela não for montada.

---

## Task Completion

| Task | Status | Notas |
| :-- | :-- | :-- |
| T25 `queries/agenda.ts` | ✅ Done | 14 testes unitários; fronteira do mês asserida nos dois extremos |
| T26 `AgendaMes` | ✅ Done | 15 testes; `hoje` por prop (L-002), sem relógio congelado |
| T27 `queries/registros-agenda.ts` | ✅ Done | 9 testes; reusa `resolverIdsContratoDoFiltro` (desvio 3 do autor, aceito) |
| T28 `EncontroPopover` | ✅ Done | 28 testes no arquivo (T28+T30); `<Popover>` do Radix stubado (desvio 4) |
| T29 RPC `marcar_presenca` | ⚠️ Parcial | Migration + wrapper prontos; gate `full` reduzido por autorização de Pedro (desvio 1). Suíte de integração **não re-executada aqui** (proibida nesta rodada por contenção com o projeto cloud compartilhado) |
| T30 Presença e registro no popover | ⚠️ Parcial | Payloads e condicionais cobertos; a *consequência* (status muda na grade, formulário de registro abre) não tem superfície montada |

---

## Checagem ancorada na spec (evidência-ou-zero)

### EST-12 — P2: Agenda, calendário e registros

| Critério (WHEN → THEN) | Outcome definido pelo spec | `file:line` + asserção | Resultado |
| :-- | :-- | :-- | :-- |
| **AC1** — Agenda abre → exibe **o mês corrente** com encontros **no dia correto** | mês = corrente; encontro na célula do seu dia | **dia correto ✅**: `src/frontend/components/estrategia/agenda-mes.test.tsx:63` — `expect(celula("2026-09-15")).toHaveTextContent("Mentoria 3")` e `:64` `expect(celula("2026-09-16")).not.toHaveTextContent("Mentoria 3")`; virada de fuso em `:77` — `expect(celula("2026-09-30")).toHaveTextContent("Mentoria 3")` para `2026-10-01T00:00:00Z`; recorte da consulta em `src/backend/queries/agenda.test.ts:128-133` — `expect(argsDe(chamadas,"fat_encontro","gte")).toEqual([["dt_prevista_inicio","2026-09-01T00:00:00-03:00"]])` e `lt` → `"2026-10-01T00:00:00-03:00"`. **mês corrente ❌: sem evidência** — `AgendaMes` recebe `ano`/`mes` por prop e nada calcula "corrente"; não há montagem | ⚠️ **Parcial** |
| **AC2** — encontro exibido → cor reflete o status (`Agendada`/`Realizada`) | duas cores distintas, uma por status | `agenda-mes.test.tsx:83-84` — `screen.getByRole("button",{name:/Agendada: Mentoria 3/})` + `expect(botao.className).toContain("sky")`; `:103-105` — `/Realizada: Mentoria 3/` + `toContain("emerald")` + `not.toContain("sky")` | ✅ PASS (⚠️ ver spec-precision 2 e 3) |
| **AC3** — navega entre meses → encontros recarregam para o mês exibido | o mês exibido muda e os dados acompanham | **seam ✅**: `agenda-mes.test.tsx:116` — `expect(onMudarMes).toHaveBeenCalledWith({ano:2026,mes:10})`; `:127` `{ano:2025,mes:12}`; `:138` `{ano:2027,mes:1}`; a consulta respeita o mês pedido em `agenda.test.ts:128-133`. **recarga ❌: sem evidência** — nenhum teste liga callback → nova busca, porque não há componente que faça isso | ⚠️ **Parcial** |
| **AC4** — clica num encontro → abre o popover de detalhe (T7) | popover de T7 aberto para aquele encontro | **entrega do encontro ✅**: `agenda-mes.test.tsx:168` — `expect(onSelecionarEncontro).toHaveBeenCalledWith(ENCONTRO_BASE)`. **abertura ❌**: `encontro-popover.test.tsx:206` assere `expect(screen.getByTestId("popover")).toHaveAttribute("data-open","true")` com o **Radix stubado** (`:16-24`) e `aberto` passado literalmente — não prova que o clique na grade abre o popover; ninguém compõe `AgendaMes` + `EncontroPopover` | ⚠️ **Parcial** |
| **AC5** — encontro selecionado → lista de Registros filtra por ele **e** exibe o filtro ativo, **removível** | registros só daquele encontro; chip de filtro visível e removível | **filtro ✅**: `src/backend/queries/registros-agenda.test.ts:102` — `expect(argsDe(chamadas,"fat_registro","eq")).toEqual([["id_encontro",501]])`; lado oposto em `:93` — `toEqual([])`. **filtro ativo removível ❌: sem evidência** — não existe componente de lista de Registros da Agenda em `src/frontend/components/estrategia/` | ⚠️ **Parcial** |
| **AC6** — dia é hoje → célula destacada | exatamente a célula de hoje marcada | `agenda-mes.test.tsx:144-145` — `expect(celula("2026-09-15")).toHaveAttribute("data-hoje","true")` + `expect(document.querySelectorAll("[data-hoje='true']")).toHaveLength(1)`; lado oposto `:151` — `toHaveLength(0)` com `hoje="2026-11-03"` | ✅ PASS |

### EST-13 — P2: Popover de encontro, presença e registro

| Critério (WHEN → THEN) | Outcome definido pelo spec | `file:line` + asserção | Resultado |
| :-- | :-- | :-- | :-- |
| **AC1** — popover abre → exibe status, etapa, tipo, data/horário, modalidade, local, tema e participantes | os 8 campos presentes com o valor real | `encontro-popover.test.tsx:119-126` — uma asserção por campo nomeado: `getByText("Agendada")`, `getByText("Diagnóstico")`, `getByText("Escuta Diagnóstica")`, `getByText("15/09/2026 · 14:00 — 15:30")`, `getByText("Online")`, `getByText("Sala 2")`, `getByText("Orçamento")`, `getByText("Ana Gestora, Assessor convidado")`. Ausência (AD-005): `:153` — `expect(screen.getAllByText("—")).toHaveLength(7)` + `:154-155` sem `"null"`/`"undefined"` | ✅ PASS |
| **AC2** — encontro tem registros → exibe a contagem **e** o link | contagem correta + link para os registros | `:178-179` — `screen.getByRole("link",{name:"2 registros vinculados"})` e `expect(link).toHaveAttribute("href","/contratos/42/encontros")`; singular `:185`; lado oposto `:191-194` — `queryByRole("link")` e `queryByText(/registros? vinculados?/i)` ausentes | ✅ PASS (⚠️ ver spec-precision 4) |
| **AC3** — data prevista passou **e** status `planejado` → aviso + ação "Marcar presença" | as duas metades exigidas em conjunção | Função: `:239` `encontroVencido(ENCONTRO,"2026-09-20") === true`; `:243` data futura → `false`; `:247` status `realizado` → `false`; `:251` fronteira (o próprio dia) → `false`; `:255` sem data → `false`. Render: `:263-264` aviso + `getByRole("button",{name:"Marcar presença"})`; `:270-271` futuro → ambos ausentes; `:283-284` vencido+realizado → ambos ausentes | ✅ PASS |
| **AC4** — marca presença → grava `status='realizado'` **e** `dt_realizada`, com autor e timestamp (AD-006) | linha em `fat_encontro` com os dois campos + linha de auditoria com autor/timestamp | Implementação: `supabase/migrations/20260912023810_estrategia_fn_marcar_presenca.sql:41-44`. Integração: `supabase/tests/estrategia/fn-marcar-presenca.integration.test.ts:129-130` — `expect(depois.status).toBe("realizado")` e `expect(depois.dt_realizada).not.toBeNull()`; auditoria `:151-155` — `expect(rows).toHaveLength(1)`, `rows[0].id_usuario` não nulo, `ocorrido_em` não nulo, `expect(rows[0].valor_novo?.status).toBe("realizado")`; `SECURITY INVOKER` em `:116-118` — `expect(rows[0].prosecdef).toBe(false)`. Wrapper: `src/backend/rpc/encontro.test.ts:37-41` — `expect(chamadas[0]).toEqual({schema:"app",fn:"marcar_presenca",params:{p_id_encontro:501}})`. UI: `encontro-popover.test.tsx:302` — `expect(onMarcarPresenca).toHaveBeenCalledWith({idEncontro:501})` | ✅ PASS¹ (❌ "atualiza o status na grade", exigido pelo *Done when* da T30: **sem evidência**) |
| **AC5** — presença em encontro já realizado → não duplica a transição | sem segunda transição, sem segunda auditoria | `20260912023810_…sql:35-37` (`IF v_status = 'realizado' THEN RETURN;`); `fn-marcar-presenca.integration.test.ts:166` — `expect(depois.dt_realizada).toBe(antes.dt_realizada)`; `:174` — `expect(await contarAuditoria(encontros.feliz)).toBe(antes)`; `src/backend/rpc/encontro.test.ts:55` — `resolves.toBeUndefined()` | ✅ PASS¹ (⚠️ asserções **não discriminam** o guard — ver Sensor, mutação 8) |
| **AC6** — clica "Adicionar registro" → abre a criação já vinculada **ao encontro e ao contrato** | formulário de registro aberto com os dois vínculos | **payload ✅**: `encontro-popover.test.tsx:360` — `expect(onAdicionarRegistro).toHaveBeenCalledWith({idEncontro:501,idContrato:42})` (as duas metades no mesmo valor asserido); `:372` ação presente também em encontro realizado. **abertura ❌: sem evidência** — nada monta `RegistroForm` a partir do popover (o autor registra que `RegistroForm` exige `idEtapa`, que `EncontroAgenda` não carrega) | ⚠️ **Parcial** |

¹ Evidência de integração **lida, não re-executada** nesta validação: rodar `npm run test:integration`
foi vedado nesta rodada (execução concorrente contra o projeto cloud de dev compartilhado). O
autor reporta 6/6 verdes no commit `8f2eaf4`.

**Placar**: **7/12 ACs** com outcome batendo integralmente · **5/12 parciais** (metade sem evidência) ·
**0 ACs totalmente descobertos**.

---

## Spec-precision gaps

| # | Onde | Gap | Tratamento |
| :-- | :-- | :-- | :-- |
| 1 | EST-12 AC1 | O spec pede "dia correto" mas **não nomeia fuso**, e `dt_prevista_inicio` é `TIMESTAMPTZ` | Resolvido por constante única `FUSO_HORARIO_PRODUTO = "-03:00"` (`src/backend/queries/agenda.ts:19`), congelada por teste (`agenda.test.ts:109-112`). Declarado pelo autor. **Aceito** |
| 2 | EST-12 AC2 | AC2 nomeia só `Agendada`/`Realizada`; `ck_encontro_status` permite 4 | `cancelado`/`remarcado` recebem rótulo e cor neutra (`agenda-mes.tsx:48-60`) em vez de sumirem. **Nenhum teste cobre esses dois rótulos** — sob AD-046 (T26 é leitura) o par não é exigido, mas o gap fica registrado, não implícito |
| 3 | EST-12 AC2 | O spec não define **quais** cores | O teste ancora família de classe (`sky`/`emerald`) + rótulo acessível. Discrimina (mutação não testada, mas a asserção é de valor), porém amarra o teste ao Tailwind |
| 4 | EST-13 AC2 | O spec diz "o link para eles" sem definir **o destino** | A implementação inventa `/contratos/${idContrato}/encontros` (`encontro-popover.tsx:143`) e o teste congela esse href. Se o destino certo for outro, o teste passa igual |
| 5 | EST-13 | Marcar presença em encontro **cancelado** não é definido por nenhuma AC | A função transiciona como qualquer não-realizado; registrado no `COMMENT ON FUNCTION`. Declarado pelo autor. **Aceito** |
| 6 | AD-046 vs. `tasks.md` | AD-046 lista **T25-T28** como leitura, e logo abaixo lista **T28-T30** como escrita | A Test Coverage Matrix (`tasks.md:741-742`) é inequívoca: T28 é escrita. O autor seguiu a Matrix (profundidade integral em `encontro-popover.test.tsx`), o que é a leitura correta. Vale corrigir o texto de AD-046 |

---

## Sensor de discriminação

Executado em estado descartável (cópia de segurança do arquivo no scratchpad, mutação por
`sed`/`python`, restauração imediata, `git status` conferido vazio depois de **cada** mutação).
Só testes unitários — `npm run test:integration` não foi executado.

| # | Arquivo:linha | Mutação | Testes rodados | Resultado |
| :-- | :-- | :-- | :-- | :-- |
| 1 | `src/frontend/components/estrategia/encontro-popover.tsx:79` | `diaNoFusoDoProduto(...) < hoje` → `> hoje` (inverte `encontroVencido`) | `encontro-popover.test.tsx` | ✅ **Morto** — 6 falhas / 28 |
| 2 | `src/backend/queries/agenda.ts:224` | `.lt("dt_prevista_inicio", fim)` → `.lte(...)` | `agenda.test.ts` | ✅ **Morto** — 6 falhas / 14. *Ressalva*: parte da morte vem do mock não expor `lte` (TypeError), então repeti a fronteira de forma limpa na mutação 3 |
| 3 | `src/backend/queries/agenda.ts:27` | `mesSeguinte = mes === 12 ? 1 : mes + 1` → `: mes` (teto do intervalo cai para o próprio mês) | `agenda.test.ts` | ✅ **Morto** — 2 falhas dirigidas: *"fim é o primeiro instante do mês seguinte"* e *"gte no primeiro instante, lt no mês seguinte (AC1)"*. Confirma que a fronteira é asserida por **valor**, não pelo mock |
| 4 | `src/frontend/components/estrategia/agenda-mes.tsx:76-81` | `diaNoFusoDoProduto` devolve `iso.slice(0,10)` (some a conversão de fuso) | `agenda-mes.test.tsx` + `encontro-popover.test.tsx` | ✅ **Morto** — 3 falhas: virada de mês na função, na grade e em `formatarDataHorario` |
| 5 | `src/backend/queries/registros-agenda.ts:60-62` | remove o `if (filtro.idEncontro !== undefined)` (ignora o filtro de encontro) | `registros-agenda.test.ts` | ✅ **Morto** — 1 falha dirigida (AC5) |
| 6 | `src/frontend/components/estrategia/encontro-popover.tsx:141` | `{registros.length > 0 && (` → `{true && (` (perde o guard do link) | `encontro-popover.test.tsx` | ✅ **Morto** — 1 falha dirigida (AC2, lado oposto) |
| 7 | `src/frontend/components/estrategia/agenda-mes.tsx:201` | `chave === hoje` → `chave !== hoje` | `agenda-mes.test.tsx` | ✅ **Morto** — 2 falhas (AC6 nos dois lados) |
| 8 | `src/backend/rpc/encontro.ts:23` | `p_id_encontro: input.idEncontro` → `p_id_encontro: 1` | `rpc/encontro.test.ts` | ✅ **Morto** — 1 falha dirigida (L-004) |
| 9 | `supabase/migrations/20260912023810_…sql:35-37` | remover `IF v_status = 'realizado' THEN RETURN;` (idempotência) | **NÃO EXECUTADA** | ⚠️ **Não rodada** — exigiria `npm run test:integration`, vedado nesta rodada. **Análise estática indica mutante sobrevivente** (ver abaixo) |

**Profundidade**: 8 mutações executadas, **8 mortas, 0 sobreviventes**. Uma nona não executável.

### Mutação 9 — por que ela provavelmente sobrevive

Sem o `RETURN` antecipado, a segunda chamada executaria
`SET status='realizado', dt_realizada = COALESCE(dt_realizada, now())` sobre uma linha que já tem
os dois valores. Resultado:

- `dt_realizada` **não muda** (o `COALESCE` preserva) → a asserção de `…integration.test.ts:166`
  continua passando;
- a linha fica **idêntica** ao `OLD`, e `app.trg_auditoria()` tem
  `IF v_ant = v_novo THEN RETURN NULL; END IF;` (`supabase/migrations/0012_fundacao_auditoria_gap.sql:33`)
  → **nenhuma** segunda linha de auditoria → a asserção de `:174` também continua passando.

Ou seja: o comportamento que AC5 exige hoje é entregue pelo `COALESCE` e pelo guard do trigger, e
o `IF v_status = 'realizado' THEN RETURN;` é defensivo **sem asserção que o prove**. Correção
barata: a fixture `idempotente` deveria nascer com `status='realizado'` **e `dt_realizada` NULL** —
aí, sem o guard, o `COALESCE` preencheria a data, a linha mudaria e as duas asserções de AC5
passariam a matar o mutante.

---

## Code Quality

| Princípio | Status |
| :-- | :-- |
| Código mínimo, sem funcionalidade além do pedido | ✅ |
| Sem abstração para uso único | ✅ — `resolverIdsContratoDoFiltro` exportada em vez de clonada (desvio 3, alinhado a L-005) |
| Sem "flexibilidade" especulativa | ✅ |
| Só tocou os arquivos da task | ✅ — `git log --stat` do intervalo não mostra arquivo fora do escopo declarado |
| Não "melhorou" código alheio | ✅ |
| Segue os padrões existentes | ✅ — mock por nome de tabela (`queries/kanban.test.ts`), `mapeiaErroRpc`, `ErroInline` (L-008), `SECURITY INVOKER` (AD-024) |
| Testes mapeiam ACs e não são rasos | ✅ — todo `describe` cita o ID de requisito; asserções miram valor, não ocorrência de chamada |
| Checagem de outcome ancorada no spec | ⚠️ — 7/12 integrais, 5 parciais, 6 spec-precision gaps registrados |
| Expectativa de cobertura por camada | ⚠️ — `queries/**` e `rpc/**` integrais; componente de escrita (T28/T30) integral; **falta a camada de página**, que o plano da fase não previu |
| Todo teste mapeia para AC / edge case / Done-when | ✅ — nenhum teste órfão |
| Diretrizes do projeto seguidas | ✅ — `CLAUDE.md`, Test Coverage Matrix de `tasks.md`, AD-005/AD-006/AD-024/AD-042/AD-046 |
| `NULL` nunca vira sentinela (AD-005) | ✅ — `agenda.ts:276-277`, `registros-agenda.ts:99`, `encontro-popover.tsx:46-50` + teste `:149-156` |
| Migration forward-only, nascida como arquivo | ✅ — `supabase migration new`, prefixo de timestamp `20260912023810` |

---

## Edge cases do spec

- [x] *Mês da Agenda sem nenhum encontro → grade completa e vazia* — `agenda-mes.test.tsx:171-178`
  (`expect(document.querySelectorAll("[data-dia]")).toHaveLength(30)` + nenhum botão de encontro);
  na camada de dado, `agenda.test.ts:136-143` (`resolves.toEqual([])`, nunca lança).
- [ ] *…"com estado explicativo na lista"* — **sem evidência**: não existe lista de Registros da
  Agenda para exibir estado vazio.
- [x] *Usuária sem permissão → erro do banco propaga* — `agenda.test.ts:156-164` e
  `registros-agenda.test.ts:166-175` (`rejects.toEqual({message:"permission denied"})`);
  `42501 → PermissaoNegadaError` em `rpc/encontro.test.ts:58-67`; na função,
  `…sql:28-30` e `…integration.test.ts:177-185`.

---

## Gate Check

| Comando | Resultado |
| :-- | :-- |
| `npm run test:unit` | **69 arquivos, 692 testes — 692 passed, 0 failed, 0 skipped** (36,2 s) |
| `npm run lint` (raiz) | **0 problemas**, exit 0 |
| `npm run lint:frontend` | **24 problemas (10 erros, 14 warnings)**, todos em arquivos **fora do escopo desta fase** (`coalizoes/`, `contratos/`, `mandatos/`, `usuarios/`, `contrato-form.tsx`, `mandato-card.tsx`, `mandato-wizard.tsx`, `iip-card.tsx`, `encontro-form.tsx`). `agenda-mes.tsx`, `encontro-popover.tsx` e `encontros-lista.tsx` **não aparecem** — limpos. `lint-frontend` é `continue-on-error` no CI |
| `npm run build` | **✓ Compiled successfully in 23,6 s — 0 erros** |
| `npm run test:integration` | **NÃO EXECUTADO** — vedado nesta rodada (execução concorrente contra o projeto cloud de dev compartilhado) |

**Integridade da suíte**: Fase 6 encerrou em **64 arquivos / 621 testes**; agora são
**69 / 692** → **+5 arquivos, +71 testes unitários** (agenda 14, registros-agenda 9, rpc/encontro 5,
agenda-mes 15, encontro-popover 28) **+6 testes de integração**. Nenhum teste removido, nenhuma
asserção enfraquecida.

**Desvio de gate declarado**: T29 declarava `full` e rodou `reduzido` (integração isolada 6/6 +
unit + build), autorizado por Pedro, com a suíte completa travando >1h sem saída. Registrado em
`tasks.md`, desvio 1.

---

## Gaps priorizados

### Gap 1 — A Agenda não existe como tela (Blocker para EST-12/EST-13)

- **Causa raiz**: a Fase 7 não tem task de montagem (F4/F5/F8 ganharam T18b/T21b/T33b; F7 não).
  `produtos/[slug]/agenda/page.tsx:5` segue `EmDesenvolvimento`.
- **ACs atingidas**: EST-12 AC1 (metade "mês corrente"), AC3 (metade "recarregar"),
  AC4 (metade "abrir o popover"), AC5 (metade "filtro ativo, removível"), EST-13 AC6
  (metade "abre a criação").
- **Fix task sugerida (T30b)**: página da Agenda que (a) calcula o mês corrente, (b) busca por
  `buscarEncontrosDoMes` e refaz a busca no `onMudarMes`, (c) abre o `EncontroPopover` no
  `onSelecionarEncontro`, (d) renderiza a lista de Registros com chip de filtro ativo removível,
  (e) resolve `idEtapa` e abre o `RegistroForm` no `onAdicionarRegistro`, (f) re-busca depois de
  `marcarPresenca` para o status mudar na grade. Teste de componente cobrindo cada metade hoje
  descoberta.
- **Prioridade**: Blocker.

### Gap 2 — AC5 de EST-13 não discrimina o guard de idempotência (Major)

- **Causa raiz**: `COALESCE(dt_realizada, now())` + `IF v_ant = v_novo THEN RETURN NULL` do
  `app.trg_auditoria()` produzem o mesmo resultado observável com e sem o
  `IF v_status = 'realizado' THEN RETURN;`.
- **Fix task sugerida**: em `fn-marcar-presenca.integration.test.ts`, criar a fixture
  `idempotente` com `status='realizado'` e `dt_realizada NULL`; asserir que `dt_realizada`
  continua `NULL` e que a contagem de auditoria não muda.
- **Prioridade**: Major.

### Gap 3 — Destino do link de registros é invenção congelada por teste (Minor)

- **Causa raiz**: EST-13 AC2 não define o destino; `encontro-popover.tsx:143` aponta para
  `/contratos/${idContrato}/encontros` e `encontro-popover.test.tsx:179` fixa esse href.
- **Fix**: confirmar o destino na primeira demo (junto com a colisão de nome "Diagnóstico", já
  marcada como ⚠️ no spec).
- **Prioridade**: Minor.

### Gap 4 — `cancelado`/`remarcado` sem teste de render (Minor, risco aceito)

- **Causa raiz**: AD-046 dispensa o par positivo/negativo em T26 (leitura). Os dois rótulos e
  cores existem em `agenda-mes.tsx:48-60` sem asserção.
- **Prioridade**: Minor — risco aceito por AD-046, registrado aqui para não ficar implícito.

### Gap 5 — Texto de AD-046 é autocontraditório sobre T28 (Cosmético)

- AD-046 lista T28 nos dois grupos. A Test Coverage Matrix resolve (T28 = escrita) e foi o que o
  autor seguiu. Corrigir a redação de `.specs/STATE.md`.

---

## Requirement Traceability

| Requisito | Status anterior | Novo status |
| :-- | :-- | :-- |
| EST-12 | Implementing | ❌ **Needs Fix** — 2/6 ACs integrais (AC2, AC6); AC1, AC3, AC4, AC5 parciais por falta de montagem |
| EST-13 | Implementing | ❌ **Needs Fix** — 5/6 ACs integrais (AC1-AC5); AC6 parcial; AC5 sem discriminação do guard |

---

## Resumo

**Geral**: ⚠️ **Não pronto** — o que foi construído está bem testado; o que falta é o pedaço da
tela que faz as ACs serem verdadeiras para a Gestora.

**Checagem ancorada no spec**: 7/12 ACs com outcome batendo · 5 parciais · 6 spec-precision gaps
**Sensor**: 8 mutações executadas, 8 mortas, 0 sobreviventes · 1 não executável (indício estático de sobrevivência)
**Gate**: unit 692/692 · lint raiz 0 · build 0 erros · integração não re-executada

**O que funciona**: fronteira do mês asserida por valor nos dois extremos; conversão de fuso
provada nos três pontos onde importa (função, grade, popover); AND dos filtros com conjuntos
não-coincidentes (L-028); os 8 campos de EST-13 AC1 asseridos um a um; as duas metades da
conjunção de AC3 verificadas independentemente; payload de AC6 com os dois ids no mesmo valor
asserido; ausência como `—`, nunca string vazia; RPC `SECURITY INVOKER` com auditoria asserida na
linha resultante, não por confiança no gatilho.

**Próximo passo**: T30b (montagem da Agenda) e o reforço da fixture de idempotência, nesta ordem.
Depois, re-verificação — as demais lacunas são de precisão do spec e já estão registradas, não
silenciosas.

---

### Estado da árvore de trabalho

`git status --porcelain` vazio antes e depois da validação. Todas as mutações do sensor foram
aplicadas sobre cópia de segurança e restauradas imediatamente; a única alteração deixada pelo
Verifier é **este arquivo**.
