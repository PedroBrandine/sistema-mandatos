# Glossário de campos — o que pode aparecer em tela

Espelho de `docs/schema_sistema.sql`, `src/backend/schemas/*.ts` e dos rótulos
já escritos em `src/frontend/components/`. Quando divergir, **o repositório
está certo** e este arquivo é que precisa de conserto.

Convenção das tabelas: *Rótulo* é o texto literal que vai na tela. *Coluna* é
a origem do dado. *Valores* lista o enum fechado por extenso — o que não está
na lista não existe.

---

## 1. Contexto — onde a tela vive

| Conceito | O que é | Cuidado |
| --- | --- | --- |
| **Mandato** | O parlamentar apoiado. É **registro, não usuário** — não tem login | Nunca desenhe "perfil do parlamentar" com avatar de conta |
| **Contratante** | Quem assina o contrato (pode não ser o mandato) | |
| **Contrato** | A unidade operacional do sistema. Quase toda tela é escopada por contrato | Status: **Ativo / Concluído / Não concluído** |
| **Coalizão** | Agrupamento de mandatos via Projeto. Pode ou não ter planejamento próprio | |
| **Projeto** | Edição/iniciativa com temática (ex.: Imagina 1 e 2). Filtro de primeira classe | |
| **Produto** | **Estratégia**, **PLL**, **Coalizão** | Cor fixa: Estratégia = verde `#035252`, PLL = turquesa `#4ABFB2`, Coalizões = roxo `#BA6BED` |

**Papel global** (`dim_usuario.papel_global`): Admin · Gestora · Mentor · Assessor
**Papel no contrato** (`rel_usuario_contrato.papel_no_contrato`): Gestora · Mentor · Assessor · Leitura

---

## 2. Régua de etapas

`fat_etapa_contrato.status`: **Não iniciada / Em andamento / Concluída / Dispensada**

**Etapas de Estratégia** (nesta ordem): Cadastro · Pontapé · Raio-X · Imersão ·
Governança / Organograma · Monitoramento · Replicação

**Etapas de PLL**: Recrutamento e seleção de participantes · Seleção e formação
de mentores · Pontapé · Imersão e construção do planejamento · Mentorias e
monitoramento

> A régua da Coalizão é clonada da de Estratégia. Não invente etapa: a ordem é
> única por produto (`uq_etapa_produto_ordem`).

---

## 3. Planejamento

Hierarquia, sempre nesta ordem e com estes nomes:
**Planejamento → Objetivo Específico → Meta → Sucesso Mensal**

Nada de "OKR", "KR", "Iniciativa", "Entregável", "Tarefa", "Marco".

### 3.1 Planejamento (cabeçalho / contexto estratégico)

| Rótulo | Coluna | Valores | Obrig. |
| --- | --- | --- | --- |
| Objetivo do ano (opcional) | `objetivo_ano` | texto longo | não |
| Legado (opcional) | `legado` | texto longo | não |
| Análise de conjuntura (opcional) | `analise_conjuntura` | texto longo | não |
| Perfil de atuação (opcional) | `id_perfil_atuacao` | **Fiscalizadora · Legisladora · Articuladora/Mobilizadora** | não |

`pct_atingimento` e `atingimento_desatualizado` são **derivados da cascata** —
nunca campo de formulário.

### 3.2 Objetivo Específico

| Rótulo | Coluna | Valores | Obrig. |
| --- | --- | --- | --- |
| Descrição do Objetivo | `descricao` | texto | **sim** |
| Preditor primário (opcional) | `id_preditor_primario` | catálogo de 5 (§5.1) | não |
| Preditor secundário (opcional) | `id_preditor_secundario` | catálogo de 5 | não |
| Agenda temática (opcional) | `id_agenda` | **catálogo vazio (CAT-16)** | não |
| % de atingimento | `pct_atingimento` | 0–100, **calculado** | — |

**Regra de par**: secundário exige primário e não pode repeti-lo
(`ck_objetivo_preditores`). O select do secundário fica desabilitado enquanto
o primário estiver vazio, e não oferece o valor já escolhido.

**Não existe SWOT no Objetivo Específico.** "Oportunidade" e "Ameaça" foram
cortados do produto — não desenhe, não peça, não reintroduza. Ver §7.

