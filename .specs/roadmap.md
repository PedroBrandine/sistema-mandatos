# Roadmap de Execução — Sistema Mandatos

Plano de trabalho sequenciado do que falta construir. Companheiro do `STATE.md` (decisões) e do
`overview.md` (arquitetura). **Este documento é vivo**: cada feature concluída atualiza o bloco
"Estado real" e risca a linha correspondente.

- **Reescrito em:** 2026-08-10, a partir de auditoria de código (não copiado da versão anterior)
- **Sem cronograma.** Este plano é ordenado por dependência de camada e por oportunidade de
  paralelização, não por dia/semana — capacidade e ritmo variam, dependência estrutural não.
- **Fonte de prioridade:** Definição de Pronto (Constituição §6) + ordem de dependência das camadas
  (§2, AD-007)

---

## 1. Estado real (verificado em 2026-08-10)

### 1.1 Infraestrutura — não existia como preocupação na versão anterior deste documento

O ciclo completo rodou verde ponta a ponta pela primeira vez em 10/08: `ci.yml` (91 testes
unitários + integração contra banco efêmero), `deploy-db.yml` (aplica em produção só com CI verde
no commit) e `drift-check.yml` (sem deriva em dev nem produção). Dois ambientes Supabase distintos,
30/30 migrations idênticas nos dois. Detalhes operacionais completos em `docs/ambientes.md` e
`docs/fluxo-de-trabalho.md` — não duplicar aqui.

**O que isso muda para o roadmap:** o gargalo deixou de ser "o deploy quebra" e voltou a ser
"quais camadas de produto faltam construir". Também expôs uma prática a manter: toda migration
nova precisa continuar passando pelo `drift-check` antes de ser considerada terminada.

### 1.2 Banco — 17 das 51 tabelas do modelo aprovado (sem mudança desde a versão anterior)

| Bloco | Provisionado | Falta |
| :---- | :---- | :---- |
| Catálogos `ref_*` | 4 — `ref_produto`, `ref_projeto`, `ref_cargo`, `ref_partido` | **12** — `ref_etapa`, `ref_tipo_registro`, `ref_formulario`, `ref_metrica_formulario`, `ref_preditor`, `ref_agenda_tematica`, `ref_perfil_atuacao`, `ref_pilar_insight`, `ref_indicador`, `ref_nivel_iip`, `ref_tipologia`, `ref_dimensao_gip` |
| Plataforma | 3/3 — `dim_usuario`, `rel_usuario_contrato`, `log_auditoria` | — |
| Fundação + Âncora | 5/5 — `dim_contratante`, `dim_mandato`, `dim_coalizao`, `fat_contrato`, `rel_coalizao_membro` | — |
| TSE | 4 tabelas + `rel_mandato_candidatura` + 2 MVs, já restrito ao Legislativo (migrations 0022/0026) | — |
| Operação | 0 | 8 tabelas |
| Planejamento | 0 | 7 tabelas |
| Incidência | 0 | 5 tabelas |
| Saída | 0 | 1 tabela + ~10 views/MVs |
| Staging | 0 | `stg.map_legado` |

**Leitura:** a Fundação continua de pé e **nada acima dela existe**. Os 12 catálogos faltantes
continuam sendo o primeiro gargalo estrutural — nenhuma tabela de Operação/Planejamento/Incidência
referencia um catálogo que ainda não existe.

### 1.3 Frontend

**Rotas em pé:** `/login` · `/mandatos` (lista, novo, detalhe) · `/mandatos/[id]/contratos/novo` ·
`/coalizoes` (lista, novo, detalhe) · `/usuarios` · `/contratos` (lista) · `/contratos/[id]/vinculos`
(+ `/admin/acesso` dev-only e `/auth/*`). Navegação (`sidebar.tsx`) só conhece estas 5 seções —
nenhum item de Operação/Planejamento/Incidência/Saída existe ainda, nem como placeholder.

**Primitivos shadcn instalados:** alert, badge, breadcrumbs, button, card, command, confirm-delete-dialog,
dialog, form, input, input-group, label, popover, select, table, textarea. Combobox (`command`+`popover`)
já está em uso real no wizard do TSE.

**Lacunas que continuam bloqueando o próximo trecho do roadmap:**

| Lacuna | Bloqueia | Custo de resolver agora |
| :---- | :---- | :---- |
| TanStack Query + TanStack Table (AD-021 ainda não cumprida em nenhuma tela) | grade de Sucessos Mensais (§5.7, risco nº 1 do projeto) | baixo — instalar e montar provider, sem refatorar telas existentes |
| toast/`sonner`, skeleton, tabs, tooltip, dropdown-menu, alert-dialog, checkbox, date-picker, progress | Kanban, formulários, planejamento, telas de gestão em geral | baixo, mecânico |
| Estados padronizados de loading / erro / vazio | toda feature nova ainda reinventa | baixo |

