# Fatos Geradores — Linha do Tempo e Ciclo de Vida — Context

**Gathered:** 2026-09-15
**Spec:** `.specs/features/fatos-geradores-ciclo-vida/spec.md` (ainda não escrito — bloqueado pelas decisões abertas abaixo)
**Status:** Revisão de mockup concluída · aguardando decisão de Pedro nos itens D-5 a D-9

---

## Feature Boundary

Aba **Fatos Geradores e Registros** do contrato: duas visões (Linha do Tempo e
Ciclo de Vida) e o wizard de dois passos de registro de Fato Gerador.

**Telas de origem:**

| Nó Figma | Tela |
| --- | --- |
| `108:4` | Linha do Tempo — feed cronológico + painel de detalhe |
| `109:4` | Ciclo de Vida — KPIs + cadeias (Insight → Fato Gerador) |
| `118:6` | Registrar Fato Gerador — passo 1 (natureza + origem) |
| `118:96` | Registrar Fato Gerador — passo 2 (dados + tipologia) |

Schema já provisionado por `incidencia-encontros` (2026-08-14):
`fat_fato_gerador`, `rel_fato_origem`, `fat_insight`, `rel_insight_origem`,
`fat_registro`, `mv_iip_contrato`, `vw_iip_contrato`.

---

## Revisão de mockup (gate `figma-dominio-legisla`, modo 3)

**19 divergências.** Esta tela reincidiu em quatro erros que já estavam
catalogados na skill — vale dizer em voz alta, porque a lista existe justamente
para isso.

### A. Termo inventado — o canônico vence

| Tela | Veio assim | É assim | Prova |
| --- | --- | --- | --- |
| `118:96` | **"D1 (Capital Político Institucional)"**, **"D2 (Influência Política)"**, **"D3 (Impacto)"** | **Reincidência.** As dimensões **não têm nome** — a fórmula do IIP segue com a área de conhecimento (D2 em aberto). Rotular "Nível D1/D2/D3" e parar aí | `docs/features-e-camadas-v3.md:246` |
| `108:4` | **"D1 (Grau de Impacto)"**, **"D2 (Urgência Política)"**, **"D3 (Nível de Certeza)"** | Idem — e são **nomes diferentes dos da outra tela**, o que prova que foram inventados nas duas | idem |
| `118:96`, `108:4` | Régua de **5 bolinhas**, valores **"Nível 4"**, **"Nível 5"** | **Reincidência.** São **4 níveis nomeados**: Baixo · Médio · Alto · Máximo. Não existe nível 5 | `ref_nivel_iip` (4 linhas) |
| `118:96` | Grupo **"Infraestrutura"** | Não está nos 11 grupos. A tipologia mostrada (`Projeto de lei / proposição`) pertence a **"2. Produção Legislativa"** | `ref_tipologia.grupo` |
| `118:96` | Níveis exibidos **4/3/5** para a tripla `Produção Legislativa › Projeto de lei / proposição › Em tramitação ativa` | O seed define **baixo / médio / médio** para essa tripla exata | seed `20260813191324` |
| `108:4` | **"Pilar: Financeiro"** | Os 4 pilares são outros (Contexto sociopolítico · Incidência política · Desafio/problema do momento · Conquistas e boas práticas) | `ref_pilar_insight` |
| `108:4` | Tipos de registro **"Reunião"**, **"Ofício"**, **"Nota de Reunião"** | Não existem. Os aprovados são Pontapé, Comitê Político, Escuta Diagnóstica, Imersão, Sprint, Diagnóstico de Organograma, Proposta de Organograma, Monitoramento mensal, Replicação, Legisla Aliada, Mentoria | `ref_tipo_registro` |
| `109:4` | Estados **"Acordo formalizado"**, **"Protocolada com apoio"** | Não constam no seed das 51 triplas (0 ocorrências) | `uq_tipologia_tripla` |
| `108:4` | **"05 de Setembro de 2026 às 14:30"** como data do fato | **Reincidência.** `dt_ocorrencia` é **DATE**, sem hora | `fat_fato_gerador` |
| `108:4` | Botão **"Ver no Ciclo de Vida"** | Estava catalogado como invenção — **mas agora o Ciclo de Vida foi desenhado** (`109:4`). Deixa de ser invenção de rótulo e vira a capacidade nova D-8 | — |
| `118:96` | **"Contribuição da Legisla (Opcional)"** | **Contribuição Legisla (0–5, opcional)** | `ck_fato_contribuicao` |
| `118:96` | **"Descrição da Evidência (Opcional)"** | **Descrição / evidência (opcional)** | `fat_fato_gerador.descricao_evidencia` |
| `108:4` | **"Fonte: Relatórios de Base"** | Campo não existe em nenhuma das entidades | — |
| `108:4` | Badges **"META ESTRATÉGICA"**, **"Etapa de Cadeia"**, **"Não Conectado"** | Nenhum existe. Fato sem origem é **caso válido e frequente** e não deve ser marcado como falha | `rel_fato_origem` |

