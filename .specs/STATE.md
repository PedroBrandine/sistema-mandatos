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

---

## Handoff

- **Feature**: Fundação — entidades & pessoas (`.specs/features/fundacao-entidades-pessoas/`)
- **Phase / Task**: Execute — **Fase 4 completa** (T24-T28, camada backend TypeScript). Próxima: Fase 5 (T29-T37, componentes de frontend) — não iniciada. Sessão foi explicitamente escopada pelo usuário a "T24 até T28"; não avançar para T29 sem novo pedido.
- **Completed**: Specify → Design (AD-024 RPC `SECURITY INVOKER`) → Tasks (37 tasks, 6 fases) → **Batch 1** (T1-T9, Fase 0/1) → **Fase 2 completa** (T10-T19) → **Fase 3 completa** (T20-T23) → **Fase 4 completa** (T24-T28), cada task revisada, com gate individual e commit atômico:
  - T10 `d350946`, T11 `f922092`, T12 `51e160c`, T13 `5fabd80`, T14 `791cdc8`, T15 `dacc378`, T16 `1138ab4`, T17 `3a4d711`, T18 `bc87e6d`, T19 `53bafd9`.
  - T20 `258bff8` (`app.criar_mandato` + `app.contratante_similar`), T21 `6a725b6` (`app.marcar_candidatura_vigente`), T22 `0d977cd` (`app.criar_coalizao`), T23 `a45edf8` (`app.substituir_vinculo`).
  - Gate final da Fase 3 (`npm run test:integration`, suíte completa): 17 arquivos, **120/120 testes passando** (104 da Fase 2 + 16 novos: T20=5, T21=4, T22=4, T23=3).
  - T24 `34c0299` (tipos gerados + `tse` exposto no PostgREST), T25 `e2ff001` (tipos compostos), T26 `f508a12` (Zod schemas), T27 `d060d21` (`buscarCandidaturas`), T28 `7e724bd` (RPC wrappers).
  - Gate final da Fase 4 (`npm run test:unit`, suíte completa): 10 arquivos, **81/81 testes passando** (54 dos schemas de T26 + 8 de T27 + 19 de T28). `npm run build` limpo. Nenhuma task desta fase toca migração/RLS — `test:integration` não se aplica (camada TypeScript é unit-only, Test Coverage Matrix).
- **Decisões de design da Fase 4** (não estavam explícitas no "What" das tasks, decididas durante a implementação):
  - **T24**: `supabase/config.toml` nunca expunha o schema `tse` no PostgREST (só `public`/`graphql_public`/`app`) — `GRANT USAGE`/`SELECT` já estavam corretos desde T11/T15, mas sem a exposição, `supabase gen types` omitia `tse` por completo e uma query real `supabase.schema('tse').from(...)` (necessária em T27) falharia em runtime com "schema not exposed", apesar de testes mockados passarem. Corrigido adicionando `tse` a `[api] schemas` (mesmo padrão de `app` em T4) + `supabase config push` (diff mostrado, só essa linha mudou).
  - **T26**: `zod` promovido de dependência transitiva (só puxada por `eslint-config-next`/`shadcn`) para dependência direta do `package.json` raiz (AD-021 exige Zod). `mandatoSchema`/`contratanteSchema` excluem deliberadamente `origem_partido_cargo`/`tipo_contratante` — decididos pela própria função RPC, nunca aceitos do caller. Extraído `src/backend/schemas/texto-limpo.ts` (reuso do domínio `texto_limpo` por 5 dos 6 schemas).
  - **T27**: gap de arquitetura — o operador `%`/`similarity()` do pg_trgm não é exposto pela grade de filtros REST do PostgREST, então o design previa "busca fuzzy direta" mas isso não é alcançável sem SQL bruto (risco de injection, já que `nome` é input do usuário). Resolvido com `ilike()` (seguro, parametrizado, acelerado pelo índice GIN trigram de T18) + coeficiente de Dice calculado em JS sobre as linhas já filtradas, para computar `confianca`. Spec-precision gap: spec.md não define os limiares numéricos de alta/média/baixa — implementados como decisão desta sessão (≥0.6/≥0.3), documentados no código.
  - **T28**: extraído `src/backend/rpc/errors.ts` (`mapeiaErroRpc`, reusado pelos 3 wrappers). `MDU01` só é testado nas 2 funções que checam duplicata (`criarMandato`/`criarCoalizao`); códigos não mapeados (`P0001`, usado por T21/T23 para seus próprios erros de negócio) são relançados sem alteração, nunca engolidos.
  - **Lacuna de verificação recorrente nesta fase**: como não existe `tsconfig.json` na raiz (só `src/frontend/tsconfig.json`), nem `npm run build` (que só type-checa o que o Next importa) nem `npm run test:unit` (Vitest usa esbuild, não type-checa) verificam tipos de arquivos `src/backend/**` que ainda não têm nenhum consumidor no frontend. T25 usou uma página descartável em `src/frontend/app/_verify-t25/` para forçar a checagem (removida depois); T27/T28 usaram `npx tsc --noEmit` direto com as mesmas `compilerOptions` do projeto (`--strict --target ES2017 --module esnext --moduleResolution bundler --esModuleInterop --skipLibCheck --lib ES2017,DOM`) sobre os arquivos novos. Vale para qualquer task futura de `src/backend/**` sem consumidor ainda em `src/frontend/**` — não assumir que `build`/`test:unit` verde implica tipos corretos nesses arquivos.
