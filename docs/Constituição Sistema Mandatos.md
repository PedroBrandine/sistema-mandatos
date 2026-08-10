## **1.1 Visão geral**

Sistema de Operações (Mandatos) — Legisla Brasil

Dentro da grande área de **Operações**, a frente de **Mandatos** entrega três produtos de consultoria: **Estratégia**, **PLL** (Programa de Lideranças Legislativas) e **Coalizões**. O time de **Monitoramento** — dono deste sistema — é **transversal**: as demais áreas internas são clientes dos dados que ele consolida.

### **1.2 O problema**

Hoje a operação inteira vive espalhada em dezenas de planilhas conectadas por google apps scritp: uma folha de planejamento por mandato, bases de registros alimentadas pelo Slack via automações, uma base separada de fatos geradores com suas tipologias, bases próprias de PLL e de Estratégia

### **1.3 A visão**

Um único ambiente relacional que se torna a **fonte de verdade de cada mandato e de cada produto**. Nele:

* um mandato é cadastrado **uma vez** e carrega seus contratos, seu planejamento, sua incidência e seu histórico;  
* a operação de cada produto acontece **dentro do sistema**, de ponta a ponta;  
* registros, insights e fatos geradores são capturados **no momento em que acontecem** — cada um via formulário — e se conectam ao plano;  
* os números de impacto, o IIP e as visões de gestão saem de **consultas sobre uma base governada**, não de consolidação manual.

O sistema substitui a colcha de retalhos de planilhas **sem perder a granularidade** que o time já tem hoje.

## **2\. As Camadas do Projeto**

A arquitetura se organiza em **7 camadas**, por altitude e por alcance (transversal vs. específico). Cada camada declara o que faz, o que contém e o que **não** faz.

Regra de dependência: uma camada só depende de camadas abaixo dela ou transversais; nunca de camadas acima.

\!image.png

### **2.1 Plataforma · *substrato transversal***

* **Propósito:** segurança, identidade e auditoria.  
* **Contém:** controle de acesso por papéis (RBAC — §3), logs de usuários e **RLS desde o schema** (conforme §3 RBAC). **LGPD incide só sobre o cadastro de usuários** (Gestoras, Mentores/Consultores, Assessores), onde há dado pessoal/sensível — o mandato não carrega dado LGPD (é público/TSE ou gerado pela Legisla).  
* **Fronteiras:** nenhuma lógica de produto nem de cálculo. *A administração do RBAC, integrações e usuários é função do papel Admin do Sistema (ver §3) — não das Gestoras. O Admin pode assumir a visão de qualquer papel (Gestora, Mentor/Consultor, Assessor) para fins de suporte e debug, com essa ação registrada em log de auditoria.*

### **2.2 Fundação — entidades & pessoas**

* **Propósito:** definir quem e o quê existe no sistema e como se vinculam.  
* **Contém:** cadastro de mandatos (importação TSE \+ manual), cadastro de coalizões, cadastro e gestão de usuários. Estabelece os três vínculos de primeira classe do mandato: **Produto**, **Projeto** e **Coalizão**. Projeto nasce na Área de **Captação** e deve ser cadastrado no Sistema, pode ou não originar Coalizão. Em **todos os produtos** deve ser possível excluir, editar e substituir o assessor.  
* Nota curta: a inscrição do assessor mentorado do PLL é **importada manualmente** e vinculada ao mandato **manualmente** (sem conexão automática na v1).  
* **Infraestrutura:** o núcleo dimensional descrito em §4.  
* **Fronteiras:** não opera produto e não calcula impacto — apenas registra e vincula.

### **2.3 Planejamento & Monitoramento · *transversal, instanciado por produto***

