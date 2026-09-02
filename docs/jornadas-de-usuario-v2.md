# Jornadas de Usuário

## Sistema de Operações (Mandatos) — Legisla Brasil · v2

Companheiro da **Constituição** e do **Features & Camadas v3**. Traduz os checklists operacionais de **Estratégia** e **PLL** em jornadas por ator, apontando **onde cada passo acontece no sistema** (feature) e **o que ele grava**.

> ### **Estado deste documento — 2026-09-02: congelado, em revisão**
>
> O sistema entrou em redesenho **tela-first** (**AD-038** em `.specs/STATE.md`): as telas ideais
> são desenhadas no Figma e validadas com a operação, e a **v3 destas jornadas será derivada
> delas**. Até lá:
>
> - **Não use este documento como alvo de implementação.** Nenhuma tarefa da operação roda no
>   sistema hoje, então existe um erro de aderência em algum ponto entre estas jornadas e as telas
>   construídas a partir delas. Ainda **não se sabe** se a jornada está errada ou se foi bem
>   descrita e mal implementada — a tela validada é que vai dizer, uma por uma.
> - **Continue usando-o como inventário.** A §10 (tipos de registro, formulários, métricas) e a
>   §11 (o que fica fora) vieram dos checklists reais de Estratégia e PLL e seguem sendo o melhor
>   registro do que a operação faz. Toda tela nova precisa declarar o que faz com cada item da
>   §10: **cobre**, **substitui** ou **descarta** — descartar é legítimo, esquecer não.
> - **A cada tela validada**, o bloco de jornada correspondente é **reescrito**, não remendado.
>   Protocolo em `docs/redesenho-tela-first.md`.

**O que mudou da v1:** os códigos de feature foram reapontados para o **Features & Camadas v3**, e a coluna *Grava* passou a citar a **tabela real do `schema_v4.sql`** em vez de nome aproximado. Nenhum passo foi criado, removido ou reordenado — as jornadas são as mesmas. O diário completo das trocas está na §12.

**Como ler as tabelas:**

- **Feature** — código de `features-e-camadas-v3.md` (PLT/FND/PLN/INC/OPR/OUT/INT). **Atenção:** PLN-EST, PLN-PLL, PLN-COA não existem mais, e OPR-01/02/03 mudaram de significado. Ver §12.  
- **Grava** — a tabela do schema que recebe o dado. `—` significa que o passo não gera dado (é agenda, deslocamento ou trabalho externo).  
- **Externo** — passo que acontece fora do sistema (Mural, Canva, viagem, condução de reunião). Ver §11.  
- **Em evolução¹** — análise em revisão pela área de conhecimento (Mapa Político, Organograma); entra como feature posterior. O sistema guarda o **link** do resultado, não o método.  
- **◻ campos TBD** — **marcador extinto.** Todos os passos que na v1 gravavam "em tabela com campos a definir" têm schema fechado no v4. Ver §12.

---

## 1\. Atores e escopo de visão

Todos os atores têm **login na plataforma** — inclusive os externos (Mentor, Assessor). O cadastro dos externos é feito pela Gestora (CRUD).

| Ator | É usuário? | Enxerga | Entra no sistema para |
| :---- | :---- | :---- | :---- |
| **Gestora de Mandato** | Sim | Tudo, em todos os produtos; carteira própria destacada | Operar a consultoria ponta a ponta \+ gestão/analytics |
| **Mentor / Consultor** | Sim (externo, via magic link) | Só os mandatos da sua carteira, com analytics agregado dela | Preparar, conduzir e registrar mentorias/encontros |
| **Assessor do mandato** | Sim | Só o planejamento do seu mandato (ou da secretaria executiva) | Responder formulários e atualizar Sucessos Mensais |
| **Admin do Sistema** | Sim | Irrestrito, sem carteira | Administrar papéis, usuários e integrações |
| **Interno Legisla (áreas clientes)** | Sim (acesso de Gestora) | Números de impacto e visão do mandato | Consultar e exportar dados de impacto |

**Cargo ≠ papel.** *Parlamentar* e *Chefe de Gabinete* **não são papéis de acesso** — são **cargos** preenchidos no vínculo do usuário com o contrato. Um usuário do gabinete tem papel **Assessor** (`dim_usuario.papel_global`) e um **cargo** (`rel_usuario_contrato.cargo`). A Gestora faz **CRUD desses usuários** e pode **alterar o cargo** a partir da lista filtrada pelo mandato. Isso resolve quem responde os formulários introdutórios de CG/Parlamentar: são usuários com login e cargo, não respondentes anônimos.

**Carteira não é tabela:** é `rel_usuario_contrato WHERE id_usuario = ? AND dt_fim IS NULL`.

---

## 2\. Jornada A — Gestora · Produto **Estratégia**

A jornada mais longa do sistema: 7 blocos, do cadastro à replicação.

