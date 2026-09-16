-- ficha-mandato-contrato: T11 -- re-seed de ref_dimensao_gip: renomeia as 4
-- dimensões e muda a faixa de 1-4 para 0-3 (dimensões 1-2) / 0-2 (dimensões
-- 3-4), conforme o Anexo A de spec.md (metodologia vigente, verbatim de
-- Pedro, 2026-09-15). Fecha FMC-23 (A-12).
--
-- Guarda de falha alta (Risks & Concerns do design.md, A-12): se qualquer
-- linha já existir em fat_gip_dimensao, o valor antigo (faixa 1-4) passaria a
-- significar outro nível sob a faixa nova (0-3/0-2) -- silenciosamente errado.
-- Por isso a migration ABORTA com RAISE EXCEPTION em vez de reinterpretar.
-- Confirmado por consulta direta ao dev ANTES de escrever este arquivo:
-- `SELECT count(*) FROM fat_gip_dimensao` = 0 (nenhuma linha gravada hoje;
-- produção também não tem GIP preenchido -- a superfície é recente).
--
-- `codigo` NÃO muda -- é o que app.trg_deriva_gip (formulario-gip-form) e os
-- testes de integração já existentes referenciam para gravar/consultar cada
-- dimensão. Só `nome`, `valor_min` e `valor_max` mudam; `ordem` permanece a
-- mesma (1..4), já que a ordem das 4 linhas hoje já bate posicionalmente com
-- a ordem do Anexo A.
DO $$
DECLARE v_count BIGINT;
BEGIN
  SELECT count(*) INTO v_count FROM fat_gip_dimensao;
  IF v_count > 0 THEN
    RAISE EXCEPTION
      'fat_gip_dimensao tem % linha(s) gravada(s) -- reseed de ref_dimensao_gip abortado para não reinterpretar valor antigo (faixa 1-4) sob a faixa nova (0-3/0-2) em silêncio (A-12, ficha-mandato-contrato T11)',
      v_count;
  END IF;
END $$;

UPDATE ref_dimensao_gip SET
  nome = 'Performance dos objetivos específicos atrelados aos preditores prioritários',
  valor_min = 0, valor_max = 3
WHERE codigo = 'qualidade_planejamento';

UPDATE ref_dimensao_gip SET
  nome = 'Monitoramento e atingimento do planejamento',
  valor_min = 0, valor_max = 3
WHERE codigo = 'atingimento_planejamento';

UPDATE ref_dimensao_gip SET
  nome = 'Capacidade de gestão',
  valor_min = 0, valor_max = 2
WHERE codigo = 'capacidade_gestao';

UPDATE ref_dimensao_gip SET
  nome = 'Capacidade de absorção de incidência política',
  valor_min = 0, valor_max = 2
WHERE codigo = 'autonomia_metodologia';
