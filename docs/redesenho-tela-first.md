# Redesenho tela-first — protocolo

Como uma tela sai do Figma e chega em código sem repetir o erro que trouxe o
sistema até aqui. Registrado como **AD-038** em `.specs/STATE.md`.

- **Aberto em:** 2026-09-02
- **Motivo:** nenhuma tarefa da operação roda no sistema hoje, com 26 das 28 telas
  funcionais (`docs/mapa-de-telas.md`). O problema é **aderência à operação**, não
  implementação incompleta. Documento não conserta isso — ninguém valida operação lendo
  especificação. Tela, sim.
- **Inversão:** a tela validada passa a ser o insumo de origem. Jornadas e as seções de
  escopo da Constituição são **derivadas** dela, não o contrário.

---

## 1. O ciclo, por tela ou conjunto de telas

| # | Passo | Quem |
| :---- | :---- | :---- |
| 1 | Desenha a tela ideal no Figma e escreve a explicação (§2) | Pedro |
| 2 | Valida a tela com quem opera — e com o chefe | Pedro + operação |
| 3 | **Checagem de conformidade** — conflitos com regra inegociável, dado que não existe, jornada afetada (§3) | Claude |
| 4 | Decide o que fazer com cada conflito encontrado | Pedro |
| 5 | Escreve a spec da tela (que já nasce com a checagem dentro) e atualiza os documentos derivados (§4) | Claude |

O passo 3 é o único que impede o Figma de desenhar algo que a arquitetura não sustenta.
Sem ele, o erro só aparece na implementação — que é exatamente o que aconteceu antes.

**Ordem sugerida das telas.** Comece pelo **ciclo mensal de monitoramento**
(jornada A6): é o loop de maior frequência do sistema, onde a Gestora passa a maior
parte do tempo, e é onde a operação hoje está inteira na planilha. As próprias jornadas
já diziam que essa "merece ser a tela mais bem resolvida do produto". Se essa tela
funcionar, o sistema começa a ser usado antes de estar pronto — e isso muda a conversa
com o seu chefe.

---

## 2. O que cada tela precisa trazer junto

Oito perguntas. Não é burocracia: cada resposta alimenta um documento diferente, e sem
elas a checagem do passo 3 não é possível.

| # | Pergunta | Alimenta |
| :---- | :---- | :---- |
| 1 | Que tarefa da operação essa tela resolve? Quem faz, quando, com que frequência? | jornadas |
| 2 | Que **decisão** a pessoa toma aqui? (se não toma nenhuma nem registra nada, a tela talvez não deva existir) | jornadas |
| 3 | O que ela precisa **ver** para decidir? | consultas, camada Saída |
| 4 | O que ela **cria ou edita** aqui? | schema, migrations |
| 5 | De onde vem cada número e cada lista? Já existe no banco, é novo, ou é calculado? | schema, AD-003 |
| 6 | Qual é a tela **anterior** e a **próxima**? | jornadas, navegação |
| 7 | Quem **não** pode ver isso? | RBAC §3, RLS |
| 8 | O que a pessoa faz **hoje na planilha** que esta tela substitui? | Definição de Pronto §6 |

A pergunta 8 é a mais importante. É o teste objetivo de "perto da operação": se a
resposta for vaga, a tela ainda não está pronta para ser desenhada — e é essa a
pergunta que o seu chefe responde melhor que qualquer um.

---

## 3. A checagem de conformidade

O que eu verifico em cada tela, e o que acontece quando bate.

### Travas técnicas — valem sobre a tela

Estas não caem por decisão de design. Uma tela que fira qualquer uma delas exige
**decisão de arquitetura registrada como AD nova**, com o custo assumido por escrito —
não uma escolha silenciosa de layout.

| Se a tela… | Bate em | Consequência |
| :---- | :---- | :---- |
| mostra número de gestão/impacto novo | AD-003 · §6 regra 5 | precisa de view ou tabela na camada Saída antes de existir em tela |
| tem campo tipo "pendente de atualização" | AD-005 · §6 regra 7 | ausência é `NULL`; pendência é derivada, não digitada |
| é acessível sem login, ou tem formulário por link público | AD-002 · §6 regra 4 | não existe acesso anônimo — nem leitura |
| tem limiar fixo ("atrasado há 15 dias", peso de etapa) | AD-004 · §6 regra 6 | limiar vive em tabela de referência editável |
| escreve algo | AD-006 · §6 regra 8 | toda linha guarda autor e timestamp |
| mostra dado que só um papel deveria ver | AD-001 · §3 | a restrição mora na RLS do banco, nunca na UI |

### Checagens de cobertura

1. **Dado existe?** Cada campo da tela é cruzado com `docs/schema_sistema.sql`. Três
   resultados: já existe no banco · existe no modelo aprovado mas não provisionado
   (migration nova) · não existe em lugar nenhum (decisão de modelo antes de desenhar).
2. **Jornada afetada?** Qual bloco de `docs/jornadas-de-usuario-v2.md` esta tela
   reescreve, e se a ordem dos passos ou o responsável mudou.
3. **Inventário coberto?** A §10 das jornadas (tipos de registro, formulários,
   métricas) veio dos checklists reais de Estratégia e PLL. Para cada item que a tela
   toca: **cobre**, **substitui** ou **descarta** — descartar é legítimo, esquecer não.

### O que eu devolvo, por tela

- conflitos com trava técnica, com o custo de cada saída
- campos sem dado no banco, separados em "migration" e "decisão de modelo"
- blocos de jornada e seções da Constituição que a tela invalida
- veredito: **vira spec agora** · **precisa de uma decisão sua** · **precisa de AD nova**

---

## 4. O que atualiza o quê

| Documento | No redesenho | Quando |
| :---- | :---- | :---- |
| `docs/mapa-de-telas.md` | retrato do que existe hoje — **insumo do Figma** | intacto até a tela nova entrar em código |
| `docs/jornadas-de-usuario-v2.md` | **congelado**; a v3 é derivada das telas validadas | um bloco reescrito por tela validada |
| `docs/Constituição Sistema Mandatos.md` §1.3, §2, §3, §6 | em revisão | quando a tela mudar escopo de camada, papel ou Definição de Pronto |
| `docs/Constituição…` §5 e *Regras inegociáveis* | estáveis | só por AD explícita |
| `.specs/STATE.md` | só cresce — AD nova por decisão; nunca reescrever AD antiga | a cada conflito resolvido |
| `docs/schema_sistema.sql` | modelo aprovado | quando aparecer dado que não existe |
| `.specs/features/<tela>/spec.md` | contrato da tela, com a checagem do §3 dentro | uma por tela ou conjunto |

---

## 5. Gates — o que não pode acontecer

1. **Nenhuma tela vira código antes de validada com quem opera.** Retoma AD-022,
   dispensado por AD-028 em nome de ritmo — a aposta que não deu certo. Registrado como
   **AD-039**.
2. **Nenhuma tela vira código antes da checagem do §3.** A checagem faz parte da spec.
3. **Nenhum conflito com trava técnica é resolvido no Figma.** Vira AD ou não vira nada.
4. **Fatia por jornada, não por tela bonita.** Entregar a jornada mensal completa vale
   mais que 10 telas isoladas — o teste é a pessoa passar a semana sem abrir a planilha.
5. **Não jogue o banco fora por causa de tela.** O redesenho anterior desta mesma
   natureza (`.specs/features/planejamento-estrategico-redesenho/`) refez a
   apresentação inteira **sem mudar nenhum contrato de banco**. O custo real do
   redesenho está nas telas que faltam, não nas que mudam de forma.
