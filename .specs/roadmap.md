# Roadmap de Execução — Sistema Mandatos

Plano de trabalho sequenciado das próximas semanas. Companheiro do `STATE.md` (decisões) e do
`overview.md` (arquitetura). **Este documento é vivo**: cada feature concluída atualiza o bloco
"Estado real" e risca a linha correspondente.

- **Escrito em:** 2026-07-31
- **Capacidade assumida:** dedicação integral (~30–40h/semana)
- **Fonte de prioridade:** Definição de Pronto (Constituição §6) + ordem de dependência das camadas (§2)

---

## 1. Estado real (verificado em 2026-07-31, não copiado de documento)

### 1.1 Banco — 17 das 51 tabelas do modelo aprovado

| Bloco | Provisionado | Falta |
| :---- | :---- | :---- |
| Catálogos `ref_*` | 4 — `ref_produto`, `ref_projeto`, `ref_cargo`, `ref_partido` | **12** — `ref_etapa`, `ref_tipo_registro`, `ref_formulario`, `ref_metrica_formulario`, `ref_preditor`, `ref_agenda_tematica`, `ref_perfil_atuacao`, `ref_pilar_insight`, `ref_indicador`, `ref_nivel_iip`, `ref_tipologia`, `ref_dimensao_gip` |
| Plataforma | 3/3 — `dim_usuario`, `rel_usuario_contrato`, `log_auditoria` | — |
| Fundação + Âncora | 5/5 — `dim_contratante`, `dim_mandato`, `dim_coalizao`, `fat_contrato`, `rel_coalizao_membro` | — |
| TSE | 4 tabelas + `rel_mandato_candidatura` + 2 MVs | — |
| Operação | 0 | 8 tabelas |
| Planejamento | 0 | 7 tabelas |
| Incidência | 0 | 5 tabelas |
| Saída | 0 | 1 tabela + ~10 views/MVs |
| Staging | 0 | `stg.map_legado` |

**Leitura:** a Fundação está de pé e **nada acima dela existe**. Os 12 catálogos faltantes são
pré-requisito estrutural de OPR-01, OPR-02, PLN-01, PLN-03, INC-01 e INC-03 — são o primeiro
gargalo do caminho crítico.

### 1.2 Frontend

**Rotas em pé (10):** `/login` · `/mandatos` · `/mandatos/novo` · `/mandatos/[id]` ·
`/mandatos/[id]/contratos/novo` · `/coalizoes` · `/coalizoes/novo` · `/coalizoes/[id]` ·
`/usuarios` · `/contratos/[id]/vinculos` (+ `/admin/acesso` dev-only e `/auth/*`).

**Primitivos shadcn instalados (9):** badge, button, card, dialog, form, input, label, select, table.

**Lacunas de plataforma de UI que bloqueiam o roadmap:**

| Lacuna | Bloqueia | Onde entra |
| :---- | :---- | :---- |
| `command` + `popover` | combobox do TSE (CMU-08) | Bloco 0 |
| TanStack Query + TanStack Table (AD-021 nunca cumprida) | grade de Sucessos Mensais (§5.7, risco nº 1) | Bloco 0 (instalar) / Semana 5 (usar de fato) |
| toast/`sonner` | feedback de escrita em toda tela | Bloco 0 |
| skeleton, tabs, tooltip, dropdown-menu, alert-dialog, textarea, checkbox, date-picker, progress | régua, Kanban, formulários, planejamento | Bloco 0 |
| Estados padronizados de loading / erro / vazio | toda feature nova reinventa hoje | Bloco 0 |

### 1.3 Features spec-driven

| Feature | Fase | Situação |
| :---- | :---- | :---- |
| `fundacao-entidades-pessoas` | Validate | ✅ Concluída — 20/26 Verified, **5 Needs-Fix** conhecidos |
| `primeira-tela-cadastro` | Validate | ✅ Concluída e verificada |
| `login-senha-interno-legisla` | Validate | ✅ Concluída (7/7) — falta só o passo manual com colega real |
| `cadastro-mandato-contrato-unificado` | **Specify** | 16 requisitos (CMU-01..16), **Design é o próximo passo**; ainda não commitada |