**O que veio certo** (vale registrar, para a lista não virar só reclamação):
Preditor 1 "Constroem Partido" e Preditor 2 "Pautam os Debates" estão com a
grafia canônica; os preditores aparecem como **leitura derivada da tipologia**,
não como select livre — exatamente a correção que já tinha sido feita no
código; a tripla Grupo › Tipologia › Estado está como **três selects
encadeados**; o IIP em `109:4` está rotulado **(provisório)**; `dt_ocorrencia`
no wizard é datepicker de dia, sem hora.

### B. Capacidade nova — **decisão de schema, não de desenho**

**D-5 · "Pré-Insight"** (`118:6`, `108:4`, `109:4`)
Aparece como entidade de primeira classe: chip de filtro, card na timeline, KPI
próprio ("PRÉ-INSIGHTS 5"), opção de origem no wizard. **Não existe no
sistema.** Há `fat_insight` e nada entre o registro bruto e o insight. É tabela
nova (com RLS, autor, timestamp — AD-001/AD-006), ou é um `fat_insight` com
flag de maturidade, ou o conceito sai das telas.

**D-6 · Fato Gerador que ainda não aconteceu** (`118:6`, `118:96`, `109:4`, `227:194`)
O wizard abre com **"Já aconteceu / Ainda vai acontecer"**; o Ciclo de Vida tem
"Cadeia Projetada (em análise)" com card **PROJETADO** e botão **"Registrar
como realizado"**; o KPI diz "3 projeções em aberto". `fat_fato_gerador` não
tem coluna de natureza nem de estado — e `dt_ocorrencia` é `NOT NULL`, o que um
fato futuro não tem como preencher honestamente. Decisões acopladas: projeção
entra no IIP? (a tela `109:4` diz "Somente realizados" — então não); o que
acontece com a data na transição; quem pode promover.

**D-7 · Título do Fato Gerador** (`118:96`, `108:4`, `109:4`)
Campo **obrigatório** no wizard ("Título *") e é o que todos os cards exibem.
`fat_fato_gerador` **não tem coluna de título** — só `descricao_evidencia`.
Sem decisão aqui, as três telas não têm o que renderizar como cabeçalho.

**D-8 · Cadeia / Ciclo de Vida** (`109:4`)
As cadeias (A, B, C, D, E, Projetada) agrupam Pré-Insight → Meta → Fato
Gerador, admitem **mais de um fato por cadeia** ("Origem comum") e cadeia que
começa direto no Fato Gerador. Hoje `rel_fato_origem` liga um fato a Meta e/ou
Insight — não existe objeto "cadeia". Ou é derivada por view (agrupando por
origem comum, e aí "Cadeia A/B/C" é rótulo posicional, não identidade), ou é
entidade nova nomeável.

**D-9 · Registro como origem de Fato Gerador** (`118:6`)
O wizard oferece quatro origens: **Pré-Insight · Registro · Insight · Meta**.
`ck_fato_origem` exige `id_meta IS NOT NULL OR id_insight IS NOT NULL` — não há
coluna para Registro. Ampliar `rel_fato_origem` é migration; alternativa é
chegar ao Registro pelo Insight (`fat_insight.id_registro`), que já existe.

### C. Regra de apresentação a definir

- `109:4` — IIP **8.4** com D1 2.8 / D2 3.1 / D3 2.5. A escala dos níveis é
  1–4; um total 8.4 não sai óbvio dessa régua. A aritmética do IIP é a decisão
  D2 ainda em aberto — a tela já rotula **(provisório)**, o que está correto,
  mas a spec não pode fixar a fórmula.
- `109:4` — badges isolados **D1 / D2 / D3** nos cards (sem nível). Significado
  não definido; se for "dimensão dominante", é derivação nova.
- `108:4` — "FATOS GERADORES 12/15": o denominador 15 não tem origem definida.

---

## Implementation Decisions

Decididas com Pedro em 2026-09-15.

### D-5 · Pré-Insight → **tabela nova `fat_pre_insight`**

- Entidade de primeira classe, como o desenho mostra. Escopada por contrato,
  com RLS no mesmo DDL (AD-001) e autor + timestamp (AD-006).
- É o sinal bruto ainda não qualificado: o que a assessoria capta antes de
  virar Insight. Campos mínimos derivados das telas: conteúdo, data, autor.
- **Precisa de decisão de produto em Design**, não aqui: um Pré-Insight
  "promove" para Insight (vira `fat_insight` e o original some/é marcado), ou
  os dois coexistem para sempre? A timeline `108:4` mostra os dois tipos lado a
  lado, o que sugere coexistência.

### D-6 · Fato futuro → **coluna de situação + data prevista**

- `situacao TEXT NOT NULL DEFAULT 'realizado'` com
  `CHECK (situacao IN ('projetado','realizado'))`.