### 3.3 Meta

| Rótulo | Coluna | Valores | Obrig. |
| --- | --- | --- | --- |
| Descrição da Meta | `descricao` | texto | **sim** |
| Preditor primário (opcional) | `id_preditor_primario` | catálogo de 5 | não |
| Preditor secundário (opcional) | `id_preditor_secundario` | catálogo de 5 | não |
| Agenda temática (opcional) | `id_agenda` | **catálogo vazio (CAT-16)** | não |
| Prioridade (opcional) | `prioridade` | **Alta · Média · Baixa** | não |
| Classe (opcional) | `classe` | **Programática · Governança** | não |
| Responsável (opcional) | `id_usuario_responsavel` | usuário com vínculo no contrato | não |
| Status | `status` | **Ativa · Pausada · Descartada** | **sim** |
| % de atingimento | `pct_atingimento` | 0–100, **calculado** | — |

- **Governança não aparece no PLL** (`meta-form.tsx:152-155`).
- Mesma regra de par dos preditores (`ck_meta_preditores`).
- Não existe "Tipo" na Meta. O campo é **Classe**.

### 3.4 Sucesso Mensal

| Rótulo | Coluna | Valores | Obrig. |
| --- | --- | --- | --- |
| Descrição do Sucesso Mensal | `descricao` | texto | **sim** |
| Mês de referência | `mes_referencia` | sempre dia 1 (`YYYY-MM-01`) | **sim** |
| Prazo (opcional) | `dt_limite` | data | não |
| Peso (0–100) | `peso` | 0–100 | **sim** |
| Status | `status` | **Pendente · Realizado · Não realizado** | **sim** |
| % de atingimento | `pct_atingimento` | 0–100, **digitado aqui** | não |

> O Sucesso Mensal é o **único nível onde % é digitado**. Meta, Objetivo e
> Planejamento recebem o número por cascata. Em tela isso precisa ser
> visualmente óbvio: célula editável só no Sucesso Mensal.

> O seletor de mês mostra o mês (ex.: "set/2026"), nunca um datepicker de dia —
> o dia é sempre 1 por constraint (`ck_sucesso_mes`).

---

## 4. Incidência

### 4.1 Registro (`fat_registro`)

| Rótulo | Coluna | Valores | Obrig. |
| --- | --- | --- | --- |
| Tipo de Registro | `id_tipo_registro` | catálogo (§5.2) | **sim** |
| Nº sequência (opcional) | `nr_sequencia` | inteiro > 0 | não |
| Encontro de origem (opcional) | `id_encontro` | Encontro do mesmo contrato | não |
| Ocorrido em | `ocorrido_em` | data | **sim** |
| Canal (opcional) | `canal` | **Sistema · Slack · Presencial** | não |
| Resumo (opcional) | `resumo` | texto | não |
| Autor | `id_usuario_autor` | resolvido pela sessão, **nunca digitado** | — |

O campo de texto do Registro chama-se **Resumo**, não "Descrição". Quem lançou
é o **Autor**, não "Responsável".

### 4.2 Encontro (`fat_encontro`)

| Rótulo | Coluna | Valores | Obrig. |
| --- | --- | --- | --- |
| Título | `titulo` | texto | **sim** |
| Status | `status` | **Planejado · Realizado · Cancelado · Remarcado** | **sim** |
| Data prevista de início | `dt_prevista_inicio` | data | obrigatória se Planejado |
| Data prevista de fim (opcional) | `dt_prevista_fim` | data | não |
| Data de realização | `dt_realizada` | data | obrigatória se Realizado |
| Modalidade (opcional) | `modalidade` | **Presencial · Online** | não |
| Local (opcional) | `local` | texto | não |
| Tipo (opcional) | `id_tipo_registro` | catálogo (§5.2) | não |
| Nº sequência (opcional) | `nr_sequencia` | inteiro > 0 | não |

O rótulo da data muda com o status (some o "(opcional)" quando vira
obrigatória). No badge de lista o Encontro realizado aparece como
**"Realizada"** na Agenda e **"Realizado"** na lista de Encontros — divergência
real do código; não "corrija" num mockup sem decidir qual fica.

