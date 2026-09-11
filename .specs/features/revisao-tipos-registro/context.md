# Revisão dos tipos de registro — Contexto e checagem de conformidade

**Aberto em:** 2026-09-10
**Protocolo:** `docs/redesenho-tela-first.md` — este documento é o **passo 3**
(checagem de conformidade, Claude) e o registro do **passo 4** (decisão).
**Status:** ✅ respostas da operação recebidas em 2026-09-10 → [`spec.md`](spec.md)
escrita. Ver *Respostas da operação*, no fim deste arquivo.

> ⚠️ **Leia com a data em mente.** As seções de checagem abaixo foram escritas
> **antes** das respostas, e tratam os badges do Figma como evidência. Eles foram
> depois descartados como alucinação da IA do Figma. O veredito que vale é o da
> `spec.md`.

---

## Feature Boundary

Revisar o conteúdo de `ref_tipo_registro` (11 linhas) contra o que a operação de
fato registra, e reconciliar com os badges de tipo desenhados na tela de Agenda
validada (Figma `eS5CdQrl6yUdYctZwlDzps`, node `163:4`).

**Dentro do escopo:** conteúdo do catálogo `ref_tipo_registro` — quais tipos
existem, com que nome, em que etapa, com que `permite_multiplos`/`qtd_prevista`;
a colisão de nome "Diagnóstico"; a migration de mudança de conteúdo com as
dependências mapeadas.

**Fora do escopo:** estrutura da tabela (colunas, constraints), `ref_etapa`,
`ref_formulario`, e qualquer tela. Esta feature é **pré-requisito da Fase 7**
(Agenda, T25–T30) de `redesenho-estrategia-tela-first`, que renderiza os badges.

---

## Por que o catálogo está sob suspeita

O seed que criou as 11 linhas
(`20260810193327_catalogos_referencia_seed.sql:79`) se descreve assim:

> "Tipos de registro derivados **literalmente** das abas de 'Registros Slack' e
> f_mentorias."

Transcrição de planilha, sem passar pela operação — a mesma origem das telas que
AD-038 diagnostica como não-usadas. O próprio `docs/jornadas-de-usuario-v2.md`
§10.1 já carrega uma pendência aberta desde então: *"`legisla_aliada` veio das
planilhas e não estava em nenhum documento de escopo; entrou no catálogo para não
se perder (confirmar com a operação se segue ativo)"*.

### Uso não serve de evidência aqui

8 dos 11 tipos têm zero uso. **Isso não discrimina "tipo errado" de "sistema não
usado"** — AD-038 estabelece que nenhuma tarefa da operação roda no sistema, então
uso quase-zero é o esperado para todo tipo, certo ou errado. Contagem de uso serve
para uma coisa só: dizer o que a migration precisa preservar. A decisão de
cobre/substitui/descarta tem de vir da operação.

Estado real medido em dev (`npnvoolkebhabjkjzqwn`), somente leitura, 2026-09-10:

| Produto | codigo | etapa | nome | mult | qtd | `fat_registro` | `fat_encontro` |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Estratégia | `pontape` | pontape | Pontapé | f | — | 0 | 0 |
| Estratégia | `comite_politico` | raio_x | Comitê Político | f | — | 1 | 0 |
| Estratégia | `escuta_diagnostica` | raio_x | Escuta Diagnóstica | f | — | 1 | 0 |
| Estratégia | `imersao` | imersao | Imersão | f | — | 1 | 0 |
| Estratégia | `diagnostico_organograma` | governanca | Diagnóstico de Organograma | f | — | 0 | 0 |
| Estratégia | `organograma` | governanca | Proposta de Organograma | f | — | 0 | 0 |
| Estratégia | `sprint` | governanca | Sprint | t | — | 0 | 0 |
| Estratégia | `legisla_aliada` | monitoramento | Legisla Aliada | t | — | 0 | 0 |
| Estratégia | `monitoramento` | monitoramento | Monitoramento mensal | t | 4 | 1 ⚠️ | 0 |
| Estratégia | `replicacao` | replicacao | Replicação | f | — | 0 | 0 |
| PLL | `mentoria` | mentorias | Mentoria | t | 5 | 0 | 0 |

