# Bloco de contexto para colar na IA do Figma

A IA do Figma (Make, First Draft, Figma AI) não lê este repositório. O único
jeito de o vocabulário chegar lá é ir junto no prompt.

**Como usar:** cole o *bloco base* sempre, e logo abaixo o *recorte* da
entidade que a tela trata. Depois descreva o que você quer ver. Se sobrar
espaço no prompt, prefira cortar a descrição visual — a lista de campos é o
que impede a invenção.

---

## Bloco base — colar sempre

```
CONTEXTO DE DOMÍNIO — Sistema Mandatos (Legisla Brasil). Regras obrigatórias:

1. Use EXATAMENTE os nomes de campo e os valores listados abaixo. Não crie
   campo novo, não renomeie, não traduza, não abrevie e não invente valores
   de status, categoria ou classificação. Se faltar informação para preencher
   um componente, deixe o rótulo e use "—" como valor.
2. Ausência de dado se representa com "—". Nunca "N/A", "Pendente",
   "Não informado" ou campo vazio.
3. Não invente métricas, percentuais de exemplo com nome próprio, nem
   legendas explicativas para siglas.
4. Escalas têm quantidade fixa de pontos. Não acrescente níveis.
5. Idioma: português do Brasil.

HIERARQUIA DO PLANEJAMENTO (nomes fixos, nesta ordem):
Planejamento > Objetivo Específico > Meta > Sucesso Mensal.
Não use "OKR", "KR", "Iniciativa", "Entregável", "Tarefa" ou "Marco".

ENTIDADES DISTINTAS (nunca fundir numa lista só):
Contrato · Etapa · Registro · Encontro · Insight · Fato Gerador · Meta.

PRODUTOS e suas cores fixas:
Estratégia = verde #035252 · PLL = turquesa #4ABFB2 · Coalizões = roxo #BA6BED.
Coral #EB5454 = alerta e prioridade alta. Bege #FFD278 = KPI e destaque.
Não atribua cor viva a categorias que não sejam essas.

TIPOGRAFIA: Anton (só títulos grandes e números de KPI, sempre em CAIXA ALTA)
e Commissioner (todo o resto). Fundo de conteúdo #FBF7EF, card #FFFFFF,
borda #E7E0D3.
```

---

## Recorte: tela de Planejamento (Objetivo / Meta / Sucesso Mensal)

```
CAMPOS DE META (use estes rótulos e apenas estes valores):
- Descrição da Meta (texto, obrigatório)
- Preditor primário (opcional) e Preditor secundário (opcional). Os 5 valores
  possíveis são frases longas — o componente precisa caber ~50 caracteres:
  "Priorizam sua Agenda" | "Pautam os Debates" |
  "Ocupam lugar nos espaços de decisão" | "Constroem Partido" |
  "Articulam e mobilizam para a entrega de resultados".
  O secundário só é habilitado se o primário estiver preenchido.
- Agenda temática (opcional) — catálogo ainda não definido; mostrar como
  "Agenda temática (catálogo pendente)", sem valor de exemplo.
- Prioridade (opcional): Alta | Média | Baixa
- Classe (opcional): Programática | Governança
- Responsável (opcional): pessoa
- Status: Ativa | Pausada | Descartada
- % de atingimento: CALCULADO, nunca editável. Desenhar como célula
  hachurada com o marcador "fx" antes do número, sem aparência de input.
  Não chamar de "Progresso".
NÃO existe campo "Tipo", "Predicado", "Progresso" nem status "Em planejamento".

CAMPOS DE SUCESSO MENSAL:
- Descrição do Sucesso Mensal (obrigatório)
- Mês de referência (obrigatório, seletor de MÊS, ex.: "set/2026")
- Prazo (opcional, data)
- Peso (0–100) (obrigatório)
- Status: Pendente | Realizado | Não realizado
- % de atingimento: ÚNICO nível onde o número é digitado
NÃO existe status "Em andamento".

CAMPOS DE OBJETIVO ESPECÍFICO (são só estes):
Descrição do Objetivo · Preditor primário · Preditor secundário ·
Agenda temática · % de atingimento (calculado).
O Objetivo Específico NÃO tem análise SWOT. Não desenhe campos
"Oportunidade" nem "Ameaça" — eles não fazem parte do produto.
```

---

## Recorte: tela de Registros

