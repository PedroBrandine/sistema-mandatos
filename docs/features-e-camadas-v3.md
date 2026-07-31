# Features & Camadas — v3

**Sistema de Operações (Mandatos) — Legisla Brasil**

Companheiro da Constituição e das Jornadas de Usuário. Lista viva das capacidades, com descrição breve, mapeamento por camada e vínculo explícito com as tabelas que existem. **A ordem de construção (MVP/ondas) continua fora deste documento.**

**Fontes:** `modelo_dados_v4.md` (modelo fechado) · `schema_v4.sql` (DDL executado — fonte de verdade quando divergir do documento) · `jornadas-de-usuario.md` · Constituição.

**Estado:** consolidado e fechado. É o documento de referência para abrir spec de qualquer feature. Toda feature aqui aponta para tabela que existe no schema; toda tabela do schema tem feature que a escreve (§3).

**Decisões tomadas no fechamento desta versão (§4):** parâmetros dos indicadores ficam fixos na v1, com a exceção registrada · a escrita do snapshot mensal pela camada de Saída é exceção declarada, e o texto da Constituição §2.6 é ajustado fora deste documento · D9 (régua da Coalizão) segue em aberto e mantém OPR-06 sem especificação completa · as demais lacunas ficam aceitas para atualizações futuras.

**Códigos de camada:** PLT (Plataforma) · FND (Fundação) · PLN (Planejamento) · INC (Incidência) · OPR (Operação) · OUT (Saída) · INT (Integrações).

---

## 1\. Lista de features

### Plataforma (PLT)

**PLT-01 · Controle de acesso (RBAC)** — Quatro papéis globais e o vínculo por contrato. `dim_usuario.papel_global` define o que a pessoa é; `rel_usuario_contrato` define onde ela atua, com `papel_no_contrato` e `cargo` separados — cargo não é papel. Carteira continua sem tabela: é `rel_usuario_contrato WHERE dt_fim IS NULL`. **Grava:** `dim_usuario.papel_global` · `rel_usuario_contrato.papel_no_contrato`. **Lê:** ambas. **Jornadas:** todas · B3.2 (o pareamento que define o RLS do Mentor) · C.1 · E.1.

**PLT-02 · Log de auditoria** — Registro de alteração linha a linha em tabela particionada por mês, com valor anterior e novo. Sustenta o CRUD auditado da Gestora sobre o planejamento. **Grava:** `log_auditoria` (por trigger). **Lê:** `log_auditoria`. **Jornadas:** A5.1 · A6.x · E.4 · 7.4.5.

**PLT-03 · RLS e LGPD** — Política de acesso desde o schema, em toda tabela, incluindo as filhas que herdam pelo JOIN com `fat_contrato`. Concentração de dado pessoal é `dim_usuario`; o mandato é dado público ou gerado pela Legisla. **Grava:** — (requisito transversal). **Lê:** `rel_usuario_contrato` (cache de sessão). **Jornadas:** todas.

**PLT-04 · Impersonação do Admin** — Assumir a visão de outro papel para suporte, com marcação na UI e registro em log. Não é papel novo: é modo de operação do Admin, escrito em `log_auditoria.id_usuario_impersonado`. **Grava:** `log_auditoria.id_usuario_impersonado`. **Lê:** `dim_usuario`. **Jornadas:** E.3.

### Fundação (FND)

**FND-01 · Cadastro de contratantes e mandatos** — O cadastro é **de contratante**, com o mandato como subtipo 1:1. Partido e cargo viram FK para catálogo, não texto. O vínculo com o TSE é materializado e revisado por pessoa, com método e confiança — nunca casado em tempo de consulta. Vincular Produto, Projeto e Coalizão não acontece aqui: é FND-04 (contrato) e FND-02 (coalizão). **Grava:** `dim_contratante` · `dim_mandato` · `rel_mandato_candidatura`. **Lê:** `tse.mv_candidatura_resumo` · `ref_partido` · `ref_cargo`. **Jornadas:** A1.1 · G1.1.

**FND-02 · Cadastro e gestão de coalizões** — Coalizão é subtipo de contratante, nasce via Projeto e declara se terá planejamento próprio. A participação de cada mandato tem **papel** (membro, secretaria executiva, grupo de trabalho) e **período**, o que distingue secretaria executiva de membro comum e registra saída no meio do ciclo. A adesão é do contrato, não do contratante: um mandato pode ser membro num ciclo e não no seguinte. **Grava:** `dim_coalizao` · `rel_coalizao_membro`. **Lê:** `ref_projeto` · `fat_contrato`. **Jornadas:** G1.2 · G1.3 · G1.4 · G2.2.

**FND-03 · Cadastro e gestão de usuários** — CRUD de Gestoras, Mentores e Assessores, com magic link para externos. O vínculo com o contrato carrega cargo, grau de responsabilidade e áreas de atuação no gabinete — é essa lista que o diagnóstico de organograma consome. **Grava:** `dim_usuario` · `rel_usuario_contrato` (`cargo`, `grau_responsabilidade`, `areas`). **Lê:** ambas. **Jornadas:** A1.3 · A1.4 · A4.6 · B1.3 · B2.2 · G1.5 · D.1 · E.1.

