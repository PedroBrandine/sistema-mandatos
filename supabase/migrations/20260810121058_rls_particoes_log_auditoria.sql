-- Declara explicitamente o RLS nas partições de log_auditoria.
--
-- POR QUE ESTA MIGRATION EXISTE
--
-- Hoje quem liga RLS nessas partições é um event trigger da própria plataforma
-- Supabase (`public.ensure_rls` -> `public.rls_auto_enable`), que não está em
-- nenhuma migration porque não é nosso. Resultado prático: o banco real tem
-- RLS nas 19 partições, as migrations não dizem nada sobre isso, e o
-- `db diff` acusava 19 linhas de deriva que ninguém causou.
--
-- Depender de trigger de plataforma para uma garantia de segurança é frágil:
-- se a Supabase mudar esse comportamento, tabela nova em `public` passa a
-- nascer sem RLS e nada aqui avisa. Declarar custa menos que descobrir.
--
-- POR QUE NAS PARTIÇÕES E NÃO SÓ NA TABELA PAI
--
-- As partições ficam em `public`, então o PostgREST as expõe e elas podem ser
-- lidas diretamente, sem passar pelo pai. Consulta ao pai aplica as políticas
-- do pai; consulta à partição aplica as da partição. Sem RLS na partição, o
-- caminho direto ignora `p_log_admin`.
--
-- Não há mudança de comportamento: o trigger da plataforma já havia ligado
-- RLS nas partições existentes. Esta migration passa a dizer isso em arquivo.
-- Partição sem política própria nega tudo, que é o padrão desejado para log
-- de auditoria -- a leitura legítima é pelo pai.

DO $$
DECLARE
  v_particao REGCLASS;
BEGIN
  FOR v_particao IN
    SELECT i.inhrelid::regclass
      FROM pg_inherits i
     WHERE i.inhparent = 'public.log_auditoria'::regclass
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', v_particao);
  END LOOP;
END $$;

-- As partições futuras precisam nascer com RLS pelo mesmo motivo, sem depender
-- do trigger da plataforma. Mesma função da 0008, com o ENABLE no fim do laço.
CREATE OR REPLACE FUNCTION app.cria_particoes_log(p_de DATE, p_meses INT DEFAULT 12)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_ini DATE := date_trunc('month', p_de)::date;
  v_fim DATE;
  v_nome TEXT;
BEGIN
  FOR i IN 0 .. p_meses - 1 LOOP
    v_fim  := (v_ini + INTERVAL '1 month')::date;
    v_nome := format('log_auditoria_%s', to_char(v_ini, 'YYYY_MM'));
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = v_nome) THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF log_auditoria FOR VALUES FROM (%L) TO (%L)',
        v_nome, v_ini, v_fim);
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_nome);
    END IF;
    v_ini := v_fim;
  END LOOP;
END $$;
