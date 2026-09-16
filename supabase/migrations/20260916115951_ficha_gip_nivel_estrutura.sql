-- ficha-mandato-contrato: T5 -- ref_nivel_dimensao_gip, catalogo novo dos
-- descritores de nivel do GIP (A-11, spec.md). So a estrutura; o seed dos 14
-- descritores (Anexo A da spec) entra em T12, depois do re-seed de faixa em
-- T11. Precedente de forma: ref_nivel_iip (design.md, "Data Models").
-- Catalogo ref_* eh GRANT-only, sem RLS (AD-030).

-- Uma linha = o descritor textual de um nivel possivel de uma dimensao do GIP.
CREATE TABLE IF NOT EXISTS ref_nivel_dimensao_gip (
  id_dimensao BIGINT   NOT NULL REFERENCES ref_dimensao_gip(id_dimensao) ON DELETE CASCADE,
  valor       SMALLINT NOT NULL,
  descricao   TEXT     NOT NULL,
  CONSTRAINT pk_nivel_dimensao_gip PRIMARY KEY (id_dimensao, valor)
);

COMMENT ON TABLE ref_nivel_dimensao_gip IS
'Descritor de nivel por dimensao do GIP (Regua dos Sonhos). ref_dimensao_gip so tem a faixa numerica; aqui mora o texto que a metodologia associa a cada nivel dentro da faixa.';
