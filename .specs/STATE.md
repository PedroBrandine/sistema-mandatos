# STATE

Log de decisões de projeto e snapshot de handoff do Sistema Mandatos.

**Fonte destas decisões:** `docs/Constituição Sistema Mandatos.md` (§2 Camadas, §3 RBAC, §5 Stack, §6 Definição de Pronto).
Decisões aqui são **project-level**: valem para todas as features. Decisão que só afeta uma feature vive no `design.md` dela.

---

## Decisions

### AD-001
- **Decision**: Nenhuma tabela é criada sem política de RLS definida no mesmo momento do DDL.
- **Reason**: A autorização do sistema mora exclusivamente no banco (§5.2) — o frontend fala direto com o Supabase via chave anônima, então uma tabela sem RLS é uma tabela pública. Regra inegociável da §6.
- **Trade-off**: Toda migração fica mais lenta e mais verbosa; nenhuma tabela pode ser criada "para testar depois".
- **Scope**: Todas as camadas; toda migração em `supabase/`.
- **Date**: 2026-07-30
- **Status**: active (exceção documentada em AD-030 para tabelas de catálogo `ref_*`)

### AD-002
- **Decision**: Nenhum acesso é anônimo — nem leitura, nem resposta de formulário. Login sempre; a autorização é sempre decidida pela RLS, nunca pela UI.
- **Reason**: §5.3 — "Login não é autorização". O respondente de um formulário é sempre um usuário com papel (§3), o que garante autoria e permite que a desvinculação corte o acesso sozinha, sem depender de alguém lembrar de desativar o login.
- **Trade-off**: Não existe link público de formulário; todo assessor precisa de cadastro e magic link antes de responder qualquer coisa. Custo de onboarding maior.
- **Scope**: Plataforma, Operação dos produtos (formulários), Saída; todas as rotas do Next.js.
- **Date**: 2026-07-30
- **Status**: active

### AD-003
- **Decision**: Nenhum número de gestão ou de impacto sai de tabela transacional — sempre de view ou de tabela da camada Saída.
- **Reason**: §2.6 e §6. Separa a leitura consolidada da escrita operacional, permite otimizar/versionar a consulta sem tocar no modelo transacional e impede que cada tela invente sua própria agregação.
- **Trade-off**: Toda métrica nova exige criar/alterar um artefato de Saída antes de aparecer em tela — não dá para "só fazer um select rápido".
- **Scope**: Saída (números de impacto, visão do mandato, visão gerencial, indicadores G1–G6, exportação).
- **Date**: 2026-07-30
- **Status**: active

### AD-004
- **Decision**: Limiar e regra de negócio vivem em tabela de referência editável, nunca em código ou embutidos na query.
- **Reason**: §2.6 — mudar o "N dias" de G3/G4, o peso de etapa de G1 ou o tempo esperado por etapa de G2 é configuração, não deploy. Vale também para as variações de preenchimento por produto (§2.3) e para os pesos do IIP (§2.4).
- **Trade-off**: Mais tabelas `ref_*` e mais joins; a regra deixa de ser legível só lendo o código.
- **Scope**: Planejamento & Monitoramento, Incidência, Operação dos produtos, Saída.
- **Date**: 2026-07-30
- **Status**: active

### AD-005
- **Decision**: Ausência de dado é `NULL`. Nunca um valor sentinela como "Pendente de Atualização", "N/A" ou string vazia. Pendência é **derivada** por consulta, nunca digitada.
- **Reason**: §6. Sentinela em coluna de domínio contamina agregação, quebra tipagem e torna impossível distinguir "não preenchido" de "preenchido com esse texto". O indicador G6 (completude de cadastro) depende exatamente de derivar a pendência da ausência.
- **Trade-off**: A UI precisa tratar `NULL` explicitamente em toda tela e o usuário não consegue marcar "sei que falta" no próprio campo.
- **Scope**: Todas as camadas; todo schema e todo formulário.
- **Date**: 2026-07-30
- **Status**: active

### AD-006
- **Decision**: Toda escrita guarda autor e timestamp. Nenhuma linha entra no sistema sem saber quem criou e quando.
- **Reason**: §6 — "nenhuma escrita anônima". Sustenta a auditoria da Plataforma (§2.1), a rastreabilidade dos registros por etapa (§2.4) e a transição de etapa datada exigida por G1/G2 (§2.6).
- **Trade-off**: Colunas de auditoria em toda tabela transacional e obrigação de propagar o usuário autenticado em toda escrita, inclusive nas privilegiadas via Edge Function.
- **Scope**: Todas as camadas; toda tabela transacional e toda Edge Function de escrita.
- **Date**: 2026-07-30
- **Status**: active

### AD-007
- **Decision**: Uma camada só depende de camadas **abaixo** dela ou **transversais** — nunca de camadas acima.
- **Reason**: §2. Ordem: Plataforma (transversal) → Fundação → Planejamento & Monitoramento (transversal) / Incidência (transversal) → Operação dos produtos → Saída; Integrações (§2.7) são adaptadores isolados. É o que impede que a Operação reimplemente Planejamento/Incidência e que a Saída volte a escrever na origem.
- **Trade-off**: Às vezes exige subir uma abstração para a camada de baixo em vez de resolver localmente na feature.
- **Scope**: Todas as features; critério de revisão de design.
- **Date**: 2026-07-30
- **Status**: active

### AD-008
- **Decision**: `docs/schema_sistema.sql` é a fonte de verdade **aprovada** do modelo de dados. Não deve ser redesenhado — apenas referenciado. Mudanças no modelo entram como migração incremental com justificativa, nunca como redesenho.
- **Reason**: O DDL já foi aprovado e provisionado no Supabase (projeto `mgoeloqdlpgkofgqqbjs`, 32 tabelas com RLS ativada — ver `.specs/overview.md`). Redesenhar o schema a cada feature invalidaria o que já está em produção e a Definição de Pronto (§6).
- **Trade-off**: Uma feature que precise de estrutura diferente tem de justificar a migração em vez de propor um modelo próprio.
- **Scope**: Todas as features; toda fase de Design.
- **Date**: 2026-07-30
- **Status**: active

### AD-009
- **Decision**: Nenhum segredo no cliente. No bundle vivem apenas a URL do Supabase e a chave anônima. `service_role` e tokens de OAuth existem só como segredo de servidor (Edge Function / Supabase Vault). Nenhuma tela usa `service_role`.
- **Reason**: §5.4 e §6. `NEXT_PUBLIC_` é o único caminho de exposição e é auditado em revisão de código.
- **Trade-off**: Toda operação privilegiada exige round-trip para Edge Function, mesmo quando seria trivial no cliente.
- **Scope**: Plataforma, Integrações, todo o frontend.
- **Date**: 2026-07-30
- **Status**: active

### AD-010
- **Decision**: Toda escrita privilegiada passa por Edge Function auditada. As exceções ao acesso direto via RLS são exatamente quatro: Integrações (§2.7), impersonation do Admin (§3), importação TSE e exportação (OUT-04).
- **Reason**: §5.2. Lista fechada de exceções evita que "precisa de privilégio" vire porta dos fundos para contornar a RLS.
- **Trade-off**: Qualquer nova necessidade de privilégio exige decisão explícita que supersede esta.
- **Scope**: Plataforma, Integrações, Saída (exportação), Fundação (importação TSE).
- **Date**: 2026-07-30
- **Status**: active

### AD-011
- **Decision**: O frontend fala direto com o Supabase via chave anônima. Não existe camada de API própria nem servidor de aplicação.
- **Reason**: §5.2 — mantém a regra de acesso em um único lugar (o banco) em vez de duplicada entre API e RLS.
- **Trade-off**: Toda lógica de autorização tem de ser expressável em RLS; não há onde esconder regra de acesso em código de servidor.
- **Scope**: Todas as camadas; arquitetura do frontend.
- **Date**: 2026-07-30
- **Status**: active

### AD-012
- **Decision**: Planejamento é **um único conjunto de tabelas**, discriminado pelo produto do contrato — não um schema nem uma feature por produto. O que varia por produto é a variação de preenchimento, declarada em tabela de referência.
- **Reason**: §2.3. As hierarquias de Estratégia, PLL e Coalizão são idênticas (Objetivo Específico → Meta → Sucesso Mensal); separar duplicaria a cascata de atingimento e a política de RLS em três cópias para manter em sincronia.
- **Trade-off**: Campos que só existem em um produto ficam nulos nos outros (coerente com AD-005) e a obrigatoriedade sai do schema para a tabela de referência.
- **Scope**: Planejamento & Monitoramento; features de Estratégia, PLL e Coalizões.
- **Date**: 2026-07-30
- **Status**: active

### AD-013
- **Decision**: Etapa é **fato com data de entrada e saída** (histórico de transições), não campo de status atual sobrescrito.
- **Reason**: §2.6 — "requisito estrutural que estes indicadores impõem". Sem histórico de transições não existe mediana de tempo de ciclo (G2) nem carteira ponderada retroativa (G1).
- **Trade-off**: Ler "em que etapa este mandato está" passa a ser consulta sobre o histórico, não leitura de uma coluna.
- **Scope**: Operação dos produtos, Saída (G1, G2), modelo de dados.
- **Date**: 2026-07-30
- **Status**: active

### AD-014
- **Decision**: Métrica calculada existe em um só lugar. O IIP é calculado na Incidência (§2.4); a Saída o exibe como leitura e **não recalcula** métrica.
- **Reason**: §2.6. Duas implementações da mesma métrica divergem — e a divergência aparece primeiro para a área cliente.
- **Trade-off**: Mudança na fórmula do IIP obriga a passar pela Incidência mesmo quando a demanda nasce numa tela de gestão.
- **Scope**: Incidência, Saída.
- **Date**: 2026-07-30
- **Status**: active