### 1.4 Features spec-driven — status real

| Feature | Fase no `spec.md` | Situação real verificada em código |
| :---- | :---- | :---- |
| `fundacao-entidades-pessoas` | Validate | ✅ Concluída — 20/26 Verified, 5 Needs-Fix conhecidos (ver §1.5) |
| `primeira-tela-cadastro` | Validate | ✅ Concluída e verificada |
| `login-senha-interno-legisla` | Validate | ✅ Concluída (7/7) |
| `cadastro-mandato-contrato-unificado` | **Specify** (todos os 16 requisitos "Design: Pending" no papel) | ⚠️ **Código implementa 14 dos 16** (CMU-01 a CMU-14: wizard único, reaproveitamento de mandato existente, combobox TSE, título travado, base restrita ao Legislativo). **CMU-15 (coalizão abre contrato próprio) e CMU-16 (fix do seletor de membro) não existem.** Nenhuma fase Design/Tasks/Validate foi documentada — o código foi implementado direto, sem o rastro que AD-016 exige |

**Isto é a descoberta mais importante desta auditoria:** o projeto tem uma feature funcionalmente
quase pronta que nunca fechou o ciclo Specify→Design→Tasks→Execute→Validate. Isso não é só
burocracia — sem Validate, ninguém confirmou formalmente que CMU-01..14 realmente cobrem os
Acceptance Criteria, e o débito (`FND-COL-03`) que a própria feature deveria corrigir continua
aberto. Ver Trilha A no §4.

### 1.5 Débito conhecido

| Item | Situação | Observação |
| :---- | :---- | :---- |
| `FND-USR-02` — Gestora criando Gestora/Admin, sem `WITH CHECK` de RLS | ✅ Corrigido em 2026-08-10 (`20260810181508_fix_with_check_p_usuario.sql`, aplicado em dev) — WITH CHECK explícito impede papel_global 'admin'/'gestora' fora de quem já é Admin | Era mais grave que o registrado: a ausência de WITH CHECK deixava Gestora criar até Admin, não só Gestora. Teste de regressão em `supabase/tests/plataforma/usuario-with-check.integration.test.ts` (4/4 verde) + suíte de RLS/sessão existente sem regressão (13/13 verde) |
| `FND-COL-03` / `CMU-16` — seletor de membro da coalizão lista qualquer `fat_contrato` | ❌ Aberto, auto-documentado no próprio código (`coalizoes/[id]/page.tsx`, comentário admitindo a lacuna) | Agora **ativamente alcançável**: falta só CMU-15 para o bug aparecer na prática |
| `FND-CTR-05` — snapshot de cargo/partido no contrato nunca populado | ❌ Aberto | Baixo impacto enquanto não há relatório que dependa do cargo histórico |
| `FND-TSE-01`/`FND-TSM-01` — filtro de cargo/método de match não exposto na UI de busca | Minoritário, já mitigado em parte pela restrição na origem (migrations 0022/0026) | Não bloqueia nada |
| Dropdowns (Cargo/Partido/Produto/Projeto) relatados como quebrados numa sessão anterior | Aparentam funcionar hoje (o wizard os popula via `supabase.from(...)` direto, sem erro visível no código) | **Confirmar num teste manual real antes de fechar** — não foi reproduzido nem descartado formalmente |
| Convite por contrato (acesso externo) | ❌ Nunca iniciado — nenhuma migration, nenhuma rota | Ver Trilha B |
| AD-021 (TanStack Query/Table) | ❌ Nunca instalada | Ver Trilha D |

---

## 2. Decisões pendentes que o plano depende

| # | Assunto | Situação |
| :---- | :---- | :---- |
| **AD-010** | Lista fechada de 4 exceções privilegiadas | O convite por contrato precisa de uma **5ª exceção** → exige AD novo explícito na fase Specify da Trilha B |
| **AD-022** | ✅ Resolvida — superseded por **AD-028** (2026-08-10): gate de protótipo validado com assessor real foi dispensado | A grade de Sucessos Mensais (§6.1) deixa de depender do convite (Trilha B) pra avançar |
| **D9** | ✅ Resolvida por Pedro em 2026-08-10: régua da Coalizão clona a da Estratégia | CAT-17 (`.specs/features/catalogos-referencia/`) segue para Design/Tasks como seed migration normal, sem bloqueio |
| **D2** | Aritmética final do IIP | Não bloqueia — o número entra rotulado como provisório na onda de Incidência |

