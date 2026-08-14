# Formulários dos Produtos Specification

## Problem Statement

Hoje nenhum dos 16 formulários do sistema (Termo de Compromisso, Organograma, GIP, avaliações do
PLL etc.) tem página própria — a Constituição (§2.5, OPR-02) exige que "cada formulário é uma
página respondível no sistema, não upload de Sheets", e o catálogo (`ref_formulario`/
`ref_metrica_formulario`) e o vínculo por contrato (`rel_formulario_contrato`, já aberto/fechável no
banco) existem desde a Trilha C e a régua de instanciação — mas não há mecanismo de resposta, nem
tela para a Gestora abrir/fechar um formulário, nem RLS que autorize a escrita. Sem isso, a
Definição de Pronto (§6) permanece incompleta nesta camada e a operação continua dependendo de
planilha fora do sistema.

## Goals

- [ ] Gestora/Admin conseguem abrir e fechar qualquer um dos 16 formulários por contrato, pela UI.
- [ ] O respondente autorizado consegue preencher um formulário aberto numa página nativa do
      sistema, dirigida por metadado (`ref_metrica_formulario`), nunca por schema fixo no código.
- [ ] O GIP (Início/Meio/Fim) tem tela própria e alimenta `fat_gip`/`fat_gip_dimensao` de forma
      determinística, com leitura pela `vw_gip_evolucao`.
- [ ] O NPS das avaliações agrega de verdade sobre `fat_resposta_metrica`/`mv_avaliacao_nps`, sem
      depender de planilha calculada.

## Out of Scope

Explicitamente excluído. Documentado para prevenir scope creep.

| Item | Razão |
| --- | --- |
| Upload real de anexo (`fat_artefato`) para Termo de Compromisso/Código de Conduta | `fat_artefato` não é provisionada nesta feature (decisão de Pedro, ver `context.md`); P1 cobre só o aceite (`aceite_em`) |
| Levantamento humano do conteúdo real dos 16 formulários (perguntas, tipos, agrupadores) | Mesma categoria de débito da CAT-16 — trabalho de conteúdo, não de código; fora do que esta feature resolve |
| `inscricao_mentorado`/`inscricao_mentor` (PLL) na página respondível | Acontecem antes de existir `fat_contrato`/vínculo no sistema (Constituição §2.2, "importação manual... sem conexão automática na v1") — incompatível com `fat_submissao.id_contrato NOT NULL` |
| `/admin/catalogos` (edição de `ref_metrica_formulario`/`schema_campos` por UI) | Mesma fronteira já traçada pela Trilha C — entra quando o Admin tiver mais o que administrar |
| Versionamento de formulário (bump de `ref_formulario.versao` pela UI) | Sem tela de administração de catálogo, `versao_formulario` grava sempre a versão vigente; bump manual via migration, se necessário |
| Job agendado de refresh da `mv_avaliacao_nps` (`pg_cron`) | Projeto não tem `pg_cron` provisionado (mesmo estado de `app.recalcula_pendentes`); refresh é sob demanda |

---

## Assumptions & Open Questions

