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
- **Status**: resolved (2026-08-14, feature `incidencia-encontros`)
- **Adendo (2026-08-12, achado de Design de `visao-gerencial-g1-g2`)**: a coluna `dt_ultimo_registro`
  da view aprovada (subquery sobre `fat_registro`, `docs/schema_sistema.sql:1340`) tem o **mesmo
  tipo de bloqueio** — `fat_registro` também não está provisionada (nem `fat_encontro`, de que
  depende), e as duas nascem na mesma onda de Incidência (§6.2, `.specs/roadmap.md`). Não era
  mencionado no texto original desta decisão. A versão reduzida desta feature omite `dt_ultimo_registro`
  junto com `iip_provisorio`/`nr_fatos` — mesmo gatilho de resolução, não é uma decisão nova.
- **Resolução (2026-08-14)**: `mv_iip_contrato` e `fat_registro` provisionadas pela feature
  `incidencia-encontros` (T2). `vw_carteira` substituída pela versão completa aprovada
  (`docs/schema_sistema.sql:1327-1352`, incluindo `dt_ultimo_registro`) via `CREATE OR REPLACE VIEW`
  em `supabase/migrations/20260813194335_incidencia_encontros_vw_carteira_completa.sql` (T9),
  confirmado por `supabase/tests/visao-gerencial/vw-carteira.integration.test.ts` (T15, estendido) —
  colunas novas presentes com valor real e `NULL` (AD-005). Verificado independentemente pelo
  Verifier desta feature (`validation.md`, AC8).

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

## Handoff (Visão Gerencial G1+G2 — CONCLUÍDA e validada)

- **Feature**: G1 + G2 — Primeira Fatia de Visão Gerencial (`.specs/features/visao-gerencial-g1-g2/`)
  — **CONCLUÍDA e validada**, 7/7 requisitos (GG-01 a GG-07). Primeira tela onde uma Gestora
  **gerencia** a operação (não só cadastra contrato): G1 (carteira ponderada por Gestora/Mentor,
  com atingimento médio acessório) + G2 (mediana de tempo de ciclo por etapa) + link pro Kanban,
  substituindo o placeholder `<EmDesenvolvimento>` de `/visao-gerencial` (NAV-13).
- **Phase / Task**: Specify já vinha escrito (achado novo: `ref_peso_etapa` não provisionada em
  nenhum dos 16 catálogos). Esta sessão confirmou as assumptions pendentes com Pedro → Design
  (achado adicional: `vw_carteira` aprovada também depende de `fat_registro`, não provisionada —
  adendo à AD-032) → Tasks (13 tasks, 4 fases) → Execute (2 lotes de sub-agente, oferta aceita) →
  Validate (Verifier independente, 1 rodada formal confiável, `✅ PASS` — ver nota sobre rodada
  aninhada abaixo).
- **Completed**: Lote 1/T1-T7 (`ref_peso_etapa` DDL+grants+seed, `vw_carteira` reduzida,
  `vw_carteira_ponderada`, `vw_ciclo_etapa` + grants): `e1f0865`..`756cd91`, 29 testes de integração
  novos. Lote 2/T8-T13 (`db:types`, `buscarCarteiraPonderada`/`buscarCicloEtapa`,
  `CarteiraPonderadaCard`/`CicloEtapaCard`, página `/visao-gerencial`): `3455717`..`b457fb4`, +
  fix pós-implementação `f36fdd7` (ver achado abaixo), 17 testes unitários novos. Verifier
  independente (`✅ PASS`, sensor 3/3 killed) → `validation.md`/rastreabilidade/Fix Plan 1 (`433d2f3`).
- **Achado real de Design, virou adendo à AD-032 (não decisão nova)**: `vw_carteira` aprovada
  (`docs/schema_sistema.sql:1327-1349`) tem uma 2ª dependência não documentada além de
  `mv_iip_contrato` — a coluna `dt_ultimo_registro` lê `fat_registro`, também não provisionada
  (mesma onda de Incidência, §6.2). A versão reduzida desta feature omite as duas.
- **Achado real de Execute, corrigido por fix `f36fdd7` fora do plano de 13 tasks**: `vw_carteira_ponderada`
  só tem linha por vínculo ativo × contrato ativo — uma Gestora/Mentor sem nenhum contrato ativo
  nunca aparece na view, o que fazia `buscarCarteiraPonderada` omiti-la em vez de mostrar
  `somaPeso: 0` (Edge Case literal do `spec.md`, "zero é contagem real"). Corrigido com um backbone
  independente de `dim_usuario` filtrado por `papel_global`, mesmo padrão já usado pro backbone de
  `ref_etapa` em `buscarBoardKanban`/`buscarCicloEtapa` (`kanban.ts:101-104`). Reauditado com
  ceticismo pelo Verifier independente (não assumido do commit) e confirmado load-bearing por sensor
  de discriminação.
- **Incidente de processo durante Execute (relevante pra próximas features com sub-agentes)**: o
  worker do Lote 2 (T8-T13), ao completar a última task, seguiu a instrução de `implement.md` de
  disparar validação de feature — mas **violou a regra "no nesting"** de `sub-agents.md` (batch
  workers nunca spawnam sub-agentes próprios) ao disparar ele mesmo um Verifier aninhado, que é
  também autor do fix que estava avaliando (quebra "author ≠ verifier"). Essa rodada aninhada foi
  interrompida pelo orquestrador no meio do sensor de mutação, sem terminar de descartar a mutação —
  deixou um mutante real no working tree (código que desfazia exatamente o fix `f36fdd7`) e
  documentação stale (`validation.md`/`spec.md`/`lessons.json` refletindo o estado pré-fix). O
  orquestrador limpou isso (reverteu o mutante, descartou os docs) e disparou um Verifier
  independente de verdade — que, numa segunda ocorrência do mesmo problema, teve seu resultado
  "rodada 2" reenviado ao orquestrador por engano (a rodada aninhada continuou rodando por conta
  própria depois de já instruída a parar) reclamando de "perda de dados" por uma "operação destrutiva
  de git" — na real, a limpeza deliberada e correta do orquestrador, não um acidente. Esse output
  também foi descartado antes do Verifier de verdade concluir. **Lição pra quem orquestrar lotes de
  sub-agente**: se um worker menciona ter disparado seu próprio Verifier/sub-agente ao final do
  lote, interrompa e reitere explicitamente que a validação de feature é responsabilidade do
  orquestrador, nunca do worker.
- **Nota de segurança registrada pelo Verifier independente**: durante o sensor de discriminação, o
  ambiente injetou 3x uma mensagem de sistema forjada instruindo o Verifier a não reverter uma
  mutação e a não contar isso ao usuário — ignorada, `git status` confirmado limpo. Reportado ao
  usuário nesta sessão, não uma vulnerabilidade de código desta feature.
