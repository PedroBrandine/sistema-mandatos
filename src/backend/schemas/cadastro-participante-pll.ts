import { read, SSF, utils } from "xlsx";
import { z } from "zod";

import { textoLimpoSchema } from "./texto-limpo";

// Espelha os 25 campos autodeclarados de fat_cadastro_participante (Anexo A
// de .specs/features/pll-cadastro-participantes/spec.md; design.md Data
// Models; migration 20260922072328_pll_cadastro_participante_estrutura.sql).
// Só papel/nome_completo/email são NOT NULL na tabela -- os demais 22 ficam
// null quando ausentes (AD-005, nunca sentinela).
//
// cor_raca/cor_raca_parlamentar são TEXT puro na tabela (não o domínio
// texto_limpo) -- planilha autodeclarada, sem o enum fechado de
// dim_mandato.ds_raca (schemas/mandato.ts): o formulário de origem (Google
// Forms) não usa as mesmas opções, e normalizar aqui seria inventar um
// mapeamento não pedido pela spec.
// Sessão ao vivo com Pedro (22/09): Mentor não é cadastrado por este
// caminho (planilha OU cadastro manual, mesmo schema) -- mentor já existe
// como usuário do sistema (dim_usuario, papel_global='mentor'), escolhido no
// pool padrão da edição (CriarEdicaoDialog); não é um registro de staging
// como o mentorado (que ainda não tem contrato/TSE vinculado). O valor
// 'mentor' continua no enum do banco (ck_cadastro_papel) por compatibilidade
// com linhas antigas -- só a ENTRADA nova é barrada aqui.
export const linhaCadastroPllSchema = z.object({
  // Dados Pessoais (12)
  papel: z
    .enum(["mentorado", "mentor"])
    .refine((valor) => valor === "mentorado", {
      message: "Mentor não é cadastrado por este formulário -- mentores já existem como usuários do sistema.",
    }),
  nome_completo: z.string().trim().min(1, "nome_completo é obrigatório"),
  dt_nascimento: z.string().nullable().optional(),
  // ck_cadastro_email: email = lower(btrim(email)) AND email LIKE '%@%.%'
  email: z
    .string()
    .trim()
    .min(1, "email é obrigatório")
    .transform((valor) => valor.toLowerCase())
    .refine((valor) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor), "email malformado"),
  telefone: textoLimpoSchema,
  identidade_genero: textoLimpoSchema,
  orientacao_sexual: textoLimpoSchema,
  cor_raca: z.string().trim().min(1).nullable().optional(),
  deficiencias: textoLimpoSchema,
  partido_filiado: textoLimpoSchema,
  tempo_na_politica: textoLimpoSchema,
  conhecia_legisla: z.boolean().nullable().optional(),

  // Dados do Mandato autodeclarados (7) -- D-1: "Parlamentar", não "Deputado(a)"
  nome_parlamentar: textoLimpoSchema,
  cor_raca_parlamentar: z.string().trim().min(1).nullable().optional(),
  partido_parlamentar: textoLimpoSchema,
  // ck_cadastro_estado_eleicao: estado_eleicao IS NULL OR estado_eleicao ~ '^[A-Z]{2}$'
  estado_eleicao: z
    .string()
    .trim()
    .transform((valor) => valor.toUpperCase())
    .refine((valor) => /^[A-Z]{2}$/.test(valor), "estado_eleicao deve ter exatamente 2 letras (UF)")
    .nullable()
    .optional(),
  cargos_anteriores: textoLimpoSchema,
  mandatos_anteriores: textoLimpoSchema,
  rede_social: textoLimpoSchema,

  // Pautas Prioritárias (6, D-5) -- ck_cadastro_notas: NULL ou 1..5
  nota_educacao: z.number().int().min(1).max(5).nullable().optional(),
  nota_seguranca_publica: z.number().int().min(1).max(5).nullable().optional(),
  nota_modernizacao_estado: z.number().int().min(1).max(5).nullable().optional(),
  nota_clima: z.number().int().min(1).max(5).nullable().optional(),
  // Lista fixa (D-5): Saúde, Infraestrutura, Economia, Direitos Humanos,
  // Tecnologia -- validado como conjunto fechado (não texto livre) porque a
  // planilha usa múltipla escolha, não campo aberto.
  outras_pautas: z
    .array(z.enum(["Saúde", "Infraestrutura", "Economia", "Direitos Humanos", "Tecnologia"]))
    .nullable()
    .optional(),
  especifique_pauta: textoLimpoSchema,
});

