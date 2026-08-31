# Saída — Números de Impacto, Visão do Mandato e Evolução do GIP Specification

## Problem Statement

Hoje "Números de Impacto" (nº de contratos por contratante, ano da 1ª contratação, ordem do
contrato) é calculado à mão em planilha e diverge do real (o comentário do próprio schema
aprovado registra 46 e 41 contratantes divergentes nos dois números mais simples). A "Visão do
Mandato" — a linha do tempo de contratos de um contratante, clicável a partir de Números de
Impacto — não existe como tela. E a evolução do GIP (Régua dos Sonhos × Onde Chegamos por
dimensão) já foi capturada pela feature `formularios-produto`, mas nunca ganhou uma tela — hoje é
um placeholder explícito dentro de `ContextoEstrategico`
(`src/frontend/components/planejamento/contexto-estrategico.tsx:89-99`, comentário citando esta
lacuna por nome). As três entregas são a camada Saída da Constituição §2.6 ("Números de impacto"
e "Visão do mandato") e §2.3 (GIP) — a primeira fatia de Saída deste projeto além de Visão
Gerencial (G1-G6, já concluída).

## Goals

- [ ] `mv_numeros_impacto` provisionada verbatim (AD-008) e com dado real substituindo a planilha
      manual — nº de contratos por contratante, ano da 1ª contratação e ordem do contrato deixam
      de divergir entre pessoas.
- [ ] `vw_visao_mandato` provisionada verbatim e consumida por uma tela real, navegável a partir
      de Números de Impacto (clique num contratante → timeline consolidada).
- [ ] Placeholder de GIP em `ContextoEstrategico` substituído por leitura real de
      `vw_gip_evolucao` (já provisionada por `formularios-produto`, T9) — fecha um débito
      explícito deixado por `planejamento-estrategico-redesenho`.

## Out of Scope

Explicitamente excluído. Documentado para prevenir scope creep.

| Item | Motivo |
| --- | --- |
| `fat_snapshot_mensal` / job de fechamento mensal (AD-015) | Fatia própria da Saída (roadmap §7), sem relação de dependência com esta — nenhuma das 3 entregas aqui precisa de snapshot mensal (nenhuma é indicador "fotografado", ver Constituição §2.6). |
| Exportação (OUT-04, Google Sheets/CSV) | Fatia própria de Saída, sem overlap de tabela/view com esta. |
| Visão Gerencial G1-G6 | Já entregue (`visao-gerencial-g1-g2`, `visao-gerencial-g3-g6`, ambas CONCLUÍDAS). Esta feature não toca `/visao-gerencial`. |
| CRUD de `ref_dimensao_gip`/`ref_produto`/`ref_projeto`/`ref_cargo`/`ref_partido` | Já resolvido por `catalogos-referencia`; esta feature só lê. |
| Qualquer escrita em `fat_contrato`/`dim_contratante`/`fat_gip`/`fat_gip_dimensao` | AD-015 — a Saída só lê e agrega. Nenhuma tela desta feature tem botão de editar. |
| Redesenhar qualquer uma das 3 views/MV | AD-008 — schema aprovado, extração verbatim. Mudança de coluna/JOIN exigiria migração incremental com justificativa própria, fora do que esta feature está autorizada a fazer. |
| GIP/IIP funcional em qualquer lugar além do placeholder já identificado | O placeholder de GIP existe hoje só em `ContextoEstrategico` (PLR-06). Não introduzir uma 2ª superfície de GIP nem tocar o placeholder de IIP (que é de `incidencia-encontros`, já resolvido em outra tela). |

---

## Assumptions & Open Questions

