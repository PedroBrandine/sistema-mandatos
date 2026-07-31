import { z } from "zod";

import { textoLimpoSchema } from "./texto-limpo";

// Espelha rel_usuario_contrato (supabase/migrations/0008_plataforma_tabelas.sql)
// -- insert/update direto via PostgREST para a maioria das operações
// (design.md VinculoTable/VinculoForm); a substituição de pessoa passa por
// app.substituir_vinculo (T23), que já valida no banco.
export const vinculoSchema = z.object({
  id_contrato: z.number().int().positive("id_contrato é obrigatório"),
  id_usuario: z.number().int().positive("id_usuario é obrigatório"),
  // espelha ck_vinculo_papel
  papel_no_contrato: z.enum(["gestora", "mentor", "assessor", "leitura"]),
  // espelha ck_vinculo_cargo
  cargo: z
    .enum(["parlamentar", "chefe_gabinete", "assessor", "secretaria_executiva", "nao_se_aplica"])
    .nullable()
    .optional(),
  // espelha domínio texto_limpo
  grau_responsabilidade: textoLimpoSchema,
  areas: z.array(z.string()).nullable().optional(),
  dt_inicio: z.string().optional(),
  dt_fim: z.string().nullable().optional(),
})
  // espelha ck_vinculo_periodo: dt_fim IS NULL OR dt_fim >= dt_inicio
  .refine((valor) => valor.dt_fim == null || valor.dt_inicio == null || valor.dt_fim >= valor.dt_inicio, {
    message: "dt_fim deve ser maior ou igual a dt_inicio",
    path: ["dt_fim"],
  });

export type VinculoInput = z.infer<typeof vinculoSchema>;