### 1.4 Débito conhecido que o plano precisa endereçar

1. `FND-TSE-01`/`FND-TSM-01` — filtro de cargo na busca TSE (**resolvido por outra via** na Feature A: restrição na origem).
2. `FND-CTR-05` — snapshot de cargo/partido no contrato nunca populado.
3. ~~`FND-USR-02` — Gestora criando Gestora barrado só na UI, sem `WITH CHECK` de RLS.~~ ✅ **Corrigido em 2026-08-10** (`20260810181508_fix_with_check_p_usuario.sql`, aplicado em dev) — era mais grave que o registrado: sem `WITH CHECK`, Gestora conseguia criar até Admin, não só Gestora. Teste de regressão em `supabase/tests/plataforma/usuario-with-check.integration.test.ts` (4/4 verde), suíte de RLS/sessão existente sem regressão (13/13 verde).
4. `FND-COL-03` — seletor de membro de coalizão não filtra `tipo_contratante` (entra na Feature A).
5. `FND-TSE-03` — rejeitar sugestão TSE não persiste (conflito spec/schema documentado).
6. Dropdowns (Cargo/Partido/Produto/Projeto) relatados como quebrados — **causa não reproduzida ainda**.
7. `.specs/overview.md` aponta o projeto Supabase `mgoeloqdlpgkofgqqbjs`; o ambiente de dev real é
   `npnvoolkebhabjkjzqwn` (AD-020). Risco de semear em produção por engano — corrigir.

---

## 2. Decisões pendentes que o plano depende

| # | Assunto | Situação | Quando resolve |
| :---- | :---- | :---- | :---- |
| **AD-026** | Login por senha removeu o magic link → **Mentor e Assessor externos sem acesso** | Superado pelo **convite por contrato** (Semana 2) | Semana 2 |
| **AD-010** | Lista fechada de 4 exceções privilegiadas | O convite por contrato precisa de uma **5ª exceção** → exige AD novo explícito | Semana 2 (fase Specify) |
| **AD-022** | Grade de Sucessos Mensais exige protótipo validado com **assessor real** antes de código de produção | Gate agendável só depois que o convite existir | Semana 4 |
| **AD-021** | TanStack Query/Table | Instalar no Bloco 0; usar de fato na onda de Planejamento. **Sem refatorar Fundação retroativamente** | Bloco 0 |
| **D9** | Régua de etapas da Coalizão — sem seed de `ref_etapa` | Decisão de conteúdo da operação. Hipótese registrada: clonar a régua da Estratégia | Semana 2 (junto do levantamento) |
| **D2** | Aritmética final do IIP | Não bloqueia — o número entra rotulado como provisório | Onda de Incidência |

---

## 3. Sequência — por que esta ordem

O caminho crítico não é escolha de gosto: é dependência de camada (§2, AD-007).

```
Fundação fechada (contrato existe de verdade)
        ↓
12 catálogos (ref_etapa, ref_formulario, ref_tipologia…)
        ↓
OPR-01 régua + instanciação  →  Kanban (escrita da transição, AD-023)
        ↓                              ↓
PLN-01 planejamento            G1/G2 passam a ter dado desde o dia 1
        ↓
PLN-02 ciclo mensal (a tela de maior frequência do sistema)
        ↓
INC-01/02/03 + OPR-03 encontros  →  IIP provisório
        ↓
OPR-02 formulários (a mais pesada)
        ↓
OUT-01/03/05/06 Saída
```

**Acesso externo (convite) entra cedo, fora da linha principal**, porque é pequeno e destrava o gate
do AD-022 — sem ele, o protótipo da grade seria validado com um colega interno fingindo ser assessor,
que é exatamente o teste que não vale.

---

## 4. Plano por bloco

### Bloco 0 — Higiene e plataforma de UI · **Segunda, 03/08 (1 dia)**

Não é feature, é destravamento. Sem isso, a Feature A para no primeiro dia (o combobox exige
`command`+`popover`).