**FND-04 · Contrato: abertura, ciclo e renovação** — Abre o contrato (contratante × produto × edição), define datas prevista e realizada de fim, encerra com status e motivo, e encadeia renovação por `id_contrato_anterior` — é o que permite ler "2º ciclo de PLL" sem coluna digitada. **Não existe estado de prospecção:** contrato existe quando há contrato. **Grava:** `fat_contrato`. **Lê:** `ref_produto` · `ref_projeto` · `ref_cargo` · `ref_partido`. **Jornadas:** A1.2 · B1.4 (confirmação e desistência) · A7.5 · G1.1.

**FND-05 · Catálogos e parâmetros** — CRUD administrado dos 16 catálogos `ref_`. Existe porque a Constituição proíbe limiar e regra de negócio no código: recalibrar o IIP é `UPDATE` em `ref_nivel_iip`; acrescentar uma quinta dimensão ao GIP é `INSERT` em `ref_dimensao_gip`; a tripla de tipologia com seus níveis padrão e preditores sugeridos vive em `ref_tipologia`. **Grava:** os 16 `ref_`. **Lê:** os 16\. **Jornadas:** transversal (administração). Sem passo próprio nas jornadas A–G.

### Planejamento (PLN)

**PLN-01 · Planejamento do contrato** — Uma hierarquia só — Planejamento → Objetivo Específico → Meta → Sucesso Mensal — discriminada pelo produto do contrato. A única diferença estrutural entre Estratégia e PLL é que só a Estratégia usa preditor secundário, resolvida com coluna anulável. Coalizão com planejamento próprio é o mesmo desenho sobre um contrato cujo contratante é coalizão. Oportunidade e ameaça ficam no objetivo, não no planejamento. Os 3 preditores prioritários são vínculo ordenado, não colunas. **Grava:** `dim_planejamento` · `rel_planejamento_preditor` · `fat_objetivo_especifico` · `fat_meta` · `fat_sucesso_mensal` (criação). **Lê:** `ref_preditor` · `ref_agenda_tematica` · `ref_perfil_atuacao`. **Jornadas:** A3.6 · A3.7 · A4.2–A4.7 · A5.1 · B4.1–B4.3 · G2.1.

**PLN-02 · Ciclo mensal de atingimento** — A grade editável de Sucessos Mensais e a cascata. `pct_atingimento` do Sucesso Mensal é a **única entrada manual**; Meta, Objetivo e Planejamento são recalculados. O recálculo não é síncrono: a escrita marca `atingimento_desatualizado` e o cálculo acontece ao abrir a tela ou em job curto. É a tela de maior frequência do sistema e a única escrita do Assessor. **Grava:** `fat_sucesso_mensal.pct_atingimento`/`status` · colunas `pct_atingimento` da cascata · `dim_planejamento.atingimento_desatualizado`. **Lê:** `vw_sucesso_mensal` (dias de atraso derivados, nunca digitados). **Jornadas:** A6.1 · B5.2 · C.6 · D.4. *PLN-01 e PLN-02 são a mesma capacidade separada por frequência de uso: uma constrói a hierarquia, a outra a atualiza todo mês. Se a operação preferir tratá-las como uma feature só, as tabelas não mudam.*

**PLN-03 · GIP · diagnóstico do gabinete** — **Régua dos Sonhos e GIP são o mesmo instrumento.** Uma aplicação por contrato e momento (início, meio, fim), com quatro dimensões em dois eixos: `regua_sonhos` (a aspiração pactuada no Raio-X) e `onde_chegamos` (a leitura posterior). Os dois booleanos de estrutura e entrega geram o quadrante — coluna gerada, impossível de divergir. A entrega do instrumento é o **gap** entre os eixos, exposto por `vw_gip_evolucao` com situação `atingiu`/`proximo`/`distante`. **Grava:** `fat_gip` · `fat_gip_dimensao`. **Lê:** `ref_dimensao_gip` · `vw_gip_evolucao`. **Jornadas:** A3.8 (início \+ régua) · A6.6 (meio) · A7.3 (fim).

### Incidência (INC)

**INC-01 · Registros por etapa** — Um lançamento por reunião realizada. `nr_sequencia` resolve sprint ×N, monitoramento 1–4 e mentoria 1–5 sem coluna por ocorrência. O registro aponta para o encontro que o originou — é o que fecha o par plano/realizado. `resumo` é coluna, não JSONB, porque aparece em toda listagem. Presentes deixam de ser texto livre (OPR-03) e links deixam de ser campo (OPR-04). **Grava:** `fat_registro`. **Lê:** `ref_tipo_registro` (`schema_campos`) · `fat_encontro`. **Jornadas:** A2.4 · A3.4 · A3.5 · A4.9 · A5.3 · A5.6 · A5.7 · A6.2 · A7.2 · B4.5 · B5.1 · C.5 · micro-jornada "lançar registro".

**INC-02 · Insights** — Anotação qualitativa, opcionalmente num dos 4 pilares. **Registro de origem e pilar passam a ser anuláveis:** a regra "insight nasce de registro" é verdadeira na Estratégia e falsa no PLL, e virou regra de feature, não de schema. Ganha desdobramentos (o que o mandato deve fazer) e comprovação por dados. O vínculo com Meta e/ou Sucesso Mensal é tabela, não duas FK anuláveis. **Grava:** `fat_insight` · `rel_insight_origem`. **Lê:** `ref_pilar_insight` · `fat_registro`. **Jornadas:** A6.3 · B5.1 · C.5 · micro-jornada "lançar insight".

