# Mapa de Telas — Sistema Mandatos

Inventário completo da superfície de interface do sistema: toda rota que renderiza
alguma coisa para um ser humano, o que ela faz, quem enxerga, o que aparece em tela
e de onde vem o dado.

- **Levantado em:** 2026-08-31, a partir de leitura de código (`src/frontend/app/**`
  + `src/frontend/components/**`), não de documentação anterior.
- **Fonte de verdade:** o código. Este documento é um retrato datado — quando divergir
  do repositório, o repositório está certo.
- **Escopo:** 28 telas navegáveis + 2 roteadores + 3 route handlers (sem UI) + 3
  `not-found` dedicados.

**Legenda de maturidade:**

| Marca | Significado |
| :---- | :---- |
| 🟢 **Real** | Consome dado de verdade do banco, escreve de verdade |
| 🟡 **Parcial** | Funciona, mas com parte do conteúdo em placeholder ou dependente de camada não provisionada |
| 🔴 **Placeholder** | Rota existe e é navegável, conteúdo é `<EmDesenvolvimento>` |
| ⚙️ **Sem UI** | Route handler ou redirect — processa e navega, não renderiza tela |

---

## 1. Visão geral da navegação

```
                             ┌──────────── /login ────────────┐
                             │  (pré-sessão, sem topbar)      │
                             └────────────────┬───────────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │   /  (Hub)        │  ← Topbar em toda tela autenticada
                                    │   5 tiles         │
                                    └─────────┬─────────┘
            ┌──────────────┬──────────────────┼──────────────────┬──────────────────┐
            ▼              ▼                  ▼                  ▼                  ▼
     /produtos/      /produtos/         /produtos/         /visao-gerencial   /numeros-impacto
     estrategia         pll             coalizao           (G1–G6, gargalos)  (mv_numeros_impacto)
            │              │                  │                                     │
            └──────────────┴──────────────────┘                                     ▼
                           │                                              /numeros-impacto/[id]
              4 abas: Dashboard · Agenda · Contratos · Novo Contrato        (Visão do Mandato)
                           │
                           ▼
                  /contratos/[id]  ← ficha operacional (o coração do sistema)
                  ┌────────────────────────────────────────────────────────┐
                  │ Informações Gerais* · [1 aba por etapa] · Assessores ·  │
                  │ Formulários · Encontros                                │
                  │ ações fixas: IIP · Insight · Fato Gerador · Planejamento│
                  └────────────────────────────────────────────────────────┘
                                        * só contrato de mandato

  Fora da navegação de topo (alcançáveis por link direto — NAV-14/15):
  /mandatos · /coalizoes · /contratos         (/usuarios está na topbar, admin/gestora)
```

---

## 2. Pré-sessão — antes do login

Rotas fora do route group `(app)/`: **não têm Topbar** e não passam pelo gate de sessão
do `proxy.ts` (AD-027).

### 2.1 `/login` — Entrar 🟢

| | |
| :---- | :---- |
| **Arquivo** | `src/frontend/app/login/page.tsx` + `components/login-form.tsx` |
| **Quem vê** | Qualquer pessoa |
| **Descrição** | Porta de entrada única do sistema. E-mail + senha (AD-026 removeu o magic link para uso interno). |
| **Funcionalidades** | Autenticação por senha via Supabase Auth |
| **Visualizações** | Formulário centralizado, largura máxima 384px. Faixa âmbar **"Ambiente de desenvolvimento"** quando a `NEXT_PUBLIC_SUPABASE_URL` do build **não** aponta para o ref de produção — o aviso é derivado da URL do banco, não de flag separada, e falha para o lado seguro (sem variável, mostra o aviso). |
| **Estados especiais** | Faixa azul com 1 de 3 mensagens pós-convite, lida de `?msg=`: `conta_existente`, `sessao_ativa`, `login_automatico_falhou` (CVT-06/08) |

### 2.2 `/convite/[token]` — Criar acesso 🟢

| | |
| :---- | :---- |
| **Arquivo** | `src/frontend/app/convite/[token]/page.tsx` + `components/convite-consumo-form.tsx` |
| **Quem vê** | Convidado externo (assessor/mentor) que ainda não tem conta |
| **Descrição** | Consumo do convite por contrato. Único caminho de criação de conta fora do provisionamento manual (AD-033, 5ª exceção da AD-010). |
| **Funcionalidades** | Valida o token (hash, uso único, expiração); mostra **de qual contratante/produto se trata** antes de pedir dados; captura nome + senha; a criação da conta acontece no route handler `consumir` |
| **Visualizações** | Card estreito centralizado. Título "Criar acesso" + linha "Você foi convidado como **\<papel\>** pra \<contratante\> (\<produto\>)" |
| **Estados de erro** | 4 telas-mensagem distintas: **Muitas tentativas** (rate limit por IP, checado *antes* do lookup do token — CVT-10), **Convite inválido**, **Convite expirado**, **Convite já utilizado** |
| **Dado** | `convite_contrato` via `createAdminClient()` (`service_role`) — pré-sessão não tem `app.id_usuario`, então a RLS bloquearia qualquer outro cliente |

