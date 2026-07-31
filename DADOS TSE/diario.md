# Diário de Bordo - Carga TSE & Desenvolvimento

**Data:** 30/07/2026  
**Projeto:** Sistema Mandatos  
**Ambiente:** Supabase Dev Remoto (`sistema-mandatos-dev`)

---

## 1. Visão Geral do Progresso

Nesta sessão, consolidamos a estratégia de ingestão de dados amostrais do TSE (Tribunal Superior Eleitoral) e alinhamos o progresso com a feature em andamento no projeto.

---

## 2. Feature em Desenvolvimento: Fundação (Entidades & Pessoas)

* **Especificação:** `.specs/features/fundacao-entidades-pessoas/tasks.md`
* **Status Atual:** 
  * Fases de modelagem, migrações base, funções utilitárias e RLS concluídas até a **T19** (suíte de testes de integração com **104/104 testes passando**).
  * Acompanhamento e apoio ao desenvolvimento paralelo realizado pelo outro agente para garantir estabilidade da suíte e idempotência das seeds.
  * Próxima etapa planejada: **T20 (`app.criar_mandato`)**.

---

## 3. Arquitetura & Ingestão dos Dados do TSE

### 🛠️ Materiais de Apoio & Contribuição do Outro Agente
* **Migrations do TSE:** O outro agente aplicou a migration de infraestrutura do TSE (`supabase/migrations/0010_tse_e_candidatura.sql`), criando o schema `tse`, as tabelas relacionais (`dim_candidatura`, `fat_votacao_zona`, `dim_perfil_eleitorado`, `rel_rede_social`) e a view materializada `tse.mv_candidatura_resumo`.
* **Mapeamento de Dados:** Utilização do dicionário em `DADOS TSE/dicionario_de_dados_tse.md` e referências arquiteturais em `docs/schema_sistema.sql`.

### 🚀 Pipeline de Carga Implementado (`DADOS TSE/carga_amostral.js`)
1. **Especificação de Carga:** Criado o documento `DADOS TSE/spec_carga_amostral.md` orientando o depara de colunas, tratamento de datas, boolianos e exclusão de dados sensíveis (ex: CPF).
2. **Desafios de Infraestrutura & Solução:**
   * Devido à ausência de Docker local e restrições de limite de payload (HTTP 502 Bad Gateway no CLI ao tentar enviar arquivos SQL gigantes), implementamos uma estratégia via **API Node.js em batches de 5.000 registros**.
   * Criamos a função RPC helper `public.carrega_tse` no Supabase para permitir inserções diretas em lote via `service_role` com suporte a `ON CONFLICT DO NOTHING`.
   * Ajustamos as permissões de acesso ao schema `app` para que as triggers de auditoria rodassem sem falhas.

3. **Estratégia de Micro-Amostra (Campinas-SP):**
   * Para economizar espaço em disco e acelerar o processamento, mantivemos as **candidaturas de todo o Estado de SP** (2022 e 2024), mas filtramos os fatos de votação e perfil do eleitorado especificamente para o município de **Campinas-SP**.

---

## 4. Resultado da Carga no Banco (Dev Remoto)

A carga foi concluída com sucesso e o script finalizou a execução. Os números atuais no schema `tse` são:

| Tabela / Objeto | Descrição / Filtro | Registros Carregados |
| :--- | :--- | :---: |
| `tse.dim_candidatura` | Candidatos de SP (2022 e 2024) | **82.081** |
| `tse.fat_votacao_zona` | Votação por Zona (Campinas-SP) | **28.028** |
| `tse.dim_perfil_eleitorado` | Perfil Demográfico (Campinas-SP) | **30.350** |
| `tse.mv_candidatura_resumo` | View Materializada (Atualizada) | **82.081** |

---

## 5. Próximos Passos Recomendados

1. **Desenvolvimento da Feature:** Continuar a execução a partir da **T20** (`app.criar_mandato`) na especificação de Fundação.
2. **Consumo no Frontend:** Utilizar as candidaturas e dados de votação de Campinas-SP já disponíveis na view `tse.mv_candidatura_resumo` para alimentar componentes de busca e vinculação de candidaturas.
