import { z } from "zod";

// Espelha o domínio `texto_limpo` (supabase/migrations/0006_extensoes_helpers.sql,
// verbatim de docs/schema_sistema.sql:114-125): TEXT que recusa string vazia e os
// mesmos sentinelas de ausência do CHECK do domínio, comparados após a mesma
// normalização usada por app.normaliza_nome (unaccent + lower + trim + colapso de
// espaços). Compartilhado por contratante/mandato/contrato/usuario/vinculo -- 5
// schemas usam a mesma coluna-domínio; extraído para não repetir a lista de
// sentinelas 5 vezes (mesmo racional de reuso de app.contratante_similar em T20/T22).
const SENTINELAS_NORMALIZADOS = new Set([
  "pendente de atualizacao",
  "nao coletado",
  "nao informado",
  "nao se aplica",
  "n/a",
  "na",
  "nd",
  "-",
  "--",
  "null",
  "undefined",
  "sem nome",
]);

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function normalizaNome(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export const textoLimpoSchema = z
  .string()
  .refine((valor) => valor.trim() !== "", {
    message: "não pode ser string vazia (ausência é null, nunca string vazia)",
  })
  .refine((valor) => !SENTINELAS_NORMALIZADOS.has(normalizaNome(valor)), {
    message: 'sentinela de ausência não é permitido (ex.: "Pendente de Atualização", "N/A"); use null',
  })
  .nullable()
  .optional();
