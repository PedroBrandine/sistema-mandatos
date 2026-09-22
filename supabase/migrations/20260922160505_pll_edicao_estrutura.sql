-- Sessão ao vivo com Pedro (22/09): tela Participantes do PLL precisa de uma
-- "edição" própria -- nome, data de início, projeto/temática de origem
-- (ref_projeto, ex. "Bancada do Clima") e um pool de mentores padrão. Hoje
-- fat_cadastro_participante usa id_projeto como se fosse "edição" (comentário
-- em 20260922072328), mas Pedro deixou claro que projeto e edição são coisas
-- diferentes: uma edição TEM um projeto, não é um.
--
-- Nome sem sufixo `_pll` (AD-012): "edição" é conceito genérico (turma/ciclo
-- de um produto), discriminado por id_produto -- mesmo padrão de
-- fat_cadastro_participante e fat_registro.

CREATE TABLE IF NOT EXISTS fat_edicao (
  id_edicao      BIGSERIAL PRIMARY KEY,
  id_produto     BIGINT NOT NULL REFERENCES ref_produto(id_produto),
  id_projeto     BIGINT NOT NULL REFERENCES ref_projeto(id_projeto),
  nome           texto_limpo NOT NULL,
  dt_inicio      DATE NOT NULL,
  dt_fim         DATE,
  ativo          BOOLEAN NOT NULL DEFAULT true,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por     BIGINT REFERENCES dim_usuario(id_usuario),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_edicao_periodo CHECK (dt_fim IS NULL OR dt_fim >= dt_inicio)
);

COMMENT ON TABLE fat_edicao IS
'Uma edição/turma de um produto (ex.: PLL) -- nome, período e projeto/temática de origem. Não confundir com ref_projeto: a edição TEM um projeto, não é um.';

-- Pool de mentores padrão da edição (Pedro, sessão 22/09): aplicado a cada
-- contrato criado sob esta edição no momento do vínculo TSE
-- (app.criar_mandato, p_mentores_padrao -- ver migration de RPC), não um
-- vínculo direto em rel_usuario_contrato (que exige id_contrato, inexistente
-- até o vínculo TSE acontecer).
CREATE TABLE IF NOT EXISTS rel_edicao_mentor (
  id_edicao   BIGINT NOT NULL REFERENCES fat_edicao(id_edicao) ON DELETE CASCADE,
  id_usuario  BIGINT NOT NULL REFERENCES dim_usuario(id_usuario),
  PRIMARY KEY (id_edicao, id_usuario)
);

COMMENT ON TABLE rel_edicao_mentor IS
'Pool de mentores padrão de uma edição. Aplicado a cada contrato criado sob a edição via app.criar_mandato(p_mentores_padrao) no momento do vínculo TSE.';
