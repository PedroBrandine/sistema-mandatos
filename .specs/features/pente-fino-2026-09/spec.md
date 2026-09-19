# Pente-Fino 2026-09 Specification

## Problem Statement

Após o lançamento de várias features (fatos geradores/ciclo de vida,
planejamento estratégico v2, ficha de mandato/contrato), uma primeira
rodada de uso real revelou 12 problemas concretos em telas já em produção
dev: campos que faltam no cadastro, ações de edição que não existem,
elementos de UI fora de lugar e uma tela cujo layout ficou ilegível. Os
itens foram coletados com prints em `docs/pente-fino.html` e exportados em
`docs/pente-fino-backup-2026-09-18.json`. Nenhum é uma feature nova — são
correções e pequenos ajustes em fluxos que já existem.

## Goals

- [ ] Fechar as 6 lacunas de edição/cadastro que hoje bloqueiam uso real
      (GIP, Sucesso Mensal, Status/Etapa do mandato, vínculo de gestoras)
- [ ] Corrigir a fidelidade visual e a navegação das telas de Fatos
      Geradores (linha do tempo, ciclo de vida, formulário de registro)
- [ ] Remover elementos de UI órfãos ou fora de lugar (IIP provisório,
      botão "registrar registro" nas telas erradas)

## Out of Scope

Explicitamente excluído. Documentado para prevenir scope creep.

| Item                                                              | Motivo                                                                                        |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Redesenho completo do módulo GIP (além de permitir editar)         | Pedido do usuário é só destravar edição do momento já aplicado, não redesenhar o fluxo de GIP |
| Novo sistema de permissões/papéis para as edições liberadas nesta feature | Nenhum item pede controle de acesso novo; reusa RLS/regras já existentes para cada entidade    |
| Implementação real das abas Diagnóstico / Formulários / Gestão da Equipe | Item 10 pede só um aviso de "em construção", não o conteúdo das abas                          |
| Cálculo/snapshot de indicadores de impacto reais (substituto do IIP) | Adiado — item 11 pede remover o card provisório, não construir o indicador definitivo (ver AD-015/AD-056 em STATE.md) |
| Mudanças no schema do banco fora do estritamente necessário para os campos de edição pedidos | Cada item vira migration própria só se a coluna/RPC não existir; não é oportunidade para redesenhar tabelas |

---

## Assumptions & Open Questions