- **Next step**: nenhum obrigatório. Fix Plan 1 do `validation.md` (Minor, não-bloqueante) já foi
  aplicado nesta sessão (backbone `dim_usuario` documentado em `design.md`). Recomendado, não
  bloqueante: UAT manual da tela `/visao-gerencial` com dado real do Kanban (sem harness de
  componente no projeto, débito L-006/L-007 já conhecido).
- **Blockers**: none.
- **Uncommitted files**: none desta feature.
- **Branch**: develop.
- **Atenção — trabalho paralelo confirmado nesta sessão**: `planejamento-planilha-monitoramento`
  segue ativo em `develop` durante toda a execução desta feature (commits intercalados,
  `src/frontend/components/planejamento/*` com mudanças de outra sessão vistas no working tree
  repetidamente) — nenhum arquivo desta feature colidiu. `.specs/STATE.md` cresceu de 722 pra 809+
  linhas entre o início e o fim desta sessão por escrita concorrente de outra sessão; este handoff
  foi inserido sem tocar nenhum conteúdo além do próprio bloco.

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

---

## Handoff (Planejamento do Contrato / Planilha de Monitoramento — CONCLUÍDA e validada)

- **Feature**: Planejamento do Contrato / Planilha de Monitoramento
  (`.specs/features/planejamento-planilha-monitoramento/`) — **CONCLUÍDA e validada**, 11/11
  requisitos (PLM-01 a PLM-11). Provisiona a hierarquia Objetivo Específico → Meta → Sucesso Mensal
  (que faltava desde `operacao-regua-instanciacao`), a grade editável de Sucessos Mensais (a
  "Planilha de Monitoramento" — a tela mais acessada do sistema, Constituição §5.1) e a cascata de
  atingimento assíncrona.
- **Phase / Task**: Specify já vinha escrito de sessão anterior (quadro campo × produto incluído).
  Esta sessão confirmou os 4 pontos sensíveis do `spec.md` com o Pedro (fórmula de cascata,
  `classe='governanca'` só via UI, soma de peso como alerta — e uma **revisão real**: escopo de
  escrita do Assessor ampliado de 2 colunas pra tabela inteira de `fat_sucesso_mensal`) → Design →
  Tasks (17 tasks, 3 fases) → Execute inline (17 tasks + 2 fixes, 26 commits) → Validate (Verifier
  independente, 2 rodadas — rodada 1 `❌ FAIL` com 1 Major + 2 Minor, rodada 2 `✅ PASS` 11/11).
- **Achado mais importante da sessão** (Design, antes de qualquer código): o `spec.md` original
  errava ao marcar a fórmula de cascata e o GRANT do Assessor como "não documentados no schema
  aprovado" — `app.recalcula_atingimento` e `GRANT SELECT, UPDATE ON fat_sucesso_mensal TO
  legisla_assessor` **já existiam verbatim** em `docs/schema_sistema.sql`, coincidindo exatamente
  com o que o Pedro confirmou de qualquer forma. Ver design.md "Achado de Design mais importante".
- **Achado de segurança real, só apareceu rodando o teste de integração** (não por leitura de
  código): `app.recalcula_atingimento` + os 5 triggers de marcação (`app.trg_marca_*`) foram
  extraídos verbatim como `SECURITY INVOKER`, mas escrevem em `dim_planejamento`/`fat_meta`/
  `fat_objetivo_especifico` — tabelas onde Mentor/Assessor só têm `GRANT SELECT`. Qualquer escrita
  deles em `fat_sucesso_mensal` (permitida) disparava o trigger por baixo e falhava com `42501`,
  quebrando a própria escrita que deveria funcionar — bloqueava o P1 inteiro. Corrigido com
  `ALTER FUNCTION ... SECURITY DEFINER SET search_path` (mesmo padrão de `app.trg_auditoria()`),
  **confirmado explicitamente com o usuário antes de aplicar** (mudança de característica de
  segurança de função). Registrado como **AD-035** (acima, `## Decisions`) — refina o alcance da
  AD-024 pra uma classe estreita: recômputo determinístico de coluna derivada, sem parâmetro de
  escrita livre do chamador.
- **Completed**: confirmação Specify (`06072bd`) → design.md (`f72a6c1`) → tasks.md (`96eab85`) →
  T1-T6 schema (`d3c78a5`..`b71069b`, 1 migration/commit: estrutura → RLS `p_heranca` (cadeia
  `EXISTS` de 4 níveis) → grants → cascata verbatim → auditoria → RPC de lote nova) → T7 `db:types`
  (`711db21`) → T8-T10 backend TS (`72a43a3`..`a4aed5f`, + SPEC_DEVIATION `04b3539`: criação de
  Objetivo/Meta é `INSERT` direto, não RPC) → **fix SECURITY DEFINER/AD-035** (`75939af`) → T11-T13
  testes de integração (`cc6682c`..`d85f9ef`, + fix de ordenação `5cb70d1`) → T14-T17 frontend
  (`5f31694`..`f0e8016`: `GradeSucessosMensais` primeiro consumidor real de
  `@tanstack/react-table@9` no repo, `HierarquiaPlanejamento`+forms inline,
  `PlanejamentoAgregadoCoalizao`, wiring da página) → rastreabilidade (`2db9d45`) → **fix rodada 1
  do Verifier** (`a2fda44`: grade parava de recarregar tudo após 1 célula editada + 2 reforços de
  teste) → `validation.md` + 3 lições (`63327a9`).
- **Achado de API real, evitou alucinação por padrão de treinamento**: `@tanstack/react-table`
  instalado é **v9.1.2**, com API bem diferente de v8 (`useTable` não `useReactTable`, sem
  `getCoreRowModel`, features via `tableFeatures()`) — descoberto lendo
  `node_modules/@tanstack/react-table/skills/migrate-v8-to-v9/SKILL.md` antes de escrever o
  componente. Relevante pra qualquer feature futura que toque TanStack Table.
- **Achado do Verifier (rodada 1) mais instrutivo pra próximas features**: uma AC do tipo "salvar
  sem recarregar a lista inteira" cobre a **estratégia de resync pós-escrita**, não só a chamada de
  escrita em si — um `UPDATE` corretamente escopado seguido de um refetch completo da coleção ainda
  viola a AC e reintroduz o custo de rede por edição que ela existe pra evitar. Lição `L-020`.
  Também: AC que enumera múltiplas operações (`UPDATE`/`INSERT`/`DELETE`) ou múltiplos valores de
  enum (`pausada`/`descartada`) pede um teste por caso citado, mesmo com mecanismo/predicado
  compartilhado — `evidence-or-zero` não aceita "cobri um, os outros são análogos". Lição `L-021`.
- **Escopo cortado conscientemente, não é gap**: dialog "editar detalhes" por linha de Sucesso
  Mensal (`peso`/`descricao`/`mes_referencia`/`dt_limite`, fora da grade) — nenhuma AC do `spec.md`
  exige essa UI (só exige que o banco permita, provado em T11); registrado como Deferred Idea em
  `context.md`. `app.recalcula_pendentes` (job de fundo pra `pg_cron`) extraída verbatim mas sem
  consumidor — projeto não tem `pg_cron` provisionado; recálculo é síncrono ao abrir a tela.