* **Propósito:** o planejamento estratégico dos mandatos e seu acompanhamento. É o pilar de trabalho diário de Gestoras, Consultores, Mentores e Assessores.  
* **Contém, por produto (features separadas):** a hierarquia **Objetivo Específico → Meta → Sucesso Mensal**, o **cálculo de atingimento** e o **dashboard**. A Meta carrega **Preditor Primário e Secundário, S**inalização de prioridade, Agenda Temática e se é Programática ou de Governança; o Sucesso Mensal carrega **Peso** e **% de atingimento**.  
* **Regra de atingimento (cascata):** % do Sucesso Mensal (ponderada pelo Peso) → **Meta** → **Objetivo Específico** (média das Metas) → **Planejamento** (média dos Objetivos Específicos).  
* **Decisão de design:** o planejamento é **um único conjunto de tabelas**, discriminado pelo produto do contrato — não uma feature por produto. As hierarquias de Estratégia, PLL e Coalizão são idênticas (Objetivo Específico → Meta → Sucesso Mensal); a diferença real é de preenchimento, não de estrutura: na Estratégia a Meta carrega Preditor Primário **e** Secundário, no PLL apenas o Primário. Separar em tabelas por produto duplicaria a cascata de atingimento e a política de RLS sem ganho — três cópias da mesma regra para manter em sincronia.  
* **O que varia por produto** é a *variação de preenchimento* (campos obrigatórios, quais etapas existem, quais formulários abrem), declarada em tabela de referência — não em schema paralelo.  
* **Fronteiras:** consome os vínculos da Fundação; não reimplementa cadastro nem incidência.


### **2.4 Incidência · *transversal, pendura no mandato***

* **Propósito:** registrar a ação política de cada mandato e derivar a métrica de densidade.  
* **Contém um bloco integrado:** **Registros** por etapa (cada etapa é um formulário, com metadados de auditoria), **Insights** (vinculados ao registro que os originou), **Fatos Geradores** (validados por uma tabela de **Tipologias** e vinculáveis a Metas do planejamento, ou sem origem) e o **IIP** — a **única** métrica calculada, produzida a partir dos status D1/D2/D3 dos fatos, ponderados pela tabela de **Indicadores** ("Peso no IIP %").  
* **Fronteiras:** não conhece etapas de produto (só recebe o vínculo); é lançada por quem a Plataforma autoriza.

### **2.5 Operação dos produtos**

* **Propósito:** o fluxo de trabalho específico de cada produto.  
* **Contém:**  
  * **Estratégia** — etapas (Pontapé → Raio-X → Imersão → Organograma/Governança → Monitoramento → Replicação), com registro por etapa e visão agregada dos ativos.  
  * **PLL** — inscrição do assessor mentorado, formulários (f1/f2), imersão e mentorias, com visão agregada da edição.  
  * **Coalizões** — agrupamento de mandatos via Projeto. **Pode ter planejamento estratégico próprio** (secretaria executiva/grupos) ou não; quando não tem, é uma **visão filtrada por Projeto** sobre os mandatos membros, cada um com seu planejamento de Estratégia (o Projeto carrega a temática — ex.: Imagina 1 e 2).  
  * **Kanban de etapas** — superfície de escrita da transição de etapa, transversal aos três produtos: arrastar o card entre colunas grava a transição com data e autor no fato de etapa (§2.6, requisito estrutural). Colunas são as etapas do produto, cards são os contratos, com recorte por Gestora, Mentor, produto e projeto. É consumido como leitura pela Saída, que não escreve.  
  * Cada formulário é uma **página respondível no sistema** (não upload do Sheets), editável pelo respondente; a Gestora **abre/fecha por formulário e por mandato** ("Organograma aberto/fechado"). Os formulários serão elencados em features  
* **Em evolução — deferimento explícito.** Quatro artefatos dependem de definição da **área de conhecimento** e por isso **não entram no escopo inicial**: **Mapa Político** (Raio-X, Estratégia e PLL), **Relatório de Diagnóstico de Organograma** (Estratégia). Sem data ainda e não interfere no sistema.  
* Regra de deferimento: cada um permanece como **passo externo ao sistema** (feito na ferramenta atual, resultado anexado ao mandato) até que a área de conhecimento entregue o schema de campos. Nenhum deles bloqueia a Definição de Pronto (§6). Enquanto o schema não existir, o sistema **armazena o resultado, não o método** — anexo ou campo de texto livre, nunca uma estrutura inventada por antecipação.  
* Quando o schema chegar, cada artefato entra como feature própria com spec, sem alterar as camadas.  
* **Fronteiras:** cada produto **usa** Planejamento e Incidência — não os reimplementa.

### **2.6 Saída — impacto & relatórios**