Toda ambiguidade está resolvida ou registrada aqui — nada fica sem marcação.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Rota-base das abas Diagnóstico/Formulários/Gestão da Equipe | `/contratos/[id]/...` (mesmo padrão das demais abas de contrato) | Item não veio com URL; é o padrão de todas as outras rotas coletadas | n |
| Texto e comportamento do aviso "em construção" | Banner não-bloqueante no topo da aba, mesmo padrão visual de alerta já usado no design system (shadcn `Alert`) | Pedido não especifica texto exato nem se bloqueia acesso; manter acesso e só avisar é a opção menos destrutiva | n |
| Escopo de edição do GIP | Editar apenas os dados já coletados do momento aplicado (data de aplicação, respostas), sem reabrir o fluxo de aplicação nem trocar o tipo de momento | Pedido do usuário ("editar momento já aplicado") não menciona reabrir fluxo | n |
| Papéis que podem editar GIP/Sucesso Mensal/Status-Etapa/gestoras | Mesmos papéis que hoje têm permissão de escrita nessas entidades (nenhuma RBAC nova) | Nenhum item pede controle de acesso diferente do já existente | n |
| Recalcular Situação do Sucesso Mensal | Situação deve ser derivada automaticamente do % de atingimento a cada edição, nunca setada manualmente | Item 8 descreve isso como bug ("situação não altera independente da % de atingimento") | n |
| "Prazo relativo ao mês" no Sucesso Mensal | Ao atribuir um sucesso mensal a vários meses, o dia informado no prazo é aplicado a cada mês da atribuição (ex.: prazo "dia 10" gera vencimento dia 10 em cada mês atribuído) | É a única leitura que resolve a reclamação ("a data prazo deve ser relativo ao mês atribuído") sem inventar novo campo | n |
| Edição de Status/Etapa do mandato | Editar na Ficha atualiza a mesma fonte de dados que o Kanban lê (Kanban já existe — feature `kanban-etapas`); não cria campo duplicado | Item pede explicitamente "vinculado ao kanban" | n |
| Formulário de novo contrato — campo de gestoras | Reusa o mesmo componente/seleção de gestoras já usado em outro ponto do cadastro/ficha do mandato, adicionado ao formulário de criação | Reuso evita criar um segundo padrão de seleção de pessoa | n |
| Botão "vincular usuário" para gestoras | Mesmo fluxo de vínculo de usuário que já existe para outro papel, com gestoras como opção adicional de papel-alvo | Item pede que o botão já existente também sirva para gestoras, não um fluxo novo | n |
| Redesenho do formulário de Fato Gerador | Seguir os 2 frames do Figma linkados no item (`node-id=118-6` e `node-id=118-96`) como fonte de verdade visual, consultados via skill `figma-dominio-legisla` | Usuário anexou os links e pediu explicitamente "implemente estes 2 designs" | n |
| Botão "Registrar Registro" nas telas de Fato Gerador | Remover da Linha do Tempo e do Ciclo de Vida; ele continua existindo na Agenda (onde já pertence) | Usuário: "isto é de registro de encontro, é da página agenda", repetido nos 2 itens | n |
| Card IIP provisório | Remover de todas as subtelas de contrato onde aparece hoje (`iip-card.tsx` e consumidores), substituindo pelos botões padrão "Registrar Insight" / "Registrar Fato Gerador" já usados em outras telas + botão voltar para `produtos/[slug]/estrategia/dashboard` | Item: "ESTE INDICADOR ESTA PRESENTE EM TODAS AS TELAS/SUBTELAS" | n |

**Implicit-requirement dimensions (sweep resumido — feature de manutenção sobre telas já autenticadas, sem domínio novo):**

- Input validation & bounds → cobre pelos schemas Zod já existentes de cada entidade (GIP, sucesso mensal, mandato); nenhum campo novo introduz limite diferente do já validado hoje.
- Failure / partial-failure states → cada edição é um update único via RPC/Supabase já existente; erro exibe toast padrão do app, sem estado parcial novo.
- State-transition integrity → PF-04 (Status/Etapa) deve respeitar as transições já definidas pela feature `kanban-etapas`, nunca introduzir estado novo.
- Idempotency / duplicate handling → PF-05/PF-06 (vínculo de gestoras/usuário) reusam a constraint de unicidade já existente no vínculo pessoa-contrato; não é criada lógica de dedup nova.
- Auth boundaries, concorrência, data lifecycle, observabilidade, dependência externa → **N/A** para este lote: nenhum item introduz papel novo, processo concorrente, TTL/expiração, serviço externo ou necessidade de log além do padrão já existente no app.

**Open questions:** nenhuma pendente sem registro — todas as ambiguidades estão na tabela acima como assumption a confirmar com o usuário antes/durante o Design.

---

## User Stories

### P1: Editar GIP após submissão ⭐ MVP

**User Story**: Como usuária responsável pelo acompanhamento, quero editar os dados de um momento de GIP já aplicado, para corrigir erros de preenchimento sem precisar reaplicar o momento inteiro.

**Why P1**: Hoje é impossível corrigir um erro já submetido — bloqueia o uso real da tela de GIP.

**Acceptance Criteria**:

1. WHEN a usuária abre um momento de GIP já aplicado (Início ou Fim) THEN o sistema SHALL exibir uma ação de edição visível para esse momento, no lugar do estado hoje somente-leitura.
2. WHEN a usuária edita os dados de um momento de GIP já aplicado e salva THEN o sistema SHALL fazer `UPDATE` no registro existente (nunca criar um segundo envio) e persistir as alterações sem alterar o tipo do momento nem seu status de aplicação.
3. WHEN a usuária tenta editar um momento de GIP sem permissão de escrita nessa entidade THEN o sistema SHALL recusar a ação da mesma forma que já recusa hoje para criação/aplicação.

