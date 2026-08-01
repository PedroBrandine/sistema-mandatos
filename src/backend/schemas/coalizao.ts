import { z } from "zod";

import { textoLimpoSchema } from "./texto-limpo";

// Espelha o payload `p_coalizao` lido por app.criar_coalizao
// (supabase/migrations/0023_coalizao_classificacao_agenda.sql): classificacao,
// agenda_tematica, possui_planejamento_proprio.
export const coalizaoSchema = z.object({
  classificacao: z.enum(["Nacional", "Subnacional"]).optional(),
  agenda_tematica: z.array(z.string()).optional(),
  possui_planejamento_proprio: z.boolean().optional(),
});

export type CoalizaoInput = z.infer<typeof coalizaoSchema>;

// Espelha rel_coalizao_membro (supabase/migrations/0009_fundacao_tabelas.sql)
// -- não tem função RPC própria (insert direto via PostgREST, FND-COL-03/04/05);
// sem arquivo dedicado no design.md, então fica em coalizao.ts junto com o
// supertipo que ela referencia.
export const membroCoalizaoSchema = z
  .object({
    // espelha ck_membro_papel
    papel: z.enum(["membro", "secretaria_executiva", "grupo_trabalho"]),
    // espelha domínio texto_limpo (rel_coalizao_membro.nome_grupo)
    nome_grupo: textoLimpoSchema,
    dt_entrada: z.string().optional(),
    dt_saida: z.string().nullable().optional(),
  })
  // espelha ck_membro_grupo: (papel = 'grupo_trabalho') = (nome_grupo IS NOT NULL)
  .refine((valor) => (valor.papel === "grupo_trabalho") === (valor.nome_grupo != null), {
    message: "nome_grupo é obrigatório quando papel='grupo_trabalho' e deve ficar nulo nos demais papéis",
    path: ["nome_grupo"],
  })
  // espelha ck_membro_periodo: dt_saida IS NULL OR dt_saida >= dt_entrada
  .refine(
    (valor) => valor.dt_saida == null || valor.dt_entrada == null || valor.dt_saida >= valor.dt_entrada,
    { message: "dt_saida deve ser maior ou igual a dt_entrada", path: ["dt_saida"] }
  );

export type MembroCoalizaoInput = z.infer<typeof membroCoalizaoSchema>;