Toda ambiguidade é resolvida ou registrada aqui — nada fica silenciosamente indefinido. Os itens
marcados "Confirmado? n" abaixo são exatamente os pontos que vão para a fase **Discuss**
(`AskUserQuestion` com Pedro) antes de fechar esta spec — nenhum é decidido sozinho pelo agente
por serem decisões de segurança/arquitetura (AD-030) ou de produto (rota/navegação).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| `mv_numeros_impacto` é GRANT-only (exceção ao AD-001) | **Nova entrada AD-036** (não estender AD-030 por analogia) — GRANT-only por escopo deliberadamente organizacional (leitura para áreas clientes, não carteira pessoal), classe distinta de AD-030 (catálogo sem coluna de carteira pra filtrar) | Decisão de Pedro (Discuss Q1). AD-030 documentaria a razão errada para este caso — a MV TEM `id_contrato`/`id_contratante`, a exceção não é "não há o que filtrar". Registrar como AD-036 evita que uma leitura futura do STATE.md confunda as duas justificativas. AD-036 é escrita em Design, antes de qualquer migration. | **y** |
| Refresh de `mv_numeros_impacto` (nasce `WITH NO DATA`) | Síncrono ao abrir a tela, via função chamada pela query (mesmo padrão de `mv_iip_contrato`/`incidencia-encontros` e `mv_avaliacao_nps`/`formularios-produto`) — REFRESH inicial não-concorrente na própria migration, depois `REFRESH CONCURRENTLY` sob demanda | Decisão de Pedro (Discuss Q2). `pg_cron` não está provisionado no projeto (mesma lacuna documentada em `app.recalcula_pendentes`); replicar um padrão já usado 2x é menor risco que introduzir um 3º padrão. | **y** |
| Rota/entrada de navegação de Números de Impacto | Tile novo no Hub (`(app)/page.tsx`), rota própria `/numeros-impacto` (kebab-case, sem acento — mesmo padrão de `/visao-gerencial`, `/mandatos`, `/contratos`) | Decisão de Pedro (Discuss Q3). Números de Impacto atravessa produtos — não pertence a nenhum `/produtos/[slug]`; o Hub já tem precedente de tile transversal (`/visao-gerencial`). | **y** |
| Papel autorizado a ler Números de Impacto/Visão do Mandato ("áreas clientes", Constituição §2.6) | Login como Gestora (AD-018/AD-026 já mapeiam "Interno Legisla" para Gestora) é suficiente — sem papel de RBAC novo | Decisão de Pedro (Discuss Q4). Constituição §3 (linha 190) já agrupa "Interno Legisla (Gestora, Admin, áreas clientes)" sob o mesmo método de autenticação. | **y** |
| `vw_visao_mandato` precisa do mesmo tratamento GRANT-only que `mv_numeros_impacto`? | Não — ela é `security_invoker = true` (ao contrário da MV), então herda a RLS de `fat_contrato`/`dim_contratante` por baixo; não precisa de exceção nova ao AD-001 | O comentário "uso exclusivo de usuários Legisla" (schema:1304) é uma decisão de produto, não uma lacuna de RLS a preencher artificialmente — quem já pode ler `fat_contrato` via RLS (Gestora/Mentor da própria carteira) automaticamente pode ler esta view | y — confirmado por leitura de código nesta sessão (mecânica técnica, não decisão de produto em aberto) |
| Onde a UI de Evolução do GIP entra | Substitui o placeholder existente em `ContextoEstrategico` (linhas 89-99), não uma seção nova | O placeholder já cita `vw_gip_evolucao`/FRM-15 a FRM-19 por nome (comentário de código); `design.md` de `planejamento-estrategico-redesenho` já reserva o espaço ("Seção GIP - placeholder", nó K do diagrama) | y — confirmado por leitura de `design.md`/código nesta sessão, sem ambiguidade de produto a discutir |
| Contrato sem nenhuma aplicação de GIP (`fat_gip` vazio para aquele `id_contrato`) | Mostra `<EstadoVazio>` no lugar da seção, não erro nem tabela vazia | Consistente com o padrão já usado no resto do projeto (`<EstadoVazio>`, AD-029) e com AD-005 (ausência é `NULL`/vazio, nunca sentinela) | y |
| `mv_numeros_impacto`/`vw_visao_mandato` filtram contrato por `status`? | Não — todo contrato entra (schema aprovado, comentário da própria MV: "sem filtro de status desde D4: todo contrato é contrato assinado") | Verbatim do schema aprovado (AD-008); a decisão "D4" já foi tomada em algum momento anterior do desenho aprovado, não é desta feature reabrir | y |

