// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, FMC-16 (P1 Registro
// AC4/AC5); design.md "Contrato de ref_tipo_registro.schema_campos" e componente
// `parseSchemaCampos` (estratégia AD-042: função pura, testada sem precisar de render).
//
// Lê o JSONB de `ref_tipo_registro.schema_campos` e devolve os campos tipados que o
// renderer (`CamadaDinamica`, T30) sabe desenhar. Nunca lança -- campo de tipo
// desconhecido, `versao` diferente de 1, JSON malformado, `null` e `{}` todos
// resolvem em lista vazia (mais um registro em `ignorados` quando há algo a apontar),
// nunca em exceção (edge case da spec.md).

const TIPOS_CAMPO_DINAMICO = [
  "texto_curto",
  "texto_longo",
  "link",
  "leitura_encontro",
  "arquivo",
] as const;

export type TipoCampoDinamico = (typeof TIPOS_CAMPO_DINAMICO)[number];

export interface CampoDinamico {
  chave: string;
  rotulo: string;
  tipo: TipoCampoDinamico;
  obrigatorio?: boolean;
  /** Presente em campos `tipo: "link"` (e `"arquivo"`) -- ck_artefato_tipo do enum. */
  artefatoTipo?: string;
  /** Presente em campos `tipo: "leitura_encontro"` -- chave lida de fat_encontro. */
  origem?: string;
  /** Ex.: "em_desenvolvimento" -- ver FMC-22 (bloco de fotos). */
  estado?: string;
}

export interface ResultadoParseSchemaCampos {
  campos: CampoDinamico[];
  ignorados: string[];
}

const VAZIO: ResultadoParseSchemaCampos = { campos: [], ignorados: [] };

function ehTipoConhecido(valor: unknown): valor is TipoCampoDinamico {
  return typeof valor === "string" && (TIPOS_CAMPO_DINAMICO as readonly string[]).includes(valor);
}

function normalizaEntrada(json: unknown): Record<string, unknown> | null {
  let valor: unknown = json;

  // JSON malformado: string que não é um `{"versao":...}` válido -- nunca lança,
  // resolve como se nada tivesse sido declarado.
  if (typeof valor === "string") {
    try {
      valor = JSON.parse(valor);
    } catch {
      return null;
    }
  }

  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    return null;
  }

  return valor as Record<string, unknown>;
}

/**
 * Valida e tipa o JSONB de `schema_campos`, descartando todo campo de tipo
 * desconhecido em vez de quebrar o formulário (design.md, Data Models).
 */
export function parseSchemaCampos(json: unknown): ResultadoParseSchemaCampos {
  const bruto = normalizaEntrada(json);
  if (bruto === null) return VAZIO;

  // `{}` (nenhum campo declarado, nem `versao`) é "nada foi declarado ainda" --
  // resolve como VAZIO, sem entrada em `ignorados`. Só `versao` presente e
  // diferente de 1 é sinal de catálogo em formato não suportado.
  if (!("versao" in bruto)) return VAZIO;

  if (bruto.versao !== 1) {
    return { campos: [], ignorados: [`versão de schema_campos não suportada: ${String(bruto.versao)}`] };
  }

  const listaBruta = Array.isArray(bruto.campos) ? bruto.campos : [];

  const campos: CampoDinamico[] = [];
  const ignorados: string[] = [];

  for (const item of listaBruta) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      ignorados.push("campo sem forma reconhecível");
      continue;
    }

    const candidato = item as Record<string, unknown>;
    const chave = candidato.chave;
    const rotulo = candidato.rotulo;
    const tipo = candidato.tipo;

    if (typeof chave !== "string" || typeof rotulo !== "string" || !ehTipoConhecido(tipo)) {
      ignorados.push(typeof chave === "string" ? chave : "campo sem chave reconhecível");
      continue;
    }

    campos.push({
      chave,
      rotulo,
      tipo,
      obrigatorio: typeof candidato.obrigatorio === "boolean" ? candidato.obrigatorio : undefined,
      artefatoTipo: typeof candidato.artefato_tipo === "string" ? candidato.artefato_tipo : undefined,
      origem: typeof candidato.origem === "string" ? candidato.origem : undefined,
      estado: typeof candidato.estado === "string" ? candidato.estado : undefined,
    });
  }

  return { campos, ignorados };
}