**INC-03 · Fatos Geradores** — O fato não escolhe uma dimensão: carrega as **três simultâneas** (`nivel_d1`, `nivel_d2`, `nivel_d3`), cada uma em baixo/médio/alto, com pelo menos uma preenchida. A tipologia valida a tripla grupo/tipologia/estado e **pré-preenche** níveis e preditores, que ficam editáveis. Ganha `contribuicao_legisla` em escala 0–5. Vínculo com Meta e/ou Insight em tabela; fato sem origem é ausência de linha. **Grava:** `fat_fato_gerador` · `rel_fato_origem`. **Lê:** `ref_tipologia` · `ref_nivel_iip` · `ref_preditor` · `ref_indicador`. **Jornadas:** A6.4 · B5.1 · C.5 · micro-jornada "lançar fato gerador".

**INC-04 · IIP** — Única métrica calculada. Os componentes D1, D2 e D3 saem **separados** na materialized view, ponderados pelo peso do indicador da tipologia; os valores numéricos dos níveis vivem em catálogo, não na fórmula. **A aritmética final continua com a área de conhecimento (D2)** — fechar a fórmula é reescrever uma expressão na view, não migrar dado. `contribuicao_legisla` não entra até D2 fechar. **Grava:** — (refresh de `mv_iip_contrato`). **Lê:** `fat_fato_gerador` · `ref_tipologia` · `ref_indicador` · `ref_nivel_iip`. **Jornadas:** A6.5 · C.2 · 7.4.1.

**INC-05 · Visão de incidência por mandato** — Ver e editar registros, insights e fatos de um contrato, com o IIP ao lado. É a tela de preparação do Mentor antes do encontro. **Grava:** — (edita via INC-01/02/03). **Lê:** `fat_registro` · `fat_insight` · `fat_fato_gerador` · `rel_fato_origem` · `mv_iip_contrato`. **Jornadas:** C.3 · 7.2.

### Operação (OPR)

> **Como esta camada se organiza.** Por capacidade, não por produto. Etapas, formulários, encontros e artefatos são **product-agnostic e parametrizados por catálogo** — `ref_etapa`, `ref_formulario` e `ref_tipo_registro` carregam `id_produto`, e é o catálogo que diz quais etapas existem e quais formulários abrem em cada produto. Sobra pouco genuinamente específico: OPR-05 (edição de PLL) e OPR-06 (Coalizão). Guarda-chuvas por produto na navegação são decisão de UI, não de modelo.

**OPR-01 · Régua de etapas e instanciação do contrato** — Instanciar o contrato cria o planejamento vazio, a régua completa com **datas previstas** geradas de `ref_etapa.duracao_prevista_dias` e os formulários da etapa. A etapa é fato com previsto e realizado, não status sobrescrito — é essa exigência da Constituição que sustenta carteira ponderada e tempo de ciclo. O Kanban é a superfície de escrita da transição: arrastar o card grava data e autor. **Grava:** `fat_etapa_contrato` · `fat_contrato.id_etapa_atual` · dispara criação de `dim_planejamento` e `rel_formulario_contrato`. **Lê:** `ref_etapa` · `vw_etapa_contrato` (atraso derivado). **Jornadas:** A1.6 · G2.1 · 7.4.1.

**OPR-02 · Formulários: abertura, resposta e métricas** — A Gestora (Estratégia) ou a coordenação (PLL) alterna aberto/fechado por formulário **e** por contrato; o respondente só responde, e reedita enquanto estiver aberto. A submissão guarda **contra qual versão do formulário** foi respondida — sem isso, comparar avaliações entre edições é comparar perguntas diferentes. As perguntas marcadas como métrica são extraídas para tabela própria por trigger; o JSONB continua sendo a verdade da resposta. Os 16 formulários do sistema vivem em catálogo, incluindo os 7 de avaliação. Nenhum acesso é anônimo. **Grava:** `rel_formulario_contrato` · `fat_submissao` · `fat_resposta_metrica` (trigger). **Lê:** `ref_formulario` · `ref_metrica_formulario`. **Jornadas:** A2.3 · A2.5 · A3.1 · A4.8 · A7.4 · B1.5 · B4.4 · B5.3 · B5.4 · D.2 · micro-jornada "abrir/fechar formulário".

**OPR-03 · Encontros: agenda, presença e estado** — O encontro nasce `planejado` com data prevista, passa a `realizado` quando alguém marca presença, e pode ser `cancelado` ou `remarcado`. Presença por pessoa, com origem (Legisla, mandato, externo) — substitui a coluna "Presentes" como texto livre. É o que torna possível responder *a mentoria 3 aconteceu?*, *quantos encontros foram remarcados nesta edição?* e *quais mandatos estão com a agenda parada?* **Grava:** `fat_encontro` · `rel_encontro_participante`. **Lê:** `ref_tipo_registro` · `ref_etapa`. **Jornadas:** A2.2 · A3.3 · A5.2 · A5.6 · A7.2 · B4.5 · B5.1 · micro-jornadas "agendar encontro", "marcar presença", "remarcar/cancelar".

