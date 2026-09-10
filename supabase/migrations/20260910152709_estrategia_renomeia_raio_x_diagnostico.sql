-- =============================================================================
-- redesenho-estrategia-tela-first: T4 -- a etapa 'raio_x' passa a se chamar
-- "Diagnóstico" (EST-14). Decisão de vocabulário de Pedro, 2026-09-10: a
-- operação já chama a etapa assim, e a tela obrigava tradução mental.
--
-- Correção de CONTEÚDO do dado, não de ESTRUTURA -- mesma natureza de
-- 20260812163617_kanban_etapas_correcao_ref_etapa.sql, e AD-008 continua
-- valendo: o bloco de seed de ref_etapa em docs/schema_sistema.sql é
-- corrigido na mesma mudança, para o modelo aprovado não divergir do banco.
--
-- `codigo` NÃO muda, de propósito. Trocar 'raio_x' quebraria as 4 linhas de
-- seed que o referenciam (ref_tipo_registro 'comite_politico'/
-- 'escuta_diagnostica', ref_formulario 'gip') e a URL
-- /contratos/[id]/etapas/raio_x já existente. A divergência resultante
-- (código diz raio_x, tela diz "Diagnóstico") é aceita e está registrada em
-- design.md -- é a mesma escolha da correção de 20260812163617.
--
-- Escopo: Estratégia e Coalizão, os dois produtos que têm 'raio_x' (a
-- Coalizão clonou a régua da Estratégia em 20260810193825). O PLL não tem
-- essa etapa; o filtro por codigo já o exclui por construção.
--
-- Só UPDATE de ref_etapa.nome: nenhuma linha de ref_tipo_registro,
-- ref_formulario ou fat_etapa_contrato é tocada -- todas referenciam
-- id_etapa, que não muda. EST-14 AC2.
--
-- Idempotente sob `supabase db reset`: filtra por codigo (estável), não pelo
-- nome antigo, então rodar de novo sobre a linha já renomeada é no-op.
-- =============================================================================

UPDATE ref_etapa
   SET nome = 'Diagnóstico'
 WHERE codigo = 'raio_x'
   AND id_produto IN (
     SELECT id_produto FROM ref_produto WHERE nome IN ('Estratégia', 'Coalizão')
   );
