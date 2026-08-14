# Planejamento Estratégico — Redesenho da Tela Specification

## Problem Statement

A tela `/contratos/[id]/planejamento` **já existe e já foi validada** — feature
`planejamento-planilha-monitoramento` (`.specs/features/planejamento-planilha-monitoramento/`),
concluída em 2026-08-12, 11/11 requisitos P1 (PLM-01 a PLM-11) + extensão P2 (PLM-12 a PLM-18),
Verifier independente `PASS`. Não é placeholder: `PlanejamentoArvore` (árvore Objetivo→Meta→Sucesso
Mensal, grade TanStack Table v9 com tab/blur + colar de faixa), formulários inline de
Objetivo/Meta/Sucesso Mensal/Dados do Planejamento, cascata assíncrona via
`app.recalcula_atingimento`, RLS herdada, tudo em produção.

Pedro pediu um redesenho substancial desta mesma tela — layout de 2 colunas, 3 modos por papel
(Construir/Monitorar/Ler), objeto `PERMISSOES` único, modais em vez de formulário inline, e um
padrão de grade (teclado completo, colar de faixa aceitando vírgula/`%`, edição em massa, undo)
mais próximo de planilha real. Este `spec.md` trata isso como **redesenho que supersede a
apresentação de `planejamento-planilha-monitoramento`**, não como feature nova do zero — nenhum
contrato de backend (RLS/GRANT/RPC/cascata) daquela feature muda, salvo onde este documento diz o
contrário explicitamente.

**Investigação prévia a este spec** (registrada em `.specs/STATE.md`/conversa desta sessão) achou 3
conflitos reais entre o pedido original e o estado do projeto, todos resolvidos com Pedro antes de
Design — ver `context.md`.

## Goals

- [ ] Layout 2 colunas (contexto estratégico colapsável + árvore-grade full-width), cabeçalho com
      breadcrumb/chips/indicadores/faixa de recálculo explícita.
- [ ] 3 modos (Construir/Monitorar/Ler) com colunas e edição definidas pelo papel via objeto
      `PERMISSOES` único — fim das checagens de papel espalhadas em `planejamento-arvore.tsx`.
- [ ] Árvore-grade unificada de verdade: uma tabela, três tipos de linha (`obj`/`meta`/`sm`),
      recolhível por nível.
- [ ] Toolbar: expandir/recolher tudo, busca textual, "só minhas metas", "só pendentes", aplicar %
      em massa, criar Objetivo (só Construir).
- [ ] Modais substituem os formulários inline atuais: detalhe/edição (duplo clique/ação),
      histórico de auditoria (novo — `log_auditoria` já existe e já está conectado às 5 tabelas,
      só falta UI de leitura).
- [ ] Comportamento de grade nível-planilha: teclado completo (Tab/Enter/setas/Esc/Home/End), colar
      de faixa aceitando vírgula **ou** ponto decimal e sufixo `%`, edição em massa (shift+clique),
      undo (Ctrl+Z) client-side.
- [ ] Faixa de recálculo explícita: escrever `pct_atingimento` continua marcando
      `atingimento_desatualizado`, mas a tela para de recalcular **silenciosamente** ao abrir — passa
      a mostrar o valor antigo + faixa + botão "Recalcular agora" até ação explícita (regra
      inegociável §4 do pedido original).

## Out of Scope (com dono e critério de retomada)

| Item | Por que fora | Quando retomar |
| --- | --- | --- |
| Papel `legisla` como 5º papel distinto | Conflita com **AD-018** (ativa: "Interno Legisla recebe acesso de Gestora") e com `ck_usuario_papel` (só `admin/gestora/mentor/assessor`). Decisão de Pedro nesta sessão: manter AD-018, sem papel novo — ver `context.md` | Só se uma decisão nova emendar AD-018 explicitamente |
| GIP (`fat_gip`/`fat_gip_dimensao`/`vw_gip_evolucao`) na coluna esquerda | Já é escopo desenhado (Design aprovado) de `.specs/features/formularios-produto/` (FRM-15 a FRM-19) — inclusive o único caminho de escrita (`app.trg_deriva_gip`, disparado por submissão de formulário). Provisionar aqui duplicaria/colidiria | Quando `formularios-produto` provisionar `vw_gip_evolucao` — esta tela troca o placeholder por leitura real |
| IIP no cabeçalho + contador "N insights · M fatos" + modal de incidência na Meta | Schema (`mv_iip_contrato`/`vw_iip_contrato`/`fat_insight`/`fat_fato_gerador`) já provisionado por `.specs/features/incidencia-encontros/` (em execução, T1-T15/35 concluídas), mas a UI de leitura (`IipCard`, formulários) é T28-T35 daquela mesma feature, ainda não construída | Quando `incidencia-encontros` concluir T16-T35 — esta tela troca os placeholders por leitura real |
| `vw_pendencias` | Aprovada no schema, nunca provisionada — depende de infraestrutura de Formulários (pendência de resposta), fora do que esta tela cobre | Feature de Formulários/Saída, não esta |
| Faixa "atuando como X" + impersonation de Admin | AD-018 prevê como modo de operação do Admin, mas **nenhuma infraestrutura de impersonation existe hoje em nenhuma tela do projeto** (grep confirmado). Construir isso só para esta tela seria feature de plataforma nova, não redesenho de tela | Feature de plataforma própria (impersonation), fora deste redesenho |
| Migração de `app.recalcula_atingimento` para excluir `pct_atingimento IS NULL` da média (D-B) | Decisão de Pedro nesta sessão: manter o comportamento já aprovado/testado em produção (`COALESCE(...,0)`, conta como 0) — AD-008 não redesenha função já aprovada sem motivo | Só se uma decisão de negócio nova pedir explicitamente a mudança de fórmula |

