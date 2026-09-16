---
name: figma-dominio-legisla
description: Vocabulário canônico (entidades, campos, enums, rótulos) do Sistema Mandatos para desenho de tela. Use ANTES de gerar ou editar qualquer design no Figma (use_figma, generate_figma_design, Figma Make/First Draft), ao escrever prompt para a IA do Figma, e ao revisar mockup pronto antes de virar spec ou código. Triggers "desenhar tela", "mockup", "protótipo", "Figma", "revisar tela", "o Figma inventou um campo".
---

# Domínio Legisla para telas

## Por que esta skill existe

A IA do Figma não lê o banco. Diante de uma lacuna ela preenche com o termo
mais plausível — e plausível não é o nosso. Vira "Predicado" onde o sistema
tem `preditor`, "Em planejamento" onde o enum só aceita
`ativa|pausada|descartada`, "Nível 5" numa régua que tem 4 níveis.

O mockup passa na revisão visual porque *parece* certo. Vira spec, vira task,
e o erro só aparece quando o `INSERT` estoura `ck_meta_status` — ou pior,
quando a tela pede um dado que não existe e alguém abre uma migration pra
criar a coluna que o Figma imaginou. **Termo inventado no Figma custa
migration em produção** — e migration aqui é forward-only: o conserto é
arquivo novo, nunca edição.

## Os três modos de uso

### 1. Desenhar do zero (Claude gerando no Figma)

Antes de chamar `use_figma` / `generate_figma_design`: monte a lista de campos
da tela a partir de `references/glossario-campos.md`, **não** da sua intuição.
Cada campo do prompt carrega o rótulo canônico e, quando for enum, os valores
por extenso. Um prompt que diz "campos de classificação da Meta" volta
inventado; um que diz "Prioridade (Alta/Média/Baixa), Classe
(Programática/Governança), Status (Ativa/Pausada/Descartada)" volta certo.

### 2. Escrever prompt para a IA do Figma (Make, First Draft, Figma AI)

Cole o bloco de `references/bloco-contexto-figma.md` no início do prompt e
recorte a seção da entidade que a tela trata. É o único jeito de o vocabulário
chegar lá — a IA do Figma não enxerga este repositório.

### 3. Revisar mockup pronto (antes de virar spec)

Rode o checklist do fim deste arquivo. Toda divergência encontrada entra na
tabela "Invenções já cometidas", com a correção — a lista é o ativo que faz a
próxima rodada errar menos.

## Regras invioláveis

1. **Todo campo em tela mapeia para uma coluna real.** Sem coluna, sem campo.
   Se a tela precisa de um dado que não existe, isso é decisão de schema — para
   no desenho e vira pergunta, não vira caixinha no mockup.
2. **Enum fechado só aceita os valores da lista.** Nunca sinônimo ("Ativa" não
   é "Em andamento"), nunca valor novo, nunca um estado a mais "porque faz
   sentido". As listas estão em `references/glossario-campos.md`.
3. **O rótulo já existe no código.** Reuse verbatim o que está nos formulários
   (`src/frontend/components/planejamento/`, `.../incidencia/`). Não reescreva
   "Preditor primário" como "Predicado 1º".
4. **Ausência de dado é `—`** (AD-005). Nunca "N/A", "Pendente de atualização"
   ou string vazia. Pendência é derivada, nunca digitada.
5. **Número calculado não pode parecer editável** (AD-003, PLR-10).
   `pct_atingimento` de Meta e de Objetivo vem da cascata dos Sucessos Mensais:
   na tela é célula hachurada com marcador `fx`, sem foco, sem clique. E nenhum
   número de gestão ou de impacto sai de tabela transacional.
6. **Catálogo sem conteúdo aprovado não ganha valor de exemplo.**
   `ref_agenda_tematica`, `ref_indicador` e os pesos do IIP estão vazios de
   propósito (CAT-16, levantamento humano pendente). No mockup entram como
   placeholder marcado — "Agenda temática (catálogo pendente)" —, nunca como
   "Segurança Pública", que parece aprovado e não é.
7. **Escala não se estica.** Se a régua tem 4 níveis, o componente mostra 4.
   Cinco bolinhas porque cinco fica mais bonito é dado falso desenhado.

## Invenções já cometidas

Lista viva. Cada linha nasceu de um mockup real que chegou errado.

### Modal "Editar Meta"