### AD-015
- **Decision**: A camada Saída só lê e agrega. Existe **uma única escrita autorizada** nela: o job de fechamento mensal, que grava `fat_snapshot_mensal` copiando valores já calculados em outro lugar, sem interpretá-los. Qualquer outra escrita na Saída é violação de camada.
- **Reason**: §2.6. Indicadores fotografados (atingimento e IIP) mudam por edição e lançamento e não são deriváveis de transição de etapa — sua série histórica exige snapshot periódico. Indicadores derivados (G1, G2) continuam saindo das datas de transição, sem snapshot.
- **Trade-off**: A série histórica de atingimento/IIP tem granularidade mensal e é irrecuperável se o job falhar num fechamento.
- **Scope**: Saída; job de fechamento mensal.
- **Date**: 2026-07-30
- **Status**: active

### AD-016
- **Decision**: Nenhuma feature é construída sem spec aprovada.
- **Reason**: §6, regra inegociável. É o que torna este STATE.md e o fluxo Specify → Design → Tasks → Execute obrigatórios, não opcionais.
- **Trade-off**: Nada começa por código, nem correção pequena que "obviamente" cabe numa feature existente.
- **Scope**: Processo; todas as features.
- **Date**: 2026-07-30
- **Status**: active

### AD-017
- **Decision**: Artefatos deferidos por falta de definição da área de conhecimento — **Mapa Político** (Raio-X, Estratégia, PLL) e **Relatório de Diagnóstico de Organograma** (Estratégia) — ficam fora do escopo inicial. Enquanto o schema de campos não existir, o sistema **armazena o resultado, não o método**: anexo ou campo de texto livre, nunca uma estrutura inventada por antecipação.
- **Reason**: §2.5, regra de deferimento. Nenhum deles bloqueia a Definição de Pronto; quando o schema chegar, cada um entra como feature própria, sem alterar as camadas.
- **Trade-off**: Esses passos continuam acontecendo fora do sistema, com o resultado anexado ao mandato.
- **Scope**: Operação dos produtos (Estratégia, PLL).
- **Date**: 2026-07-30
- **Status**: active

### AD-018
- **Decision**: Papéis são quatro (Gestora de Mandato, Mentor/Consultor, Assessor do mandato, Admin do Sistema); "Interno Legisla" recebe acesso de Gestora. O parlamentar não é papel — é registro. Impersonation é modo de operação do Admin, não papel novo: exige MFA, sinalização explícita na UI ("atuando como X") e registro em log de auditoria.
- **Reason**: §3 e §5.3. Fecha o vocabulário de autorização que toda política de RLS vai referenciar.
- **Trade-off**: Necessidade nova de acesso vira decisão que supersede esta, não um papel criado ad hoc.
- **Scope**: Plataforma; toda política de RLS.
- **Date**: 2026-07-30
- **Status**: active

### AD-019
- **Decision**: LGPD incide **apenas** sobre o cadastro de usuários (Gestoras, Mentores/Consultores, Assessores), onde há dado pessoal/sensível. O mandato não carrega dado LGPD — é público/TSE ou gerado pela Legisla.
- **Reason**: §2.1. Delimita onde tratamento, retenção e minimização de dado pessoal são obrigatórios, evitando espalhar o custo por todo o sistema.
- **Trade-off**: Se algum dado pessoal entrar por outro caminho (ex.: campo livre de registro), esta fronteira é violada em silêncio — exige atenção em revisão de spec.
- **Scope**: Plataforma, Fundação (cadastro de usuários).
- **Date**: 2026-07-30
- **Status**: active

### AD-020
- **Decision**: Ambientes de desenvolvimento, homologação e produção têm projetos Supabase e credenciais distintos. Nenhum desenvolvimento aponta para o banco de produção. `.env` não vai para o repositório — versiona-se apenas `.env.example` com chaves vazias.
- **Reason**: §5.4.
- **Trade-off**: Custo de manter três projetos e de semear dado de teste em cada um.
- **Scope**: Plataforma; infraestrutura e processo de deploy.
- **Date**: 2026-07-30
- **Status**: active

### AD-021
- **Decision**: Stack fechada — Supabase (Postgres, Auth, Storage, PostgREST, Edge Functions), Next.js App Router + TypeScript, Tailwind + shadcn/ui, React Hook Form + Zod (schema derivado do banco), TanStack Query, TanStack Table para grades editáveis, hospedagem Vercel. Sem app mobile nativo e sem BI externo no escopo inicial.
- **Reason**: §5.1, §5.6 e §5.8. RLS nativa é requisito constitucional; o sistema é 80% formulário e tabela; e o desenvolvimento assistido por IA acerta mais nesta combinação.
- **Trade-off**: Escolhas exóticas ficam vetadas mesmo quando tecnicamente superiores para um caso isolado.
- **Scope**: Todas as features; frontend e backend.
- **Date**: 2026-07-30
- **Status**: active

### AD-022
- **Decision**: A tela de edição em grade dos Sucessos Mensais exige **protótipo validado com assessor real antes de qualquer linha de código de produção**, contemplando tabulação entre células, colar de uma faixa e edição em massa.
- **Reason**: §5.7 — é o risco de adoção conhecido. Se a edição em grade não for rápida, os assessores voltam para o Sheets e a Definição de Pronto (§6) cai.
- **Trade-off**: A feature de Sucessos Mensais tem um gate de validação externa que as outras não têm, e o cronograma depende da agenda de um assessor.
- **Scope**: Planejamento & Monitoramento (Sucessos Mensais).
- **Date**: 2026-07-30
- **Status**: superseded (ver AD-028)

### AD-023
- **Decision**: O **Kanban de etapas é feature de Operação dos produtos (§2.5), com escrita** — não uma tela de leitura na Saída. Arrastar o card entre colunas é a ação que grava a transição de etapa, com data e autor, no fato de etapa. A Saída consome essa transição como leitura e continua sem escrever (AD-015).
- **Reason**: §2.6, nota de decisão. G1 (carteira ponderada) e G2 (tempo de ciclo) dependem de a etapa ser fato datado (AD-013); se a escrita da transição não estiver no Kanban, vira campo de formulário que alguém esquece de preencher e os dois indicadores ficam vazios. O Kanban é a superfície onde a transição já acontece na cabeça do usuário — registrar ali é o caminho de menor atrito.
- **Trade-off**: O Kanban deixa de ser tela barata de leitura e passa a carregar política de RLS de escrita, validação de transição e auditoria (AD-006). Uma superfície de gestão adquire responsabilidade transacional, o que exige cuidado para não virar porta de escrita para outros campos.
- **Scope**: Operação dos produtos (Kanban, transição de etapa); Saída (G1, G2, visões operacionais de gestão).
- **Date**: 2026-07-30
- **Status**: active

### AD-024
- **Decision**: Toda escrita que cruza mais de uma linha/tabela (invariante multi-passo) usa **função Postgres RPC `SECURITY INVOKER`** — nunca Edge Function/`service_role`, nunca sequência de chamadas soltas do lado da aplicação. Toda escrita de uma linha só continua sendo `insert`/`update` direto via PostgREST, sem função. `SECURITY DEFINER` nunca é usado nessas funções.
- **Reason**: Design de Fundação (`.specs/features/fundacao-entidades-pessoas/design.md`). AD-010 fecha a lista de exceções que usam `service_role`/Edge Function (Integrações, impersonation do Admin, importação TSE, exportação) — escrita de negócio multi-tabela não é uma delas. `SECURITY INVOKER` (padrão do Postgres) faz a função herdar o papel de quem chama, então a RLS das tabelas internas continua decidindo quem escreve — sem abrir uma porta nova de privilégio. Uma sequência de chamadas Supabase soltas não tem transação real entre elas, o que deixaria estado parcial em caso de falha no meio.
- **Trade-off**: Toda invariante multi-tabela vira uma função no banco (superfície de PL/pgSQL a manter, testar e revisar) em vez de lógica em TypeScript; aumenta a barreira de quem pode alterar essa regra (exige migração, não só deploy de app).
- **Scope**: Todas as camadas com escrita transacional multi-tabela (Fundação, Planejamento, Incidência, Operação); qualquer feature futura que precise de atomicidade entre linhas/tabelas.
- **Date**: 2026-07-30
- **Status**: active

### AD-025
- **Decision**: O provisionamento do schema no Supabase é **incremental por feature**, não integral de uma vez. `docs/schema_sistema.sql` continua sendo o modelo aprovado por inteiro (AD-008), mas cada feature migra só as tabelas, funções e índices de que precisa, extraídos dele — verificando antes o que já existe no projeto remoto para não recriar nada.
- **Reason**: Nem todas as 51 tabelas do modelo aprovado estão de fato criadas no Supabase hoje (correção a `.specs/overview.md`, que afirmava incorretamente que as 32 — na verdade 51 — já estavam todas provisionadas). Migrar tudo de uma vez antes de qualquer feature adiaria a primeira entrega sem necessidade; o schema aprovado já existe como documento de referência, então cada feature pode puxar sua fatia sob demanda.
- **Trade-off**: Nenhuma migração única e completa existe como baseline — checar o que já está provisionado (`supabase db diff`/introspecção) vira um passo obrigatório no início da fase Tasks de toda feature que precisa de tabela nova, para não colidir com o que outra feature já criou.
- **Scope**: Todas as camadas; toda fase Tasks que inclui DDL novo.
- **Date**: 2026-07-30
- **Status**: active

### AD-026
- **Decision**: Para o público "Interno Legisla" (Gestora/Admin/áreas clientes), login por e-mail+senha (`supabase.auth.signInWithPassword`) substitui temporariamente o magic link na tela `/login`, enquanto o rate limit de e-mail do plano free da Supabase (~2/h) não é resolvido. A senha de cada conta é definida por uma ferramenta administrativa local (`service_role`, nunca exposta como rota HTTP) e repassada manualmente (Slack/WhatsApp) — nunca por e-mail.
- **Reason**: §5.3 da Constituição define **SSO Google Workspace** para este público, não login com senha nem magic link — mas configurar OAuth do Google (Cloud Console + Supabase Auth) não foi feito ainda, e o bloqueio é imediato (equipe sem conseguir testar a feature Fundação no Preview). Apresentado ao usuário como escolha entre SSO (aderente à Constituição) e senha (desvio, mais rápido de implementar); o usuário optou conscientemente por senha, priorizando velocidade.
- **Trade-off**: Divergência deliberada e temporária do método aprovado no §5.3 para este público — SSO Google Workspace continua sendo o método formalmente correto e deve ser revisitado quando houver tempo para configurá-lo. Enquanto esta decisão estiver ativa, tirar o magic link da tela de login também remove o acesso de Mentor/Consultor externo e Assessor do mandato (que dependem dele por §5.3); sem usuários reais desses papéis em uso hoje, mas registrado como regressão conhecida a resolver antes de onboarding externo real.
- **Scope**: Autenticação/Plataforma (transversal, §5.3/§5.5); tela `/login`, fluxo de provisionamento de usuário `@legislabrasil.org`.
- **Date**: 2026-07-31
- **Status**: active

