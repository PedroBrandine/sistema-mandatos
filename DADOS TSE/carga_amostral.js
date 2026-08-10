import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import iconv from 'iconv-lite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Credenciais vêm do .env.local (gitignorado) -- nunca hardcoded.
// A service_role ignora RLS por completo; commitá-la dá acesso total ao banco
// a qualquer pessoa com acesso ao repositório, e o histórico do git preserva
// a chave mesmo depois de removida do arquivo.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.\n' +
    'Defina-as no .env.local da raiz do projeto antes de rodar a carga.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BASE_DIR = 'C:\\Users\\brand\\Downloads\\Dados TSE 22 e 24';
const UF_ALVO = 'SP';
const BATCH_SIZE = 5000;

function parseDate(d) {
  if (!d || d === '#NULO#' || d === '#NE' || d === '') return null;
  const parts = d.split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return d;
}

function parseBool(val) {
  if (val === 'S') return true;
  if (val === 'N') return false;
  return null;
}

async function insertBatch(tableName, rows) {
  if (rows.length === 0) return;
  const { error } = await supabase.rpc('carrega_tse', {
    tabela: tableName,
    dados: rows
  });
  if (error) {
    console.error(`Erro no batch de ${tableName}:`, error.message);
  }
}

async function processFile(filePath, tableName, colsMap, transformFn, filterFn) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Arquivo não encontrado: ${filePath}`);
    return;
  }
  console.log(`\nIniciando ${path.basename(filePath)} -> tse.${tableName}...`);

  return new Promise((resolve, reject) => {
    let batch = [];
    let inserted = 0;

    const stream = fs.createReadStream(filePath)
      .pipe(iconv.decodeStream('latin1'))
      .pipe(csv({ separator: ';', quote: '"' }));

    stream.on('data', async (row) => {
      // Custom Filter
      if (filterFn && !filterFn(row)) return;

      const mappedRow = {};
      
      for (const [csvCol, dbCol] of Object.entries(colsMap)) {
        let val = row[csvCol];
        if (val === '#NULO#' || val === '#NE' || val === '' || val === undefined) {
          val = null;
        }
        mappedRow[dbCol] = val;
      }

      if (transformFn) {
        transformFn(mappedRow, row);
      }
      
      mappedRow['carregado_em'] = new Date().toISOString();

      batch.push(mappedRow);

      if (batch.length >= BATCH_SIZE) {
        stream.pause();
        const currentBatch = [...batch];
        batch = [];
        await insertBatch(tableName, currentBatch);
        inserted += currentBatch.length;
        process.stdout.write(`\rInseridos: ${inserted}...`);
        stream.resume();
      }
    });

    stream.on('end', async () => {
      if (batch.length > 0) {
        await insertBatch(tableName, batch);
        inserted += batch.length;
      }
      console.log(`\nConcluído ${tableName}: ${inserted} registros filtrados por ${UF_ALVO}.`);
      resolve();
    });

    stream.on('error', reject);
  });
}

async function run() {
  console.log('Conectado ao Supabase (Dev Remoto)!');

  // 1. CANDIDATURA
  const candMap = {
    'ANO_ELEICAO': 'ano_eleicao',
    'SQ_CANDIDATO': 'sq_candidato',
    'NR_TURNO': 'nr_turno',
    'CD_ELEICAO': 'cd_eleicao',
    'DS_ELEICAO': 'ds_eleicao',
    'NR_TITULO_ELEITORAL_CANDIDATO': 'nr_titulo_eleitoral',
    'NM_CANDIDATO': 'nm_candidato',
    'NM_URNA_CANDIDATO': 'nm_urna',
    'NM_SOCIAL_CANDIDATO': 'nm_social',
    'SG_UF': 'sg_uf',
    'SG_UE': 'sg_ue',
    'NM_UE': 'nm_ue',
    'CD_CARGO': 'cd_cargo',
    'DS_CARGO': 'ds_cargo',
    'NR_PARTIDO': 'nr_partido',
    'SG_PARTIDO': 'sg_partido',
    'SG_FEDERACAO': 'sg_federacao',
    'NM_COLIGACAO': 'nm_coligacao',
    'DT_NASCIMENTO': 'dt_nascimento',
    'DS_GENERO': 'ds_genero',
    'DS_COR_RACA': 'ds_cor_raca',
    'DS_GRAU_INSTRUCAO': 'ds_grau_instrucao',
    'DS_OCUPACAO': 'ds_ocupacao',
    'DS_SITUACAO_CANDIDATURA': 'ds_situacao_candidatura',
    'DS_SIT_TOT_TURNO': 'ds_sit_tot_turno'
  };

  const candTransform = (m) => { m.dt_nascimento = parseDate(m.dt_nascimento); };
  const filterSP = (row) => row['SG_UF'] === UF_ALVO;
  const filterCampinas = (row) => row['SG_UF'] === UF_ALVO && row['NM_MUNICIPIO'] === 'CAMPINAS';

  // AD-031/CMU-14 AC5: restringe a carga futura aos 4 cargos do Legislativo
  // (Vereador, Dep. Estadual, Dep. Federal, Senador) -- mesmos códigos de
  // tse.dim_candidatura.cd_cargo já usados pela migration 0022/0026. Sem
  // este filtro, uma nova safra do TSE reintroduziria Executivo em silêncio.
  // Só se aplica a arquivos que têm CD_CARGO na origem (consulta_cand e
  // votacao_candidato_munzona); perfil_eleitorado é agregado por
  // município/zona, sem cargo, e continua com filterCampinas sem alteração
  // (mesmo escopo da migration 0022, que nunca tocou dim_perfil_eleitorado).
  const CARGOS_LEGISLATIVO = ['5', '6', '7', '13'];
  const isCargoLegislativo = (row) => CARGOS_LEGISLATIVO.includes(String(row['CD_CARGO']).trim());
  const filterCandidaturaLegislativo = (row) => filterSP(row) && isCargoLegislativo(row);
  const filterVotacaoLegislativo = (row) => filterCampinas(row) && isCargoLegislativo(row);

  await processFile(path.join(BASE_DIR, 'consulta_cand_2022', 'consulta_cand_2022_BRASIL.csv'), 'dim_candidatura', candMap, candTransform, filterCandidaturaLegislativo);
  await processFile(path.join(BASE_DIR, 'consulta_cand_2024', 'consulta_cand_2024_BRASIL.csv'), 'dim_candidatura', candMap, candTransform, filterCandidaturaLegislativo);

  // 2. VOTAÇÃO ZONA
  const votMap = {
    'ANO_ELEICAO': 'ano_eleicao',
    'CD_ELEICAO': 'cd_eleicao',
    'NR_TURNO': 'nr_turno',
    'SQ_CANDIDATO': 'sq_candidato',
    'CD_MUNICIPIO': 'cd_municipio',
    'NM_MUNICIPIO': 'nm_municipio',
    'NR_ZONA': 'nr_zona',
    'ST_VOTO_EM_TRANSITO': 'st_voto_em_transito',
    'QT_VOTOS_NOMINAIS': 'qt_votos_nominais',
    'QT_VOTOS_NOMINAIS_VALIDOS': 'qt_votos_nominais_validos',
    'DS_SIT_TOT_TURNO': 'ds_sit_tot_turno'
  };
  const votTransform = (m) => { m.st_voto_em_transito = parseBool(m.st_voto_em_transito); };

  await processFile(path.join(BASE_DIR, 'votacao_candidato_munzona_2022', 'votacao_candidato_munzona_2022_BRASIL.csv'), 'fat_votacao_zona', votMap, votTransform, filterVotacaoLegislativo);
  await processFile(path.join(BASE_DIR, 'votacao_candidato_munzona_2024', 'votacao_candidato_munzona_2024_BRASIL.csv'), 'fat_votacao_zona', votMap, votTransform, filterVotacaoLegislativo);

  // 3. PERFIL ELEITORADO
  const perfMap = {
    'AA_ELEICAO': 'ano_eleicao',
    'SG_UF': 'sg_uf',
    'CD_MUNICIPIO': 'cd_municipio',
    'NM_MUNICIPIO': 'nm_municipio',
    'NR_ZONA': 'nr_zona',
    'DS_GENERO': 'ds_genero',
    'DS_ESTADO_CIVIL': 'ds_estado_civil',
    'DS_FAIXA_ETARIA': 'ds_faixa_etaria',
    'DS_GRAU_ESCOLARIDADE': 'ds_grau_escolaridade',
    'DS_RACA_COR': 'ds_raca_cor',
    'DS_IDENTIDADE_GENERO': 'ds_identidade_genero',
    'DS_QUILOMBOLA': 'ds_quilombola',
    'DS_INTERPRETE_LIBRAS': 'ds_interprete_libras',
    'QT_ELEITORES': 'qt_eleitores',
    'QT_ELEITORES_DEFICIENCIA': 'qt_eleitores_deficiencia'
  };
  await processFile(path.join(BASE_DIR, 'perfil_eleitorado_2022', 'perfil_eleitorado_2022_BRASIL.csv'), 'dim_perfil_eleitorado', perfMap, null, filterCampinas);
  await processFile(path.join(BASE_DIR, 'perfil_eleitorado_2024', 'perfil_eleitorado_2024_BRASIL.csv'), 'dim_perfil_eleitorado', perfMap, null, filterCampinas);

  // 4. REDE SOCIAL 2024
  const redeMap = {
    'SQ_CANDIDATO': 'sq_candidato',
    'NR_ORDEM_REDE_SOCIAL': 'nr_ordem_rede_social',
    'AA_ELEICAO': 'ano_eleicao',
    'DS_URL': 'ds_url'
  };
  await processFile(path.join(BASE_DIR, 'rede_social_candidato_2024 (2)', 'rede_social_candidato_2024_BRASIL.csv'), 'rel_rede_social', redeMap, null, filterSP);

  console.log('Finalizado com sucesso! Carga de micro-amostra enviada via API.');
}

run().catch(console.error);