**OPR-04 · Artefatos e anexos** — Uma tabela para todo link e documento do sistema, com escopo polimórfico (contrato, registro, submissão, encontro, etapa) e tipo fechado. Consolida 14 colunas "Link ..." espalhadas por 6 abas das planilhas. **Nenhuma outra feature guarda link em campo próprio.** Durante a transição, os links das bases antigas ficam anexados ao contrato com tipo `planilha_legada`, em vez de virarem colunas mortas. **Grava:** `fat_artefato`. **Lê:** `fat_artefato`. **Jornadas:** A2.5 (termos assinados) · A3.2 (mapa político, até virar feature) · A5.8 (organograma final) · A7.1.

**OPR-05 · Operação da edição de PLL** — O específico do PLL: pareamento mentorado ↔ mentor (o `INSERT` que define o RLS do Mentor), confirmação e desistência de participante com motivo, e a visão agregada da edição — que é `mv_numeros_impacto` filtrada por projeto, já que a edição **é** um projeto. Inscrição de mentorados segue como importação manual na v1. **Grava:** `rel_usuario_contrato` (`papel_no_contrato = 'mentor'`) · `fat_contrato.status`/`motivo_encerramento`. **Lê:** `fat_submissao` (diagnóstico e temáticas) · `mv_numeros_impacto`. **Jornadas:** B1.2 · B1.4 · B2.3 · B3.1 · B3.2 · B5.5.

**OPR-06 · Operação da Coalizão** — Coalizão **sem** planejamento próprio não tem régua: é leitura consolidada dos contratos membros, filtrada por projeto. Coalizão **com** planejamento próprio instancia régua e planejamento como qualquer contrato (OPR-01 \+ PLN-01). **Grava:** via OPR-01 e PLN-01. **Lê:** `dim_coalizao` · `rel_coalizao_membro` · `vw_carteira`. **Jornadas:** G2.1 · G3.1.

> **Especificação incompleta — D9 em aberto.** Não existe seed de `ref_etapa` para o produto Coalizão. A hipótese de trabalho registrada no DDL é clonar a régua da Estratégia, e o `INSERT` está pronto e comentado; enquanto a operação não confirmar, **esta feature não tem régua e não pode ser especificada até o fim**. Não é lacuna de modelo: é decisão de conteúdo pendente.

### Saída (OUT)

**OUT-01 · Números de impacto** — Agregações por contrato para as áreas clientes, com contagem de contratos e ano da primeira contratação calculados por window function — hoje são colunas digitadas que divergem em 46 e 41 contratantes. **Some o filtro de prospecção (D4):** todo contrato é contrato assinado. Nível federativo entra por JOIN com `ref_cargo`, não por coluna. **Grava:** — (refresh). **Lê:** `mv_numeros_impacto`. **Jornadas:** 7.1.1 · A7.5 · B5.5 · G3.1.

**OUT-02 · Visão do mandato** — Drill-down ao clicar no mandato: linha do tempo por contrato, produtos contratados, cadeia de renovação. Uso exclusivo de usuários Legisla. **Grava:** —. **Lê:** `vw_visao_mandato`. **Jornadas:** 7.1.2 · A7.5.

**OUT-03 · Visão gerencial e indicadores** — Saúde da operação, recortes por produto/projeto/edição/Gestora/Mentor, e gargalos. Pendência é **derivada**, nunca digitada: cadastro incompleto, formulário aberto há muito tempo, etapa atrasada, encontro vencido, contrato sem registro recente e sucesso mensal vencido saem todos de uma view. Os indicadores de gestão estão no **escopo inicial**, construídos como feature sobre a Saída — não importados da arquitetura de planilhas atual. **Grava:** —. **Lê:** `vw_pendencias` · `vw_etapa_contrato` · `vw_carteira` · `mv_iip_contrato` · `fat_snapshot_mensal`. **Jornadas:** 7.3 · 7.4.1 · 7.4.2 · 7.4.3.

> **Limiares fixos na v1 — exceção registrada.** O "N dias" de formulário aberto (30) e de contrato sem registro (45) fica escrito em `vw_pendencias`, e o peso de etapa que o indicador G1 exige para ponderar carteira não existe em `ref_etapa` — G1 roda sem ponderação na v1. Mudar qualquer um dos três é alterar view ou schema, não configuração. É exceção consciente à regra da Constituição de que limiar vive em tabela editável; entra em atualização futura, não bloqueia nada.

**OUT-04 · Exportação de relatórios** — Google Sheets/CSV, com limite de taxa próprio e mais restritivo, via função de servidor. É a operação que mais expõe dado consolidado de uma vez. **Grava:** —. **Lê:** `mv_numeros_impacto` e demais views autorizadas. **Jornadas:** 7.1.3 · 7.4.4.

**OUT-05 · Carteira (analytics)** — Uma tela, dois públicos: Gestora vê a sua carteira, Mentor vê a dele, e o recorte é garantido pelo RLS — não por duas telas. Atingimento, IIP, último registro e etapa atual por contrato. Carteira não é tabela: é `rel_usuario_contrato` com vínculo ativo. **Grava:** —. **Lê:** `vw_carteira` · `fat_snapshot_mensal` (evolução). **Jornadas:** 7.2 · C.2.

**OUT-06 · Snapshot mensal (fechamento)** — Job que fotografa cada contrato ao fim do mês: atingimento, IIP, contagens do mês e etapa em que estava. Coluna materializada guarda o valor de agora; **série histórica exige fato próprio**. Sem isso, "evolução no tempo" e "atingimento estagnado" seriam reconstruídos varrendo o log de auditoria — caro, frágil e incompleto. **Grava:** `fat_snapshot_mensal`. **Lê:** `dim_planejamento` · `mv_iip_contrato` · `fat_registro` · `fat_fato_gerador` · `fat_insight` · `fat_etapa_contrato`. **Jornadas:** C.2 · 7.4.1 · 7.4.3.