## Requirement Traceability

| Requirement ID | Descrição | Fase | Status |
| --- | --- | --- | --- |
| PLR-01 | Layout 2 colunas, coluna esquerda colapsável (accordion <1024px) | Design | Pending |
| PLR-02 | Cabeçalho: breadcrumb, h1=`objetivo_ano`, chips (produto/projeto/coalizão/etapa+mês+atraso via `vw_etapa_contrato`) | Design | Pending |
| PLR-03 | 3 indicadores no cabeçalho: % planejamento com barra + cobertura n/N; IIP (placeholder, oculto p/ Assessor quando ligado) | Design | Pending |
| PLR-04 | Faixa de recálculo explícita substitui recálculo silencioso no `useEffect` | Design | Pending |
| PLR-05 | Coluna esquerda: legado/análise de conjuntura/perfil de atuação (só PLL)/preditores prioritários — reaproveita `DadosPlanejamentoForm`, corrige gate de produto que falta hoje | Design | Pending |
| PLR-06 | Coluna esquerda: seção GIP como placeholder "em desenvolvimento" | Design | Pending |
| PLR-07 | Objeto `PERMISSOES` único (papel × modo → capacidades), substitui checagens inline | Design | Pending |
| PLR-08 | 3 modos (Construir/Monitorar/Ler): colunas e edição por modo, modo padrão por papel, modos não permitidos desabilitados (não escondidos) | Design | Pending |
| PLR-09 | Árvore-grade unificada: uma tabela, 3 tipos de linha, recolhível por nível, substitui `PlanejamentoArvore` | Design | Pending |
| PLR-10 | Célula calculada (% de Meta/Objetivo): não focável, sem handler de clique, estilo visualmente distinto de célula editável | Design | Pending |
| PLR-11 | Toolbar: expandir/recolher tudo, busca textual, "só minhas metas" (Assessor/Mentor via `idUsuario`), "só pendentes", aplicar % em massa, criar Objetivo (Construir) | Design | Pending |
| PLR-12 | Modal de detalhe/edição (duplo clique ou botão de ação), envolve os forms de Objetivo/Meta/Sucesso Mensal existentes | Design | Pending |
| PLR-13 | Modal de histórico de auditoria por item (`log_auditoria`, quem/quando/de→para) — nova leitura, backend já existe | Design | Pending |
| PLR-14 | Modais: fecham com Esc, devolvem foco à linha de origem, `role="dialog"`/`aria-modal`, nunca empilhados | Design | Pending |
| PLR-15 | Teclado: Tab avança, Enter/↓ descem, ↑ sobe, Esc cancela edição da célula, Home/End vão a início/fim da linha | Design | Pending |
| PLR-16 | Colar em faixa aceita vírgula ou ponto decimal e sufixo `%` (hoje só aceita ponto, sem `%`) | Design | Pending |
| PLR-17 | Edição em massa: shift+clique marca/desmarca células, ação aplica valor a todas as marcadas | Design | Pending |
| PLR-18 | Undo (Ctrl+Z): reverte a última escrita (célula/faixa/massa) sem sair da tela — via reescrita pelo mesmo caminho validado, nunca apaga/edita `log_auditoria` (gera nova linha de auditoria, histórico continua append-only) | Design | Pending |
| PLR-19 | Salvamento otimista com reversão em erro + indicador de "salvando" por célula (já existe para célula única — estender para massa/undo) | Design | Pending |

