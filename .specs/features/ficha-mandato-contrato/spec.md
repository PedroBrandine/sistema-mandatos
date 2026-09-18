# Ficha do Mandato/Contrato — Especificação

- **Fase:** Specify
- **Criada em:** 2026-09-15
- **Origem:** 19 telas validadas no Figma (arquivo `eS5CdQrl6yUdYctZwlDzps`), revisadas em duas
  rodadas contra `docs/schema_sistema.sql` com a skill `figma-dominio-legisla`
- **Escopo auto-dimensionado:** **Large** — múltiplos componentes, schema novo, re-seed de
  catálogo aprovado, reestruturação de navegação

## Nós do Figma que esta spec traduz

| Nó | Tela |
| :-- | :-- |
| `57:6` | Ficha → Informações Gerais |
| `57:185` | Ficha → Agenda (grade + lista de registros), escopo de contrato |
| `84:74` | Modal "Novo Agendamento" |
| `90:206` | Popover do encontro |
| `90:469` | Adicionar Registro — Governança · Reunião Semanal |
| `336:49` · `336:117` · `336:185` · `336:253` · `336:361` · `336:433` · `336:501` · `336:586` · `336:646` | Adicionar Registro, um por Etapa·Tipo |
| `57:508` | GIP → preenchimento (momento Início) |
| `81:2` | GIP → Evolução |

---

## Problem Statement

A ficha do contrato hoje navega por **etapa** (uma aba por linha de `ref_etapa`), o que obriga a
usuária a saber em que etapa um dado mora antes de procurá-lo, e deixa Agenda, GIP e Registros sem
superfície própria. O desenho validado troca isso por oito abas funcionais e, no caminho, expõe
quatro lacunas de dado reais: o GIP em produção usa um catálogo de dimensões diferente do que a
metodologia usa hoje; os campos extras de cada tipo de registro não têm onde ser declarados nem
onde ser gravados; o mandato não guarda biografia, pautas nem áreas temáticas; e `fat_artefato` —
a tabela que consolidaria os 14 "Link ..." das planilhas — nunca foi provisionada.

## Goals

- [ ] Ficha do contrato navegável por função (8 abas), sem aba derivada de `ref_etapa`
- [ ] Registro de encontro com **camada dinâmica por Etapa+Tipo**, declarada em catálogo e gravada
      em `fat_registro.conteudo` + `fat_artefato` — zero coluna nova por tipo de registro
- [ ] GIP alinhado à metodologia vigente: 4 dimensões novas, faixas 0–3 / 0–2, descritor de nível
      em catálogo, momentos Início e Fim, e a aba Evolução lendo número derivado
- [ ] Ficha de mandato com identidade editorial (minibiografia, pautas, áreas temáticas, contatos)
- [ ] Nenhum rótulo em tela divergente do vocabulário canônico (checklist da skill
      `figma-dominio-legisla` passa limpo)

## Out of Scope

| Item | Motivo |
| :-- | :-- |
| Upload de fotos (Supabase Storage) | Não existe uso de Storage no repositório; bucket + policies + RLS é fatia própria. A tela renderiza o bloco como **"em desenvolvimento"** (FMC-22) |
| Card "Código de acesso" (`57:6`, direita) | Decisão de Pedro (2026-09-15): vai na feature de login. O `convite_contrato` entregue (CVT-01..11, AD-033) não é tocado por esta spec |
| Edição inline de status/etapa no "Histórico de Contratos" | `status` só muda por fluxo de contrato e `nao_concluido` exige `motivo_encerramento` (`ck_contrato_motivo`); etapa só muda no Kanban (AD-023). Aqui é leitura |
| Conteúdo da aba **Fatos Geradores e Registros** | Já tem dona: `.specs/features/fatos-geradores-ciclo-vida/` (Specify concluído, aguardando aceite; nós `108:4`, `109:4`, `118:6`, `118:96`; AD-053/054/055). Aqui entra como rota + placeholder (FMC-04) |
| Conteúdo da aba **Diagnóstico** | Nenhum dos 19 mockups desenha o interior. Rota + placeholder explícito (FMC-04); conteúdo é spec própria |
| Tela "Proposta de Organograma" (`336:433`) | B-02: o tipo `organograma` segue `ativo = false` (TIP-03) — fundido em "Diagnóstico de Organograma". Não se implementa formulário para tipo que o seletor não lista |
| Conteúdo da aba **Planejamento Estratégico** | Já tem dona: `.specs/features/planejamento-estrategico-v2/` (Specify concluído, aguardando aceite; nós `227:194`, `271:808`, `271:724`, `271:856`) |
| `DROP COLUMN fat_registro.canal` | Remoção em camadas, precedente AD-049: sai do produto agora, derrubar a coluna é decisão separada |
| Eixo `onde_chegamos` como "aspiração vs realidade" | O desenho reinterpreta os dois eixos como dois momentos no tempo. Ver Assumption A-09 |
| Telas de Planejamento Estratégico e Formulários | Já entregues (`planejamento-estrategico-redesenho`, `formularios-produto`); aqui só viram aba |

---

## Assumptions & Open Questions