* **Propósito:** entregar dados consolidados para fora do time de Monitoramento.  
* **Contém:**  
  * **Números de impacto** — agregações sobre dim\_Mandato \+ fat\_Contrato, consultáveis pelas áreas clientes. **Tabelas ou views por produto são obrigatórias** para sustentar as páginas de gestão.  
  * **Visão do mandato** — ao clicar em um mandato na página de números de impacto, abre-se uma visão consolidada dele (linha do tempo por mês/ano, balões dos produtos contratados, caminho clicável). **Uso exclusivo de usuários Legisla**; não se confunde com a jornada do assessor.  
  * **Visão gerencial** — gestão do time e dos produtos, sustentada pelos **indicadores** e pelas **visões operacionais** abaixo. Entram no escopo inicial (não são fase posterior) e são **construídos como feature sobre a camada de Saída** — não importados da arquitetura de planilhas atual.   
  * **Exportação** — relatórios em Google Sheets/CSV.

> ### **Indicadores de gestão**

Todo indicador tem duas leituras obrigatórias: **estado atual** e **evolução mensal**. A evolução vem de duas fontes, conforme a natureza do indicador:

* **Derivada** — carteira ponderada (G1) e tempo de ciclo (G2) saem das **datas de transição de etapa**, que são fato com data de entrada e saída. Não há snapshot envolvido, e o requisito estrutural abaixo continua valendo integralmente.  
* **Fotografada** — atingimento do planejamento e IIP não são deriváveis de transição de etapa: são valores que mudam por edição e por lançamento, e cuja coluna materializada guarda apenas o valor de agora. Sua série histórica exige **fato-snapshot periódico** (`fat_snapshot_mensal`), escrito por job no fechamento do mês.  
  **Fronteiras da camada.** A Saída **não altera dado de origem** e **não recalcula métrica** — o IIP aparece aqui como leitura e é calculado na Incidência (§2.4). Existe **uma única escrita autorizada** nesta camada: o job de fechamento mensal, que copia para a linha do mês valores já calculados em outro lugar, sem interpretá-los. Qualquer outra escrita na Saída é violação da camada. 

> 

> **G1 · Carteira e carga por Gestora** *Por que importa:* identificar desequilíbrio de carga real. Uma Gestora com 8 mandatos em imersão simultânea tem carga muito diferente de uma com 8 em monitoramento. *Cálculo:* nº de contratos ativos por Gestora, **ponderado pelo peso da etapa** (imersão pesa mais que monitoramento). O peso por etapa é configurável em tabela de referência. *Cortes:* mesma leitura para Mentor. Atingimento médio da carteira como indicador acessório. *Evolução:* carteira ponderada mês a mês — expõe concentração de carga em períodos específicos do ano (é o que permite planejar imersões sem empilhar três na mesma semana da mesma Gestora).

> **G2 · Tempo de ciclo entre etapas** *Por que importa:* identificar onde o processo trava sistematicamente — se o gargalo está no diagnóstico, na imersão ou no monitoramento, e se varia por Gestora ou por produto. *Cálculo:* data de entrada na etapa seguinte − data de entrada na etapa anterior; **mediana** por etapa, por mandato, por Gestora e por produto. *Evolução:* mediana mensal por etapa — mostra se o processo está acelerando ou desacelerando ao longo do ano.

> **G3 · Cobertura de registro** Contratos sem registro há mais de N dias; etapas realizadas sem registro lançado.

> **G4 · Formulários** Taxa de resposta por formulário × mandato; formulários abertos há mais de N dias.

> **G5 · Atingimento** % de atingimento por produto, projeto e período; Sucessos Mensais não atualizados no mês corrente.

> **G6 · Completude de cadastro** Campos pendentes por mandato — derivados de ausência de dado, nunca digitados.

> ### **Visões operacionais de gestão**

> * **Kanban de etapas** — colunas são as etapas do produto, cards são os contratos, com recorte por Gestora, Mentor, produto e projeto. É a leitura de "quem está com o quê, e onde cada mandato está". **Não é tela desta camada:** o Kanban é feature de Operação (§2.5) e é lá que a transição de etapa é escrita — ver nota de decisão ao final desta seção. Aparece aqui porque é a superfície de gestão que consome o mesmo dado.  
> * **Calendário** — encontros agendados por carteira e por mandato, espelhados da integração de Calendar (§2.7). É a leitura de carga da semana, complementar ao G1 que dá a carga do mês.

> ### **Regras da camada**