⚠️ **A linha de `monitoramento` não é dado de operação.** `fat_registro` id 264,
criada em 2026-09-10 18:57, é fixture da sessão concorrente que está usando o dev
compartilhado. As 3 linhas de operação são de 15–28/08 (`imersao`,
`escuta_diagnostica`, `comite_politico`). `fat_encontro` está **vazia** (0 linhas).

---

## Checagem de conformidade (protocolo §3)

### Travas técnicas

| Trava | Aplica? | Veredito |
| :-- | :-- | :-- |
| **AD-030** · `ref_*` é GRANT-only, não RLS | sim | ✅ já satisfeito e **herdado por linha nova**. `20260810192209:31` faz `DISABLE ROW LEVEL SECURITY` e `:50` concede `SELECT`; `20260810193545` revogou os default privileges de `anon`/`authenticated`. Mudar conteúdo não toca em política — nenhum GRANT novo é necessário. |
| **AD-004** · limiar vive em tabela editável | sim | ✅ conforme: `qtd_prevista` (monitoramento ×4, mentoria ×5) **já** é o limiar e **já** vive no catálogo. ⚠️ **Risco de granularidade:** `qtd_prevista` é por produto, não por contrato. Se a operação disser que o número de monitoramentos varia por contrato, o limiar está no lugar errado — e isso é decisão de modelo, não de conteúdo (→ pergunta B4). |
| **AD-005** · ausência é `NULL`, nada inventado | sim | ⚠️ **duas consequências.** (a) Aposentar tipo com linha dependente é `ativo = false`, nunca `DELETE` — e nunca um rótulo de fallback. (b) O badge da tela renderiza o `nome` real do tipo da linha; um registro cujo tipo a operação não reconheça mais mostra o nome antigo, não "Outro". Confirmado no código: `buscarRegistrosDaEtapa` (`incidencia.ts:179`) **não** filtra por `ativo`, então linha histórica de tipo aposentado continua exibindo o nome correto. |
| **AD-006** · toda escrita guarda autor e timestamp | condicional | ✅ **N/A hoje, por construção**: `ref_tipo_registro` não tem trigger de auditoria nem `criado_em`/`criado_por`, porque catálogo só muda por migration — o arquivo é o rastro. 🔴 **Passa a valer se** a operação pedir para editar tipos por tela: aí a tabela precisa das colunas e do `app.trg_auditoria()`, e isso é **AD nova**, não escolha de layout. |
| **AD-001** · restrição mora na RLS | não | N/A — o catálogo é legível por toda role autenticada, deliberadamente (AD-030). |
| **AD-002** · sem acesso anônimo | não | N/A — nenhuma superfície pública. |
| **AD-003** · número novo exige camada Saída | não | N/A — nenhum número de gestão nesta feature. |

### Cobertura de dado — os badges do Figma contra o catálogo

Lido direto do node `163:4`. **5 badges** na tabela "Registros de Agenda", cada um
com sua descrição — e é a descrição que expõe o desencontro:

| Badge (Figma) | Descrição no desenho | Tipo no catálogo | Veredito |
| :-- | :-- | :-- | :-- |
| **Monitoramento** | "Acompanhamento de metas e indicadores do mês" | `monitoramento` "Monitoramento mensal" | ✅ **bate**. Único dos 5 que bate. |
| **Diagnóstico** | "Devolutiva do diagnóstico inicial da mandata" | `escuta_diagnostica`? | ⚠️ **parcial.** Escuta ≠ devolutiva: a escuta é o ato de ouvir (A3.5), a devolutiva é a entrega do resultado — que **não existe** no catálogo nem nas jornadas. E colide com a etapa (§ colisão abaixo). → C3, D1 |
| **Mentoria** | "Alinhamento estratégico com a equipe de comunicação" | `mentoria` — **só PLL** | 🔴 **impossível como desenhado.** Ver blocker do trigger no mapa de dependências. A descrição também não é uma mentoria de PLL. → B6 |
| **Planejamento** | "Reunião de pauta e priorização de temas" | **nenhum** | 🔴 **não existe em lugar nenhum.** Candidato real a lacuna: a jornada A5.1 ("alinhamento e refinamento das metas pós-imersão") grava `log_auditoria`, **não** `fat_registro` — ou seja, hoje esse ato não tem tipo. → C1 |
| **Encontro** | "Encontro presencial com lideranças da base" | **nenhum** | 🔴 **não é tipo de registro** — `fat_encontro` é outra tabela. Ou é um tipo genérico novo, ou a lista da Agenda mistura encontro e registro numa coluna só. → C2 |

**Evidência extra, do calendário da mesma tela.** As pílulas de encontro são
`fat_encontro`, que usa **o mesmo catálogo** (`fat_encontro.id_tipo_registro`), e o
formulário atual carrega **todos** os tipos ativos sem escopo de etapa
(`encontro-form.tsx:48-57`, comentado de propósito). Os títulos desenhados:

- "Sprint de Planejamento" → `sprint` existe ✅ (mas ancorado em Governança)
- "Encontro Presencial" → sem tipo
- "Devolutiva Diag." → sem tipo (reforça C3)
- "Reunião de Pauta" → sem tipo (reforça C1)
- "Acomp. Metas" → `monitoramento` ✅

Dos 7 rótulos que a tela usa (5 badges + 2 títulos de encontro sem par), **3 não
têm tipo nenhum** e apontam para os mesmos dois atos: *reunião de
pauta/planejamento* e *devolutiva*.

### Inventário coberto (§10.1 das jornadas) — veredito por item

Protocolo §3.3: para cada item, **cobre · substitui · descarta**. Descartar é
legítimo; esquecer não é. O veredito abaixo é **proposto** — a coluna "decide"
diz quem fecha. Nenhum item foi omitido: os 11 estão aqui.

| # | Item §10.1 | Âncora na jornada | Correspondência na tela | Veredito proposto | Decide |
| :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | pontapé | A2.4 (passo real) | ausente do desenho | **cobre** — etapa Pontapé permanece (decisão de 2026-09-10); a ausência é do desenho, não do fluxo | operação (B1) |
| 2 | comitê político | A3.4 | ausente | **cobre** | operação (B1) |
| 3 | escuta diagnóstica | A3.5 | "Diagnóstico" (parcial) | **substitui ou desdobra** — escuta e devolutiva podem ser dois atos | operação (C3) |
| 4 | imersão | A4.9 | ausente | **cobre** | operação (B1) |
| 5 | sprint (×N) | A5.3 ("sem número fixo") | pílula "Sprint de Planejamento" | **cobre** — aparece como encontro, coerente com A5.3 (`fat_encontro` + `fat_registro`) | operação (B2) |
| 6 | diagnóstico de organograma | A5.6 | ausente | **cobre** | operação (B3) |
| 7 | organograma (proposta) | A5.7 | ausente | **cobre** | operação (B3) |
| 8 | monitoramento (mensal ×4) | A6.2 | ✅ badge "Monitoramento" | **cobre** — o único confirmado pela tela | operação (B4, granularidade) |
| 9 | replicação | A7.2 | ausente | **cobre** | operação (B1) |
| 10 | **legisla aliada** | 🔴 **nenhuma** | ausente | **descarta ou confirma** — sem âncora em jornada; a pendência está aberta desde o seed (§10.1) e D8 do schema só diz "segue ativo" sem fonte | operação (B5) |
| 11 | mentoria (×5, PLL) | B4.5, B5.1 | badge "Mentoria" na tela da **Estratégia** | **cobre no PLL**; na Estratégia é **outro tipo, não este** — o banco proíbe reuso | operação (B6) |

**Itens que a tela pede e o inventário não tem** (o outro lado da checagem):