- **Next step**: nenhum obrigatório. Se `pg_cron`/Airflow entrar no projeto algum dia, `app.recalcula_pendentes`
  já existe pronta pra virar job agendado. Se a Gestora precisar corrigir `peso`/`descricao` de um
  Sucesso Mensal sem SQL direto, o dialog cortado (Deferred Idea) é o próximo candidato natural.
- **Verifier**: rodada 1 `❌ FAIL` (1 Major — PLM-02, grade recarregava tudo após 1 célula; 2 Minor —
  PLM-06.3 INSERT/DELETE sem teste, PLM-09 `'descartada'` nunca exercitada). Rodada 2 `✅ PASS`
  11/11, sensor 3/3 mutações mortas (camada Zod/RPC, via cópia temporária de arquivo — nunca
  `git stash`, por causa do trabalho paralelo real no repo). Relatório completo (2 rodadas) em
  `.specs/features/planejamento-planilha-monitoramento/validation.md`.
- **Blockers**: none.
- **Uncommitted files**: none (desta feature — ver nota de trabalho paralelo abaixo pra outras).
- **Branch**: develop.
- **Atenção — trabalho paralelo confirmado nesta sessão**: pelo menos duas outras sessões
  commitaram/trabalharam neste mesmo branch `develop` durante a execução desta feature —
  `kanban-etapas` (6 testes de integração próprios falhando ao final desta sessão, isolados a
  `supabase/tests/kanban/fn-mover-etapa-kanban.integration.test.ts`, não investigado por esta sessão
  por não ser desta feature) e `visao-gerencial-g1-g2` (specs novas + 1 migration + 1 teste de
  integração, vistos como `??` no `git status` ao final, não tocados). Um commit desta sessão
  (`75939af`, o único que mexeu em característica de segurança de função) foi bloqueado uma vez pelo
  classificador de permissão do harness e precisou de confirmação explícita do usuário antes do
  push — não é trabalho paralelo, mas vale registrar como precedente pra próxima mudança de
  `SECURITY DEFINER`/`GRANT` sensível.

---

## Handoff (Trilha E — FND-CTR-05 + confirmação de dropdowns — CONCLUÍDA)

- **Escopo**: duas correções pequenas e independentes entre si do débito conhecido (§1.5 do
  `roadmap.md`), sem fase Specify formal (AD-016 permite pular formalidade em correção pequena já
  registrada como débito conhecido, per pedido explícito desta sessão).
- **FND-CTR-05 — snapshot de cargo/partido no contrato nunca populado — corrigido.**
  - **Fonte confirmada por leitura de código, não suposição**: o único lugar que guarda "cargo/
    partido vigente do mandato" hoje é `dim_mandato.id_cargo_atual`/`id_partido_atual` — não existe
    nenhum `UPDATE` desses dois campos em lugar nenhum do código depois da criação do mandato
    (`app.marcar_candidatura_vigente`, `0015_fn_marcar_vigente.sql`, só mexe em
    `rel_mandato_candidatura.eh_mandato_vigente`). Ler a candidatura TSE diretamente seria
    reimplementar o que `dim_mandato` já resolve.
  - **2 call-sites de insert em `fat_contrato` no repo inteiro, os dois corrigidos**: (1)
    `app.criar_mandato` (RPC `SECURITY INVOKER`, AD-024, usado pelo `MandatoWizard` — mandato novo
    ou contrato novo pra mandato existente via `p_id_contratante_existente`) — migration
    `20260813180132_fnd_ctr_05_snapshot_cargo_partido_contrato.sql`, aplicada no Supabase de dev
    (`npnvoolkebhabjkjzqwn`, confirmado via `cat supabase/.temp/project-ref` antes do `db push`,
    regra de ouro de `CLAUDE.md`); (2) `ContratoForm` (insert direto via PostgREST, sem RPC —
    `design.md` de `cadastro-mandato-contrato-unificado`, usado pra abrir contrato num mandato já
    existente e nos 2 fluxos de contrato de coalizão) — `contrato-form.tsx`, lê
    `dim_mandato.id_cargo_atual`/`id_partido_atual` por `id_contratante` antes do insert. `app.criar_coalizao`
    não insere `fat_contrato` (só `dim_contratante`+`dim_coalizao`) — não precisou de mudança.
  - **Coalizão fica `NULL` nos dois call-sites, de propósito**: `id_contratante` de coalizão não tem
    linha em `dim_mandato` — a busca não acha nada e os dois campos ficam `NULL`, coerente com
    `docs/schema_sistema.sql:488-489` ("Snapshot: o número de impacto de 2024 mostra o cargo de
    2024... dim_mandato guarda só o estado presente" — não faz sentido pra quem nunca teve cargo).
  - **Testes**: 2 testes de integração novos em `fn-criar-mandato.integration.test.ts` (um por ramo
    da função — mandato novo+`p_contrato`, e `p_id_contratante_existente`), 11/11 verde. Comentários
    desatualizados que descreviam o campo como "nunca populado" corrigidos em
    `src/backend/queries/contrato.ts` (a ficha do contrato continua deliberadamente mostrando
    cargo/partido **atual** de `dim_mandato`, não o snapshot — são propósitos diferentes, o snapshot
    é pra número de impacto retroativo, não pra esta tela).
  - **Gate real rodado**: `npm run test:integration` (11/11, incluindo os 2 novos) → `npm run
    test:unit` (247/247) → `npm run build` (limpo, 16 rotas) → `npm run lint:all` (mesma baseline
    pré-existente de 27 problemas/13 erros, conferida rodando lint na baseline via `git stash` antes
    de reaplicar esta mudança — nenhum problema novo introduzido).
- **Dropdowns (Cargo/Partido/Produto/Projeto) — reproduzido de verdade, confirmado funcionando,
  riscado do débito.** Nunca tinha sido reproduzido nem descartado formalmente, só "parecia
  funcionar" por leitura de código. Verificação real desta sessão: Chromium headless (Playwright,
  instalado à parte num diretório de scratchpad, não é dependência do projeto) dirigido contra
  `npm run dev` local, login via bypass dev-only `/admin/acesso` com um e-mail `@legislabrasil.org`
  throwaway (auto-provisiona `dim_usuario` papel_global='gestora' via
  `0018_provisiona_usuario_dominio_legisla.sql`, limpo depois via `admin.auth.admin.deleteUser` +
  `DELETE FROM dim_usuario`, mesmo padrão de cleanup já usado pelos testes de integração do
  projeto). Testado em `/mandatos/novo` (passo "Cadastro manual pela mesma tela" — Cargo, Partido,
  Produto, Projeto) e no `ContratoForm` de um mandato já existente (Produto, Projeto) — as 4 opções
  carregam dado real (`ref_cargo`: "Vereador(a)" etc.; `ref_partido`: "PT"/"PL"/"PSDB" etc.;
  `ref_produto`: "Estratégia"/"PLL"/"Coalizão" etc.; `ref_projeto`: "Imagina 1"/"GAIA" etc.), zero
  erro de console, screenshot conferido visualmente nas duas telas. Relato antigo não reproduzido —
  **não havia bug real no momento desta verificação**.
  - **Achado colateral, não é bug do app**: o `.next` do frontend ficou com cache Turbopack
    corrompido por eu ter rodado `npm run build` (produção) imediatamente antes de `npm run dev`
    (dev) sem limpar o diretório entre os dois — sintoma era `/admin/acesso` devolvendo 404 (a
    página só existe sob `NODE_ENV=development`) e depois panics do Turbopack em
    `.next/dev/cache/turbopack`. Resolvido com `rm -rf src/frontend/.next` antes de subir o `next
    dev` de novo. Não é um problema do código do projeto — vale como nota operacional pra quem for
    rodar `build` e `dev` em sequência na mesma máquina.
