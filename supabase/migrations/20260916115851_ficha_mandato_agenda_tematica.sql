-- ficha-mandato-contrato: T4 -- rel_mandato_agenda_tematica, vinculo novo
-- entre dim_mandato e ref_agenda_tematica (design.md, "Data Models"). PK
-- composta resolve FMC-07 AC5: a segunda gravacao do mesmo par eh rejeitada
-- pelo banco, nunca por checagem no cliente. RLS fica para T7 (AD-001).

-- Uma linha = um tema (ref_agenda_tematica) vinculado a um mandato.
CREATE TABLE IF NOT EXISTS rel_mandato_agenda_tematica (
  id_mandato BIGINT NOT NULL REFERENCES dim_mandato(id_mandato) ON DELETE CASCADE,
  id_agenda  BIGINT NOT NULL REFERENCES ref_agenda_tematica(id_agenda),
  CONSTRAINT pk_mandato_agenda PRIMARY KEY (id_mandato, id_agenda)
);

COMMENT ON TABLE rel_mandato_agenda_tematica IS
'Áreas temáticas do mandato (FMC-07). PK composta em vez de checagem no cliente: o mesmo tema vinculado duas vezes ao mesmo mandato é rejeitado pelo banco.';