| # | Tarefa | Saída esperada |
| :---- | :---- | :---- |
| 0.1 | **Sessão de teste manual guiada** das 10 rotas existentes, com roteiro escrito em `.specs/uat/roteiro-manual.md` | Roteiro acumulativo + lista de defeitos reais (não suspeitos) |
| 0.2 | Reproduzir o bug dos dropdowns no navegador — **antes de propor causa** (grants/RLS já conferidos no SQL) | Causa-raiz identificada ou descartada como estado de ambiente |
| 0.3 | Limpar a árvore git: spec untracked, `.cursorrules`, skill `ui-ux-pro-max`, `docs/Identidade Visual Legisla.md` movido, `package.json` | `git status` limpo |
| 0.4 | Corrigir o projeto Supabase em `.specs/overview.md` | Documento aponta o ambiente de dev correto |
| 0.5 | Instalar shadcn faltantes: `command`, `popover`, `sonner`, `skeleton`, `tabs`, `tooltip`, `dropdown-menu`, `alert-dialog`, `textarea`, `checkbox`, `calendar`, `progress` | Primitivos disponíveis |
| 0.6 | Instalar TanStack Query + TanStack Table (AD-021) e montar o provider | Dependência pronta, sem refatorar telas existentes |
| 0.7 | Padronizar 3 componentes de estado: `<CarregandoSkeleton>`, `<ErroInline>`, `<EstadoVazio>` + toast global | Toda feature nova herda; nenhuma reinventa |

> **Critério de saída:** teste manual documentado, árvore limpa, primitivos instalados.

---

### Semana 1 (03–07/08) — Fundação fechada

**Feature A · `cadastro-mandato-contrato-unificado`** — já especificada (16 requisitos CMU-01..16).

| Dia | Trabalho |
| :---- | :---- |
| Seg | Bloco 0 |
| Ter | **Design** — decisões: RPC única `app.criar_mandato_e_contrato` (AD-024, atomicidade da CMU-06), detecção de duplicidade por `nr_titulo_eleitoral`, forma do combobox. Confirmar `SELECT DISTINCT cd_cargo, ds_cargo FROM tse.dim_candidatura` **antes** de escrever o `DELETE` (exigência do próprio spec) |
| Qua | **Tasks + Execute** — wizard unificado, combobox com debounce, título travado quando vem do TSE |
| Qui | **Execute** — migração destrutiva do TSE (só Legislativo) com **relatório de `rel_mandato_candidatura` afetados antes de apagar** + refresh das 2 MVs · contrato próprio da Coalizão · correção `FND-COL-03` |
| Sex | **Validate** (Verifier independente) + UAT manual + atualizar `STATE.md` e `lessons.json` |

**Riscos desta semana:**
- A migração do TSE é **destrutiva e irreversível** no ambiente de dev. Fazer backup/`pg_dump` do schema `tse` antes.
- CMU-06 (atomicidade) é o requisito que mais facilmente passa "quase certo": mandato criado sem contrato é exatamente o estado parcial que a feature existe para eliminar.

**Entregue ao fim:** a Gestora cadastra mandato + abre contrato numa tela só, reeleição não quebra mais, coalizão tem contrato próprio.

---

### Semana 2 (10–14/08) — Acesso externo + catálogos

**Feature B · Convite por contrato (Seg–Ter)**

Substitui o magic link e o AD-026. Desenho proposto:

1. Gestora, na tela do contrato, clica **"Convidar assessor"** → informa e-mail, cargo, grau de responsabilidade e áreas.
2. Sistema gera token aleatório, grava **hash** em `convite_contrato` (tabela nova — migração incremental justificada, AD-008/AD-025) com `id_contrato`, `papel_global` previsto, expiração e uso único.
3. A tela devolve a URL `/convite/<token>` **para a Gestora copiar** (Slack/WhatsApp) — não depende de SMTP, mesmo padrão de `scripts/gerar-link-acesso.ts`.
4. O convidado abre a URL (rota pré-sessão, como `/login`), vê de qual mandato/contrato se trata, e define nome + senha.
5. Um route handler de servidor cria a conta com `email_confirm: true` e chama a RPC que grava `dim_usuario` + `rel_usuario_contrato` e consome o convite — **numa transação só**.