### AD-027
- **Decision**: A identidade visual da marca (`Identidade Visual Legisla.md`) é aplicada globalmente via CSS custom properties em `src/frontend/app/globals.css` (mapeadas pros tokens que o shadcn/ui já lê — `cssVariables: true`), nunca por classe Tailwind explícita espalhada componente a componente. Toda tela autenticada nova entra dentro do route group `src/frontend/app/(app)/`, que carrega o layout aninhado com a sidebar fixa; rotas públicas/pré-sessão (`/login`, `/auth/*`) ficam fora desse grupo, sem sidebar.
- **Reason**: Design de `.specs/features/primeira-tela-cadastro/design.md`. CSS vars fazem todo componente shadcn herdar o tema automaticamente, sem tocar código de tela por tela (evita drift). Route group é o mecanismo oficial do Next.js App Router pra layouts parciais sem duplicar `<Sidebar>` manualmente e sem checar `pathname` em client component (frágil, causa flash).
- **Trade-off**: Toda feature de UI nova precisa nascer dentro de `(app)/` pra herdar a sidebar (fácil de esquecer se não for verificado); cores novas de marca (se a paleta mudar) exigem editar `globals.css` num único lugar, mas qualquer uso pontual de opacidade (`bg-primary/50`) sobre uma cor definida em hex (em vez de `oklch()`) precisa ser conferido visualmente — risco pequeno, não confirmado como problema real ainda.
- **Scope**: Todas as camadas de frontend; toda tela nova autenticada; toda decisão futura de paleta/tipografia.
- **Date**: 2026-07-31
- **Status**: active

### AD-028
- **Decision**: O gate de protótipo validado com assessor real antes de código de produção (AD-022) na tela de edição em grade dos Sucessos Mensais é dispensado. A feature avança sem essa aprovação externa prévia; a frase correspondente foi removida do §5.7 da Constituição.
- **Reason**: Ritmo de execução — esperar agenda de assessor real antes de escrever código de produção travava o avanço do projeto, e a Definição de Pronto (§6) não tem outra feature com esse tipo de gate.
- **Trade-off**: O risco de adoção descrito em §5.7 (assessores voltarem pro Sheets se a edição em grade não for rápida o bastante) deixa de ter uma validação externa prévia como mitigação. Passa a depender de revisão pós-implementação ou feedback informal — sem data nem responsável definidos ainda. Se a adoção falhar depois de construído, o retrabalho é maior do que teria sido com o gate.
- **Scope**: Planejamento & Monitoramento (Sucessos Mensais).
- **Date**: 2026-08-10
- **Status**: active

### AD-029
- **Decision**: O provider global de TanStack Query e o `<Toaster/>` do sonner montam no `app/layout.tsx` **raiz**, não em `(app)/layout.tsx` (AD-027). Sem `next-themes`. Os três componentes de estado padrão (`<CarregandoSkeleton>`, `<ErroInline>`, `<EstadoVazio>`) vivem em `components/ui/`, não em pasta própria.
- **Reason**: `/login` e `/auth/*` ficam fora do route group `(app)/` (AD-027) mas também precisam de toast/query — montar no route group deixaria essas rotas sem cobertura. O app não tem alternância de tema hoje; adicionar `next-themes` seria dependência sem consumidor real. `components/ui/` já tem precedente de composite específico do projeto (`confirm-delete-dialog.tsx`), então os 3 componentes de estado seguem o mesmo lugar em vez de criar `components/estado/`.
- **Trade-off**: o layout raiz ganha responsabilidade cross-cutting (dados + feedback) que a divisão de AD-027 não previa — é uma segunda camada de layout compartilhado, além da sidebar. Se dark mode for pedido depois, `next-themes` entra como feature própria, não como retrofit deste provider.
- **Scope**: `.specs/features/plataforma-ui-tanstack/`; toda tela nova, autenticada ou não.
- **Date**: 2026-08-10
- **Status**: active

### AD-030
- **Decision**: Tabelas de catálogo `ref_*` (somente-leitura, sem `id_contrato`/carteira pra filtrar por linha) são **exceção documentada ao AD-001** — usam modelo GRANT-only em vez de política de RLS por linha. Acesso é restrito a `authenticated` + roles `legisla_*`; `anon` nunca tem SELECT nelas. O GRANT a `anon` que a migration `0024_ref_tables_rls_fix.sql` tinha concedido nos 4 catálogos já existentes (`ref_cargo`, `ref_partido`, `ref_produto`, `ref_projeto`) foi revogado (`20260810183759_revoke_anon_grant_ref_tables.sql`).
- **Reason**: catálogo de referência não tem coluna de carteira pra RLS filtrar — controle de acesso é por GRANT de role, não por linha. Esse já era o desenho do schema aprovado (nenhum `ref_*` liga RLS, `docs/schema_sistema.sql`), mas nunca tinha sido documentado como exceção intencional ao AD-001 — ficava como divergência silenciosa entre o texto da regra e a prática (achado da Trilha C, `.specs/features/catalogos-referencia/`). O GRANT a `anon` nunca teve justificativa equivalente — contradizia AD-002 e a Regra Inegociável nº4 (§6 da Constituição, "nenhum acesso é anônimo") — e foi tratado como falha de segurança real, mesma prioridade da FND-USR-02.
- **Trade-off**: qualquer tabela nova rotulada `ref_*` que ganhe coluna de carteira/contrato no futuro precisa reavaliar se ainda se qualifica pra esta exceção, ou se volta a exigir RLS por linha como AD-001 pede por padrão.
- **Scope**: `ref_cargo`, `ref_partido`, `ref_produto`, `ref_projeto` + as 12 tabelas novas de `.specs/features/catalogos-referencia/`.
- **Date**: 2026-08-10
- **Status**: active

### AD-031
- **Decision**: O sistema atende só cargos do **Legislativo** — Vereador, Deputado Estadual, Deputado Federal, Senador (`cd_cargo_tse` 5, 6, 7, 13). Executivo (Prefeito(a), Vice-Prefeito(a), Governador(a)) está **fora de escopo**, confirmado por Pedro em 2026-08-10.
- **Reason**: as migrations `0022_cadastro_mandato_contrato_unificado.sql` e `0026_remove_cargos_nao_utilizados.sql` já restringiram a base do TSE e o catálogo `ref_cargo` a esses 4 cargos — inclusive apagando um vínculo `rel_mandato_candidatura` conhecido de Prefeito(a) — mas isso rodou em produção **sem decisão documentada antes** (achado da Trilha A, CMU-12/CMU-13, `.specs/features/cadastro-mandato-contrato-unificado/spec.md`). Esta entrada registra retroativamente a decisão que já foi executada; nada é revertido.
- **Trade-off**: qualquer carga futura de dado do TSE (`public.carrega_tse`, `DADOS TSE/carga_amostral.js`) precisa filtrar por esses 4 códigos de cargo **na origem**, ou uma carga nova desfaz silenciosamente a restrição das migrations 0022/0026. Débito ainda aberto (CMU-14 AC5) — ver Trilha A.
- **Scope**: schema `tse.*`, `ref_cargo`, `rel_mandato_candidatura`, qualquer ETL futuro de candidatura.
- **Date**: 2026-08-10
- **Status**: active

### AD-032
- **Decision**: `vw_carteira` (G1, carteira ponderada) nasce numa **versão reduzida, sem a coluna de IIP** (`iip_provisorio`/`nr_fatos`, que vêm de `mv_iip_contrato`) até a onda de Incidência (§6.2 do roadmap) existir. A versão completa, idêntica ao `docs/schema_sistema.sql:1327-1352` aprovado, substitui a reduzida quando `mv_iip_contrato` for criada — não é redesenho, é adoção tardia da mesma view já aprovada.
- **Reason**: `vw_carteira`, como aprovada, faz `JOIN` com `mv_iip_contrato` — em Postgres, `CREATE VIEW` falha se o objeto referenciado não existe. Como a onda de Operação (régua + Kanban + G1/G2, §5) roda antes da Incidência (§6.2) no roadmap, esperar a Incidência pra ter G1/G2 atrasaria as duas primeiras telas de gestão do sistema por uma coluna que ficaria `NULL` de qualquer forma até lá. Decisão de Pedro em 2026-08-10.
- **Trade-off**: existe uma janela em que a `vw_carteira` em produção diverge do texto de `docs/schema_sistema.sql` (menos uma consulta, não mais) — quem for construir a Incidência precisa **substituir**, nunca só adicionar por cima, a view reduzida pela completa, e apagar esta entrada do débito quando isso acontecer.
- **Scope**: `vw_carteira`; onda de Operação (§5) e Incidência (§6.2) do roadmap.
- **Date**: 2026-08-10
- **Status**: active — resolve quando a Incidência (§6.2) provisionar `mv_iip_contrato`

