import { z } from "zod";

import { textoLimpoSchema } from "./texto-limpo";

// Espelha o payload `p_mandato` lido por app.criar_mandato via
// jsonb_populate_record(null::dim_mandato, p_mandato)
// (supabase/migrations/0014_fn_criar_mandato.sql). Não inclui
// `origem_partido_cargo` -- decidido pela própria função ('tse'/'manual'
// conforme presença de p_candidatura), nunca aceito do caller (ver Handoff da
// Fase 3 em .specs/STATE.md).
export const mandatoSchema = z.object({
  // espelha ck_mandato_titulo -- 12 dígitos; 11 dígitos (CPF) é rejeitado
  // (edge case explícito do spec.md)
  nr_titulo_eleitoral: z
    .string()
    .regex(/^\d{12}$/, "nr_titulo_eleitoral deve ter exatamente 12 dígitos")
    .nullable()
    .optional(),
  // espelha domínio texto_limpo
  nm_civil: textoLimpoSchema,
  nm_urna: textoLimpoSchema,
  nm_social: textoLimpoSchema,
  ds_genero: textoLimpoSchema,
  ds_identidade_genero: textoLimpoSchema,
  ds_orientacao_sexual: textoLimpoSchema,
  // espelha ck_mandato_raca
  ds_raca: z
    .enum(["Branca", "Preta", "Parda", "Amarela", "Indígena"])
    .nullable()
    .optional(),
  fl_pcd: z.boolean().nullable().optional(),
  id_partido_atual: z.number().int().positive().nullable().optional(),
  id_cargo_atual: z.number().int().positive().nullable().optional(),
  atualizado_partido_cargo_em: z.string().nullable().optional(),
  potencial_futuro: textoLimpoSchema,
  relevancia_politica: textoLimpoSchema,
  confianca: textoLimpoSchema,
  risco_democratico: textoLimpoSchema,
  espectro_politico: textoLimpoSchema,
  id_mandato_legado: z.number().int().positive().nullable().optional(),
});

export type MandatoInput = z.infer<typeof mandatoSchema>;