- **Decisões de design da Fase 3** (não estavam explícitas no "What" das tasks, decididas durante a implementação):
  - Checagem de duplicata (`app.contratante_similar`, extraída em T20 e reusada verbatim por T22): `nome_normalizado` (via `app.normaliza_nome`) + `sg_uf` + `nm_municipio`, comparação NULL-safe (`IS NOT DISTINCT FROM` — dois contratantes sem UF/município cadastrado também contam como parecidos).
  - Lista de similares do erro `MDU01` vai serializada como JSON no `DETAIL` do `RAISE EXCEPTION` — PostgREST expõe isso como `error.details` (consumido pelo wrapper RPC em T28).
  - `origem_partido_cargo` de `dim_mandato` é decidido pela própria função `app.criar_mandato` (`'tse'`/`'manual'` conforme presença de `p_candidatura`), nunca aceito do caller.
  - `eh_mandato_vigente` permanece no default (`false`) mesmo quando `app.criar_mandato` recebe candidatura confirmada — marcar como vigente é sempre uma ação explícita separada via `app.marcar_candidatura_vigente` (T21), mesmo para a primeira candidatura de um mandato novo. Evita sobrepor responsabilidade entre as duas funções.
  - `app.substituir_vinculo` (T23) usa `RAISE EXCEPTION` com SQLSTATE padrão (`P0001`, sem `ERRCODE` customizado) para "vínculo não encontrado"/"vínculo já encerrado" — a Error Handling Strategy do design só define `MDU01` como código customizado (duplicata de contratante); não foi inventado um código novo não previsto no design para este caso.
  - Todas as 4 funções + `app.contratante_similar` são `SECURITY INVOKER` (default do Postgres, AD-024) — nenhuma declara `SECURITY DEFINER`. Não precisaram de GRANT `EXECUTE` explícito: funções novas em `app` recebem `EXECUTE` de `PUBLIC` por padrão do Postgres (diferente de tabelas), e os 5 papéis já têm `USAGE ON SCHEMA app` desde T3/0004 — confirmado via teste (`prosecdef = false`) em todas as 4 tasks.
- **Contexto importante para quem retomar (Fase 2)**: T12-T19 chegaram a esta sessão como arquivos já escritos por uma rodada anterior que pulou o ciclo gate/commit por task (ver histórico desta seção antes da reescrita). Nenhum foi aceito por existir — cada um foi revisado contra o Done-when da task, e **4 bugs reais foram encontrados e corrigidos** no processo (todos com teste que os expôs, nenhum reintroduzido):
  1. **T13** (`5fabd80`): teste de `uq_vinculo` usava `id_contrato` hardcoded/inexistente (888888) — quebrava com `fk_vinculo_contrato` (adicionada só em T14) ativa; reescrito contra fixture real de `fat_contrato`, movido para `beforeAll`/`afterAll` (mesma classe de bug do item 3 abaixo).
  2. **T16/T17** (`1138ab4`, `3a4d711`): GRANT de `legisla_mentor` cobria só 3 das 6 tabelas com RLS nova (faltava `dim_coalizao`, `rel_mandato_candidatura`, `rel_coalizao_membro`, `rel_usuario_contrato`) — mentor recebia `42501` mesmo com política correta; e o loop de trigger de auditoria aprovado (`docs/schema_sistema.sql:1712-1732`) nunca foi aplicado a `fat_contrato`/`dim_mandato`/`rel_usuario_contrato`/`rel_mandato_candidatura` por nenhuma task — violava AD-006 para as 4 tabelas centrais da Fundação. Ambos corrigidos e testados.
  3. **T16** (`1138ab4`): fixture de teste com ~14 round-trips sequenciais de `runSql` estourava o `hookTimeout` global de 30s, deixando `afterAll` limpar variáveis `undefined` — timeout do hook aumentado para o fixture real (mesma classe de bug corrigida em T13/T14 também, inline).
  4. **T18** (`bc87e6d`): teste do planner envolvia `EXPLAIN` dentro de uma subquery `FROM (...)` — sintaticamente inválido no Postgres (`EXPLAIN` é statement utilitário, não expressão SELECT) — reescrito como statement de topo junto com `SET LOCAL`.
  - T14 não tinha teste algum (criado do zero: 18 casos, cobrindo todos os CHECKs/UNIQUEs nomeados no Done-when + os não-nomeados, por "todos os CHECKs/UNIQUEs do schema aprovado").
  - Na Fase 3, mesma classe de bug reapareceu uma vez: o teste "candidatura de outro mandato não afetada" (T21) tem 6 round-trips sequenciais de `runSql` e estourou o `testTimeout` padrão de 30s (não o `hookTimeout` desta vez — é o timeout do próprio `it()`) sob a lentidão da Management API observada nesta sessão; corrigido elevando o timeout desse teste para 60s.