### A1 · Cadastro *(provisionamento — hoje "fluxo de onboarding no Slack")*

| Passo | O que acontece | Feature | Grava |
| :---- | :---- | :---- | :---- |
| A1.1 | Cadastrar o mandato (importação TSE ou manual) | FND-01 | `dim_contratante` \+ `dim_mandato` \+ `rel_mandato_candidatura` |
| A1.2 | Abrir o contrato e vincular Produto, Projeto e Coalizão | FND-04 (+ FND-02 se houver coalizão) | `fat_contrato` \+ `rel_coalizao_membro` |
| A1.3 | Vincular Gestora e/ou Mentor responsável | FND-03 \+ PLT-01 | `rel_usuario_contrato` |
| A1.4 | Cadastrar assessores do gabinete | FND-03 | `dim_usuario` \+ `rel_usuario_contrato` (`cargo`, `grau_responsabilidade`, `areas`) |
| A1.5 | Criar canal do Slack | INT-02 | `rel_integracao_contrato` (`slack_canal`) |
| A1.6 | **Instanciar o contrato**: cria o planejamento vazio, a régua completa com datas previstas e habilita os formulários da etapa | OPR-01 (+ PLN-01, OPR-02) | `fat_etapa_contrato` (régua inteira, `dt_prevista_*`) \+ `dim_planejamento` (vazio) \+ `rel_formulario_contrato` |

> A antiga "replicação de planilha \+ Typeform (URL+id\_mandato) \+ pasta do Drive" **deixa de existir**: no sistema o contrato já nasce com suas tabelas e seus formulários próprios. Primeira prova concreta da Definição de Pronto (§6 da Constituição).  
>   
> **Novo no v4:** as datas previstas de cada etapa são geradas de `ref_etapa.duracao_prevista_dias` na instanciação. É isso que permite responder "quem está atrasado" sem ninguém digitar atraso.

### A2 · Pontapé

| Passo | O que acontece | Feature | Grava |
| :---- | :---- | :---- | :---- |
| A2.1 | Preparar o Kit de Boas-Vindas (Canva) | Externo | — |
| A2.2 | Agendar a Reunião de Boas-Vindas | OPR-03 \+ INT-01 | `fat_encontro` (nasce `planejado`) |
| A2.3 | Abrir os formulários da etapa para o mandato: Termo de Compromisso, Código de Conduta, Introdutório Assessores, Introdutório CG+Parlamentar, Organograma | OPR-02 | `rel_formulario_contrato.estado = 'aberto'` |
| A2.4 | Realizar a reunião e lançar o **registro** da etapa | INC-01 (+ OPR-03) | `fat_registro` (pontapé) \+ `rel_encontro_participante` \+ `fat_encontro.status = 'realizado'` |
| A2.5 | Acompanhar respostas; anexar termos assinados (documento externo) | OPR-02 \+ OPR-04 | `fat_submissao` (`aceite_em`) \+ `fat_artefato` (`escopo = 'submissao'`, `tipo = 'termo_assinado'`) |

### A3 · Raio-X

| Passo | O que acontece | Feature | Grava |
| :---- | :---- | :---- | :---- |
| A3.1 | Ler as respostas dos formulários introdutórios (visão consolidada por mandato) | OPR-02 | leitura de `fat_submissao` |
| A3.2 | Elaborar o Mapa Político | Em evolução¹ \+ OPR-04 | `fat_artefato` (`tipo = 'mapa_politico'`) — guarda o link até virar feature |
| A3.3 | Agendar Comitê Político e Reunião de Escuta Diagnóstica | OPR-03 \+ INT-01 | `fat_encontro` ×2 |
| A3.4 | Realizar Comitê Político → registro | INC-01 | `fat_registro` (comitê político) |
| A3.5 | Realizar Escuta Diagnóstica → registro | INC-01 | `fat_registro` (escuta diagnóstica) |
| A3.6 | Definir o **Perfil de Atuação Parlamentar** (Fiscalizadora / Legisladora / Articuladora-Mobilizadora) | PLN-01 | `dim_planejamento.id_perfil_atuacao` |
| A3.7 | Escolher os **3 Preditores prioritários** entre os 5 | PLN-01 | `rel_planejamento_preditor` (`ordem` 1–3) |
| A3.8 | Aplicar a **Régua dos Sonhos** e o **GIP Início** | PLN-03 | `fat_gip` (`momento = 'inicio'`) \+ `fat_gip_dimensao` (`eixo = 'regua_sonhos'`) |

> **Régua dos Sonhos e GIP são o mesmo instrumento (D6).** A régua é a aspiração pactuada aqui, no Raio-X; ela vive como um dos dois eixos da mesma aplicação do GIP, e só faz sentido lida contra `onde_chegamos`. Não são dois formulários, não são duas telas. A distância entre os eixos **é** a medida, entregue por `vw_gip_evolucao`.