### AD-033
- **Decision**: 5ª exceção à lista fechada da AD-010 — **criação de conta via convite por
  contrato**. Uma rota de servidor Next.js (Route Handler pré-sessão, `service_role`, nunca exposta
  ao bundle do cliente — AD-009) pode chamar `auth.admin.createUser` pra criar a conta de um
  Mentor/Assessor convidado, fora do fluxo normal de RLS, porque quem chega ali não tem sessão
  nem `dim_usuario` ainda — não existe outro caminho. Mitigações obrigatórias, todas na mesma
  feature: token de uso único com hash (nunca token em claro), expiração de 7 dias, rate limit por
  IP na rota de consumo, guarda explícita de papel (RPC de consumo só grava
  `papel_global IN ('mentor','assessor')`, nunca `admin`/`gestora`, com `CHECK` na tabela **e**
  validação redundante no RPC), e auditoria de emissão/consumo em `log_auditoria`.
- **Reason**: AD-010 é lista fechada por design justamente pra impedir que "precisa de privilégio"
  vire porta dos fundos — mas Mentor/Consultor e Assessor externos nunca tiveram nenhum caminho de
  acesso ao sistema (nem magic link, nem senha combinada por Slack como o público interno,
  AD-026), então a Fundação de RBAC pra esses dois papéis (Constituição §3) existe só no modelo de
  dados. Decisão de Pedro em 2026-08-11, assumindo a opção recomendada em `spec.md`
  (`.specs/features/convite-contrato/spec.md`, linha "5ª exceção da AD-010").
- **Trade-off**: A lista de exceções da AD-010 deixa de ser "as 4 originais" e passa a precisar de
  releitura sempre que alguém cita aquela decisão de cabeça — cada exceção nova é uma superfície
  de `service_role` adicional a manter auditada. Esta é a primeira vez que o padrão AD-024
  (RPC `SECURITY INVOKER`, nunca `SECURITY DEFINER`) e a exceção AD-010 (`service_role`) convivem
  na mesma feature: o RPC de consumo (`app.consumir_convite`) continua `SECURITY INVOKER` — quem o
  chama sempre é o Route Handler via cliente `service_role`, que já ignora RLS por conta própria;
  não foi necessário nem desejável usar `SECURITY DEFINER` pra isso.
- **Scope**: Plataforma (identidade/acesso); feature `convite-contrato`; qualquer feature futura
  que precise criar conta Auth fora do fluxo normal de sessão.
- **Date**: 2026-08-11
- **Status**: active

---

## Handoff (Convite por Contrato — CONCLUÍDA e validada)

- **Feature**: Convite por Contrato / Acesso Externo (`.specs/features/convite-contrato/`) —
  **CONCLUÍDA e validada**, 11/11 requisitos (CVT-01 a CVT-11). Mentor/Consultor e Assessor
  externos, que nunca tiveram nenhum caminho de acesso ao sistema, agora criam conta pela primeira
  vez por token de uso único (hash gravado, nunca o token em claro) emitido pela Gestora/Admin na
  tela do contrato, sem depender de SMTP.
- **Phase / Task**: Specify já vinha escrito de sessão anterior; esta sessão confirmou as 6
  decisões sensíveis do `spec.md` (assumindo a recomendação em cada uma, sem rodada síncrona —
  pedido explícito de Pedro), rodou Design (`design.md`) → Tasks (16 tasks formais, `tasks.md`,
  execução inline sem sub-agentes de batch por pedido de Pedro) → Execute (T1-T16, 1 commit
  atômico por task) → Validate (Verifier independente, 2 rodadas — rodada 1 `❌ FAIL`, rodada 2
  `✅ PASS`) → 2 gaps residuais da rodada 2 fechados na mesma sessão.
- **Nova decisão de arquitetura**: **AD-033** (acima nesta mesma seção `## Decisions`) — 5ª exceção
  à lista fechada da AD-010, cobrindo a criação de conta via rota de servidor `service_role`
  pré-sessão.
- **Completed**: T1 tabelas+RLS (`ccc4ca4`) → T2 `app.emitir_convite` (`c41b0a7`, + fix de GRANT
  `legisla_*`) → T3 `app.consumir_convite` (`ec0f5d0`) → T4 `app.checar_rate_limit_convite`
  (`4e9c25b`) → T5 types (`fabf97f`) → T6-T10 backend TS puro (`9159231`..`fbfa892`) → T11-T12
  emissão (`6475e7a`, `af52a7b`, com fix de `DEFAULT NULL` em `app.emitir_convite`) → T13-T15
  consumo (`3d1abbe`, `c2c8ff7`, `0b63567`) → T16 comentário `admin.ts` (`d522668`) → Verifier
  rodada 1 (`❌ FAIL` — 1 Blocker, 3 Major, 3 Minor) → fix→re-verify (`ba3aa67`..`190f89e`) →
  Verifier rodada 2 (`✅ PASS`, 11/11 CVT) → fixes residuais pós-PASS (`33b6a3a`) →
  `validation.md`/lições (`9f13fb7`).
- **Achado real de segurança/arquitetura descoberto em Execute** (não estava em `design.md`,
  descoberto empiricamente ao rodar o 1º teste de integração de T2): o projeto troca o role
  Postgres efetivo por sessão via `app.custom_access_token_hook` (`legisla_app/admin/gestora/
  mentor/assessor`, nunca o `authenticated` genérico do PostgREST) — e todo `GRANT ... ON ALL
  TABLES IN SCHEMA public` só cobre as tabelas que já existiam no momento em que rodou (mesma
  exigência de AD-025 já documentada em `catalogos-referencia`, mas fácil de esquecer numa
  migration nova). T1 tinha concedido a `authenticated`, que nunca é o executor real — corrigido
  com migration forward-only (`20260812002624_convite_contrato_grants_legisla.sql`).
- **Achado do Verifier independente que mais importa pra próximas features** (rodada 1, Blocker):
  o proxy de sessão (`src/backend/supabase/proxy.ts`) bloqueia qualquer rota nova por padrão — sair
  do route group `(app)/` (AD-027) só remove a sidebar, **não** exime a rota do proxy, que casa por
  `pathname`. Toda rota pré-sessão nova (a exemplo de `/convite`) precisa entrar explicitamente na
  allowlist `isPublicRoute` (agora extraída como função pura testável,
  `src/backend/supabase/proxy.ts` + `proxy.test.ts`) — nenhum gate check (build/lint/testes
  unitários ou de integração) exercitava essa camada antes, e o Blocker sobreviveu a 16 tasks e 4
  gate checks sem sinal algum. Lição `L-009` registrada.
- **5 lições novas registradas** (`L-009` a `L-015`, `.specs/lessons.json`/`LESSONS.md`, candidate,
  recurrence=1): allowlist de rota pré-sessão nova no proxy; asserção por código de erro (não só um
  caso representativo); fixture com condições combinadas pra fixar precedência; spec deve declarar
  precedência quando dois estados de rejeição podem valer ao mesmo tempo; trigger genérico reusado
  exige asserção própria no destino; App Router não permite `page.tsx`+`route.ts` no mesmo segmento
  (SPEC_DEVIATION); fix sem asserção própria pode ser revertido em silêncio.
- **Next step**: nenhum obrigatório. Débito documentado e aceito conscientemente (não bloqueante):
  guarda de papel camada 2 (`CNV04` em `app.consumir_convite`) inalcançável em teste enquanto
  `ck_convite_papel` existir; edge case "Gestora perde vínculo antes do consumo" correto por
  construção, sem teste dedicado (ambos Minor, `validation.md` Fix 6/7). Recomenda-se UAT manual:
  Gestora convida um Mentor/Assessor de teste real, copia a URL, abre em aba anônima, define
  senha, confirma login automático e acesso restrito ao contrato — nenhuma verificação estática
  substitui esse caminho ponta a ponta com navegador real.
- **Blockers**: none (o único Blocker encontrado, proxy de sessão, foi corrigido e reverificado).
- **Uncommitted files**: none.
- **Branch**: develop.
- **Atenção — trabalho paralelo confirmado nesta sessão**: outra feature (`operacao-regua-instanciacao`)
  commitou intercalada neste mesmo branch `develop` durante a execução desta feature (T7-T11 dela,
  visíveis em `git log` entre os commits desta feature) — nenhum arquivo desta feature colidiu, mas
  um efeito colateral real apareceu: o trigger `trg_fat_contrato_instancia` dela passou a rodar em
  todo `INSERT` em `fat_contrato`, inclusive os fixtures de teste desta feature, exigindo limpeza
  adicional (`fat_etapa_contrato`/`rel_formulario_contrato`/`dim_planejamento`) nos `afterAll` dos
  testes de integração desta feature. Confirme `git status`/`git log` e o schema real (não só o
  `design.md`) antes de assumir que uma tabela como `fat_contrato` se comporta como quando a
  feature foi desenhada.

### AD-034
- **Decision**: `@dnd-kit/core` + `@dnd-kit/utilities` é a biblioteca de drag-and-drop do projeto
  (primeira feature a precisar de uma). Não `@dnd-kit/sortable` (sem reordenação manual dentro de
  uma coluna nesta feature), não `@dnd-kit/react` (reescrita pré-1.0, API instável), não
  `@atlaskit/pragmatic-drag-and-drop` (exige montar a própria camada de acessibilidade/colisão).
- **Reason**: Design de `kanban-etapas` (`.specs/features/kanban-etapas/design.md`, "Tech
  Decisions"). Comparados 3 candidatos via web search (Context7 indisponível na sessão — nenhum MCP
  conectado). `@dnd-kit/core` v6.3.1: maduro (~2.8M downloads/semana), peer dep `react >=16.8.0` sem
  teto (instala sob React 19.2.4 deste projeto), `KeyboardSensor` de acessibilidade pronto (WCAG),
  exemplo oficial "multi-container" é literalmente um board Kanban.
- **Trade-off**: Nenhuma confirmação pública explícita de teste contra React 19 (só ausência de
  teto no peer range) — risco baixo, aceito, documentado em `design.md` (Risks & Concerns). Se um
  board futuro precisar de reordenação manual dentro de uma coluna, `@dnd-kit/sortable` é o próximo
  pacote a avaliar (mesma família, sem reabrir a escolha de biblioteca).
- **Scope**: Operação dos produtos (Kanban de etapas); qualquer feature futura que precise de
  drag-and-drop (ex.: reordenar `ref_etapa.ordem` administrativamente, se um dia sair do Out of
  Scope).