| # | Assunção / decisão | Default escolhido | Racional | Confirmado? |
| :-- | :-- | :-- | :-- | :-- |
| A-01 | Abas por etapa somem da navegação — e as rotas? | `/contratos/[id]/etapas/[codigo]` **continua existindo**, alcançável pelo Kanban e por link direto; só sai da barra | Precedente exato de NAV-14/15, que fez isso com `/mandatos`, `/coalizoes` e `/usuarios` sem apagar rota | y (decorre da decisão de Pedro, 2026-09-15) |
| A-02 | Barra nova em contrato de **coalizão** | Mesma barra, **sem** "Informações Gerais" | Coalizão não tem `dim_mandato`; o chrome atual já ramifica por `tipo_contratante`. As outras 7 abas não dependem de mandato | n |
| A-03 | "Principais Pautas" é catálogo ou texto livre? | **Texto livre** — `dim_mandato.principais_pautas TEXT[]` | "Áreas Temáticas" já é o campo de catálogo (`ref_agenda_tematica`); dois catálogos paralelos para a mesma ideia seria duplicação. O desenho os distingue visualmente | n |
| A-04 | "Dados de Contato" (Parlamentar / Chefe de Gabinete) | **Derivado**, não digitado: `rel_usuario_contrato` (`cargo` = `parlamentar` \| `chefe_gabinete`) → `dim_usuario.nome/telefone/email` | As colunas já existem e a pessoa já precisa ser usuária para acessar o sistema. Evita duplicar dado pessoal (LGPD) em `dim_mandato` | n |
| A-05 | Onde mora o "Ponto Focal Legisla" | `fat_contrato.id_usuario_ponto_focal BIGINT REFERENCES dim_usuario` | Pedro: "apenas uma tag para mencionar algum usuário Legisla, nada de mais". Acrescentar valor a `ck_vinculo_papel` criaria um papel de RLS que ninguém pediu | n |
| A-06 | Seed de `ref_agenda_tematica` fecha CAT-16 | **30 temas** propostos pelo agente e aceitos por Pedro em 2026-09-15 | O roadmap descreve CAT-16 como pendente de levantamento humano; passa a ser decisão de produto datada. Exige AD | y |
| A-07 | Esses 30 temas aparecem também em Planejamento | Sim, inevitavelmente | `ref_agenda_tematica` já é FK de `fat_objetivo_especifico` e `fat_meta`. Não é efeito colateral a evitar, é o catálogo ganhando conteúdo | y |
| A-08 | Registro retroativo (sem encontro) | Existe, sempre tipo **Legisla Aliada**, e a seção "Presentes" **não é renderizada** | Pedro, 2026-09-15. Presença mora em `rel_encontro_participante`, que pendura no encontro — sem encontro não há onde gravar | y |
| A-09 | `eixo` `regua_sonhos`/`onde_chegamos` vs Início/Fim | Os dois eixos **são** os dois momentos: `inicio → regua_sonhos`, `fim → onde_chegamos`, como `app.trg_deriva_gip` já grava | Preserva `vw_gip_evolucao` e o caminho de escrita existente. O comentário D6 do schema ("aspiração vs leitura posterior") fica **desatualizado** e precisa de AD | n |
| A-10 | `momento = 'meio'` | Permanece no `ck_gip_momento`, **sem superfície** | Pedro: avaliação em dois momentos. Derrubar valor de CHECK é migration forward-only por um ganho nulo | y |
| A-11 | Descritores de nível do GIP | Tabela nova `ref_nivel_dimensao_gip (id_dimensao, valor, descricao)` | `ref_dimensao_gip` só tem faixa numérica. Precedente: `ref_nivel_iip` já é "nível nomeado em catálogo". JSONB em `schema_campos` não serve — isto é catálogo consultável, não payload | n |
| A-12 | Re-seed do GIP e dados já gravados | Migration forward-only que **renomeia e re-faixa as 4 linhas existentes** de `ref_dimensao_gip`; linhas de `fat_gip_dimensao` em dev são descartadas por `supabase/seed_test.sql` | Produção não tem GIP preenchido (a superfície é recente). Se houver linha real, o valor antigo 1–4 passa a significar outra coisa — a migration precisa falhar alto, não converter em silêncio | n |
| A-13 | Numerador do "nº X de Y" | `fat_registro.nr_sequencia` atribuída **pelo servidor** na criação (`MAX+1` por contrato+tipo, dentro da transação); `Y` = `ref_tipo_registro.qtd_prevista` | Sequência atribuída no cliente corre risco de colisão; a coluna já existe e `qtd_prevista` já é o denominador projetado | n |
| A-14 | Bloco "APOIO — Definidos no agendamento" (`90:469`) | **Não implementado** — morre ao conformar `90:469` ao padrão dos `336:*` | Aparece em uma única tela, é a mais desatualizada da família, e não existe campo "Apoio" no Novo Agendamento (`84:74`) que o alimentaria | n |
| A-15 | "Local" na camada dinâmica da Imersão | Mesmo `fat_encontro.local`, exibido **somente leitura**, herdado do agendamento | Confirmado por Pedro, 2026-09-15 | y |
| A-16 | Etapa+Tipo do registro | **Herdados do encontro e imutáveis** após a criação, como a nota de `84:74` declara | É o que define qual camada dinâmica renderiza; deixar mutável exigiria migrar `conteudo` e `fat_artefato` entre formatos | y |
| A-17 | ~~Desenho escreve "Monitoramento", catálogo tem "Monitoramento mensal"~~ | **Sem divergência** — a migration `20260911032046` (feature `revisao-tipos-registro`, TIP-02) já renomeou para "Monitoramento" | O desenho está alinhado ao catálogo real. Assunção retirada | y |
| A-18 | A aba "Diagnóstico" pressupõe o renome da etapa `raio_x` | **Já feito** — migration `20260910152709`, confirmada por evidência independente nos checklists da operação (Bloco D de `revisao-tipos-registro/context.md`) | A operação já chama `raio_x` de "Diagnóstico" espontaneamente. Esta feature só consome | y |
| A-19 | Camada dinâmica da Imersão inclui **"Link planilha de monitoramento"** (checklist #8), ausente do Figma | Entra na camada, mapeado para `ck_artefato_tipo = 'outro'` | Os 10 checklists são fonte mais autoritativa que o mockup (Bloco A). O enum cobre 10 dos 11 links um a um; este é o que sobra | n |
| A-20 | Figma `336:501` (Monitoramento) perdeu a seção de metas, mas o checklist #10 pede **"Atingimento de metas"** | Prevalece o desenho — seção fora desta feature | Pedro removeu a seção deliberadamente em 2026-09-15, depois do meu apontamento. O vínculo registro↔meta que ela exigiria não existe no modelo | y |
| A-23 | AD-057 ("aba de Incidência é o único ponto de criação de Registro") colide com o popover do encontro desta feature | **Popover sobrevive como exceção documentada** (AD-061) — continua abrindo `RegistroEncontroForm` inline | Decisão de Pedro, 2026-09-17. O popover já parte de um Encontro resolvido (Etapa/Tipo herdados); AD-057 mira criação livre, sem contexto | y |
| A-22 | A barra de 8 abas desaloja dois elementos da navegação atual | **Botão solto "Planejamento Estratégico"** sai do cabeçalho (virou aba apontando para a mesma rota — manter os dois criaria duas âncoras com o mesmo nome acessível para o mesmo destino); **aba "Encontros"** sai da navegação, rota preservada | Decorre da AC1 ("exatamente 8 abas"). A rota `/contratos/[id]/encontros` segue alcançável por link direto, mesmo precedente NAV-14/15 da A-01. Decidido na execução da T22, 2026-09-16 | y |
| A-21 | Com `rel_registro_participante` (B-01), presença passa a existir em duas tabelas | **Significados distintos, sem sincronia**: `rel_encontro_participante.presente` = presença do **encontro** (o que "Marcar presença" do popover grava, EST-13, e o que move `planejado → realizado`); `rel_registro_participante` = quem **de fato esteve**, registrado no lançamento | São fatos de momentos diferentes: o encontro é plano, o registro é o que aconteceu. Sincronizar as duas criaria escrita cruzada sem dono. A lista do registro nasce pré-marcada da do encontro (FMC-18 AC10) e segue independente | n |

**⚠️ Duas questões bloqueantes, não assunções** — estão em "Decisões pendentes" abaixo, porque
nenhum default meu seria seguro: a presença no registro (B-01) e a Proposta de Organograma (B-02).

### Decisões resolvidas (eram bloqueantes)

**B-01 — RESOLVIDA em 2026-09-15 (Pedro): opção (a).** Entra `rel_registro_participante`. Fecha a
lacuna TIP-07 aberta por `revisao-tipos-registro` e atende os 10 checklists da operação.

**B-02 — RESOLVIDA em 2026-09-15 (Pedro): permanece "Diagnóstico de Organograma".**
"Proposta de Organograma" (`organograma`) **segue aposentada** (`ativo = false`, TIP-03) — a
hipótese de fusão no checklist #9 fica **confirmada**, e o handoff de `revisao-tipos-registro` pode
riscar o "ponto a confirmar na próxima demo". O desenho `336:433` sai do escopo desta feature.

Registro do que era a dúvida, mantido para rastreabilidade:

**B-01 — Onde mora a presença de um registro sem encontro.**
Os **10 checklists reais da operação pedem "Presentes" em todos os tipos**, inclusive Legisla
Aliada (#2), que é exatamente o tipo dos registros retroativos (A-08). O modelo aprovado não tem
onde guardar isso: só existe `rel_encontro_participante`, que pendura no **encontro**. A lacuna já
está catalogada como **TIP-07** em `revisao-tipos-registro`, com duas saídas mapeadas e nenhuma
escolhida:

| Opção | O que custa | O que quebra |
| :-- | :-- | :-- |
| (a) Tabela nova `rel_registro_participante` | Migration + RLS + grants + mais uma superfície de escrita; presença passa a existir em dois lugares | Nada — atende os 10 checklists |
| (b) Derivar de `fat_registro.id_encontro` | Zero schema novo; é a A-08 como está escrita | **Registro retroativo fica sem presença** — justamente o caso do Legisla Aliada |

Como Pedro decidiu que registro retroativo existe e cai em Legisla Aliada, a opção (b) falha
exatamente no caso que ele nomeou. Recomendação (a) — **aceita**.

**B-02 — "Proposta de Organograma" está aposentada, mas o Figma tem tela para ela.**
A migration `20260911032046` (TIP-03) marcou `ativo = false` no tipo `organograma`, porque ele
**não aparece em nenhum dos 10 checklists** — sob a hipótese de ter sido fundido no #9 ("Diagnóstico
de Organograma"). O handoff registra essa hipótese como "a confirmar na próxima demo". O desenho
`336:433` a traz de volta como tela própria, com artefato próprio — evidência contra a fusão.
**Desfecho: a fusão vale.** A tela sai do escopo.

**Open questions:** nenhuma. Tudo resolvido ou registrado como assunção; as linhas com
`Confirmado? = n` são defaults do agente, reversíveis antes de Tasks.

---

## Nota de verificação (AD-042 integral)

**AD-046 não se aplica a esta feature.** O corte de profundidade de teste de componente ("só o
caminho feliz") é explicitamente restrito a `redesenho-estrategia-tela-first` e "não se aplica a
nenhuma feature futura sem decisão própria". Aqui vale **AD-042 integral**: toda AC que descreve
comportamento de tela exige teste de componente passando, com os dois lados de cada condicional,
estado vazio e estado de erro. Leitura de código não é evidência.

Consequência para Design: empurrar regra para **funções puras** sempre que possível — derivação do
rótulo de evolução do GIP a partir de `gap`, montagem da camada dinâmica a partir de
`schema_campos`, rotulagem de `ck_contrato_status`, cálculo de `nº X de Y`. Cada uma testada como
função pura custa uma fração do teste de render equivalente.

---

## User Stories

### P1: Barra de abas funcional da ficha ⭐ MVP

**User Story**: Como gestora, quero navegar a ficha do contrato por função (Agenda, GIP,
Formulários…) em vez de por etapa, para encontrar um dado sem precisar saber em que etapa ele mora.

**Why P1**: É o esqueleto. Nenhuma das outras telas tem onde ser servida sem ela.

**Acceptance Criteria**:

1. WHEN a ficha de um contrato de **mandato** é aberta THEN o sistema SHALL renderizar exatamente
   estas 8 abas, nesta ordem: Informações Gerais · Agenda · Diagnóstico · Planejamento Estratégico ·
   GIP · Formulários · Gestão da equipe · Fatos Geradores e Registros.
2. WHEN a ficha é aberta THEN o sistema SHALL NOT renderizar nenhuma aba derivada de `ref_etapa`.
3. WHEN a ficha de um contrato de **coalizão** é aberta THEN o sistema SHALL renderizar as mesmas
   abas **exceto** "Informações Gerais" (A-02).
4. WHEN a aba "Gestão da equipe" é aberta THEN o sistema SHALL servir o conteúdo hoje em
   `/contratos/[id]/vinculos`, com o rótulo "Gestão da equipe" e nenhuma ocorrência do rótulo
   anterior "Assessores" na navegação.
5. WHEN a rota `/contratos/[id]/etapas/[codigo]` é acessada diretamente THEN o sistema SHALL
   continuar renderizando a tela da etapa (A-01).
6. WHEN as abas "Diagnóstico" ou "Fatos Geradores e Registros" são abertas THEN o sistema SHALL
   renderizar `<EmDesenvolvimento>` com título próprio, nunca uma tela em branco.
7. WHEN a barra é renderizada THEN o rótulo SHALL ser **"Fatos Geradores e Registros"** e a aba
   **"Gestão da equipe"** SHALL estar presente — resolvendo a divergência de navegação entre os
   nós `108:4` e `109:4`, deferida por `fatos-geradores-ciclo-vida` para "a spec de navegação",
   que é esta.

**Independent Test**: abrir `/contratos/[id]` de um mandato e de uma coalizão e conferir a lista de
abas renderizada; abrir uma rota de etapa por URL e ver a tela da etapa.

---

### P1: Informações Gerais do mandato ⭐ MVP

**User Story**: Como gestora, quero ver e editar a identidade do mandato (biografia, pautas, áreas
temáticas, contatos, ponto focal) num lugar só, para não depender de planilha paralela.

**Why P1**: É a aba padrão da ficha; hoje mostra só espelho TSE (NAV-16) e não guarda nada disso.

**Acceptance Criteria**:

1. WHEN o card "Sobre o Mandato" é aberto em edição e uma minibiografia é salva THEN o sistema
   SHALL persistir o texto em `dim_mandato.minibiografia` e reexibi-lo na releitura da ficha.
2. WHEN nenhuma minibiografia foi preenchida THEN o sistema SHALL exibir `—` (AD-005), nunca
   string vazia nem texto sentinela.
3. WHEN áreas temáticas são vinculadas ao mandato THEN o sistema SHALL gravar uma linha por tema em
   `rel_mandato_agenda_tematica` e SHALL oferecer como opções **apenas** os temas ativos de
   `ref_agenda_tematica`.
4. WHEN o seletor de áreas temáticas é aberto THEN o sistema SHALL listar os 30 temas do seed
   (FMC-09), ordenados por `ordem`.
5. WHEN o mesmo tema é vinculado duas vezes ao mesmo mandato THEN o banco SHALL rejeitar a segunda
   gravação por constraint de unicidade, não por checagem no cliente.
6. WHEN o card "Dados de Contato" é renderizado THEN o sistema SHALL derivar Parlamentar e Chefe de
   Gabinete de `rel_usuario_contrato.cargo` + `dim_usuario` (A-04), e SHALL exibir `—` para cada
   contato ausente.
7. WHEN um usuário Legisla é escolhido como Ponto Focal THEN o sistema SHALL gravar
   `fat_contrato.id_usuario_ponto_focal` e SHALL exibir a tag com o nome desse usuário.
8. WHEN o card "Histórico de Contratos" é renderizado THEN o sistema SHALL listar todos os
   `fat_contrato` do mesmo `id_contratante` e SHALL rotular `status` exatamente como
   **Ativo · Concluído · Não concluído** — nunca "Em andamento" nem nome de etapa.
9. WHEN o card "Projetos e Coalizões Vinculados" é renderizado THEN o sistema SHALL listar o
   `ref_projeto` do contrato e as coalizões de `rel_coalizao_membro`, cada um com seu badge de tipo.
10. WHEN pautas são salvas no card "Sobre o Mandato" THEN o sistema SHALL persistir cada uma como
    elemento de `dim_mandato.principais_pautas` (texto livre, A-03) e SHALL reexibi-las como chips
    na ordem em que foram gravadas; WHEN o array está vazio THEN SHALL exibir `—`.

**Independent Test**: preencher biografia + 2 pautas + 3 áreas temáticas + ponto focal num mandato,
recarregar a ficha e ver tudo de volta; conferir que o histórico mostra "Ativo", não "Em andamento".

---

### P1: Registro de encontro com camada dinâmica ⭐ MVP

**User Story**: Como gestora, quero que o formulário de Registro me peça exatamente os campos que
aquele Etapa+Tipo exige, para não ter que lembrar que Imersão pede cronograma e Pontapé pede termo.

**Why P1**: É o maior ganho operacional do redesenho e o que justifica provisionar `fat_artefato`.

**Acceptance Criteria**:

1. WHEN o formulário de Registro é aberto a partir de um encontro THEN o sistema SHALL exibir
   Etapa e Tipo herdados do encontro, em leitura, sem controle de edição (A-16).
2. WHEN o Tipo tem `qtd_prevista` preenchida THEN o sistema SHALL exibir a sequência no formato
   `nº X de Y`, com `X` = `fat_registro.nr_sequencia` e `Y` = `ref_tipo_registro.qtd_prevista`.
3. WHEN um registro é criado THEN o servidor SHALL atribuir `nr_sequencia` como o sucessor do maior
   valor existente para o mesmo contrato e tipo, dentro da mesma transação (A-13).
4. WHEN o Tipo tem campos declarados em `ref_tipo_registro.schema_campos` THEN o sistema SHALL
   renderizar o bloco "Camada dinâmica · [nome do tipo]" com exatamente esses campos.
5. WHEN o Tipo **não** tem campos declarados THEN o sistema SHALL exibir "Nenhum campo extra
   necessário para este Tipo de Registro", nunca um bloco vazio.
6. WHEN um campo declarado é do tipo link THEN o sistema SHALL gravar uma linha em `fat_artefato`
   com `escopo = 'registro'`, `id_referencia` = o registro, e o `tipo` do enum correspondente.
7. WHEN uma URL que não começa com `http://` ou `https://` é submetida THEN o banco SHALL rejeitar
   a gravação (`ck_artefato_url`) e a UI SHALL exibir a falha via `<ErroInline>`.
8. WHEN um campo declarado é do tipo texto THEN o sistema SHALL gravar o valor em
   `fat_registro.conteudo`, sob a chave declarada em `schema_campos`.
9. WHEN um registro é salvo THEN o sistema SHALL gravar a presença em **`rel_registro_participante`**
   (B-01), uma linha por pessoa marcada — inclusive quando o registro não tem encontro.
10. WHEN o registro é criado a partir de um encontro THEN a lista "Presentes" SHALL vir
    pré-marcada com os participantes de `rel_encontro_participante`, e a edição SHALL alterar
    apenas `rel_registro_participante` — o `presente` do encontro não é reescrito (A-21).
11. WHEN o formulário de Registro é renderizado THEN o sistema SHALL NOT oferecer o campo **Canal**.
12. WHEN a camada dinâmica da Imersão é renderizada THEN o sistema SHALL exibir "Local" em leitura,
    com o valor de `fat_encontro.local` (A-15).
13. WHEN a gravação de um registro com artefatos falha em qualquer ponto THEN o sistema SHALL não
    deixar registro sem seus artefatos nem artefato órfão — a escrita é uma transação só.

**Independent Test**: criar um registro de Pontapé (1 link), um de Imersão (3 links + local) e um
de Legisla Aliada (nenhum campo extra), e conferir `fat_registro.conteudo` e `fat_artefato`.

---

### P1: GIP conforme a metodologia vigente ⭐ MVP

**User Story**: Como gestora, quero avaliar a Régua dos Sonhos com as 4 dimensões e os descritores
que a metodologia usa hoje, e ver a evolução entre início e fim do ciclo.

**Why P1**: O catálogo em produção descreve outra régua; a tela atual não é utilizável como está.

**Acceptance Criteria**:

1. WHEN `ref_dimensao_gip` é lido após a migration THEN o catálogo SHALL conter exatamente estas 4
   dimensões ativas, nesta ordem e com estas faixas:
   | ordem | nome | faixa |
   | :-- | :-- | :-- |
   | 1 | Performance dos objetivos específicos atrelados aos preditores prioritários | 0–3 |
   | 2 | Monitoramento e atingimento do planejamento | 0–3 |
   | 3 | Capacidade de gestão | 0–2 |
   | 4 | Capacidade de absorção de incidência política | 0–2 |
2. WHEN `ref_nivel_dimensao_gip` é lido THEN SHALL existir exatamente uma linha por par
   (dimensão, valor) dentro da faixa da dimensão — **14 linhas no total** (4 + 4 + 3 + 3) — cada
   uma com o descritor verbatim da metodologia.
3. WHEN a aba GIP é aberta no modo de preenchimento THEN o sistema SHALL renderizar, para cada
   dimensão, uma opção por nível, rotulada `Nível N` + o descritor de `ref_nivel_dimensao_gip`.
4. WHEN um valor fora da faixa da dimensão é gravado THEN o banco SHALL rejeitar por
   `trg_gip_dimensao_faixa`, não por validação só no cliente.
5. WHEN o GIP é salvo THEN a escrita SHALL passar pelo caminho existente
   `fat_submissao` → `app.trg_deriva_gip` → `fat_gip`/`fat_gip_dimensao`, nunca por INSERT direto
   nas tabelas derivadas.
6. WHEN a aba GIP é aberta THEN o seletor de momento SHALL oferecer **Início** e **Fim** apenas
   (A-10), mais a visão **Evolução**.
7. WHEN o momento Início já foi aplicado THEN o sistema SHALL indicá-lo como aplicado e SHALL
   impedir a criação de um segundo GIP do mesmo momento (`uq_gip_contrato_momento`).
8. WHEN a visão Evolução é aberta e os dois momentos existem THEN o sistema SHALL exibir, por
   dimensão, o nível de Início, o nível de Fim e a variação, derivada de `vw_gip_evolucao.gap`.
9. WHEN `gap > 0` THEN o sistema SHALL rotular **Subiu N nível(is)**; WHEN `gap = 0` THEN
   **Manteve**; WHEN `gap < 0` THEN **Regrediu N nível(is)** (A-09).
10. WHEN a visão Evolução é aberta e apenas um dos momentos existe THEN o sistema SHALL exibir
    **"Aguardando o outro momento"** naquela dimensão, nunca variação calculada sobre `NULL`.
    *(Texto fixado em 2026-09-16, fechando uma spec-precision gap levantada na T15: a AC exigia
    "estado explicativo" sem definir a string, o que deixaria a asserção do teste sem alvo.)*
11. WHEN o "Resumo da Evolução" é renderizado THEN as contagens de Evoluíram/Mantiveram/Regrediram
    SHALL somar exatamente o número de dimensões ativas com os dois momentos preenchidos.

**Independent Test**: preencher o GIP de Início, depois o de Fim com um nível acima em duas
dimensões, e conferir que a Evolução mostra 2 "Subiu 1 nível" e o resumo bate.

---

### P2: Agenda na ficha e Novo Agendamento

**User Story**: Como gestora, quero agendar um encontro e ver a agenda do contrato dentro da ficha,
sem sair para a agenda do produto.

**Why P2**: A agenda produto-escopo já existe (EST-12/13); esta é a mesma grade recortada por
contrato, mais o modal de criação que ficou fora do escopo daquela entrega.

**Acceptance Criteria**:

1. WHEN a aba Agenda é aberta THEN o sistema SHALL renderizar a grade do mês recortada pelo
   contrato da ficha, reusando `AgendaMes` e `EncontroPopover`.
2. WHEN "Novo agendamento" é acionado THEN o sistema SHALL abrir o modal com Título, Etapa do
   Produto, Tipo de Registro, início, fim, Modalidade, Local, Tema Prioritário e Participantes.
3. WHEN o modal é salvo THEN o sistema SHALL criar `fat_encontro` **e** suas linhas de
   `rel_encontro_participante` numa transação única.
4. WHEN o seletor de Etapa é aberto THEN o sistema SHALL listar apenas `ref_etapa` do produto do
   contrato; WHEN uma Etapa é escolhida THEN o seletor de Tipo SHALL listar apenas os
   `ref_tipo_registro` daquela etapa.
5. WHEN a Modalidade é `Presencial` THEN o campo Local SHALL ser oferecido; o valor gravado em
   `fat_encontro.modalidade` SHALL ser `presencial` ou `online`, nunca outro.
6. WHEN um participante externo é adicionado THEN o sistema SHALL gravar `nome_livre` com
   `origem = 'externo'`; WHEN é um usuário THEN SHALL gravar `id_usuario` — nunca os dois
   (`ck_participante_identificacao`).
7. WHEN a lista de Registros da agenda é renderizada THEN as colunas SHALL se chamar **Resumo** e
   **Autor** (hoje "Descrição" e "Responsável"), também na agenda produto-escopo já entregue.
8. WHEN `ref_tipo_registro` é lido após a migration THEN o tipo de código `sprint` SHALL ter
   `qtd_prevista = 4`. (O `nome = 'Reunião Semanal'` **já está aplicado** pela migration
   `20260911032046`/TIP-01 — esta feature só acrescenta o denominador da sequência.)

**Independent Test**: agendar um encontro de Governança · Reunião Semanal com 1 participante
externo, vê-lo na grade, abrir o popover e criar o registro a partir dele.

---

## Edge Cases

- WHEN um contrato de coalizão abre a aba Informações Gerais por URL direta THEN o sistema SHALL
  responder `notFound()`, não uma tela de mandato vazia.
- WHEN `ref_agenda_tematica` está vazio (antes do seed) THEN o seletor de áreas temáticas SHALL
  exibir estado vazio explicativo, nunca um combobox mudo.
- WHEN dois registros do mesmo contrato e tipo são criados simultaneamente THEN as duas
  `nr_sequencia` SHALL ser distintas.
- WHEN um tipo de registro declara um campo em `schema_campos` cujo `tipo` a UI não conhece THEN o
  sistema SHALL ignorar o campo e registrar o fato, nunca quebrar o formulário inteiro.
- WHEN a migration de re-seed do GIP encontra linha preexistente em `fat_gip_dimensao` THEN SHALL
  falhar explicitamente (A-12), nunca reinterpretar o valor antigo em silêncio.
- WHEN um mandato não tem nenhum contrato além do atual THEN "Histórico de Contratos" SHALL exibir
  a linha do próprio contrato, não estado vazio.
- WHEN o usuário sem vínculo com o contrato acessa qualquer aba THEN a RLS SHALL negar a leitura, e
  a UI SHALL degradar para `<ErroInline>` — a restrição mora no banco (AD-001).

---

## Sweep de dimensões implícitas

Escopo Large — cada dimensão resolve em requisito ou `N/A` justificado.

| Dimensão | Resolução |
| :-- | :-- |
| Input validation & bounds | FMC-25 (faixa do GIP validada por trigger), FMC-17 (`ck_artefato_url`), FMC-31 (modalidade do enum), schemas Zod novos para agendamento e registro dinâmico |
| Failure / partial-failure | FMC-21 (registro + artefatos em transação única), FMC-30 (encontro + participantes em transação única) |
| Idempotency / retry / duplicados | FMC-07 (unicidade mandato↔tema), FMC-27 (`uq_gip_contrato_momento`), presença dupla já coberta por EST-13 AC5 |
| Auth boundaries & rate limits | FMC-35 — RLS em `fat_artefato`, `rel_mandato_agenda_tematica` e `ref_nivel_dimensao_gip`, no padrão AD-030/AD-001. Rate limit: **N/A** — nenhuma superfície pública (AD-002) |
| Concurrency / ordering | FMC-15 (`nr_sequencia` atribuída no servidor, dentro da transação) |
| Data lifecycle / expiry | **N/A** — nada nesta feature expira; exclusão de artefato entra como escrita comum, sem TTL |
| Observability | FMC-36 — `app.trg_auditoria()` nas tabelas novas e nas colunas novas de `dim_mandato`/`fat_contrato` (AD-006) |
| External-dependency failure | **N/A nesta fatia** — a única dependência externa seria o Storage, e upload de fotos está fora de escopo |
| State-transition integrity | FMC-27 (momento Início aplicado não se reabre como novo), FMC-14 (Etapa+Tipo imutáveis após a criação); transição `planejado → realizado` já coberta por EST-13 |

---

## Requirement Traceability

| ID | Story | AC de origem | Fase | Status |
| :-- | :-- | :-- | :-- | :-- |
| FMC-01 | P1 Abas | AC1, AC3 — 8 abas, ramificadas por `tipo_contratante` | Design | Pending |
| FMC-02 | P1 Abas | AC2 — nenhuma aba derivada de `ref_etapa` | Design | Pending |
| FMC-03 | P1 Abas | AC4 — "Gestão da equipe" substitui "Assessores" | Design | Pending |
| FMC-04 | P1 Abas | AC5, AC6, AC7 — rotas de etapa preservadas; placeholders explícitos; divergência `108:4`/`109:4` resolvida | Design | Pending |
| FMC-05 | P1 Info | AC1, AC2 — `dim_mandato.minibiografia` + ausência como `—` | Design | Pending |
| FMC-06 | P1 Info | AC10 — `dim_mandato.principais_pautas` (texto livre) | Design | Pending |
| FMC-07 | P1 Info | AC3, AC5 — `rel_mandato_agenda_tematica` + unicidade | Design | Pending |
| FMC-08 | P1 Info | AC4 — seletor lê catálogo ativo, ordenado | Design | Pending |
| FMC-09 | P1 Info | AC4 — seed dos 30 temas em `ref_agenda_tematica` (fecha CAT-16) | Design | Pending |
| FMC-10 | P1 Info | AC6 — contatos derivados de `rel_usuario_contrato` + `dim_usuario` | Design | Pending |
| FMC-11 | P1 Info | AC7 — `fat_contrato.id_usuario_ponto_focal` | Design | Pending |
| FMC-12 | P1 Info | AC8 — histórico com rótulos do `ck_contrato_status` | Design | Pending |
| FMC-13 | P1 Info | AC9 — projetos e coalizões vinculados | Design | Pending |
| FMC-14 | P1 Registro | AC1 + A-16 — Etapa+Tipo herdados e imutáveis | Design | Pending |
| FMC-15 | P1 Registro | AC2, AC3 — `nº X de Y` e `nr_sequencia` atribuída no servidor | Design | Pending |
| FMC-16 | P1 Registro | AC4, AC5, AC8 — camada dinâmica de `schema_campos` → `conteudo` | Design | Pending |
| FMC-17 | P1 Registro | AC6, AC7 — `fat_artefato` provisionada e gravada com `escopo='registro'` | Design | Pending |
| FMC-18 | P1 Registro | AC9, AC10 — `rel_registro_participante` (B-01), pré-marcada do encontro | Design | Pending |
| FMC-19 | P1 Registro | AC11 — campo Canal removido do produto | Design | Pending |
| FMC-20 | P1 Registro | AC12 — Local da Imersão em leitura | Design | Pending |
| FMC-21 | P1 Registro | AC13 — registro + artefatos em transação única | Design | Pending |
| FMC-22 | P1 Registro | Out of Scope — bloco de fotos como "em desenvolvimento" | Design | Pending |
| FMC-23 | P1 GIP | AC1 — re-seed de `ref_dimensao_gip` | Design | Pending |
| FMC-24 | P1 GIP | AC2 — `ref_nivel_dimensao_gip` com os 10 descritores | Design | Pending |
| FMC-25 | P1 GIP | AC3, AC4 — tela de preenchimento e faixa validada no banco | Design | Pending |
| FMC-26 | P1 GIP | AC5 — escrita pelo caminho `fat_submissao` → trigger | Design | Pending |
| FMC-27 | P1 GIP | AC6, AC7 — momentos Início/Fim e unicidade | Design | Pending |
| FMC-28 | P1 GIP | AC8, AC9, AC10, AC11 — Evolução a partir de `gap` | Design | Pending |
| FMC-29 | P2 Agenda | AC1 — grade recortada por contrato | Design | Pending |
| FMC-30 | P2 Agenda | AC2, AC3 — modal Novo Agendamento, transação única | Design | Pending |
| FMC-31 | P2 Agenda | AC4, AC5 — Etapa→Tipo encadeados; modalidade do enum | Design | Pending |
| FMC-32 | P2 Agenda | AC6 — participante usuário vs externo | Design | Pending |
| FMC-33 | P2 Agenda | AC7 — rótulos Resumo/Autor corrigidos (também em EST-12) | Design | Pending |
| FMC-34 | P2 Agenda | AC8 — `qtd_prevista = 4` em `sprint` (renome já feito por TIP-01) | Design | Pending |
| FMC-35 | Transversal | Sweep — RLS e grants das tabelas novas (AD-001/AD-030) | Design | Pending |
| FMC-36 | Transversal | Sweep — auditoria nas tabelas e colunas novas (AD-006) | Design | Pending |
| FMC-37 | P1 Registro | B-01 — `rel_registro_participante` provisionada (tabela + RLS + grants), fecha TIP-07 | Design | Pending |

**Cobertura:** 37 requisitos · 0 mapeados para tasks · 37 não mapeados ⚠️ (esperado — Tasks ainda não rodou)

---

## Decisões arquiteturais a registrar (candidatas a AD)

Nenhuma é registrada por esta spec; entram no `STATE.md` durante Design.

1. **Navegação da ficha deixa de espelhar `ref_etapa`** — a barra passa a ser funcional e fixa. As
   rotas de etapa sobrevivem fora da navegação (precedente NAV-14/15).
2. **CAT-16 fecha por decisão de produto**, não por levantamento humano — 30 temas aceitos por
   Pedro em 2026-09-15. O roadmap §1.2 precisa de correção.
3. **Os eixos do GIP passam a significar momentos no tempo** — `regua_sonhos`=Início,
   `onde_chegamos`=Fim. O comentário D6 de `docs/schema_sistema.sql` fica desatualizado, e
   `vw_gip_evolucao.situacao` (`atingiu|proximo|distante`) deixa de ter consumidor.
4. **`fat_registro.canal` sai do produto** mantendo a coluna — mesma mecânica em camadas da AD-049.
5. **`rel_registro_participante` fecha TIP-07** (B-01). Presença passa a existir em duas tabelas
   com significados distintos e sem sincronia — o encontro guarda o plano, o registro guarda o
   fato (A-21). A AD precisa dizer isso explicitamente, ou a próxima feature vai tentar
   sincronizá-las.

---

## Anexo A — Régua dos Sonhos (GIP), conteúdo canônico

Fonte: Pedro, 2026-09-15, verbatim da metodologia. Alimenta FMC-23 e FMC-24. Nenhum descritor pode
ser reescrito, resumido ou reordenado na implementação.

**1. Performance dos objetivos específicos atrelados aos preditores prioritários** (0–3)

| Nível | Descritor |
| :-- | :-- |
| 0 | Não apresenta padrões de atuação de mandatos de sucesso |
| 1 | Apresenta algumas práticas e padrões de atuação de mandatos de sucesso |
| 2 | Progride menos de 60%, em média, nos objetivos específicos atrelados aos preditores de sucesso prioritários |
| 3 | Progride acima de 60%, em média, nos objetivos específicos atrelados aos preditores de sucesso prioritários |

**2. Monitoramento e atingimento do planejamento** (0–3)

| Nível | Descritor |
| :-- | :-- |
| 0 | Não monitora metas |
| 1 | Monitora e cumpre até 30% do quadro de metas |
| 2 | Monitora e cumpre até 65% do quadro de metas |
| 3 | Monitora e cumpre mais de 65% do quadro de metas |

> O nível 2 chegou do Figma como *"até 65% **ou mais**"*, o que se sobrepunha ao nível 3.
> Pedro confirmou em 2026-09-15 que é erro de digitação — vale "até 65%".

**3. Capacidade de gestão** (0–2)

| Nível | Descritor |
| :-- | :-- |
| 0 | Não implementa rotinas de alinhamento entre a equipe e entre coordenações (ou o faz de modo esporádico/muito informal) |
| 1 | Implementa rotinas de alinhamento entre a equipe e entre coordenações |
| 2 | Implementa estratégia de gestão de pessoas (revisão de organograma, definição de escopos de trabalho e realização de devolutivas sobre o desempenho da assessoria) |

**4. Capacidade de absorção de incidência política** (0–2)

| Nível | Descritor |
| :-- | :-- |
| 0 | Resistente à implementação de sugestões de incidência política |
| 1 | Implementa apenas uma sugestão de incidência política |
| 2 | Implementa mais de uma sugestão de incidência política |

---

## Anexo B — Seed de `ref_agenda_tematica` (30 temas)

Alimenta FMC-09. Aceito por Pedro em 2026-09-15; fecha CAT-16 por decisão de produto (A-06).

| ordem | nome | ordem | nome |
| :-- | :-- | :-- | :-- |
| 1 | Educação | 16 | Cultura |
| 2 | Saúde | 17 | Esporte e Lazer |
| 3 | Assistência e Desenvolvimento Social | 18 | Ciência, Tecnologia e Inovação |
| 4 | Segurança Pública | 19 | Democracia e Reforma Política |
| 5 | Justiça e Cidadania | 20 | Transparência e Controle Social |
| 6 | Direitos Humanos | 21 | Pessoa Idosa |
| 7 | Meio Ambiente e Clima | 22 | Agricultura Familiar e Segurança Alimentar |
| 8 | Mulheres | 23 | Economia e Desenvolvimento Produtivo |
| 9 | Igualdade Racial | 24 | Tributação e Justiça Fiscal |
| 10 | LGBTQIA+ | 25 | Saneamento e Recursos Hídricos |
| 11 | Infância e Juventude | 26 | Energia e Transição Energética |
| 12 | Pessoa com Deficiência | 27 | Saúde Mental |
| 13 | Povos Indígenas e Comunidades Tradicionais | 28 | Migração e Refúgio |
| 14 | Trabalho, Emprego e Renda | 29 | Proteção e Bem-Estar Animal |
| 15 | Cidades, Mobilidade e Moradia | 30 | Defesa do Consumidor |

Sobreposição conhecida e aceita: **Saúde Mental (27)** é subconjunto de **Saúde (2)**. O catálogo é
plano; hierarquizar seria mudança de modelo, fora de escopo.

---

## Anexo C — Camada dinâmica por Etapa·Tipo (produto Estratégia)

Alimenta FMC-16 e FMC-17. Cada linha de "artefato" vira uma linha de `fat_artefato` com
`escopo = 'registro'`; cada linha de "campo" vira uma chave em `fat_registro.conteudo`, declarada
em `ref_tipo_registro.schema_campos`.

**Fonte:** os **10 checklists reais da operação**, Bloco A de
`.specs/features/revisao-tipos-registro/context.md` (trazidos por Pedro em 2026-09-10) — não o
mockup. Onde os dois divergem, o checklist ganha: os badges do Figma já foram declarados
"alucinações da IA do Figma" por Pedro na mesma sessão.

| # | Etapa · Tipo | Campos | Artefatos (`fat_artefato.tipo`) |
| :-- | :-- | :-- | :-- |
| 1 | Pontapé · Pontapé | — | Termo de Compromisso → `termo_assinado` |
| 3 | Diagnóstico · Comitê Político | — | Mapa Político → `mapa_politico` |
| 4 | Diagnóstico · Escuta Diagnóstica | — | Escuta Diagnóstica → `escuta_diagnostica` |
| 8 | Imersão · Imersão | Local (leitura, de `fat_encontro.local`) | Cronograma → `cronograma`; Pré-planejamento → `pre_planejamento`; Mural → `mural`; **Planilha de monitoramento → `outro`** (A-19); Fotos → `foto` (**em desenvolvimento**, FMC-22) |
| 6 | Governança · Reunião Semanal | — | — |
| 9 | Governança · Diagnóstico de Organograma | Adequações a serem realizadas (texto longo) | Organograma → `organograma` |
| 10 | Monitoramento · Monitoramento | — | — |
| 2 | Monitoramento · Legisla Aliada | — | — |
| 7 | Replicação · Replicação | — | Material Compartilhado → `material_replicacao` |

Notas:

- **Todos os 10 checklists pedem "Presentes"** — coberto por B-01, não por esta tabela.
- O checklist #10 (Monitoramento) pede também **"Atingimento de metas"**, seção que Pedro removeu
  do desenho em 2026-09-15 (A-20). Fora desta feature.
- O checklist **#5 "Registros Insights" não é tipo de registro** — as 4 perguntas batem 4/4 com
  `ref_pilar_insight`; é `fat_insight`. Não entra aqui.
- **"Material Compartilhado" é o rótulo de tela de `material_replicacao`** — divergência de
  apresentação, não de valor.
- O enum `ck_artefato_tipo` cobre 10 dos 11 links um a um, sem alteração; o 11º (planilha de
  monitoramento) cai em `outro`.

---

## Success Criteria

- [ ] As 8 abas renderizam para mandato e as 7 para coalizão, sem nenhuma aba de etapa
- [ ] Os 9 tipos de registro de Estratégia renderizam sua camada dinâmica correta, e os artefatos
      caem em `fat_artefato` com o `tipo` certo do enum
- [ ] O GIP de Início e de Fim é preenchível pelos descritores da metodologia, e a Evolução mostra
      a variação por dimensão
- [ ] Um mandato tem biografia, pautas e áreas temáticas persistidas e relidas
- [ ] O checklist de revisão da skill `figma-dominio-legisla` passa sem nenhum "não"
- [ ] `npm run lint:all`, `npm run test:unit` e `npm run test:integration` verdes; `drift-check`
      sem deriva após as migrations