| Veio assim | É assim | Onde |
| --- | --- | --- |
| "Predicado 1º" / "Predicado 2º" | **Preditor primário** / **Preditor secundário** | `fat_meta.id_preditor_primario/_secundario` → `ref_preditor` |
| Preditor com valor "Articulação Política" | Os 5 preditores são **frases longas** ("Articulam e mobilizam para a entrega de resultados"). O componente tem que caber frase, não chip de duas palavras | seed `20260810193327` |
| Status "Em planejamento" | **Ativa / Pausada / Descartada** | `ck_meta_status` |
| "Tipo: Institucional" | O campo é **Classe**: **Programática / Governança** — e Governança não é oferecida no PLL | `ck_meta_classe`, `meta-form.tsx:152-155` |
| "Progresso 35%" com barra | **% de atingimento**, e é **calculado** pela cascata dos Sucessos Mensais — nunca editável na Meta | `fat_meta.pct_atingimento`, AD-005 |
| Sucesso Mensal com status "Em andamento" | **Pendente / Realizado / Não realizado** | `ck_sucesso_status` |
| "Agenda: Segurança Pública" | Campo certo (**Agenda temática**), valor inventado: o catálogo está vazio (CAT-16) | `ref_agenda_tematica` |
| Sucesso Mensal só com título e status | Faltam **Peso (0–100)** e **Mês de referência** — o peso é o que faz a cascata de % funcionar; sem ele a tela não fecha | `fat_sucesso_mensal` |

### Lista "Registros de Agenda"

| Veio assim | É assim | Onde |
| --- | --- | --- |
| Uma lista só, chamada "Registros de Agenda" | **Registro** e **Encontro** são entidades distintas, com campos e status próprios. "Agenda" é nome de tela, não tipo de coisa | `fat_registro` / `fat_encontro` |
| Tipo "Diagnóstico", tipo "Planejamento" | Não existem. Os aprovados são Pontapé, Comitê Político, Escuta Diagnóstica, Imersão, Sprint, Diagnóstico de Organograma, Proposta de Organograma, Monitoramento mensal, Replicação, Legisla Aliada, Mentoria | `ref_tipo_registro` |
| Tipo "Encontro" na lista de tipos | Encontro é a outra entidade — um Registro pode *apontar* para um Encontro (`fat_registro.id_encontro`), não *ser* de tipo Encontro | |
| Coluna "Descrição" | O campo é **Resumo** | `fat_registro.resumo` |
| Coluna "Responsável" | Em Registro é **Autor** (quem lançou). "Responsável" é campo de Meta | `fat_registro.id_usuario_autor` |
| Colunas ausentes | **Canal** (Sistema / Slack / Presencial) e **Nº sequência** — a sequência é o que ordena Sprints e Mentorias | |
| Filtro "Sprint de Planejamento – 18/set" | "Sprint" é tipo de registro da etapa **Governança / Organograma**. "Sprint de Planejamento" não existe | |
| Uma cor viva por tipo de registro | A paleta tem significado fixo: verde = Estratégia, turquesa = PLL, roxo = Coalizões, coral = alerta/prioridade alta, bege = KPI. Cor arbitrária por tipo briga com a codificação de produto | `docs/Identidade Visual Legisla.md` |

### Painel "Fato Gerador"

| Veio assim | É assim | Onde |
| --- | --- | --- |
| "D1 (Grau de Impacto)", "D2 (Urgência Política)", "D3 (Nível de Certeza)" | **Os nomes das três dimensões não existem.** A fórmula do IIP segue com a área de conhecimento (decisão D2 em aberto). Em tela: "Nível D1", "Nível D2", "Nível D3", sem legenda — e o IIP aparece rotulado como **provisório** | `docs/features-e-camadas-v3.md:246` |
| "Nível 4", "Nível 3", "Nível 5" em régua de 5 | São **4 níveis nomeados**: Baixo, Médio, Alto, Máximo. Não existe nível 5 | `ref_nivel_iip` |
| Níveis e preditores como escolha livre do usuário | São **derivados da Tipologia** escolhida e exibidos como leitura. Esse erro já foi cometido no código e corrigido | `ref_tipologia.nivel_d1_padrao`, `fato-gerador-form.tsx:37-40,222-234` |
| "Tipologia: Emenda Saúde Básica" como um chip | Tipologia é **tripla encadeada**: Grupo › Tipologia › Estado (3 selects, 51 combinações aprovadas) | `uq_tipologia_tripla` |
| Ocorrência "05 de Setembro de 2026 às 14:30" | `dt_ocorrencia` é **DATE** — não tem hora. Hora existe só em `criado_em` | `fat_fato_gerador` |
| Botão "Ver no Ciclo de Vida" | "Ciclo de Vida" não existe no sistema. O fato vincula-se a **Meta e/ou Insight** — ou a nenhum dos dois, que é caso válido | `rel_fato_origem` |
| Campo ausente | **Contribuição Legisla (0–5)** | `ck_fato_contribuicao` |