> **Exceção declarada à fronteira da camada.** A Saída não altera dado de origem e continua sem recalcular métrica: este job **não interpreta nada**, apenas copia para a linha do mês valores já calculados em outro lugar. A divisão é limpa — carteira ponderada e tempo de ciclo continuam derivados das datas de transição de etapa (`fat_etapa_contrato`), e o snapshot cobre atingimento e IIP, que não são deriváveis de transição. É a única escrita autorizada na camada de Saída, e o texto da Constituição §2.6 foi ajustado para refleti-la.

**OUT-07 · Avaliações e NPS** — NPS e médias por critério deixam de ser planilha calculada e viram agregação sobre tabela. Uma pergunta por formulário pode ser a de recomendação; o rótulo é estável mesmo quando o enunciado muda entre edições — é isso que permite comparar a avaliação do PLL 4 com a do PLL 5\. **Grava:** — (refresh). **Lê:** `mv_avaliacao_nps` · `ref_metrica_formulario`. **Jornadas:** B5.3 · B5.4 · A4.8 · A7.4 · 7.3.

### Integrações (INT)

**INT-01 · Google Calendar/Meet** — Adaptador apenas. Cria e espelha o evento e guarda o identificador externo e a URL da reunião no encontro. **A máquina de estado do encontro é OPR-03, não esta feature** — a falha da integração não pode derrubar a operação, e o estado do encontro é dado do sistema, não do Google. **Grava:** `fat_encontro.id_externo_calendar`/`url_meet` · `rel_integracao_contrato` (`calendar_agenda`). **Jornadas:** A2.2 · A3.3 · A5.2 · micro-jornada "agendar encontro".

**INT-02 · Slack** — Cria e atualiza o canal do mandato e guarda a referência. Os comandos `/registro - <etapa>` **não existem no sistema**: o registro é formulário nativo. `fat_registro.canal = 'slack'` continua existindo para o histórico migrado. **Grava:** `rel_integracao_contrato` (`slack_canal`). **Jornadas:** A1.5.

**INT-03 · Importação TSE (ETL)** — Carga idempotente por safra no schema read-only, particionada por ano. Nunca contém CPF, nunca entra em JOIN transacional — a operação consulta apenas a materialized view de resumo. O match com o mandato é escrito por FND-01, não aqui. **Grava:** `tse.dim_candidatura` · `tse.fat_votacao_zona` · `tse.dim_perfil_eleitorado` · `tse.rel_rede_social` · refresh de `tse.mv_candidatura_resumo`. **Jornadas:** A1.1 (insumo).

**INT-04 · Migração das planilhas legadas** — Carga única, com mapa origem→destino, resolução das três chaves legadas que hoje convivem e queries de validação. Descartável ao fim. **Grava:** `stg.map_legado` e, por meio dele, as tabelas de destino. **Jornadas:** — (projeto, não operação).

---

## 2\. Relação Feature ↔ Camada

| ID | Feature | Camada | Natureza | Apoia-se em |
| :---- | :---- | :---- | :---- | :---- |
| PLT-01 | Controle de acesso (RBAC) | Plataforma | Base | — |
| PLT-02 | Log de auditoria | Plataforma | Base | PLT-01 |
| PLT-03 | RLS e LGPD | Plataforma | Base | — |
| PLT-04 | Impersonação do Admin | Plataforma | Base | PLT-01, PLT-02 |
| FND-01 | Cadastro de contratantes e mandatos | Fundação | Base | PLT, FND-05, INT-03 |
| FND-02 | Cadastro e gestão de coalizões | Fundação | Base | FND-01, FND-04 |
| FND-03 | Cadastro e gestão de usuários | Fundação | Base | PLT-01 |
| FND-04 | Contrato: abertura, ciclo e renovação | Fundação | Base | FND-01, FND-05 |
| FND-05 | Catálogos e parâmetros | Fundação | Base | PLT-01 |
| PLN-01 | Planejamento do contrato | Planejamento | Transversal | FND-04, FND-05 |
| PLN-02 | Ciclo mensal de atingimento | Planejamento | Transversal | PLN-01 |
| PLN-03 | GIP · diagnóstico do gabinete | Planejamento | Transversal | FND-04, FND-05 |
| INC-01 | Registros por etapa | Incidência | Transversal | OPR-01, OPR-03 |
| INC-02 | Insights | Incidência | Transversal | INC-01, PLN-01 |
| INC-03 | Fatos Geradores | Incidência | Transversal | FND-05, PLN-01, INC-02 |
| INC-04 | IIP | Incidência | Transversal | INC-03, FND-05 |
| INC-05 | Visão de incidência por mandato | Incidência | Transversal | INC-01/02/03/04 |
| OPR-01 | Régua de etapas e instanciação | Operação | Produto (parametrizado) | FND-04, FND-05 |
| OPR-02 | Formulários: abertura, resposta, métricas | Operação | Produto (parametrizado) | FND-05, PLT-01 |
| OPR-03 | Encontros: agenda, presença e estado | Operação | Transversal | FND-04, INT-01 |
| OPR-04 | Artefatos e anexos | Operação | Transversal | FND-04 |
| OPR-05 | Operação da edição de PLL | Operação | Produto | OPR-01/02, PLN-01 |
| OPR-06 | Operação da Coalizão *(incompleta — D9)* | Operação | Produto | FND-02, OPR-01, PLN-01 |
| OUT-01 | Números de impacto | Saída | Saída | FND-01, FND-04 |
| OUT-02 | Visão do mandato | Saída | Saída | OUT-01 |
| OUT-03 | Visão gerencial e indicadores | Saída | Saída | OUT-05, OUT-06, INC-04 |
| OUT-04 | Exportação de relatórios | Saída | Saída | OUT-01 |
| OUT-05 | Carteira (analytics) | Saída | Saída | PLT-01, INC-04 |
| OUT-06 | Snapshot mensal (fechamento) | Saída | Saída | PLN-02, INC-04 |
| OUT-07 | Avaliações e NPS | Saída | Saída | OPR-02 |
| INT-01 | Google Calendar/Meet | Integrações | Integração | OPR-03 |
| INT-02 | Slack | Integrações | Integração | FND-04 |
| INT-03 | Importação TSE (ETL) | Integrações | Integração | — |
| INT-04 | Migração das planilhas legadas | Integrações | Integração | todas as de escrita |