**Implicações constitucionais a registrar na fase Specify — não são detalhe:**
- Adiciona uma **5ª exceção privilegiada** à AD-010 (criar conta exige `service_role`). Exige AD novo explícito que supere/complemente AD-010 e AD-026.
- §5.3 prevê magic link para Assessor/Mentor; isto é um método diferente e precisa ser assumido como desvio deliberado, com o mesmo rigor do AD-026.
- Mitigações obrigatórias: token de uso único, expiração curta (7 dias), armazenado como hash, rate limit por IP e por token, evento de auditoria em emissão e consumo (§5.5).
- **Bônus:** o mesmo mecanismo cobre o pareamento mentorado↔mentor do PLL (B3.2) — não vira feature separada depois.

| Dia | Trabalho |
| :---- | :---- |
| Seg | Specify (com o AD novo) + Design + migração `convite_contrato` com RLS |
| Ter | Execute (tela de convite, rota `/convite/[token]`, route handler, RPC) + Validate + **teste real com um colega assumindo papel de assessor** |
| Qua | **Extração dos catálogos das planilhas legadas** — trabalho de dado, sem código: etapas por produto, 16 formulários + métricas, tipologias (tripla grupo/tipologia/estado + níveis padrão), níveis do IIP, indicadores com peso, preditores, agendas temáticas, perfis de atuação, pilares de insight, dimensões do GIP |
| Qui–Sex | **Feature C · Catálogos (FND-05, fatia 1)** — 12 tabelas + seed + RLS + grants + smoke test de leitura por papel |

**Decisão a fechar na quarta, junto do levantamento:** **D9** — a régua da Coalizão clona a da
Estratégia ou tem etapas próprias? O `INSERT` de clonagem já está pronto e comentado no DDL. Sem
resposta, OPR-06 segue sem especificação e a Coalizão não instancia régua na Semana 3.

> **Fora de escopo nesta fatia:** a tela `/admin/catalogos` (CRUD administrado). A regra
> constitucional (§6.6) exige que o limiar viva em **tabela editável** — e ela passa a existir aqui.
> A tela de edição é conveniência, e entra quando o Admin tiver mais o que administrar.

---

### Semana 3 (17–21/08) — Régua de etapas e instanciação

**Feature D · OPR-01**

⚠️ **Dimensionamento corrigido:** `dim_planejamento` referencia `ref_perfil_atuacao` e é criado
vazio na instanciação (A1.6). Ou seja, esta feature **puxa junto uma fatia da camada de
Planejamento** — não é só Operação. Migrar `dim_planejamento` aqui, e as demais tabelas de
Planejamento (`fat_objetivo_especifico`, `fat_meta`, `fat_sucesso_mensal`…) só na Semana 5.

| Dia | Trabalho |
| :---- | :---- |
| Seg | Specify + Design — RPC `app.instanciar_contrato` (cria régua completa com `dt_prevista_*` derivadas de `ref_etapa.duracao_prevista_dias`, `dim_planejamento` vazio e `rel_formulario_contrato` da etapa) |
| Ter–Qua | Execute — migração (`fat_etapa_contrato`, `rel_formulario_contrato`, `dim_planejamento`) + RPC + `vw_etapa_contrato` |
| Qui | Execute — tela da régua no detalhe do contrato: etapas com previsto × realizado, atraso **derivado nunca digitado** |
| Sex | Validate + UAT: instanciar um contrato de Estratégia de ponta a ponta e conferir a régua gerada |

**Entregue ao fim:** o contrato nasce com sua régua e seu planejamento vazio — a primeira prova
concreta da Definição de Pronto ("no sistema o contrato já nasce com suas tabelas").

---

### Semana 4 (24–28/08) — Kanban + gate do protótipo