> **Nota de decisão**: esta story reverte, só neste ponto, a leitura de
> FMC-27 AC7 ("momento aplicado não se reabre como novo") — registrado como
> **AD-063** em `.specs/STATE.md` (supersede parcial, unicidade
> `uq_gip_contrato_momento` permanece intocada).

**Independent Test**: Abrir `/contratos/[id]/gip`, editar um momento já reaplicado, salvar e recarregar a página confirmando que o valor editado persistiu.

---

### P1: Editar Sucesso Mensal já lançado ⭐ MVP

**User Story**: Como usuária de planejamento, quero editar mês, data limite e peso de um Sucesso Mensal já cadastrado, para corrigir dados sem excluir e recriar a linha.

**Why P1**: Sem isso, qualquer erro de cadastro exige recriar a estrutura inteira de planejamento.

**Acceptance Criteria**:

1. WHEN a usuária abre um Sucesso Mensal já cadastrado na planilha de estrutura THEN o sistema SHALL permitir editar mês, data limite e peso.
2. WHEN a usuária altera o % de atingimento de um Sucesso Mensal THEN o sistema SHALL recalcular e exibir a Situação derivada desse percentual, sem exigir que a usuária a defina manualmente.
3. WHEN a edição é salva com sucesso THEN o sistema SHALL refletir os novos valores na planilha de estrutura sem exigir reload manual da página.

**Independent Test**: Em `/contratos/[id]/planejamento?aba=estrutura`, editar peso e data limite de um Sucesso Mensal existente, mudar o % de atingimento e verificar que a Situação exibida muda de acordo.

---

### P1: Prazo do Sucesso Mensal relativo ao mês atribuído ⭐ MVP

**User Story**: Como usuária de planejamento, quero que o prazo de um Sucesso Mensal atribuído a vários meses seja calculado em relação a cada mês, para não ter vencimentos errados quando a atribuição cobre múltiplos meses.

**Why P1**: Hoje o prazo aplicado é fixo, gerando data de vencimento incorreta para atribuições multi-mês.

**Acceptance Criteria**:

1. WHEN a usuária cadastra um Sucesso Mensal com atribuição em mais de um mês e informa um prazo THEN o sistema SHALL calcular a data-limite de cada mês da atribuição relativa àquele mês (mesmo dia do prazo, aplicado ao mês correspondente).
2. WHEN a atribuição cobre um único mês THEN o comportamento de prazo SHALL permanecer o mesmo já existente hoje (sem regressão).

**Independent Test**: Criar um Sucesso Mensal atribuído a 3 meses consecutivos com prazo "dia 10"; confirmar que cada mês da atribuição mostra vencimento no dia 10 daquele mês, não uma única data fixa.

---

### P1: Editar Status e Etapa do mandato na Ficha ⭐ MVP

**User Story**: Como gestora, quero editar o Status do contrato e a Etapa do produto direto na página de informações gerais, para não depender de outra tela para manter esses campos atualizados.

**Why P1**: Hoje não existe campo de edição nessa tela — a informação só muda por fora, gerando desalinhamento.

**Acceptance Criteria**:

1. WHEN a gestora abre a página de informações gerais de um mandato/contrato THEN o sistema SHALL exibir campos de edição para Status do contrato e Etapa do produto.
2. WHEN a gestora altera a Etapa do produto pela Ficha THEN o sistema SHALL refletir a mesma mudança no Kanban (mesma fonte de dados, sem campo duplicado).
3. WHEN a gestora tenta setar uma transição de etapa inválida (fora das transições já definidas pelo Kanban) THEN o sistema SHALL recusar a alteração com a mesma regra já aplicada no Kanban.

**Independent Test**: Editar a Etapa pela página de informações e conferir que o card do Kanban do mesmo contrato reflete a nova etapa.

---

### P1: Vincular gestoras no cadastro de contrato ⭐ MVP

**User Story**: Como usuária cadastrando um novo contrato, quero selecionar as gestoras do mandato já no formulário de criação, para não ter que voltar depois numa tela separada.

**Why P1**: Hoje o cadastro sai incompleto e exige um segundo passo manual.

**Acceptance Criteria**:

1. WHEN a usuária preenche o formulário de novo contrato THEN o sistema SHALL exibir um campo para selecionar uma ou mais gestoras do mandato.
2. WHEN o contrato é criado com gestoras selecionadas THEN o sistema SHALL persistir o vínculo pessoa-contrato para cada gestora selecionada, usando a mesma regra de unicidade já aplicada a outros vínculos desse tipo.
3. WHEN a usuária não seleciona nenhuma gestora THEN o sistema SHALL permitir salvar o contrato normalmente (campo não é obrigatório, mantém comportamento atual).

**Independent Test**: Criar um contrato em `/produtos/[slug]/novo-contrato` selecionando 2 gestoras e confirmar na ficha do contrato criado que ambas aparecem vinculadas.

---

### P1: Botão "vincular usuário" também para gestoras ⭐ MVP

**User Story**: Como usuária administrando acessos, quero usar o botão de vincular usuário para gestoras também, não só para o papel que já é suportado hoje.

**Why P1**: Sem isso, gestoras não conseguem ganhar acesso de usuário pelo fluxo já existente.

> **Achado do Design**: localizado com precisão. `CardPontoFocal`
> (`src/frontend/components/fundacao/card-ponto-focal.tsx`) já tem a seção
> "Ponto Focal" com botão "Vincular usuário" (linha 137) — a seção "Gestoras"
> logo abaixo (linha 142) só lista badges ou "—", sem nenhum botão de ação.
> `vinculoSchema` já aceita `papel_no_contrato: "gestora"` e a página
> `/contratos/[id]/vinculos` já usa `VinculoForm`/`VinculoTable` com esse
> papel — a lacuna é só de UI neste card específico, não de schema/RPC.

**Acceptance Criteria**:

1. WHEN a usuária está na página de informações do contrato THEN o sistema SHALL exibir o botão de vincular usuário também para o papel de gestora.
2. WHEN a usuária vincula um usuário como gestora por esse botão THEN o sistema SHALL seguir o mesmo fluxo/validação já usado para os outros papéis vinculáveis hoje.

**Independent Test**: Em `/contratos/[id]/informacoes`, usar o botão para vincular um usuário como gestora e confirmar que o vínculo aparece na lista de gestoras do contrato.

---

### P2: Redesenho do formulário de registro de Fato Gerador

**User Story**: Como usuária registrando um fato gerador, quero um formulário legível e alinhado ao design aprovado no Figma, para não ter campos sobrepostos dificultando o preenchimento.

**Why P2**: É um problema visual sério, mas não bloqueia o registro (o formulário funciona, só está feio/confuso).

**Acceptance Criteria**:

1. WHEN a usuária abre o formulário de registro de fato gerador THEN o sistema SHALL exibir o layout conforme os frames do Figma referenciados no item (node-id 118-6 e 118-96), sem texto sobreposto a outro campo.
2. WHEN o formulário é revisado THEN o sistema SHALL manter todos os campos e validações já existentes (é um redesenho visual, não uma mudança de dados coletados).

**Independent Test**: Abrir o formulário em `/contratos/[id]/fatos-registros?visao=linha-do-tempo`, comparar lado a lado com os frames do Figma e confirmar ausência de sobreposição em qualquer resolução de tela suportada pelo app.

---

### P2: Linha do Tempo e Ciclo de Vida de Fatos Geradores — ajustes de UI e navegação

**User Story**: Como usuária acompanhando fatos geradores, quero identificar visualmente um fato projetado, marcá-lo como realizado, ver KPIs no ciclo de vida e abrir o detalhe da origem clicando no card, para não depender de inferência visual ou de outra tela.

**Why P2**: São ajustes de usabilidade em uma tela que já funciona, mas está incompleta/confusa em pontos específicos.

**Acceptance Criteria**:

1. WHEN um fato gerador está com status "projetado" THEN o sistema SHALL diferenciá-lo visualmente dos fatos "realizados" na Linha do Tempo e no Ciclo de Vida (mesmo tratamento visual nas duas visões).
2. WHEN um fato gerador está "projetado" THEN o sistema SHALL exibir uma ação para marcá-lo como "realizado" diretamente no card, nas duas visões.
3. WHEN a usuária abre a página de Ciclo de Vida THEN o sistema SHALL exibir os KPIs already definidos para essa página (hoje ausentes).
4. WHEN a usuária clica em um card no Ciclo de Vida THEN o sistema SHALL abrir o detalhe da origem e do fato gerador associado.
5. WHEN a usuária está na Linha do Tempo ou no Ciclo de Vida THEN o sistema SHALL **não** exibir o botão "Registrar Registro" (ele pertence à Agenda e continua existindo lá).

**Independent Test**: Na página de Ciclo de Vida, confirmar KPIs visíveis, marcar um fato projetado como realizado pelo card, clicar em um card e ver o detalhe abrir, e confirmar ausência do botão "Registrar Registro" nas duas visões.

---

### P2: Filtro por mês no planejamento estratégico

**User Story**: Como usuária de planejamento, quero filtrar a planilha por mês e ver a coluna Mês em formato legível, para localizar rapidamente os itens de um período.

**Why P2**: Melhora usabilidade de uma tela que já existe e funciona, mas fica lenta de navegar em listas grandes.

**Acceptance Criteria**:

1. WHEN a usuária está na tela de planejamento estratégico THEN o sistema SHALL exibir um filtro por mês, além da busca por descrição já existente.
2. WHEN a coluna Mês é exibida na planilha THEN o sistema SHALL formatá-la como "Mês/Ano" (ex.: "Junho/26"), não em formato de data cru.

**Independent Test**: Filtrar por um mês específico e conferir que só os itens daquele mês aparecem, com a coluna Mês mostrando o formato "Mês/Ano".

---

### P3: Aviso de "em construção" nas abas incompletas

**User Story**: Como usuária navegando pelo contrato, quero saber que a aba Gestão da Equipe ainda não existe/não tem conteúdo pronto, para não achar que é um bug.

**Why P3**: É comunicação, não funcionalidade — evita confusão, mas não bloqueia nada.

> **Achado do Design (revisa o pedido original) — CANCELADA na Execute**: o
> item original pedia aviso em 3 abas (Diagnóstico, Formulários, Gestão da
> Equipe). Checando o código: **Diagnóstico** já usa
> `<EmDesenvolvimento titulo="Diagnóstico" />` — nada a fazer. **Formulários**
> já foi implementada de verdade (`FormulariosLista`, FRM-01/FRM-02) — não é
> mais placeholder. O Design errou ao afirmar que **"Gestão da Equipe" não
> existe como aba**: a task T11 (Execute, Fase 6) achou que ela já existe,
> aponta para `/vinculos` (convites, adicionar/editar/encerrar vínculo
> usuário-contrato, feature `ficha-mandato-contrato`, comentário no código
> confirma que já substituiu o rótulo antigo "Assessores") e tem conteúdo
> real, não placeholder. Pedro confirmou (2026-09-18): o item original já
> está resolvido por essa aba. **T11 cancelada, nenhum código escrito para
> esta story** — mantida no histórico só para rastreabilidade do que foi
> pedido e por que não virou código.

**Acceptance Criteria**: nenhum — story cancelada, requisito já satisfeito por trabalho anterior (`ficha-mandato-contrato`, aba `/vinculos`).

---

### P3: Remover IIP provisório e padronizar botões de ação

**User Story**: Como usuária navegando pelas subtelas do contrato, quero ver os botões padrão de "Registrar Insight" e "Registrar Fato Gerador" no lugar do indicador provisório sem dado real, e um botão para voltar, para não me deparar com um card vazio/confuso nem perder a navegação.

**Why P3**: É limpeza de UI — o card IIP provisório não tem dado real por trás ainda.

**Acceptance Criteria**:

1. WHEN a usuária abre qualquer subtela de contrato que hoje exibe o card IIP provisório (`IipCard` em `ficha-contrato-chrome.tsx`) THEN o sistema SHALL remover esse card de todas elas.
2. WHEN o card IIP é removido THEN o sistema SHALL exibir no lugar um único botão/link que leva para a aba "Fatos Geradores e Registros" do contrato — **não** os formulários inline de "Registrar Insight"/"Registrar Fato Gerador", que a AD-057 (2026-09-15) já tornou exclusivos dessa aba.
3. WHEN a usuária está numa dessas subtelas THEN o sistema SHALL exibir um botão de voltar que leva para `/produtos/[slug]/estrategia/dashboard`.