### 2.3 `/auth/error` — Não foi possível entrar 🟢

| | |
| :---- | :---- |
| **Arquivo** | `src/frontend/app/auth/error/page.tsx` |
| **Descrição** | Tela terminal de falha de autenticação. Mostra a mensagem crua vinda de `?error=`, ou "Ocorreu um erro não especificado." |
| **Visualizações** | Título + parágrafo, centralizado. Sem ação. |

### 2.4 `/admin/acesso` — Acesso dev 🟢 *(dev-only)*

| | |
| :---- | :---- |
| **Arquivo** | `src/frontend/app/admin/acesso/page.tsx` |
| **Quem vê** | Ninguém em produção — `notFound()` quando `NODE_ENV !== "development"` |
| **Descrição** | Bypass de login para desenvolvimento local. Gera e verifica o magic link no servidor, sem enviar e-mail — existe para contornar o rate limit de e-mail do plano free da Supabase. |
| **Funcionalidades** | Um campo de e-mail → POST em `/admin/acesso/entrar` |
| **Visualizações** | Form HTML puro (deliberadamente, sem Server Actions), campo único + botão |

### 2.5 Route handlers (sem tela) ⚙️

| Rota | Arquivo | O que faz |
| :---- | :---- | :---- |
| `/auth/confirm` | `app/auth/confirm/route.ts` | Verifica o token de e-mail e estabelece a sessão |
| `/convite/[token]/consumir` | `app/convite/[token]/consumir/route.ts` | Cria a conta (`email_confirm: true`), grava `dim_usuario` + `rel_usuario_contrato` e consome o convite numa transação; redireciona pro `/login?msg=…` conforme o desfecho |
| `/admin/acesso/entrar` | `app/admin/acesso/entrar/route.ts` | Guard real do bypass dev — recusa tudo fora de `next dev` |

---

## 3. Casca autenticada

### 3.1 Topbar — presente em toda tela sob `(app)/`

| | |
| :---- | :---- |
| **Arquivo** | `components/app-shell/topbar.tsx` (montada em `app/(app)/layout.tsx`) |
| **Descrição** | Barra fixa de 64px, `sticky top-0`, fundo `sidebar` com `backdrop-blur`. Substituiu a antiga sidebar (deletada na Trilha F). |
| **Elementos** | **Esquerda:** ícone de bandeira em quadrado com gradiente + "Legisla Brasil" / "SISTEMA MANDATOS" (mono, tracking largo). **Direita:** link **Hub** (`/`), link **Gestão de Usuários** (`/usuarios`, só `admin`/`gestora`), botão de avatar circular — hoje **placeholder**, sem menu de conta nem logout. |
| **Observação** | O gate de auth é 100% do `proxy.ts` (AD-002); este layout só decora quem já passou. |

> **Lacuna conhecida:** não existe ação de **sair/logout** na interface. O avatar é decorativo.

---

## 4. Hub

### 4.1 `/` — Hub de produtos 🟢

| | |
| :---- | :---- |
| **Arquivo** | `src/frontend/app/(app)/page.tsx` |
| **Quem vê** | Toda pessoa autenticada |
| **Descrição** | Landing page pós-login. Substituiu o antigo bento grid + explorador TSE (Trilha F, NAV-01). |
| **Funcionalidades** | Ponto de partida da navegação — 5 destinos, nada mais |
| **Visualizações** | Grade de **5 cards** (1 coluna no mobile, 2 a partir de `sm`), cada um com ícone em quadrado arredondado, título e descrição. Hover eleva o card (`-translate-y-1`), acende gradiente diagonal e revela uma seta circular. Os 3 produtos usam a cor `primary`; Visão Gerencial e Números de Impacto usam `secondary`. |
| **Cards** | **Estratégia** (`Landmark`) → `/produtos/estrategia` · **PLL** (`Flag`) → `/produtos/pll` · **Coalizão** (`Handshake`) → `/produtos/coalizao` · **Visão Gerencial** (`BarChart3`) → `/visao-gerencial` · **Números de Impacto** (`TrendingUp`) → `/numeros-impacto` |
| **Dado** | `PRODUTO_SLUGS` (mapa fixo de 3 slugs, sem round-trip ao banco) |

---

## 5. Área de produto — `/produtos/[slug]`

`slug` ∈ `estrategia` · `pll` · `coalizao` (os 3 produtos com `operado_pelo_sistema = true`).
O `layout.tsx` valida o slug contra o mapa fixo e chama `notFound()` se inválido.

**Casca compartilhada (`ProdutoShell`):** link "← Voltar ao hub", título do produto em
`font-heading` 3xl, e **4 abas de rota** (`RouteTabs`): Dashboard · Agenda · Contratos ·
Novo Contrato. Largura máxima 1152px.

### 5.1 `/produtos/[slug]` — redirecionador ⚙️

Redirect estático de servidor para `/produtos/[slug]/dashboard`. Não renderiza nada.

### 5.2 `/produtos/[slug]/dashboard` — Dashboard do produto 🟢

