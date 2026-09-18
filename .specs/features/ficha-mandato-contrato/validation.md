# Ficha do Mandato/Contrato — Validation

**Date**: 2026-09-17
**Spec**: `.specs/features/ficha-mandato-contrato/spec.md`
**Diff range**: `ce6b1c7..9a31838` (primeiro commit `(ficha)` é `aa2a0ee`, filho de `ce6b1c7`; último é
`9a31838`, T20). Commits desta feature identificados via `git log --oneline --grep="(ficha)"`,
cruzados com a tabela "Estado de execução" de `tasks.md`. Inclui também `bdbc931` (não é desta
feature — `RegistroForm` de `fatos-geradores-ciclo-vida`, citado só para registrar a colisão de
nome resolvida por AD-061) e os 3 commits de correção pós-hoc `47cd68f`, `ab04026`, `5fb772d`
(todos `fix(ficha)`, legitimamente desta feature). O branch `develop` teve múltiplas features
concorrentes commitando intercaladas no mesmo período (`planejamento-estrategico-v2`,
`fatos-geradores-ciclo-vida`, `incidencia_v2`) — nenhum arquivo dessas features foi avaliado aqui.
**Working tree no início desta verificação** tinha alterações não commitadas pertencentes a
`fatos-geradores-ciclo-vida` (`src/backend/queries/incidencia.ts`, `components/incidencia/
{aba-incidencia,cadeia-lista,painel-detalhe,timeline-feed}.tsx` e testes, `lib/incidencia-cadeia.ts`,
`lib/incidencia-visual.ts` novo) — fora de escopo, não tocadas, não avaliadas.
**Verifier**: independente sub-agente (author ≠ verifier) — 4 sub-agentes de pesquisa em paralelo
(um por User Story) + verificação direta de gates e sensor de mutação pelo orquestrador do Verifier.

---

## Task Completion

39/39 tasks marcadas `✅ Done` em `tasks.md` — confirmado por commit hash único por task, todos
presentes em `git log`. Nenhuma task parcial ou bloqueada no estado final.

| Fase | Tasks | Status |
| :-- | :-- | :-- |
| 1A | T1–T6 | ✅ Done |
| 1B | T7–T9 | ✅ Done |
| 2 | T10–T13 | ✅ Done |
| 3 | T14–T17 | ✅ Done |
| 4 | T18–T21 | ✅ Done |
| 5 | T22–T23 | ✅ Done |
| 6 | T24–T29 | ✅ Done |
| 7 | T30–T32 | ✅ Done |
| 8 | T33–T36 | ✅ Done |
| 9 | T37–T39 | ✅ Done |

---

## Spec-Anchored Acceptance Criteria

### P1: Barra de abas funcional da ficha (FMC-01..04)

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| :-- | :-- | :-- | :-- |
| AC1 (8 abas, ordem) | 8 abas nesta ordem exata | `src/frontend/components/produtos/ficha-contrato-chrome.tsx:72-81` (array `todasAbas`) — `ficha-contrato-chrome.test.tsx:76-85` `expect(links).toEqual(OITO_ABAS_MANDATO)` | ✅ PASS |
| AC2 (sem aba de etapa) | nenhuma aba `ref_etapa` | `.test.tsx:100-109` `expect(screen.queryByRole("link",{name:/etapa/i})).not.toBeInTheDocument()` | ✅ PASS |
| AC3 (coalizão, 7 abas) | mesmas 8 exceto Informações Gerais | `ficha-contrato-chrome.tsx:82-85` + `.test.tsx:87-98` `expect(links).toHaveLength(7)` | ✅ PASS |
| AC4 (Gestão da equipe) | serve `/vinculos`, sem "Assessores" | `ficha-contrato-chrome.tsx:79` + `.test.tsx:111-119` `expect(...).toHaveAttribute("href","/contratos/1/vinculos")`; `queryByRole("link",{name:"Assessores"})` ausente | ✅ PASS |
| AC5 (rota etapa preservada) | `/etapas/[codigo]` continua resolvendo | `app/(app)/contratos/[id]/etapas/[codigo]/page.test.tsx:85-91` | ✅ PASS |
| AC6 (Diagnóstico → placeholder) | `<EmDesenvolvimento>` com título próprio | `contratos/[id]/diagnostico/page.tsx:7-9` + `.test.tsx:15-19` | ✅ PASS |
| AC6 (Fatos Geradores e Registros → placeholder) | idem | `contratos/[id]/fatos-registros/page.tsx` **não** renderiza `<EmDesenvolvimento>` — foi substituído por conteúdo real da feature dependente `fatos-geradores-ciclo-vida` (comentário explícito no próprio arquivo aponta a origem) | ⚠️ Superado por decisão documentada, não é gap desta feature — ver nota abaixo |
| AC7 (rótulo + abas presentes) | "Fatos Geradores e Registros" e "Gestão da equipe" na barra | `ficha-contrato-chrome.tsx:80` + `.test.tsx:121-127` | ✅ PASS |