> * **Parametrização.** Todo limiar (o "N dias" de G3 e G4, o tempo esperado por etapa de G2, o peso de etapa de G1) vive em **tabela de referência editável**, nunca no código nem na query. Mudar o peso da imersão é configuração, não deploy.  
> * **Recorte.** Todos os indicadores são filtráveis por **produto, projeto, edição, Gestora e Mentor** — os mesmos vínculos de primeira classe da Fundação (§2.2).  
> * **Métrica calculada em um só lugar.** O IIP aparece aqui como leitura; é calculado na Incidência (§2.4). A Saída não recalcula métrica.  
> * **Fronteiras.** Só lê e agrega; não altera dado de origem. Nenhum indicador é consultado direto em tabela transacional — sempre via view ou tabela da camada Saída.

> ### **Requisito estrutural que estes indicadores impõem**

> G1 e G2 só existem se a **etapa for um fato com data de entrada e saída**, não um campo de status atual sobrescrito. O mandato precisa carregar seu histórico de transições de etapa; sem isso não há mediana de tempo de ciclo nem carteira ponderada retroativa. Esta é uma exigência da Constituição ao modelo de dados (§4).

**Decisão fechada — quem escreve a transição de etapa.** O Kanban é a superfície natural para isso: arrastar um card de "Raio-X" para "Imersão" grava a transição com data e autor. Se essa escrita não estiver no Kanban, ela vira um campo de formulário que alguém esquece de preencher — e G1 e G2 morrem por falta de dado. **O Kanban é, portanto, feature de Operação dos produtos (§2.5), com escrita — não uma tela só de leitura na Saída.** A Saída consome a transição já gravada; continua valendo que ela não escreve (§2.6). Registrada como AD-023 em `.specs/STATE.md`.

**Nota sobre G3 e G4:** são os dois indicadores que medem o próprio sistema, não os mandatos. São eles que dizem se a Definição de Pronto está sendo cumprida na prática ou se a operação voltou para as planilhas por baixo do pano. Merecem lugar no topo da tela gerencial.

*   
* **Fronteiras:** só lê e agrega; não altera dado de origem.

### **2.7 Integrações · *adaptadores externos***

* **Propósito:** sincronizar com ferramentas externas.  
* **Contém:** **Google Calendar/Meet** (agendar/espelhar eventos) e **Slack** (criar e atualizar canais dos mandatos). *(Hoje o Slack também alimenta os registros via automações; no sistema, os formulários passam a ser nativos.)*  
* **Fronteiras:** cada integração é isolada; sua falha não derruba a operação.

## **3\. Modelo de acesso (RBAC)**

Quatro papéis. O parlamentar não é papel — é registro.

| Papel | Quem é | O que pode |
| ----- | ----- | ----- |
| **Gestora de Mandato** | Funcionária interna da Legisla | **Vê e edita tudo** — todos os planejamentos de todos os produtos. Carteira própria. Cadastra/edita mandatos; lança registros, fatos geradores e insights em cada produto. |
| **Mentor / Consultor** | Externo, contratado para tocar mandatos | Vê **apenas** os planejamentos vinculados ao seu nome. Carteira própria. |
| **Assessor do mandato** | Pessoa do gabinete | Vê **apenas** a Planilha de Monitoramento à qual está vinculado (do mandato ou da secretaria executiva/grupo). |
| Interno Legisla | Outras áreas da Legisla | Recebe acesso de **Gestora** |
| Admin do Sistema | Responsável técnico/liderança de Monitoramento (papel único, hoje ocupado por uma pessoa) | Gerencia papéis e usuários (cria/edita/remove Gestoras, Mentores, Assessores); configura integrações (§2.7); acesso irrestrito a todos os produtos e áreas, sem carteira própria. **Pode assumir a visão de qualquer outro papel** para dar suporte — ação fica registrada em log de auditoria. |

**Nota — impersonation do Admin:** ao assumir a visão de outro papel, o sistema deve deixar claro (na UI) que o Admin está "atuando como X" e registrar a ação nos logs de auditoria (§2.1). Isso não é um papel novo — é um modo de operação do Admin.

**Fluxos de cadastro:** Gestoras, Mentores e Assessores têm fluxos próprios. O cadastro do Assessor deve, idealmente, já nascer diferente por produto — ainda que comece com formulário único.

---

## **4\. Modelo de dados (v1)**

\[EM PRODUÇÃO\]

## **5\. Stack tecnológica**

### **5.1 Decisão**