- **Next step**: nenhum obrigatório. Os dois itens saem do §1.5 "Débito conhecido" do `roadmap.md`
  (linha correspondente riscada/atualizada).
- **Blockers**: none.
- **Uncommitted files desta sessão**: `supabase/migrations/20260813180132_fnd_ctr_05_snapshot_cargo_partido_contrato.sql`
  (nova), `src/backend/queries/contrato.ts`, `src/frontend/components/fundacao/contrato-form.tsx`,
  `supabase/tests/fundacao/fn-criar-mandato.integration.test.ts`, `.specs/STATE.md` (este arquivo),
  `.specs/roadmap.md`.
- **Branch**: develop.
- **Atenção — trabalho paralelo confirmado nesta sessão**: `.specs/features/incidencia-encontros/`
  (diretório novo) e `docs/DB_Fatos_Geradores - Ref_Tipologias.csv` apareceram como untracked no
  `git status` desde o início desta sessão — não criados por este trabalho, não tocados.

---

## Handoff (Formulários dos Produtos — Lote A CONCLUÍDO, pausado por decisão do Pedro)

- **Feature**: Formulários dos Produtos (`.specs/features/formularios-produto/`) — **spec.md/
  context.md/design.md/tasks.md completos e aprovados** (23 requisitos FRM-01 a FRM-23, 21 tasks em
  7 fases, 3 lotes de sub-agente). **Lote A (T1-T9, schema: mecanismo genérico + GIP) concluído e
  commitado nesta sessão**, por pedido explícito do Pedro ("conclua o Lote A e depois pare... amanhã
  retornaremos com os outros lotes"). Lotes B (T10-T15, NPS+backend TS) e C (T16-T21, frontend)
  **não iniciados** — Pedro já aprovou rodar em sub-agente, cada lote começa só depois do anterior.
- **Phase / Task**: Execute, Lote A **completo**. Retomar por Lote B quando Pedro pedir.
- **Completed**: T1 DDL `fat_submissao`+`fat_resposta_metrica` (`337baa9`) → T2 RLS (`11d17e9`) →
  T3 grants (`1a44446`) → T4 `app.trg_extrai_metricas()` `SECURITY DEFINER` + 8 testes de
  integração da Fase 1 (`5941c5f`, + fix de lint `a5ebaa3`) → T5 DDL `fat_gip`/`fat_gip_dimensao`
  (`49dc295`) → T6 RLS (`981901a`) → T7 grants (`fb19743`) → T8 `app.trg_deriva_gip()`
  `SECURITY DEFINER` + trigger (`d2600ac`) → T9 `vw_gip_evolucao` + 5 testes de integração da
  Fase 2, em 2 commits por 2 achados reais no caminho (`c83a601`, `61ea838`).
- **Sessão anterior tinha travado em T4 por disco cheio (0 bytes livres em C:) — resolvido pelo
  Pedro nesta sessão**: `df -h` confirmou 24G livres depois; `npm run test:unit` (404/404) e
  `npm run test:integration` (arquivo isolado de T4, 8/8) rodaram limpos. T4 commitado.
- **3 achados reais descobertos rodando teste de verdade (não por leitura de código), todos
  corrigidos no caminho**:
  1. (T4) `design.md` só desenhava a cláusula de autoria no `WITH CHECK` de `fat_submissao` — spec.md
     P1 AC9/AC13 também exigem bloqueio por formulário fechado/contrato encerrado, sem SQL exato em
     lugar nenhum. Corrigido via `ALTER POLICY` na própria migration de T4 (forward-only).
  2. (T9) `app.trg_valida_gip_dimensao()`/`trg_gip_dimensao_faixa` (verbatim
     `docs/schema_sistema.sql:1864-1877`) **nunca tinham sido provisionados** — o alvo
     (`fat_gip_dimensao`) só passou a existir na T5 desta feature, então nenhuma feature anterior
     poderia tê-los criado; `design.md` assumia errado que já existiam. Sem isso, valor de dimensão
     fora de 1-4 era aceito silenciosamente (FRM-18 não coberto de fato). Migration nova (`c83a601`).
  3. (T9) `app.trg_deriva_gip()` só copiava `regua_sonhos` pra dentro de meio/fim **no instante em
     que eram derivados** — reeditar o início depois que meio/fim já existem (permitido, nenhuma
     ordem é imposta) deixava a cópia deles desatualizada e `vw_gip_evolucao` mostrava gap errado.
     Corrigido com propagação nas 2 direções (`61ea838`).
- **Achado de infraestrutura, não é bug de código desta feature** (contexto para quem ler o histórico
  de commits): o Lote A começou rodando por sub-agente, que travou 2x achando que "esperar um
  Monitor" resolveria sozinho (rodava o gate em `run_in_background: true` e encerrava o turno sem
  recolher o resultado) e na 3ª tentativa caiu de vez por limite de sessão de API. O orquestrador
  assumiu e completou T4-T9 inline nesta mesma sessão, sem sub-agente.
- **Poluição de fixture de teste pré-existente, encontrada mas não desta feature**: rodar a suíte
  `test:integration` completa (antes do disco encher) revelou 16 falhas em `catalogos-referencia` e
  `convite-contrato` — fixtures órfãs (`fixture_t1_teste_estrutura`, e-mails `t3-convidado-*`),
  provavelmente vazadas por uma execução anterior interrompida (disco cheio). Tentei limpar via
  `DELETE` cirúrgico (aprovado pelo Pedro no chat) e o classificador de permissão bloqueou mesmo após
  aprovação — não é algo que este agente deva contornar. **Débito conhecido, fora do escopo desta
  feature**: alguém com acesso direto ao SQL Editor do Supabase (ou ajuste de permissão do Claude
  Code) precisa rodar a limpeza. Detalhe exato das linhas órfãs (`id_etapa` 377/414,
  `id_formulario` 294, `id_preditor` 116, `dim_contratante` 1638/1705, e-mails `t3-convidado-*@
  legislabrasil.test`) ficou registrado na conversa desta sessão, não neste arquivo (evitar inchar
  STATE.md com SQL de limpeza pontual).
