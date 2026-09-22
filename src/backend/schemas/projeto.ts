import { z } from "zod";

// Espelha ref_projeto (docs/schema_sistema.sql) -- ck_projeto_periodo garante
// dt_fim >= dt_inicio quando ambas presentes.
export const projetoSchema = z
  .object({
    nome: z.string().trim().min(1, "nome é obrigatório"),
    tematica: z.string().trim().nullable().optional(),
    id_produto_padrao: z.number().int().positive().nullable().optional(),
    dt_inicio: z.string().nullable().optional(),
    dt_fim: z.string().nullable().optional(),
    ativo: z.boolean().default(true),
  })
  .refine(
    (v) => !v.dt_fim || !v.dt_inicio || v.dt_fim >= v.dt_inicio,
    { message: "dt_fim não pode ser anterior a dt_inicio", path: ["dt_fim"] }
  );

export type ProjetoInput = z.infer<typeof projetoSchema>;