| Camada | Escolha |
| ----- | ----- |
| **Banco de dados** | **Supabase** (PostgreSQL gerenciado) — RLS nativa, que é requisito constitucional (§6) |
| **Backend** | **Supabase** — Auth, Storage, PostgREST e Edge Functions. Não existe servidor de aplicação próprio |
| **Frontend** | **Next.js (App Router) \+ TypeScript**, com **Tailwind CSS** e **shadcn/ui** |
| **Autenticação** | **Supabase Auth** — ver §5.3 |
| **Formulários** | **React Hook Form \+ Zod**, com o schema Zod derivado do schema do banco |
| **Dados no cliente** | **TanStack Query** |
| **Grades editáveis** | **TanStack Table** (planejamento, monitoramento de Sucessos Mensais) |
| **Hospedagem** | **Vercel** |

### **5.2 Como as peças se dividem**

O frontend fala **direto com o Supabase** via chave anônima; a RLS (§2.1) é o que autoriza cada leitura e escrita. Isso mantém a regra de acesso em um único lugar — o banco — em vez de duplicada em uma camada de API.

Existem exceções, e só elas rodam com privilégio elevado, em **Edge Functions** ou em rotas de servidor do Next.js:

1. **Integrações** (§2.7) — Google Calendar/Meet e Slack, que guardam segredo de OAuth.  
2. **Impersonation do Admin** (§3) — precisa emitir contexto de outro papel e registrar auditoria.  
3. **Importação TSE** — ETL para o schema `tse` read-only.  
4. **Exportação** (OUT-04) — geração de CSV/Sheets.

**Regra:** toda escrita privilegiada passa por Edge Function auditada. Nenhuma tela usa `service_role`.

### **5.3 Autenticação e sessão**

**Todo acesso é autenticado. Não existe tela pública, nem formulário respondível por link anônimo** — o respondente de um formulário é sempre um usuário com login e cargo (§3).

| Ator | Método |
| ----- | ----- |
| Interno Legisla (Gestora, Admin, áreas clientes) | **SSO Google Workspace**, restrito ao domínio da Legisla |
| Mentor / Consultor (externo) | **Magic link** por e-mail |
| Assessor do mandato | **Magic link** por e-mail |

Regras de sessão:

* Sessão em **cookie `httpOnly`** via `@supabase/ssr` — o token nunca vive em `localStorage`.  
* **MFA obrigatório para o papel Admin do Sistema**, que tem acesso irrestrito e poder de impersonation.  
* Sessão expira por inatividade; toda renovação é registrada.  
* **Desvinculação encerra acesso.** Quando o vínculo do usuário com o contrato termina, a RLS corta sozinha — não depende de alguém lembrar de desativar login.  
* **Login não é autorização.** Estar autenticado dá entrada no sistema; o que a pessoa vê é decidido exclusivamente pela RLS e pelo papel (§3).

### **5.4 Segredos e variáveis de ambiente**

* No bundle do cliente vivem **apenas** a URL do Supabase e a chave anônima. Mais nada. A convenção `NEXT_PUBLIC_` é o único caminho de exposição, e ela é auditada em revisão de código.  
* A chave `service_role` **nunca** aparece no frontend, em variável `NEXT_PUBLIC_` ou em log. Existe só como segredo de Edge Function.  
* Tokens de OAuth de Slack e Google ficam **cifrados em repouso** (Supabase Vault), nunca em coluna de texto puro.  
* `.env` não vai para o repositório; versiona-se apenas `.env.example` com chaves vazias.  
* Ambientes de desenvolvimento, homologação e produção têm **projetos Supabase distintos e credenciais distintas**. Nenhum desenvolvimento aponta para o banco de produção.  
* Rotação de segredos em toda saída de pessoa com acesso técnico.

### **5.5 Rate limiting e abuso**

* **Autenticação:** limite por e-mail e por IP na emissão de magic link — impede spam de convite e enumeração de usuários.  
* **Edge Functions:** limite por usuário autenticado, não só por IP.  
* **Exportação (OUT-04):** limite específico e mais restritivo — é a operação mais pesada e a que mais expõe dado consolidado de uma vez.  
* **Integrações:** respeitar o limite das APIs de Slack e Google com backoff; falha de integração não derruba a operação (§2.7).  
* Limite excedido é **evento de auditoria** (§2.1), não só um erro devolvido à tela.

### **5.6 Por que este frontend**