**Open questions:** nenhuma. Os 4 itens de segurança/produto (GRANT-only → AD-036, refresh
síncrono, rota `/numeros-impacto`, acesso via papel Gestora) foram confirmados por Pedro via
`AskUserQuestion` nesta sessão (Discuss); os demais já estavam resolvidos por leitura de
código/schema.

---

## User Stories

### P1: Números de Impacto ⭐ MVP

**User Story**: Como pessoa de área cliente (ou Gestora/Admin internos), quero consultar os
números de impacto agregados por contratante numa única tela, para não depender mais de planilha
calculada à mão e sem divergência entre quem calcula.

**Why P1**: É a entrega mais citada pela Constituição §2.6 ("Números de impacto") e a que resolve
a divergência de dado já documentada (46/41 contratantes divergentes). Sem ela, nada mais desta
feature tem onde entrar (Visão do Mandato depende de poder clicar a partir daqui).

**Acceptance Criteria**:

1. WHEN uma Gestora/Admin abre a rota `/numeros-impacto` (novo tile do Hub) THEN o sistema SHALL
   listar, por contratante, ao menos: nome do contratante, produto, projeto, status do contrato,
   ano de início, `nr_contratos_contratante`, `dt_primeira_contratacao` e `ordem_contrato` — todos
   lidos de `mv_numeros_impacto`, nunca calculados na query nem no frontend.
2. WHEN a `mv_numeros_impacto` ainda não foi populada nesta sessão de banco (estado inicial pós-
   migração, `WITH NO DATA`) THEN o sistema SHALL rodar um refresh síncrono (função chamada pela
   query, mesmo padrão de `mv_iip_contrato`/`mv_avaliacao_nps`) antes de servir a consulta, nunca
   retornar erro de "relation is not scannable" para quem abre a tela pela primeira vez.
3. WHEN um contratante tem mais de um contrato THEN `nr_contratos_contratante` SHALL refletir a
   contagem real e `ordem_contrato` SHALL numerar cada contrato daquele contratante em ordem de
   `dt_inicio` (1, 2, 3, ...) — nunca um valor hardcoded ou reordenado no frontend.
4. WHEN um usuário sem o papel Gestora/Admin (Mentor, Assessor, ou não autenticado) tenta ler os
   dados desta tela THEN o sistema SHALL negar a leitura via GRANT de role (AD-036, GRANT-only —
   `mv_numeros_impacto` não tem RLS por linha) — nunca só esconder o link na UI.

**Independent Test**: Popular 2+ contratantes com contratos reais (via fixture ou dado de dev já
existente), abrir a tela como Gestora, conferir que `nr_contratos_contratante`/`ordem_contrato`
batem com uma contagem manual simples, e confirmar (via teste de integração/RLS) que um papel não
autorizado recebe zero linhas ou erro de permissão, nunca os dados.

---

### P2: Visão do Mandato

**User Story**: Como Gestora/Admin, quero clicar num contratante na tela de Números de Impacto e
ver a linha do tempo consolidada dos contratos dele, para entender a trajetória completa sem abrir
uma tela por contrato.

**Why P2**: É a 2ª entrega nomeada da Constituição §2.6 e depende diretamente de P1 existir (o
ponto de entrada é o clique num contratante já listado) — não é demonstrável isoladamente sem P1.

**Acceptance Criteria**:

1. WHEN uma Gestora/Admin clica num contratante na tela de Números de Impacto THEN o sistema
   SHALL abrir uma visão consolidada lendo `vw_visao_mandato` filtrada por `id_contratante`, com
   os contratos ordenados por `ordem_contrato`.