- **Date**: 2026-08-12
- **Status**: active

---

### AD-035
- **Decision**: Funções de recômputo determinístico de coluna derivada/cache — que não aceitam
  nenhum parâmetro do chamador que controle *o que* é escrito, só *quando* recalcular — podem ser
  `SECURITY DEFINER` (com `SET search_path` explícito), mesmo quando disparadas por trigger a partir
  de uma escrita de um papel sem `GRANT` direto na tabela-alvo do recômputo. Aplicado a
  `app.recalcula_atingimento` e às 5 funções `app.trg_marca_desatualizado_*`/`app.trg_marca_por_meta_*`
  (`planejamento-planilha-monitoramento`, `20260812151909_planejamento_planilha_cascata_security_definer_fix.sql`).
  `app.recalcula_pendentes` fica `SECURITY INVOKER` — não escreve nada diretamente, só chama
  `recalcula_atingimento` via `PERFORM`, que já roda como `DEFINER` independente de quem a chamou.
- **Reason**: Achado de Execute (só apareceu rodando o teste de integração de RLS de verdade, não
  por leitura de código): as 6 funções foram extraídas verbatim do schema aprovado como
  `SECURITY INVOKER` (AD-024), mas escrevem em `dim_planejamento`/`fat_meta`/`fat_objetivo_especifico`
  — tabelas onde Mentor e Assessor só têm `GRANT SELECT` (`docs/schema_sistema.sql:2084-2089/
  2095-2098`). Qualquer `UPDATE`/`INSERT` do Assessor/Mentor em `fat_sucesso_mensal` (que eles TÊM
  permissão de escrever) dispara o trigger de marcação por baixo dos panos, que falhava com `42501`
  tentando marcar `dim_planejamento` como o próprio chamador — quebrando a escrita principal que
  deveria funcionar. Bloqueava o P1 inteiro da feature (Assessor editando a planilha, a tela mais
  acessada do sistema). Mesma categoria de exceção já usada por `app.trg_auditoria()`
  (`0012_fundacao_auditoria_gap.sql`) — escrita de sistema em tabela que o papel chamador
  legitimamente não tem `GRANT` direto, contra dado derivado do que ele já pode ler.