### Tela "Planejamento Estratégico" (árvore-grade) — set/2026

| Veio assim | É assim | Onde |
| --- | --- | --- |
| Chips de Classe "Comunicação", "Presencial" | Classe só tem **Programática / Governança**. "Presencial" nem é campo de Meta — é **Canal** de Registro | `ck_meta_classe` |
| Status de Sucesso Mensal "Concluído" | **Realizado** | `ck_sucesso_status` |
| Coluna "% concluído" / "Progresso" | **% de atingimento** | `fat_meta.pct_atingimento` |
| Grade de Sucessos Mensais com Prazo, Atraso, Resp., %, Status | Faltam **Peso** e **Mês de referência**. "Prazo" é `dt_limite`, campo diferente de `mes_referencia` | `fat_sucesso_mensal` |
| "Arraste os itens para reordenar" valendo para Sucesso Mensal | Objetivo e Meta têm coluna `ordem`; **Sucesso Mensal não tinha** — virou decisão de schema (PLV-10), não era ajuste de UI | `fat_sucesso_mensal` |

### Modal "Editar Objetivo Específico" — set/2026

| Veio assim | É assim | Onde |
| --- | --- | --- |
| Rótulo "DESCRIÇÃO" | **Descrição do Objetivo** | glossário §3.2 |
| Modal só com Descrição + Status | Perdeu **Preditor primário**, **Preditor secundário** e **Agenda temática**, que existem na tabela e no formulário atual | `fat_objetivo_especifico` |
| Select "Status: Ativo" | **Não existia** coluna `status` no Objetivo. Decidido criar (`ativo/pausado/descartado`) — migration pendente. Até ela aplicar, o campo não tem onde gravar | PLV-02 |
| Badge de Meta "Em planejamento" | **Ativa / Pausada / Descartada** | `ck_meta_status` |

### Modal "Editar Sucesso Mensal" — set/2026

| Veio assim | É assim | Onde |
| --- | --- | --- |
| Status "Em andamento" | **Pendente / Realizado / Não realizado** | `ck_sucesso_status` |
| % como barra de leitura | Invertido: o SM é o **único** nível onde o % é **digitado**. Quem é travado é Meta/Objetivo/Planejamento | glossário §3.4 |
| Sem campo de Peso | **Peso (0–100) é `NOT NULL`** e é o que pondera a cascata | `ck_sucesso_peso` |
| Grade de meses com múltipla seleção | `mes_referencia` é **um** mês por SM. Decidido: marcar N meses é **atalho de criação** — gera N registros irmãos independentes, não um SM multi-mês | PLV-06 |
| Dois selects de Vinculação (Objetivo **e** Meta), ambos editáveis | O Objetivo é **derivado da Meta** e vai como leitura. Select editável sugere pendurar SM direto no Objetivo, o que a FK não permite | `fat_sucesso_mensal.id_meta` |

### Painel "Fato Gerador" — reincidências de set/2026

A tabela acima já previa três destes. Voltaram assim mesmo — e a forma como
voltaram é instrutiva.

| Veio assim | É assim | Onde |
| --- | --- | --- |
| "D1 (Capital Político Institucional)" no wizard **e** "D1 (Grau de Impacto)" no painel de detalhe | **Reincidência dupla.** Os nomes não só são invenção como vieram **diferentes entre duas telas do mesmo arquivo** — é o sintoma mais limpo de campo preenchido por plausibilidade. Rotule "Nível D1/D2/D3" e pare | `docs/features-e-camadas-v3.md:246` |
| Régua de 5 bolinhas, "Nível 5" | **Reincidência.** `ref_nivel_iip` tem 4 linhas: Baixo, Médio, Alto, Máximo | `ref_nivel_iip` |
| "05 de Setembro de 2026 às 14:30" | **Reincidência.** `dt_ocorrencia` é `DATE` | `fat_fato_gerador` |
| Grupo "Infraestrutura" | Não está nos 11. A tipologia mostrada junto (`Projeto de lei / proposição`) pertence a **"2. Produção Legislativa"** | `ref_tipologia.grupo` |
| Níveis 4/3/5 para a tripla `Produção Legislativa › Projeto de lei / proposição › Em tramitação ativa` | O seed define **baixo / médio / médio** para essa tripla exata. Níveis são derivados — conferir contra o seed, não estimar | seed `20260813191324` |
| Estados "Acordo formalizado", "Protocolada com apoio" | Não constam nas 51 triplas | `uq_tipologia_tripla` |
| "Pilar: Financeiro" num Insight | Os 4 pilares são outros | `ref_pilar_insight` |
| Tipos de registro "Reunião", "Ofício", "Nota de Reunião" | Não existem | `ref_tipo_registro` |
| Badge "Não Conectado" em fato sem origem | Fato sem origem é **caso válido e frequente** — nunca marcado como falha | `rel_fato_origem` |
| "Fonte: Relatórios de Base" | Campo não existe em nenhuma entidade | — |
| Badges "META ESTRATÉGICA", "Etapa de Cadeia" | Não existem | — |
| ~~Botão "Ver no Ciclo de Vida"~~ | **Baixado.** O Ciclo de Vida foi desenhado em set/2026 e virou capacidade especificada (FGC-13/14). Deixou de ser invenção | `.specs/features/fatos-geradores-ciclo-vida/` |