2. WHEN a visão consolidada é exibida THEN cada contrato da timeline SHALL mostrar ao menos:
   produto, projeto, cargo/partido no contrato, `dt_inicio`/`dt_fim`, status, e um indicador visual
   de qual é `id_contrato_anterior` quando existir (renovação/continuidade, não dois contratos
   desconexos).
3. WHEN um Mentor ou Assessor tenta acessar esta visão diretamente (URL, não pelo clique) THEN o
   sistema SHALL negar pelo mesmo mecanismo de RLS que já protege `fat_contrato`/`dim_contratante`
   (herdado via `security_invoker`, sem GRANT especial — ver Assumption confirmada acima), restrito
   à própria carteira quando o papel permitir alguma leitura, e vazio/negado quando não permitir
   nenhuma.

**Independent Test**: Com o mesmo contratante multi-contrato de P1, clicar nele e confirmar que a
timeline mostra todos os contratos na ordem certa; testar via integração que um usuário Mentor sem
vínculo naquele contratante recebe zero linhas (RLS), não um erro de aplicação.

---

### P3: Evolução do GIP

**User Story**: Como Gestora, quero ver a comparação Régua dos Sonhos × Onde Chegamos por
dimensão dentro do Planejamento Estratégico do contrato, para não depender mais do placeholder
"em desenvolvimento".

**Why P3**: Menor risco e menor esforço das três (a view já existe, migrada por
`formularios-produto`) — é puramente wiring de frontend, mas fecha um débito explícito deixado por
outra feature e por isso faz parte da Definição de Pronto desta trilha, não é opcional.

**Acceptance Criteria**:

1. WHEN a Gestora abre `ContextoEstrategico` de um contrato que já tem ao menos uma aplicação de
   GIP (`fat_gip` com linha para aquele `id_contrato`) THEN o sistema SHALL substituir o texto
   placeholder ("Em desenvolvimento...") por uma leitura real de `vw_gip_evolucao` filtrada por
   `id_contrato`, mostrando por dimensão: `regua_sonhos`, `onde_chegamos`, `gap` e `situacao`
   (`atingiu`/`proximo`/`distante`).
2. WHEN o contrato tem só a aplicação de `momento='inicio'` (Régua dos Sonhos pactuada, sem leitura
   posterior ainda) THEN `onde_chegamos`/`gap`/`situacao` SHALL aparecer como ausentes (`NULL`,
   nunca `0` ou traço genérico — AD-005), e a UI SHALL deixar claro que é a aspiração pactuada, não
   uma medição.
3. WHEN o contrato não tem nenhuma aplicação de GIP ainda (`fat_gip` vazio para aquele
   `id_contrato`) THEN o sistema SHALL mostrar `<EstadoVazio>` (AD-029) em vez do placeholder fixo
   atual ou de uma tabela vazia sem explicação.

**Independent Test**: Usando um contrato de dev com GIP já respondido (dado real de
`formularios-produto`, ou fixture equivalente) via momento `inicio` + `meio`, abrir o Planejamento
Estratégico daquele contrato e confirmar visualmente que a seção GIP mostra os dois eixos e o gap
calculado; repetir com um contrato sem GIP nenhum e confirmar o `<EstadoVazio>`.

---

## Edge Cases

- WHEN `mv_numeros_impacto` está sendo refrescada (síncrono) no exato momento em que duas abas
  abrem a tela ao mesmo tempo THEN o sistema SHALL não travar nem duplicar o refresh de forma que
  quebre a segunda requisição (mecanismo exato — lock, idempotência — fechado em Design).
- WHEN um contratante tem exatamente 1 contrato THEN `nr_contratos_contratante = 1` e
  `ordem_contrato = 1` SHALL aparecer normalmente (não é caso de erro, é o caso mais comum).