| Rótulo da tela | Ato provável | Situação |
| :-- | :-- | :-- |
| "Planejamento" | A5.1, alinhamento/refinamento pós-imersão | **lacuna real** — A5.1 não grava `fat_registro` hoje |
| "Devolutiva" (Diagnóstico) | devolutiva do diagnóstico inicial | **lacuna** — nem catálogo nem jornada |
| "Encontro" | reunião genérica | **decisão de modelo** — tipo genérico vs. mistura de tabelas na lista |

### A colisão de nome "Diagnóstico"

Criada hoje mesmo, por duas decisões independentes:

- **AD-045 / EST-14** (migration `20260910152709`, ainda **não aplicada** em dev —
  verificado: `SELECT count(*) FROM ref_etapa WHERE nome='Diagnóstico'` = 0)
  renomeia a **etapa** `raio_x` de "Raio-X" para "Diagnóstico".
- O Figma usa "Diagnóstico" como **tipo de registro**.

A spec irmã já registrou o risco: *"'Diagnóstico' colide com nomes existentes —
aplicar assim mesmo; registrar a colisão como risco … ⚠️ confirmar na primeira
demo"*. Com esta feature a confirmação deixa de ser opcional: a mesma tela passará
a exibir a etapa "Diagnóstico" e um badge "Diagnóstico" que significam coisas
diferentes, e já existem no sistema `Escuta Diagnóstica` (tipo, dentro da própria
etapa), `Diagnóstico de Organograma` (tipo, em Governança) e `Diagnóstico e
Temáticas` (formulário, PLL). Um dos dois nomes muda. → **D1**

### Jornadas afetadas

`docs/jornadas-de-usuario-v2.md` §10.1 é reescrito integralmente por esta feature.
Blocos afetados conforme as respostas: **A3** (escuta vs. devolutiva), **A5**
(alinhamento pós-imersão passa a gerar registro?), **A6** (granularidade do
monitoramento), **B4/B5** (mentoria). O documento está congelado (AD-038); a v3
é derivada depois.

### Veredito

**Precisa de uma decisão sua**, precedida de consulta à operação. Não vira spec
agora: o conteúdo do catálogo não é derivável de nenhum documento existente —
todos eles (jornadas §10.1, `docs/schema_sistema.sql` D8, o seed) apontam para a
mesma planilha. Duas decisões estão em condição de serem tomadas por você sem a
operação: a colisão "Diagnóstico" (D1) e a política de aposentadoria (F2).

Pode surgir **AD nova** em dois cenários: (a) `qtd_prevista` mudar de granularidade
(B4); (b) o catálogo ganhar edição por tela, que aciona AD-006 (E4).

---

## Mapa de dependências — mapeado ANTES de escrever a migration

Mesmo cuidado da `20260812163617`, que listou cada dependência antes de tocar em
`ref_etapa`. Aqui há **duas** tabelas dependentes, não uma.

### Dependências de banco