---

## 3. Como este plano se organiza: camadas em série, features em paralelo

A ordem entre **camadas** não é negociável — é dependência estrutural (§2 da Constituição, AD-007):
uma camada só depende do que está abaixo dela ou é transversal a ela, nunca do que está acima.

```
Fundação (pronta) ──► 12 catálogos ──► Operação: régua + instanciação ──► Operação: Kanban (escrita)
                                                    │
                                                    ├──► Planejamento (hierarquia + grade mensal)
                                                    ├──► Incidência (registro/insight/fato + IIP)
                                                    └──► Operação: Formulários
                                                                    │
                                                                    ▼
                                                                 Saída (consolidação, em fatias)
```

Mas **dentro** desse esqueleto, várias features não competem por dependência nem por arquivo — são
candidatas reais a specs paralelas, times/sessões diferentes ou pelo menos backlog intercalável.
O §4 é exatamente isso: uma trilha de trabalho que pode começar **agora, toda de uma vez**, porque
nenhum item depende de outro. O §5 é a onda de Operação (sequencial, pré-requisito de tudo depois).
O §6 é a segunda leva de paralelismo, maior: Planejamento, Incidência e Formulários são três ramos
irmãos que só dependem da régua de Operação existir — não umas das outras.

---

## 4. Trilhas imediatas — podem rodar em paralelo, a partir de agora

Nenhuma destas quatro trilhas depende de outra. Tocam tabelas, RLS e rotas praticamente disjuntas.
Se houver mais de uma pessoa/sessão disponível, é aqui que a paralelização rende mais: quatro specs
pequenas e independentes em vez de uma fila.

### Trilha A — Fechar `cadastro-mandato-contrato-unificado`

O trabalho de código já é ~90% feito (§1.4). O que falta:

1. **CMU-15** — Coalizão abre seu próprio contrato: ação "Novo contrato" em `/coalizoes/[id]`,
   reaproveitando `ContratoForm` com `idContratante` = o `id_contratante` da coalizão.
2. **CMU-16 / `FND-COL-03`** — corrigir o seletor "Adicionar membro" para filtrar
   `dim_contratante.tipo_contratante = 'mandato'`.
3. Rodar a fase **Validate** (Verifier independente) sobre os 16 requisitos, incluindo os 14 já
   implementados — hoje ninguém confirmou formalmente que cobrem os Acceptance Criteria do
   `spec.md`.
4. Atualizar `spec.md` (status de cada CMU-NN) e `STATE.md` (handoff) para refletir a realidade.

**Por que primeiro:** é a menor distância até destravar dívida de processo acumulada, e corrige um
bug de dado ativo (coalizão aparecendo como opção de membro de contrato).

### Trilha B — Convite por contrato (acesso externo)

Ainda não iniciada. Substitui o magic link removido pelo AD-026 para Mentor/Consultor e Assessor
externos.

Desenho já esboçado (herdado da versão anterior deste roadmap, ainda válido):

1. Gestora, na tela do contrato, clica "Convidar assessor" → e-mail, cargo, grau de
   responsabilidade, áreas.
2. Sistema gera token aleatório, grava **hash** em `convite_contrato` (tabela nova, migração
   incremental, AD-008/AD-025) com `id_contrato`, `papel_global` previsto, expiração, uso único.
3. Tela devolve a URL `/convite/<token>` para a Gestora copiar (mesmo padrão manual de
   `scripts/gerar-link-acesso.ts`, sem depender de SMTP).
4. Convidado abre a URL (rota pré-sessão), vê de qual mandato/contrato se trata, define nome+senha.
5. Route handler de servidor cria a conta (`email_confirm: true`) e chama RPC que grava
   `dim_usuario` + `rel_usuario_contrato` e consome o convite — numa transação só.

**Implicações a registrar na fase Specify, não detalhe:**
- Precisa de um **AD novo** que abra a 5ª exceção à lista fechada da AD-010.
- É um desvio deliberado do magic link previsto em §5.3 — mesmo rigor de registro que o AD-026 já
  teve.
- Mitigações obrigatórias: token de uso único, expiração curta, hash (nunca token em claro),
  rate limit por IP/token, auditoria de emissão e consumo (§5.5).
- **Bônus:** o mesmo mecanismo cobre o pareamento mentorado↔mentor do PLL — não vira feature
  separada depois.