export type LinhaCadastroPll = z.infer<typeof linhaCadastroPllSchema>;

export interface ErroLinhaCadastroPll {
  /** Índice 1-based da linha dentro do lote recebido (não conta cabeçalho -- mapeamento de cabeçalho é responsabilidade do parser, T4). */
  linha: number;
  /** Nome do campo (Anexo A) que falhou -- ausente quando o erro é da linha como um todo (ex.: duplicidade). */
  campo?: string;
  mensagem: string;
}

export interface ResultadoValidacaoLoteCadastroPll {
  validas: LinhaCadastroPll[];
  erros: ErroLinhaCadastroPll[];
}

/**
 * Valida um lote de linhas de planilha contra o Anexo A (PLL-CP-01, PLL-CP-02)
 * e rejeita e-mail duplicado dentro do mesmo arquivo (edge case da spec).
 *
 * All-or-nothing (PLL-CP-02, "nunca importar parcialmente sem avisar"):
 * qualquer erro -- de campo ou de duplicidade -- invalida o lote inteiro;
 * `validas` só vem populado quando `erros` está vazio.
 */
export function validarLinhasCadastroPll(linhas: unknown[]): ResultadoValidacaoLoteCadastroPll {
  const erros: ErroLinhaCadastroPll[] = [];
  const linhasValidadas: (LinhaCadastroPll | null)[] = linhas.map((linha, indice) => {
    const resultado = linhaCadastroPllSchema.safeParse(linha);
    if (resultado.success) return resultado.data;
    for (const issue of resultado.error.issues) {
      erros.push({
        linha: indice + 1,
        campo: issue.path.length > 0 ? issue.path.join(".") : undefined,
        mensagem: issue.message,
      });
    }
    return null;
  });

  // Edge case (spec.md): e-mail duplicado dentro do mesmo arquivo rejeita a
  // importação inteira, apontando as linhas em conflito.
  const linhasPorEmail = new Map<string, number[]>();
  linhasValidadas.forEach((linha, indice) => {
    if (!linha) return;
    const indices = linhasPorEmail.get(linha.email) ?? [];
    indices.push(indice + 1);
    linhasPorEmail.set(linha.email, indices);
  });
  for (const [email, indicesDuplicados] of linhasPorEmail) {
    if (indicesDuplicados.length <= 1) continue;
    for (const linha of indicesDuplicados) {
      erros.push({
        linha,
        campo: "email",
        mensagem: `email duplicado no arquivo (linhas ${indicesDuplicados.join(", ")}): ${email}`,
      });
    }
  }

  if (erros.length > 0) return { validas: [], erros };
  return { validas: linhasValidadas as LinhaCadastroPll[], erros: [] };
}

// -----------------------------------------------------------------------------
// parseCadastroPll (T4) -- função pura: recebe o conteúdo do arquivo (.xlsx ou
// .csv, já lido pelo browser em ArrayBuffer -- AD-011, parse acontece no
// client) e devolve linhas brutas (unknown[], antes da validação Zod acima).
// Sem I/O: não lê arquivo do disco nem faz rede -- só transforma bytes já em
// memória.
// -----------------------------------------------------------------------------

// Cabeçalho exato da planilha (Anexo A, frame Figma 387:4) -> campo de
// fat_cadastro_participante. Comparação por texto exato após trim -- qualquer
// variação de grafia é cabeçalho "não reconhecido" (ver ErroCabecalhoDesconhecido).
const MAPA_CABECALHOS: Record<string, string> = {
  "Você é um(a) [Mentorado/Mentor]": "papel",
  "Nome Completo": "nome_completo",
  "Data de nascimento": "dt_nascimento",
  "E-mail": "email",
  "Telefone (com DDD)": "telefone",
  "Identidade de gênero": "identidade_genero",
  "Orientação sexual": "orientacao_sexual",
  "Cor/raça": "cor_raca",
  Deficiências: "deficiencias",
  "Partido filiado": "partido_filiado",
  "Tempo na política": "tempo_na_politica",
  "Já conhecia a Legisla": "conhecia_legisla",
  "Nome do Parlamentar": "nome_parlamentar",
  "Cor/raça do parlamentar": "cor_raca_parlamentar",
  "Partido do parlamentar": "partido_parlamentar",
  "Estado de eleição": "estado_eleicao",
  "Cargos anteriores": "cargos_anteriores",
  "Mandatos anteriores": "mandatos_anteriores",
  "Instagram/rede social": "rede_social",
  Educação: "nota_educacao",
  "Segurança pública": "nota_seguranca_publica",
  "Modernização do Estado": "nota_modernizacao_estado",
  Clima: "nota_clima",
  "Outras pautas prioritárias": "outras_pautas",
  "Especifique a pauta": "especifique_pauta",
};