**Participante** (`rel_encontro_participante`): ou é usuário do sistema **ou**
é nome livre de externo, nunca os dois (XOR). Origem: **Legisla · Mandato ·
Externo**. Presença é booleano.

### 4.3 Insight (`fat_insight`)

| Rótulo | Coluna | Valores | Obrig. |
| --- | --- | --- | --- |
| Conteúdo | `conteudo` | texto | **sim** |
| Desdobramentos (opcional) | `desdobramentos` | texto | não |
| Comprovação / dados (opcional) | `comprovacao_dados` | texto | não |
| Data (opcional) | `ocorrido_em` | data | não |
| Pilar (opcional) | `id_pilar` | 4 pilares (§5.3) | não |
| Registro de origem (opcional) | `id_registro` | Registro do mesmo contrato | não |
| Meta de origem (opcional) | `id_meta_origem` | Meta do contrato | não |
| Sucesso Mensal de origem (opcional) | `id_sucesso_origem` | SM do contrato | não |

Meta e Sucesso Mensal de origem são **independentes**: nenhum, um, ou os dois.

### 4.4 Fato Gerador (`fat_fato_gerador`)

| Rótulo | Coluna | Valores | Obrig. |
| --- | --- | --- | --- |
| Grupo | (parte da tripla) | 11 grupos (§5.4) | **sim** |
| Tipologia | (parte da tripla) | depende do Grupo | **sim** |
| Estado | (parte da tripla) | depende da Tipologia | **sim** |
| Nível D1 | `nivel_d1` | **derivado da tripla**, leitura | ao menos um dos três |
| Nível D2 | `nivel_d2` | **derivado da tripla**, leitura | ao menos um dos três |
| Nível D3 | `nivel_d3` | **derivado da tripla**, leitura | ao menos um dos três |
| Preditor 1 | `id_preditor_1` | **derivado da tripla**, leitura | não |
| Preditor 2 | `id_preditor_2` | **derivado da tripla**, leitura | não |
| Contribuição Legisla (0-5, opcional) | `contribuicao_legisla` | 0 a 5 | não |
| Descrição / evidência (opcional) | `descricao_evidencia` | texto | não |
| Data de ocorrência | `dt_ocorrencia` | **data, sem hora** | **sim** |
| Meta de origem (opcional) | `id_meta_origem` | Meta do contrato | não |
| Insight de origem (opcional) | `id_insight_origem` | Insight do contrato | não |

Pontos que já foram desenhados errado:

- A classificação é **uma tripla encadeada** Grupo › Tipologia › Estado — três
  selects dependentes, 51 combinações aprovadas. Não é um chip nem um campo.
- Escolhida a tripla, **níveis e preditores são preenchidos pelo sistema** e
  mostrados como leitura. Não são selects livres.
- **As dimensões D1/D2/D3 não têm nome.** A fórmula do IIP ainda está com a
  área de conhecimento (decisão D2 em aberto). Rotule "Nível D1/D2/D3" e pare
  aí — qualquer legenda tipo "Grau de Impacto" é invenção.
- Fato **sem origem** é caso válido e frequente. A tela precisa acomodar isso
  sem parecer erro.

### 4.5 IIP

Única métrica calculada da incidência. Sai de `mv_iip_contrato` com D1, D2 e D3
separados e um total **provisório** — a tela rotula como provisório enquanto a
aritmética não fechar. `contribuicao_legisla` não entra no cálculo ainda.
Nenhum número de impacto vem de tabela transacional (AD-003).

### 4.6 GIP

`fat_gip.momento`: **Início · Meio · Fim**
`fat_gip_dimensao.eixo`: **Régua dos sonhos · Onde chegamos**
Dimensões (escala 1 a 4): Qualidade do planejamento · Atingimento do
planejamento · Capacidade de gestão · Autonomia sobre a metodologia

---

## 5. Catálogos

### 5.1 Preditores (`ref_preditor`) — 5, nesta ordem

1. Priorizam sua Agenda
2. Pautam os Debates
3. Ocupam lugar nos espaços de decisão
4. Constroem Partido
5. Articulam e mobilizam para a entrega de resultados