| Dia | Trabalho |
| :---- | :---- |
| Seg–Qua | **Feature E · Kanban de etapas (AD-023)** — arrastar o card grava a transição com data e autor. É superfície de **escrita**: exige RLS de escrita, validação de transição e auditoria. Recortes por Gestora, Mentor, produto e projeto |
| Qui–Sex | **Protótipo navegável da grade de Sucessos Mensais** (gate AD-022) — tabulação entre células, colar de uma faixa, edição em massa. **Sem código de produção.** Agendar a sessão com um assessor real usando o convite da Semana 2 |

**Entregue ao fim da onda:** cadastro → contrato → régua → Kanban. A Gestora enxerga onde cada
mandato está, e G1/G2 passam a acumular dado a partir de agora — indicador histórico não se
recupera depois.

---

### Semana 5 em diante — onda de Planejamento

Sequência (a detalhar quando a onda anterior fechar):

1. **PLN-01 · Planejamento do contrato** — hierarquia Objetivo Específico → Meta → Sucesso Mensal, preditores, agenda temática, SWOT no objetivo. ~1 semana.
2. **PLN-02 · Ciclo mensal de atingimento** — a grade editável + a cascata. **Só depois do protótipo validado.** É a tela de maior frequência do sistema e merece ser a mais bem resolvida. ~1 semana.
3. **OPR-03 encontros + INC-01/02/03 registros, insights, fatos** — fecha o par plano/realizado e liga a Incidência. IIP entra rotulado como provisório (D2). ~2 semanas.
4. **OPR-02 formulários** — 16 formulários, JSONB versionado, métricas por trigger. A mais pesada. ~2 semanas.
5. **OUT-01/05/03/06 · Saída** — números de impacto, carteira, visão gerencial, snapshot mensal. ~2 semanas.

---

## 5. Rituais fixos (todo fim de feature)

1. **UAT manual** com o roteiro acumulativo em `.specs/uat/roteiro-manual.md` — cresce a cada feature, nunca é reescrito.
2. **Verifier independente** (autor ≠ verificador, evidência-ou-zero) → `validation.md`.
3. **Atualizar `STATE.md`**: handoff + qualquer AD novo.
4. **`lessons.py`** — falha de verificação vira lição reutilizável.
5. **Backup do banco de dev antes de toda migração destrutiva.**

---

## 6. Inventário de telas — existentes × faltantes

| Tela | Situação | Onda |
| :---- | :---- | :---- |
| `/login` · `/mandatos` (lista, novo, detalhe) · `/coalizoes` ×3 · `/usuarios` · `/contratos/[id]/vinculos` | ✅ existe | — |
| Wizard unificado mandato+contrato | 🔧 refaz | Semana 1 |
| `/convite/[token]` + ação "Convidar assessor" | ❌ | Semana 2 |
| Régua de etapas no detalhe do contrato | ❌ | Semana 3 |
| Kanban de etapas | ❌ | Semana 4 |
| Grade de Sucessos Mensais | 🧪 protótipo | Semana 4 → produção Semana 6 |
| Planejamento (hierarquia editável) | ❌ | Semana 5 |
| Registro / Insight / Fato Gerador | ❌ | Onda de Incidência |
| Formulários (resposta + abrir/fechar) | ❌ | Onda de Formulários |
| Carteira · Números de impacto · Visão gerencial | ❌ | Onda de Saída |
| `/admin/catalogos` (CRUD dos 16 `ref_`) | ❌ | Quando o Admin precisar |
| Home/dashboard real (hoje redireciona para `/mandatos`) | ❌ | Onda de Saída |

---

## 7. O que este plano deliberadamente **não** faz

- Não refatora as telas de Fundação para TanStack Query/Table retroativamente — custo sem retorno.
- Não constrói `/admin/catalogos` antes de haver o que administrar.
- Não fecha a aritmética do IIP (D2) — depende da área de conhecimento.
- Não toca em Mapa Político nem Diagnóstico de Organograma (AD-017, deferidos).
- Não implementa prospecção (decisão fechada: contrato existe quando há contrato).
- Não corrige `FND-CTR-05` como feature própria (baixo impacto, item avulso).
- `FND-USR-02` **foi corrigido fora de ordem, em 2026-08-10** — não esperou nenhuma feature, por ser
  falha de segurança ativa (Gestora conseguia criar Admin via RLS), não teórica.