**Cobertura de PLM-01 a PLM-18**: nenhuma revogada. Este redesenho reaproveita RLS/GRANT/RPC/cascata
inteiros; onde este documento troca apresentação (ex.: formulário inline → modal), a AC original
continua satisfeita pelo mesmo contrato de backend.

**ID format**: `PLR-NN`. **Status values**: Pending → In Design → In Tasks → Implementing → Verified

## Edge Cases (herdados + novos)

- Herdados de `planejamento-planilha-monitoramento/spec.md` (somas de peso ≠ 100 = alerta nunca
  bloqueio; Coalizão sem planejamento próprio = leitura agregada por membro; `mes_referencia` sempre
  por seletor; edições concorrentes em SM diferentes salvam independentemente) — todos continuam
  válidos, sem mudança de contrato.
- WHEN o usuário aperta `Ctrl+Z` sem nenhuma escrita nesta sessão THEN o sistema SHALL não fazer
  nada (pilha vazia, sem erro).
- WHEN uma célula calculada (Meta/Objetivo) recebe foco por navegação de teclado (Tab) THEN o
  sistema SHALL pulá-la — `tabIndex={-1}` real, não só estilo.
- WHEN o papel é `assessor` e ele abre a tela THEN o modo inicial SHALL ser Monitorar, filtrado
  apenas às Metas com `id_usuario_responsavel = auth.uid()` — mesmo dado de hoje, filtro novo de
  toolbar/carregamento.
- WHEN um papel sem `verAuditoria` (Assessor, Mentor) tenta abrir o modal de histórico THEN o botão
  SHALL nem aparecer — mesmo padrão de gate já usado (PLM-14).

## Decisões resolvidas nesta sessão (ver `context.md` para o texto completo)

1. Papel `legisla` descartado — Interno Legisla mantém `papel_global='gestora'` (AD-018 inalterada).
2. GIP: placeholder, sem provisionar nesta feature (dono é `formularios-produto`).
3. IIP/Insight/Fato Gerador: placeholder, sem provisionar UI nesta feature (dono é
   `incidencia-encontros`, T16-T35 pendentes).
4. D-B (tratamento de `NULL` na cascata): mantém `COALESCE(...,0)` já aprovado/testado — sem
   migration nova.
5. D-A (agregação acima do Sucesso Mensal): já resolvida por `app.recalcula_atingimento` — média
   simples nos 2 níveis de cima, coincide com o default do pedido original. Nenhuma ação.
6. D-C (escopo do mês em Monitorar) e D-D (mecanismo de undo): sem decisão síncrona de Pedro — este
   spec adota o default proposto no pedido original, marcado `// TODO(D-C)`/`// TODO(D-D)` no
   código (ver `design.md`), e fica registrado aqui para Pedro revisar/corrigir a qualquer momento.

## Success Criteria

Herda os "Critérios de aceite" do pedido original (seção 9), com 2 ajustes por causa das decisões
acima:
- [ ] Trocar de papel muda colunas editáveis e modo padrão, sem trocar de layout (4 papéis:
      gestora/mentor/assessor/admin — não 5).
- [ ] Nenhuma célula de Meta ou Objetivo aceita foco, clique ou digitação.
- [ ] Limpar uma célula de `%` grava `NULL` e a linha passa a exibir "—" e "pendente".
- [ ] Editar um `%` liga a faixa de desatualizado; "Recalcular" a desliga e atualiza os números —
      **sem** recálculo automático silencioso ao abrir a tela (mudança de comportamento desta feature).
- [ ] Alterar um peso de modo que a soma da meta ≠ 100 mostra o erro na linha da Meta imediatamente
      (já implementado — não regredir).
- [ ] Colar 5 valores do Sheets numa célula preenche 5 células para baixo, aceitando vírgula/ponto/`%`.
- [ ] `Ctrl+Z` reverte a última escrita, inclusive nova linha em `log_auditoria` (não apaga a antiga).
- [ ] Papel `assessor`: sem IIP (placeholder), sem incidência (placeholder), sem coluna de
      responsável, e só as metas dele.
- [ ] Nenhum papel tem menos células editáveis do que tem hoje em `planejamento-planilha-monitoramento`
      (não regredir GRANT/RLS já aprovados).
- [ ] Produto PLL: coluna de preditor secundário ausente; campo de perfil de atuação presente (e
      **ausente** para Estratégia/Coalizão — gap corrigido nesta feature, `DadosPlanejamentoForm`
      hoje mostra sempre).
- [ ] Nenhum painel fixo à direita em nenhum estado da tela.
- [ ] Navegação completa por teclado; foco visível em todos os controles.
