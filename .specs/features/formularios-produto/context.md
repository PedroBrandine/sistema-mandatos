# Formulários dos Produtos — Context

**Gathered:** 2026-08-13
**Spec:** `.specs/features/formularios-produto/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Provisionar o mecanismo de formulário nativo do sistema (§2.5, OPR-02): Gestora/Admin abrem e
fecham um formulário por contrato (`rel_formulario_contrato.estado`, já existente); o respondente
autorizado preenche uma página dinâmica gerada a partir de `ref_metrica_formulario` e grava em
`fat_submissao` (JSONB versionado), com um trigger de extração que popula `fat_resposta_metrica`
para agregação (NPS incluso). O formulário GIP, por ter forma fixa e conhecida no schema aprovado,
ganha tela e derivação próprias para `fat_gip`/`fat_gip_dimensao`. Não recria `ref_formulario`,
`ref_metrica_formulario` nem `rel_formulario_contrato` — já provisionadas e seedadas por features
anteriores.

---

## Implementation Decisions

### Escopo do GIP

- Esta feature **inclui** a derivação estruturada do GIP: provisiona `fat_gip`/`fat_gip_dimensao`
  (schema_sistema.sql:983-1025, seção 7/Planejamento no documento aprovado, mas nunca provisionadas
  — rotuladas PLN-03 em `jornadas-de-usuario-v2.md`) e escreve o trigger de derivação a partir de
  `fat_submissao`. Decisão de Pedro: "Incluir aqui" — sem isso, capturar o GIP como JSONB genérico
  não teria nenhum consumidor real (nem quadrante, nem evolução início→meio→fim).
- GIP ganha **tela sob medida**, não o motor genérico dirigido por metadado: os campos são fixos e
  já conhecidos no schema aprovado (posição de liderança, 3 campos de texto livre, 2 booleanos, +
  4 dimensões de `ref_dimensao_gip` em 2 eixos). Mesmo padrão de exceção já usado no Kanban
  (`app.mover_etapa_kanban` — processo de negócio fixo, não motor genérico). A chave JSONB de
  `fat_submissao.respostas` para o GIP é documentada no `design.md`, não inferida de
  `ref_metrica_formulario` (que continua vazio para este formulário).
- `eixo` do `fat_gip_dimensao` é derivado do `momento`: `momento='inicio'` grava as 4 dimensões com
  `eixo='regua_sonhos'`; `momento IN ('meio','fim')` grava com `eixo='onde_chegamos'` — leitura do
  comentário D6 do schema aprovado ("a régua é a aspiração pactuada... só faz sentido lida contra
  onde_chegamos"), não uma decisão nova desta feature.
- Consequência assumida (não uma pergunta separada a Pedro, mas registrada para review): já que a
  derivação de `fat_gip_dimensao` entra nesta feature, a view de leitura `vw_gip_evolucao`
  (schema_sistema.sql:1359-1370, compara os dois eixos) também entra — sem ela, os dados gravados
  não teriam nenhuma superfície de consulta. Se Pedro discordar ao revisar o `spec.md`, é um corte
  de escopo trivial (a tabela continua útil sem a view).

### Anexo (fat_artefato) — adiado

- `fat_artefato` **não é provisionada** nesta feature. Os 2 formulários com `exige_anexo=true`
  (Termo de Compromisso, Código de Conduta) usam, em P1, só o mecanismo de aceite que já existe em
  `fat_submissao.aceite_em` (timestamptz) — um checkbox "li e concordo" que grava esse campo junto
  do envio. Upload de arquivo de verdade fica para uma fatia futura, quando `fat_artefato` for
  provisionada (por esta ou outra necessidade).

### Conteúdo dos campos — mecanismo primeiro

- `ref_metrica_formulario`/`ref_formulario.schema_campos` estão quase vazios hoje (só a pergunta de
  NPS existe, em 7 dos 16 formulários) — mesma categoria de débito já aceita na CAT-16
  (`ref_agenda_tematica`/`ref_indicador`/`ref_tipologia`, seed vazia de propósito).
- Quando um formulário não tem nenhuma métrica ativa cadastrada, a tela **bloqueia com aviso**
  ("este formulário ainda não tem campos configurados") em vez de inventar um campo de texto livre
  — evita gravar submissão vazia só para não travar a tela, e deixa claro que é lacuna de conteúdo,
  não de sistema.
- Não é responsabilidade desta feature levantar o conteúdo real dos 16 formulários — isso é
  trabalho humano futuro (mesmo padrão da CAT-16), fora do que qualquer agente pode produzir sem a
  planilha/Forms originais.

### Inscrição PLL — fora de escopo

- `inscricao_mentorado`/`inscricao_mentor` (PLL, etapa Pontapé) **não entram** na página respondível
  desta feature. A Constituição (§2.2) já documenta que essa inscrição "é importada manualmente e
  vinculada ao mandato manualmente (sem conexão automática na v1)" — ela acontece antes de existir
  `fat_contrato`/vínculo no sistema, o que `fat_submissao` (exige `id_contrato NOT NULL`) não
  representa. Processo de inscrição continua como está hoje, fora do sistema.

### Visibilidade da lista de formulários

- Na aba "Formulários" da ficha do contrato: Gestora/Admin veem os 16 formulários do produto do
  contrato, com estado (aberto/fechado) e controle para alternar. Mentor/Assessor veem só os
  formulários cujo `respondente` corresponde ao papel dele **que já estão abertos**, ou que ele já
  respondeu (não veem os 16 completos nem os fechados que não são deles).
- Mapeamento `ref_formulario.respondente` → quem responde de fato (documentado no `design.md`, não
  uma tabela de referência nova — são só 6 valores fixos do `CHECK` já aprovado):
  - `'gestora'` → papel Gestora/Admin.
  - `'assessor'` → papel Assessor.
  - `'mentor'` → papel Mentor.
  - `'mentorado'` (PLL) → também papel Assessor — é o nome que o programa PLL dá ao mesmo papel de
    acesso (o "assessor mentorado"), não um papel de login novo.
  - `'cargo_cg_parlamentar'` e `'mandato'` → **não correspondem a nenhum papel logável hoje** (nem
    via convite, AD-033, que só cria `mentor`/`assessor`). Caem na lista da Gestora/Admin, que
    preenche por procuração (reunião presencial, depois digitada no sistema) — mesmo raciocínio já
    usado em `fat_registro` (RLS trava a autoria em quem está de fato autenticado, nunca em quem
    "deveria" ter respondido).

### Reenvio de formulário de envio único

- Quando `ref_formulario.permite_edicao_aberta = false` (ex.: Termo de Compromisso) e já existe uma
  submissão: o respondente comum não pode editar (tela somente leitura, aviso "resposta já
  enviada"). Gestora/Admin ganham uma ação visível só para eles que permite uma nova edição pontual
  (corrigir um envio errado sem precisar ir direto no banco) — decisão de Pedro, diferente do
  default proposto (bloqueio sem exceção).

### Agent's Discretion

- Layout exato da lista de formulários (tabela vs. cards) e da página de resposta genérica —
  reaproveitar os padrões já em uso (`Table`, `Card`, `<CarregandoSkeleton>`/`<ErroInline>`/
  `<EstadoVazio>`, AD-029) em vez de inventar um novo.
- Rota exata da página de resposta (`/contratos/[id]/formularios/[codigo]` ou equivalente) — decidir
  em Design, sem contradizer as decisões acima.
- Nome exato da chave JSONB usada pelo GIP em `fat_submissao.respostas` — documentar em Design,
  desde que a derivação para `fat_gip`/`fat_gip_dimensao` saia determinística e testável.

### Declined / Undiscussed Gray Areas → Assumptions

- **Contrato encerrado**: nenhuma pergunta feita sobre isso a Pedro. Assumido, mesmo padrão já usado
  no Kanban (contrato encerrado continua visível, mas sem nova escrita): `fat_contrato.status <>
  'ativo'` impede abrir/fechar formulário novo e impede nova submissão, mas mantém leitura do que já
  foi enviado. Registrado como assumption no `spec.md`.
- **Versionamento de formulário**: sem UI de administração de catálogo neste momento (mesma
  fronteira já traçada pela Trilha C — `/admin/catalogos` fora de escopo), `fat_submissao.
  versao_formulario` grava sempre `ref_formulario.versao` vigente no momento do envio; não há
  mecanismo para a Gestora bumpar a versão nesta feature. Registrado como assumption.

---

## Specific References

Nenhuma referência visual específica trazida por Pedro — reaproveitar os padrões visuais já
estabelecidos no projeto (Kanban, Planilha de Monitoramento, régua de etapas).

---

## Deferred Ideas

- Upload real de anexo (`fat_artefato`) para Termo de Compromisso/Código de Conduta — fica para
  quando `fat_artefato` for provisionada.
- Levantamento humano do conteúdo real (perguntas, tipos, agrupadores) dos 16 formulários — mesma
  categoria de trabalho da CAT-16, fora do que esta feature resolve.
- Fluxo de inscrição do mentorado/mentor do PLL dentro do sistema (hoje importação manual) — feature
  própria futura, se algum dia sair do "sem conexão automática na v1".
- `/admin/catalogos` (edição de `ref_metrica_formulario`/`ref_formulario.schema_campos` por UI) —
  mesma fronteira já registrada no roadmap (Trilha C), continua fora de escopo aqui.
