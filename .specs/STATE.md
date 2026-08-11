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
- **2 achados Minor do Verifier, não-bloqueantes** (ambos com Fix Plan em `validation.md`, nenhum
  invalida um AC): (1) erro de RLS no Cadastro de novo Contrato não passa por `<ErroInline>`
  (AD-029) como o `design.md` prometia — `ContratoForm`/`MandatoWizard` (pré-existentes, não
  tocados por nenhuma task desta feature) usam um `<p>` bruto; `<ErroInline>` tem zero consumidores
  em todo o repositório, antes e depois deste diff — débito preexistente, não regressão. (2) a aba
  "Nenhuma etapa cadastrada" (edge case que "não deveria acontecer") leva a uma tela que fica presa
  em `<CarregandoSkeleton>` em vez de mostrar a mensagem, porque o redirect de `/contratos/[id]`
  não trata o caso de zero etapas. Lição `L-008` (candidate) registrada sobre o padrão #1.
- **Next step**: nenhum obrigatório de código. Os 2 achados Minor acima são candidatos a item
  avulso de Trilha E sempre que houver folga (ver `.specs/roadmap.md` §1.5, Débito conhecido).
  Recomenda-se UAT manual pros itens que o Verifier marcou ⚠️ (destaque visual da aba ativa;
  comportamento real de 404 HTTP em `/produtos/xis` e `/contratos/999999999` sob sessão
  autenticada — não executável numa verificação estática).
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