| | |
| :---- | :---- |
| **Arquivo** | `app/(app)/produtos/[slug]/dashboard/page.tsx` |
| **Quem vê** | Toda pessoa autenticada (RLS limita o que aparece); card de NPS só `admin`/`gestora` |
| **Descrição** | Painel operacional do produto: contagens, satisfação e o **Kanban de etapas** — a tela mais densa da área de produto. |
| **Funcionalidades** | **Barra de 4 filtros** que combinam por AND: (1) Papel — Todos/Gestora/Mentor; (2) Pessoa — cascata, populada pelo papel escolhido, desabilitada enquanto o papel for "Todos"; (3) Projeto — só projetos com contrato no produto; (4) **Minha carteira** — switch. Arrastar card entre colunas do Kanban move a etapa do contrato (mutação otimista com rollback). |
| **Visualizações** | **2 cards de contagem** — "Contratos ativos" e "Assessores ativos", número em `font-heading` 3xl, `—` enquanto carrega (AD-005: nunca `0` por ausência de dado). **Card de NPS agregado** (`mv_avaliacao_nps`). **Board Kanban** — 1 coluna por `ref_etapa` do produto, cada card mostrando nome do contratante e "há N dias na etapa atual"; badge de status quando o contrato não está `ativo` (contrato encerrado continua visível, nunca some do board). Card inteiro é link para a ficha do contrato. |
| **Regras** | Guards client-side de **adjacência de coluna** e **papel na reversão** — o servidor rejeita os dois de qualquer forma (erros `KAN01`/`42501`), os guards só evitam o request óbvio |
| **Dado** | `contarContratosEAssessoresAtivos`, `buscarPessoasComPapelNoProduto`, `buscarProjetosDoProduto`, `buscarBoardKanban` / `moverEtapaKanban` (TanStack Query + dnd-kit) |

### 5.3 `/produtos/[slug]/agenda` — Agenda 🔴

Placeholder único `<EmDesenvolvimento titulo="Agenda em desenvolvimento" />` para os 3
produtos (NAV-12). Depende da camada de Operação com dado de calendário real.

### 5.4 `/produtos/[slug]/contratos` — Contratos do produto 🟢

| | |
| :---- | :---- |
| **Arquivo** | `app/(app)/produtos/[slug]/contratos/page.tsx` |
| **Descrição** | Lista de cards, 1 por `fat_contrato` **ativo** do produto. Porta de entrada mais usada para a ficha do contrato. |
| **Visualizações** | Grade responsiva de 1/2/3 colunas. Card = nome do contratante (título) + "Início: dd/mm/aaaa". Hover realça borda e sombra. |
| **Estados** | `<CarregandoSkeleton>` enquanto busca · `<EstadoVazio>` "Nenhum contrato ativo" com botão **Cadastrar novo contrato** |
| **Dado** | `buscarContratosAtivosPorProduto` |

### 5.5 `/produtos/[slug]/novo-contrato` — Cadastro de novo contrato 🟢

| | |
| :---- | :---- |
| **Arquivo** | `app/(app)/produtos/[slug]/novo-contrato/page.tsx` + `components/produtos/novo-contrato-view.tsx` |
| **Descrição** | Fluxo unificado de contratação (feature `cadastro-mandato-contrato-unificado`, CMU-01 a CMU-16). Ramifica pelo produto. |
| **Funcionalidades — Estratégia/PLL** | Reaproveita o **MandatoWizard** inteiro: busca no espelho TSE (combobox `command`+`popover`), cadastro manual, ou seleção de mandato existente → converge no `ContratoForm`. Detecção de duplicata com diálogo de aviso. |
| **Funcionalidades — Coalizão** | Ramifica em **nova coalizão** (`CoalizaoForm`) ou **coalizão existente** (Select) → mesmo `ContratoForm` |
| **Visualizações** | Wizard em etapas dentro da casca do produto; formulários React Hook Form + Zod, erros de RLS renderizados em `<ErroInline>` |
| **Efeito colateral relevante** | O `INSERT` em `fat_contrato` dispara trigger que **instancia** `fat_etapa_contrato`, `rel_formulario_contrato` e `dim_planejamento` (feature `operacao-regua-instanciacao`) — a ficha do contrato já nasce populada |

### 5.6 `/produtos/[slug]/not-found` — 404 do produto

Slug fora de `estrategia|pll|coalizao`.

---

## 6. Ficha do contrato — `/contratos/[id]`

O centro operacional do sistema. Reaproveitada entre contrato de **mandato** e de
**coalizão** (NAV-04/NAV-07).

### 6.0 Casca compartilhada (`FichaContratoChrome`)

Envolve **todas** as sub-rotas via layout aninhado.

