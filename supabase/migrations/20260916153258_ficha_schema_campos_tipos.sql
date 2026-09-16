-- ficha-mandato-contrato: T13 -- declara a camada dinâmica dos 9 tipos de
-- registro de Estratégia (Anexo C de spec.md, fonte: os 10 checklists reais
-- da operação, Bloco A de
-- .specs/features/revisao-tipos-registro/context.md) e acrescenta
-- qtd_prevista = 4 em sprint. Fecha FMC-16 e FMC-34.
--
-- Contrato de schema_campos (design.md, "Contrato de
-- ref_tipo_registro.schema_campos"): {"versao": 1, "campos": [...]}, cada
-- item com "chave"/"rotulo"/"tipo" e, quando tipo="link", "artefato_tipo"
-- (valor do ck_artefato_tipo, provisionado em T2). Tipos sem campo extra
-- ficam com "campos": [] -- DECLARADO vazio, distinto do default '{}' (não
-- declarado) que organograma mantém (B-02, ativo=false, fora de escopo,
-- TIP-03 não desfeita).
--
-- 1 | Pontapé · Pontapé -- Termo de Compromisso → termo_assinado
UPDATE ref_tipo_registro SET schema_campos = '{
  "versao": 1,
  "campos": [
    { "chave": "termo_assinado", "rotulo": "Termo de Compromisso", "tipo": "link", "artefato_tipo": "termo_assinado" }
  ]
}'::jsonb WHERE codigo = 'pontape';

-- 3 | Diagnóstico · Comitê Político -- Mapa Político → mapa_politico
UPDATE ref_tipo_registro SET schema_campos = '{
  "versao": 1,
  "campos": [
    { "chave": "mapa_politico", "rotulo": "Mapa Político", "tipo": "link", "artefato_tipo": "mapa_politico" }
  ]
}'::jsonb WHERE codigo = 'comite_politico';

-- 4 | Diagnóstico · Escuta Diagnóstica -- Escuta Diagnóstica → escuta_diagnostica
UPDATE ref_tipo_registro SET schema_campos = '{
  "versao": 1,
  "campos": [
    { "chave": "escuta_diagnostica", "rotulo": "Escuta Diagnóstica", "tipo": "link", "artefato_tipo": "escuta_diagnostica" }
  ]
}'::jsonb WHERE codigo = 'escuta_diagnostica';

-- 8 | Imersão · Imersão -- Local (leitura, de fat_encontro.local) + Cronograma,
-- Pré-planejamento, Mural, Planilha de monitoramento (A-19, cai em 'outro'),
-- Fotos (arquivo, em_desenvolvimento -- FMC-22, out of scope de upload)
UPDATE ref_tipo_registro SET schema_campos = '{
  "versao": 1,
  "campos": [
    { "chave": "local", "rotulo": "Local", "tipo": "leitura_encontro", "origem": "local" },
    { "chave": "cronograma", "rotulo": "Cronograma", "tipo": "link", "artefato_tipo": "cronograma" },
    { "chave": "pre_planejamento", "rotulo": "Pré-planejamento", "tipo": "link", "artefato_tipo": "pre_planejamento" },
    { "chave": "mural", "rotulo": "Mural", "tipo": "link", "artefato_tipo": "mural" },
    { "chave": "planilha_monitoramento", "rotulo": "Planilha de monitoramento", "tipo": "link", "artefato_tipo": "outro" },
    { "chave": "fotos", "rotulo": "Fotos", "tipo": "arquivo", "artefato_tipo": "foto", "estado": "em_desenvolvimento" }
  ]
}'::jsonb WHERE codigo = 'imersao';

-- 6 | Governança · Reunião Semanal -- nenhum campo extra
UPDATE ref_tipo_registro SET schema_campos = '{"versao": 1, "campos": []}'::jsonb
 WHERE codigo = 'sprint';

-- 9 | Governança · Diagnóstico de Organograma -- Adequações a serem
-- realizadas (texto longo) + Organograma → organograma
UPDATE ref_tipo_registro SET schema_campos = '{
  "versao": 1,
  "campos": [
    { "chave": "adequacoes", "rotulo": "Adequações a serem realizadas", "tipo": "texto_longo", "obrigatorio": false },
    { "chave": "organograma", "rotulo": "Organograma", "tipo": "link", "artefato_tipo": "organograma" }
  ]
}'::jsonb WHERE codigo = 'diagnostico_organograma';

-- 10 | Monitoramento · Monitoramento -- nenhum campo extra
UPDATE ref_tipo_registro SET schema_campos = '{"versao": 1, "campos": []}'::jsonb
 WHERE codigo = 'monitoramento';

-- 2 | Monitoramento · Legisla Aliada -- nenhum campo extra (A-08: registro
-- retroativo sem encontro, sempre este tipo)
UPDATE ref_tipo_registro SET schema_campos = '{"versao": 1, "campos": []}'::jsonb
 WHERE codigo = 'legisla_aliada';

-- 7 | Replicação · Replicação -- Material Compartilhado → material_replicacao
UPDATE ref_tipo_registro SET schema_campos = '{
  "versao": 1,
  "campos": [
    { "chave": "material_replicacao", "rotulo": "Material Compartilhado", "tipo": "link", "artefato_tipo": "material_replicacao" }
  ]
}'::jsonb WHERE codigo = 'replicacao';

-- organograma (Proposta de Organograma) NÃO é seedado -- B-02, permanece
-- ativo=false (TIP-03) e schema_campos no default '{}' (não declarado).

-- FMC-34: sprint.qtd_prevista = 4 (nome 'Reunião Semanal' já veio de TIP-01,
-- migration 20260911032046 -- esta migration só acrescenta o denominador da
-- sequência "nº X de 4"). permite_multiplos já é true para sprint
-- (ck_tipo_registro_qtd exige isso quando qtd_prevista não é nulo).
UPDATE ref_tipo_registro SET qtd_prevista = 4 WHERE codigo = 'sprint';