**O que veio certo nessas telas** — registrar acerto também calibra: a tripla
Grupo › Tipologia › Estado como três selects encadeados; níveis e preditores
como **leitura derivada**; a grafia canônica de "Constroem Partido" e "Pautam
os Debates"; o IIP rotulado **(provisório)**; `dt_ocorrencia` como datepicker de
dia no wizard.

### Conceitos que o desenho propôs e viraram decisão de schema

Não são invenção de rótulo — são capacidade nova. O certo aconteceu: pararam no
desenho e viraram pergunta antes de virar código.

| Conceito | Decisão | Onde |
| --- | --- | --- |
| **Pré-Insight** | Tabela nova `fat_pre_insight`, com RLS no mesmo DDL | FGC-05 |
| **Fato que ainda vai acontecer** | `situacao` (`projetado`/`realizado`) + `dt_prevista`; projeção **não entra no IIP** | FGC-06/07 |
| **Título do Fato Gerador** | Coluna nova, nullable no banco e obrigatória no formulário | FGC-09 |
| **Cadeia / Ciclo de Vida** | **Derivada por view.** "Cadeia A/B/C" é rótulo posicional, não identidade persistida | FGC-13 |
| **Registro como origem de fato** | `rel_fato_origem` ganha `id_registro` e `id_pre_insight` | FGC-15 |
| **Status no Objetivo Específico** | Coluna nova; obriga emendar `app.recalcula_atingimento` para filtrar objetivo não-ativo no nível raiz | PLV-02 |
| **Responsável no Sucesso Mensal** | Coluna nova, com fallback visual para o responsável da Meta | PLV-03 |

## Checklist de revisão de mockup

Percorra na ordem. Qualquer "não" para o desenho antes de virar spec.

- [ ] Cada rótulo em tela existe em `references/glossario-campos.md` **com a mesma grafia**?
- [ ] Cada valor de badge, chip ou select está na lista de enum daquele campo?
- [ ] Cada entidade da tela é uma entidade só? (Registro e Encontro não se fundem; Meta e Sucesso Mensal não se fundem)
- [ ] Os campos obrigatórios da entidade aparecem? (Peso e Mês de referência são os mais esquecidos)
- [ ] Número calculado está visualmente travado (hachura + `fx`, sem afordância de edição)?
- [ ] Vazio é `—`, e não "N/A" nem texto sentinela?
- [ ] As escalas têm a quantidade certa de níveis?
- [ ] Nenhum valor de `ref_agenda_tematica` / `ref_indicador` aparece como se fosse aprovado?
- [ ] Nenhum campo da §7 do glossário (removidos do produto — hoje: Oportunidade e Ameaça/SWOT no Objetivo Específico) reapareceu?
- [ ] Cores respeitam a codificação de produto (verde/turquesa/roxo) e o significado de coral/bege?
- [ ] Data sem hora onde a coluna é `DATE`?
- [ ] **A mesma coisa tem o mesmo nome em todas as telas do arquivo?** Dois
      rótulos diferentes para o mesmo campo em telas distintas é a assinatura
      de campo preenchido por plausibilidade — foi assim que D1/D2/D3 caíram
      duas vezes no mesmo arquivo com nomes diferentes.
- [ ] **Valor derivado foi conferido contra o seed**, e não estimado? Níveis de
      IIP saem da tripla escolhida; "parece alto" não é fonte.
- [ ] **Campo que o banco não tem parou no desenho e virou pergunta**, em vez de
      virar caixinha? Capacidade nova é decisão de schema — e decisão de schema
      registrada antes de virar spec é o que separa uma migration planejada de
      uma correção forward-only em produção.

## Manutenção

Achou invenção nova? Adicione linha na seção correspondente de "Invenções já
cometidas", com a coluna "Onde" apontando para a constraint, o seed ou o
componente que prova a versão certa. Se o campo mudou no banco, o glossário em
`references/` é atualizado junto — ele espelha `docs/schema_sistema.sql` e
`src/backend/schemas/*.ts`, que continuam sendo a fonte de verdade.