**Por que agora:** é pequena, autocontida, e resolve o acesso externo de Mentor/Consultor e Assessor
que o AD-026 deixou pendente (magic link removido). **Não é mais pré-requisito da grade de Sucessos
Mensais** — o gate de protótipo da AD-022 caiu com a AD-028 — mas continua sendo o único caminho de
acesso pra esse público enquanto não existir.

### Trilha C — Catálogos (12 `ref_*` faltantes)

Pré-requisito estrutural de tudo que vem no §5 e §6 — nenhuma tabela de Operação, Planejamento ou
Incidência existe sem os catálogos que ela referencia.

1. **Levantamento de dado** (sem código): etapas por produto, os 16 formulários + métricas,
   tipologias (grupo/tipologia/estado + níveis padrão), níveis do IIP, indicadores com peso,
   preditores, agendas temáticas, perfis de atuação, pilares de insight, dimensões do GIP.
2. Fechar **D9** (régua da Coalizão clona a da Estratégia ou tem etapas próprias) junto deste
   levantamento — sem resposta, a instanciação de contrato de Coalizão no §5 não tem o que
   instanciar.
3. Migração das 12 tabelas + seed + RLS + grants + smoke test de leitura por papel.

> **Fora de escopo nesta fatia:** `/admin/catalogos` (CRUD administrado). A regra constitucional
> (§6.6, AD-004) exige tabela editável — que passa a existir aqui. A tela de edição é conveniência
> e entra quando o Admin tiver mais o que administrar.

### Trilha D — Plataforma de UI (AD-021 + estados padrão)

1. Instalar TanStack Query + TanStack Table e montar o provider — sem refatorar as telas de
   Fundação retroativamente (custo sem retorno, ver §7).
2. Instalar `sonner` (toast), `skeleton`, `tabs`, `tooltip`, `dropdown-menu`, `alert-dialog`,
   `checkbox`, `calendar`, `progress`.
3. Padronizar 3 componentes de estado (`<CarregandoSkeleton>`, `<ErroInline>`, `<EstadoVazio>`) +
   toast global, para toda feature nova herdar em vez de reinventar.

**Por que agora:** é dependência pura da grade de Sucessos Mensais (§6) e do Kanban (§5) — melhor
já estar pronta quando essas telas começarem, em vez de virar bloqueio de última hora.

### Trilha E (menor, pode entrar em qualquer uma das sessões acima como item avulso)

Correções pequenas e independentes entre si, encaixáveis em qualquer folga:

- ~~`FND-USR-02` — adicionar `WITH CHECK` explícito à policy `p_usuario`~~ ✅ **Resolvido em
  2026-08-10**, fora de ordem (não esperou nenhuma trilha) por ser falha de segurança ativa.
- `FND-CTR-05` — popular `id_cargo_no_contrato`/`id_partido_no_contrato` no insert do contrato.
- Reproduzir e fechar (ou descartar formalmente) o relato de dropdowns quebrados — hoje parece
  resolvido, mas nunca foi confirmado nem riscado da lista.

---

## 5. Onda de Operação — sequencial, depende da Trilha C

### 5.1 Régua de etapas e instanciação (OPR-01)

⚠️ **Nota que a versão anterior já registrava e continua válida:** `dim_planejamento` referencia
`ref_perfil_atuacao` e é criado vazio na instanciação — ou seja, esta feature puxa junto uma fatia
da camada de Planejamento. Migrar só `dim_planejamento` aqui; as demais tabelas de Planejamento
entram no §6.

Trabalho: RPC `app.instanciar_contrato` (cria régua completa com `dt_prevista_*` derivadas de
`ref_etapa.duracao_prevista_dias`, `dim_planejamento` vazio, `rel_formulario_contrato` da etapa) +
migração (`fat_etapa_contrato`, `rel_formulario_contrato`, `dim_planejamento`) + `vw_etapa_contrato`
+ tela da régua no detalhe do contrato (previsto × realizado, atraso **derivado, nunca digitado** —
AD-005).

**Entrega:** o contrato nasce com sua régua e seu planejamento vazio — primeira prova concreta da
Definição de Pronto ("no sistema o contrato já nasce com suas tabelas").

### 5.2 Kanban de etapas (AD-023)

Depende de 5.1 existir (`fat_etapa_contrato`). É superfície de **escrita**: arrastar o card grava a
transição com data e autor no fato de etapa — exige RLS de escrita, validação de transição e
auditoria (AD-006). Recortes por Gestora, Mentor, produto e projeto.

**Entrega:** G1 (carteira ponderada) e G2 (tempo de ciclo) passam a acumular dado a partir daqui —
indicador histórico não se recupera depois, então quanto antes esta tela existir, mais cedo os
dois indicadores têm série real.