| # | Objeto | Natureza | Estado hoje | O que a migration precisa observar |
| :-- | :-- | :-- | :-- | :-- |
| 1 | `fat_registro.id_tipo_registro` | FK **NOT NULL**, sem `ON DELETE` (= `NO ACTION`) | 4 linhas em 4 tipos distintos (3 de operação + 1 fixture de hoje) | `DELETE` de tipo referenciado **falha por FK**. Aposentar = `ativo = false`. Remapear = `UPDATE fat_registro` antes do `DELETE`. |
| 2 | `fat_encontro.id_tipo_registro` | FK **nullable** | **0 linhas** na tabela inteira | Risco zero hoje. Mas é o **segundo consumidor**, com semântica diferente: encontro não é escopado a etapa (`encontro-form.tsx:48`). Um tipo pensado só para registro afeta o seletor de agendamento. |
| 3 | `app.trg_valida_registro_produto` (trigger `trg_registro_produto`) | `BEFORE INSERT OR UPDATE OF id_tipo_registro, id_contrato` em `fat_registro` | ativo | 🔴 **Blocker do badge "Mentoria".** Rejeita tipo cuja `ref_etapa.id_produto` ≠ `fat_contrato.id_produto`. Contrato de Estratégia **nunca** poderá usar `mentoria` (ancorado na etapa `mentorias` do PLL). Não é problema de UI: o banco recusa. Se a Estratégia precisa de "Mentoria", é **linha nova** ancorada numa etapa da Estratégia — nunca reuso da linha do PLL. |
| 4 | `uq_registro_sequencia` | UNIQUE `(id_contrato, id_tipo_registro, nr_sequencia)` WHERE `nr_sequencia IS NOT NULL` | as 4 linhas têm `nr_sequencia` NULL | Sem risco hoje. **Fundir dois tipos num só** pode colidir se um contrato tiver ambos com o mesmo `nr_sequencia` — conferir antes de qualquer merge. |
| 5 | `uq_encontro_sequencia` | UNIQUE `(id_contrato, id_tipo_registro, nr_sequencia)` WHERE `nr_sequencia IS NOT NULL AND status IN ('planejado','realizado')` | tabela vazia | idem, sem risco hoje |
| 6 | `uq_tipo_registro_etapa_codigo` | UNIQUE `(id_etapa, codigo)` | — | `codigo` é único **por etapa**, não global: o mesmo `codigo` pode repetir em etapas diferentes. Relevante se um tipo trocar de etapa. |
| 7 | `ck_tipo_registro_qtd` | CHECK `(qtd_prevista IS NULL OR permite_multiplos)` | — | Dar `qtd_prevista` exige `permite_multiplos = true` no mesmo statement. |
| 8 | `ix_registro_tipo` | índice | — | nenhuma ação |
| 9 | Views (`vw_pendencias`, `vw_cobertura_registro_mensal`, `vw_carteira`, `mv_*`) | — | — | ✅ **verificado: nenhuma view crava código de tipo.** Todas leem `fat_registro` sem filtrar por tipo. Zero impacto. |

### Dependências de código

| Arquivo | Uso | Impacto |
| :-- | :-- | :-- |
| `src/backend/queries/incidencia.ts:141-158` | `buscarTiposRegistroDaEtapa` — filtra `id_etapa` + `ativo = true` | ✅ tipo aposentado sai do seletor automaticamente |
| `src/backend/queries/incidencia.ts:169-210` | `buscarRegistrosDaEtapa` — **não** filtra `ativo` | ✅ desejável: linha histórica mantém o nome do tipo (AD-005) |
| `src/frontend/components/incidencia/encontro-form.tsx:48-57` | carrega **todos** os tipos ativos, sem escopo de etapa | ⚠️ tipo novo aparece no agendamento de qualquer etapa |
| `src/frontend/components/incidencia/registro-form.tsx:102` | Select de tipo | segue o escopo por etapa |
| `src/backend/schemas/registro.ts:10` | `id_tipo_registro` obrigatório | nenhum |
| `src/backend/schemas/encontro.ts:16` | `id_tipo_registro` nullable | nenhum |

### Testes que quebram com mudança de conteúdo

Precisam ser atualizados **na mesma task** da migration:

| Arquivo | Expectativa cravada |
| :-- | :-- |
| `supabase/tests/catalogos/catalogos-referencia-seed.integration.test.ts:294` | `tipo_registro: 11` — **contagem exata** |
| idem `:108` | CAT-15 AC7: "ref_tipo_registro tem **os 11 tipos** derivados" |
| `supabase/tests/estrategia/renome-etapa-diagnostico.integration.test.ts:63-97` | contagem de tipos por etapa `raio_x` |
| 7 arquivos escolhem fixture por `codigo = 'monitoramento'` | `vw-pendencias`, `vw-pendencias-limiar`, `vw-cobertura-registro-mensal`, `fn-criar-insight`, `incidencia-rls-grants`, `incidencia-triggers-constraints`, `vw-carteira` — **quebram se `monitoramento` for renomeado ou removido** |