| Elemento | Conteúdo |
| :---- | :---- |
| **Cabeçalho** | `H1` com o nome do contratante em caixa alta. Subtítulo ramificado: contrato de **mandato** → `Produto · Cargo · Partido · UF`; contrato de **coalizão** → `Produto · Projeto de origem: …` |
| **Ações fixas (direita)** | **`IipCard`** — Índice de Incidência Política, lido de `mv_iip_contrato` · botão **Registrar Insight** (abre Dialog com `InsightForm`) · botão **Registrar Fato Gerador** (abre Dialog; ao concluir, força o `IipCard` a remontar e refrescar a MV) · botão **Planejamento Estratégico** |
| **Abas (`RouteTabs`)** | `Informações Gerais`\* → *1 aba por `ref_etapa` do produto* → `Assessores` → `Formulários` → `Encontros`.<br>\* só quando `tipo_contratante = 'mandato'`. Sem etapas cadastradas, aparece a aba única "Nenhuma etapa cadastrada". |
| **Largura** | 1152px (`max-w-6xl`) em todas as abas — **exceto Planejamento**, que ocupa a largura inteira da tela |
| **Etapas por produto** | **Estratégia / Coalizão:** Pontapé · Raio-X · Imersão · Governança/Organograma · Monitoramento · Replicação.<br>**PLL:** Pontapé · Imersão e construção do planejamento · Mentorias e monitoramento |

### 6.1 `/contratos/[id]` — roteador de aba padrão ⚙️

Cliente. Contrato de **mandato** → redireciona para `informacoes`. Coalizão/genérico →
redireciona para a **1ª etapa** da régua. Se `ref_etapa` vier vazio, fecha o estado
explicitamente com `<EmDesenvolvimento titulo="Nenhuma etapa cadastrada" />` em vez de
ficar preso no skeleton para sempre (correção de achado do Verifier).

### 6.2 `/contratos/[id]/informacoes` — Informações Gerais (TSE) 🟢

| | |
| :---- | :---- |
| **Arquivo** | `.../informacoes/page.tsx` + `components/fundacao/informacoes-tse-mandato.tsx` |
| **Quem vê** | Só contrato de mandato — coalizão acessando por URL direta recebe **404** |
| **Descrição** | Retrato eleitoral do parlamentar, lido do espelho TSE (schema `tse.*`, read-only, restrito ao Legislativo por AD-031) |
| **Visualizações** | **Accordion por ano de candidatura** · **perfil pessoal** do candidato · **gráfico de perfil do eleitorado** (`PerfilEleitoradoChart`) · votação total e município principal |
| **Dado** | `buscarPerfilCandidatura`, `buscarPerfilEleitoradoCandidatura`, `buscarTodasCandidaturasPorTitulo` |

### 6.3 `/contratos/[id]/etapas/[codigo]` — Etapa 🟢

| | |
| :---- | :---- |
| **Arquivo** | `.../etapas/[codigo]/page.tsx` |
| **Descrição** | Cada aba de etapa mostra a **régua completa do produto**, não só a própria etapa — a barra de abas já é a navegação ordenada, o conteúdo é a mesma tabela com a linha em foco destacada (RGI-09/RGI-10). |
| **Visualizações** | **Tabela da régua** com 5 colunas: Etapa · Status (badge: Não iniciada / Em andamento / Concluída / Dispensada) · **Previsto** (`início → conclusão`) · **Realizado** (`início → conclusão`) · **Atraso** (badge destrutivo "N dia(s)" ou `—`). A linha da etapa da URL recebe fundo `muted` e `aria-current="step"`. |
| **Funcionalidades** | Bloco **Registros** abaixo da régua: formulário inline (`RegistroForm`) com o Select de Tipo de Registro escopado à etapa, e tabela dos registros existentes — Tipo · Ocorrido em · Resumo · Autor (INC-09/10/11) |
| **Dado** | `buscarReguaDoContrato` (`vw_etapa_contrato`), `buscarRegistrosDaEtapa` |

### 6.4 `/contratos/[id]/vinculos` — Assessores 🟢

| | |
| :---- | :---- |
| **Arquivo** | `.../vinculos/page.tsx` |
| **Descrição** | Gestão do time daquele contrato (FND-USR-03 a 08). Cobre também o assessor mentorado do PLL (vínculo manual, sem matching). |
| **Funcionalidades** | **Listar · Adicionar vínculo · Editar · Substituir · Encerrar.** "Encerrar" grava **só `dt_fim`** — nunca apaga a linha, nunca toca `dim_usuario.ativo`. Botão **Convidar por e-mail** abre painel inline com `ConviteForm`, que gera o token e devolve a URL `/convite/<token>` para a Gestora copiar (sem depender de SMTP). |
| **Visualizações** | Título "Vínculos do contrato #N", dois botões no topo, `VinculoTable` com ações por linha, e painel inline (não modal) para o formulário ativo |
| **Distinção importante** | *Adicionar vínculo* pressupõe pessoa já cadastrada; *Convidar por e-mail* cria acesso para quem ainda não tem conta — `dim_usuario` só nasce no consumo do convite |

### 6.5 `/contratos/[id]/formularios` — Formulários 🟢

