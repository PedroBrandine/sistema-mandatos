import { z } from "zod";

import { textoLimpoSchema } from "./texto-limpo";

// Espelha o payload `p_contratante` lido por app.criar_mandato/app.criar_coalizao
// (supabase/migrations/0014_fn_criar_mandato.sql, 0016_fn_criar_coalizao.sql):
// nome/sg_uf/nm_municipio/id_partido_relacionado/localizador_legado. Não inclui
// `tipo_contratante` -- decidido pela própria função RPC ('mandato'/'coalizao'),
// nunca aceito do caller (mesmo padrão de origem_partido_cargo em criar_mandato).
export const contratanteSchema = z.object({
  nome: z.string().trim().min(1, "nome é obrigatório"),
  // espelha ck_contratante_uf
  sg_uf: z
    .string()
    .regex(/^[A-Z]{2}$/, "sg_uf deve ter exatamente 2 letras maiúsculas")
    .nullable()
    .optional(),
  // espelha domínio texto_limpo (dim_contratante.nm_municipio)
  nm_municipio: textoLimpoSchema,
  id_partido_relacionado: z.number().int().positive().nullable().optional(),
  localizador_legado: z.string().nullable().optional(),
});

export type ContratanteInput = z.infer<typeof contratanteSchema>;