### Documento aprovado

`docs/schema_sistema.sql:2289` (bloco de seed) e `:34` (decisão D8 sobre
`legisla_aliada`) precisam de reconciliação. Já existe divergência conhecida na
mesma vizinhança: `:2248` segue dizendo "Raio-X" depois da migration
`20260910152709`. Candidato a uma task de reconciliação única.

`database.types.ts` **não** precisa ser regenerado: mudança de linha, não de
estrutura.

---

## Perguntas para a operação

Ordem importa: o **Bloco A é aberto e vem primeiro**, para a operação nomear o que
faz com as palavras dela. Mostrar o catálogo antes ancora a resposta e o resultado
volta a ser a planilha confirmando a planilha — o erro que abriu esta feature.

### Bloco A — o que vocês registram, sem olhar lista (perguntar primeiro)

- **A1.** Num ciclo de Estratégia, do pontapé à replicação: que reuniões e atos
  vocês **registram depois de acontecer**? Liste com o nome que vocês usam.
- **A2.** Dessa lista, o que gera um **texto registrado** (hoje no Slack, na
  planilha ou no sistema) e o que apenas acontece sem registro?
- **A3.** Quais se repetem no ciclo, e **quantas vezes** costumam acontecer?
- **A4.** Tem algum registro que vocês fazem e que **não** cabe em nenhum nome da
  sua própria lista? Como vocês lidam com ele hoje?

### Bloco B — os 11 do catálogo, um a um (só depois do Bloco A)

Para cada: *reconhecem o nome? é a mesma coisa que vocês descreveram em A1? o nome
está certo?*

- **B1.** Pontapé · Comitê Político · Escuta Diagnóstica · Imersão · Replicação —
  os cinco de reunião única. Algum nome errado, algum ato faltando?
- **B2.** **Sprint** — quantas por ciclo, na prática? Cada sprint gera registro
  próprio, ou só a série toda gera um?
- **B3.** **Diagnóstico de Organograma** e **Proposta de Organograma** — são dois
  registros distintos ou um só? (o catálogo tem dois; A5.6 e A5.7 tratam como dois)
- **B4.** **Monitoramento mensal** — são sempre 4 por ciclo, ou varia por contrato?
  *(decide se `qtd_prevista` fica no catálogo ou tem de ir para o contrato — pode
  virar AD nova)*
- **B5.** **Legisla Aliada** — isto ainda existe? É um **tipo de registro**, ou é
  um projeto/produto que foi parar na lista errada? *(pendência aberta desde o
  seed: ninguém sabe de onde veio)*
- **B6.** **Mentoria** — na Estratégia existe algo que vocês chamam de mentoria, ou
  mentoria é só do PLL? Se existe na Estratégia, **é o mesmo ato** que a mentoria
  do PLL ou outro?

### Bloco C — os três rótulos que a tela pede e o catálogo não tem

- **C1.** A tela mostra **"Planejamento"**, descrito como *"reunião de pauta e
  priorização de temas"*. Que ato é esse, e em que momento do ciclo? É a reunião de
  alinhamento pós-imersão (que hoje não gera registro nenhum), ou outra coisa?
- **C2.** A tela mostra **"Encontro"**, descrito como *"encontro presencial com
  lideranças da base"*. Isso é: (a) um tipo de registro genérico, para reunião que
  não encaixa nos outros; (b) uma reunião agendada que aparece na lista junto dos
  registros; ou (c) um ato específico que merece nome próprio?
- **C3.** A tela mostra **"Diagnóstico"**, descrito como *"devolutiva do
  diagnóstico inicial da mandata"*. A **devolutiva** é o mesmo ato que a **Escuta
  Diagnóstica**, ou são dois momentos (ouvir, depois devolver)? Se são dois, os
  dois geram registro?

### Bloco D — a colisão de nome (decisão do Pedro, não da operação)

