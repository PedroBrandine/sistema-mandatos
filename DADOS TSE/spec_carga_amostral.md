# 📄 Spec: Pipeline de Carga Amostral TSE (2022 e 2024)

## 1. Objetivo
Criar um pipeline isolado (script em Node.js ou Python) para extrair uma amostra representativa de dados do TSE referentes aos anos de 2022 e 2024. O script deve ler os CSVs locais originais, filtrar uma pequena parcela dos dados (ex: uma UF ou município específico), mapear as colunas conforme a arquitetura do banco e inserir no banco Supabase local/dev. Tudo de forma leve, usando *streams* para não comprometer a memória ou as tarefas paralelas.

---

## 2. Origem dos Dados (Raw)
**Diretório Fonte:** `C:\Users\brand\Downloads\Dados TSE 22 e 24`

**Arquivos necessários na origem:**
- `consulta_cand_2022_*.csv` e `consulta_cand_2024_*.csv`
- `votacao_candidato_munzona_2022_*.csv` e `votacao_candidato_munzona_2024_*.csv`
- `perfil_eleitorado_2022_*.csv` e `perfil_eleitorado_2024_*.csv`
- `rede_social_candidato_2024_*.csv`

---

## 3. Preparação da Amostra (Extração e Filtro)
Para evitar a carga de gigabytes no ambiente de desenvolvimento:
1. **Definição do Filtro:** Escolher uma UF (Ex: `SG_UF = 'DF'` ou `'SP'`) e/ou um município alvo (`CD_MUNICIPIO`).
2. **Processamento em Stream:** O script lerá os CSVs grandes linha por linha.
3. **Arquivos Intermediários (Staging):** Gravar os registros filtrados em uma pasta temporária do projeto (ex: `.temp/tse_amostra/`) no formato `.json` ou CSV reduzido, já prontos para o banco.

---

## 4. Mapeamento da Arquitetura (Transformação / Depara)

O script deve renomear as chaves para corresponder exatamente às colunas DDL da migração `0010_tse_e_candidatura.sql`.

### 4.1. Tabela `tse.dim_candidatura`
> **Nota:** Descartar a coluna `NR_CPF_CANDIDATO`.

| Coluna Original (CSV) | Coluna Destino (Supabase) | Tipo |
| :--- | :--- | :--- |
| `ANO_ELEICAO` | `ano_eleicao` | `SMALLINT` |
| `SQ_CANDIDATO` | `sq_candidato` | `BIGINT` |
| `NR_TURNO` | `nr_turno` | `SMALLINT` |
| `CD_ELEICAO` | `cd_eleicao` | `INTEGER` |
| `DS_ELEICAO` | `ds_eleicao` | `TEXT` |
| `NR_TITULO_ELEITORAL_CANDIDATO` | `nr_titulo_eleitoral` | `TEXT` |
| `NM_CANDIDATO` | `nm_candidato` | `TEXT` |
| `NM_URNA_CANDIDATO` | `nm_urna` | `TEXT` |
| `NM_SOCIAL_CANDIDATO` | `nm_social` | `TEXT` |
| `SG_UF` | `sg_uf` | `CHAR(2)` |
| `SG_UE` | `sg_ue` | `TEXT` |
| `NM_UE` | `nm_ue` | `TEXT` |
| `CD_CARGO` | `cd_cargo` | `INTEGER` |
| `DS_CARGO` | `ds_cargo` | `TEXT` |
| `NR_PARTIDO` | `nr_partido` | `SMALLINT` |
| `SG_PARTIDO` | `sg_partido` | `TEXT` |
| `SG_FEDERACAO` | `sg_federacao` | `TEXT` |
| `NM_COLIGACAO` | `nm_coligacao` | `TEXT` |
| `DT_NASCIMENTO` | `dt_nascimento` | `DATE` |
| `DS_GENERO` | `ds_genero` | `TEXT` |
| `DS_COR_RACA` | `ds_cor_raca` | `TEXT` |
| `DS_GRAU_INSTRUCAO` | `ds_grau_instrucao` | `TEXT` |
| `DS_OCUPACAO` | `ds_ocupacao` | `TEXT` |
| `DS_SITUACAO_CANDIDATURA` | `ds_situacao_candidatura` | `TEXT` |
| `DS_SIT_TOT_TURNO` | `ds_sit_tot_turno` | `TEXT` |