---

## 6. Segunda leva de paralelismo — Planejamento, Incidência e Formulários

As três dependem só da Fundação + dos catálogos (Trilha C) + da régua (§5.1) existirem — **não
dependem umas das outras** (§2 as define como camadas transversais irmãs, AD-007). É aqui que o
paralelismo de maior porte do roadmap acontece: três specs, três frentes, sem bloqueio cruzado.

### 6.1 Planejamento do contrato (PLN-01/02/03)

Hierarquia Objetivo Específico → Meta → Sucesso Mensal (AD-012, um único conjunto de tabelas
discriminado por produto — nunca um schema por produto), preditores, agenda temática, SWOT no
objetivo.

A **grade editável de Sucessos Mensais** é a tela de maior frequência do sistema. O gate de
protótipo validado com assessor real que a AD-022 exigia foi **dispensado** (AD-028, 2026-08-10) —
a feature avança sem essa validação externa prévia e sem depender da Trilha B. O risco de adoção
descrito em §5.7 continua valendo como algo a observar (tabulação entre células, colar de uma
faixa, edição em massa precisam ser rápidos, ou os assessores voltam pra planilha) — a mitigação
agora é revisão pós-implementação, não gate prévio (trade-off registrado na AD-028).

### 6.2 Incidência + Encontros (INC-01/02/03, OPR-03)

Registro, Insight, Fato Gerador, e o cálculo do IIP (AD-014 — calculado uma única vez aqui, a Saída
só lê). Encontros (OPR-03) entra junto por alimentar registros/insights diretamente. IIP entra
rotulado como provisório enquanto D2 (aritmética final) não fecha — isso não bloqueia a entrega.

### 6.3 Formulários (OPR-02)

A mais pesada das três: 16 formulários, JSONB versionado, métricas calculadas via trigger. Depende
de `ref_formulario`/`ref_metrica_formulario` (Trilha C) e de `rel_formulario_contrato` (§5.1), mas
usa tabelas próprias (`fat_submissao`, `fat_resposta_metrica`) que não colidem com Planejamento nem
Incidência — pode correr ao lado das outras duas sem coordenação além do catálogo compartilhado.

---

## 7. Saída — última onda, mas entregável em fatias

Números de impacto, carteira, visão gerencial, evolução do GIP, snapshot mensal (AD-015: única
escrita autorizada na Saída é o job de fechamento mensal). Não precisa esperar as três frentes do
§6 chegarem 100% prontas — cada view/MV pode nascer assim que a camada de que depende estabiliza:
`vw_carteira` e `vw_etapa_contrato` já podem existir logo depois do §5; `mv_iip_contrato` só depois
de 6.2; `vw_sucesso_mensal`/GIP só depois de 6.1. Home/dashboard real (hoje a raiz não tem uma tela
própria) entra junto desta onda.

---

## 8. Rituais fixos (todo fim de feature)

1. **UAT manual** com roteiro acumulativo em `.specs/uat/roteiro-manual.md` — cresce a cada
   feature, nunca é reescrito.
2. **Verifier independente** (autor ≠ verificador, evidência-ou-zero) → `validation.md`. A Trilha A
   é o lembrete vivo do custo de pular esta etapa.
3. **Atualizar `STATE.md`**: handoff + qualquer AD novo (Trilha B precisa de um).
4. **Lição reutilizável** sempre que uma falha de verificação virar padrão a evitar.
5. **Backup do banco antes de toda migration destrutiva** (`docs/fluxo-de-trabalho.md` tem o
   comando pronto).
6. **`drift-check` mentalmente obrigatório** antes de considerar uma migration terminada — agora
   que o CI cobre isso automaticamente toda segunda, mas vale rodar sob demanda em mudança grande.

---

## 9. O que este plano deliberadamente **não** faz

- Não refatora as telas de Fundação para TanStack Query/Table retroativamente — custo sem retorno.
- Não constrói `/admin/catalogos` antes de haver o que administrar.
- Não fecha a aritmética do IIP (D2) — depende da área de conhecimento.
- Não toca em Mapa Político nem Diagnóstico de Organograma (AD-017, deferidos).
- Não implementa prospecção (decisão fechada: contrato existe quando há contrato).
- Não trata `FND-CTR-05` como bloqueante — é debito de baixo impacto, cabe como item avulso da
  Trilha E sempre que houver folga.
- Não assume que os dropdowns "quebrados" estão resolvidos só porque o código parece correto —
  fica como item explícito de confirmação (Trilha E) até alguém reproduzir ou descartar de fato.