---

## 3\. Rastreabilidade feature → tabela → jornada

Teste de cobertura inverso ao da §3 do `modelo_dados_v4.md`. Duas leituras obrigatórias: **toda feature aponta para tabela que existe no schema** e **toda tabela do v4 tem pelo menos uma feature que a escreve**.

| Feature | Grava | Lê | Jornada(s) |
| :---- | :---- | :---- | :---- |
| PLT-01 | `dim_usuario` · `rel_usuario_contrato` | as mesmas | todas · B3.2 · E.1 |
| PLT-02 | `log_auditoria` | `log_auditoria` | A5.1 · A6.x · E.4 · 7.4.5 |
| PLT-03 | — | `rel_usuario_contrato` | todas |
| PLT-04 | `log_auditoria` (`id_usuario_impersonado`) | `dim_usuario` | E.3 |
| FND-01 | `dim_contratante` · `dim_mandato` · `rel_mandato_candidatura` | `tse.mv_candidatura_resumo` · `ref_partido` · `ref_cargo` | A1.1 · G1.1 |
| FND-02 | `dim_coalizao` · `rel_coalizao_membro` | `ref_projeto` · `fat_contrato` | G1.2 · G1.3 · G1.4 · G2.2 |
| FND-03 | `dim_usuario` · `rel_usuario_contrato` | as mesmas | A1.3 · A1.4 · A4.6 · B1.3 · B2.2 · G1.5 · D.1 |
| FND-04 | `fat_contrato` | `ref_produto` · `ref_projeto` · `ref_cargo` · `ref_partido` | A1.2 · B1.4 · A7.5 · G1.1 |
| FND-05 | `ref_produto` · `ref_projeto` · `ref_etapa` · `ref_tipo_registro` · `ref_formulario` · `ref_metrica_formulario` · `ref_preditor` · `ref_agenda_tematica` · `ref_perfil_atuacao` · `ref_pilar_insight` · `ref_tipologia` · `ref_indicador` · `ref_nivel_iip` · `ref_dimensao_gip` · `ref_partido` · `ref_cargo` | os mesmos | transversal |
| PLN-01 | `dim_planejamento` · `rel_planejamento_preditor` · `fat_objetivo_especifico` · `fat_meta` · `fat_sucesso_mensal` | `ref_preditor` · `ref_agenda_tematica` · `ref_perfil_atuacao` | A3.6 · A3.7 · A4.2–A4.7 · A5.1 · B4.1–B4.3 · G2.1 |
| PLN-02 | `fat_sucesso_mensal` · cascata em `fat_meta`/`fat_objetivo_especifico`/`dim_planejamento` | `vw_sucesso_mensal` | A6.1 · B5.2 · C.6 · D.4 |
| PLN-03 | `fat_gip` · `fat_gip_dimensao` | `ref_dimensao_gip` · `vw_gip_evolucao` | A3.8 · A6.6 · A7.3 |
| INC-01 | `fat_registro` | `ref_tipo_registro` · `fat_encontro` | A2.4 · A3.4/5 · A4.9 · A5.3/6/7 · A6.2 · A7.2 · B4.5 · B5.1 · C.5 |
| INC-02 | `fat_insight` · `rel_insight_origem` | `ref_pilar_insight` · `fat_registro` | A6.3 · B5.1 · C.5 |
| INC-03 | `fat_fato_gerador` · `rel_fato_origem` | `ref_tipologia` · `ref_nivel_iip` · `ref_preditor` | A6.4 · B5.1 · C.5 |
| INC-04 | refresh `mv_iip_contrato` | `fat_fato_gerador` · `ref_indicador` · `ref_nivel_iip` | A6.5 · C.2 · 7.4.1 |
| INC-05 | — | `fat_registro` · `fat_insight` · `fat_fato_gerador` · `mv_iip_contrato` | C.3 · 7.2 |
| OPR-01 | `fat_etapa_contrato` · `fat_contrato.id_etapa_atual` | `ref_etapa` · `vw_etapa_contrato` | A1.6 · G2.1 · 7.4.1 |
| OPR-02 | `rel_formulario_contrato` · `fat_submissao` · `fat_resposta_metrica` | `ref_formulario` · `ref_metrica_formulario` | A2.3/5 · A3.1 · A4.8 · A7.4 · B1.5 · B4.4 · B5.3/4 · D.2 |
| OPR-03 | `fat_encontro` · `rel_encontro_participante` | `ref_tipo_registro` · `ref_etapa` | A2.2 · A3.3 · A5.2/6 · A7.2 · B4.5 · B5.1 |
| OPR-04 | `fat_artefato` | `fat_artefato` | A2.5 · A3.2 · A5.8 |
| OPR-05 | `rel_usuario_contrato` · `fat_contrato.status`/`motivo_encerramento` | `fat_submissao` · `mv_numeros_impacto` | B1.2/4 · B2.3 · B3.1/2 · B5.5 |
| OPR-06 | via OPR-01 e PLN-01 | `dim_coalizao` · `rel_coalizao_membro` · `vw_carteira` | G2.1 · G3.1 |
| OUT-01 | refresh `mv_numeros_impacto` | `mv_numeros_impacto` · `vw_contrato` | 7.1.1 · A7.5 · B5.5 · G3.1 |
| OUT-02 | — | `vw_visao_mandato` | 7.1.2 · A7.5 |
| OUT-03 | — | `vw_pendencias` · `vw_etapa_contrato` · `vw_carteira` · `mv_iip_contrato` · `fat_snapshot_mensal` | 7.3 · 7.4.1–7.4.3 |
| OUT-04 | — | `mv_numeros_impacto` | 7.1.3 · 7.4.4 |
| OUT-05 | — | `vw_carteira` · `fat_snapshot_mensal` | 7.2 · C.2 |
| OUT-06 | `fat_snapshot_mensal` | `dim_planejamento` · `mv_iip_contrato` · `fat_registro` · `fat_fato_gerador` · `fat_insight` · `fat_etapa_contrato` | C.2 · 7.4.1/3 |
| OUT-07 | refresh `mv_avaliacao_nps` | `fat_resposta_metrica` · `ref_metrica_formulario` | A4.8 · A7.4 · B5.3/4 · 7.3 |
| INT-01 | `fat_encontro` (campos de integração) · `rel_integracao_contrato` | `fat_encontro` | A2.2 · A3.3 · A5.2 |
| INT-02 | `rel_integracao_contrato` | — | A1.5 |
| INT-03 | `tse.dim_candidatura` · `tse.fat_votacao_zona` · `tse.dim_perfil_eleitorado` · `tse.rel_rede_social` · refresh `tse.mv_candidatura_resumo` | — | A1.1 |
| INT-04 | `stg.map_legado` \+ destinos | planilhas legadas | — |