* **Densidade de assistência de IA.** O desenvolvimento é assistido por IA (§1.3) e a combinação Next.js \+ Tailwind \+ shadcn/ui é a que os modelos geram com mais acerto e menos alucinação de API. Escolha exótica aqui custa tempo de humano corrigindo agente.  
* **Prototipação antes da implementação**, que a Constituição já exige: shadcn/ui é código no repositório, não dependência opaca — o protótipo evolui para produção em vez de ser jogado fora.  
* **O sistema é 80% formulário e tabela.** São dezenas de formulários por etapa e uma hierarquia editável de planejamento. Ganha quem tem primitivas acessíveis prontas e validação tipada ponta a ponta.  
* **Integração de primeira classe com Supabase** (`@supabase/ssr`), incluindo sessão no servidor sem gambiarra.

### **5.7 O risco conhecido**

O maior risco de adoção não é técnico: os assessores vêm de planilha. Se a tela de Sucessos Mensais não permitir edição rápida em grade — tabular entre células, colar de uma faixa, editar em massa — eles voltam para o Sheets e a Definição de Pronto cai.

### **5.8 O que fica fora**

Sem app mobile nativo (web responsiva atende). Sem BI externo no escopo inicial — os indicadores de gestão (§2.6) são telas do sistema; exportação (OUT-04) cobre quem quiser levar o dado para fora.


## **6\. Definição de Pronto**

1. Uma Gestora roda uma consultoria de Estratégia e uma edição de PLL **do começo ao fim sem abrir as planilhas antigas**;  
2. Os números de impacto entregues às áreas clientes saem de **uma consulta ao sistema**; e  
3. A coordenação de Mandatos acompanha a operação pelos **indicadores de gestão** (§2.6) sem consolidação manual.

### **Regras inegociáveis**

1. Segurança e privacidade de dados são prioridade em qualquer decisão.  
2. Nenhuma tabela é criada sem RLS definida.  
3. Nenhuma feature é construída sem spec aprovada.  
4. **Nenhum acesso é anônimo** — nem leitura, nem resposta de formulário. Login sempre; autorização sempre pela RLS.  
5. **Nenhum número de gestão ou de impacto sai de tabela transacional** — sempre de view ou tabela da camada Saída.  
6. **Limiar e regra de negócio não são código** — vivem em tabela de referência editável.  
7. **Ausência de dado é `NULL`**, nunca um valor como "Pendente de Atualização". Pendência é derivada, não digitada.  
8. **Nenhuma escrita anônima** — todo registro guarda autor e timestamp.  
9. **Nenhum segredo no cliente** — `service_role` e tokens de integração existem apenas no servidor.

## **Glossário do domínio**

| Termo | Definição |
| ----- | ----- |
| **Mandato** | O parlamentar apoiado. É registro, não usuário. (Tabela: dim\_Mandato.) |
| **Gestora / Mentor / Assessor** | Papéis de acesso — ver §3. |
| **Projeto** | Edição/iniciativa que carrega uma temática (ex.: Imagina 1 e 2); filtro de primeira classe. |
| **Coalizão** | Agrupamento de mandatos via Projeto. Pode ou não ter **Planejamento Estratégico próprio** (secretaria executiva/grupos); sem ele, é uma visão filtrada por Projeto sobre os mandatos membros. |
| **Planejamento** | Hierarquia Objetivo Específico → Meta → Sucesso Mensal, por produto. |
| **Sucesso Mensal (SM)** | Unidade mais granular; recebe Peso e % de atingimento. |
| **Preditor (GIP)** | Campo do planejamento vinculado às Metas; sem cálculo. |
| **Registro** | Lançamento por etapa, via formulário (fat\_Registro). |
| **Insight** | Anotação qualitativa em 4 pilares, ligada ao registro de origem (fat\_Insight). |
| **Fato Gerador** | Evento de ação política; validado por Tipologias; vinculável a Metas/Insights ou sem origem (fat\_FatoGerador). |
| **Tipologias** | Tabela de referência que padroniza grupo/tipologia/estado e status dos fatos (Ref\_Tipologias). |
| **Indicador / IIP** | O IIP é a única métrica calculada da incidência, produzida dos status D1/D2/D3 dos fatos ponderados pelos Indicadores ("Peso no IIP %"). Uso interno. |
| **Números de impacto** | Agregações sobre dim\_Mandato \+ fat\_Contrato, para as áreas clientes. |
| **Admin do Sistema** | Papel de plataforma acima de Gestora. Administra usuários, papéis e integrações; não opera planejamentos por padrão, mas pode assumir a visão de qualquer papel para suporte (ação auditada). |