- WHEN dois contratos do mesmo contratante têm a mesma `dt_inicio` (empate) THEN `ROW_NUMBER()`
  do schema aprovado SHALL desempatar por alguma ordem determinística do Postgres (comportamento
  herdado verbatim da MV — não uma regra nova desta feature; documentar como conhecido, não
  redesenhar o `ORDER BY`).
- WHEN um contrato não tem `id_projeto`/`id_cargo_no_contrato`/`id_partido_no_contrato` (LEFT
  JOINs na MV/nas views) THEN os campos correspondentes SHALL aparecer como ausentes na UI
  (`NULL`, AD-005), nunca "N/A" nem string vazia.
- WHEN a Visão do Mandato é aberta para um contratante que é uma Coalizão (não um mandato
  individual) THEN a timeline SHALL funcionar igual (a view não distingue `tipo_contratante`) —
  confirmar que a UI não assume texto/ícone exclusivo de mandato individual.
- WHEN `fat_gip_dimensao` tem uma dimensão inativa (`ref_dimensao_gip.ativo = false`) THEN
  `vw_gip_evolucao` já filtra isso no `WHERE d.ativo` (verbatim do schema) — a UI SHALL apenas
  consumir o que a view retorna, sem lógica própria de filtro de dimensão ativa.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| SAI-01 | P1: Números de Impacto | Tasks (T1, T7, T11) | In Tasks |
| SAI-02 | P1: Números de Impacto | Tasks (T2, T6, T11) | In Tasks |
| SAI-03 | P1: Números de Impacto | Tasks (T1, T7, T11) | In Tasks |
| SAI-04 | P1: Números de Impacto | Tasks (T2, T10, T11) | In Tasks |
| SAI-05 | P2: Visão do Mandato | Tasks (T3, T8, T12) | In Tasks |
| SAI-06 | P2: Visão do Mandato | Tasks (T3, T8, T12) | In Tasks |
| SAI-07 | P2: Visão do Mandato | Tasks (T3, T12) | In Tasks |
| SAI-08 | P3: Evolução do GIP | Tasks (T4, T9, T13) | In Tasks |
| SAI-09 | P3: Evolução do GIP | Tasks (T9, T13) | In Tasks |
| SAI-10 | P3: Evolução do GIP | Tasks (T9, T13) | In Tasks |

**Mapeamento**: SAI-01 = P1.AC1, SAI-02 = P1.AC2 (refresh), SAI-03 = P1.AC3 (agregações
corretas), SAI-04 = P1.AC4 (acesso negado), SAI-05 = P2.AC1 (drill-down), SAI-06 = P2.AC2
(conteúdo da timeline), SAI-07 = P2.AC3 (RLS herdada), SAI-08 = P3.AC1 (leitura real), SAI-09 =
P3.AC2 (momento parcial/NULL), SAI-10 = P3.AC3 (EstadoVazio).

**ID format:** `SAI-NN` (Saída).

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 10 total, 10 mapeados a tasks (`.specs/features/saida-numeros-impacto/tasks.md`,
T1-T13), 0 unmapped ⚠️.

---

## Success Criteria

Como saberemos que a feature foi bem-sucedida:

- [ ] Uma pessoa de área cliente (via Gestora) consegue ver nº de contratos/ano de 1ª contratação/
      ordem do contrato de um contratante numa única tela, sem planilha manual, com os 3 números
      batendo com uma contagem manual de verificação.
- [ ] Clicar num contratante na tela de Números de Impacto abre a Visão do Mandato com a timeline
      completa dos contratos dele, sem tela extra nem reload de página inteiro.
- [ ] O placeholder "Em desenvolvimento" do GIP em `ContextoEstrategico` deixa de existir para
      contratos com GIP respondido — mostra dado real de `vw_gip_evolucao`.
- [ ] Nenhuma das 3 entregas introduz escrita nova na camada Saída (AD-015) nem redesenha as views/
      MV aprovadas (AD-008) — confirmável por `git diff` das migrations desta feature contra o
      texto de `docs/schema_sistema.sql`.