Toda ambiguidade foi resolvida em duas rodadas de Discuss com Pedro (ver `context.md` para o
raciocínio completo) ou registrada aqui como assumption.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Escopo do GIP inclui `fat_gip`/`fat_gip_dimensao` | Provisionar nesta feature, tela sob medida (não motor genérico) | Decisão explícita de Pedro — sem a derivação, capturar o GIP como JSONB genérico não teria consumidor real | y |
| Anexo real (`fat_artefato`) | Adiado; P1 usa só `aceite_em` (checkbox "li e concordo") | Decisão explícita de Pedro | y |
| Conteúdo vazio dos campos | Bloquear com aviso, nunca inventar campo livre | Decisão explícita de Pedro | y |
| Inscrição PLL (`inscricao_mentorado`/`inscricao_mentor`) | Fora de escopo desta feature | Decisão explícita de Pedro | y |
| Visibilidade da aba Formulários | Filtrada por papel (Gestora/Admin veem os 16; Mentor/Assessor só o que é seu) | Decisão explícita de Pedro | y |
| Reenvio de formulário de envio único (`permite_edicao_aberta=false`) já respondido | Respondente comum: somente leitura. Gestora/Admin: ação própria para reabrir | Decisão explícita de Pedro (diferente do default proposto) | y |
| `vw_gip_evolucao` entra junto da derivação do GIP | Sim — incluída | Consequência direta de incluir `fat_gip_dimensao`; sem a view, o dado gravado não tem superfície de leitura. Não foi uma pergunta separada — se Pedro discordar ao revisar este spec, é corte trivial | n — assumido, sinalizado para revisão |
| Mapeamento `ref_formulario.respondente` → papel real | `gestora`→Gestora/Admin; `assessor`→Assessor; `mentor`→Mentor; `mentorado`(PLL)→Assessor; `cargo_cg_parlamentar` e `mandato`→Gestora/Admin como procurador (não há papel de login para eles) | Só 4 papéis existem em `dim_usuario`/`rel_usuario_contrato` (AD-018); precedente de `fat_registro`, que trava autoria em quem está de fato autenticado | n — assumido, documentado em `context.md` |
| Contrato encerrado (`fat_contrato.status <> 'ativo'`) | Impede abrir formulário novo e nova submissão; mantém leitura do que já existe | Mesmo padrão já usado no Kanban (`kanban-etapas`) para contrato encerrado | n — assumido |
| Faixa de valor de `fat_resposta_metrica.valor_num` (escala_0_10/escala_1_5) | Sem `CHECK` de faixa no banco (schema aprovado não declara um) — validação só no Zod do client e na extração de tipo (cast) | AD-008 — schema aprovado não é redesenhado; a ausência de `CHECK` é uma característica do schema aprovado, não um gap introduzido por esta feature | n — assumido, registrado como observação, não bloqueia |
| Ordem entre GIP início/meio/fim | Não é imposta pela UI/banco (nenhuma constraint de sequência no schema aprovado) | Impor ordem seria inventar regra de negócio não aprovada | n — assumido |

**Open questions:** nenhuma — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Abrir/fechar e responder um formulário genérico ⭐ MVP

**User Story**: Como Gestora, quero abrir um formulário para o contrato e permitir que o
respondente correto o preencha diretamente no sistema, para substituir o preenchimento por
planilha por uma página nativa, com autoria e histórico reais.

**Why P1**: É o mecanismo central que sustenta os outros 15 formulários (exceto GIP, que tem tela
própria) e a promessa central do OPR-02 — sem ele nenhum formulário é "página respondível".

**Acceptance Criteria**:

1. WHEN Gestora ou Admin vinculado ao contrato aciona "abrir" num formulário da aba Formulários
   THEN sistema SHALL gravar `rel_formulario_contrato.estado = 'aberto'`, `dt_abertura = now()`,
   `id_usuario_abriu = app.id_usuario()`.
2. WHEN Gestora ou Admin aciona "fechar" num formulário aberto THEN sistema SHALL gravar
   `estado = 'fechado'` e `dt_fechamento = now()`.
3. WHEN Mentor ou Assessor tenta abrir/fechar um formulário THEN sistema SHALL negar a escrita via
   RLS (nenhum GRANT de UPDATE em `rel_formulario_contrato` fora de Gestora/Admin).
4. WHEN um respondente autorizado (papel correspondente a `ref_formulario.respondente`, mapeado
   conforme `context.md`) acessa a página de um formulário com `estado='aberto'` e existe ao menos
   1 linha `ativo=true` em `ref_metrica_formulario` para aquele `id_formulario` THEN sistema SHALL
   renderizar 1 campo por métrica ativa (rótulo, tipo, agrupador), via RHF+Zod.
5. WHEN o formulário não tem nenhuma linha `ativo=true` em `ref_metrica_formulario` THEN sistema
   SHALL mostrar "este formulário ainda não tem campos configurados" e SHALL NOT permitir envio.
6. WHEN o respondente envia o formulário pela 1ª vez THEN sistema SHALL inserir 1 linha em
   `fat_submissao` (`id_contrato`, `id_formulario`, `versao_formulario` = `ref_formulario.versao`
   vigente, `id_usuario_respondente = app.id_usuario()`, `respostas` JSONB com 1 chave por
   `codigo_campo`, `enviada_em = now()`).
