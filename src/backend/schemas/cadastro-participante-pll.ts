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
export const linhaCadastroPllSchema = z.object({
  // Dados Pessoais (12)
  papel: z.enum(["mentorado", "mentor"]),
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
