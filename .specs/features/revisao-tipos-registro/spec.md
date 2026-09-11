# Revisão dos tipos de registro — Specification

> **Aplicação do protocolo `docs/redesenho-tela-first.md` (AD-038).** A checagem de
> conformidade do §3 está embutida na seção *Checagem de conformidade*, conforme
> exige o §4. O contexto pré-spec, o mapa de dependências completo e as perguntas
> levadas à operação estão em [`context.md`](context.md).

- **Insumo de origem:** os **10 checklists de registro** da operação de Estratégia,
  com seus campos, trazidos por Pedro em 2026-09-10 (transcritos em `context.md`).
- **Gate AD-039:** ✅ satisfeito — o inventário veio de quem opera, não de planilha.
- **Pré-requisito de:** Fase 7 (Agenda, T25–T30) de
  `.specs/features/redesenho-estrategia-tela-first/`.
- **Data:** 2026-09-10

---

## Problem Statement

`ref_tipo_registro` foi semeado, nas palavras do próprio seed
(`20260810193327:79`), "derivado **literalmente** das abas de 'Registros Slack' e
f_mentorias" — transcrição de planilha que nunca passou por quem opera. É a mesma
origem das telas que AD-038 diagnostica como não-usadas, e deixou uma pendência
explícita aberta desde então nas jornadas §10.1: *"`legisla_aliada` … entrou no
catálogo para não se perder (confirmar com a operação se segue ativo)"*.

A consulta à operação mostrou que o catálogo estava **quase certo**: 9 dos 10 tipos
de Estratégia correspondem a um checklist real. As divergências são três, e todas
pequenas — um nome que a operação não usa, um rótulo desatualizado, e um tipo que
ninguém listou.

## Goals

- [ ] Os nomes do catálogo passam a ser os nomes que a operação usa, sem tradução mental.
- [ ] `legisla_aliada` deixa de ser pendência aberta — confirmado ou aposentado, por escrito.
- [ ] A Fase 7 da feature irmã renderiza badges de tipo que existem de fato.
- [ ] Nenhuma linha de `fat_registro` perde o tipo, e nenhum teste passa a mentir.

## Out of Scope

| Item | Motivo |
| :-- | :-- |
| **`rel_registro_participante`** — o campo "Presentes" | Os **10** checklists pedem "Presentes", e o modelo aprovado **não tem** onde guardar isso para um registro (só `rel_encontro_participante`, que é do encontro). É lacuna de **modelo**, não de catálogo: exige tabela nova e decisão sobre registro-sem-encontro. Fica registrado como achado e não entra aqui. Não bloqueia a Fase 7, cuja lista mostra "Responsável", não "Presentes". |
| Popular `ref_tipo_registro.schema_campos` | A coluna existe e está vazia em todas as 11 linhas. Declarar os campos por tipo exige fechar o contrato do JSONB **e** a renderização de formulário — feature própria. Esta spec ajusta **quais linhas existem**, não o que cada uma declara. |
| Estrutura de `ref_tipo_registro` | Nenhuma coluna, constraint ou índice muda. Correção de conteúdo, mesma natureza da `20260812163617`. |
| `ref_etapa`, `ref_formulario` | Intocados. O renome da etapa (AD-045) já foi decidido e tem migration própria. |
| Tipos do PLL | A consulta cobriu a operação de **Estratégia**. `mentoria` fica exatamente como está. |
| Qualquer tela | Esta feature entrega catálogo. A Fase 7 consome. |
| Edição do catálogo por tela | Não foi pedida (E4 sem resposta). Se vier, aciona AD-006 e exige AD nova — ver checagem. |

---

## Checagem de conformidade (protocolo §3)

### Travas técnicas