```
REGISTRO e ENCONTRO são entidades diferentes. Não misturar numa lista só.
"Agenda" é o nome da tela, não um tipo de item.

CAMPOS DE REGISTRO:
- Tipo de Registro (obrigatório). Valores possíveis, e só estes:
  Pontapé | Comitê Político | Escuta Diagnóstica | Imersão | Sprint |
  Diagnóstico de Organograma | Proposta de Organograma |
  Monitoramento mensal | Replicação | Legisla Aliada | Mentoria
- Nº sequência (opcional, inteiro)
- Ocorrido em (data, obrigatório, SEM hora)
- Canal (opcional): Sistema | Slack | Presencial
- Resumo (opcional, texto) — o rótulo é "Resumo", não "Descrição"
- Autor (quem lançou) — o rótulo é "Autor", não "Responsável"
NÃO existem os tipos "Diagnóstico", "Planejamento" ou "Encontro".
Não colorir cada tipo com uma cor diferente.

CAMPOS DE ENCONTRO:
- Título (obrigatório)
- Status: Planejado | Realizado | Cancelado | Remarcado
- Data prevista de início (obrigatória quando Planejado)
- Data prevista de fim (opcional)
- Data de realização (obrigatória quando Realizado)
- Modalidade (opcional): Presencial | Online
- Local (opcional)
- Tipo (opcional) — mesma lista de Tipo de Registro
Participantes: ou usuário do sistema OU nome livre de externo, nunca os dois.
Origem do participante: Legisla | Mandato | Externo.

ETAPAS de Estratégia, nesta ordem: Cadastro · Pontapé · Raio-X · Imersão ·
Governança / Organograma · Monitoramento · Replicação.
Status de etapa: Não iniciada | Em andamento | Concluída | Dispensada.
```

---

## Recorte: tela de Fato Gerador / Incidência

```
CAMPOS DE FATO GERADOR:
- A classificação é uma TRIPLA ENCADEADA, com três selects dependentes:
  Grupo > Tipologia > Estado. Não é um chip nem um campo único.
  Os 11 grupos (o número faz parte do nome):
  "1. Planejamento e Agenda" | "2. Produção Legislativa" | "3. Relatoria" |
  "4. Cargos e Espaços de Poder" | "5. Audiências e Eventos Institucionais" |
  "6. Fiscalização e Controle" | "7. Coalizões e Articulação" |
  "8. Frente Parlamentar" | "9. Comunicação e Narrativa" |
  "10. Partido e Estrutura" | "11. Emendas Orçamentárias"
- Nível D1, Nível D2, Nível D3: PREENCHIDOS AUTOMATICAMENTE pela tripla
  escolhida e exibidos como LEITURA, não como campos editáveis.
  A escala tem exatamente 4 pontos nomeados: Baixo | Médio | Alto | Máximo.
  NÃO existe "Nível 5", nem escala numérica, nem percentual.
  NÃO escreva legenda para D1/D2/D3 — as dimensões não têm nome definido.
- Preditor 1 e Preditor 2: também derivados da tripla, exibidos como leitura.
- Contribuição Legisla (0-5, opcional)
- Descrição / evidência (opcional)
- Data de ocorrência (DATA, obrigatória, SEM hora)
- Meta de origem (opcional) e Insight de origem (opcional) — independentes:
  o fato pode ter nenhum, um, ou os dois. "Sem origem" é caso válido e
  não deve parecer erro.
NÃO existe "Ciclo de Vida" no sistema.

IIP: única métrica calculada. Aparece sempre rotulada como PROVISÓRIA.

CAMPOS DE INSIGHT:
- Conteúdo (obrigatório)
- Desdobramentos (opcional) · Comprovação / dados (opcional) · Data (opcional)
- Pilar (opcional), 4 valores:
  "Contexto sociopolítico do mandato" |
  "Incidência política (sugestão, recomendação, direcionamento)" |
  "Desafio/problema do momento (técnico, político, relacional, interno)" |
  "Conquistas e boas práticas"
- Registro de origem · Meta de origem · Sucesso Mensal de origem (opcionais)
```

---

## Recorte: contexto de contrato / mandato

```
- Mandato é o parlamentar apoiado. É um REGISTRO, não um usuário — não tem
  login, não tem avatar de conta.
- Contrato: Status Ativo | Concluído | Não concluído.
- Papéis de acesso: Admin | Gestora | Mentor | Assessor.
  Papel dentro de um contrato: Gestora | Mentor | Assessor | Leitura.
- Nenhum número de gestão ou de impacto é digitado — todos vêm calculados.
```