> São frases, não rótulos curtos. Qualquer componente que os exiba (select,
> chip, coluna de tabela) precisa caber ~50 caracteres ou truncar com tooltip.
> Nunca abrevie para "Priorizar Agenda" / "Pautar Debates" — essas são as
> versões do CSV de origem, já mapeadas para os nomes acima.

### 5.2 Tipos de registro (`ref_tipo_registro`) — por etapa

| Produto | Etapa | Tipos |
| --- | --- | --- |
| Estratégia | Pontapé | Pontapé |
| Estratégia | Raio-X | Comitê Político · Escuta Diagnóstica |
| Estratégia | Imersão | Imersão |
| Estratégia | Governança / Organograma | Sprint · Diagnóstico de Organograma · Proposta de Organograma |
| Estratégia | Monitoramento | Monitoramento mensal · Legisla Aliada |
| Estratégia | Replicação | Replicação |
| PLL | Mentorias e monitoramento | Mentoria |

Só **Sprint**, **Monitoramento mensal**, **Legisla Aliada** e **Mentoria**
permitem múltiplos no mesmo contrato.

### 5.3 Pilares de Insight (`ref_pilar_insight`) — 4

1. Contexto sociopolítico do mandato
2. Incidência política (sugestão, recomendação, direcionamento)
3. Desafio/problema do momento (técnico, político, relacional, interno)
4. Conquistas e boas práticas

### 5.4 Níveis IIP (`ref_nivel_iip`) — 4

**Baixo** (1) · **Médio** (2) · **Alto** (3) · **Máximo** (4)

Régua de quatro. Não existe nível 5, nem escala 0–10, nem percentual.

### 5.5 Grupos de Tipologia (`ref_tipologia.grupo`) — 11

O prefixo numérico faz parte do nome e é exibido:

1. Planejamento e Agenda
2. Produção Legislativa
3. Relatoria
4. Cargos e Espaços de Poder
5. Audiências e Eventos Institucionais
6. Fiscalização e Controle
7. Coalizões e Articulação
8. Frente Parlamentar
9. Comunicação e Narrativa
10. Partido e Estrutura
11. Emendas Orçamentárias

### 5.6 Perfis de atuação (`ref_perfil_atuacao`) — 3

Fiscalizadora · Legisladora · Articuladora/Mobilizadora

### 5.7 Catálogos SEM conteúdo aprovado

**Não invente valores para estes.** Em mockup, placeholder marcado como
pendente:

- `ref_agenda_tematica` — Agenda temática (CAT-16)
- `ref_indicador` — Indicadores e pesos do IIP (CAT-16)

---

## 6. Formatação

| Situação | Como fica |
| --- | --- |
| Dado ausente | `—` (travessão). Nunca "N/A", "Pendente", "-", vazio |
| Percentual | `35%`. Ausente vira `—` |
| Número calculado | Fundo hachurado + marcador `fx`, sem foco por Tab, sem clique |
| Data (`DATE`) | `18/set` em lista, `18/09/2026` em detalhe. **Sem hora** |
| Timestamp (`criado_em`) | Data + hora, e só em metadado de auditoria |
| Mês de referência | `set/2026` |
| Campo opcional | Sufixo ` (opcional)` no rótulo — é a convenção do código |

---

## 7. Campos removidos do produto

Existiram, saíram. Não desenhe, não peça no prompt, não "resgate" porque
apareceu numa spec antiga ou porque a coluna ainda está no banco.

| Campo | Onde vivia | Situação |
| --- | --- | --- |
| **Oportunidade (SWOT)** | Objetivo Específico (`fat_objetivo_especifico.oportunidade`) | Removido de UI, Zod e queries (AD-049). A **coluna continua no banco** com o dado histórico — de propósito |
| **Ameaça (SWOT)** | Objetivo Específico (`fat_objetivo_especifico.ameaca`) | Idem |

> A coluna existir no banco **não** autoriza desenhar o campo. Se alguém abrir
> `docs/schema_sistema.sql:995-996` e vir o SWOT, o que vale é a AD-049.

> Atenção ao ler specs antigas: `.specs/features/planejamento-planilha-monitoramento/`
> trata SWOT como requisito entregue (PLM-12) e `docs/jornadas-de-usuario-v2.md`
> (A4.2 / B4.2) ainda o descreve. São documentos datados — a decisão de produto
> é posterior e vence.