| | |
| :---- | :---- |
| **Arquivo** | `.../formularios/page.tsx` + `components/produtos/formularios-lista.tsx` |
| **Descrição** | Lista dos formulários instanciados para o contrato (FRM-01 a FRM-03, FRM-14) |
| **Quem vê o quê** | **Gestora/Admin:** os 16 formulários do produto + **toggle abrir/fechar** por formulário. **Mentor/Assessor:** só os endereçados ao próprio papel, já filtrados na query (a RLS nega a escrita de qualquer forma — esconder é defesa em profundidade, não a única barreira) |
| **Catálogo (16)** | **Estratégia:** Termo de Compromisso · Código de Conduta · Introdutório — Assessores · Introdutório — CG e Parlamentar · Organograma · **GIP (Início/Meio/Fim)** · Avaliação da Imersão · Avaliação de Fim de Ciclo.<br>**PLL:** Inscrição de Mentorados · Diagnóstico e Temáticas de Interesse · Inscrição de Mentores · Avaliação da Imersão (PLL) · Avaliação Parcial (Participantes / Mentores) · Avaliação Final (Participantes / Mentores) |

### 6.6 `/contratos/[id]/formularios/[codigo]` — Formulário 🟢

Três caminhos, resolvidos pelo `codigo` da URL:

| Código | Tela |
| :---- | :---- |
| `gip` | **`FormularioGipForm`** — tela sob medida: 3 ações (**início / meio / fim**), campos fixos + **4 dimensões**. Grava em `fat_submissao`; `fat_gip`/`fat_gip_dimensao` são 100% derivadas por trigger, o componente nunca escreve nelas. Bloqueia quem não é o respondente (`gestora`). |
| `inscricao_mentorado`, `inscricao_mentor` | `<EmDesenvolvimento titulo="Fora de escopo">` — a inscrição PLL acontece **antes** de existir `fat_contrato`, incompatível com `id_contrato NOT NULL` |
| os outros 13 | **`FormularioGenericoForm`** — renderiza os campos a partir de `ref_metrica_formulario`; anexo quando `exige_anexo`; aviso de "não é o respondente" quando o papel não confere |
| código inexistente | `notFound()` |

### 6.7 `/contratos/[id]/encontros` — Encontros 🟢

| | |
| :---- | :---- |
| **Arquivo** | `.../encontros/page.tsx` |
| **Descrição** | Registro de encontros do contrato (INC-15 a INC-18). Disponível para mandato **e** coalizão. |
| **Funcionalidades** | Botão **Novo Encontro** abre Dialog com `EncontroForm`; lista abaixo com **gestão de participantes** por encontro |
| **Visualizações** | Rótulo "ENCONTROS" + botão à direita, `EncontrosLista` abaixo; recarrega por sinal após criar |
| **Dado** | `fat_encontro` (camada de Incidência, completa: 7 tabelas + 1 MV + 1 view) |

### 6.8 `/contratos/[id]/planejamento` — Planejamento Estratégico 🟢

A tela mais complexa do sistema. Features `planejamento-planilha-monitoramento` +
`planejamento-estrategico-redesenho`.

| | |
| :---- | :---- |
| **Arquivo** | `.../planejamento/page.tsx` + 12 componentes em `components/planejamento/` |
| **Largura** | Única aba que **rompe** o `max-w-6xl` do chrome e usa a tela inteira |
| **Layout** | 2 colunas em `lg+`: **coluna esquerda** = `ContextoEstrategico` (colapsável via `<details>` nativo, vira accordion abaixo de 1024px — **nunca** um painel fixo à direita); **restante** = a árvore-grade. Empilha no mobile. |
| **Cabeçalho próprio** | `PlanejamentoHeader` — breadcrumb curto "Contratante › Planejamento", **etapa atual** e atraso (de `vw_etapa_contrato`), **cobertura** e mês do ciclo, indicador de **IIP** (só para quem tem `veIip`) |
| **Árvore-grade** | `PlanejamentoGrade` — **uma única tabela** com 3 tipos de linha: **Objetivo Específico → Meta → Sucesso Mensal**, indentação progressiva por nível, fundo distinto por tipo, expandir/recolher centralizado num único `Set` |
| **Toolbar** | Busca textual · filtro **Só pendentes** · filtro **Só minhas metas** · expandir/recolher tudo · **aplicar em massa** — tudo client-side sobre a árvore já carregada, sem round-trip novo |
| **Modais** | `ModalDetalheItem` (criar/editar Objetivo, Meta, Sucesso Mensal) e `ModalHistorico` (auditoria) — só um dos dois aberto por vez |
| **Contexto estratégico** | Evolução do **GIP** em ordem cronológica (início → meio → fim) lida de `vw_gip_evolucao`, e preditores prioritários |
| **Ramo Coalizão** | Coalizão **sem planejamento próprio** mostra `PlanejamentoAgregadoCoalizao`: a mesma grade, 1x por mandato membro, sempre em somente-leitura — nunca um formulário de criação de Objetivo |

**Matriz de permissão por papel** (`components/planejamento/permissoes.ts` — fonte única; nenhum componente checa `papel === "…"` direto):

| Papel | Modos | Padrão | CRUD hierarquia | Edita % | IIP / Incidência | Auditoria | Coluna Responsável |
| :---- | :---- | :---- | :----: | :---- | :----: | :----: | :----: |
| **Gestora** | Construir · Monitorar · Ler | Monitorar | ✅ | todas as metas | ✅ | ✅ | ✅ |
| **Admin** | Construir · Monitorar · Ler | Monitorar | ✅ | todas as metas | ✅ | ✅ | ✅ |
| **Mentor** | Monitorar · Ler | Monitorar | ❌ | todas as metas | ✅ | ❌ | ✅ |
| **Assessor** | Monitorar | Monitorar | ❌ | **só as próprias** | ❌ | ❌ | ❌ |