### 3.1 Teste de cobertura — toda tabela tem escritor

| Camada | Tabela | Feature que escreve |
| :---- | :---- | :---- |
| TSE | `tse.dim_candidatura` · `tse.fat_votacao_zona` · `tse.dim_perfil_eleitorado` · `tse.rel_rede_social` | INT-03 |
| Vínculo TSE | `rel_mandato_candidatura` | FND-01 |
| Catálogos | os 16 `ref_` | FND-05 (+ seed inicial no DDL) |
| Plataforma | `dim_usuario` | FND-03, INT-04 |
| Plataforma | `rel_usuario_contrato` | FND-03, PLT-01, OPR-05 |
| Plataforma | `log_auditoria` | PLT-02, PLT-04 |
| Fundação | `dim_contratante` · `dim_mandato` | FND-01 |
| Fundação | `dim_coalizao` · `rel_coalizao_membro` | FND-02 |
| Âncora | `fat_contrato` | FND-04 (+ OPR-01 na etapa atual, OPR-05 no status) |
| Operação | `fat_etapa_contrato` | OPR-01 |
| Operação | `rel_formulario_contrato` · `fat_submissao` · `fat_resposta_metrica` | OPR-02 |
| Operação | `fat_encontro` · `rel_encontro_participante` | OPR-03 (+ INT-01 nos campos externos) |
| Operação | `rel_integracao_contrato` | INT-01, INT-02 · **lacuna:** `drive_pasta` sem provisionador |
| Operação | `fat_artefato` | OPR-04 |
| Planejamento | `dim_planejamento` · `rel_planejamento_preditor` · `fat_objetivo_especifico` · `fat_meta` | PLN-01 |
| Planejamento | `fat_sucesso_mensal` | PLN-01 (criação), PLN-02 (atualização) |
| Planejamento | `fat_gip` · `fat_gip_dimensao` | PLN-03 |
| Incidência | `fat_registro` | INC-01 |
| Incidência | `fat_insight` · `rel_insight_origem` | INC-02 |
| Incidência | `fat_fato_gerador` · `rel_fato_origem` | INC-03 |
| Saída | `fat_snapshot_mensal` | OUT-06 |
| Saída | `mv_numeros_impacto` · `mv_iip_contrato` · `mv_avaliacao_nps` | OUT-01 · INC-04 · OUT-07 (refresh) |
| Saída | `vw_contrato` · `vw_etapa_contrato` · `vw_sucesso_mensal` · `vw_visao_mandato` · `vw_carteira` · `vw_gip_evolucao` · `vw_pendencias` | derivadas — sem escrita, lidas por OUT-01/02/03/05, PLN-02, PLN-03 |
| Staging | `stg.map_legado` | INT-04 |

