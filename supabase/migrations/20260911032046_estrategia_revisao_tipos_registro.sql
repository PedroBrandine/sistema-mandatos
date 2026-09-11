-- =============================================================================
-- revisao-tipos-registro (TIP-01/02/03): correção de CONTEÚDO de
-- ref_tipo_registro contra os 10 checklists reais trazidos pela operação
-- (context.md desta feature) -- o seed original (20260810193327) transcrevia
-- literalmente as abas de planilha, sem passar por quem opera. Mesma
-- natureza de 20260812163617 (correção de conteúdo, não de estrutura):
-- nenhuma coluna, constraint ou índice muda.
--
-- Dependências mapeadas ANTES de escrever (context.md "Mapa de dependências"):
--   - fat_registro.id_tipo_registro: 4 linhas, nenhuma nos tipos tocados
--     por nome (comite_politico=1, escuta_diagnostica=1, imersao=1,
--     monitoramento=1) -- o UPDATE de nome não reatribui nenhuma FK.
--   - fat_encontro.id_tipo_registro: 0 linhas na tabela inteira.
--   - codigo NÃO muda em nenhuma linha -- é referenciado por 7 arquivos de
--     teste de integração como fixture (`codigo = 'monitoramento'`).
--
-- Só UPDATE de nome/ativo: nenhuma linha de fat_registro, fat_encontro,
-- ref_etapa ou ref_formulario é tocada.
--
-- Idempotente sob `supabase db reset`: filtra por codigo (estável), não pelo
-- nome antigo -- rodar de novo sobre a linha já corrigida é no-op.
-- =============================================================================

-- TIP-01: 'sprint' -- a operação chama de "Reunião Semanal - Governança".
UPDATE ref_tipo_registro tr
   SET nome = 'Reunião Semanal'
  FROM ref_etapa e, ref_produto p
 WHERE tr.id_etapa = e.id_etapa
   AND e.id_produto = p.id_produto
   AND p.nome = 'Estratégia'
   AND tr.codigo = 'sprint';

-- TIP-02: 'monitoramento' -- a operação chama só de "Monitoramento".
UPDATE ref_tipo_registro tr
   SET nome = 'Monitoramento'
  FROM ref_etapa e, ref_produto p
 WHERE tr.id_etapa = e.id_etapa
   AND e.id_produto = p.id_produto
   AND p.nome = 'Estratégia'
   AND tr.codigo = 'monitoramento';

-- TIP-03: 'organograma' ("Proposta de Organograma") não aparece em nenhum dos
-- 10 checklists -- descartado. ativo=false preserva a linha e o codigo;
-- nunca DELETE (AD-005, e FK de fat_registro é NOT NULL sem ON DELETE).
UPDATE ref_tipo_registro tr
   SET ativo = false
  FROM ref_etapa e, ref_produto p
 WHERE tr.id_etapa = e.id_etapa
   AND e.id_produto = p.id_produto
   AND p.nome = 'Estratégia'
   AND tr.codigo = 'organograma';
