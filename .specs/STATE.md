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
- **Status**: active

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
- **Status**: active

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

---

## Handoff

- **Feature**: Login com senha (Interno Legisla) (`.specs/features/login-senha-interno-legisla/`) — **CONCLUÍDA e verificada**.
- **Phase / Task**: Execute concluído, Verifier independente retornou **PASS** (7/7 AUTHPWD-01..07, 0 gaps). Relatório em `.specs/features/login-senha-interno-legisla/validation.md`. `spec.md` atualizado (todos os requisitos = ✅ Verified).
- **Completed**: Specify (`86426df`) → Execute — `src/frontend/components/login-form.tsx` trocado pra `signInWithPassword` (`0633abd`) + `scripts/provisionar-senhas.ts` novo (`defbef7`) → Validate (PASS).
- **Next step**: nenhum pendente **nesta feature**. Falta só o passo manual fora do código: Pedro rodar `npm run provisionar-senhas -- <senha> <emails...>` pra equipe real e confirmar com pelo menos 1 colega real que o login funciona no Preview (Success Criteria do spec.md, não verificável por agente).
- **Blockers**: none.
- **Uncommitted files**: none.
- **Branch**: master.
- **Contexto que sobrevive desta feature**: `scripts/gerar-link-acesso.ts` (magic link manual, commits `2ff74ed`/`71afc69`) e `src/frontend/app/admin/acesso/` + `src/backend/supabase/proxy.ts` (bypass dev-only, `d2fe357`) continuam existindo, Out of Scope, não tocar. `src/backend/supabase/admin.ts` (`createAdminClient`, service_role) é reusado tanto por eles quanto pelo script novo desta feature.

---

**Nota de manutenção deste arquivo**: o Handoff abaixo (Fundação — Entidades e Pessoas) é o snapshot real anterior a esta feature, preservado porque descreve trabalho **ainda não concluído** (Fase 5, T29-T37) — nunca chegou a ser sobrescrito quando a sessão anterior pausou pra abrir a feature de login (violação da regra "Handoff é sobrescrito a cada pausa" do `memory.md`/`references/memory.md`). Condensado aqui pra caber no orçamento (~500 tokens por snapshot); os detalhes de decisão de design de cada fase (T10-T28) continuam recuperáveis nas mensagens de commit listadas abaixo — não foram perdidos, só não duplicados aqui.

## Handoff (Fundação — Entidades e Pessoas, pendente — retomar quando a feature de login não for mais a prioridade)

- **Feature**: Fundação — Entidades e Pessoas (`.specs/features/fundacao-entidades-pessoas/`).
- **Phase / Task**: Specify → Design (AD-024) → Tasks (37 tasks, 6 fases) → **Fases 0-4 completas** (T1-T28) → **Fase 5 pendente** (T29-T37, 9 tasks, nenhum arquivo criado ainda).
- **Next step**: Fase 5 — T29 `ContratanteFields`, T30 `DuplicataWarningDialog`, T31 `TseMatchSearch`, T32 `MandatoWizard`, T33 `ContratoForm`, T34 `VinculoTable`/`VinculoForm`, T35 `CoalizaoForm`, T36 `UsuarioForm`, T37 (integração/rotas restantes — ver `tasks.md` da feature pro detalhe exato de T32-T37). 9 tasks ≈ 1 batch de sub-agent (bem no limite do budget de ~8/batch — considerar 1-2 batches se for delegar).
- **Completed** (cada task revisada, gate individual, commit atômico): T10 `d350946`, T11 `f922092`, T12 `51e160c`, T13 `5fabd80`, T14 `791cdc8`, T15 `dacc378`, T16 `1138ab4`, T17 `3a4d711`, T18 `bc87e6d`, T19 `53bafd9`, T20 `258bff8`, T21 `6a725b6`, T22 `0d977cd`, T23 `a45edf8`, T24 `34c0299`, T25 `e2ff001`, T26 `f508a12` (+ fix `99def84`), T27 `d060d21`, T28 `7e724bd`. Gate final Fase 3 (`test:integration`): 120/120. Gate final Fase 4 (`test:unit`): 81/81, `build` limpo.
- **Blockers**: nenhum.
- **Ambiente confirmado**: projeto Supabase de dev `sistema-mandatos-dev` (`npnvoolkebhabjkjzqwn`, `sa-east-1`), separado do `mgoeloqdlpgkofgqqbjs` de produção (AD-020). CLI v2.110.0, linkada. Docker não instalado — testes de integração rodam contra este projeto remoto.
- **Deviations/lições ativas a lembrar antes de continuar a Fase 5**:
  - Não existe `tsconfig.json` na raiz — `build`/`test:unit` não type-checam `src/backend/**` sem consumidor no frontend; usar `npx tsc --noEmit --strict --target ES2017 --module esnext --moduleResolution bundler --esModuleInterop --skipLibCheck --lib ES2017,DOM` (+ `--allowImportingTsExtensions` se o arquivo importar `.ts` direto) nos arquivos novos até terem consumidor real.
  - `git commit -- <pathspec>` lê o **working tree**, não o índice — nunca usar pathspec explícito depois de um `git update-index --cacheinfo` manual (isolamento de dependência nova vs. trabalho paralelo do usuário); commitar sem pathspec nesse caso.
  - `supabase db push` aplica todas as migrações pendentes de uma vez — pra manter 1 migração por commit, mover as próximas pra fora de `supabase/migrations/` e devolver uma de cada vez antes do push correspondente.
  - A cada task, rodar o gate só no arquivo de teste novo (`npm run test:integration -- <arquivo>`), não a suíte completa (suíte inteira leva ~17-23min); gate completo só uma vez ao final da fase.
  - Management API do Supabase (`api.supabase.com`) apresentou Cloudflare 502 esporádico durante a Fase 2/3 — tratado como flake de infra, `runSql` já retria 4x com backoff.
- **Uncommitted files**: `package-lock.json` modificado (resolução do `zod` + dependências `csv-parser`/`iconv-lite`/`pg` de trabalho paralelo do usuário) e `DADOS TSE/` untracked — **não relacionado a nenhuma feature deste projeto, não tocar**.
- **Branch**: master
