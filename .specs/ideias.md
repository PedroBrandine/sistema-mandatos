# Ideias: Modelo Escalonável de Relatório Semanal de Produto

Este documento propõe um modelo estruturado e escalonável para reportar semanalmente os indicadores e o progresso da estratégia do produto aos stakeholders (ex: diretoria/chefia). 

A ideia é que este formato seja **fácil de ler (escaneável)**, **focado em resultados** e **padronizado** para que, no futuro, possa ser automatizado (ex: gerado por uma query no banco de dados ou dashboard no sistema).

---

## 📊 Resumo Executivo (TL;DR)
*Um parágrafo rápido com a principal mensagem da semana. Se o chefe ler apenas isso, ele deve entender o cenário atual.*
- **Status Geral:** 🟢 No Prazo / 🟡 Em Risco / 🔴 Atrasado
- **Destaque da Semana:** (Ex: "Finalizamos o fluxo unificado de cadastro de mandatos e iniciamos a carga de dados do TSE.")

## 🎯 1. Progresso das Etapas (Estratégia)
*Visão macro de como o produto está avançando em relação ao Roadmap estabelecido.*
- **Fase Atual do Roadmap:** (Ex: Fase 1 - Fundação)
- **% Concluído da Fase:** 75%
- **Entregas Relevantes na Semana:**
  - [x] Tarefa crítica 1 concluída
  - [x] Tarefa crítica 2 concluída
- **Bloqueios/Riscos:** (Ex: "Atraso na liberação da API X, mitigado por mock de dados localmente.")

## 🏛️ 2. Status dos Mandatos (Métricas Core)
*Indicadores quantitativos do negócio/produto. Estes números devem ser fáceis de extrair do banco (ex: Supabase).*
- **Total de Mandatos Registrados:** `X` (+ `Y` na semana)
- **Distribuição por Status:**
  - Ativos / Aprovados: `X`
  - Em Análise / Rascunho: `Y`
  - Cancelados / Arquivados: `Z`
- **Contratos Ativos:** `X` (Se aplicável à métrica de faturamento/engajamento).

## 🚀 3. Etapa da Semana (Foco Tático)
*O que o time de desenvolvimento/produto focou durante os últimos dias.*
- **Objetivo da Sprint/Semana:** (Ex: "Estabilizar a UX do Wizard de Cadastro e validar regras cruzadas de cargos/partidos.")
- **Aprendizado/Feedback:** (Ex: "Percebemos que os usuários precisavam de autocompletar no campo de partidos.")

## 📝 4. Últimos Registros (Atividade Recente)
*Uma amostra tangível de que o sistema está vivo e sendo utilizado/populado.*
- **Novos Mandatos:** "Mandato Deputado Estadual SP - Partido X" (Criado em DD/MM)
- **Atualizações Importantes:** "Contrato Y unificado com sucesso."
- *Nota: Pode ser uma tabela com os Top 3-5 registros mais recentes.*

## ⏭️ 5. Próximos Passos (Semana Que Vem)
*Alinhamento de expectativas para a próxima reunião/relatório.*
- [ ] O que será feito 1
- [ ] O que será feito 2

---

## 💡 Como Escalar este Modelo?
1. **Curto Prazo (Manual):** Preencher este Markdown/Template toda sexta-feira e enviar via PDF, E-mail ou Slack.
2. **Médio Prazo (Semi-automático):** Criar uma view `/dashboard` escondida no painel administrativo do "Sistema Mandatos" que traga os números da Seção 2 e 4 em tempo real.
3. **Longo Prazo (Automático):** Configurar um Edge Function no Supabase rodando com Cron Job (ex: `pg_cron`) para compilar esses dados e disparar um e-mail com este formato toda segunda-feira às 08h00.