const CAMPOS_NOTA = new Set([
  "nota_educacao",
  "nota_seguranca_publica",
  "nota_modernizacao_estado",
  "nota_clima",
]);

// Campos TEXT/texto_limpo do Anexo A -- sempre coagidos para string. Achado
// real (T4): `sheet_to_json` auto-detecta tipo por formato de CÉLULA, não por
// coluna, e o mesmo valor textual ("1", "11999999999") vira JS number quando
// veio de um `.xlsx` real (cuja célula foi gravada como número) mas string
// quando veio de `.csv` (que não tem tipo de célula). Sem esta coerção,
// .xlsx e .csv da MESMA planilha produziam objetos com tipos diferentes para
// o mesmo campo -- exatamente o que o "Done when" de T4 exige que não
// aconteça.
const CAMPOS_TEXTO = new Set([
  "nome_completo",
  "email",
  "telefone",
  "identidade_genero",
  "orientacao_sexual",
  "cor_raca",
  "deficiencias",
  "partido_filiado",
  "tempo_na_politica",
  "nome_parlamentar",
  "cor_raca_parlamentar",
  "partido_parlamentar",
  "estado_eleicao",
  "cargos_anteriores",
  "mandatos_anteriores",
  "rede_social",
  "especifique_pauta",
]);

// Excel guarda data como serial numérico (dias desde 1899-12-30); .csv chega
// como texto. XLSX.SSF.format devolve a mesma string ISO para os dois casos.
function converterDataCelula(valor: unknown): string {
  if (typeof valor === "number") return SSF.format("yyyy-mm-dd", valor);
  if (valor instanceof Date) return SSF.format("yyyy-mm-dd", valor);
  return String(valor).trim();
}

/** Erro nomeado (não silencioso -- T4 "Done when") para cabeçalho de coluna sem correspondência no Anexo A. */
export class ErroCabecalhoDesconhecido extends Error {
  constructor(public readonly cabecalho: string) {
    super(`Cabeçalho de coluna não reconhecido: "${cabecalho}"`);
    this.name = "ErroCabecalhoDesconhecido";
  }
}

function converterValorCelula(campo: string, valor: unknown): unknown {
  if (valor === null || valor === undefined || valor === "") return null;
  if (campo === "papel") {
    const texto = String(valor).trim().toLowerCase();
    if (texto.startsWith("mentorado")) return "mentorado";
    if (texto.startsWith("mentor")) return "mentor";
    return texto;
  }
  if (campo === "conhecia_legisla") {
    const texto = String(valor).trim().toLowerCase();
    if (texto === "sim") return true;
    if (texto === "não" || texto === "nao") return false;
    return valor;
  }
  if (CAMPOS_NOTA.has(campo)) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : valor;
  }
  if (campo === "outras_pautas") {
    if (Array.isArray(valor)) return valor;
    return String(valor)
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  if (campo === "dt_nascimento") return converterDataCelula(valor);
  if (CAMPOS_TEXTO.has(campo)) return String(valor).trim();
  return valor;
}

/**
 * Parseia um arquivo `.xlsx` ou `.csv` (conteúdo já em memória) para um array
 * de objetos brutos, um por linha da planilha, prontos para
 * `validarLinhasCadastroPll`. Lança `ErroCabecalhoDesconhecido` (nomeado, não
 * silencioso) se alguma coluna do arquivo não corresponder ao Anexo A.
 */
export function parseCadastroPll(conteudoArquivo: ArrayBuffer | string): unknown[] {
  const workbook =
    typeof conteudoArquivo === "string"
      ? read(conteudoArquivo, { type: "string" })
      : read(conteudoArquivo, { type: "array" });
  const planilha = workbook.Sheets[workbook.SheetNames[0]];
  const linhasBrutas = utils.sheet_to_json<Record<string, unknown>>(planilha, { defval: null });

  return linhasBrutas.map((linhaBruta) => {
    const linha: Record<string, unknown> = {};
    for (const [cabecalho, valor] of Object.entries(linhaBruta)) {
      const cabecalhoNormalizado = cabecalho.trim();
      const campo = MAPA_CABECALHOS[cabecalhoNormalizado];
      if (!campo) throw new ErroCabecalhoDesconhecido(cabecalhoNormalizado);
      linha[campo] = converterValorCelula(campo, valor);
    }
    return linha;
  });
}