- `dt_prevista DATE` nullable para o projetado; `dt_ocorrencia` deixa de ser
  `NOT NULL` e passa a ser exigida por constraint **só quando realizado**:
  `CHECK ((situacao = 'realizado' AND dt_ocorrencia IS NOT NULL) OR (situacao = 'projetado' AND dt_prevista IS NOT NULL))`.
  Migration forward-only; fatos existentes já são todos `realizado` com data.
- **Projeção não entra no IIP** — `mv_iip_contrato` filtra `situacao = 'realizado'`.
  É o que a própria tela `109:4` já declara ("Somente realizados").
- "Registrar como realizado" é transição: exige `dt_ocorrencia` no ato.

### D-8 · Cadeia → **derivada por view, nunca persistida**

- View que agrupa por origem comum. "Cadeia A/B/C" é **rótulo posicional da
  tela**, não identidade — não há nome de cadeia no banco e a letra pode mudar
  entre carregamentos conforme a ordenação.
- Respeita AD-003 (número de gestão sai de view) e não cria objeto para manter
  em sincronia quando a origem muda.
- Acomoda os três formatos desenhados: cadeia de um fato, cadeia de vários
  fatos com "Origem comum", e cadeia que começa direto no Fato Gerador.

### D-9 · Origens do Fato Gerador → **as quatro**

- `rel_fato_origem` ganha `id_pre_insight` e `id_registro`.
- `ck_fato_origem` afrouxa para exigir **ao menos uma das quatro** origens.
- **Fato sem origem nenhuma continua válido** — é caso frequente, e a tela não
  pode marcá-lo como falha (o badge "Não Conectado" de `108:4` sai).

---

## Declined / Undiscussed Gray Areas → Assumptions

| Assunto | Default adotado | Por quê |
| --- | --- | --- |
| Título do Fato Gerador (D-7) | Coluna `titulo TEXT` **nullable** no banco, **obrigatória no formulário novo**. Fatos anteriores exibem as primeiras ~80 chars de `descricao_evidencia` como cabeçalho | `NOT NULL` quebraria os fatos já gravados; forward-only não permite voltar atrás |
| Fórmula do IIP | A spec **não fixa** a aritmética. Exibe o que `vw_iip_contrato` devolve, sempre rotulado **(provisório)** | Decisão D2 segue com a área de conhecimento; fixar agora seria inventar |
| Badges isolados D1/D2/D3 nos cards (`109:4`) | Saem desta rodada | Significado não definido; se for "dimensão dominante" é derivação nova, e não há regra aprovada |
| Denominador de "FATOS GERADORES 12/15" | Sai desta rodada — o KPI mostra só a contagem absoluta de fatos realizados, mais "N projeções em aberto" | O 15 não tem origem no schema; um denominador inventado é dado falso |

---

## Segunda rodada de decisão — 2026-09-15

### Escopo da aba → **casa única da Incidência** (AD-057)

**Falha de escopo minha, apontada por Pedro.** A primeira versão desta spec
tratava Registro apenas como item **exibido** na linha do tempo. Mas a aba se
chama "Fatos Geradores **e Registros**", a timeline mostra as quatro entidades
lado a lado, e Pedro esperava a escrita junto.

Estado de origem — a Incidência está espalhada em três telas hoje:

| Entidade | Onde se cria hoje | Destino |
| --- | --- | --- |
| Registro | `/contratos/[id]/etapas/[codigo]` (`RegistroForm`) | Migra para a aba |
| Insight | `ficha-contrato-chrome.tsx` (`InsightForm`) | Migra para a aba |
| Fato Gerador | `ficha-contrato-chrome.tsx` (`FatoGeradorForm`) | Substituído pelo wizard |
| Listagem de Registros | `/produtos/[slug]/agenda` | **Permanece** — calendário ≠ incidência |

**O risco que isso cria e que Design precisa tratar:** o `RegistroForm` hoje
recebe a etapa pela rota (`/etapas/[codigo]`). Fora daquele contexto, o vínculo
com `fat_etapa_contrato` não vem de graça — o formulário migrado precisa pedir a
etapa explicitamente, ou registros nascem órfãos da régua. É o FGC-17.

Segundo risco: duas telas em produção perdem função na mesma feature. Aposentar
mal deixa ponto de entrada órfão — o usuário clica e nada acontece.

---

## Deferred Ideas

- Aba "Planejado" (terceiro modo em `108:4`) — só o rótulo foi desenhado, sem
  conteúdo. Fora do escopo até existir mockup.
- Divergência de navegação entre as duas telas: `108:4` nomeia a aba "Fatos
  Geradores e Registros" e inclui "Gestão da equipe"; `109:4` nomeia "Fatos
  Geradores" e omite. Alinhar na spec de navegação, não aqui.

---

## Restrição de verificação conhecida

Mesma de `planejamento-estrategico-v2`: sem harness de componente (L-006/L-007),
ACs puramente de JSX chegam ao Verifier sem evidência automatizada. Empurrar
regra para funções puras — agrupamento de cadeias, derivação de níveis a partir
da tripla, ordenação da timeline, formatação de data.
