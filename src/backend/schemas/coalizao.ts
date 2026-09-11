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

// Espelha o payload `p_coalizao` lido por app.criar_mandato
// (supabase/migrations/20260813180132_...sql:148-155), onde a vinculação é
// OPCIONAL: a tela de Novo Contrato pode abrir um contrato sem coalizão
// nenhuma. Por isso não reusa `membroCoalizaoSchema` direto -- lá `papel` é
// obrigatório, aqui só passa a ser quando uma coalizão foi escolhida.
//
// `id_coalizao` é a PK de dim_coalizao, NÃO o id_contratante da coalizão: são
// chaves surrogate distintas, e confundi-las é exatamente o que quebrava a
// submissão (FK rel_coalizao_membro.id_coalizao -> dim_coalizao).
//
// Vive aqui, e não inline no formulário, por L-005.
export const vinculoCoalizaoSchema = z
  .object({
    id_coalizao: z.number().int().positive().nullable().optional(),
    papel: z.enum(["membro", "secretaria_executiva", "grupo_trabalho"]).nullable().optional(),
    nome_grupo: z.string().nullable().optional(),
  })
  .superRefine((valor, ctx) => {
    if (!valor.id_coalizao) return;

    if (!valor.papel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Obrigatório quando vinculado a coalizão",
        path: ["papel"],
      });
    }

    // espelha ck_membro_grupo, que é uma EQUIVALÊNCIA:
    // (papel = 'grupo_trabalho') = (nome_grupo IS NOT NULL). Preencher
    // nome_grupo com outro papel viola a constraint tanto quanto deixá-lo
    // vazio em grupo_trabalho.
    const temNomeGrupo = valor.nome_grupo != null && valor.nome_grupo.trim() !== "";
    if (valor.papel === "grupo_trabalho" && !temNomeGrupo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Obrigatório para Grupo de Trabalho",
        path: ["nome_grupo"],
      });
    }
    if (valor.papel && valor.papel !== "grupo_trabalho" && temNomeGrupo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Nome do grupo só se aplica ao papel Grupo de Trabalho",
        path: ["nome_grupo"],
      });
    }
  });

export type VinculoCoalizaoInput = z.infer<typeof vinculoCoalizaoSchema>;