7. WHEN `ref_formulario.exige_anexo = true` THEN o envio SHALL exigir marcar um aceite ("li e
   concordo") antes de habilitar o botão de envio, gravando `aceite_em = now()` na mesma linha.
8. WHEN a submissão é gravada (INSERT ou UPDATE de `respostas`) THEN o trigger de extração SHALL
   repovoar `fat_resposta_metrica` a partir de `ref_metrica_formulario`, mesmo quando quem grava
   (Mentor/Assessor) não tem `GRANT` direto naquela tabela (ver Design — `SECURITY DEFINER`).
9. WHEN o formulário está com `estado='fechado'` THEN o respondente SHALL NOT conseguir acessar a
   página de resposta (mensagem/redirecionamento, sem opção de envio).
10. WHEN `ref_formulario.permite_edicao_aberta=true` e já existe submissão do mesmo respondente
    THEN reenviar SHALL atualizar a mesma linha (chave única `id_contrato, id_formulario,
    id_usuario_respondente, COALESCE(momento,'unico')`), nunca criar uma 2ª linha.
11. WHEN `ref_formulario.permite_edicao_aberta=false` e já existe submissão do respondente THEN a
    tela SHALL ficar somente leitura para o respondente comum ("resposta já enviada"); Gestora/Admin
    SHALL ver uma ação própria para reabrir a edição.
12. WHEN o usuário autenticado tenta gravar `fat_submissao.id_usuario_respondente` diferente do
    próprio `app.id_usuario()` THEN sistema SHALL negar via RLS `WITH CHECK` (nunca autoria
    falsificada, AD-006).
13. WHEN `fat_contrato.status <> 'ativo'` THEN sistema SHALL impedir abrir formulário novo e nova
    submissão, mantendo leitura do que já existe.
14. WHEN Gestora/Admin abre a aba Formulários THEN sistema SHALL listar os 16 formulários do
    produto do contrato com estado e status de resposta; Mentor/Assessor SHALL ver só os
    formulários endereçados ao papel dele que estão abertos, ou que ele já respondeu.

**Independent Test**: Como Gestora, abrir "Avaliação da Imersão" para um contrato de teste; logar
como Assessor vinculado, responder a pergunta de NPS (única cadastrada hoje), confirmar que a linha
aparece em `fat_submissao` e o valor em `fat_resposta_metrica`; fechar o formulário como Gestora e
confirmar que o Assessor não consegue mais acessar a página de resposta.

---

### P2: GIP — tela sob medida com derivação estruturada

**User Story**: Como Gestora, quero aplicar o GIP (Início/Meio/Fim) e ver a régua dos sonhos
comparada a onde chegamos, para acompanhar a maturidade de gestão do gabinete ao longo do contrato.

**Why P2**: Depende de `fat_submissao` (P1) existir; sem a derivação estruturada, o GIP ficaria só
como JSONB genérico sem nenhum consumidor (quadrante, evolução) — decisão explícita de Pedro para
incluir nesta feature.

**Acceptance Criteria**:

1. WHEN Gestora aplica o GIP pela 1ª vez num contrato (momento='inicio') THEN sistema SHALL gravar
   1 linha em `fat_submissao` (`id_formulario`=gip) e derivar 1 linha em `fat_gip` (mesmo
   `momento`) + 4 linhas em `fat_gip_dimensao` (uma por `ref_dimensao_gip` ativa) com
   `eixo='regua_sonhos'`.
2. WHEN Gestora aplica o GIP nos momentos 'meio' ou 'fim' THEN sistema SHALL derivar
   `fat_gip_dimensao` com `eixo='onde_chegamos'` para as 4 dimensões.
3. WHEN Gestora tenta aplicar o mesmo `momento` uma 2ª vez no mesmo contrato THEN sistema SHALL
   impedir uma 2ª linha (`uq_gip_contrato_momento`), permitindo apenas reeditar a existente quando
   `permite_edicao_aberta` do formulário GIP permitir.
4. WHEN um valor de dimensão fora da faixa (`ref_dimensao_gip.valor_min`/`valor_max`, hoje 1–4) é
   submetido THEN sistema SHALL rejeitar via `app.trg_valida_gip_dimensao` (trigger já aprovado,
   reaproveitado, não reescrito).
5. WHEN os 2 eixos de uma dimensão existem para o mesmo contrato THEN `vw_gip_evolucao` SHALL
   expor `regua_sonhos`, `onde_chegamos` e o `gap` calculado por dimensão.

**Independent Test**: Aplicar GIP Início num contrato de teste, conferir as 4 linhas de
`fat_gip_dimensao` com `eixo='regua_sonhos'`; aplicar GIP Meio, conferir as 4 linhas com
`eixo='onde_chegamos'`; consultar `vw_gip_evolucao` e confirmar o `gap` calculado por dimensão.

---

### P3: NPS agregado sobre `fat_resposta_metrica`

**User Story**: Como Gestora/Admin, quero ver o NPS agregado por formulário de avaliação e por
projeto, para saber a percepção real sem depender de planilha calculada.

**Achado de Tasks (correção de precisão, não muda escopo)**: o schema aprovado
(`docs/schema_sistema.sql:2103-2104`) revoga explicitamente `SELECT` em `mv_avaliacao_nps` de
`legisla_mentor` **e** `legisla_assessor` — só Gestora/Admin enxergam o NPS agregado. A versão
anterior desta história dizia "Gestora/Mentor"; corrigido para "Gestora/Admin", conforme AD-008
(schema aprovado não é redesenhado).

**Why P3**: Depende de `fat_resposta_metrica` (P1) acumular dado real; é a entrega final do OUT-07
mencionado no levantamento, mas não bloqueia o mecanismo central de responder formulários.

**Acceptance Criteria**:

1. WHEN existe ao menos 1 resposta de NPS (`ref_metrica_formulario.eh_nps=true`) em
   `fat_resposta_metrica` para um formulário THEN `mv_avaliacao_nps`, após refresh, SHALL agregar
   promotores/neutros/detratores e o score NPS por formulário × projeto.
2. WHEN Gestora/Admin abre a tela de avaliações THEN sistema SHALL oferecer uma ação para
   atualizar a materialized view (`REFRESH MATERIALIZED VIEW CONCURRENTLY`, via RPC) antes de
   exibir os números — sem `pg_cron`, o refresh é sob demanda.
3. WHEN Mentor ou Assessor tenta ler `mv_avaliacao_nps` (direto ou via RPC de refresh) THEN sistema
   SHALL negar — nem `GRANT` nem `RLS` os autoriza (materialized view não tem RLS; controle é só
   por `GRANT`, mesmo padrão de `mv_iip_contrato`).

**Independent Test**: Com pelo menos 2 submissões de NPS em formulários diferentes já em
`fat_resposta_metrica`, acionar o refresh e confirmar que `mv_avaliacao_nps` mostra o score correto
por formulário × projeto.

---

## Edge Cases

Cobertura das dimensões de requisito implícito (Complex tier — cada uma resolve para um requisito
ou N/A justificado):

- **Input validation & bounds**: escala_0_10/escala_1_5 validadas no Zod do client; sem `CHECK` de
  faixa em `fat_resposta_metrica` no banco (característica do schema aprovado, AD-008, não um gap
  introduzido aqui — ver Assumptions). GIP tem validação de faixa no banco via trigger existente
  (`app.trg_valida_gip_dimensao`).
- **Failure / partial-failure states**: envio é 1 INSERT/UPDATE atômico do JSONB inteiro — não há
  estado de submissão parcial gravável a meio caminho (o client valida tudo via Zod antes de
  habilitar o envio). WHEN a rede falha no meio do envio THEN nenhuma linha é gravada e a UI SHALL
  preservar o que foi digitado localmente para novo envio.
- **Idempotency / retry / duplicate handling**: reenvio do mesmo respondente vira `UPDATE` na mesma
  linha via chave única (P1 AC10) — nunca duplicata.
- **Auth boundaries & rate limits**: RLS restringe por vínculo de contrato + autoria própria (P1
  AC3/AC12). Sem rate limit específico — mesmo padrão de todas as demais tabelas fato do projeto,
  que não têm throttle por não serem superfície de convite/token público.
- **Concurrency / ordering**: WHEN a Gestora fecha o formulário enquanto o respondente está com a
  página aberta preenchendo THEN o envio subsequente SHALL falhar por RLS (formulário fechado) e a
  UI SHALL mostrar mensagem clara sem descartar o que foi digitado. Envios simultâneos de
  respondentes diferentes para o mesmo formulário não colidem (chave única inclui
  `id_usuario_respondente`).
- **Data lifecycle / expiry**: sem expiração de submissão — N/A, nenhuma regra do domínio pede TTL
  aqui.
- **Observability**: `fat_submissao`/`fat_gip`/`fat_gip_dimensao` entram na auditoria padrão
  (`log_auditoria`, mesmo trigger genérico já usado nas demais tabelas fato, AD-006).
- **External-dependency failure**: N/A — nenhuma chamada a serviço externo nesta feature.
- **State-transition integrity**: `rel_formulario_contrato.estado` só assume 'aberto'/'fechado' (já
  garantido por `CHECK` existente); ordem entre GIP início/meio/fim não é imposta (ver
  Assumptions — nenhuma constraint de sequência no schema aprovado, impor seria inventar regra).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| FRM-01 | P1: Abrir formulário | Design | Pending |
| FRM-02 | P1: Fechar formulário | Design | Pending |
| FRM-03 | P1: Mentor/Assessor não abre/fecha (RLS) | Design | Pending |
| FRM-04 | P1: Renderização dinâmica de campos ativos | Design | Pending |
| FRM-05 | P1: Aviso de formulário sem campos configurados | Design | Pending |
| FRM-06 | P1: Envio grava `fat_submissao` (1º envio) | Design | Pending |
| FRM-07 | P1: Aceite (`aceite_em`) quando `exige_anexo` | Design | Pending |
| FRM-08 | P1: Trigger de extração popula `fat_resposta_metrica` (`SECURITY DEFINER`) | Design | Pending |
| FRM-09 | P1: Formulário fechado bloqueia acesso à resposta | Design | Pending |
| FRM-10 | P1: Reenvio com `permite_edicao_aberta=true` atualiza mesma linha | Design | Pending |
| FRM-11 | P1: Reenvio com `permite_edicao_aberta=false` bloqueado + reabertura por Gestora/Admin | Design | Pending |
| FRM-12 | P1: RLS impede autoria falsificada | Design | Pending |
| FRM-13 | P1: Contrato encerrado bloqueia nova abertura/submissão | Design | Pending |
| FRM-14 | P1: Aba Formulários filtra visibilidade por papel | Design | Pending |
| FRM-15 | P2: GIP início grava `fat_gip` + `fat_gip_dimensao` (regua_sonhos) | Design | Pending |
| FRM-16 | P2: GIP meio/fim grava `fat_gip_dimensao` (onde_chegamos) | Design | Pending |
| FRM-17 | P2: GIP impede reaplicar o mesmo momento | Design | Pending |
| FRM-18 | P2: GIP valida faixa por dimensão (trigger existente) | Design | Pending |
| FRM-19 | P2: `vw_gip_evolucao` expõe os 2 eixos + gap | Design | Pending |
| FRM-20 | P3: `mv_avaliacao_nps` agrega NPS por formulário × projeto | Design | Pending |
| FRM-21 | P3: Refresh sob demanda da `mv_avaliacao_nps` | Design | Pending |
| FRM-22 | Auditoria (`log_auditoria`) em `fat_submissao`/`fat_gip` | Design | Pending |
| FRM-23 | P3: Mentor/Assessor negados em `mv_avaliacao_nps` (leitura e refresh) | Design | Pending |

**ID format:** `FRM-NN`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 23 total, 0 mapped to tasks yet, 23 unmapped ⚠️ (mapeamento acontece em Tasks)

---

## Success Criteria

- [ ] Gestora consegue abrir e fechar qualquer um dos 16 formulários de um contrato pela UI, sem
      SQL direto.
- [ ] Um Assessor/Mentor de teste consegue responder um formulário aberto endereçado a ele e ver a
      resposta refletida em `fat_resposta_metrica` sem erro de permissão.
- [ ] GIP Início/Meio/Fim aplicados num contrato de teste produzem `vw_gip_evolucao` com os 2 eixos
      e o gap corretos.
- [ ] `mv_avaliacao_nps` mostra o score correto após pelo menos 2 submissões de NPS reais.
- [ ] Nenhuma tabela nova sem RLS (AD-001) nem sem GRANT explícito (AD-025 — checar `legisla_app`/
      `legisla_admin`/`legisla_gestora` nas tabelas novas, não só confiar no `GRANT ... ALL TABLES`
      antigo).