- **D1.** A etapa `raio_x` passa a se chamar **"Diagnóstico"** (AD-045/EST-14,
  migration escrita e ainda não aplicada). O Figma usa **"Diagnóstico"** como tipo
  de registro. Escolher um:
  - **(a)** a etapa volta a "Raio-X" e o tipo fica "Diagnóstico";
  - **(b)** a etapa fica "Diagnóstico" e o tipo passa a "Devolutiva de Diagnóstico";
  - **(c)** os dois ficam "Diagnóstico" e a tela distingue por contexto — custo
    assumido por escrito.

  A opção (a) é a mais barata em código (a migration ainda não foi aplicada em dev),
  mas contraria uma decisão de vocabulário já tomada com a operação. A (b) preserva
  a decisão e resolve C3 de uma vez, se a devolutiva for ato próprio.

### Bloco E — quem escolhe o tipo, e como

- **E1.** Quem lança o registro escolhe o tipo numa lista. Hoje isso é óbvio, ou a
  pessoa hesita/erra?
- **E2.** A lista deve mostrar **só os tipos da etapa em que o contrato está**, ou
  **todos** sempre? *(hoje: registro é filtrado por etapa, agendamento de encontro
  não — as duas telas discordam)*
- **E3.** Faz sentido existir um tipo **"Outro"**, com o texto livre explicando?
  *(decide se A4 vira tipo genérico ou vira tipo nomeado)*
- **E4.** Quando um tipo novo precisar entrar, vocês esperariam **cadastrar pela
  tela** ou pedir para o time técnico? *(se for pela tela, aciona AD-006 e vira AD
  nova — o catálogo passa a precisar de autor/timestamp)*

### Bloco F — o que morre

- **F1.** Dos 11, quais vocês **nunca usaram e não sentem falta**? *(a pergunta que
  autoriza descartar com base em operação, não em contagem de uso)*
- **F2.** Quando um tipo sai, os registros antigos dele devem continuar visíveis
  **com o nome antigo**, ou devem ser remapeados para outro tipo? *(decisão do
  Pedro: `ativo = false` preserva; remapear reescreve histórico)*

### O que **não** perguntar

Quanto cada tipo foi usado. A resposta é conhecida (8 de 11 = zero) e não
discrimina nada: o sistema não está em uso (AD-038). Perguntar isso convida a
operação a racionalizar a planilha em vez de descrever o trabalho.

### O que trazer de volta, por tipo novo ou alterado

Para a spec ser escrita sem nova rodada, cada tipo que entrar ou mudar precisa de:
**nome exibido** · **etapa** a que pertence · acontece mais de uma vez?
(`permite_multiplos`) · se sim, **quantas vezes previstas** (`qtd_prevista`) ·
e, para tipo que sai, se é `ativo = false` ou remapeado.

---

## Respostas da operação

✅ **Recebidas em 2026-09-10.** `spec.md` escrita a partir delas (passo 5 do
protocolo), com a checagem embutida conforme §4. O veredito final por item está lá
— aqui fica o registro do que foi respondido.

### Bloco A — os 10 checklists reais (Estratégia), com seus campos

A operação respondeu com a lista de perguntas de **cada tipo de encontro**:

| # | Checklist | Campos |
| :-- | :-- | :-- |
| 1 | **Registros Pontapé** | Data · Presentes · Resumo · Link Termo de compromisso |
| 2 | **Legisla Aliada** | Data · Presentes · Resumo |
| 3 | **Registro Comitê Político - Diagnóstico** | Data · Presentes · Resumo · Link Mapa Político |
| 4 | **Escuta Diagnóstica - Diagnóstico** | Data · Presentes · Resumo · Link Escuta Diagnóstica |
| 5 | **Registros Insights** | Contexto sociopolítico · Incidência política · Desafio/problema · Conquistas/Boas práticas · Data do Registro |
| 6 | **Reunião Semanal - Governança** | Número da reunião semanal · Data · Presentes · Resumo |
| 7 | **Replicação** | Data · Presentes · Resumo · Link Material Compartilhado |
| 8 | **Imersão** | Data · Local · Presentes/Legislers · Resumo da Imersão · Link cronograma · Link pré-planejamento · Link mural · Link planilha de monitoramento · Fotos |
| 9 | **Diagnóstico de Organograma - Governança** | Data · Presentes · Resumo · Adequações a serem realizadas · Link do organograma |
| 10 | **Monitoramento** | Número do monitoramento · Data · Presentes · Resumo · Atingimento de metas |