| Trava | Veredito |
| :-- | :-- |
| **AD-030** · `ref_*` é GRANT-only, não RLS | ✅ satisfeito e **herdado**. `20260810192209:31` já fez `DISABLE ROW LEVEL SECURITY` e `:50` o `GRANT SELECT`; `20260810193545` revogou os default privileges de `anon`. `UPDATE` de linha não toca em política — **nenhum GRANT novo**. |
| **AD-005** · ausência é `NULL`, nada inventado | ✅ respeitado por construção. Tipo aposentado sai por `ativo = false`, nunca `DELETE` nem rótulo de fallback. `buscarRegistrosDaEtapa` (`incidencia.ts:179`) **não** filtra `ativo`, então linha histórica segue exibindo o nome real. |
| **AD-004** · limiar em tabela editável | ✅ conforme. `qtd_prevista` já é o limiar e já vive no catálogo. ⚠️ **Granularidade não confirmada**: a operação não respondeu se são sempre 4 monitoramentos (B4). Mantido 4 como assumption — ver Assumptions. |
| **AD-006** · autor e timestamp em toda escrita | ✅ **N/A por construção**: catálogo muda por migration, e o arquivo versionado é o rastro. 🔴 **Passaria a valer** se o catálogo ganhasse edição por tela — fora de escopo, e exigiria AD nova. |
| **AD-001** · restrição na RLS | N/A — catálogo legível por toda role autenticada, deliberadamente (AD-030). |
| **AD-002** · sem acesso anônimo | N/A — nenhuma superfície pública. |
| **AD-003** · número novo exige camada Saída | N/A — nenhum número de gestão. |

**Nenhuma AD nova é necessária.** As três mudanças são correção de conteúdo de
catálogo, a mesma natureza já precedida por `20260812163617`.

### Cobertura de dado — os campos dos 10 checklists contra `docs/schema_sistema.sql`

Protocolo §3.1: cada campo cruzado com o modelo aprovado. Resultado notável — **o
modelo já cobre praticamente tudo**; o que estava errado eram as linhas do catálogo.