> **Nota de decisão**: mantém AD-057 (aba de Incidência como único ponto de
> escrita) — o pedido original de "devolver os botões" foi resolvido como
> navegação para a aba, não reabertura de um segundo ponto de criação.

**Independent Test**: Abrir `/contratos/[id]/informacoes` e demais subtelas que hoje mostram o IIP, confirmar que o card sumiu, que os botões padrão aparecem e que o botão voltar leva ao dashboard de estratégia do produto.

---

## Edge Cases

- WHEN a usuária edita um Sucesso Mensal e o % de atingimento não muda THEN a Situação SHALL permanecer a mesma (não recalcular à toa).
- WHEN um contrato não tem nenhuma gestora cadastrada no sistema ainda THEN o campo de seleção no cadastro SHALL exibir estado vazio sem quebrar o formulário.
- WHEN a etapa do produto é alterada pelo Kanban enquanto a Ficha está aberta em outra aba THEN a próxima leitura da Ficha SHALL refletir o valor mais recente (sem cache desatualizado bloqueando a edição).
- WHEN o card IIP aparece em uma subtela não mapeada durante o levantamento inicial (item 11 diz "todas as telas/subtelas") THEN a remoção SHALL cobrir qualquer consumidor real de `iip-card.tsx`, confirmado por busca no código antes de fechar a task, não só as rotas citadas no relato.

---

## Requirement Traceability

| Requirement ID | Story                                              | Phase  | Status  |
| --------------- | --------------------------------------------------- | ------ | ------- |
| PF-01            | P1: Editar GIP após submissão                       | Execute | Verified |
| PF-02            | P1: Editar Sucesso Mensal já lançado                 | Execute | Verified |
| PF-03            | P1: Prazo do Sucesso Mensal relativo ao mês          | Execute | Verified |
| PF-04            | P1: Editar Status e Etapa do mandato                 | Execute | Verified (fix task aberta -- lint, ver validation.md) |
| PF-05            | P1: Vincular gestoras no cadastro de contrato        | Execute | Verified |
| PF-06            | P1: Botão "vincular usuário" também para gestoras    | Execute | Verified |
| PF-07            | P2: Redesenho do formulário de Fato Gerador          | Execute | Verified (spec-precision gap -- AC1 é visual, sem teste automatizado possível) |
| PF-08            | P2: Linha do Tempo e Ciclo de Vida — ajustes de UI   | Execute | Verified |
| PF-09            | P2: Filtro por mês no planejamento estratégico       | Execute | Verified |
| PF-10            | P3: Aviso "em construção" nas abas incompletas       | Cancelled | Cancelada (ver nota na story, T11 não gerou código) |
| PF-11            | P3: Remover IIP provisório + padronizar botões       | Execute | Verified (spec-precision gap -- AC3 cita rota inexistente, ver validation.md) |

**ID format:** `PF-NN` (Pente-Fino).

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 11 requisitos totais (cobrindo os 12 itens originais — PF-08 funde os itens de Linha do Tempo e Ciclo de Vida, que descrevem a mesma tela em duas visões), 0 mapeados para tasks ainda, 11 não mapeados ⚠️ (aguardando Design/Tasks).

---

## Success Criteria

- [ ] As 6 lacunas de edição/cadastro (PF-01 a PF-06) funcionam de ponta a ponta nas telas reais, sem exigir workaround
- [ ] Formulário de Fato Gerador bate visualmente com os frames do Figma referenciados, sem sobreposição de campos
- [ ] Linha do Tempo e Ciclo de Vida não exibem mais o botão "Registrar Registro" nem o card IIP provisório
- [ ] Nenhuma regressão nos testes existentes das features tocadas (`fatos-geradores-ciclo-vida`, `planejamento-estrategico-v2`, `kanban-etapas`, cadastro de contrato)