**Resultado:** nenhuma tabela do v4 fica sem escritor e nenhuma feature aponta para tabela inexistente. Uma única lacuna de escrita: `rel_integracao_contrato` aceita `tipo = 'drive_pasta'` e nenhuma feature provisiona pasta de Drive na v1 — hoje só a migração escreve esse valor. Aceito para atualização futura (§4.3).

---

## 4\. Decisões e pendências

### 4.1 Decidido no fechamento desta versão

| \# | Assunto | Decisão | Consequência |
| :---- | :---- | :---- | :---- |
| 1 | Parâmetros dos indicadores (OUT-03) | **Valores fixos na v1.** Os 30 e 45 dias ficam em `vw_pendencias`; G1 roda sem ponderação por etapa | Exceção consciente à regra constitucional de limiar em tabela editável. Mudar limiar é alterar a view. Entra em atualização futura |
| 2 | Fronteira da camada de Saída (OUT-06) | **Exceção declarada.** O job de fechamento escreve `fat_snapshot_mensal`; é a única escrita autorizada na Saída, e não recalcula métrica | Texto da Constituição §2.6 ajustado fora deste documento |
| 3 | Prospecção (D4) | **Não entra.** Nenhuma feature de cadastro ou pipeline pré-contrato | O sistema não guarda material anterior à assinatura. Se a operação precisar, volta como **tabela própria** — nunca como status de `fat_contrato` |
| 4 | Estrutura da camada de Operação | Organizada por capacidade, não por produto | Guarda-chuvas por produto na navegação são decisão de UI; as tabelas não mudam |
| 5 | Divergências entre `modelo_dados_v4.md` e `schema_v4.sql` | **O DDL vence** | Features referenciam `regua_sonhos`, `rel_coalizao_membro.id_contrato` e `vw_contrato` para nível federativo (§5) |

### 4.2 Em aberto — bloqueia especificação

**D9 · Régua da Coalizão (OPR-06).** Não existe seed de `ref_etapa` para o produto Coalizão. **É a única feature deste documento sem especificação completa.** Enquanto não fechar, Coalizão com planejamento próprio não tem régua de execução; a hipótese registrada no DDL é clonar a régua da Estratégia, e o `INSERT` está pronto e comentado na §16. Coalizão **sem** planejamento próprio não é afetada — é leitura consolidada, e já está especificada.

### 4.3 Aceito para atualizações futuras — não bloqueia nada

| Assunto | Situação hoje | O que falta |
| :---- | :---- | :---- |
| **D2 · Aritmética do IIP** (INC-04) | `mv_iip_contrato` expõe D1, D2 e D3 separados e um total provisório | A fórmula da área de conhecimento. Fechar é reescrever uma expressão na view. Até lá, a tela rotula o número como provisório |
| **Limiares e peso de etapa** (OUT-03) | Fixos na view (§4.1) | `peso_carga` em `ref_etapa` e um catálogo de limiares |
| **`drive_pasta` sem provisionador** | `rel_integracao_contrato` aceita o tipo; só a migração o escreve | Decidir se o provisionamento entra em INT-02 ou se o tipo sai do CHECK |
| **Mapa Político e Diagnóstico de Organograma** | Externos. O sistema guarda o link em `fat_artefato` e as pessoas do gabinete em `rel_usuario_contrato` | O schema de campos da área de conhecimento. Cada um entra como feature própria, sem alterar camadas |
| **Importação do Mural** (A4.T) | Digitação manual pela Gestora | Feature de importação de CSV. É o gargalo manual conhecido da v1 |
| **`legisla_aliada`** (D8) | Ativo em `ref_tipo_registro`, logo é tipo válido de INC-01 | Confirmar com a operação se ainda roda |
| **Ocorrências e controle de planilhas legadas** | Sem tabela e sem feature | Escopo a definir, se a operação confirmar a necessidade |

---

## 5\. Notas

- **`schema_v4.sql` é a fonte de verdade** onde divergir de `modelo_dados_v4.md`. Três pontos conferidos: `fat_gip_dimensao.eixo` grava `regua_sonhos` (o documento diz `regua`) · `rel_coalizao_membro` tem a coluna `id_contrato` (o documento diz `id_contrato_membro`) · `fat_contrato.nivel_federativo` não existe como coluna — lê-se de `vw_contrato` ou `mv_numeros_impacto`.  
- **Nenhum acesso é anônimo.** Formulário respondível por link público não existe: o respondente é sempre usuário com login e cargo. Vale para OPR-02 e para as avaliações.  
- **Nenhum número de gestão sai de tabela transacional.** OUT-01 a OUT-07 leem view ou materialized view. `mv_numeros_impacto` e `mv_iip_contrato` não respeitam RLS — o acesso é por GRANT a papéis Legisla, e `vw_carteira` só as usa depois de já ter restringido as linhas.  
- **Ausência é NULL.** Nenhuma feature grava "Pendente de Atualização" ou equivalente; o domínio `texto_limpo` recusa no banco. Pendência é derivada em `vw_pendencias` (OUT-03).  
- **Plano e realizado são colunas diferentes** em etapa, encontro e sucesso mensal. Nenhuma feature digita atraso: dias de atraso são derivados em `vw_etapa_contrato`, `vw_sucesso_mensal` e `vw_pendencias`.  
- **Nenhuma feature é construída sem spec aprovada.** Este documento lista capacidades; cada uma ainda passa por Specify → Design → Tasks → Execute.