### A4 · Imersão

No dia da imersão, **A4.1–A4.7 são construídos no [Mural](https://www.mural.co/)** (ferramenta externa). Depois existe uma **atividade de transferência** do planejamento do Mural para o sistema — hoje manual (a Gestora digita), no futuro uma feature de **importação de CSV do Mural**.

| Passo | O que acontece | Feature | Grava |
| :---- | :---- | :---- | :---- |
| A4.1 | Logística: passagens, papelaria, hospedagem, cronograma, deslocamento | Externo | — |
| A4.2 | Construção de Legado e análise de conjuntura (Termômetro Político, SWOT) | PLN-01 | `dim_planejamento.legado` \+ `.analise_conjuntura`; SWOT por objetivo em `fat_objetivo_especifico.oportunidade`/`.ameaca` |
| A4.3 | Deliberar o **Objetivo do Ano** | PLN-01 | `dim_planejamento.objetivo_ano` |
| A4.4 | Criar **Objetivos Específicos** (com preditor primário/secundário e agenda temática) | PLN-01 | `fat_objetivo_especifico` |
| A4.5 | Criar **Metas** (preditor 1º/2º, agenda temática, prioridade, Programática ou Governança) | PLN-01 | `fat_meta` (`prioridade`, `classe`) |
| A4.6 | Definir responsáveis por meta | PLN-01 \+ FND-03 | `fat_meta.id_usuario_responsavel` |
| A4.7 | Definir **Sucessos Mensais** (peso e % de atingimento) | PLN-01 | `fat_sucesso_mensal` (`peso` 0–100, `mes_referencia`) |
| **A4.T** | **Transferir o planejamento do Mural para o sistema** (digitação manual na v1; CSV no futuro) | PLN-01 | planejamento completo · o Mural em si é **externo** |
| A4.8 | Aplicar o Formulário de Avaliação da Imersão | OPR-02 | `fat_submissao` \+ `fat_resposta_metrica` |
| A4.9 | Lançar o registro da imersão | INC-01 | `fat_registro` (imersão) |

> **A transferência Mural → sistema é o gargalo manual da v1.** É o passo "replicar e inserir os dados do mural" do checklist (5.3), mantido de propósito: o planejamento nasce no Mural e alguém o digita no sistema.  
>   
> **Novo no v4:** oportunidade e ameaça ficam **no objetivo**, não no planejamento — é assim que a base de PLL já as coleta, por objetivo e por preditor.

### A5 · Governança / Organograma

| Passo | O que acontece | Feature | Grava |
| :---- | :---- | :---- | :---- |
| A5.1 | Reunião de alinhamento e refinamento das metas pós-imersão | PLN-01 \+ PLT-02 | edição da hierarquia \+ `log_auditoria` |
| A5.2 | Validar próximas agendas com o CG | OPR-03 \+ INT-01 | `fat_encontro` |
| A5.3 | **Sprints (X)** — apresentação do planejamento à equipe e apoio no uso da ferramenta; um registro por sprint, **sem número fixo** | OPR-03 \+ INC-01 | `fat_encontro` \+ `fat_registro` (sprint, `nr_sequencia` 1..N) |
| A5.4 | Analisar as respostas do Formulário de Organograma | Em evolução¹ | leitura de `fat_submissao` |
| A5.5 | Elaborar o Relatório de Diagnóstico de Organograma | Em evolução¹ | — |
| A5.6 | Agendar e realizar a reunião de diagnóstico | OPR-03 \+ INC-01 | `fat_encontro` \+ `fat_registro` (diagnóstico de organograma) |
| A5.7 | Reunião de proposta de organograma com os assessores (inclui recomendação de reuniões semanais e rotinas de feedback) | INC-01 | `fat_registro` (organograma) |
| A5.8 | Enviar a versão final do organograma ao mandato | OPR-04 | `fat_artefato` (`tipo = 'organograma'`) |

### A6 · Monitoramento *(ciclo mensal ×4)*

| Passo | O que acontece | Feature | Grava |
| :---- | :---- | :---- | :---- |
| A6.1 | Assessor/Gestora atualiza o % dos Sucessos Mensais | PLN-02 | `fat_sucesso_mensal.pct_atingimento` → cascata em `fat_meta` → `fat_objetivo_especifico` → `dim_planejamento` |
| A6.2 | Reunião de monitoramento do mês → registro | OPR-03 \+ INC-01 | `fat_encontro` \+ `fat_registro` (monitoramento, `nr_sequencia` 1–4) |
| A6.3 | Registrar **Insights** ligados ao registro | INC-02 | `fat_insight` \+ `rel_insight_origem` (Meta e/ou Sucesso Mensal) |
| A6.4 | Registrar **Fatos Geradores**, validados por Tipologias e vinculados (ou não) a **Metas e/ou Insights** — um Insight também pode originar um FG | INC-03 | `fat_fato_gerador` (`nivel_d1`\+`nivel_d2`\+`nivel_d3`) \+ `rel_fato_origem` |
| A6.5 | Acompanhar o **IIP** do mandato | INC-04 | leitura de `mv_iip_contrato` |
| A6.6 | Após o mês 2: aplicar o **GIP Meio** | PLN-03 | `fat_gip` (`momento = 'meio'`) \+ `fat_gip_dimensao` (`eixo = 'onde_chegamos'`) |
| A6.x | Fechamento do mês (job) | OUT-06 | `fat_snapshot_mensal` |

> Este é o **loop de maior frequência do sistema** — repete a cada mês e é onde a Gestora passa a maior parte do tempo. Merece ser a tela mais bem resolvida do produto.  
>   
> **CRUD auditado da Gestora.** A Gestora pode **criar, editar e apagar qualquer campo do planejamento** (Objetivo, Meta, Sucesso Mensal, pesos, %, preditores) a qualquer momento — não só no ciclo mensal. **Toda alteração vai para `log_auditoria`** (PLT-02): quem, quando, valor anterior e novo.  
>   
> **Novo no v4:** o fato gerador carrega as **três dimensões simultâneas**, não uma escolhida. E o fechamento do mês grava um snapshot — é ele que sustenta "evolução no tempo" nas telas de carteira e gestão.

### A7 · Replicação *(fechamento do ciclo)*

| Passo | O que acontece | Feature | Grava |
| :---- | :---- | :---- | :---- |
| A7.1 | Adequar a apresentação de replicação à realidade do mandato | Externo (Canva) | — |
| A7.2 | Agendar e realizar a reunião de replicação | OPR-03 \+ INC-01 | `fat_encontro` \+ `fat_registro` (replicação) |
| A7.3 | Aplicar o **GIP Fim** | PLN-03 | `fat_gip` (`momento = 'fim'`) \+ `fat_gip_dimensao` |
| A7.4 | Aplicar o Formulário de Avaliação de Fim de Ciclo | OPR-02 \+ OUT-07 | `fat_submissao` \+ `fat_resposta_metrica` |
| A7.5 | Encerrar o contrato e consolidar impacto | FND-04 \+ OUT-01/OUT-02 | `fat_contrato` (`status`, `dt_fim`, `motivo_encerramento`) → `mv_numeros_impacto` \+ `vw_visao_mandato` |

---

## 3\. Jornada B — Gestora / Coordenação · Produto **PLL**

Jornada de **edição** (turma), não de mandato individual — a unidade de operação é a edição, e dentro dela cada mentorado. **A edição é um Projeto**; participar dela é ter contrato de produto PLL com aquele `id_projeto`. "Turma" não é tabela.

### B1 · Recrutamento e seleção de participantes

| Passo | O que acontece | Feature | Grava |
| :---- | :---- | :---- | :---- |
| B1.1 | Convite e mobilização de mentorados | Externo | — |
| B1.2 | Formulário de inscrição de mentorados | **v1: importação manual** (INT-04) | `dim_usuario` via staging |
| B1.3 | Vincular o assessor mentorado ao mandato | FND-03 \+ FND-04 | `rel_usuario_contrato` sobre o contrato PLL |
| B1.4 | Confirmação de participação — inclui registrar desistência, com motivo | OPR-05 | `fat_contrato.status` \+ `motivo_encerramento` |
| B1.5 | Formulário de Diagnóstico e temáticas de interesse | OPR-02 | `fat_submissao` (f1) |

### B2 · Seleção e formação de mentores

| Passo | O que acontece | Feature | Grava |
| :---- | :---- | :---- | :---- |
| B2.1 | Convite e mobilização de mentores | Externo | — |
| B2.2 | Mentor recebe **magic link** e se cadastra (v1: nome, e-mail, telefone) | FND-03 \+ PLT-01 | `dim_usuario` (`papel_global = 'mentor'`) |
| B2.3 | Confirmação de participação | OPR-05 | `rel_usuario_contrato` |

### B3 · Pontapé

| Passo | O que acontece | Feature | Grava |
| :---- | :---- | :---- | :---- |
| B3.1 | Analisar os diagnósticos e temáticas | OPR-05 | leitura de `fat_submissao` |
| B3.2 | **Parear mentorado ↔ mentor** (constrói a carteira de cada mentor) | OPR-05 \+ PLT-01 | `rel_usuario_contrato` (`papel_no_contrato = 'mentor'`) |

> B3.2 é o passo que **liga a operação ao controle de acesso**: é um `INSERT` que faz o Mentor enxergar exatamente os planejamentos da sua carteira, e nada além. O RLS do Mentor cai automaticamente disso — não há tabela de carteira a manter em sincronia.

### B4 · Imersão e construção do planejamento

| Passo | O que acontece | Feature | Grava |
| :---- | :---- | :---- | :---- |
| B4.1 | Perfil de Atuação Parlamentar | PLN-01 | `dim_planejamento.id_perfil_atuacao` |
| B4.2 | Oportunidades e Ameaças | PLN-01 | `fat_objetivo_especifico.oportunidade` / `.ameaca` |
| B4.3 | Objetivos → Metas → Sucessos Mensais, com mentoria guiada. **Meta carrega Preditor 1 e Agenda Temática** | PLN-01 | `dim_planejamento` \+ `fat_objetivo_especifico` \+ `fat_meta` \+ `fat_sucesso_mensal` |
| B4.4 | Formulário de avaliação da imersão | OPR-02 \+ OUT-07 | `fat_submissao` \+ `fat_resposta_metrica` |
| B4.5 | **Mentoria 1** — presencial | OPR-03 \+ INC-01 | `fat_encontro` \+ `fat_registro` (mentoria, `nr_sequencia = 1`) |

> **B4.1 e B4.2 deixaram de ser "campos TBD".** O v4 fechou os dois: perfil é FK para catálogo, SWOT é coluna do objetivo. As tabelas do PLL são **as mesmas** da Estratégia — a única diferença estrutural é que o PLL não usa preditor secundário na Meta.

### B5 · Mentorias e monitoramento

| Passo | O que acontece | Feature | Grava |
| :---- | :---- | :---- | :---- |
| B5.1 | **Mentorias 2 a 5** — cada uma com registro, insights políticos e fatos geradores | OPR-03 \+ INC-01/02/03 | `fat_encontro` (`nr_sequencia` 2–5) \+ `fat_registro` \+ `fat_insight` \+ `fat_fato_gerador` |
| B5.2 | Atualização dos Sucessos Mensais entre mentorias | PLN-02 | `fat_sucesso_mensal.pct_atingimento` → cascata |
| B5.3 | Avaliação **parcial** de participantes e de mentores | OPR-02 \+ OUT-07 | `fat_submissao` (`momento = 'parcial'`) \+ `fat_resposta_metrica` |
| B5.4 | Avaliação **final** de participantes e de mentores | OPR-02 \+ OUT-07 | `fat_submissao` (`momento = 'final'`) \+ `fat_resposta_metrica` |
| B5.5 | Visão agregada da edição | OPR-05 \+ OUT-01 | leitura de `mv_numeros_impacto` filtrada por `id_projeto` |

> **Novo no v4:** o insight do PLL **não exige registro de origem** — nenhum insight da base atual de PLL tem um. A regra "insight nasce de registro" continua valendo na Estratégia, aplicada na tela, não no banco.  
>   
> A mentoria agora tem os dois lados: `fat_encontro` guarda a marcada (com remarcação e cancelamento) e `fat_registro` guarda a realizada. "A mentoria 3 aconteceu?" passa a ter resposta.

---

## 4\. Jornada C — Mentor / Consultor

Ciclo curto e repetitivo, ancorado na carteira.

1. **Entrar** → vê apenas os mandatos/mentorados da sua carteira (PLT-01 \+ RLS).  
2. **Abrir a "Visualização Carteira de Mandatos"** → analytics **agregado e filtrável da própria carteira**: atingimento por mandato, IIP, evolução no tempo, fatos geradores — o mesmo painel que a Gestora tem, **restrito à carteira do Mentor** (OUT-05, sobre `vw_carteira` \+ `fat_snapshot_mensal`).  
3. **Preparar** → abre o planejamento do mentorado e o histórico de registros, insights e fatos (INC-05).  
4. **Conduzir** o encontro (fora do sistema).  
5. **Registrar**, no mesmo dia: marcar presença e fechar o encontro (OPR-03) → registro da mentoria (INC-01) → insights ligados a ele (INC-02) → fatos geradores, com tipologia e vínculo a Meta e/ou Insight (INC-03).  
6. **Atualizar** os Sucessos Mensais discutidos (PLN-02).  
7. **Responder** os formulários de avaliação da edição (OPR-02).

**O que o Mentor nunca vê:** mandatos fora da carteira, os **números de impacto** e a **visão gerencial global** (essas são do time Legisla), cadastro de usuários. O analytics do Mentor é sempre **recortado pela sua carteira**.

---

## 5\. Jornada D — Assessor do mandato

O usuário mais numeroso e o menos frequente — a jornada precisa ser óbvia sem treinamento.

1. **Ser cadastrado** pela Gestora e receber acesso (FND-03).  
2. **Responder formulários abertos** para o seu mandato: introdutório, organograma, termo de compromisso, código de conduta, avaliações (OPR-02). Pode reabrir e editar a própria resposta enquanto o formulário estiver aberto.  
3. **Acessar o planejamento** do seu mandato — e só dele (PLN-01, leitura).  
4. **Atualizar o % dos Sucessos Mensais** das metas sob sua responsabilidade, no ciclo mensal (PLN-02). **É a única escrita do Assessor no planejamento.**  
5. **Ver o dashboard** de atingimento do próprio planejamento.

**Fronteiras:** não vê IIP (uso interno), não vê outros mandatos, não vê números de impacto, não cadastra ninguém.

> **Risco de adoção conhecido** (Constituição §5.7): os assessores vêm de planilha. Se a tela do passo 4 não permitir edição rápida em grade — tabular entre células, colar de uma faixa, editar em massa — eles voltam para o Sheets e a Definição de Pronto cai.

---

## 6\. Jornada E — Admin do Sistema

1. Criar, editar e remover usuários e atribuir papéis (FND-03 \+ PLT-01).  
2. Configurar integrações — Slack e Google Calendar/Meet (INT-01/02) — e o ETL do TSE (INT-03).  
3. Manter os **catálogos e parâmetros** do sistema: etapas, tipos de registro, formulários, tipologias, indicadores, níveis do IIP, dimensões do GIP (FND-05).  
4. **Assumir a visão de outro papel** para suporte: a UI sinaliza "atuando como X" e a ação vai para `log_auditoria.id_usuario_impersonado` (PLT-04).  
5. Auditar acessos e ações (PLT-02).

---

## 7\. Jornada F — Gestora / Legisla · leitura, carteira e gestão

Esta jornada é das **Gestoras** (e das áreas clientes, que têm acesso de Gestora). É a face de **visualização** do sistema — leitura e agregação, sem alterar dado de origem.

### 7.1 · Impacto e visão do mandato *(áreas clientes \+ Gestora)*

1. Abrir **Números de impacto** e filtrar por produto, projeto, período (OUT-01, sobre `mv_numeros_impacto`).  
2. Clicar em um mandato → **Visão do mandato**: linha do tempo por contrato, produtos contratados, cadeia de renovação (OUT-02, sobre `vw_visao_mandato`). Uso exclusivo Legisla.  
3. **Exportar** para Google Sheets/CSV (OUT-04).

>   
> **Novo no v4:** *Nº de produtos* e *Ano da 1ª vez* deixam de ser colunas digitadas (divergiam em 46 e 41 contratantes) e passam a ser calculadas. E como prospecção não é mais status de contrato, **não há filtro de status** na saída: todo contrato listado é contrato assinado.

### 7.2 · Visualização Carteira de Mandatos *(Gestora e Mentor, cada um na sua carteira)*

Tela de **analytics da carteira** (OUT-05): planejamento e incidência **filtrados e agregados** por mandato, produto, projeto e período — atingimento em cascata, IIP, fatos geradores, último registro, evolução no tempo. A mesma tela serve **Gestora** (sua carteira) e **Mentor** (a dele), com o recorte garantido pelo RLS — não por duas telas.

### 7.3 · Visão gerencial *(gestão do time e dos produtos)*

Agregação acima da carteira individual: desempenho por produto, por edição de PLL, por Gestora/Mentor, por projeto (OUT-03).

> **Fronteira preservada:** o Mentor entra apenas em **7.2**, restrito à própria carteira. Impacto (7.1) e gerencial (7.3/7.4) são **exclusivos do Legisla**.

### 7.4 · Jornada gerencial — coordenação de Monitoramento

> **Ressalva de escopo.** Esta jornada é de **visualização de dados**, não de operação — vive na camada de **Saída (OUT)**. O detalhamento fino (quais indicadores, quais cortes) é assunto de um documento de **especificação de telas gerenciais**, não deste.

Quem faz: **coordenação de Monitoramento / liderança** (papel de Gestora ou Admin).

1. **Acompanhar a saúde da operação** — quantos mandatos por etapa, quais atrasados, atingimento médio por produto, IIP consolidado (OUT-03, sobre `vw_etapa_contrato` \+ `mv_iip_contrato`).  
2. **Ler por recorte** — por produto, projeto/temática, edição de PLL, Gestora e Mentor.  
3. **Identificar gargalos** — mandatos sem registro recente, formulários abertos há muito tempo, etapas atrasadas, encontros vencidos, sucessos mensais não atualizados. Tudo derivado em `vw_pendencias`; **pendência nunca é digitada**.  
4. **Consolidar impacto para fora** — levar os números da §7.1 às áreas clientes, com exportação (OUT-04).  
5. **Auditar** — cruzar com `log_auditoria` (PLT-02) quando precisar entender uma alteração de planejamento.

>   
> **Limiares fixos na v1:** os "N dias" de formulário aberto (30) e de contrato sem registro (45) estão escritos na view, e o indicador de carga por Gestora roda **sem ponderação por etapa** — `ref_etapa` não tem peso. Exceção registrada em Features & Camadas v3 §5.1.

---

## 8\. Jornada G — Gestora · Produto **Coalizão**

Preenche a lacuna de quem estabelece e sustenta a estrutura de uma coalizão.

### G1 · Formação

| Passo | O que acontece | Feature | Grava |
| :---- | :---- | :---- | :---- |
| G1.1 | Efetuar o cadastro (contratante novo ou legado do tipo coalizão) e abrir o contrato | FND-01 \+ FND-04 | `dim_contratante` (`tipo_contratante = 'coalizao'`) \+ `dim_coalizao` \+ `fat_contrato` |
| G1.2 | Atrelar ao Projeto gerador, se existente | FND-02 | `dim_coalizao.id_projeto_origem` |
| G1.3 | Configurar se haverá plano de metas exclusivo | FND-02 | `dim_coalizao.possui_planejamento_proprio` |
| G1.4 | Integrar mandatos membros e definir funções (secretaria executiva, GT ou membro) | FND-02 | `rel_coalizao_membro` (`papel`, `nome_grupo`, `dt_entrada`) |
| G1.5 | Atribuir a Gestora do Mandato como responsável | FND-03 \+ PLT-01 | `rel_usuario_contrato` |

> **Novo no v4:** a participação deixa de ser inferida por projeto compartilhado e passa a ter **papel e período**. A adesão é do **contrato**, não do contratante: um mandato pode ser membro num ciclo e não no seguinte.

### G2 · Operação *(fluxo condicionado à decisão D9)*

| Passo | O que acontece | Feature | Grava |
| :---- | :---- | :---- | :---- |
| G2.1 | *Havendo plano próprio*: instanciar régua de execução (similar a A1.6) | OPR-01 \+ PLN-01 | `fat_etapa_contrato` \+ `dim_planejamento` |
| G2.2 | Gerenciar movimentação (entrada e desligamento) de membros no ciclo | FND-02 | `rel_coalizao_membro.dt_entrada` / `.dt_saida` |

> **G2.1 segue bloqueado (D9).** Não existem etapas cadastradas para o produto Coalizão — `ref_etapa` não tem seed para ele. A premissa de trabalho é replicar a régua da Estratégia, e o `INSERT` de clonagem está pronto e comentado no DDL; enquanto a operação não confirmar, **este passo não tem régua para instanciar**. Coalizão **sem** planejamento próprio não é afetada: é leitura consolidada dos membros, e G3.1 já funciona.

### G3 · Leitura

| Passo | O que acontece | Feature | Grava |
| :---- | :---- | :---- | :---- |
| G3.1 | Acessar a visão de agregação: impacto, projeto e metas dos mandatos vinculados | OUT-01 \+ OUT-05 | leitura de `mv_numeros_impacto` \+ `vw_carteira` filtrados por `rel_coalizao_membro` |

---

## 9\. Micro-jornadas transversais

Repetem-se dentro de todas as jornadas acima. Se estas telas forem boas, o sistema é bom.

| Micro-jornada | Gatilho | Passos | Feature |
| :---- | :---- | :---- | :---- |
| **Lançar registro** | Fim de qualquer reunião de etapa | escolher mandato → escolher etapa → preencher formulário → salvar (data, canal, autor automáticos) | INC-01 |
| **Lançar insight** | Durante ou após o registro | abrir o registro → adicionar insight, opcionalmente num dos 4 pilares → vincular a Meta e/ou Sucesso Mensal | INC-02 |
| **Lançar fato gerador** | Ação política observada (inclusive a partir de um Insight) | escolher tipologia (valida a tripla e **pré-preenche** níveis e preditores) → ajustar **D1, D2 e D3** → vincular a **Meta e/ou Insight** *ou* deixar sem origem | INC-03 → INC-04 |
| **Abrir/fechar formulário** | Início e fim de etapa | Gestora (ou coordenação, no PLL) alterna o estado por formulário **e** por mandato | OPR-02 |
| **Agendar encontro** | Toda reunião do checklist | criar o encontro (nasce `planejado`) → espelhar no Calendar → vincular a contrato, etapa e tipo | OPR-03 \+ INT-01 |
| **Marcar presença** | Ao final do encontro | abrir o encontro → marcar quem participou (Legisla, mandato ou convidado externo) → encontro passa a `realizado` | OPR-03 |
| **Remarcar / cancelar encontro** | Imprevisto de agenda | abrir o encontro → remarcar (cria novo encontro; o antigo fica `remarcado`) ou cancelar | OPR-03 |
| **Anexar artefato** | Qualquer entrega de documento ou link | abrir a linha (contrato, registro, submissão, encontro ou etapa) → colar o link → escolher o tipo | OPR-04 |

> **Sobre "lançar fato gerador":** na v1 este passo dizia "definir status D1/D2/D3", o que se lia como escolher **um**. São **três níveis simultâneos**, um por dimensão, e a tipologia já sugere os três. A tela precisa deixar isso óbvio — com o desenho antigo, o IIP não é calculável.

---

## 10\. Tipos derivados dos checklists

Inventário extraído dos dois checklists — hoje já materializado nos catálogos do schema.

### 10.1 Tipos de registro (`ref_tipo_registro` → `fat_registro`)

**Estratégia:** pontapé · comitê político · escuta diagnóstica · imersão · sprint (×N, sem limite) · diagnóstico de organograma · organograma (proposta) · monitoramento (mensal, ×4) · replicação · legisla aliada **PLL:** mentoria (×5)

> Registro com mais de uma ocorrência usa `nr_sequencia` — não uma coluna por ocorrência. `legisla_aliada` veio das planilhas e não estava em nenhum documento de escopo; entrou no catálogo para não se perder (confirmar com a operação se segue ativo).

### 10.2 Formulários do sistema (`ref_formulario`)

Quem "abre" cada formulário é a Gestora (Estratégia) ou a coordenação do programa (PLL); o respondente só responde. **Nenhum é respondível por link anônimo.**

| Produto | Formulário | Quem responde | Etapa |
| :---- | :---- | :---- | :---- |
| Estratégia | Termo de Compromisso | Assessor/cargo (aceite \+ anexo em `fat_artefato`) | Pontapé |
| Estratégia | Código de Conduta | Assessor/cargo (aceite \+ anexo em `fat_artefato`) | Pontapé |
| Estratégia | Introdutório Assessores | Assessor | Pontapé |
| Estratégia | Introdutório CG e Parlamentar | Usuário com **cargo** CG / Parlamentar | Pontapé |
| Estratégia | Organograma | Assessor / CG | Pontapé → Governança |
| Estratégia | GIP Início / Meio / Fim | Gestora | Raio-X / Monitoramento / Replicação |
| Estratégia | Avaliação da Imersão | Participantes | Imersão |
| Estratégia | Avaliação de Fim de Ciclo | Mandato | Replicação |
| PLL | Inscrição de mentorados | Mentorado (**importação manual na v1**) | Recrutamento |
| PLL | Diagnóstico e temáticas | Mentorado | Recrutamento |
| PLL | Inscrição de mentores | Mentor (via magic link) | Seleção |
| PLL | Avaliação da imersão | Mentorado | Imersão |
| PLL | Avaliação parcial — participantes / mentores | Mentores e mentorados | Mentorias |
| PLL | Avaliação final — participantes / mentores | Mentores e mentorados | Mentorias |

> **A Régua dos Sonhos saiu desta lista (D6).** Não é formulário próprio: é o eixo `regua_sonhos` da aplicação do GIP. O formulário do GIP alimenta `fat_gip` via `fat_gip.id_submissao`.  
>   
> A submissão guarda **contra qual versão do formulário** foi respondida. Sem isso, comparar a avaliação do PLL 4 com a do PLL 5 é comparar perguntas diferentes.

### 10.3 Métricas de formulário (`ref_metrica_formulario`)

As perguntas de escala dos formulários de avaliação são declaradas como métrica e extraídas para tabela própria na submissão. Uma pergunta por formulário pode ser a de **recomendação** (base do NPS); as demais entram por agrupador (qualidade do planejamento, satisfação com o mentor…). O rótulo é estável mesmo quando o enunciado muda entre edições — é isso que permite série histórica de satisfação. NPS e médias por critério saem de `mv_avaliacao_nps` (OUT-07), não de agregação sobre JSONB.

---

## 11\. O que fica fora do sistema

Explicitar isso evita que o escopo cresça sozinho: **Mural** (construção do planejamento no dia da imersão — o sistema recebe o resultado por digitação hoje e por CSV no futuro, §A4) · **Canva** (kit de boas-vindas, apresentação de replicação) · **logística de viagem** (passagens, hospedagem, papelaria) · **convite e mobilização** de mentores e mentorados · **condução** das reuniões · **assinatura** dos termos (só o anexo entra, via `fat_artefato`) · **elaboração** do Mapa Político e do Relatório de Organograma (análises em revisão pela área de conhecimento — entram como features posteriores).

**Também fora, por decisão do v4:** **prospecção**. O sistema não guarda material anterior à assinatura do contrato — contrato existe quando há contrato. Se a operação precisar de pipeline pré-contrato, ele volta como tabela e feature próprias, nunca como status de `fat_contrato`.

---

### 12 O que continua em aberto

- **D9 · régua da Coalizão** — bloqueia G2.1 e mantém OPR-06 sem especificação completa.  
- **D2 · aritmética do IIP** — A6.5 e 7.4.1 leem um número rotulado como provisório.  
- **Importação do CSV do Mural** — A4.T segue manual.  
- **Mapa Político e Relatório de Organograma** — A3.2, A5.4 e A5.5 seguem "em evolução"; o sistema guarda o link.