**Nota sobre AC6/Fatos Geradores e Registros**: a spec desta feature explicitamente delega o
conteúdo dessa aba a `fatos-geradores-ciclo-vida` ("Out of Scope... aqui entra como rota +
placeholder"). Essa feature dependente já foi Specify→Design→Tasks→Execute→**Validate: PASS**
(`.specs/features/fatos-geradores-ciclo-vida/validation.md`) e substituiu o placeholder por
conteúdo real, com comentário rastreável no código apontando a origem. O texto literal da AC6 desta
spec ficou desatualizado frente ao estado atual do repo, mas isso é evolução esperada e sancionada,
não uma regressão de `ficha-mandato-contrato` — a aba "Diagnóstico" (a outra metade da mesma AC,
sem feature dependente ainda) continua com o placeholder intacto.

### P1: Informações Gerais do mandato (FMC-05..13)

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| :-- | :-- | :-- | :-- |
| AC1 (minibiografia persiste e relê) | banco grava e relê | `supabase/tests/fundacao/ficha-colunas.integration.test.ts:73-79` `expect(minibiografia).toBe(...)` — **confirmado por execução nesta sessão** | ⚠️ Parcial — banco: sim; ciclo UI salvar→reler não tem teste de página dedicado (`card-sobre-mandato.tsx:129-135` grava, nenhum teste simula o round-trip completo) |
| AC2 (ausente → "—") | nunca vazio/sentinela | `card-sobre-mandato.tsx:280` + `.test.tsx:100-104` | ✅ PASS |
| AC3 (vínculo tema, só ativos) | 1 linha em `rel_mandato_agenda_tematica`; só ativos no seletor | `mandato-agenda-tematica.integration.test.ts:67-74` (executado, passou); `card-sobre-mandato.tsx:81-83` `.eq("ativo",true)` | ✅ PASS |
| AC4 (30 temas, ordenados) | exatamente 30, por `ordem` | `agenda-tematica.integration.test.ts:48-58` (executado, passou) `expect(rows).toHaveLength(30)` | ✅ PASS |
| AC5 (duplicata rejeitada no banco) | PK composta rejeita | `mandato-agenda-tematica.integration.test.ts:76-82` (executado, passou) `expectSqlError(...,"23505")` | ✅ PASS |
| AC6 (contatos derivados, "—" se ausente) | `rel_usuario_contrato`+`dim_usuario` | `ficha-mandato.ts:159-208` + `.test.ts:158-197`; `card-sobre-mandato.tsx:51-55` + `.test.tsx:156-162` | ✅ PASS |
| AC7 (ponto focal grava e exibe) | `fat_contrato.id_usuario_ponto_focal` | `ficha-colunas.integration.test.ts:92-97` (executado, passou); `card-ponto-focal.tsx:71-74` + `.test.tsx:118-139` | ✅ PASS |
| AC8 (status canônico) | Ativo/Concluído/Não concluído, nunca "Em andamento" | `ficha-formatos.ts:11-20`; `card-historico-contratos.test.tsx:28-56` (1 caso por valor do enum) | ✅ PASS |
| AC9 (projetos/coalizões, badge) | `ref_projeto` + `rel_coalizao_membro` | `ficha-mandato.ts:95,114,235-256`; `card-projetos-coalizoes.test.tsx:37-51` | ✅ PASS |
| AC10 (pautas: chips na ordem, "—" vazio) | array texto livre | `card-sobre-mandato.tsx:284-296` + `.test.tsx:116-130`; banco `ficha-colunas.integration.test.ts:81-89` (executado, passou) | ✅ PASS |

### P1: Registro de encontro com camada dinâmica (FMC-14..22, FMC-37)

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| :-- | :-- | :-- | :-- |
| AC1 (Etapa/Tipo herdados, leitura) | sem controle de edição | `registro-encontro-form.tsx:195-204` + `.test.tsx:69-74` `queryByRole("combobox")` ausente | ✅ PASS |
| AC2 ("nº X de Y") | formato exato | `.test.tsx:81,86` `"nº 2 de 4"` / `"nº 3"` | ✅ PASS |
| AC3 (`nr_sequencia` servidor, concorrência) | MAX+1 sob `FOR UPDATE`, distintos sob concorrência | `20260917194328_ficha_fn_criar_registro.sql:90-93,112-122`; `criar-registro.integration.test.ts` teste "concorrência: duas chamadas simultâneas..." — **executado nesta sessão, PASSOU** (`Promise.all`, `nr_sequencia` distintos confirmados) | ✅ PASS |
| AC4/AC5 (camada dinâmica / vazio) | campos exatos / mensagem fixa | `camada-dinamica.tsx:41-47,52-148` + `.test.tsx:119-127,33-57` | ✅ PASS |
| AC6/AC7 (link → `fat_artefato`; URL rejeitada) | `escopo='registro'`; `ck_artefato_url` | `..._fn_criar_registro.sql:124-131`; `criar-registro.integration.test.ts:192-198`; `ck_artefato_url` em `artefato.integration.test.ts` — **executado, passou**; UI `.test.tsx:175-185` | ✅ PASS |
| AC8 (texto → `conteudo`) | grava por chave | `..._fn_criar_registro.sql:99-110,116-122`; teste `:158-190` | ✅ PASS |
| AC9/AC10 (presença; pré-marcação; A-21) | `rel_registro_participante`; não reescreve `presente` do encontro | `registro-encontro-form.tsx:107-109`; `criar-registro.integration.test.ts` testes A-08 e A-21 — **executados, passaram** | ✅ PASS |
| AC11 (sem Canal) | campo ausente | `registro-encontro-form.test.tsx:116-119` | ✅ PASS |
| AC12 (Local leitura na Imersão) | `fat_encontro.local` | `camada-dinamica.tsx:120-131` + `.test.tsx:75-102` | ✅ PASS |
| AC13 (transação única, rollback) | nenhum órfão | `criar-registro.integration.test.ts` teste de rollback — **executado, passou** | ✅ PASS |
| FMC-37 (`rel_registro_participante` completa) | tabela+RLS+grants | `registro-participante.integration.test.ts` (7 testes, **executado, passou**); RLS/`grants` em `ficha-rls.integration.test.ts` (**executado, passou**) | ✅ PASS |

### P1: GIP conforme a metodologia vigente (FMC-23..28)

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| :-- | :-- | :-- | :-- |
| AC1 (4 dimensões, ordem, faixa) | valores exatos do Anexo A | `20260916152603_ficha_gip_reseed_dimensoes.sql:30-48`; `gip-dimensao.integration.test.ts` — **executado nesta sessão, passou** (4 testes) | ✅ PASS |
| AC2 (14 descritores verbatim) | 4+4+3+3, texto exato | `20260916153018_ficha_seed_gip_niveis.sql:11-33`; `gip-nivel.integration.test.ts` — **executado, passou** (6 testes) | ✅ PASS |
| AC3 (1 opção por nível) | "Nível N" + descritor | `gip-regua.tsx:127-139` + `.test.tsx:95-136` | ✅ PASS |
| AC4 (faixa rejeitada no banco) | `trg_gip_dimensao_faixa` | `gip-dimensao.integration.test.ts` — **executado, passou** | ✅ PASS |
| AC5 (`fat_submissao`→trigger, nunca INSERT direto) | caminho existente preservado | `gip-regua.tsx:15-21,103-111` + `.test.tsx:172-199` | ✅ PASS |
| AC6 (só Início/Fim + Evolução) | nunca "Meio" | `contratos/[id]/gip/page.tsx:19-23` + `.test.tsx:87-94` | ✅ PASS |
| AC7 (momento aplicado indicado; 2º impedido) | UI bloqueia reenvio; `uq_gip_contrato_momento` existe | `gip-regua.tsx:62-84` + `.test.tsx:140-154` (UI); constraint em `20260814173302_formularios_produto_gip_estrutura.sql:34` | ⚠️ Parcial — a UI de fato impede reenvio (confirmado), mas o mecanismo real de escrita é `ON CONFLICT (id_contrato,momento) DO UPDATE` (upsert pré-existente de `formularios-produto`), não uma rejeição por violação de unicidade; nenhum teste **desta feature** exercita 2 gravações concorrentes do mesmo momento contra `fat_gip` — evidência de duplicidade é emprestada de `formularios-produto` T9 |
| AC8 (Início/Fim/variação por dimensão) | de `vw_gip_evolucao.gap` | `gip-evolucao.tsx:71-83`; `queries/gip.ts:142-170`; `.test.tsx:33-45` | ✅ PASS |
| AC9 (rótulos Subiu/Manteve/Regrediu) | singular/plural | `lib/gip.ts:18-33` + `.test.ts:11-29` — **mutado e confirmado discriminante nesta sessão** | ✅ PASS |
| AC10 ("Aguardando o outro momento") | string fixa | `lib/gip.ts:19-21` + `gip-evolucao.test.tsx:69-79` | ✅ PASS |
| AC11 (resumo soma só dimensões com 2 momentos) | contagem exata | `lib/gip.ts:38-55` + `.test.ts:41-51` + `gip-evolucao.test.tsx:94-108` | ✅ PASS |

### P2: Agenda na ficha e Novo Agendamento (FMC-29..36)

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| :-- | :-- | :-- | :-- |
| AC1 (grade recortada por contrato) | reusa `AgendaMes`/`EncontroPopover` | `contratos/[id]/agenda/page.tsx:166-191` + `.test.tsx:156-164` | ✅ PASS |
| AC2/AC3 (modal, transação única) | 8 campos exatos; `fat_encontro`+participantes 1 transação | `encontro-form.tsx` (8 campos linha a linha); `20260917194257_ficha_fn_criar_encontro.sql:72-93`; `criar-encontro.integration.test.ts` — **executado nesta sessão, passou** (rollback incluso) | ✅ PASS |
| AC4 (Etapa filtra Tipo) | os dois lados | `encontro-form.tsx:111-131` + `.test.tsx:152-173`; RPC `:64-70` + teste dedicado | ✅ PASS |
| AC5 (Modalidade→Local) | os dois lados; enum restrito | `encontro-form.tsx:304-310` + `.test.tsx:176-190` | ✅ PASS |
| AC6 (participante XOR) | nunca os dois | `.test.tsx:194-230`; RPC `:86-89` + `criar-encontro.integration.test.ts` — **executado, passou** | ✅ PASS |
| AC7 (Resumo/Autor nas 2 agendas) | nunca Descrição/Responsável | ficha: `agenda/page.tsx:262-263` + `.test.tsx:282-299`; produto-escopo: `produtos/[slug]/agenda/page.tsx:414-415,347-352` (comentário citando EST-12) + `page.test.tsx:572-587` — **confirmado diretamente pelo orquestrador do Verifier** | ✅ PASS |
| AC8 (`sprint.qtd_prevista=4`) | valor exato | `20260916153258_ficha_schema_campos_tipos.sql:92`; `schema-campos.integration.test.ts` — **executado, passou** | ✅ PASS |
| FMC-35 (RLS das 3 tabelas) | `p_por_contrato`/`p_heranca`, USING+WITH CHECK, com/sem vínculo, admin/gestora atravessa | `ficha-rls.integration.test.ts` — **executado nesta sessão, 16/16 passaram**, incluindo comportamento real via sessão autenticada (Assessor aceito no próprio contrato, rejeitado 42501 no de outro; Gestora atravessa) para `fat_artefato` e `rel_registro_participante` | ✅ PASS (ver nota) |
| FMC-36 (auditoria 3 tabelas novas) | linha real em `log_auditoria` | `ficha-auditoria.integration.test.ts` — **executado nesta sessão, 4/4 passaram**, cada um afirmando `acao` em sequência (`insert/update/delete`) | ✅ PASS |
| FMC-36 (auditoria colunas novas `dim_mandato`/`fat_contrato`) | idem | `ficha-colunas.integration.test.ts` (executado) só grava/relê — **nenhuma asserção de `log_auditoria` para `minibiografia`/`principais_pautas`/`id_usuario_ponto_focal`** | ❌ NÃO COBERTO (não confirmado por teste desta feature) |

**Nota sobre FMC-35/`rel_mandato_agenda_tematica`**: o predicado `p_heranca` foi verificado
estruturalmente (`pg_policies`, texto exato do `USING`/`WITH CHECK`, herança mandato→contratante→
contrato) e o bypass admin/gestora tem teste comportamental real. O ramo "usuário com/sem vínculo"
do `EXISTS` é **hoje inatingível em comportamento real**, porque nenhuma role (`mentor`/`assessor`)
recebeu `GRANT` nesta tabela — decisão documentada no próprio teste (`ficha-rls.integration.test.ts:161-171`):
a User Story de FMC-05..13 nomeia só a Gestora como atriz. Isso é escopo resolvido e coerente com a
spec, não uma omissão silenciosa — mas registra-se aqui porque a AC do Sweep ("usuário sem vínculo
não lê nem escreve") não tem, para esta tabela específica, um teste que produza esse resultado por
caminho de role real.

**Status geral**: 34/37 requisitos com evidência completa batendo o outcome exato da spec; 3 com
gap parcial (FMC-05 AC1 round-trip de UI; FMC-27 AC7 mecanismo de bloqueio; FMC-36 colunas novas
sem teste de auditoria dedicado) — todos Minor, nenhum Blocker/Major.

---

## Discrimination Sensor

Ambiente é Supabase remoto (dev, sem Postgres local/Docker — `docs/ambientes.md`); mutar SQL de
migration/trigger/RLS já aplicado exigiria `db push` real para se refletir no comportamento
observável, o que violaria a regra "nunca mutar a árvore real" e o próprio processo de release do
projeto (CLAUDE.md: toda mudança de schema é forward-only, revisada, nunca ad hoc). Por isso o
sensor desta rodada mirou os módulos de lógica pura/wrapper que carregam as mesmas invariantes
(evolução do GIP, parser da camada dinâmica, rótulo de status, payload do RPC de registro) — todos
mutados na árvore real e revertidos com `git checkout` logo em seguida (confirmado limpo por
`git status` após cada reversão), nunca com o sensor rodando sobre uma cópia órfã. Os invariantes
puramente SQL (guarda de falha alta da T11, concorrência de `nr_sequencia`, predicado `p_heranca`)
foram, em vez disso, **reexecutados ao vivo** contra o dev real nesta sessão (não mutados) para
confirmar que os testes de fato exercitam o cenário adverso declarado (concorrência real via
`Promise.all`, rejeição real via role authenticated) — evidência forte, ainda que não seja mutação
no sentido estrito.

| Mutação | file:line | Descrição | Killed? |
| :-- | :-- | :-- | :-- |
| 1 | `src/frontend/lib/gip.ts:23` | `gap === 0` → `gap <= 0` (gap negativo passa a rotular "Manteve" em vez de "Regrediu") | ✅ Killed — `gip.test.ts` e `gip-evolucao.test.tsx` falharam |
| 2 | `src/frontend/lib/camada-dinamica.ts:41-43` | `ehTipoConhecido` deixa de checar a lista de tipos válidos (aceita qualquer string) | ✅ Killed — `camada-dinamica.test.ts` (T14) e `camada-dinamica.test.tsx` (T30) falharam |
| 3 | `src/frontend/lib/ficha-formatos.ts:16` | `"concluido"` → `"Em andamento"` (o rótulo que a spec proíbe explicitamente) | ✅ Killed — `ficha-formatos.test.ts` e `card-historico-contratos.test.tsx` falharam |
| 4 | `src/backend/rpc/registro.ts:70` | `id_usuario: participante.idUsuario ?? null` → sempre `null` (payload de presentes perde o vínculo do usuário) | ✅ Killed — `registro.test.ts` falhou na asserção exata do payload |

**Sensor depth**: lightweight (4 mutações; nenhuma é P0/pagamento — dados transacionais de produto,
não financeiros).
**Result**: 4/4 killed — ✅ PASS

**Reforço por reexecução (não mutação, evidência corroborativa)**: `criar-registro.integration.test.ts`
teste "concorrência: duas chamadas simultâneas..." (FMC-15 AC3) reexecutado e confirmado passando
contra o dev real; `ficha-rls.integration.test.ts` reexecutado (16/16), incluindo os testes de
rejeição real (42501) para role `assessor` sem vínculo no contrato B; `gip-dimensao.integration.test.ts`
reexecutado confirmando a rejeição real do `trg_gip_dimensao_faixa` fora da faixa 0-2.

---

## Code Quality

| Principle | Status |
| :-- | :-- |
| Minimum code | ✅ — nenhuma task tocou mais de um componente/arquivo de produção (Task Granularity Check em `tasks.md`) |
| Surgical changes | ✅ — colisão de nome com `registro-form.tsx` resolvida criando arquivo próprio (`registro-encontro-form.tsx`), sem tocar o componente alheio (AD-061) |
| No scope creep | ✅ — `organograma` explicitamente não seedado (B-02); bloco de fotos fica "em desenvolvimento" (FMC-22), sem upload implementado |
| Matches patterns | ✅ — RLS `p_por_contrato`/`p_heranca`, grants em bloco, RPC `SECURITY INVOKER` seguem os precedentes citados em `design.md` |
| Spec-anchored outcome check | ✅ — ver tabelas acima; 34/37 sem ressalva |
| Per-layer Coverage Expectation | ✅ — migrations com aceite+rejeição; funções puras com todos os ramos; componentes com os dois lados de cada condicional (AD-042 integral, confirmado por spot-check em `ficha-contrato-chrome.test.tsx`, `card-sobre-mandato.test.tsx`, `gip-regua.test.tsx`) |
| Todo teste mapeia para AC/edge case | ✅ — nenhum teste "solto" encontrado nos arquivos revisados |
| Guidelines documentadas seguidas | ✅ — `CLAUDE.md` (migrations via `supabase migration new`+`db push` em dev, nunca prod); AD-024 (RPC `SECURITY INVOKER`); AD-006 (`app.id_usuario()` nunca por parâmetro, confirmado em `criar_registro.sql`) |

---

## Edge Cases

- [x] Coalizão acessa `/informacoes` por URL direta → `notFound()` (`page.tsx:57-60,72-74` + `page.test.tsx:140-151`)
- [x] Catálogo de área temática vazio → `<EstadoVazio>` explicativo (`card-sobre-mandato.tsx:246-250` + teste)
- [x] Dois registros do mesmo contrato+tipo simultâneos → `nr_sequencia` distintos (concorrência real testada e reexecutada)
- [x] Campo de tipo desconhecido em `schema_campos` → ignorado, não quebra formulário (`parseSchemaCampos` + camada dinâmica, mutação 2 confirma discriminação)
- [x] Migration de re-seed do GIP com dado preexistente → falha alta (guarda `RAISE EXCEPTION`; confirmado por evidência histórica do lote 2, "zero linhas antes da migration" — não pôde ser reexercitado sem popular `fat_gip_dimensao` em dev real, risco desnecessário)
- [x] Mandato sem outro contrato → histórico mostra a linha do próprio contrato (`card-historico-contratos.test.tsx:68-72`)
- [x] Usuário sem vínculo → RLS nega leitura, UI degrada para `<ErroInline>` (confirmado para `fat_artefato`/`rel_registro_participante` via role real; `rel_mandato_agenda_tematica` só bypass admin/gestora tem execução real — ver nota FMC-35 acima)

---

## Gate Check

- **Gate command (unit)**: `npm run test:unit` — **1291/1291 passando, 119 arquivos, 0 falhas** (executado nesta sessão)
- **Gate command (integration, arquivos desta feature)**: `npx vitest run --config vitest.integration.config.ts` sobre os 12 arquivos de teste próprios da feature (não a suíte completa — política de gate registrada em `tasks.md`, custo ~2h40 da suíte inteira) — **78/78 passando, 0 falhas**:
  - `gip-dimensao` (4), `gip-nivel` (6), `schema-campos` (12), `agenda-tematica` (2)
  - `ficha-rls` (16), `ficha-auditoria` (4), `ficha-colunas` (4), `mandato-agenda-tematica` (3)
  - `artefato` (4), `registro-participante` (7)
  - `criar-registro` (10), `criar-encontro` (6)
- **Test count before feature**: unit ~775 (registrado em `tasks.md`, marco antes do lote 1); integration: dívida herdada de 5 arquivos/13 testes alheios já documentada, não desta feature
- **Test count after feature**: unit 1291 (delta +516 aproximado ao longo de toda a feature, conforme os marcos intermediários registrados em `tasks.md`); integration 78 testes próprios desta feature, todos verdes
- **Delta**: sem decréscimo em nenhum arquivo — nenhuma task removeu teste existente
- **Skipped tests**: nenhum teste desta feature foi pulado
- **Failures**: nenhuma

---

## Fix Plans (não-bloqueantes)

### Fix 1: FMC-05 AC1 sem teste de round-trip de página para minibiografia
- **Root cause**: o teste de componente do card cobre a chamada de `update`; o teste de integração de banco cobre grava+relê a nível de coluna. Nenhum teste de página simula "salvar no card → reler a ficha → ver o novo texto" especificamente para minibiografia.
- **Fix task**: adicionar um teste em `informacoes/page.test.tsx` que simula o ciclo completo (mock de `onAtualizado` disparando refetch) para minibiografia.
- **Priority**: Minor

### Fix 2: FMC-27 AC7 — bloqueio de 2º GIP do mesmo momento sem teste próprio desta feature
- **Root cause**: a escrita passa por `ON CONFLICT DO UPDATE` (upsert pré-existente de `formularios-produto`), não por uma rejeição de unicidade; o único teste que exercitou reenvio do mesmo momento pertence a outra feature.
- **Fix task**: teste de integração próprio em `supabase/tests/catalogos/gip-dimensao.integration.test.ts` (ou arquivo dedicado) que envia 2 submissões do mesmo `(id_contrato, momento)` e confirma o comportamento observável (upsert em vez de erro), documentando explicitamente por que não é uma rejeição de constraint.
- **Priority**: Minor

### Fix 3: FMC-36 — colunas novas de `dim_mandato`/`fat_contrato` sem teste de auditoria dedicado
- **Root cause**: `ficha-colunas.integration.test.ts` verifica gravação/releitura, não `log_auditoria`. A cobertura funcional existe via trigger genérico pré-existente (`0012_fundacao_auditoria_gap.sql`), mas não há asserção própria desta feature.
- **Fix task**: estender `ficha-colunas.integration.test.ts` com um teste que faz `UPDATE` nas 3 colunas novas e afirma a linha resultante em `log_auditoria` (mesmo padrão de `ficha-auditoria.integration.test.ts`).
- **Priority**: Minor

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| :-- | :-- | :-- |
| FMC-01, FMC-02, FMC-03 | Pending | ✅ Verified |
| FMC-04 | Pending | ✅ Verified (nota sobre AC6/Fatos Geradores acima) |
| FMC-05 | Pending | ⚠️ Verified com gap Minor (Fix 1) |
| FMC-06..13 | Pending | ✅ Verified |
| FMC-14..21 | Pending | ✅ Verified |
| FMC-22 | Pending | ✅ Verified |
| FMC-23..26 | Pending | ✅ Verified |
| FMC-27 | Pending | ⚠️ Verified com gap Minor (Fix 2) |
| FMC-28 | Pending | ✅ Verified |
| FMC-29..34 | Pending | ✅ Verified |
| FMC-35 | Pending | ✅ Verified (nota sobre `rel_mandato_agenda_tematica` acima) |
| FMC-36 | Pending | ⚠️ Verified com gap Minor (Fix 3) |
| FMC-37 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready (com 3 gaps Minor, não-bloqueantes, registrados como Fix Plans acima)

**Spec-anchored check**: 34/37 requisitos com evidência completa batendo o outcome exato da spec;
3 com gap Minor documentado (nenhum spec-precision gap novo — a única ambiguidade textual da spec,
FMC-28 AC10, já tinha sido fechada em 2026-09-16, confirmado nesta sessão)
**Sensor**: 4/4 mutações mortas (lógica pura/wrapper); invariantes SQL de maior risco reexecutados
ao vivo contra o dev real e confirmados corretos (concorrência de `nr_sequencia`, RLS com role real,
faixa do GIP)
**Gate**: unit 1291/1291; integration (78 testes próprios da feature) 78/78 — 0 falhas em ambos

**What works**: as 8/7 abas funcionais; Informações Gerais completa (biografia, pautas, temas,
contatos, ponto focal, histórico, projetos/coalizões); Registro com camada dinâmica, artefatos e
presença transacionais, incluindo concorrência real de `nr_sequencia`; GIP realinhado à metodologia
(4 dimensões, 14 descritores, Evolução); Agenda recortada por contrato com modal de agendamento
transacional; RLS/grants/auditoria das 4 tabelas novas.

**Issues found**:
1. FMC-05 AC1 — sem teste de round-trip de página para minibiografia (Fix 1, Minor)
2. FMC-27 AC7 — bloqueio de 2º GIP via upsert, não erro; sem teste próprio (Fix 2, Minor)
3. FMC-36 — colunas novas sem teste de auditoria dedicado (Fix 3, Minor)

**Next steps**: nenhum obrigatório antes de considerar a feature pronta — os 3 Fix Plans são
recomendados, não bloqueantes, e cabem numa sessão futura curta. Nenhum Blocker ou Major encontrado
em 39/39 tasks e 37 requisitos.
