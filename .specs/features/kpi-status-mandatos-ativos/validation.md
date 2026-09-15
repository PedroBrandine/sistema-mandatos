# KPI de situação dos mandatos ativos — Validation

Spec: [spec.md](spec.md) · Design: [design.md](design.md) · Tasks: [tasks.md](tasks.md)
Verificador: Verifier independente (autor ≠ verificador), 2026-09-15.
Cobertura re-derivada da spec, não do modelo mental de quem implementou.

**Duas iterações.** A 1ª reprovou por cobertura; o autor corrigiu em `33c67b4`
e a 2ª re-derivou a evidência do zero. O veredito vigente é o da
[Iteração 2](#iteração-2--veredito-pass-condicionado-à-p4); a Iteração 1 fica
abaixo, íntegra, como histórico.

---

# Iteração 2 — Veredito: **PASS** (condicionado à P4)

Commit verificado: **`33c67b4`** — `test(estrategia): fecha os gaps de
verificacao apontados pelo Verifier` (4 arquivos, +223/−3).
Escopo desta iteração: **só** se os gaps da Iteração 1 fecharam. Nada foi
re-verificado do que já estava ✅, e nada foi corrigido por este verificador.

**Os 3 gaps 🔴 estão fechados.** Os dois mutantes que sobreviviam à Iteração 1
(A e F) agora morrem, e a promessa de teste que o `design.md` fazia para
KSM-11 existe. Sobram gaps 🟡/🟢 já registrados e a P4, que é pendência por
natureza — nenhum deles é falha de cobertura de mutante.

### Gates executados por este verificador (2ª iteração)

| Gate | Comando | Resultado |
| --- | --- | --- |
| Unit | `npm run test:unit` | ✅ 73 arquivos / **775 testes** (era 774; +1 = KSM-17), 26s |
| Integração da view | `npx vitest run --config vitest.integration.config.ts supabase/tests/estrategia/vw-estrategia-kpi.integration.test.ts` | ✅ **27/27** (eram 23/23), 373,6s — os 4 novos passam: borda de atrasado 14,1s, borda de atenção 27,8s, KSM-11 estados 5,2s, KSM-11 idempotência 8,8s. **Nenhum teste pré-existente quebrou** (os novos mutam estado no meio da suíte e a ordem aguentou) |
| Lint | `npm run lint:all` | ❌ **os mesmos 10 erros** da Iteração 1 — nenhum em arquivo desta feature. Passivo pré-existente, inalterado por `33c67b4` |
| Coleta da suíte de integração | `npx vitest list --config vitest.integration.config.ts <arquivo>` | ✅ **27 testes** registrados (eram 23; +4 = 2 de borda + 2 de KSM-11) |

Ambiente reconferido: `supabase/.temp/project-ref` = `npnvoolkebhabjkjzqwn` =
**dev** (`docs/ambientes.md:19`). **Nenhum `db push` executado.** As consultas
de evidência contra o banco foram **somente leitura** (`SELECT` via
`supabase db query --linked --file`).

---

## Gap 1 (🔴 KSM-17) — **FECHADO** quanto ao mutante; AC2 segue parcial

O autor exportou a constante e passou a espiar a criação do sensor:

- `src/frontend/components/estrategia/quadro-acompanhamento.tsx:68`
  `export const ATIVACAO_ARRASTE_PX = 8;`, consumida em `:72`
  `useSensor(PointerSensor, { activationConstraint: { distance: ATIVACAO_ARRASTE_PX } })`.
- `quadro-acompanhamento.test.tsx:16-25` — `vi.mock("@dnd-kit/core")` que
  **delega ao real** (`vi.importActual` + spread) e só registra `(nome, opcoes)`
  de cada `useSensor`.
- Asserções em `quadro-acompanhamento.test.tsx:190-193`:
  `find((s) => s.nome === "PointerSensor")` → `toBeDefined()` →
  `expect(ponteiro?.opcoes).toEqual({ activationConstraint: { distance: ATIVACAO_ARRASTE_PX } })`
  → `expect(ATIVACAO_ARRASTE_PX).toBeGreaterThan(0)`.

### A asserção é circular? Testado, não deduzido

O `toEqual` de `:192` compara contra a constante importada do **mesmo módulo**
— os dois lados se movem juntos. Era a hipótese de falha mais provável e foi
**executada**, não argumentada:

| # | Mutação em `quadro-acompanhamento.tsx` | Resultado | Onde falha |
| --- | --- | --- | --- |
| F1 | `useSensor(PointerSensor)` (remove o `activationConstraint`) | ✅ **MORTO** | `:192` — `expected undefined to deeply equal { activationConstraint: {…} }` |
| F2 | `ATIVACAO_ARRASTE_PX = 0` (**o caso circular**) | ✅ **MORTO** | `:193` — `expected 0 to be greater than 0` |
| F3 | `ATIVACAO_ARRASTE_PX = 1` | 🔴 sobrevive (13/13 verdes) | — |

**Conclusão: a circularidade existe, mas está tampada.** O `toEqual` sozinho
seria circular; a terceira asserção (`:193`) é exatamente o contraveneno, e é
ela que mata F2. O resíduo é F3: a **magnitude** continua não verificada —
qualquer valor > 0 passa. Isso é aceitável, porque o que a regressão de KSM-16
exige é "distância não-nula", não "8" (o design justifica o 8 como ergonomia,
não como contrato). Registrado como resíduo, não como gap.

**O que segue sem cobertura:** `handleDragEnd` e `onMoverCard`
(`quadro-acompanhamento.tsx:76-84`) continuam com **zero** asserção — `grep`
por `onMoverCard` em `src/frontend/**/*.test.tsx` não acha nada. A metade
"SHALL executar a transição de etapa" de P1-B AC2 (`spec.md:129-130`) segue
sem teste automatizado; o que o commit fecha é a metade "**e SHALL NOT
navegar**", que é onde o mutante morava. Fica para a P4.

---

## Gap 3 (🔴 limiar na borda, mutante A) — **FECHADO**, conclusão analítica ancorada em dados

Dois testes novos posicionam o contrato **exatamente** sobre cada limiar:

- **Borda de atrasado** — `vw-estrategia-kpi.integration.test.ts:630-636`:
  `classificar(idEtapaTeste, duracaoTeste)` e
  `expect(linha.mandatos_atraso_atrasados).toBe(1)` / `atencao).toBe(0)` (`:633-634`).
- **Borda de atenção** — `…:638-670`: busca por SQL a etapa cuja borda cai em
  **dia inteiro** (`WHERE (duracao_prevista_dias * pct_duracao_etapa) % 100 = 0`,
  `:651`), com guarda `expect(etapaExata, "nenhuma etapa do catálogo tem borda
  de atenção em dia inteiro").toBeDefined()` (`:655`), e assere
  `atencao).toBe(1)` / `atrasados).toBe(0)` / `normal).toBe(0)` (`:665-667`),
  restaurando o `dt_inicio` daquela etapa num `finally` (`:668-674`).

**A conclusão é analítica** (nenhuma migration foi mutada — isso exigiria
`db push`, proibido), mas os parâmetros da análise foram lidos do **dev real**,
somente leitura:

| Fato lido do dev | Valor |
| --- | --- |
| Limiares ativos | `etapa_atencao=70`, `etapa_atrasado=100` |
| `idEtapaTeste` (1ª etapa com duração, `ORDER BY ordem`) | `pontape`, `duracao_prevista_dias = 14` |
| Única etapa de Estratégia com borda de atenção inteira | `monitoramento`, `duracao = 120` → `dias_borda = 84` |
| Régua instanciada por contrato | 6/6 etapas presentes em `fat_etapa_contrato` (o `UPDATE` de `classificar()` acha a linha, não vira no-op) |

Derivação, contra a CTE `etapa_classificacao`
(`20260915115846_estrategia_kpi_situacao_mandatos.sql:165-181`):

- **Borda de atrasado**: `dt_ancora = CURRENT_DATE - 14`, `duracao_ref = 14` →
  `pct = 14/14*100 = 100,00` exato. Com `>=`: `100 >= 100` → `'atrasado'`. Com
  `>`: `100 > 100` é falso, cai no ramo seguinte, `100 >[=] 70` → `'atencao'`.
  O teste assere `atrasados = 1, atencao = 0` → **o mutante `>` faz o teste
  falhar**.
- **Borda de atenção**: `84/120*100 = 70,00` exato (o filtro `% 100 = 0`
  garante que a divisão `numeric` termina em 2 casas — é justamente o que o
  autor evitou ao não usar arredondamento). Com `>=`: `'atencao'`. Com `>`:
  ambos os ramos falham → `ELSE 'normal'`. O teste assere `atencao = 1,
  normal = 0` → **falha sob o mutante**.

**Mutante A morre nos dois ramos do `CASE`.**

A análise diz que o mutante morre; a **execução** diz que os testes de fato
rodam e passam contra o dev — os dois foram rodados por este verificador
(borda de atrasado 14,1s, borda de atenção 27,8s, ambos ✅). Isso fecha a
única coisa que a análise não alcança: que a etapa de borda existe no catálogo
(`expect(etapaExata).toBeDefined()` não estourou) e que o `UPDATE` de
`classificar()` acha a linha de `fat_etapa_contrato` daquela etapa em vez de
virar no-op silencioso.

Resíduo registrado (não é gap): o teste da borda de **atrasado** depende de
`etapa_atrasado = 100` sem ler a tabela. Se a operação recalibrar para, digamos,
90, `100 > 90` continua verdade e o mutante ressuscita **em silêncio** — o teste
seguiria verde. O teste da borda de **atenção** não tem esse problema: deriva o
percentual de `ref_limiar_pendencia` (AD-004, "limiar é dado, não código"). Vale
alinhar o primeiro ao segundo se 100 algum dia deixar de ser o valor.

---

## Gap 2 (🔴 KSM-11 sem teste) — **FECHADO**

`vw-estrategia-kpi.integration.test.ts:819-903`, describe
`"seed_cenarios_estrategia -- os 5 casos de classificação existem (KSM-11)"`.

- **Executa o seed de fato**: `:820-823` `beforeAll` →
  `readFile("supabase/seed_cenarios_estrategia.sql", "utf8")` → `runSql(sql)`.
  Não supõe que alguém rodou à mão, então também vale no CI (banco efêmero).
  O caminho é relativo, mas `vitest.integration.config.ts` não redefine `root`
  → resolve a partir da raiz do repo. ✅
- **As asserções falhariam se um estado sumisse** — `:881-887`:
  `atencao >= 1`, `normal >= 1`, `sem_etapa_atual >= 1`, `nao_ativo >= 1`,
  `atrasado >= 2`. Conferi a derivação do seed contra o catálogo real
  (`v_id_etapa_alvo = raio_x`, 21 dias; `v_id_etapa_ref = pontape`, 14 dias):
  atrasado 23d→109,5%, atenção 18d→85,7%, normal 7d→33,3%, sem-etapa 17d/14→121%
  (por isso `atrasado >= 2`), encerrado `status = 'concluido'`. Se o caso
  "atenção" colapsasse em "normal" por recalibração de limiar — o cenário
  exato que a Iteração 1 apontou —, `:881` falha. ✅
- **Robusto ao estado deixado pelos outros testes do arquivo**: o recorte é
  `ct.nome LIKE 'KPI Cenario %'` (`:853`), que **não** casa com
  `'T31 KPI Contratante Fixture'` — a fixture que os describes anteriores
  mutam. Isolamento por nome, não por ordem. Além disso o `beforeAll` re-roda
  o seed, que reancora as datas, então estado velho de execução anterior é
  corrigido antes de assertar. ✅
- **Idempotência**: `:890-903` roda o seed uma segunda vez e assere
  `contagem.contratos).toBe(5)` e `contratantes).toBe(5)` — igualdade exata,
  não `>=`, então duplicação reprova. ✅

Os dois foram **executados** por este verificador contra o dev: ✅ 5,2s e
8,8s. O seed roda do arquivo sem erro — o que também valida, de fato, o SQL
novo do Gap 5 (abaixo), que até aqui só tinha conferência estática de schema.

Ressalva (não invalida): o teste **não consulta `vw_estrategia_kpi`** — ele
re-deriva a classificação numa CTE própria (`:833-878`), que é uma **terceira**
cópia da regra (view, `limiar.ts`, e agora esta). O "Independent Test" do P3
(`spec.md:203`) diz literalmente "consultar a view". A AC de KSM-11
(`spec.md:186-189`) é sobre o **conjunto de dados**, não sobre a view, e é essa
que o teste cumpre integralmente; a concordância view × regra já é guardada
por `:806-812` (Independent Test global). Aceito, com a nota de que uma
deriva entre a CTE do teste e a view não seria vista por este teste.

---

## Gap 5, agravante da P4 (🟡 cenários sem recorte) — **FECHADO**

`supabase/seed_cenarios_estrategia.sql:82-92` cria o recorte
(`ref_projeto 'KPI Cenario Projeto'`, resolvido por nome antes de inserir;
`dim_usuario 'kpi-cenario-gestora@legislabrasil.test'` com
`ON CONFLICT (email) DO UPDATE`), e `:187-192` vincula **2 dos 5** cenários:
`UPDATE fat_contrato SET id_projeto = v_id_projeto` e `INSERT INTO
rel_usuario_contrato (…, 'gestora', 'nao_se_aplica') ON CONFLICT
(id_contrato, id_usuario, papel_no_contrato) DO NOTHING`.

Conferi que o SQL é válido contra o schema, não só plausível:
`uq_vinculo UNIQUE (id_contrato, id_usuario, papel_no_contrato)`
(`0008_plataforma_tabelas.sql:48`) é alvo legítimo do `ON CONFLICT`;
`'nao_se_aplica'` consta de `ck_vinculo_cargo` (`:50-51`); `dim_usuario.email`
é `UNIQUE` (`:24`) e o e-mail satisfaz `ck_usuario_email` (`:33`);
`papel_global = 'gestora'` satisfaz `ck_usuario_papel` (`:32`);
`dt_fim` nasce nulo, que é o que `contrato_escopo` exige para materializar a
linha de gestora (`20260915115846…sql:80-86`).

**Evidência contra o dev (somente leitura):**

| Consulta | Resultado |
| --- | --- |
| Os 5 cenários | `Atrasado` e `Atencao` com `id_projeto = 93` e 1 gestora; `Normal`, `Sem Etapa`, `Encerrado` com `id_projeto` nulo e 0 gestoras |
| `vw_estrategia_kpi` — `escopo_projeto = true AND id_projeto = 93` | `ativos=2 atras=1 aten=1 norm=0` |
| `vw_estrategia_kpi` — `escopo_gestora = true`, gestora de cenário | `ativos=2 atras=1 aten=1 norm=0` |

O recorte **existe, fecha (1+1+0 = 2) e esconde os outros 3** — que era
exatamente a condição que faltava para a P4 ser conclusiva sob filtro. O
"Aviso para quem rodar a P4" da Iteração 1 está **revogado**.

---

## O que NÃO mudou

| Gap da Iteração 1 | Estado após `33c67b4` |
| --- | --- |
| **4** 🟡 KSM-05 só exercita um limiar; edge case "os dois limiares desligados" | **aberto** — nenhum teste novo; `:557-579` e `:605-622` seguem desligando só `etapa_atrasado` |
| **5** 🟡 KSM-07 sem asserção positiva em linha `escopo_gestora = true` | **aberto na metade automatizada** — `grep` por `escopo_gestora` no arquivo: todo helper de classificação ainda lê `escopo_gestora = false` (`:478`, `:521`, `:566`). O que fechou foi só o agravante da P4 (acima) |
| **6** 🟡 KSM-13: metade destrutiva não versionada | **aberto** — decisão registrada em `tasks.md`, aguarda reescrita da AC ou aceite do Pedro |
| **7** 🟡 KSM-10 sem teste de página | **aberto** — segue sem arquivo de teste em `app/(app)/produtos/[slug]/dashboard/` |
| **8** 🟡 KSM-18: foco visível não asserido; 2 tab stops por card | **aberto** — nenhuma regra `focus-visible` adicionada; confirmar na P4 |
| **9** 🟢 edge cases residuais (produto sem etapa; mandato com >1 gestora) | **aberto**, risco baixo |
| **10** 🟢 AD-050/AD-051 fora da faixa de commits | **aberto** — `.specs/STATE.md` segue **modificado e não commitado** (176 linhas pendentes); `.specs/roadmap.md` continua sem entrada para `kpi-status-mandatos-ativos`. Bookkeeping |

**KSM-09 / KSM-14 / KSM-15** seguem ⏸ **pendentes**: dependem de conferência
humana na tela (P4 / T7, "Não iniciada" em `tasks.md:27`). Pendência por
natureza, não reprovação — a seção de P4 mais abaixo continua válida e por
preencher, agora **com cenário de recorte semeado**.

Este relatório (`validation.md`) continua **não rastreado** pelo git.

### Placar de mutação consolidado (as duas iterações)

| # | Mutação | Iteração 1 | Iteração 2 |
| --- | --- | --- | --- |
| A | `>=` → `>` nos dois limiares da CTE | 🔴 sobrevive | ✅ morto (analítico, parâmetros lidos do dev) |
| B | inverter ramos `atrasado`/`atencao` | ✅ morto | — |
| C | `COALESCE(fec.dt_inicio, c.dt_inicio)` → só `c.dt_inicio` | ✅ morto | — |
| D | remover `WHERE c.status = 'ativo'` | ✅ morto | — |
| E | `href` do card → `/contratos/1` | ✅ morto | — |
| F1 | remover `activationConstraint` | 🔴 sobrevive | ✅ **morto, executado** |
| F2 | `ATIVACAO_ARRASTE_PX = 0` (circularidade) | — | ✅ **morto, executado** |
| F3 | `ATIVACAO_ARRASTE_PX = 1` (magnitude) | — | 🔴 sobrevive (resíduo aceito) |

**Mortos: 7 · Sobreviventes: 1** (F3, magnitude — aceito).

### Estado do working tree (2ª iteração)

As três mutações (F1, F2, F3) foram aplicadas **só** em
`src/frontend/components/estrategia/quadro-acompanhamento.tsx` e revertidas com
`git checkout -- <arquivo>`. `git diff HEAD` ao fim **não lista nenhum arquivo
desta feature**: só as modificações pré-existentes e alheias
(`.specs/STATE.md`, `CLAUDE.md`, os 4 de `planejamento`) e os não rastreados
que já estavam lá. Nenhuma migration foi mutada; nenhum `db push`; toda
consulta ao dev foi `SELECT`.

---

# Iteração 1 — Veredito: **FAIL** (histórico)

> Registro original de 2026-09-15, faixa `05e4e9c~1..05e4e9c`, **anterior** ao
> commit `33c67b4`. Mantido íntegro. Os gaps 1, 2, 3 e o agravante do 5 foram
> fechados na Iteração 2 (acima); os demais continuam válidos.

## Veredito: **FAIL** (falha de cobertura, não de comportamento observado)

**Nenhuma incorreção de comportamento foi encontrada.** A migration, a query e
os dois componentes fazem o que a spec pede, e os gates rodaram verdes. O que
reprova é a **cobertura**: **2 dos 5 mutantes que o próprio design nomeou como
"o que o Verifier deve conseguir matar" sobrevivem**, um requisito de MVP
(KSM-17) não tem nenhuma asserção, e a P4 (KSM-14/KSM-15) — que existe
justamente porque gate verde já entregou tela errada em 14/09 — não foi
executada.

Faixa de commits coberta: `05e4e9c~1..HEAD` — `05e4e9c` (T6), `79da53b`
(T4+T5), `e5f248e` (T3), `b3c949b` (T1 + specs).

### Gates executados por este verificador

| Gate | Comando | Resultado |
| --- | --- | --- |
| Unit | `npm run test:unit` | ✅ 73 arquivos / **774 testes**, 68s |
| Integração da view | `npx vitest run --config vitest.integration.config.ts supabase/tests/estrategia/vw-estrategia-kpi.integration.test.ts` | ✅ **23/23**, 369,8s |
| Lint | `npm run lint:all` | ❌ 10 erros — **nenhum em arquivo desta feature** (ver abaixo) |
| Integração completa | `npm run test:integration` | **não rodado** (trava por horas contra a nuvem; registrado em tasks.md) |

Lint: os 14 arquivos com problema são `coalizoes/[id]/page.tsx`,
`coalizoes/coalizao-form.tsx`, `coalizoes/page.tsx`,
`contratos/[id]/vinculos/page.tsx`, `contratos/page.tsx`,
`mandatos/[id]/contratos/novo/page.tsx`, `mandatos/[id]/page.tsx`,
`mandatos/page.tsx`, `usuarios/page.tsx`, `fundacao/contrato-form.tsx`,
`fundacao/mandato-card.tsx`, `fundacao/mandato-wizard.tsx`,
`incidencia/encontro-form.tsx`, `incidencia/iip-card.tsx`. **Confirmado: nenhum
dos 6 arquivos de código desta feature aparece na lista.** Passivo pré-existente.

Ambiente: `supabase/.temp/project-ref` = `npnvoolkebhabjkjzqwn` = **dev**
(`docs/ambientes.md:19`). Nenhum `db push` foi executado por este verificador.

---

## Evidência por requisito

Regra: sem `file:line` localizado = **não coberto**. Valor asserido conferido
contra o resultado que a spec define.

| Req | Evidência (`file:line` + asserção) | Esperado pela spec | Status |
| --- | --- | --- | --- |
| **KSM-01** | `kpi-row.test.tsx:59` `expect(screen.getAllByRole("group")).toHaveLength(5)`; `kpi-row.test.tsx:55-57` loop sobre `ROTULOS` (5 rótulos, `:43-49`); `kpi-row.test.tsx:65` `expect(screen.queryByText("Mandatos em atraso")).not.toBeInTheDocument()` | faixa com 5 cards, nenhum "Mandatos em atraso" | ✅ |
| **KSM-02** | `kpi-row.test.tsx:152-154` `getByText(/atrasados/)`→`"4"`, `/atenção/`→`"3"`, `/normal/`→`"18"`; `:156` `getByText("25")` | número grande + 3 linhas com contagem | ✅ |
| **KSM-03** | `vw-estrategia-kpi.integration.test.ts:581-603` — varre **toda** a view (`WHERE COALESCE(atrasados,0)+COALESCE(atencao,0)+COALESCE(normal,0) <> mandatos_ativos`) e `expect(violacoes).toEqual([])` (`:602`); reconstrução independente em `:684-753` `expect(divergencias).toEqual([])` | soma das 3 = número grande **em toda linha** | ✅ |
| **KSM-04** | `…integration.test.ts:531-536` `classificarSemEtapaAtual(duracaoTeste+5)` → `atrasados=1, atencao=0, normal=0`; lado oposto em `:538-543` `classificarSemEtapaAtual(0,3×duracao)` → `normal=1, atrasados=0`. SQL: `20260915115846…sql:145-151` (`ORDER BY e.ordem LIMIT 1` sob `ON c.id_etapa_atual IS NULL`) e `:135` `COALESCE(fec.dt_inicio, c.dt_inicio)` | classificado pela etapa de menor ordem, ancorado em `fat_contrato.dt_inicio` | ✅ |
| **KSM-05** | `…integration.test.ts:570` `expect(linha.mandatos_atraso_atrasados).toBeNull()`; `:575` `expect(linha.mandatos_atraso_atencao).toBe(1)`; fechamento preservado em `:618` `expect(violacoes).toEqual([])`. UI: `kpi-row.test.tsx:176` `getByText(/atrasados/)` → `"—"` com `:172-173` mostrando `3`/`18` intactos | coluna vira NULL (não 0), contratos descem para atenção/normal, fechamento mantido | ⚠️ parcial — só `etapa_atrasado` desligado; ver Gap 4 |
| **KSM-06** | `estrategia-kpi.test.ts:130-139` recorte sem linha → os 8 campos `null`; `kpi-row.test.tsx:89` `getAllByText("—")` = 5 e `:92` `queryByText("0")` ausente; lado oposto em `:112` (`0` medido renderiza `0`) | tudo "—", nunca 0 | ✅ |
| **KSM-07** | `…integration.test.ts:482-501` (as 3 asserções de estado leem a linha de recorte `escopo_projeto=true AND id_projeto=…`, helper `classificar()` `:475-478`); fechamento sob recorte via KSM-03 (`:602`, varre linhas de recorte também) | recorte reflete só os mandatos daquele corte, soma continua fechando | ⚠️ parcial — nenhuma asserção positiva da quebra numa linha `escopo_gestora=true`; ver Gap 5 |
| **KSM-08** | `…integration.test.ts:624-643` `expect(violacoes).toEqual([])` sobre `VALUES` das 4 colunas (`mandatos_ativos`, atrasados, atencao, normal) comparando recorte × linha total | nenhum valor de recorte > valor total | ✅ |
| **KSM-09** | — nenhuma asserção localizada. Design remete a P4 (validação ao vivo), que não rodou | contagem por status = nº de chips do Quadro no mesmo filtro | ❌ **sem evidência** (Gap 3) |
| **KSM-10** | `dashboard/page.tsx:106` `queryKey: ["estrategia-kpi", idProduto, filtro]` — propriedade arquitetural, nenhum teste | troca de filtro atualiza sem recarga | ⚠️ **spec-precision gap** (Gap 7) |
| **KSM-11** | `supabase/seed_cenarios_estrategia.sql:76-83` cria os 5 casos. **Nenhum teste referencia `"KPI Cenario"`** (grep em `supabase/` e `src/`) | os 5 casos aparecem na view após o seed (promessa explícita do design, "Estratégia de teste") | ❌ **não coberto** (Gap 2) |
| **KSM-12** | Processo: `supabase/.temp/project-ref` = `npnvoolkebhabjkjzqwn` = dev (`docs/ambientes.md:19`), reconferido por este verificador; registro em `tasks.md` "Registro de execução" | recomposição só em dev, ref conferido | ✅ (evidência de processo) |
| **KSM-13** | `supabase/seed_cenarios_estrategia.sql` versionado (commit `b3c949b`) | recomposição nasce de arquivo versionado, nunca de SQL rodado à mão | ⚠️ parcial — a metade destrutiva (DELETE de 28 contratos) foi rodada à mão e **não** versionada por decisão explícita (`tasks.md`); ver Gap 6 |
| **KSM-14** | — | números observados na tela por recorte | ⏸ **pendente** (T7 não iniciada) |
| **KSM-15** | — | divergência tela × view reprova | ⏸ **pendente** (T7 não iniciada) |
| **KSM-16** | `quadro-acompanhamento.test.tsx:123` `href="/contratos/10"`; `:134` segundo card → `"/contratos/77"` (mata id fixo); `:159` card de Prospecção não vira link. Implementação: `quadro-acompanhamento.tsx:212` `<Link href={\`/contratos/${card.idContrato}\`}>` **dentro** do nó arrastável | clique navega para `/contratos/[idContrato]` | ✅ (mutante executado e morto) |
| **KSM-17** | **nenhuma asserção localizada.** Nenhum teste exercita `onMoverCard`, `handleDragEnd` ou o `activationConstraint` de `quadro-acompanhamento.tsx:65` | arraste >8px executa transição de etapa e **não** navega | ❌ **não coberto — mutante sobrevivente** (Gap 1) |
| **KSM-18** | `quadro-acompanhamento.test.tsx:153` `getByRole("link", { name: /Dep\. Ana Ribeiro/ })` com `href` — `<a>` com `href` é tabulável e ativável por Enter por construção | alcançável por Tab, ativável por Enter, **com indicador de foco visível** | ⚠️ parcial — "foco visível" não asserido e não estilizado; segunda tab stop do dnd-kit não navega; ver Gap 8 |
| **KSM-19** | `quadro-acompanhamento.test.tsx:145` card com `statusContrato: "concluido"` → `href="/contratos/10"` | contrato não ativo continua clicável | ✅ |

**Placar:** 9 ✅ · 5 ⚠️ parcial/spec-precision · 3 ❌ sem cobertura · 2 ⏸ pendentes.

### Edge Cases da spec

| Edge case | Evidência | Status |
| --- | --- | --- |
| Etapa de referência sem `duracao_prevista_dias` → fora das 3 linhas | `…integration.test.ts:545-555` (`545`: fixture de etapa sem duração; `552-554`: as 3 contagens = 0) | ✅ |
| Produto sem nenhuma etapa → fora das linhas | — | ❌ não coberto (baixo risco: `LIMIT 1` devolve NULL, `WHERE duracao_ref IS NOT NULL` exclui) |
| Contrato não ativo fora do número grande e das linhas | `…integration.test.ts:243-255` (`mandatos_ativos` = 1 com 2 contratos); SQL `20260915115846…sql:158` `WHERE c.status = 'ativo'` | ✅ (mutante executado analiticamente e morto) |
| Mandato com >1 gestora contado uma vez | `COUNT(DISTINCT ce.id_contrato)` (`…sql:188`, `203-206`) — sem teste dedicado | ⚠️ não coberto |
| **Os dois limiares inativos** → atrasados e atenção "—", normal = número grande | — | ❌ **não coberto** (Gap 4) |
| Falha de leitura → `ErroInline` com retry sem derrubar o Quadro | `dashboard/page.tsx:216-219`; `estrategia-kpi.test.ts:206-214` (erro propaga) | ✅ |

---

## Sensor de discriminação (mutação)

Todas as mutações foram aplicadas em **estado descartável** e revertidas com
`git checkout -- <arquivo>`. **Nenhuma migration mutada foi aplicada ao banco**
(`db push` não foi executado). `git status` conferido antes e depois: limpo das
mutações.

| # | Mutação | Modo | Resultado |
| --- | --- | --- | --- |
| A | `>=` → `>` nos dois limiares da CTE `etapa_classificacao` (`…sql:170`, `:173`) | analítico + **consulta read-only ao dev** | 🔴 **SOBREVIVE** |
| B | inverter a ordem dos ramos `atrasado`/`atencao` no `CASE` (`…sql:168-176`) | analítico + read-only | ✅ morto |
| C | `COALESCE(fec.dt_inicio, c.dt_inicio)` → só `c.dt_inicio` (`…sql:135`) | analítico + read-only | ✅ morto |
| D | remover `WHERE c.status = 'ativo'` de `etapa_referencia` (`…sql:158`) | analítico + read-only | ✅ morto |
| E | `href` do card → `/contratos/1` (`quadro-acompanhamento.tsx:212`) | **executado** | ✅ morto — **4 de 12** testes falharam |
| F | remover `activationConstraint: { distance: 8 }` do `PointerSensor` (`quadro-acompanhamento.tsx:65`) — mutação extra deste verificador | **executado** | 🔴 **SOBREVIVE** — 12/12 passam |

**Mortos: 4 · Sobreviventes: 2.**

### Como cada conclusão foi obtida

Para as mutações de SQL não havia caminho seguro de execução (aplicar a view
mutada exigiria `db push` contra o dev compartilhado, proibido). Em vez de
parar na análise, as conclusões foram **ancoradas em dados reais** por duas
consultas **somente leitura** (`SELECT`) contra o dev, que reproduzem a
classificação a partir do enunciado da spec e contam quantas linhas cada
mutante mudaria. Estado do banco no momento da verificação: **9 contratos
ativos, todos classificáveis; 1 contrato não ativo, também classificável;
limiares 70 / 100 ativos**.

- **A (`>=` → `>`) — SOBREVIVE, confirmado por dados.** A consulta mostrou
  `exatamente_no_limiar_atrasado = 0` e `exatamente_no_limiar_atencao = 0`: não
  existe, hoje, nenhum contrato exatamente sobre 70% ou 100%, então o mutante
  devolve a view idêntica linha por linha e o "Independent Test" global
  (`:684-753`) não o vê. As fixtures também não encostam na borda por
  construção — `duracaoTeste + 5` (>100%), `Math.round(duracaoTeste * 0,8)`
  (80%) e `Math.round(duracaoTeste * 0,3)` (30%) — e o seed afasta-se
  deliberadamente das duas bordas (`seed_cenarios_estrategia.sql:123-128`:
  `+2` acima do limiar de atrasado, e o caso "atenção" posicionado no meio da
  folga entre os dois). **O limiar é testado pelo meio do intervalo, nunca pela
  borda** — que é exatamente o que `>=` versus `>` decide.
- **B (ordem invertida) — morto.** 5 contratos ativos estão hoje em
  `pct >= 100`; invertidos os ramos, os 5 migram de `atrasado` para `atencao`.
  Falham `…integration.test.ts:484-486` (fixture direta) e `:753` (reconstrução
  global).
- **C (`c.dt_inicio` só) — morto.** 2 contratos ativos mudam de estado com a
  âncora trocada → `:753` falha. Além disso, os três testes de estado
  (`:482-501`) passam a devolver a **mesma** classificação nos três casos (a
  âncora deixa de depender de `diasNaEtapa`), então ao menos 2 dos 3 falham.
- **D (sem `status = 'ativo'`) — morto.** O único contrato não ativo do dev é
  classificável (duração de referência presente): ele entraria numa das 3
  colunas sem entrar em `mandatos_ativos`, quebrando o fechamento de
  `:581-603`. O fixture concluído da própria suíte (`:113` `t31-kpi-concluido`,
  `dt_inicio = CURRENT_DATE - 90`, `id_etapa_atual` nulo) reproduz a violação
  na linha de recorte do projeto. `:753` também falha (a CTE `referencia` do
  teste filtra por `status='ativo'`).
- **E (`href` fixo) — morto, executado de verdade.** Falharam
  `quadro-acompanhamento.test.tsx:123`, `:134`, `:145` e `:153`.
- **F (sem `activationConstraint`) — sobrevive, executado de verdade.** É a
  mutação que o próprio design descreve como fatal: *"sem essa distância o
  dnd-kit consome o `pointerdown` e o clique nunca chega ao link"*
  (`design.md`, §4). Removida, o card deixa de navegar ao clique — e os 12
  testes continuam verdes.

---

## Gaps ranqueados

### 1. 🔴 KSM-17 não tem nenhuma asserção, e o mutante que o quebra sobrevive

`spec.md` P1-B AC2 ("arrastar >8px executa a transição e **não** navega") é um
critério de MVP. Não há um único teste que exercite `onMoverCard`,
`handleDragEnd` ou o `activationConstraint`. A mutação F foi **executada**:
removido o `activationConstraint: { distance: 8 }` de
`quadro-acompanhamento.tsx:65`, a suíte segue **12/12 verde**.

Por que isto importa mais que um teste faltando: o `activationConstraint` é a
única coisa que faz KSM-16 e KSM-17 coexistirem. Sem ele, o clique para de
funcionar (a regressão que esta feature veio corrigir) **ou** o arraste passa a
navegar — e o gate não vê nenhum dos dois. A feature reintroduz, na dimensão
do arraste, exatamente o buraco de cobertura que produziu a regressão original
descrita em `spec.md` ("a regressão passou despercebida porque o projeto não
tem harness de teste de componente" — harness que **existe**, e foi usado para
KSM-16 mas não para KSM-17).

**Fechamento sugerido**: teste que renderiza com `onMoverCard` espiado e
dispara uma sequência pointerdown → pointermove (>8px) → pointerup, asserindo
`onMoverCard` chamado; e um teste de guarda sobre a presença do
`activationConstraint` (ex.: espiar `useSensor`), que é barato e mata F
diretamente.

### 2. 🔴 KSM-11 sem teste — o design prometeu um e ele não existe

`design.md` "Estratégia de teste" declara: *"KSM-11 a KSM-13 | integração |
após o seed, os 5 casos aparecem na view"*. `grep` por `"KPI Cenario"` em
`supabase/` e `src/` só acha o próprio seed
(`seed_cenarios_estrategia.sql:78-82`). Não existe asserção de que os 5
cenários estão na view.

Consequência prática: o seed é idempotente e reancora datas a cada execução,
mas **nada detecta se ele parar de produzir os 5 estados** — por exemplo se a
operação recalibrar `ref_limiar_pendencia` e o caso "atenção" colapsar em
"normal". A P3 existe precisamente para que a validação ao vivo distinga "KPI
errado" de "não havia o que classificar", e essa distinção não está guardada
por nada.

### 3. 🔴 Limiar testado pelo meio, nunca pela borda (mutante A sobrevive)

Nenhuma fixture, nem no teste de integração nem no seed, posiciona um contrato
**exatamente** sobre 70% ou 100% da duração. Confirmado contra o dev: zero
contratos na borda. A escolha `>=` — preservada deliberadamente de
`20260914161230` e reafirmada no comentário `…sql:160-164` como réplica de
`classificarLimiar` — é, portanto, **não verificada**: trocar por `>` não muda
nenhuma linha da view nem faz nenhum teste falhar.

**Fechamento sugerido**: um caso a mais em `classificar()` com
`diasNaEtapa = duracaoTeste` (exatamente 100%) esperando `atrasado`, e outro
com `Math.round(duracaoTeste * 0.7)` esperando `atencao`. Custo: dois testes na
suíte que já existe.

### 4. 🟡 KSM-05 só exercita um dos dois limiares; o edge case dos dois desligados não é testado

`…integration.test.ts:557-579` e `:605-622` desligam apenas `etapa_atrasado`.
A spec lista explicitamente em Edge Cases: *"WHEN os dois limiares estão
inativos THEN 'atrasados' e 'atenção' SHALL exibir '—' e 'normal' SHALL igualar
o número grande"* — caso não coberto. Também não há teste com só
`etapa_atencao` desligado (cenário em que a coluna `atencao` vira NULL e os
contratos entre 70% e 100% precisam descer para `normal` sem furar o
fechamento).

### 5. 🟡 KSM-07: a quebra nunca é asserida numa linha de recorte por gestora

O helper `classificar()` (`…integration.test.ts:475-478`) lê sempre
`escopo_gestora = false`. As linhas de gestora entram no fechamento (`:602`) e
no teto (`:642`), mas **nenhuma asserção positiva** confirma que a carteira de
uma gestora recebe a classificação certa nos três baldes — que é o sintoma
literal do P2 ("o card pode fechar sem filtro e mentir sob recorte").

Agravante para a P4: os 5 contratos do seed nascem **sem `id_projeto` e sem
vínculo em `rel_usuario_contrato`** (`seed_cenarios_estrategia.sql:105-116`).
Eles existem apenas nas linhas `escopo_projeto = false, escopo_gestora = false`
— ou seja, **a conferência ao vivo sob filtro de gestora ou de projeto não tem
nenhum cenário semeado para observar**. O pré-requisito P3 não cobre o recorte
que o P2 pede.

### 6. 🟡 KSM-13: a metade destrutiva da recomposição não é versionada

A AC diz: *"a recomposição SHALL nascer de arquivo versionado … nunca de SQL
rodado à mão"*. O repovoamento cumpre (`seed_cenarios_estrategia.sql`,
`b3c949b`); o **apagamento dos 28 contratos** foi SQL rodado à mão e
deliberadamente não versionado (`tasks.md`: *"um arquivo de DELETE em massa no
repo é uma arma apontada para produção"*).

O argumento é defensável e foi registrado, mas é um **desvio da AC como
escrita**, não um cumprimento. Ou a AC se reescreve para "a recomposição
construtiva nasce de arquivo versionado; a destrutiva fica registrada em
`tasks.md`/`validation.md` com a lista exata", ou o desvio precisa de aceite do
Pedro. Hoje a operação existe só como prosa — a lista exata das 11 tabelas /
~485 linhas apagadas **não** está no repositório, só a contagem.

### 7. 🟡 KSM-10 "por construção" é aceitável, mas há precedente contra

`dashboard/page.tsx:106` de fato inclui `filtro` na `queryKey`, e a lição L-017
justifica não testar propriedade arquitetural. **Porém** o próprio projeto já
testa essa mesma classe de propriedade no nível de página: a suíte unitária tem
*"Agenda (EST-12 AC3) — navegar de mês refaz a consulta"*, que monta a página e
prova que a troca de coordenada dispara consulta nova. Não existe teste
equivalente para o Dashboard (não há **nenhum** arquivo de teste em
`app/(app)/produtos/[slug]/dashboard/`).

Classificação: **spec-precision gap** de severidade baixa — a propriedade é
verdadeira hoje, mas a justificativa "não é testável/não vale testar" é
contrariada por precedente no mesmo repositório.

### 8. 🟡 KSM-18: "foco visível" não asserido, e o primeiro tab stop do card não navega

Dois pontos distintos:

- **Foco visível** — a AC pede "com indicador de foco visível". O `<Link>`
  (`quadro-acompanhamento.tsx:212`) tem só `className="block"`; nem ele nem
  `components/ui/card.tsx` nem `globals.css` definem qualquer regra
  `focus-visible`/`:focus`. O card depende inteiramente do anel de foco padrão
  do navegador. Nada é asserido. **⚠️ spec-precision gap**: a AC afirma um
  requisito visual que o design decidiu resolver por omissão ("confia no foco
  nativo", `design.md` §4) sem dizer que essa é a decisão.
- **Dois tab stops por card** — os `{...attributes}` do `useDraggable`
  (`quadro-acompanhamento.tsx:200`) colocam `role="button"` e `tabIndex={0}` no
  `<div>` externo. Tabulando, o **primeiro** foco de cada card cai no nó
  arrastável, onde `Enter` aciona o `KeyboardSensor` (inicia arraste), não a
  navegação; só o **segundo** Tab alcança o `<Link>`. A AC ("cada card SHALL
  ser alcançável por `Tab` e ativável por `Enter`") é satisfeita na letra —
  existe um caminho — mas o comportamento do primeiro `Enter` não é o que a
  gestora espera. O design assume os dois focáveis como decisão consciente;
  vale confirmar na P4.

### 9. 🟢 Edge cases residuais sem teste (risco baixo, registrar)

- Produto sem nenhuma etapa cadastrada (`ORDER BY ordem LIMIT 1` vazio) — a
  proteção existe (`…sql:179-180` `WHERE duracao_ref IS NOT NULL`), sem teste.
- Mandato com mais de uma gestora ativa contado uma única vez — garantido por
  `COUNT(DISTINCT ce.id_contrato)` (`…sql:188`, `:203-206`), sem teste.

### 10. 🟢 AD-050 e AD-051 estão fora da faixa de commits

`.specs/STATE.md:892` (AD-050) e `:916` (AD-051) existem, mas o arquivo está
**modificado e não commitado** — as duas decisões que a migration e os
componentes citam em comentário não entraram em nenhum dos 4 commits da faixa.
`.specs/roadmap.md` não tem entrada para `kpi-status-mandatos-ativos`.
Bookkeeping, não comportamento.

---

## P4 — Validação ao vivo (KSM-09, KSM-14, KSM-15): **NÃO EXECUTADA**

T7 está como "Não iniciada" em `tasks.md`. Esta seção existe para ser
preenchida por quem abrir o Dashboard renderizado; ela **não** é substituível
pelo resultado das suítes — foi exatamente essa substituição que produziu o
retrabalho de 14/09 ("gate verde, tela errada", `spec.md` P4).

Registrar aqui, por recorte:

| Recorte | Mandatos ativos (nº grande) | atrasados | atenção | normal | Soma fecha? | Bate com os chips do Quadro? |
| --- | --- | --- | --- | --- | --- | --- |
| Sem filtro | | | | | | |
| Filtro de gestora `<nome>` | | | | | | |
| Filtro de projeto `<nome>` | | | | | | |

Conferir também, na mesma passagem:

- [ ] Clique num card do Quadro abre `/contratos/[id]` (KSM-16 — mutante morto
      no gate, mas nunca exercitado num navegador real)
- [ ] Arraste de um card move a etapa e **não** navega (KSM-17 — **sem
      cobertura automatizada nenhuma**; esta é a única verificação existente
      hoje)
- [ ] O card não some/clipa ao ser arrastado (colunas `h-[520px]
      overflow-y-auto` sem `DragOverlay`, risco registrado em `spec.md`)
- [ ] `Tab` alcança o card e `Enter` abre a ficha, com foco visível (KSM-18,
      Gap 8 — atenção ao primeiro tab stop)

**Aviso para quem rodar a P4**: os 5 cenários do seed não têm projeto nem
gestora vinculada (Gap 5). Sob qualquer filtro, eles desaparecem — o recorte
precisará ser conferido contra contratos pré-existentes, ou o seed estendido
antes.

---

## Estado do working tree

Todas as mutações revertidas por `git checkout -- <arquivo>`. `git status` ao
fim da verificação mostra apenas as modificações **pré-existentes e alheias a
esta feature** (`.specs/STATE.md`, `CLAUDE.md`, os 4 arquivos de
`planejamento`, e `.claude/skills/figma-dominio-legisla/` não rastreado).
Nenhum arquivo desta feature aparece modificado.