> Os 3 botões de modo são **desabilitados**, nunca escondidos, quando fora do alcance do
> papel. Enquanto o papel carrega, o fallback é `assessor` (o mais restrito), para nunca
> renderizar CRUD antes de saber quem está olhando. O assessor entra já com "só minhas
> metas" ligado.

### 6.9 `/contratos/[id]/not-found` — 404 do contrato

---

## 7. Saída — leitura consolidada

Ambas as áreas são **Server Components** com gate de papel no servidor: `mentor` e
`assessor` recebem `<NaoAutorizado>` antes de qualquer dado renderizar, **inclusive por
URL direta** (a checagem não está no `proxy.ts`, que só resolve autenticado-ou-não).

Nenhum número aqui sai de tabela transacional — sempre de view ou MV (AD-003).

### 7.1 `/visao-gerencial` — Visão Gerencial 🟡

| | |
| :---- | :---- |
| **Arquivo** | `app/(app)/visao-gerencial/page.tsx` + 18 componentes em `components/visao-gerencial/` |
| **Quem vê** | `admin` · `gestora` |
| **Descrição** | Painel gerencial completo dos indicadores G1–G6 + IIP consolidado + gargalos. Ordem visual é fixa e constitucional: **saúde do próprio sistema antes de qualquer indicador de mandato**. |
| **Barra de recorte** | `sticky` no topo, 5 filtros gravados na **URL** (`searchParams`) — a URL é a única fonte de verdade, sem estado local: **Produto · Projeto · Gestora · Mentor · Período** (meses de evolução) |
| **Bloco 0 — Saúde da operação** | **G3** (% de contratos ativos com registro recente + evolução) e **G4** (taxa de resposta por formulário, barras horizontais). Cada indicador com `try/catch` próprio — um falha isolado do outro |
| **Bloco 1 — Distribuição por etapa** | Onde estão os mandatos na régua, ordenado por `ref_etapa.ordem` (**nunca** por volume). Clique numa etapa abre `EtapaContratosModal` com os contratos dela |
| **Bloco 2 — Indicadores** | Grade de 2 colunas: **G1** carteira ponderada (com evolução mensal por gestora, no máximo 8 séries) · **G2** tempo de ciclo por etapa (small multiples de mediana) · **G5** % de atingimento (sinaliza quantos estão desatualizados, nunca mostra o agregado como se estivesse fresco) · **G6** completude de cadastro (barras pelos 5 campos fixos) · **IIP consolidado** |
| **Atalho** | Card "Ir para o Kanban" com um botão por produto |
| **Bloco 3 — Gargalos** | Tabela agrupada com paginação incremental ("carregar mais"); trocar o recorte remonta a tabela e zera o acumulado |
| **Regras de visualização** | Nenhum card com 2 eixos Y. Ausência de dado é `—`, **nunca** `0` (AD-005). Cada bloco em seu próprio `<Suspense>` — um bloco falhando não derruba os outros |
| **Pendências** | Evolução mensal de G5 e G6 nascem sem histórico (`TODO(OUT-06)` / `TODO(G6-evolucao)`) — depende de `fat_snapshot_mensal`, que não existe |

### 7.2 `/numeros-impacto` — Números de Impacto 🟢

| | |
| :---- | :---- |
| **Arquivo** | `app/(app)/numeros-impacto/page.tsx` |
| **Quem vê** | `admin` · `gestora` |
| **Descrição** | Substitui a planilha manual de números de impacto (SAI-01 a SAI-04). Uma linha por `fat_contrato`. |
| **Visualizações** | Breadcrumb · H1 + badge com "N contrato(s)" · **tabela de 8 colunas**: Contratante · Produto · Projeto · Status · Ano de início · Nº contratos · 1ª contratação · Ordem — e um botão **"Ver mandato →"** por linha |
| **Funcionamento** | Refresh síncrono da MV **seguido** de leitura — ordem obrigatória, garantida dentro de `atualizaEBuscaNumerosImpacto` e coberta por teste unitário próprio |
| **Estados** | `<EstadoVazio>` "Nenhum contrato encontrado" · `<ErroInline>` sem retry (Server Component — reabrir a página já refaz o refresh) |
| **Dado** | `mv_numeros_impacto` |

### 7.3 `/numeros-impacto/[idContratante]` — Visão do Mandato 🟢

| | |
| :---- | :---- |
| **Arquivo** | `app/(app)/numeros-impacto/[idContratante]/page.tsx` |
| **Quem vê** | `admin` · `gestora` (gate repetido — a rota é acessível por URL direta) |
| **Descrição** | Linha do tempo consolidada de **todos os contratos de um contratante** (SAI-05 a SAI-07) |
| **Visualizações** | Breadcrumb "Números de Impacto › \<contratante\>" · H1 com o nome · **timeline de cards** ordenada por ordem do contrato. Cada card: `#ordem — Produto`, projeto, badges de **Continuação** e status. Quando há contrato anterior, um conector visual `↳ "Continuação do contrato #N"` desenha a renovação acima do card; sua ausência é o caso normal, não falha de dado. |
| **Estados** | `<EstadoVazio>` "Nenhum contrato encontrado"; sem nome, o título cai para "Visão do Mandato" |
| **Dado** | `vw_visao_mandato` |

