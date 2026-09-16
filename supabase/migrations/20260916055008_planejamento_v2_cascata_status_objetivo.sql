-- =============================================================================
-- planejamento-estrategico-v2: T2 -- app.recalcula_atingimento passa a excluir
-- Objetivo não-ativo da média do Planejamento (PLV-02 AC2/AC3/AC4).
--
-- POR QUE ESTA MIGRATION EMENDA UMA DECISÃO ANTERIOR (AD-052).
-- `planejamento-estrategico-redesenho` decidiu explicitamente NÃO tocar em
-- app.recalcula_atingimento: a fórmula veio verbatim do schema aprovado
-- (AD-008) e mexer nela muda número em toda tela que lê
-- dim_planejamento.pct_atingimento (Visão Gerencial, Números de Impacto), não
-- só na de Planejamento. AD-052 supersede aquela decisão, e o motivo é este:
-- a migration anterior (T1) deu status ao Objetivo Específico. Sem o filtro
-- abaixo, pausar ou descartar um Objetivo não teria efeito nenhum sobre o
-- número do plano -- o campo existiria como enfeite, e a Gestora veria um
-- Objetivo "descartado" continuar puxando a média para baixo.
--
-- A assimetria que se corrige aqui já existia e só não doía: o nível 2
-- (Objetivo = média das Metas) sempre filtrou `mm.status = 'ativa'`; o nível
-- raiz (Planejamento = média dos Objetivos) não filtrava nada, porque o
-- Objetivo não tinha status para filtrar. O `AND o.status = 'ativo'` do bloco
-- Raiz é a ÚNICA diferença de fórmula em relação a 20260812145917 -- os
-- níveis 1 e 2 estão reproduzidos verbatim, e um teste de regressão guarda
-- isso (supabase/tests/planejamento/cascata-status-objetivo.integration.test.ts).
--
-- EFEITO COLATERAL ACEITO (AD-052): plano cujos Objetivos estejam TODOS
-- não-ativos passa a ter pct_atingimento NULL -- AVG sobre conjunto vazio é
-- NULL -- em vez de uma média de zeros. A tela exibe '—' (AD-005), que é o
-- correto: não há o que medir, e 0% seria afirmar desempenho zero.
--
-- SECURITY DEFINER REDECLARADO, de propósito: CREATE OR REPLACE FUNCTION zera
-- toda propriedade opcional não declarada no novo texto. A função é SECURITY
-- DEFINER desde 20260812151909 (AD-035) porque escreve em dim_planejamento/
-- fat_meta/fat_objetivo_especifico, onde Mentor e Assessor só têm SELECT;
-- omitir a cláusula aqui a devolveria a INVOKER e quebraria a cascata para
-- esses dois papéis com 42501. Vale o mesmo para SET search_path.
--
-- TRIGGER NOVO (PLV-02 AC3): "Objetivo que passa a não-ativo marca o
-- planejamento como desatualizado". É o espelho exato de
-- app.trg_marca_por_meta_upd (mesma migration de 2026-08-12), que já faz isso
-- quando a Meta muda de status ou de pai. Sem ele, mudar o status do Objetivo
-- mudaria a fórmula mas não avisaria a tela de que o número envelheceu, e a
-- faixa "Recalcular agora" (PLR-04) nunca apareceria.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.recalcula_atingimento(p_id_planejamento BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- Nível 1: Meta = média dos Sucessos Mensais ponderada pelo Peso (VERBATIM)
  UPDATE fat_meta m
     SET pct_atingimento = s.pct
    FROM (SELECT sm.id_meta,
                 CASE WHEN SUM(sm.peso) > 0
                      THEN ROUND(SUM(sm.peso * COALESCE(sm.pct_atingimento, 0)) / SUM(sm.peso), 2)
                 END AS pct
            FROM fat_sucesso_mensal sm
            JOIN fat_meta mm               ON mm.id_meta = sm.id_meta
            JOIN fat_objetivo_especifico oo ON oo.id_objetivo = mm.id_objetivo
           WHERE oo.id_planejamento = p_id_planejamento
           GROUP BY sm.id_meta) s
   WHERE m.id_meta = s.id_meta;

  -- Nível 2: Objetivo Específico = média das Metas ativas (VERBATIM)
  UPDATE fat_objetivo_especifico o
     SET pct_atingimento = t.pct
    FROM (SELECT mm.id_objetivo, ROUND(AVG(COALESCE(mm.pct_atingimento, 0)), 2) AS pct
            FROM fat_meta mm
            JOIN fat_objetivo_especifico oo ON oo.id_objetivo = mm.id_objetivo
           WHERE oo.id_planejamento = p_id_planejamento
             AND mm.status = 'ativa'
           GROUP BY mm.id_objetivo) t
   WHERE o.id_objetivo = t.id_objetivo;

  -- Raiz: Planejamento = média dos Objetivos Específicos ATIVOS (AD-052 -- a
  -- única linha que muda em relação à cascata de 20260812145917)
  UPDATE dim_planejamento p
     SET pct_atingimento = (SELECT ROUND(AVG(COALESCE(o.pct_atingimento, 0)), 2)
                              FROM fat_objetivo_especifico o
                             WHERE o.id_planejamento = p.id_planejamento
                               AND o.status = 'ativo'),
         atingimento_desatualizado = false,
         atualizado_em = now()
   WHERE p.id_planejamento = p_id_planejamento;
END $$;

COMMENT ON FUNCTION app.recalcula_atingimento(BIGINT) IS
'Cascata de atingimento em 3 níveis. Nível raiz considera apenas Objetivos com status=''ativo'' (AD-052): plano com todos os Objetivos não-ativos fica NULL, nunca 0%.';

-- Espelho de app.trg_marca_por_meta_upd para o Objetivo: mudar o status (ou o
-- planejamento de origem) altera a média da raiz, nos dois planejamentos
-- envolvidos quando o Objetivo troca de plano. SECURITY DEFINER pelo mesmo
-- motivo de AD-035 -- escreve dim_planejamento, onde o papel que editou o
-- Objetivo pode não ter UPDATE.
CREATE OR REPLACE FUNCTION app.trg_marca_por_objetivo_upd() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE dim_planejamento p SET atingimento_desatualizado = true
   WHERE p.id_planejamento IN (
     SELECT n.id_planejamento
       FROM objetivos_novos n JOIN objetivos_antigos a ON a.id_objetivo = n.id_objetivo
      WHERE n.status IS DISTINCT FROM a.status OR n.id_planejamento IS DISTINCT FROM a.id_planejamento
      UNION
     SELECT a.id_planejamento
       FROM objetivos_novos n JOIN objetivos_antigos a ON a.id_objetivo = n.id_objetivo
      WHERE n.status IS DISTINCT FROM a.status OR n.id_planejamento IS DISTINCT FROM a.id_planejamento);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_objetivo_upd ON fat_objetivo_especifico;

CREATE TRIGGER trg_objetivo_upd AFTER UPDATE ON fat_objetivo_especifico
  REFERENCING NEW TABLE AS objetivos_novos OLD TABLE AS objetivos_antigos
  FOR EACH STATEMENT EXECUTE FUNCTION app.trg_marca_por_objetivo_upd();