### 4.2. Tabela `tse.fat_votacao_zona`
| Coluna Original (CSV) | Coluna Destino (Supabase) | Tipo |
| :--- | :--- | :--- |
| `ANO_ELEICAO` | `ano_eleicao` | `SMALLINT` |
| `CD_ELEICAO` | `cd_eleicao` | `INTEGER` |
| `NR_TURNO` | `nr_turno` | `SMALLINT` |
| `SQ_CANDIDATO` | `sq_candidato` | `BIGINT` |
| `CD_MUNICIPIO` | `cd_municipio` | `INTEGER` |
| `NM_MUNICIPIO` | `nm_municipio` | `TEXT` |
| `NR_ZONA` | `nr_zona` | `INTEGER` |
| `ST_VOTO_EM_TRANSITO` | `st_voto_em_transito` | `BOOLEAN` (S=true, N=false) |
| `QT_VOTOS_NOMINAIS` | `qt_votos_nominais` | `INTEGER` |
| `QT_VOTOS_NOMINAIS_VALIDOS` | `qt_votos_nominais_validos` | `INTEGER` |
| `DS_SIT_TOT_TURNO` | `ds_sit_tot_turno` | `TEXT` |

### 4.3. Tabela `tse.dim_perfil_eleitorado`
> **Atenção aos nomes divergentes na origem:** Ex: `AA_ELEICAO`.

| Coluna Original (CSV) | Coluna Destino (Supabase) | Tipo |
| :--- | :--- | :--- |
| `AA_ELEICAO` | `ano_eleicao` | `SMALLINT` |
| `SG_UF` | `sg_uf` | `CHAR(2)` |
| `CD_MUNICIPIO` | `cd_municipio` | `INTEGER` |
| `NM_MUNICIPIO` | `nm_municipio` | `TEXT` |
| `NR_ZONA` | `nr_zona` | `INTEGER` |
| `DS_GENERO` | `ds_genero` | `TEXT` |
| `DS_ESTADO_CIVIL` | `ds_estado_civil` | `TEXT` |
| `DS_FAIXA_ETARIA` | `ds_faixa_etaria` | `TEXT` |
| `DS_GRAU_ESCOLARIDADE`| `ds_grau_escolaridade` | `TEXT` |
| `DS_RACA_COR` | `ds_raca_cor` | `TEXT` |
| `DS_IDENTIDADE_GENERO`| `ds_identidade_genero` | `TEXT` |
| `DS_QUILOMBOLA` | `ds_quilombola` | `TEXT` |
| `DS_INTERPRETE_LIBRAS`| `ds_interprete_libras` | `TEXT` |
| `QT_ELEITORES` | `qt_eleitores` | `INTEGER` |
| `QT_ELEITORES_DEFICIENCIA` | `qt_eleitores_deficiencia` | `INTEGER` |

### 4.4. Tabela `tse.rel_rede_social` (Somente 2024)
| Coluna Original (CSV) | Coluna Destino (Supabase) | Tipo |
| :--- | :--- | :--- |
| `SQ_CANDIDATO` | `sq_candidato` | `BIGINT` |
| `NR_ORDEM_REDE_SOCIAL` | `nr_ordem_rede_social` | `SMALLINT` |
| `AA_ELEICAO` | `ano_eleicao` | `SMALLINT` |
| `DS_URL` | `ds_url` | `TEXT` |

---

## 5. Ordem Execução da Carga (Ingestão)
Para não quebrar a integridade relacional, o script inserirá os dados via `supabase-js` ou `pg` seguindo exatamente esta ordem:

1. **`tse.dim_candidatura`** (Insere 2022 e 2024)
2. **`tse.fat_votacao_zona`** (Insere 2022 e 2024)
3. **`tse.dim_perfil_eleitorado`** (Insere 2022 e 2024)
4. **`tse.rel_rede_social`** (Insere apenas 2024)

---

## 6. Pós-Carga (Materialized View)
A última instrução do pipeline executará uma query SQL bruta no Supabase local para atualizar a visualização materializada principal da aplicação:

```sql
REFRESH MATERIALIZED VIEW tse.mv_candidatura_resumo;
```