---

## 8. Cadastros diretos

Continuam existindo e funcionando; **saíram da navegação de topo** na Trilha F
(NAV-14/15) — alcançáveis por link direto. `/usuarios` é a exceção: segue na Topbar.

### 8.1 `/mandatos` — Mandatos 🟢

| | |
| :---- | :---- |
| **Descrição** | Lista de todos os mandatos cadastrados |
| **Funcionalidades** | **Busca** textual · filtro por **UF** · filtro por **Partido** (ambos populados dinamicamente a partir do que existe na lista) · botão **Novo mandato** · **excluir** com `ConfirmDeleteDialog` |
| **Visualizações** | Breadcrumbs + grade de `MandatoCard` — nome de urna, nome do contratante, UF, sigla do partido, cargo |
| **Atenção** | A exclusão é uma **cascata manual** de 8 passos no cliente (vínculo TSE → vínculos de usuário → membros de coalizão → `fat_etapa_contrato` → `rel_formulario_contrato` → `dim_planejamento` → contratos → mandato/contratante), necessária porque as FKs são `ON DELETE RESTRICT` |

### 8.2 `/mandatos/novo` — Novo mandato 🟢

`MandatoWizard` em página dedicada, largura 768px. Subtítulo: *"Uma ficha por pessoa.
Nome, partido e cargo vêm do TSE — o resto você completa."* Ao criar, navega para
`/mandatos/[id]`.

### 8.3 `/mandatos/[id]` — Ficha do mandato 🟢

| | |
| :---- | :---- |
| **Tamanho** | ~745 linhas — a maior página do projeto |
| **Descrição** | Edição do contratante + mandato, histórico eleitoral e contratos |
| **Funcionalidades** | Formulário editável (`ContratanteFields` + campos de mandato, RHF + Zod, validação `onChange`) · **marcar candidatura vigente** · **excluir mandato** (mesma cascata) · atalhos para contratos e Kanban |
| **Visualizações** | Breadcrumbs · badges · **accordion por ano de candidatura** com perfil TSE (votação, município principal, cargo, partido) · **gráfico de perfil do eleitorado** · lista de contratos do contratante com nome do produto |
| **Nota** | O bloco TSE é duplicado em `InformacoesTseMandato` (§6.2), deliberadamente — refatorar esta página tem risco de regressão desproporcional (sem cobertura de teste, cascata de exclusão delicada) |

### 8.4 `/mandatos/[id]/contratos/novo` — Contratos do mandato 🟢

Duas seções em 512px: **Contratos existentes** (tabela Início · Status · ação
**Encerrar** inline para os `ativo`) e **Novo contrato** (`ContratoForm`). A lista
alimenta o seletor de "contrato anterior" do formulário.

### 8.5 `/coalizoes` — Coalizões 🟢

Lista de `CoalizaoCard` (nome, UF, município), botão **Nova coalizão**, exclusão com
confirmação (remove membros → `dim_coalizao` → `dim_contratante`).

### 8.6 `/coalizoes/novo` — Nova coalizão 🟢

`CoalizaoForm` em página de 512px; ao criar, navega para `/coalizoes/[id]`.

### 8.7 `/coalizoes/[id]` — Ficha da coalizão 🟢

| | |
| :---- | :---- |
| **Descrição** | Composição da coalizão + seus contratos próprios |
| **Funcionalidades** | **Adicionar membro** — Select de contrato (filtrado a `tipo_contratante = 'mandato'`, correção do bug FND-COL-03/CMU-16: antes listava qualquer contrato, inclusive coalizões) · **papel** do membro: `membro` / `secretaria_executiva` / `grupo_trabalho` (com campo "nome do grupo" quando aplicável) · datas de entrada e saída · **abrir contrato próprio da coalizão** (CMU-15) reaproveitando o `ContratoForm` |
| **Visualizações** | Dados do contratante + tabela de membros + tabela de contratos próprios |

### 8.8 `/contratos` — Todos os contratos 🟢

| | |
| :---- | :---- |
| **Descrição** | Lista geral, transversal a produto e contratante |
| **Funcionalidades** | Filtro por **Status** · filtro por **Produto** · **alterar status** inline (`ativo` / `concluido` / `nao_concluido`) com toast de confirmação · **excluir** com cascata manual |
| **Visualizações** | Breadcrumbs + cards com contratante, produto, data de início e badge de status; atalhos por ícone para Assessores, Kanban e Formulários |

### 8.9 `/usuarios` — Gestão de Usuários 🟢