- **Infra flakiness observada e não-bloqueante**: a Management API do Supabase (`api.supabase.com`) devolveu Cloudflare 502 pelo menos 4 vezes durante os gates da Fase 2 (T13, T14, T15, T12 — sempre em teste diferente, sempre já commitado e correto, nunca reproduzível ao re-rodar isolado). Tratado como flake de infra externa, não bug de código — mesmo padrão já documentado nos commits de T5/T11. `supabase/tests/helpers/sql.ts` (`runSql`) já retria 4x com backoff exponencial para esse caso.
- **Disco cheio durante a Fase 3 (evento não relacionado ao código)**: durante o primeiro gate completo pós-T21, o disco `C:` chegou a 100% de uso (0 disponível), causando `ENOSPC` no cache do Vitest e corrompendo a sessão de login da CLI do Supabase no meio da suíte (`LegacyPlatformAuthRequiredError` em 12 dos 17 arquivos daquela rodada). O usuário limpou o disco manualmente (voltou a ~4.3G livres, depois ~12G); todas as migrações e commits desta sessão já estavam corretos antes do evento — nenhuma correção de código foi necessária, só re-rodar o gate depois da limpeza. Não investigada a causa raiz do consumo de disco (não parece ligada aos arquivos temporários de teste, que são pequenos e limpos via `finally`/`unlink`).
- **Decisão de processo desta sessão (Fase 3)**: a cada task, rodar o gate só no arquivo de teste novo (`npm run test:integration -- <arquivo>`), não a suíte completa — decisão do usuário para reduzir o tempo de ciclo contra o Supabase remoto (a suíte completa leva ~17-23min, rodando 1 arquivo por vez, `fileParallelism: false`). O gate completo (`npm run test:integration`, suíte inteira) roda uma única vez ao final da fase, antes do handoff. Vale para fases futuras também, a menos que o usuário peça o contrário.
- **Next step**: Fase 5 — T29 (`ContratanteFields`), T30 (`DuplicataWarningDialog`), T31 (`TseMatchSearch`), T32 (`MandatoWizard`), T33 (`ContratoForm`), T34 (`VinculoTable`/`VinculoForm`), T35 (`CoalizaoForm`), T36 (`UsuarioForm`), T37 (o que faltar de integração/rotas — ver tasks.md para o detalhe exato de T32-T37, não lido em profundidade nesta sessão). Nenhum arquivo desta fase existe ainda. 9 tasks restantes (T29-T37, Fase 5) — dentro do budget de ~8 tasks por batch de sub-agent (bem próximo do limite; considerar 1-2 batches se for delegar). Sessão anterior seguiu execução inline por continuidade (mesmo padrão da Fase 2/3/4); esta sessão foi explicitamente escopada pelo usuário a T24-T28, então parou aqui por pedido, não por limite de batch.
- **Blockers**: nenhum.
- **Deviations acumuladas do Batch 1** (todas documentadas inline nos commits, nenhuma bloqueante): migrações renumeradas 0001-0005 (pré-requisito `dim_usuario` criado antes da Fase 2 por T2/T5 precisarem dele); GRANTs de T3 escopados ao que já existe (AD-025); `db-pre-request` wireado via `ALTER ROLE authenticator SET pgrst.db_pre_request` (chave não existe em `config.toml`); `supabase config push` reescreveu `[auth]` inteiro no projeto remoto no primeiro push — restaurado na mesma task; T5 teve retry hardening (`runSql` 3×1.5s → 4×exponencial) por instabilidade real da Management API (Cloudflare 502), não bug de código; T7 shadcn `form` sem arquivo no registry vivo — componente escrito à mão seguindo o padrão shadcn/ui + trocado de preset `@base-ui/react` para `radix`; T8 converteu `src/frontend` em npm workspace do `package.json` raiz (import de `src/backend` exigia isso — duas árvores `node_modules` desconectadas nunca resolveriam); T9 usou `eslint.config.mjs` (flat config) em vez de `.eslintrc*` (ESLint 9 exige flat config).
- **Deviation de processo da Fase 2**: `supabase db push` aplica todas as migrações pendentes de uma vez (sem opção de aplicar uma por vez) — migrações 0008-0013 (T13-T18) foram todas ao remoto num único push ao início daquela sessão de correção, antes da revisão task-a-task. Não invalida a disciplina de commit (cada task ainda foi revisada/testada/commitada isoladamente antes de seguir) nem a idempotência (todas as migrações usam `IF NOT EXISTS`/`DO $$ IF NOT EXISTS`), mas correções de bug encontradas depois precisaram ser aplicadas diretamente no remoto via `supabase db query` além de editar o arquivo `.sql`, já que reverter/reaplicar seletivamente não é possível sem Docker/`supabase start`.
- **Deviation de processo da Fase 3**: para manter a disciplina task-a-task apesar de `supabase db push` aplicar todas as migrações pendentes de uma vez, os arquivos de migração das tasks ainda não commitadas (0016, 0017) foram movidos temporariamente para fora de `supabase/migrations/` (para `/tmp`) enquanto a task corrente era implementada/testada/commitada, e devolvidos um de cada vez logo antes de cada `supabase db push` correspondente — garantindo que cada push aplicasse exatamente 1 migração nova por vez, com o tracking de `schema_migrations` do CLI (`supabase migration list`) sempre correto (sem precisar de `db query` manual como paliativo, ao contrário do desvio da Fase 2).
- **Deviation de processo da Fase 4 (erro real cometido e corrigido nesta sessão)**: `package.json`/`package-lock.json` já chegaram a esta sessão modificados por trabalho paralelo do usuário (dependências `csv-parser`/`iconv-lite`/`pg`, relacionadas a `DADOS TSE/`, não-relacionado a esta feature). T26 precisou adicionar `zod` como dependência direta (`npm install zod`) — para não misturar o trabalho do usuário no commit desta feature, a intenção era isolar só a linha do `zod` no índice via `git hash-object`/`git update-index --cacheinfo` (HEAD + zod, nada mais) e commitar isso. **Isso falhou silenciosamente**: o commit de T26 foi feito com `git commit -- package.json src/backend/schemas` (pathspec explícito), e `git commit <pathspec>` lê o **working tree** dos caminhos informados, não o índice — então a blob cuidadosamente isolada foi ignorada e o `package.json` completo (com as 3 dependências do usuário) foi parar no commit `f508a12` mesmo assim. Descoberto ao revisar este próprio Handoff antes de escrevê-lo (checando `git diff package.json` pós-commit, que deveria estar vazio e não estava). Corrigido com um commit de fix (`99def84`, sem pathspec desta vez — commitando exatamente o que estava no índice) removendo as 3 dependências do `package.json` rastreado, sem tocar no arquivo de trabalho. **Lição para sessões futuras**: `git commit -- <arquivo>` não é seguro para isolar um índice preparado manualmente por `update-index --cacheinfo` — usar `git commit` sem pathspec (commitando exatamente o índice) sempre que o índice for preparado à mão dessa forma. `package-lock.json` ficou de fora do commit por completo (dividir um lockfile gerado é frágil) — continua modificado/não commitado, mesmo estado de antes, só que agora também reflete a resolução do `zod`.
- **Ambiente confirmado**: projeto Supabase de dev `sistema-mandatos-dev` (`npnvoolkebhabjkjzqwn`, região `sa-east-1`), separado do `mgoeloqdlpgkofgqqbjs` de produção (AD-020). Supabase CLI v2.110.0, linkada. Docker não instalado — testes de integração contra este projeto remoto.
- **Uncommitted files**: nenhum pendente da feature. `.agents/`, `.claude/`, `.specs/`, `docs/` (untracked, pré-existentes, fora do versionamento por convenção desta sessão). `package-lock.json` modificado (inclui a resolução do `zod` desta sessão + as 3 dependências do usuário) e `DADOS TSE/` untracked — **trabalho paralelo do usuário, não relacionado a esta feature, não tocar**. `package.json` está limpo (`git status` não o lista mais — a parte desta feature foi commitada isoladamente em T26, `f508a12`).
- **Branch**: master