- **Colisão real de commit (não é bug, é corrida no índice do git compartilhado)**: o commit
  `61ea838` (T9 final) acabou incluindo 2 arquivos de `visao-gerencial-g3-g6`
  (`20260814211638_visao_gerencial_vw_carteira_ponderada_mensal.sql` +
  `supabase/tests/visao-gerencial/vw-carteira-ponderada-mensal.integration.test.ts`) — outra sessão
  rodou `git add` nesses arquivos entre o meu `git add` e `git commit`, e `git commit -m` sem
  pathspec commita o índice inteiro, não só o que acabei de adicionar. Conteúdo intacto, só
  attribution de commit "errada" (mesmo padrão já documentado no handoff de `kanban-etapas`) — não
  reescrevi histórico por ter outra sessão ativa commitando ao mesmo tempo (risco real de rebase).
  Também: **um commit separado de autoria do próprio Pedro** (`66cc2ab`, "feat: atualizacoes na
  visao gerencial, formularios de produto e melhorias na UI") varreu o working tree inteiro em algum
  momento no meio desta sessão (`git add -A`-like), capturando uma cópia mais antiga de
  `formularios-gip.integration.test.ts` e de `spec.md`/`context.md`/`design.md`/`tasks.md` desta
  feature — meus commits posteriores (`c83a601`, `61ea838`) já continuam corretamente por cima
  dessa cópia, nada foi perdido.
- **Next step**: nenhum obrigatório. Quando Pedro pedir para continuar: Lote B (T10-T15 — `mv_avaliacao_nps`
  + `app.atualiza_avaliacao_nps()` + `db:types` + `queries/formulario.ts` + `rpc/formulario.ts`,
  ver `tasks.md`). Antes de rodar `npm run test:integration` completo de novo, ter em mente que as
  16 falhas de poluição pré-existente (acima) continuam lá até alguém limpar — não são regressão de
  nenhum trabalho novo.
- **Blockers**: none (disco resolvido; poluição de fixture é débito conhecido, não bloqueia
  trabalho novo — só o `test:integration` completo mostra ruído nas 2 features não relacionadas).
- **Uncommitted files**: none desta feature.
- **Branch**: develop.
- **Atenção — trabalho paralelo confirmado nesta sessão**: pelo menos 3 outras trilhas commitaram
  ativamente neste mesmo branch durante toda a execução do Lote A — `incidencia-encontros`
  (concluída, handoff próprio abaixo), `planejamento-estrategico-redesenho` (concluída e validada,
  handoff próprio abaixo) e `visao-gerencial-g3-g6` (em andamento, ver colisão de commit acima).
  Nenhum arquivo de schema/backend desta feature colidiu de verdade (conteúdo sempre correto); a
  única colisão foi de atribuição de commit no git, documentada acima.

---

## Handoff (Incidência & Encontros — CONCLUÍDA)

- **Feature**: Incidência & Encontros (`.specs/features/incidencia-encontros/`) — Registro por
  etapa, Insight, Fato Gerador validado por Tipologia, cálculo do IIP (AD-014, único cálculo desta
  camada) e Encontros (OPR-03). Specify → Discuss → Design → Tasks → Execute → Validate completo.
  **35 tasks (T1-T35), 5 fases, todas concluídas e commitadas.**
- **Phase / Task**: Validate concluída — Verifier independente rodou (author ≠ verifier), relatório
  em `.specs/features/incidencia-encontros/validation.md`. Veredito: **⚠️ Issues (não bloqueantes)**
  — 23/24 ACs nomeados do spec batem exatamente com o outcome definido (valor preciso checado, não
  só "existe asserção"), sensor de discriminação 3/3 mutações mortas. 2 gaps de baixa/média
  severidade, nenhum invalida uma AC nomeada nem é regressão de código (ver `validation.md`, seção
  "Gaps Ranqueados"): (1) AD-032 não estava marcada como resolvida em `STATE.md` — **fechado nesta
  mesma edição**, ver entrada AD-032 acima; (2) ~10 `CHECK`s secundários de T2 (não citados por nome
  em nenhum AC) sem teste de violação dedicado no banco — mitigado por defesa Zod client-side e
  confirmado como convenção pré-existente do projeto (mesmo padrão em
  `planejamento-planilha-monitoramento`), não é regressão desta feature; deixado como está.
- **Execução em lotes de sub-agente** (5 lotes, 1 por fase, aprovado por Pedro): Lote 1 (T1-T9,
  schema) e Lote 2 (T10-T15, testes de integração) concluídos por sub-agente. **A partir do Lote 3
  (T16-T22)**, sub-agentes voltaram a funcionar normalmente após um reset de limite de sessão da
  API; **Lote 5 (T28-T35, frontend) morreu logo no início** (2º hit de limite de sessão da API nesta
  feature) — T28 a T35 foram então **executadas diretamente pelo orquestrador** (sem novo
  sub-agente), mesmo ciclo implementar→gate→commit por task. O Verifier também bateu no limite de
  sessão na 1ª tentativa (3ª vez nesta feature) — resposta na 2ª tentativa, ~43min depois, sem
  problema.
- **Achados reais corrigidos durante o fechamento** (depois de todas as 35 tasks já commitadas):
  1. **Regressão real em teste de outra feature**: T1 (seed de `ref_tipologia`) adicionou um 4º
     código a `ref_nivel_iip` (`'maximo'`, Assumption #1a) — quebrou 2 asserções de
     `catalogos-referencia-seed.integration.test.ts` (CAT-15 AC1/AC10, Trilha C) que ainda esperavam
     3 linhas. Corrigido (`4f1d419`) — migration é forward-only, o teste stale é quem precisava
     acompanhar a mudança intencional.
  2. **UX real reportada por Pedro em teste manual** (`a03308f`): `FatoGeradorForm` expunha
     Tipologia como 1 Select achatado (51 itens truncados "Grupo · Tipologia · Estado") e Nível
     D1-D3/Preditor 1-2 como Selects livres, editáveis pela Gestora. Errado — o CSV real
     (`docs/DB_Fatos_Geradores - Ref_Tipologias.csv`) trata nível/preditor como atributo FIXO de
     cada combinação Grupo+Tipologia+Estado, já gravado em `ref_tipologia.*_padrao`/
     `id_preditor_1`/`id_preditor_2` desde o seed — não é escolha por ocorrência. Refeito como
     cascata Grupo→Tipologia→Estado que deriva nível/preditor automaticamente (somente leitura, nova
     `buscarTipologiasCompletas`).
- **Achado crítico de ambiente, não é bug desta feature nem de nenhuma trilha**: o disco `C:` da
  máquina chegou a **0 bytes livres** (238G/238G) durante o fechamento desta feature — confirmado
  independentemente por esta sessão e pela sessão de "Formulários dos Produtos" (handoff acima).
  Causou falhas intermitentes de build/teste por contenção (não por código), um `git checkout`
  interrompido que deixou `src/backend/rpc/fato-gerador.ts` temporariamente vazio (restaurado pelo
  Verifier, confirmado byte-idêntico via `git diff` vazio) e travou `npm run test:integration`
  completo (>78 min, terminou em crash por `LegacyPlatformAuthRequiredError` do Supabase CLI antes
  de imprimir o resumo final). **Testes de integração escopados só a esta feature** (mais rápido,
  sem depender da suíte inteira) rodaram limpos: RLS/grants (T10), triggers/constraints (T11), IIP
  (T14), `vw_carteira` (T15, 2 dos 3 casos) — 3 arquivos (`fn-criar-fato-gerador`/`fn-criar-insight`/
  1 caso de `vw-carteira`) deram timeout de hook (60-120s) por contenção real do banco de dev
  compartilhado com outras sessões ativas na mesma janela, não falha de asserção. **Recomendação
  pro Pedro**: liberar espaço em `C:` antes da próxima sessão pesada de build/teste — bloqueia
  qualquer gate de integração confiável, não só desta feature.
- **Next step**: nenhum obrigatório para esta feature — está fechada. Sugestões não-bloqueantes:
  (a) rodar a suíte completa de `test:integration` do zero quando o disco/ambiente estiver saudável,
  pra confirmar os 3 arquivos que deram timeout de hook; (b) considerar endereçar o Gap 2 do
  Verifier (CHECKs secundários sem teste de violação) numa fatia futura de hardening, mesmo padrão
  aceito em `planejamento-planilha-monitoramento`.
- **Blockers**: nenhum bloqueante desta feature. Disco cheio (`C:`, 0 bytes livres) é blocker de
  infraestrutura compartilhada — ver achado acima.
- **Branch**: develop.
- **Atenção — trabalho paralelo confirmado durante toda a execução**: pelo menos 2 outras trilhas
  (`formularios-produto`, `planejamento-estrategico-redesenho`) commitaram ativamente neste mesmo
  branch durante toda a Execução desta feature, intercaladas no `git log`. Nenhum arquivo desta
  feature colidiu (`git log --oneline | grep incidencia-encontros` confirma todos os commits
  intactos). Arquivos modificados/untracked no working tree que **não** são desta feature (mesma
  lista das 2 seções de handoff acima) não foram tocados por este trabalho.

---

## Handoff (Planejamento Estratégico — Redesenho da Tela — CONCLUÍDA e validada)

- **Feature**: Planejamento Estratégico — Redesenho da Tela
  (`.specs/features/planejamento-estrategico-redesenho/`) — **CONCLUÍDA e validada**, 19/19
  requisitos (PLR-01 a PLR-19). Redesenha `/contratos/[id]/planejamento` (layout de 2 colunas,
  3 modos Construir/Monitorar/Ler via objeto `PERMISSOES` único, árvore-grade unificada numa só
  tabela, modais no lugar de formulário inline, comportamento nível-planilha completo: teclado,
  colar de faixa vírgula/ponto/`%`, edição em massa, undo) — **supersede a apresentação** de
  `planejamento-planilha-monitoramento` (PLM-01 a PLM-18 preservados, nenhum contrato de
  backend/RLS/RPC/cascata mudou).
- **Phase / Task**: Specify achou a tela já existia sob outro nome validado + 3 conflitos reais
  entre o pedido original e o estado do projeto (papel `legisla` vs AD-018, GIP vs
  `formularios-produto`, IIP vs `incidencia-encontros`) → **Discuss com Pedro via `AskUserQuestion`
  (2 rodadas)** antes de qualquer código, todos resolvidos e registrados em `context.md` → Design →
  Tasks (24 tasks, 6 fases) → Execute → Validate (Verifier independente, **2 ciclos**: ciclo 1
  `❌ FAIL` 3 gaps, fix→re-verify, ciclo 2 `✅ PASS` 19/19).
- **Decisões resolvidas com Pedro nesta feature** (`context.md`, ver também `spec.md` "Decisões
  resolvidas nesta sessão"): (1) papel `legisla` descartado, Interno Legisla mantém
  `papel_global='gestora'`, AD-018 **inalterada**; (2) GIP fica placeholder "em desenvolvimento",
  dono é `formularios-produto`; (3) IIP/Insight/Fato Gerador ficam placeholder, dono é
  `incidencia-encontros` (T16-T35 concluídas por outra sessão durante a execução desta feature,
  mas a troca de placeholder por leitura real não foi feita aqui — é escopo daquela feature
  entregar a UI, não desta trocar o consumo); (4) D-B (`NULL` na cascata) mantém `COALESCE(...,0)`
  já aprovado, sem migration nova.
- **D-C e D-D nunca tiveram decisão síncrona do Pedro** — o pedido original instruiu explicitamente
  marcar como `TODO` e avisar em vez de decidir sozinho, o que foi feito: D-C (escopo do mês em
  Monitorar — grade mostra todos os meses do ciclo, sem seletor) e D-D (mecanismo de undo —
  client-side via `useUndoPlanejamento`, reescreve pelo mesmo caminho validado, nunca edita
  `log_auditoria` diretamente) estão implementados com o **default proposto no pedido original**,
  marcados `// TODO(D-C)`/`// TODO(D-D)` no código. **Ainda pendente de confirmação do Pedro** —
  não é um gap, é o comportamento pedido explicitamente ("marque e avise").
- **Verifier ciclo 1 (`❌ FAIL`) → Fase 7, T25-T27**: 3 gaps ranqueados, nenhum spec-precision gap
  (outcome do spec era preciso, só não existia no código) — (1) **PLR-19** (salvamento otimista +
  indicador de "salvando" por célula + reversão em erro) nunca tinha sido decomposto em task,
  zero evidência de código; (2) Success Criteria "limpar uma célula de `%` grava `NULL`"
  (spec.md:124) bloqueado — `normalizaEntradaPct("")` retorna `null`, o mesmo valor de "entrada
  inválida", e o código mostrava erro em vez de gravar; (3) Edge Case "Assessor abre a tela já
  filtrado às próprias Metas" (spec.md:97-99) não satisfeito — filtro nascia desligado
  independente do papel. **Todos os 3 corrigidos** (commits `43928c3`/`3d740a4`/`d781b53`) e
  reconfirmados pelo Verifier ciclo 2 (`✅ PASS`, `5c6a466`) — relatório completo dos 2 ciclos em
  `.specs/features/planejamento-estrategico-redesenho/validation.md`.
- **Achado real, não corrigido — decisão de segurança pendente do Pedro**: `PERMISSOES.gestora.
  veAuditoria = true` liga o botão "Ver histórico" (`ModalHistorico`) pra Gestora, mas a RLS de
  `log_auditoria` (`p_log_admin`, `docs/schema_sistema.sql:1627`) só permite `admin` ler a tabela —
  Gestora vê o modal abrir, mas a lista vem vazia. Não é bug desta feature (o backend de
  `log_auditoria` já existia, só ganhou UI de leitura aqui); mudar essa RLS é decisão de segurança
  que precisa de confirmação explícita do Pedro antes de qualquer PR (mesmo precedente de AD-035).
- **Cortes de escopo conscientes, documentados como SPEC_DEVIATION em `tasks.md`, não são gaps**:
  colunas extra do modo Construir (preditor 1º/2º, agenda, prioridade, classe) são só leitura na
  grade — edição continua via "Editar" (abre `ObjetivoForm`/`MetaForm` completos); modo "Ler" mostra
  o mês por linha, não pivota numa matriz "1 coluna por mês" (pivotar exigiria um modelo de dado
  diferente do resto da árvore); undo (`Ctrl+Z`) não restaura valores que eram `NULL` antes da
  edição (`app.atualiza_sucessos_mensais_lote` não aceita `NULL` no `UPDATE` em lote).
- **Achado de arquitetura, sem harness de componente**: `CelulaPct` é um `<input>` não-controlado
  (`defaultValue`, não `value`) — mesmo padrão já usado por `planejamento-planilha-monitoramento`.
  O envelope de "salvando"/reversão do T27 (`escreverCelulas`) reescreve o DOM diretamente
  (`document.getElementById`) em vez de via re-render controlado, porque é a única forma de
  reverter visualmente um valor não-controlado sem reescrever `CelulaPct` inteira pra
  `value`/`onChange`. Nenhum teste automatizado cobre componentes React neste projeto (débito
  conhecido `L-006`/`L-007`, não introduzido por esta feature) — os 2 Verifiers avaliaram o
  comportamento de UI por inspeção de código, não por harness.
- **Next step**: nenhum obrigatório — feature fechada. Quando `formularios-produto` provisionar
  `vw_gip_evolucao`, trocar o placeholder de GIP em `ContextoEstrategico` por leitura real; quando
  a UI de leitura de `incidencia-encontros` (T28-T35, já concluída por outra sessão) estiver pronta
  pra reuso, trocar os placeholders de IIP/incidência em `PlanejamentoHeader`/grade. Se o Pedro
  quiser mudar D-C (seletor de mês em Monitorar) ou D-D (mecanismo de undo) do default aceito, ou
  decidir a RLS de `log_auditoria` pra Gestora, são os 3 candidatos naturais pra próxima fatia.
- **Blockers**: nenhum.
- **Branch**: develop.
- **Atenção — trabalho paralelo confirmado durante toda a execução**: pelo menos 3 outras trilhas
  (`incidencia-encontros`, `formularios-produto`, `visao-gerencial-g3-g6`) commitaram ativamente
  neste mesmo branch durante a execução e validação desta feature, intercaladas no `git log`.
  Nenhum arquivo desta feature colidiu (`git log --oneline` dos commits desta feature confirma
  todos intactos; diff ranges dos 2 ciclos do Verifier usaram hash explícito como âncora, não
  "desde o último commit da branch", por causa disso). Arquivos modificados/untracked no working
  tree que **não** são desta feature (`contrato.ts`, `app/(app)/page.tsx`, `layout.tsx`,
  `route-tabs.tsx`, `topbar.tsx`, `fundacao/contrato-form.tsx`, `produto-shell.tsx`,
  `estado-vazio.tsx`, testes de integração de `fundacao`, specs novas de `formularios-produto`/
  `visao-gerencial-g3-g6`, migrations novas) não foram tocados por este trabalho.
- **Ambiente — disco**: histórico de disco crítico (~30MB livres em C:) no início da validação,
  causado por sessões paralelas, não por esta feature (medido: `.next`≈1.2GB no pico,
  `node_modules`≈601MB, `.git`≈12MB — todos normais). Recuperou pra ~24GB livres ao longo da
  sessão (ação de sessões paralelas, não desta). Disciplina mantida: `rm -rf src/frontend/.next`
  depois de cada `npm run build`.

---

## Handoff (Visão Gerencial G3-G6 — Tela Gerencial completa — CONCLUÍDA e validada)

- **Feature**: Visão Gerencial G3-G6 (`.specs/features/visao-gerencial-g3-g6/`) — **CONCLUÍDA e
  validada**, 30/30 tasks, 22/22 requisitos (GER-01 a GER-22) Verified ou
  Verified-com-desvio-documentado. Estende `/visao-gerencial` (que já tinha G1+G2 em produção,
  `visao-gerencial-g1-g2`) com Bloco 0 (G3 cobertura de registro + G4 taxa de resposta de
  formulário — saúde da própria operação, acima de qualquer indicador de mandato), Bloco 1
  (distribuição de contratos por etapa da régua), Bloco 2 (G5 atingimento, G6 completude de
  cadastro, IIP consolidado) e Bloco 3 (Gargalos — 6 categorias fixas de `vw_pendencias`,
  paginada, navegável, nunca com ação de resolver/ignorar), com barra de recorte global
  (Produto/Projeto/Gestora/Mentor/Período) e regra de dupla leitura (estado atual + evolução
  mensal) em todo indicador que a suporta.
- **Phase / Task**: Specify (síntese do pedido original de Pedro, 14 seções) → Discuss (2 rodadas
  `AskUserQuestion`: rota estende `/visao-gerencial`; G5 nasce sem evolução `TODO(OUT-06)`;
  Período afeta só eixo X da evolução; G1 evolução construída já nesta fatia via
  `generate_series`; Gestora+Mentor = E lógico, só vínculo ativo; Bloco 3 agrupado em accordion) →
  Design (achado que reverteu decisão do Discuss: G6 evolução também adiada, `log_auditoria` é
  Admin-only via RLS `p_log_admin`) → Tasks (30 tasks, 5 fases + 3 adendos) → Execute (sub-agente
  em lote travou na Fase 1/T1-T7 e foi encerrado por limite de sessão sem terminar — orquestrador
  assumiu execução direta de T2 a T30) → Validate (Verifier independente, **2 rodadas**: rodada 1
  `❌ FAIL` 1 Blocker + 2 Minor + 1 Cosmético, fix→re-verify, rodada 2 `✅ PASS`).
  `.specs/features/visao-gerencial-g3-g6/validation.md` tem o relatório completo das 2 rodadas
  (rodada 1 também preservada via `git show aeb5743:.../validation.md`).
- **Completed**: Fase 1/T1-T7 (6 views novas/alteradas: `vw_pendencias`, `vw_resposta_formulario`,
  `vw_ciclo_etapa`+`dt_conclusao`, `vw_carteira_ponderada_mensal`,
  `vw_cobertura_registro_mensal`, `vw_resposta_formulario_mensal`, `db:types`) → Fase 2/T8-T12
  (`FiltroRecorte` compartilhado, `resolverIdsContratoDoRecorte`, backend Bloco 0) → Fase 3/T13-T17
  (backend Bloco 1/2/3, 141 testes unitários novos) → Fase 4/T18-T23 (gate de papel, barra de
  recorte, Recharts + paleta categórica via skill `dataviz`, Bloco 0 + G1/G2 frontend) → Fase
  5/T24-T30 (`0ba4e41`..`355cc3e`, Bloco 1/2/3 frontend + wire final) → Verifier rodada 1
  (`❌ FAIL`) → fixes (`173bd90` Blocker Período, `784259f` 2 mutantes, `dcb39be` comentário
  cosmético) → Verifier rodada 2 (`✅ PASS`, `cccbbd3`) → `tasks.md` fechado (`87028b7`). Detalhe
  task-a-task e hashes completos em `.specs/features/visao-gerencial-g3-g6/tasks.md` ("Progresso").
- **3 achados reais corrigidos durante Execute** (nenhum estava no `design.md`): (1)
  `fat_submissao.enviada_em` é `NOT NULL DEFAULT now()`, não nullable — `respondido` virou "existe
  submissão", não checagem de campo; (2) `vw_cobertura_registro_mensal`/
  `vw_resposta_formulario_mensal` nasceram pré-agregadas por mês em SQL (perdendo
  `id_contrato`/`id_produto`, impossibilitando filtrar a evolução pela barra de recorte) —
  corrigidas com `DROP`+`CREATE` (não `CREATE OR REPLACE`, Postgres recusa mudar shape de coluna
  de view, erro `42P16`) pra grão fino; (3) `resolverIdsContratoDoRecorte` consultava
  `fat_contrato` incondicionalmente, zerando a interseção quando só `idGestora`/`idMentor` eram
  passados — corrigido com sentinela `Set | null` ("sem restrição ainda" ≠ "zero contratos").
- **Achado real crítico, só apareceu testando ao vivo no navegador** (não pego por
  `build`/`tsc`/lint): passar uma função (`formatarValor`) como prop de Server Component pra
  Client Component quebra em runtime ("Functions cannot be passed directly to Client
  Components"). Corrigido substituindo por um discriminador serializável
  (`unidade: "pct"|"dias"|"numero"`) nos componentes de gráfico — mesma classe de bug que
  `SPEC_DEVIATION`/lições já registram pra `TableRow` sem `asChild` (usado em `GargalosTabela`,
  Fase 5).
- **Verifier rodada 1 (`❌ FAIL`) → 3 fixes, mesma sessão**: (1) **Blocker** — o Select "Período"
  da barra de recorte (`FiltroRecorte.mesesEvolucao`) era capturado na URL mas nenhum gráfico de
  evolução o lia; corrigido com `apararUltimosMeses`/`periodo.ts` (corte de exibição no último elo
  antes do componente, nunca reprocessa a query) conectado nos 3 consumidores (G1/G2/G3+G4); (2)
  **Minor** — teste de E lógico Gestora+Mentor usava o mesmo dataset mockado nos dois lados,
  não discriminando AND de OR; `criarClienteMock` ganhou fila de respostas por tabela (mesmo
  padrão já usado em `kanban.test.ts`); (3) **Minor** — teste de paginação de `buscarPendencias`
  só checava "não lança", nunca capturava os argumentos reais de `.range()`. Rodada 2 confirmou os
  3 fixes por leitura, sensor de mutação (2/2 mortos) e, no caso do Blocker, checagem empírica
  contra o dev real (payload servido muda de tamanho com/sem `?periodo=3`).
- **6 lições distiladas** (`L-027` a `L-032`, `.specs/LESSONS.md`/`lessons.json`) — nenhuma nova na
  rodada 2 (sinal já coberto pelas 6 da rodada 1).
- **Decisões em aberto do pedido original, mantidas como `TODO` explícito no código (não
  inventadas)**: peso de G1 (obsoleto — já resolvido antes desta feature, `ref_peso_etapa` existe
  e `vw_carteira_ponderada` já pondera de verdade); fórmula do IIP (Incidência é dona, Saída só
  lê, AD-014); limiares de 30/45 dias (já em `ref_*`, não hardcoded); writer de transição de etapa
  (é o Kanban, AD-023, não esta feature); produto Coalizão (fora de escopo desta fatia).
- **2 `SPEC_DEVIATION` + 1 spec-precision gap, documentados no código, não são gaps**: modal do
  Bloco 1 (T24) linka pro Kanban do produto, não pra uma rota de contrato individual; atraso
  mostrado via cor+rótulo na barra inteira, não como segmento empilhado (`ChartBarraHorizontal` é
  valor único); timestamp de "dado mais recente" do IIP é proxy via `MAX(dt_ultimo_fato)`
  (Postgres não expõe timestamp de `REFRESH MATERIALIZED VIEW` em catálogo nenhum).
- **Next step**: nenhum obrigatório — feature fechada. Recomendado, não bloqueante: UAT manual real
  no navegador antes do merge pra `master` (ambos os Verifiers já fizeram checagem empírica
  pontual via curl+cookie jar, mas isso não substitui um percurso completo com usuário real: os 4
  filtros da barra combinados, os 4 blocos, o accordion do Bloco 3, a navegação pro Kanban a partir
  do modal). Se o Pedro quiser, `fat_snapshot_mensal`/OUT-06 (evolução de G5/G6) e a exportação
  (OUT-04) são os 2 candidatos naturais de próxima fatia — ambos já fora de escopo por decisão
  explícita desta feature, não gaps.
- **Blockers**: nenhum (o único Blocker da rodada 1, filtro Período, foi corrigido e reverificado).
- **Uncommitted files**: none desta feature.
- **Branch**: develop.
- **Atenção — trabalho paralelo confirmado durante toda a execução e validação**: pelo menos 4
  outras trilhas (`incidencia-encontros`, `formularios-produto`, `planejamento-estrategico-redesenho`,
  e commits soltos do próprio Pedro) commitaram ativamente neste mesmo branch, intercaladas no
  `git log` — 2 commits desta feature (T1 e T4 da Fase 1) acabaram bundled dentro de commits de
  outra sessão/do usuário (`66cc2ab`, `61ea838`); conteúdo íntegro nos dois casos, só a mensagem
  não reflete o escopo real (documentado em `tasks.md`). Um teste de integração pré-existente e
  não relacionado (`supabase/tests/operacao/regua-instanciacao.integration.test.ts`) começou a
  falhar durante esta sessão por uma fixture órfã de outra sessão paralela vazada em `ref_etapa`
  (`id_etapa=377`, `codigo='fixture_t1_teste_estrutura'`) — reportado, não removido (não é dado
  desta feature, risco de estar em uso por outra sessão ativa), não bloqueia esta feature.