| | |
| :---- | :---- |
| **Quem vê** | Link na Topbar só para `admin`/`gestora`; a página detecta `souAdmin` lendo o próprio `papel_global` |
| **Descrição** | Cadastro de pessoas e vinculação inicial a contrato |
| **Funcionalidades** | **Busca** textual · **criar usuário** em Dialog (`UsuarioForm`) com, no mesmo passo: **contrato** (opcional), **papel no contrato** (`gestora`/`mentor`/`assessor`/`leitura`) e **cargo** (`parlamentar`/`chefe_gabinete`/`assessor`/`secretaria_executiva`/`nao_se_aplica`) · **excluir** com confirmação |
| **Visualizações** | Breadcrumbs, campo de busca, cards/lista com badge de papel global |
| **Guarda de segurança** | `WITH CHECK` explícito na RLS impede que uma Gestora crie `admin` ou `gestora` — a ausência dessa cláusula era escalonamento de privilégio (corrigido em `20260810181508_fix_with_check_p_usuario.sql`, com teste de regressão) |

---

## 9. Papéis e o que cada um alcança

Papéis globais (`dim_usuario.papel_global`): `admin` · `gestora` · `mentor` · `assessor`.

| Tela | admin | gestora | mentor | assessor |
| :---- | :----: | :----: | :----: | :----: |
| Hub, área de produto, ficha do contrato | ✅ | ✅ | ✅ | ✅ |
| Kanban (mover etapa) | ✅ | ✅ | ✅ | ⚠️ RLS |
| Card de NPS agregado | ✅ | ✅ | ❌ | ❌ |
| Formulários | todos | todos | só os do papel | só os do papel |
| Planejamento — construir | ✅ | ✅ | ❌ | ❌ |
| Planejamento — editar % | todas | todas | todas | só as próprias |
| **Visão Gerencial** | ✅ | ✅ | 🚫 bloqueado | 🚫 bloqueado |
| **Números de Impacto** | ✅ | ✅ | 🚫 bloqueado | 🚫 bloqueado |
| Gestão de Usuários (link na Topbar) | ✅ | ✅ | ❌ | ❌ |

> A UI **nunca** é a autorização (AD-002, §5.3 da Constituição). Todo bloqueio acima é
> dupla camada: a tela esconde, a RLS/GRANT nega. Onde só a tela esconde, está anotado
> como defesa em profundidade no próprio código.

---

## 10. Padrões transversais de interface

| Padrão | Componente | Onde |
| :---- | :---- | :---- |
| Carregando | `<CarregandoSkeleton>` (variantes `cards`, `list`, `table`) | toda tela com fetch |
| Erro inline | `<ErroInline>` (com `onRetry` só em Client Components) | formulários, blocos de Saída |
| Estado vazio | `<EstadoVazio>` (título + mensagem + ação opcional) | listas |
| Em desenvolvimento | `<EmDesenvolvimento>` | Agenda, formulários fora de escopo |
| Sem permissão | `<NaoAutorizado>` | Visão Gerencial, Números de Impacto |
| Abas por rota | `<RouteTabs>` | casca de produto, ficha do contrato |
| Confirmação de exclusão | `<ConfirmDeleteDialog>` | mandatos, coalizões, contratos, usuários |
| Toast | `sonner` (`<Toaster/>` montado no layout raiz) | toda escrita |
| Tipografia | `Outfit` (`--font-heading`) para títulos, `Inter` (`--font-sans`) para corpo | global |

---

## 11. Lacunas e telas que ainda não existem

| Lacuna | Situação | Depende de |
| :---- | :---- | :---- |
| **Logout / menu de conta** | O avatar da Topbar é decorativo — não há como sair pela interface | — |
| **Agenda** (`/produtos/[slug]/agenda`) | 🔴 placeholder nos 3 produtos | Camada de Operação com dado de calendário |
| **Evolução mensal de G5 e G6** | Cards existem, sem histórico | `fat_snapshot_mensal` (OUT-06), não provisionada |
| **Inscrição PLL** (mentorado/mentor) | Fora de escopo por construção — acontece antes de existir `fat_contrato` | Decisão de produto sobre onde essa captura vive |
| **Filtro de cargo / método de match na busca TSE** | Não exposto na UI (`FND-TSE-01`/`FND-TSM-01`) | Minoritário, mitigado na origem (AD-031) |
| **Catálogos vazios de propósito** | `ref_agenda_tematica`, `ref_indicador`, `ref_tipologia` (CAT-16) | Levantamento humano, sem data |
| **Exportação** | Nenhuma tela oferece export | Camada de Saída, fatia não iniciada |

---

## 12. Contagem final

| Categoria | Qtd |
| :---- | ----: |
| Telas pré-sessão | 4 |
| Hub | 1 |
| Área de produto | 4 (+1 redirect, +1 `not-found`) |
| Ficha do contrato | 7 (+1 roteador, +1 `not-found`) |
| Saída / gerencial | 3 |
| Cadastros diretos | 9 |
| **Total de telas navegáveis** | **28** |
| Redirecionadores / roteadores | 2 |
| Route handlers sem UI | 3 |
| `not-found` dedicados | 3 |

Maturidade: **26 🟢 reais** · **1 🟡 parcial** (Visão Gerencial — G5/G6 sem evolução
histórica) · **1 🔴 placeholder** (Agenda, uma rota compartilhada pelos 3 produtos).