- **Trade-off**: Refina o alcance da AD-024 ("SECURITY DEFINER nunca é usado em escrita de negócio
  multi-tabela") para uma classe estreita e explícita: recômputo determinístico de valor
  derivado/cache, sem parâmetro de escrita livre. AD-024 continua valendo por padrão para toda RPC
  de negócio nova — esta exceção não se aplica a funções que aceitam dado arbitrário do chamador
  (ex.: `app.atualiza_sucessos_mensais_lote` continua `SECURITY INVOKER`, porque ali o chamador
  controla o valor escrito). Quem escrever a próxima função de recômputo de cache precisa avaliar
  explicitamente se ela se qualifica para esta exceção ou se é uma RPC de negócio comum.
- **Scope**: Planejamento & Monitoramento (cascata de atingimento); qualquer feature futura que
  precise de uma função de recômputo de coluna derivada/cache disparada por papel sem `GRANT` amplo
  na tabela de destino.
- **Date**: 2026-08-12
- **Status**: active

---

## Handoff (Kanban de Etapas — CONCLUÍDA e validada)

- **Feature**: Kanban de Etapas (`.specs/features/kanban-etapas/`) — **CONCLUÍDA e validada**, 10/10
  requisitos (KAN-01 a KAN-10). Primeira superfície de **escrita** de `fat_etapa_contrato` (AD-023):
  board por produto, uma coluna por `ref_etapa`, drag-and-drop grava a transição real via
  `app.mover_etapa_kanban`. Desbloqueia G1/G2 (`visao-gerencial-g1-g2`, próxima da onda), que agora
  encontra dado real (etapa como fato datado, AD-013) pra consumir.
- **Phase / Task**: Specify (já vinha escrito) → Discuss embutido (9 assumptions confirmadas por
  Pedro assumindo o default proposto, sem rodada de perguntas ao vivo) → Design (pesquisa de lib de
  drag-and-drop via web search, Context7 indisponível → `@dnd-kit/core`+`@dnd-kit/utilities`, AD-034;
  achados reais de infraestrutura documentados abaixo) → Tasks (11 tasks, 2 batches) → Execute (2
  batches de sub-agente, oferta aceita por instrução prévia do usuário) → Validate (standalone
  fallback, PASS de primeira, 1 gap Minor corrigido na mesma sessão).
- **Completed**: Batch 1 (DB+backend, T1-T5): `d355788` (T1, WITH CHECK+GRANT) → `c34137c` (T2,
  trigger de auditoria) → `8ede5c1` (T3, `app.mover_etapa_kanban`) → `98ba773` (T4,
  `buscarBoardKanban`/`buscarProjetosDoProduto`) → `093c46f` (T5, `moverEtapaKanban`+`TransicaoInvalidaError`)
  → `69774b2` (docs). Batch 2 (frontend, T6-T11): `2df7f79` (T6, instala `@dnd-kit`) → `a729a7e` (T7,
  `KanbanCard`) → `fda180b` (T8, `KanbanColuna` droppable) → `60e2495` (T9, `KanbanBoard` — DndContext +
  mutation otimista) → `8655c3d` (T10, filtro projeto+minha carteira) → `de8c3cf` (T11, substitui
  `<EmDesenvolvimento>` no Dashboard do produto) → `8569c31` (docs) → `93da61f` (validation.md) →
  `c05de7e` (lições L-016 a L-018). Fix pós-Validate: `ccb0694` + `1592f9b` (mutante sobrevivente
  fechado — teste de contrato encerrado continuando visível no board).
- **Achado real de infraestrutura durante Design, corrigido no Batch 1** (não eram assumption — fato
  do banco, descoberto lendo migrations): (1) `fat_contrato.p_por_carteira`
  (`0011_fundacao_rls.sql`) nunca teve `WITH CHECK` explícito, só `USING` — mesma categoria de risco
  da FND-USR-02; (2) `legisla_mentor`/`legisla_assessor` nunca receberam nenhum `GRANT UPDATE` em
  `fat_contrato`/`fat_etapa_contrato` em nenhuma migration — sem corrigir isso, "Mentor move card pra
  frente" (P1) era impossível pelo `GRANT`, avaliado antes da RLS. Os dois fechados em `d355788`
  (`GRANT UPDATE` column-scoped, least privilege). SPEC_DEVIATION colateral no mesmo commit:
  `regua-rls.integration.test.ts` (RGI-08) exercia um `.update()` que o `GRANT` novo passou a
  permitir legitimamente — trocado pro `.insert()` que o título do teste sempre disse testar.
- **Achado real durante Batch 1, sessão travada por limite de API**: o primeiro agente de batch
  (T1-T5) caiu por limite de sessão no meio da T5 — T1-T4 já estavam implementadas e com gate real
  passando, mas **nenhum commit tinha sido feito** (T3 já estava aplicada no banco de dev via
  `db push`, confirmado por `supabase migration list`, mas só chegava a existir como arquivo local
  não commitado). O orquestrador desta sessão verificou cada entrega com o gate real (não
  self-assessment) antes de commitar T1-T4 e completou a T5 inline (sem novo sub-agente) —
  `errors.ts`/`TransicaoInvalidaError`/`rpc/kanban.test.ts` não existiam ainda quando a sessão caiu.
- **Achado real do Validate (Batch 2, PASS com 1 gap Minor)**: sensor de discriminação (4 mutações,
  camada backend-unit) matou 3/4; a 4ª (filtro silencioso por `status='ativo'` em `buscarBoardKanban`)
  sobreviveu — comportamento já estava correto (Edge Case "contrato encerrado continua visível"),
  só faltava a prova automatizada. Corrigido no mesmo dia (`ccb0694`). O Verifier desta sessão
  **deliberadamente não mutou a camada DB** (função/policy já implantada no projeto de dev
  compartilhado) por outra sessão de agente estar committando em paralelo no mesmo repo/banco durante
  a validação — risco documentado no próprio `validation.md`, mesma categoria de cautela que
  `CLAUDE.md` pede pra SQL ad-hoc fora do fluxo de migration. A camada DB foi reconfirmada ao vivo
  (recorte `supabase/tests/kanban`, 15/15 verde) em vez de mutada.
- **Débito estrutural conhecido, não desta feature**: nenhum componente de UI (T6-T11) tem cobertura
  automatizada — sem harness de componente React no projeto (mesmo débito já documentado nas lições
  L-006/L-007, `plataforma-ui-tanstack`/`navegacao-por-produto`). Verificado por `npm run build &&
  npm run lint:all` (limpo, baseline inalterada de 27 problemas pré-existentes) e inspeção de código.
- **Next step**: nenhum obrigatório. `visao-gerencial-g1-g2` (próxima da onda) já encontra dado real
  pra G1/G2. UAT manual recomendado, não bloqueante: arrastar um card de verdade no navegador
  (avanço, retrocesso como Gestora, tentativa de retrocesso como Mentor, salto de coluna) — nenhum
  harness de componente cobre isso automaticamente.
- **Blockers**: none.
- **Uncommitted files**: none desta feature. `.specs/STATE.md` (este arquivo) e
  `.specs/features/planejamento-planilha-monitoramento/{design.md,tasks.md}` tinham edições de outra
  sessão em paralelo (AD-035, acima) já no working tree antes deste Handoff ser escrito — não
  criadas por `kanban-etapas`, não tocadas por este Handoff.
- **Branch**: develop.
- **Atenção — trabalho paralelo confirmado nesta sessão**: `planejamento-planilha-monitoramento`
  commitou intercalado neste mesmo branch `develop` durante a execução de todo o Batch 2 (commits
  `84b5643`..`a4aed5f`, ver `git log`) — nenhum arquivo desta feature colidiu (confirmado por
  `git show --stat` por commit, ver `validation.md`). `.specs/STATE.md` teve a mesma corrida de
  escrita já documentada em handoffs anteriores (AD-034 desta feature foi commitado pela sessão de
  `operacao-regua-instanciacao` sem querer, por escrita no mesmo working tree — sem perda de dado,
  só atribuição de commit "errada").

---

## Handoff (Régua de Etapas e Instanciação — CONCLUÍDA e validada)

- **Feature**: Régua de Etapas e Instanciação (`.specs/features/operacao-regua-instanciacao/`) —
  **CONCLUÍDA e validada**, 10/10 requisitos (RGI-01 a RGI-10). Desbloqueia **`kanban-etapas`** (que
  já está em Design paralelo nesta mesma sessão de STATE.md — ver AD-034 acima, escolha de
  `@dnd-kit`) e **`planejamento-planilha-monitoramento`**: as duas dependiam só de `fat_etapa_contrato`
  / `dim_planejamento` existirem no banco — agora existem.
- **Phase / Task**: Specify+Discuss já vinham completos de sessão anterior (`spec.md`/`context.md`,
  7 pontos "a confirmar" resolvidos assumindo o default proposto em cada um, a pedido de Pedro —
  incluindo correção de um erro de texto no Independent Test do 3º User Story, que dizia "Gestora
  sem vínculo bloqueada" quando o próprio AC1/AC3 nunca bloqueia Gestora por vínculo). Esta sessão
  rodou Design (`design.md`) → Execute inline (11 tasks, abaixo do limiar de sub-agente) → Validate
  (Verifier independente, 1 rodada, `✅ PASS` de primeira).
- **Completed**: T1-T4 schema (`e643384`..`670346a`, uma migration/commit por task: DDL verbatim →
  RLS com `WITH CHECK` explícito → grants → função verbatim + trigger + backfill) → T5/T6 fix do
  achado de Design (`4dea444`, `ca5be45`) → T7/T8 testes de integração novos (`5432d16`, `29d4b59`)
  → T9 `db:types` (`7dad335`) → T10 query+unit test (`3c53a43`) → T11 tela da régua (`aeb7687`) → T5
  fix2 de round-trip/timeout achado ao rodar a suíte inteira (`1f35ad8`) → docs/gate check
  (`2255cb7`) → Verifier independente (`aa6b6e2`, `✅ PASS`, sensor 3/3 killed).
- **Achado de Design real, fora do spec original**: o trigger novo faz `fat_etapa_contrato`/
  `rel_formulario_contrato`/`dim_planejamento` (todas `ON DELETE RESTRICT` em `fat_contrato`, verbatim
  do schema aprovado) nascerem para **todo** contrato — inclusive os das fixtures de teste e os
  criados pela UI. Isso quebrava, sem nenhuma mudança própria neles, 3 fluxos de exclusão do
  frontend (`contratos/page.tsx`, `mandatos/page.tsx`, `mandatos/[id]/page.tsx`) e 9 call-sites em 6
  arquivos de teste pré-existentes (`plataforma-tabelas`, `fundacao-tabelas` ×2, `fundacao-rls`,
  `fn-substituir-vinculo`, `fn-criar-mandato`, `auditoria-gap` ×3) que faziam `DELETE FROM
  fat_contrato` sem apagar os filhos antes. Todos os 12 pontos corrigidos (`4dea444`/`ca5be45`), e
  o Verifier confirmou via grep exaustivo do repositório que não sobrou nenhum ponto residual —
  inclusive 2 call-sites da feature paralela `convite-contrato`, que já se autocorrigiu citando esta
  feature em comentário.
- **2º achado, descoberto só ao rodar `npm run test:integration` completo pela 1ª vez** (não
  antecipável por leitura de código): os 3 `DELETE` novos de cada fixture de teste, cada um um
  round-trip próprio via Management API (~4-10s), empurraram 3 fixtures que já estavam perto do
  limite de 30s (`hookTimeout`/`testTimeout` padrão do Vitest) pra além dele. Nenhuma falha de FK —
  puro custo de round-trip. Corrigido combinando os 3 `DELETE`s num único `runSql` (1 round-trip) +
  timeout explícito de 60s nos pontos que ainda ficavam justos (`1f35ad8`). Lição: **qualquer
  cleanup de teste que ganhe mais de 1-2 statements novos deve ser combinado num único `runSql`, não
  virar `await` sequenciais** — cada um paga o custo fixo do `supabase db query --linked` via
  Management API.
- **Decisão de UI registrada, não pedida no spec**: `etapas/[codigo]/page.tsx` (placeholder deixado
  pela Trilha F) agora mostra a régua **completa** do produto em toda aba de etapa (não só a etapa
  do `codigo` da URL), com a linha correspondente destacada — resolve a ambiguidade do AC1 sem
  inventar rota nova. TanStack Query/Table (mencionado como aspiração em `roadmap.md` §1.3) foi
  deliberadamente **não** adotado aqui — SPEC_DEVIATION registrada em `design.md`, mantendo
  consistência com o padrão `useEffect`/`useState` do componente pai (`FichaContratoChrome`).
- **Verifier**: `PASS ✅` de primeira. Gate 5/5 comandos verdes (14+53+158 testes automatizados,
  build ok, lint na mesma baseline de 27 problemas pré-existentes). Sensor 3/3 mutações mortas (1 TS
  em `buscarReguaDoContrato`, 2 SQL em `vw_etapa_contrato`/`app.instancia_contrato`, aplicadas e
  revertidas ao vivo no banco de dev via `supabase db query --linked`). 2 observações Minor
  não-bloqueantes: UI sem teste de componente (padrão vigente do projeto — zero testes de UI em todo
  o repositório, não é regressão desta feature) e edge case de coalizão sem asserção de contagem
  dedicada (comportamento correto, só falta o teste explícito). Relatório completo em
  `.specs/features/operacao-regua-instanciacao/validation.md`.
- **Next step**: nenhum obrigatório de código. Quem abrir `kanban-etapas` (já em Design, AD-034)
  pode escrever em `fat_etapa_contrato.status`/`id_etapa_atual` (esta feature nunca grava
  `id_etapa_atual` — é responsabilidade exclusiva do Kanban, por decisão registrada em `context.md`
  desta feature). Quem abrir `planejamento-planilha-monitoramento` encontra `dim_planejamento` vazia
  (só `id_contrato`), pronta para receber a hierarquia Objetivo→Meta→Sucesso Mensal. Os 2 Minor do
  Verifier são candidatos a fechar quando o projeto adotar teste de componente (se algum dia adotar)
  ou numa passada futura de profundidade de teste — nenhum dos dois impede uso real.
- **Blockers**: none.
- **Uncommitted files**: none.
- **Branch**: develop.
- **Atenção — trabalho paralelo confirmado nesta sessão**: pelo menos duas outras features
  commitaram intercaladas neste mesmo branch `develop` durante a execução desta feature —
  `convite-contrato` (concluída e validada, ver handoff acima) e `kanban-etapas` (em Design, AD-034
  acima). Nenhum arquivo desta feature colidiu (confirmado por `git status` antes de cada `git add`
  em toda task). `STATE.md` teve pelo menos 3 sessões escrevendo neste arquivo compartilhado ao
  longo desta janela — a ordem final das seções `### AD-0NN` e `## Handoff` neste arquivo reflete
  isso (AD-034 aparece depois do Handoff de `convite-contrato`, não antes — não é erro desta sessão,
  já estava assim quando este handoff foi inserido; não reordenado de propósito, para não colidir
  com edição concorrente).

---

## Handoff (Navegação por Produto — Trilha F — CONCLUÍDA e validada)

- **Feature**: Navegação por Produto (`.specs/features/navegacao-por-produto/`) — **CONCLUÍDA e
  validada**, 15/15 requisitos (NAV-01 a NAV-15). Substitui a landing page pós-login por um hub de
  4 produtos (Estratégia/PLL/Coalizão/Visão Gerencial), cada produto operado com 4 abas fixas
  (Dashboard/Agenda/Contratos/Cadastro de novo Contrato), e uma ficha operacional nova por
  contrato (`/contratos/[id]`) reaproveitada entre mandato e coalizão.
- **Phase / Task**: Specify+Discuss já vinham completos de sessão anterior (`spec.md`/`context.md`,
  7 pontos "a confirmar" resolvidos por Pedro no início desta sessão, todos com o default
  proposto). Esta sessão rodou Design (`design.md`) → Tasks (25 tasks formais, `tasks.md`, 4 lotes
  de sub-agente — Pedro aceitou a oferta) → Execute (4 lotes sequenciais, T1-T25) → Validate
  (Verifier independente, 1 rodada, PASS de primeira).
- **Completed**: Lote 1/T1-T6 tipos+queries (`8c186bf`..`f559f82`, 111 testes unitários) → Lote
  2/T7-T11 infra de UI + Hub (`24bc4d6`..`e7dfe69`) → Lote 3/T12-T17 área de produto
  (`5253557`..`ac1a0f2`) → Lote 4/T18-T25 Cadastro de novo Contrato + ficha do contrato
  (`52cf42e`..`5913c0c`) → Verifier independente (`✅ PASS`, 15/15, sensor 3/3 killed) →
  `spec.md`/`validation.md`/`STATE.md`/`roadmap.md`/lessons (commit desta sessão).
- **Achado real durante T1** (não estava em `design.md`, descoberto empiricamente): regenerar
  `database.types.ts` (pra tipar `ref_etapa`, nunca tipada desde a Trilha C) expôs um gap de tipo
  pré-existente em `rpc/mandato.ts:54` (`p_id_contratante_existente ?? null` incompatível com o
  `Args` de `app.criar_mandato` corretamente tipado agora — o type antigo incompleto mascarava
  isso). Corrigido dentro do escopo ampliado da própria T1 (1 linha, aprovado explicitamente antes
  do worker prosseguir) — não é regressão desta feature, é dívida que só ficou visível ao corrigir
  os types.
- **2 achados Minor do Verifier, ambos corrigidos na mesma sessão** (Pedro pediu pra corrigir na
  hora em vez de adiar pra Trilha E; nenhum invalidava um AC): (1) erro de RLS no Cadastro de novo
  Contrato não passava por `<ErroInline>` (AD-029) como o `design.md` prometia —
  `ContratoForm`/`MandatoWizard` (pré-existentes) usavam um `<p>` bruto; `<ErroInline>` tinha zero
  consumidores em todo o repositório — **corrigido em `b8b9445`**. (2) a aba "Nenhuma etapa
  cadastrada" (edge case que "não deveria acontecer") deixava a tela presa em
  `<CarregandoSkeleton>` em vez de mostrar a mensagem, porque o redirect de `/contratos/[id]` não
  tratava o caso de zero etapas — **corrigido em `61568ff`**. Build/lint reconferidos verdes após
  as duas correções, mesma baseline de 27 problemas pré-existentes. Lição `L-008` (candidate)
  registrada sobre o padrão #1 (continua válida como lição, independente da correção pontual).
- **Adição pós-Validate (NAV-16, mesma sessão)**: Pedro pediu, depois do Verifier já ter fechado
  PASS, uma aba "Informações Gerais" na ficha do contrato de mandato com os dados de TSE (versão
  completa — accordion por ano + perfil pessoal + gráfico de eleitorado, mesmo conteúdo de
  `/mandatos/[id]`, confirmado por Pedro em vez de uma versão simplificada). Implementado como
  componente novo e independente (`InformacoesTseMandato`, `components/fundacao/`) que **não**
  toca `/mandatos/[id]/page.tsx` (745 linhas, delicado, sem teste de frontend) — duplica ~150
  linhas de fetch/JSX deliberadamente em vez de arriscar extrair dali. Nova aba é a primeira da
  barra (antes das etapas) e também virou a tela de chegada padrão da ficha pra contrato de
  mandato (redirect de `/contratos/[id]`). `buscarContratoParaFicha` ganhou `idMandato` no retorno.
  Commits: `3dfe907` (idMandato) → `b047c0c` (componente) → `430aace` (rota) → `ffca585`
  (liga aba+redirect). Build/lint/testes reconferidos verdes a cada commit, mesma baseline (27
  problemas, 111 testes). **Não passou por um novo ciclo de Verifier independente** — é uma
  adição pontual pós-fechamento, não uma feature nova; registrado como NAV-16 em `spec.md`
  (Requirement Traceability) com status "Implemented", não "Verified".
- **Next step**: nenhum obrigatório. Os 2 achados Minor do Validate original já foram corrigidos
  nesta sessão, e NAV-16 (acima) também já está implementado e com gate verde. Recomenda-se UAT
  manual pros itens que o Verifier original marcou ⚠️ (destaque visual da aba ativa; comportamento
  real de 404 HTTP em `/produtos/xis` e `/contratos/999999999` sob sessão autenticada — não
  executável numa verificação estática) e, se quiser rigor formal, um Verifier independente sobre
  NAV-16 especificamente (não rodado ainda).
- **Blockers**: none.
- **Uncommitted files**: `.specs/STATE.md`/`.specs/roadmap.md` tinham edições pré-existentes de
  sessão anterior já no working tree antes desta sessão começar (não criadas por esta feature) —
  incorporadas ao commit de fechamento desta feature junto das atualizações de `spec.md`/
  `validation.md`/lessons, por não haver stage parcial de hunk disponível neste ambiente.
- **Branch**: develop.

---

## Handoff

- **Feature**: Catálogos de Referência — Trilha C (`.specs/features/catalogos-referencia/`) — **CONCLUÍDA e validada**, 17/17 requisitos de código (CAT-01 a CAT-15, CAT-17, CAT-18; CAT-16 permanece `Pending` de propósito — bloco de rastreamento sem código, levantamento humano com Monitoramento).
- **Phase / Task**: Specify → Design já vinham completos de sessão anterior (`context.md`/`spec.md`/`design.md`, D9 já resolvida por Pedro). Esta sessão rodou Tasks (4 tasks, `tasks.md`, single batch ≤8 — sem oferta de sub-agente) → Execute (T1-T4, uma migração + um commit por task) → Validate (Verifier independente, 2 rodadas).
- **Completed**: T1 DDL das 12 tabelas (`50640f7`) → T2 GRANT/RLS-disable + revoke de default privileges (`d996a67`) → T3 seed das 9 tabelas aprovadas (`e88ac11`) → T4 seed da régua da Coalizão/D9 (`93e5e67`) → Verifier rodada 1 (`❌ FAIL`, 8 gaps — 1 Blocker de lint, 2 Major, 5 Minor, todos de profundidade de teste, nenhum de DDL/GRANT/seed incorreto) → fix→re-verify (`38da907`) → Verifier rodada 2 (`✅ PASS`, 17/17, sensor 3/3 killed) → `spec.md`/`validation.md` (`f3cfba6`).
- **Achado real de segurança durante T2** (não estava em `context.md`/`design.md`, descoberto empiricamente): o `ALTER DEFAULT PRIVILEGES` de baseline do projeto Supabase concede CRUD completo (`arwdDxtm`) a `anon` e `authenticated` em toda tabela NOVA de `public`, independente de qualquer GRANT explícito da migração. Corrigido nas 12 tabelas novas via `REVOKE ALL ... FROM anon` + `REVOKE INSERT,UPDATE,DELETE ... FROM authenticated` (migração `20260810193545_catalogos_referencia_revoke_default_privileges.sql`). **Os 4 catálogos antigos (`ref_produto`/`ref_projeto`/`ref_cargo`/`ref_partido`) continuam com esse gap em aberto** — `20260810183759_revoke_anon_grant_ref_tables.sql` só revogou `SELECT` de `anon`, nunca `INSERT`/`UPDATE`/`DELETE` — ou seja, hoje `anon` ainda consegue escrever nessas 4 tabelas sem sessão. Corrigir isso é fora do escopo desta feature (exigiria migração tocando tabela que não é destas 12); candidato a item avulso de Trilha E, mesma prioridade de achados de segurança anteriores (FND-USR-02, AD-030).
- **Recomendação registrada, não decretada** (`STATE.md` não era read-only nesta sessão, mas a decisão é do usuário): considerar uma emenda curta a AD-001 explicitando a exceção de catálogo (RLS desabilitada + GRANT-only para tabelas `ref_*` sem `id_contrato`) — hoje essa exceção só existe por precedente de código (`0024`, e agora estas 12 novas) e por este handoff, nunca como texto formal do AD-001. Mencionado também em `context.md`/`design.md` desta feature.
- **Next step**: nenhum obrigatório de código. CAT-16 (conteúdo real de `ref_agenda_tematica`/`ref_indicador`/`ref_tipologia`) depende de levantamento humano com o time de Monitoramento — trabalho fora do que qualquer agente pode produzir. `npm run db:types` não foi rodado (decisão de design: sem consumidor de aplicação nesta fatia — quem construir a primeira tela/feature de Operação/Planejamento que leia estas 12 tabelas deve rodá-lo como parte daquele trabalho).
- **Blockers**: none.
- **Uncommitted files**: none.
- **Branch**: develop.
- **Atenção — trabalho paralelo confirmado nesta sessão**: outras duas features (`plataforma-ui-tanstack`, `cadastro-mandato-contrato-unificado`) commitaram intercaladas neste mesmo branch `develop` durante a execução desta feature — nenhum arquivo desta feature colidiu (confirmado por `git status`/`git show --stat` antes de cada `git add`). Ver a entrada de handoff de `cadastro-mandato-contrato-unificado` logo abaixo para a lista completa de commits intercalados.

---

## Handoff (Cadastro de Mandato e Contrato Unificado — CONCLUÍDA e validada)

- **Feature**: Cadastro de Mandato e Contrato Unificado (`.specs/features/cadastro-mandato-contrato-unificado/`) — **CONCLUÍDA e validada**, 16/16 requisitos (CMU-01 a CMU-16), primeira Validate formal desta feature.
- **Phase / Task**: Design de CMU-15/16 já vinha completo de sessão anterior (escopo Medium — sem `tasks.md` formal, Execute direto com lista inline de passos). Execute desta sessão: CMU-15 (contrato próprio da coalizão), CMU-16 (fix FND-COL-03), CMU-04 (ação na condição de corrida) e CMU-14 AC5 (filtro de cargo no loader do TSE) — as duas últimas eram itens abertos na auditoria da sessão anterior, resolvidos por decisão explícita de Pedro ("corrigir agora" nos dois). Verifier independente (autor ≠ verificador) rodou 2x: rodada original — 16/16 ACs endereçados, sensor **FAIL** (2/3 mutantes sobreviventes, ambos gap de cobertura de teste de backend em `app.criar_mandato`/`errors.ts`, nenhum bug de comportamento); Fix Round 1 (`7abb6b0`, testes novos) → re-verificação independente → sensor **PASS** (3/3 killed), gate 93 unit + 9 integration. Achado adicional do Verifier (CMU-05, spec-precision gap — wizard duplica `contratoSchema`/`membroCoalizaoSchema` local em vez de importar) foi levado a Pedro, que decidiu aceitar como débito documentado, sem refactor. Relatório completo em `.specs/features/cadastro-mandato-contrato-unificado/validation.md`.
- **Completed**: CMU-16 (`c8a2e25`) → CMU-15 (`a39e500`) → CMU-04 (`487dc7d`) → CMU-14 AC5 (`d4dba31`) → Verifier rodada 1 (FAIL no sensor) → Fix Round 1 testes (`7abb6b0`) → Verifier re-verify (PASS) → spec.md/validation.md/lessons (`f347e51`).
- **Next step**: nenhum obrigatório de código. Q4 do `spec.md` ("Perguntas abertas para Pedro") continua genuinamente aberta e de baixa prioridade — decidir se `/mandatos/[id]/contratos/novo` (rota órfã) deve ser removida numa trilha futura, ou fica de propósito como fallback. Nenhuma ação bloqueante.
- **Blockers**: none.
- **Uncommitted files**: none.
- **Branch**: develop.
- **Atenção — trabalho paralelo confirmado nesta sessão**: outras duas features (`plataforma-ui-tanstack`, `catalogos-referencia`) commitaram intercaladas neste mesmo branch `develop` durante a execução desta feature (`1374f26`, `d19c59f`, `f581d82`, `dd45087`, `266dfba`, `932c1fd`, `bd160be`, `e2c5a06` da primeira; `50640f7`, `d996a67`, `e88ac11`, `93e5e67` da segunda). Nenhum arquivo desta feature colidiu. `.specs/lessons.json`/`.specs/LESSONS.md` chegaram a ter 3 sessões escrevendo lessons candidatas no mesmo working tree ao mesmo tempo (`L-003..L-006` desta feature, `L-007` de `plataforma-ui-tanstack`) — comitado em `f347e51` já com as duas misturadas (arquivo compartilhado e cumulativo por design, sem conflito real). Confirme `git status`/`git log` antes de escrever em arquivo compartilhado (`package.json`, `package-lock.json`, `.specs/lessons.json`, `.specs/STATE.md`).

---

## Handoff (Plataforma de UI — TanStack + Estados Padrão — CONCLUÍDA)

- **Reconstruído em 2026-08-10** — esta seção foi perdida do arquivo por uma corrida de escrita entre
  as 3 sessões paralelas de hoje: o commit `e2c5a06` a escreveu corretamente na seção genérica
  `## Handoff`, mas o commit seguinte (`2dabf9d`, de `cadastro-mandato-contrato-unificado`) substituiu
  aquele conteúdo pelo próprio sem renomeá-lo primeiro — quebra da convenção que os outros dois
  commits (`e2c5a06` e `bcd71c9`) seguiram certo. Nada foi perdido de código ou de decisão: reconstruído
  aqui a partir de `.specs/features/plataforma-ui-tanstack/validation.md` (íntegro).
- **Feature**: Plataforma de UI — TanStack Query/Table + toast global + estados padrão
  (`.specs/features/plataforma-ui-tanstack/`) — **CONCLUÍDA**, 11/12 ACs verificados por código; 1/12
  (PUI-06) code-verified mas com confirmação visual pendente de UAT manual (não é gap de código).
- **Phase / Task**: Specify+Design já vinham completos de sessão anterior (escopo Medium — sem
  `tasks.md` formal). Execute rodou como lista inline de 6 passos: instalar
  `@tanstack/react-query`+`@tanstack/react-table`, montar `QueryClientProvider`+`<Toaster/>` no
  `app/layout.tsx` raiz (`getQueryClient()` factory SSR-safe, sem `next-themes` — AD-029), e os 3
  componentes de estado (`CarregandoSkeleton`, `ErroInline`, `EstadoVazio`) em `components/ui/`.
  Verifier independente: sensor 0/3 killed (esperado — projeto não tem suíte de teste de componente de
  UI, débito preexistente documentado no `design.md`), gate `npm run build` ✅ (15/15 rotas),
  `lint:all` ❌ mas só por 35 problemas pré-existentes fora do escopo desta feature (lint escopado aos
  8 arquivos da feature: 0 erros).
- **Completed**: instalar deps (`1374f26`) → provider+Toaster (`d19c59f`) → `CarregandoSkeleton`
  (`f581d82`) → `ErroInline` (`dd45087`) → `EstadoVazio` (`266dfba`) → rastreabilidade do spec
  atualizada (`932c1fd`) → Verifier independente (`bd160be`).
- **O bug que esta feature corrige**: `sonner` já estava instalado e chamado (`toast.success`/
  `toast.error`) em 5 telas (`mandatos`, `coalizoes`, `usuarios`, `contratos`, `mandatos/[id]`), mas
  nenhum `<Toaster/>` estava montado em lugar nenhum da árvore — essas chamadas não produziam nada
  visível. Corrigido montando exatamente 1 `<Toaster/>` no layout raiz.
- **Next step — UAT manual obrigatório antes de considerar PUI-06 fechado** (nenhum dos itens abaixo é
  gap de código, é confirmação visual que só um humano faz):
  1. Abrir `/mandatos`, excluir um registro de teste, confirmar que o aviso de sucesso aparece.
  2. Forçar uma exclusão negada por permissão, confirmar que o aviso de erro aparece.
  3. Abrir `/mandatos`, `/coalizoes`, `/usuarios`, `/contratos` e confirmar que continuam funcionando
     exatamente como antes (nenhuma tela existente foi tocada pelos 6 commits desta feature).
  4. Renderizar os 3 componentes de estado com dado de exemplo e confirmar visualmente os 3 estados.
- **Blockers**: none (os itens de UAT acima são recomendados, não bloqueantes).
- **Uncommitted files**: none.
- **Branch**: develop.
- **Atenção — trabalho paralelo confirmado nesta sessão**: outras duas features
  (`cadastro-mandato-contrato-unificado`, `catalogos-referencia`) commitaram intercaladas neste mesmo
  branch `develop` durante a execução desta feature. Nenhum arquivo desta feature colidiu — mas a
  própria seção de handoff deste bloco colidiu (ver nota de reconstrução no topo). Qualquer sessão
  futura que escreva em `STATE.md`/`.specs/roadmap.md` enquanto outra sessão pode estar rodando em
  paralelo deve **renomear a seção `## Handoff` genérica existente antes de substituí-la**, nunca
  sobrescrever direto.

---

**Correção (2026-07-31, mesma sessão)**: a entrada anterior deste arquivo dizia "Fase 5 pendente (T29-T37)" — **isso estava errado**, herdado sem verificação de um handoff represado mais antigo (ver nota de manutenção abaixo, agora obsoleta). Conferido direto em `tasks.md`: as 5 fases (T1-T37) estão **completas**, e `validation.md` da própria feature já existe (Verifier PASS com ressalvas: 20/26 requisitos ✅ Verified, 5 "Needs Fix" conhecidos e não-bloqueantes, 1 conflito spec/schema documentado — ver `.specs/features/fundacao-entidades-pessoas/validation.md`). Rotas `/mandatos/novo`, `/mandatos/[id]`, `/coalizoes/novo`, `/coalizoes/[id]`, `/usuarios`, `/contratos/[id]/vinculos` já existem e funcionam (não são placeholder).

## Handoff (Fundação — Entidades e Pessoas — CONCLUÍDA e validada)

- **Feature**: Fundação — Entidades e Pessoas (`.specs/features/fundacao-entidades-pessoas/`) — feature completa (Specify → Design → Tasks → Execute T1-T37 → Validate).
- **Status real**: todas as 5 fases implementadas e commitadas; `validation.md` já escrito. 5 itens "Needs Fix" conhecidos (não-bloqueantes, ver `validation.md` → Fix Plans): FND-TSE-01/FND-TSM-01 (filtro de cargo não exposto na busca TSE), FND-CTR-05 (snapshot de cargo/partido no contrato nunca populado), FND-USR-02 (Gestora criando Gestora barrado só na UI, sem `WITH CHECK` de RLS), FND-COL-03 (seletor de membro de coalizão lista todo `fat_contrato`, não filtra `tipo_contratante='mandato'`). Mais 1 conflito spec/schema documentado (FND-TSE-03: rejeitar sugestão TSE não persiste, só descarta client-side, porque `rel_mandato_candidatura.id_mandato` é `NOT NULL`).
- **Lacuna real (não é bug, é escopo nunca pedido)**: não existe rota `/mandatos` nem `/coalizoes` (índice/lista) — só `novo` e `[id]` pra cada. A tela de detalhe do mandato (`/mandatos/[id]`) mostra só metadados de match TSE (ano, status, confiança, vigente), não os dados de votação em si (`qt_votos_total`, `ds_situacao_candidatura` etc. de `tse.mv_candidatura_resumo` nunca são lidos/exibidos ali).
- **Next step**: nenhum obrigatório — os 5 Needs-Fix são débito conhecido, não bloqueiam uso. Se uma feature nova precisar de tela de listagem/cards ou dos dados de votação do TSE, é trabalho novo (não uma continuação de tasks.md desta feature).
- **Ambiente confirmado**: projeto Supabase de dev `sistema-mandatos-dev` (`npnvoolkebhabjkjzqwn`, `sa-east-1`), separado do projeto de produção (AD-020). CLI v2.110.0, linkada. Docker não instalado — testes de integração rodam contra este projeto remoto.
  - **Correção (2026-08-06)**: na época deste handoff (31/07) o projeto de produção ainda não existia — foi criado só em 06/08 com ref `dgoutrbqfuyaroobhxdq` (não `mgoeloqdlpgkofgqqbjs`, valor incorreto que estava aqui). Ver `docs/ambientes.md` para os refs corretos e atuais.
- **Lições ativas dessa feature (ainda valem pra qualquer trabalho futuro no schema/backend)**:
  - Não existe `tsconfig.json` na raiz — `build`/`test:unit` não type-checam `src/backend/**` sem consumidor no frontend; usar `npx tsc --noEmit --strict --target ES2017 --module esnext --moduleResolution bundler --esModuleInterop --skipLibCheck --lib ES2017,DOM` (+ `--allowImportingTsExtensions` se o arquivo importar `.ts` direto) nos arquivos novos até terem consumidor real.
  - `git commit -- <pathspec>` lê o **working tree**, não o índice — nunca usar pathspec explícito depois de um `git update-index --cacheinfo` manual; commitar sem pathspec nesse caso.
  - `supabase db push` aplica todas as migrações pendentes de uma vez — pra manter 1 migração por commit, mover as próximas pra fora de `supabase/migrations/` e devolver uma de cada vez antes do push correspondente.
  - AD-021 (TanStack Table/Query) **ainda não foi cumprida em nenhuma tela** — todas as telas de Fundação usam fetch direto + `useState`, sem `@tanstack/react-table`/`@tanstack/react-query` instalado no projeto. Relevante pra qualquer tela nova que precise de tabela/lista.
- **Uncommitted files**: `package-lock.json` modificado (resolução do `zod` + dependências `csv-parser`/`iconv-lite`/`pg` de trabalho paralelo do usuário) e `DADOS TSE/` untracked — **não relacionado a nenhuma feature deste projeto, não tocar**.
- **Branch**: master