### Blocos B e C — os badges do Figma

> "os catálogos na foto foram **alucinações da ia do figma**, mantenha o que temos
> decidido aqui" — Pedro, 2026-09-10.

Consequência: **"Planejamento", "Encontro", "Mentoria" (na Estratégia) e
"Diagnóstico" como tipo de registro deixam de ser evidência.** Toda a seção
"Cobertura de dado — os badges do Figma contra o catálogo" acima fica registrada
como histórico do que foi investigado, não como requisito. A lista do Bloco A é a
fonte.

### Bloco D — a colisão "Diagnóstico"

**Dissolvida, sem precisar de escolha.** Nenhum tipo se chama "Diagnóstico" — esse
badge era alucinação. E os rótulos da própria operação (#3, #4 com sufixo
"- Diagnóstico"; #6, #9 com "- Governança") mostram que **ela já chama a etapa
`raio_x` de "Diagnóstico"**, espontaneamente. AD-045 / EST-14 sai **confirmada por
evidência independente**; a migration `20260910152709` segue válida.

### Blocos E e F — sem resposta

Não respondidos. Tratados como assumptions na `spec.md`:
`qtd_prevista = 4` do monitoramento mantido (B4), `permite_multiplos` de
`legisla_aliada` mantido, escopo do seletor por etapa inalterado (E2), sem tipo
"Outro" (E3), sem edição por tela (E4 — AD-006 permanece N/A).

### Deltas apurados

| Achado | Veredito |
| :-- | :-- |
| `legisla_aliada` é o checklist #2 | ✅ **confirmado ativo** — fecha a pendência aberta desde o seed e a D8 |
| `sprint` ↔ #6 "Reunião Semanal" | **substitui** — renomear |
| `monitoramento` "Monitoramento mensal" ↔ #10 "Monitoramento" | **substitui** — renomear |
| `organograma` "Proposta de Organograma" | **ausente da lista** → descarta (`ativo = false`), com a hipótese de fusão em #9 a confirmar |
| #5 "Registros Insights" | **não é tipo de registro** — as 4 perguntas batem 4/4 com `ref_pilar_insight`; é `fat_insight` (A6.3 / INC-02) |
| Campo **"Presentes"**, nos 10 checklists | 🔴 **lacuna de modelo** — não existe `rel_registro_participante`. Fora do escopo desta feature, registrado em TIP-07 |
| Os 11 campos de **link/anexo** | ✅ `ck_artefato_tipo` já enumera 10 deles, um a um — o modelo aprovado antecipou |

---

## Restrições registradas para a fase de execução

- `ref_*` é **GRANT-only, não RLS** (AD-030) — nenhuma política nova.
- Migrations **forward-only**: correção é arquivo novo. Criar com
  `supabase migration new`, nunca prefixo `00NN_` manual.
- **Nenhuma escrita no banco de dev nesta sessão** e nenhum `test:integration`:
  o dev é compartilhado e a sessão concorrente escreveu `fat_registro` id 264
  durante esta análise.
- Aposentadoria de tipo com linha dependente é `ativo = false`; `DELETE` falha por
  FK (`fat_registro.id_tipo_registro` é NOT NULL e sem `ON DELETE`).
- Tipo cruzando produto é **proibido pelo banco** (`trg_registro_produto`), não pela
  UI: "Mentoria" na Estratégia exige linha nova ancorada em etapa da Estratégia.
- Atualizar, na mesma task da migration, a contagem cravada de 11 em
  `catalogos-referencia-seed.integration.test.ts` e os fixtures que selecionam por
  `codigo = 'monitoramento'`.