| Campo do checklist | Destino no modelo | Situação |
| :-- | :-- | :-- |
| **Data** (10 de 10) | `fat_registro.ocorrido_em` | ✅ já existe |
| **Resumo** (9 de 10) | `fat_registro.resumo` | ✅ já existe — e fora do JSONB de propósito (`COMMENT`: "campo sempre exibido não fica dentro de JSON") |
| **Presentes** (10 de 10) | — | 🔴 **não existe em lugar nenhum.** Só há `rel_encontro_participante`, do encontro. Ver Out of Scope. |
| **Número da reunião semanal** (#6) | `fat_registro.nr_sequencia` | ✅ já existe |
| **Número do monitoramento** (#10) | `fat_registro.nr_sequencia` | ✅ já existe |
| **Link Termo de compromisso** (#1) | `fat_artefato` tipo `termo_assinado` | ✅ já existe |
| **Link Mapa Político** (#3) | `fat_artefato` tipo `mapa_politico` | ✅ já existe |
| **Link Escuta Diagnóstica** (#4) | `fat_artefato` tipo `escuta_diagnostica` | ✅ já existe |
| **Link Material Compartilhado** (#7) | `fat_artefato` tipo `material_replicacao` | ✅ já existe |
| **Link cronograma** (#8) | `fat_artefato` tipo `cronograma` | ✅ já existe |
| **Link pré-planejamento** (#8) | `fat_artefato` tipo `pre_planejamento` | ✅ já existe |
| **Link mural** (#8) | `fat_artefato` tipo `mural` | ✅ já existe |
| **Fotos** (#8) | `fat_artefato` tipo `foto` | ✅ já existe |
| **Link do organograma** (#9) | `fat_artefato` tipo `organograma` | ✅ já existe |
| **Link planilha de monitoramento** (#8) | `fat_artefato` tipo `planilha_legada` ou `outro` | ⚠️ existe, mas sem tipo dedicado — o único link sem correspondência exata |
| **Local** (#8, Imersão) | `fat_encontro.local` | ✅ existe no **encontro**, não no registro |
| **Atingimento de metas** (#10) | `fat_sucesso_mensal.pct_atingimento` (jornada A6.1) | ✅ já existe — superfície própria, não campo de registro |
| **Adequações a serem realizadas** (#9) | `fat_registro.conteudo` (JSONB) | ✅ coluna existe, contrato não declarado — ver Out of Scope (`schema_campos`) |
| **As 4 perguntas de Insights** (#5) | `fat_insight` + `ref_pilar_insight` | ✅ **já existe, e bate 4 de 4** — ver abaixo |

**`ck_artefato_tipo` já enumera 10 dos 11 links pedidos, um a um.** O modelo
aprovado antecipou exatamente estes anexos. Confirma o gate 5 do protocolo ("não
jogue o banco fora por causa de tela"): o custo do redesenho está nas linhas do
catálogo, não no schema.

### O item #5 não é tipo de registro

"Registros Insights" aparece na lista da operação como se fosse um tipo, mas as 4
perguntas correspondem **exatamente** às 4 linhas de `ref_pilar_insight`, semeadas
pela decisão D5 e verificadas no banco de dev hoje:

| Pergunta do checklist | `ref_pilar_insight` |
| :-- | :-- |
| "Qual o contexto sociopolítico do mandato?" | `contexto_sociopolitico` — "Contexto sociopolítico do mandato" |
| "Descreva qual foi a sua incidência política? (Sugestão, recomendação, direcionamento)" | `incidencia_politica` — "Incidência política (sugestão, recomendação, direcionamento)" |
| "Qual o principal (ou principais) desafio/problema do mandato no momento? (Técnico, político, relacional, interno)" | `desafio_problema` — "Desafio/problema do momento (técnico, político, relacional, interno)" |
| "Conquistas/Boas práticas do mandato" | `conquistas_praticas` — "Conquistas e boas práticas" |

Insight é `fat_insight`, com `id_pilar` e `id_registro` opcional — jornada A6.3,
feature INC-02. **Descarta como tipo de registro, porque já está coberto melhor
em outro lugar** — não por esquecimento.

### Inventário coberto (§10.1 das jornadas) — veredito final

Os 11 itens, agora com veredito **decidido** pela operação. O §10.1 é reescrito
por esta feature.

| # | Catálogo hoje | Checklist da operação | Veredito | Ação |
| :-- | :-- | :-- | :-- | :-- |
| 1 | `pontape` "Pontapé" | #1 Registros Pontapé | **cobre** | nenhuma |
| 2 | `comite_politico` "Comitê Político" | #3 Registro Comitê Político - Diagnóstico | **cobre** | nenhuma |
| 3 | `escuta_diagnostica` "Escuta Diagnóstica" | #4 Escuta Diagnóstica - Diagnóstico | **cobre** | nenhuma |
| 4 | `imersao` "Imersão" | #8 Imersão | **cobre** | nenhuma |
| 5 | `diagnostico_organograma` "Diagnóstico de Organograma" | #9 Diagnóstico de Organograma - Governança | **cobre** | nenhuma |
| 6 | `replicacao` "Replicação" | #7 Replicação | **cobre** | nenhuma |
| 7 | `legisla_aliada` "Legisla Aliada" | #2 Legisla Aliada | **cobre** ✅ | nenhuma no dado — **fecha a pendência de §10.1 e a D8** |
| 8 | `sprint` "Sprint" | #6 **Reunião Semanal** - Governança | **substitui** | renomear → **TIP-01** |
| 9 | `monitoramento` "Monitoramento mensal" | #10 **Monitoramento** | **substitui** | renomear → **TIP-02** |
| 10 | `organograma` "Proposta de Organograma" | — **ausente da lista** | **descarta** | `ativo = false` → **TIP-03** |
| 11 | `mentoria` "Mentoria" (PLL) | fora do escopo da consulta | **cobre** | nenhuma — PLL intacto |
| — | — | #5 Registros Insights | **descarta como tipo** | já é `fat_insight` → **TIP-06** (documentação) |

**Saldo:** 11 linhas continuam existindo; 2 mudam de nome, 1 fica inativa.
Estratégia passa a ter **9 tipos ativos**, PLL segue com 1.

### A colisão "Diagnóstico" está resolvida — e AD-045 sai confirmada

A colisão que motivou a pergunta D1 **não existe**. Os badges do Figma que a
criaram ("Diagnóstico", "Planejamento", "Encontro", "Mentoria" na tela da
Estratégia) foram **alucinação da IA do Figma**, descartados por Pedro em
2026-09-10. Nenhum tipo de registro se chama "Diagnóstico".

Melhor: os rótulos da própria operação usam o padrão `<Tipo> - <Etapa>` —
"Registro Comitê Político **- Diagnóstico**", "Escuta Diagnóstica **-
Diagnóstico**", "Reunião Semanal **- Governança**", "Diagnóstico de Organograma
**- Governança**". Ou seja: **a operação já chama a etapa `raio_x` de
"Diagnóstico"**, por conta própria e sem ter sido perguntada sobre isso. É
confirmação independente de **AD-045 / EST-14**, que estava marcada como
"⚠️ confirmar na primeira demo" na spec irmã. A migration `20260910152709` segue
válida e sem ressalva.

### Jornadas afetadas

- **§10.1** — reescrita integral (é o inventário que esta feature corrige).
- **A5.3** — "Sprints (X)" passa a "Reunião Semanal", com número por reunião.
- **A5.7** — "Reunião de proposta de organograma" deixa de ter tipo próprio.
- **A6.2** — rótulo "monitoramento" ajustado.
- **A6.3 / §10.1** — Insight reafirmado como `fat_insight`, não tipo de registro.

Documento congelado (AD-038); a v3 é derivada depois.

### Veredito

**Vira spec agora.** Nenhuma trava técnica ferida, nenhuma AD nova necessária,
nenhum dado novo exigido pelo escopo — e a única lacuna de modelo encontrada
("Presentes") está explicitamente fora, registrada e não bloqueante.

---

## Assumptions & Open Questions

| Assumption / decisão | Default escolhido | Rationale | Confirmado? |
| :-- | :-- | :-- | :-- |
| Badges do Figma na Agenda (T5) | **Descartados como evidência** | Pedro, 2026-09-10: "os catálogos na foto foram alucinações da ia do figma". A Fase 7 renderiza o catálogo real. | ✅ sim |
| Renome altera `nome` ou `codigo`? | **Só `nome`.** `codigo` segue `sprint` e `monitoramento` | Mesmo precedente de AD-045/EST-14 e de `20260812163617`: código é referenciado (7 arquivos de teste usam `codigo = 'monitoramento'` como fixture) e renomeá-lo espalha a quebra sem ganho. Custo aceito: o código diz `sprint`, a tela diz "Reunião Semanal". | ⚠️ assumido |
| `organograma` sai por `ativo=false`, não `DELETE` | `ativo = false` | Reversível por migration nova (forward-only), preserva o `codigo` e o histórico. Tem 0 linhas em `fat_registro`, então `DELETE` funcionaria — mas desativar é a escolha que não perde informação. | ⚠️ assumido |
| "Proposta de Organograma" some porque foi **fundida** em #9, não esquecida | Aposentar, e registrar a hipótese | O checklist #9 carrega "Adequações a serem realizadas" **e** "Link do organograma" — o material da proposta. A jornada A5.7 tratava como reunião separada. **Único item cuja ausência pode ser omissão** — confirmar na primeira demo. | ⚠️ **confirmar** |
| `monitoramento` segue com `qtd_prevista = 4` | mantém 4 | B4 ("são sempre 4?") não foi respondida. Manter preserva o comportamento atual; mudar sem resposta seria inventar. Se variar por contrato, é decisão de modelo e AD nova (o limiar sairia do catálogo). | ⚠️ assumido |
| `legisla_aliada` mantém `permite_multiplos = true` | mantém `true` | O checklist #2 não traz "Número", o que sugeriria ocorrência única — mas `true` é o valor menos restritivo e não descarta dado. Nenhum registro existe hoje. | ⚠️ assumido |
| Tipos do PLL intocados | `mentoria` como está | A consulta cobriu a operação de Estratégia. Mexer no PLL sem consultar o PLL repetiria o erro que abriu esta feature. | ✅ sim |
| "Presentes" fica fora | Registrado como achado de modelo | Exige `rel_registro_participante` (tabela nova) e decisão sobre registro sem encontro. Não bloqueia a Fase 7. | ✅ sim |

**Open questions:** nenhuma bloqueante. As marcadas ⚠️ têm default aplicado; só a
de "Proposta de Organograma" pode inverter uma linha, e a inversão é uma migration
de uma linha.

---

## User Stories

### P1: O catálogo usa os nomes da operação ⭐ MVP

**User Story**: Como Gestora, quero escolher o tipo de registro pelo nome que eu
uso no meu checklist, para não precisar traduzir "Sprint" para "Reunião Semanal"
toda vez que lanço um registro.

**Why P1**: É a correção que a feature existe para fazer. Sem ela, a Fase 7
renderiza badges com vocabulário de planilha.

**Acceptance Criteria**:

1. WHEN o tipo de `codigo = 'sprint'` da Estratégia é lido THEN `nome` SHALL ser **"Reunião Semanal"**.
2. WHEN o tipo de `codigo = 'monitoramento'` da Estratégia é lido THEN `nome` SHALL ser **"Monitoramento"**.
3. WHEN qualquer renome é aplicado THEN `codigo`, `id_etapa`, `permite_multiplos` e `qtd_prevista` da linha SHALL permanecer inalterados.
4. WHEN a migration é aplicada THEN nenhuma linha de `fat_registro` ou `fat_encontro` SHALL mudar de `id_tipo_registro`.
5. WHEN a migration roda uma segunda vez sobre o banco já corrigido THEN ela SHALL ser no-op, filtrando por `codigo` (estável) e nunca pelo nome antigo.

**Independent Test**: `SELECT codigo, nome FROM ref_tipo_registro` devolve os dois
nomes novos, e `SELECT count(*) FROM fat_registro` permanece 4.

---

### P1: "Proposta de Organograma" é aposentada sem perder histórico ⭐ MVP

**User Story**: Como operação, quero que o seletor de tipo ofereça só o que a gente
de fato registra, para parar de escolher entre dois organogramas quando existe um.

**Why P1**: É o único **descarte** da revisão. Descartar é legítimo; fazê-lo sem
destruir dado é o requisito.

**Acceptance Criteria**:

1. WHEN o tipo de `codigo = 'organograma'` da Estratégia é lido THEN `ativo` SHALL ser `false`.
2. WHEN a linha é aposentada THEN ela SHALL continuar existindo na tabela — nenhum `DELETE`.
3. WHEN o seletor de tipo de uma etapa é montado THEN o tipo inativo SHALL não aparecer, por já filtrar `ativo = true` (`buscarTiposRegistroDaEtapa`).
4. WHEN um registro histórico de tipo inativo é listado THEN ele SHALL exibir o nome real do tipo, nunca um rótulo genérico (AD-005).
5. WHEN o tipo `diagnostico_organograma` é lido THEN ele SHALL permanecer `ativo = true`.

**Independent Test**: desativar e conferir que o Select perde a opção enquanto uma
listagem de registro daquele tipo continuaria nomeando-o corretamente.

---

### P1: Nada que depende do catálogo quebra ⭐ MVP

**User Story**: Como time, queremos que a mudança de catálogo não derrube teste nem
FK, para não repetir o modo de falha que a `20260812163617` teve de desfazer.

**Why P1**: Há **duas** tabelas dependentes e uma contagem cravada em teste. É o
requisito que transforma "mapeamos as dependências" em algo verificável.

**Acceptance Criteria**:

1. WHEN a suíte de integração roda THEN a asserção de contagem de `ref_tipo_registro` SHALL refletir o estado novo — **11 linhas, 10 ativas** — e não o `11` cravado hoje.
2. WHEN um teste seleciona fixture por `codigo = 'monitoramento'` THEN ele SHALL continuar encontrando a linha, porque `codigo` não muda.
3. WHEN `app.trg_valida_registro_produto` é exercitado THEN ele SHALL continuar rejeitando tipo de produto diferente do contrato.
4. WHEN a migration é aplicada THEN nenhuma view (`vw_pendencias`, `vw_cobertura_registro_mensal`, `vw_carteira`) SHALL mudar de resultado, por nenhuma delas filtrar por tipo.
5. WHEN `npm run test:unit` e `npm run test:integration` rodam THEN ambos SHALL passar.

**Independent Test**: rodar a suíte antes e depois e comparar a contagem de testes
e de linhas de `fat_registro`.

---

### P2: Os documentos derivados param de mentir

**User Story**: Como quem for ler o projeto depois, quero que o inventário e o
modelo aprovado digam o que o banco diz, para não reintroduzir um tipo aposentado
por achar que o documento está certo.

**Why P2**: Não bloqueia a Fase 7, mas é o que impede o catálogo de regredir. Já
existe divergência conhecida na mesma vizinhança (`schema_sistema.sql:2248` ainda
diz "Raio-X" depois da `20260910152709`).

**Acceptance Criteria**:

1. WHEN `docs/jornadas-de-usuario-v2.md` §10.1 é lido THEN ele SHALL listar os 9 tipos ativos da Estratégia com os nomes novos, e SHALL não citar "Proposta de Organograma" como ativo.
2. WHEN §10.1 é lido THEN a ressalva *"confirmar com a operação se `legisla_aliada` segue ativo"* SHALL estar substituída pela confirmação datada.
3. WHEN `docs/schema_sistema.sql` é lido THEN o bloco de seed (`:2289`) e a decisão **D8** (`:34`) SHALL refletir os nomes novos e a aposentadoria.
4. WHEN a mesma reconciliação é feita THEN a divergência pendente de `:2248` ("Raio-X" → "Diagnóstico") SHALL ser corrigida junto.
5. WHEN §10.1 é lido THEN "Registros Insights" SHALL aparecer explicitamente como `fat_insight`, não como tipo de registro.

**Independent Test**: `grep -n "Proposta de Organograma\|Raio-X" docs/` não retorna
nenhuma ocorrência apresentada como estado atual.

---

### P3: O achado de "Presentes" fica registrado onde alguém tropece nele

**User Story**: Como time, queremos que a lacuna de participantes de registro não
se perca, para que a próxima pessoa que desenhar a tela de registro não a descubra
por erro.

**Why P3**: Não é entrega desta feature — é o custo de não esquecê-la.

**Acceptance Criteria**:

1. WHEN `.specs/STATE.md` é lido THEN o Handoff SHALL registrar que os 10 checklists pedem "Presentes" e que o modelo não tem `rel_registro_participante`.
2. WHEN o achado é registrado THEN ele SHALL nomear as duas saídas possíveis (tabela nova, ou derivar de `fat_registro.id_encontro`) sem escolher uma.

**Independent Test**: ler o Handoff e conseguir reabrir o assunto sem reler esta spec.

---

## Edge Cases

- WHEN a migration roda sobre um banco onde o renome já foi aplicado THEN ela SHALL ser no-op (filtro por `codigo`, nunca pelo nome antigo).
- WHEN `supabase db reset` reconstrói do zero THEN o seed original cria "Sprint"/"Monitoramento mensal" e esta migration os renomeia em seguida — a ordem por timestamp SHALL garantir o estado final correto.
- WHEN um `fat_registro` de tipo inativo é lido THEN ele SHALL renderizar o nome do tipo normalmente, porque `buscarRegistrosDaEtapa` não filtra `ativo`.
- WHEN alguém tenta `DELETE` de um tipo com linha dependente THEN o banco SHALL recusar por FK — comportamento desejado, e a razão de usar `ativo = false`.
- WHEN o formulário de **encontro** monta sua lista THEN o tipo inativo SHALL sumir dela também, porque `encontro-form.tsx:57` já filtra `ativo = true`.
- WHEN a Coalizão é consultada THEN ela SHALL continuar sem nenhum `ref_tipo_registro` — a régua foi clonada em `ref_etapa`, os tipos não. Comportamento pré-existente, fora de escopo.

---

## Requirement Traceability

| ID | Story | Fase | Status |
| :-- | :-- | :-- | :-- |
| TIP-01 | P1: `sprint` → "Reunião Semanal" | Tasks | Pending |
| TIP-02 | P1: `monitoramento` → "Monitoramento" | Tasks | Pending |
| TIP-03 | P1: `organograma` aposentado (`ativo = false`) | Tasks | Pending |
| TIP-04 | P1: nada que depende do catálogo quebra (testes, FK, trigger, views) | Tasks | Pending |
| TIP-05 | P2: `docs/jornadas-de-usuario-v2.md` §10.1 reconciliado | Tasks | Pending |
| TIP-06 | P2: `docs/schema_sistema.sql` seed + D8 + divergência `:2248` | Tasks | Pending |
| TIP-07 | P3: achado "Presentes" registrado em `STATE.md` | Tasks | Pending |

**Coverage:** 7 total, 0 mapeados para tasks, 7 não mapeados ⚠️ (normal antes da fase Tasks)

**Confirmação explícita de `legisla_aliada`:** não gera requisito de dado — a linha
já está correta e ativa. Vive em TIP-05 AC2, como correção do documento que a
declarava pendente.

---

## Implicit-Requirement Dimensions Sweep

Escopo Medium — dimensões obviamente presentes resolvidas; as demais `N/A`.

| Dimensão | Resolução |
| :-- | :-- |
| Data lifecycle / expiry | TIP-03 AC1/AC2 — aposentadoria é `ativo = false`, linha preservada; histórico de `fat_registro` nunca é remapeado |
| State-transition integrity | TIP-04 AC3 — `trg_valida_registro_produto` segue rejeitando tipo fora da régua do produto |
| Idempotency / retry | TIP-01 AC5 e Edge Cases — migration filtra por `codigo`, no-op na segunda execução e sob `db reset` |
| Input validation & bounds | `ck_tipo_registro_qtd` e `uq_tipo_registro_etapa_codigo` inalterados; nenhuma linha nova é criada |
| Auth boundaries | TIP-04 — GRANT-only herdado (AD-030), nenhuma política nova. Rate limit: `N/A` (sem superfície pública, AD-002) |
| Observability | `N/A` — catálogo muda por migration versionada; o arquivo é o rastro (AD-006 não se aplica, ver checagem) |
| Failure / partial-failure | Migration é um único `UPDATE` por linha, transacional por natureza; sem escrita parcial possível |
| Concurrency / ordering | `N/A` — migration roda isolada no pipeline; nenhuma escrita concorrente de usuário sobre `ref_*` |
| External-dependency failure | `N/A` — nenhuma dependência externa |

---

## Success Criteria

- [ ] A Gestora encontra no seletor os 9 nomes do seu checklist, e nenhum que ela não reconheça.
- [ ] `legisla_aliada` deixa de aparecer como pendência em qualquer documento do projeto.
- [ ] As 4 linhas de `fat_registro` continuam com o mesmo `id_tipo_registro` depois da migration.
- [ ] `npm run test:unit` e `npm run test:integration` passam, com a contagem de catálogo atualizada.
- [ ] Nenhum documento do projeto apresenta "Sprint", "Monitoramento mensal", "Proposta de Organograma" ou "Raio-X" como estado atual.
- [ ] A Fase 7 da feature irmã consegue renderizar badges lendo `ref_tipo_registro` sem nenhum rótulo cravado em código.
