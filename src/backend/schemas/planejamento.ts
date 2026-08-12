import { z } from "zod";

// Espelha as 3 tabelas da hierarquia de Planejamento (docs/schema_sistema.sql:895-980):
// fat_objetivo_especifico -> fat_meta -> fat_sucesso_mensal. Mesmo padrão de
// contrato.ts: campos snake_case espelhando a coluna do banco, .refine() por
// CHECK constraint (comentado com a constraint de origem).

// PLM-15. Espelha dim_planejamento (docs/schema_sistema.sql:877-889) -- só os
// campos editáveis por Gestora/Admin (id_planejamento/id_contrato são
// identidade, não campo de formulário; pct_atingimento/atingimento_desatualizado
// são derivados pela cascata, nunca digitados -- AD-005). Sem .refine(): a
// única constraint da tabela (ck_planejamento_pct) é sobre pct_atingimento,
// fora deste formulário.
export const dadosPlanejamentoSchema = z.object({
  objetivo_ano: z.string().nullable().optional(),
  legado: z.string().nullable().optional(),
  analise_conjuntura: z.string().nullable().optional(),
  id_perfil_atuacao: z.number().int().positive().nullable().optional(),
});

export type DadosPlanejamentoInput = z.infer<typeof dadosPlanejamentoSchema>;

export const objetivoEspecificoSchema = z
  .object({
    id_objetivo: z.number().int().positive().nullable().optional(),
    id_planejamento: z.number().int().positive("id_planejamento é obrigatório"),
    ordem: z.number().int().nullable().optional(),
    descricao: z.string().trim().min(1, "descricao é obrigatória"),
    id_preditor_primario: z.number().int().positive().nullable().optional(),
    id_preditor_secundario: z.number().int().positive().nullable().optional(),
    id_agenda: z.number().int().positive().nullable().optional(),
    oportunidade: z.string().nullable().optional(),
    ameaca: z.string().nullable().optional(),
    pct_atingimento: z.number().min(0).max(100).nullable().optional(),
  })
  // ck_objetivo_preditores: secundário exige primário e não pode repeti-lo.
  .refine(
    (valor) =>
      valor.id_preditor_secundario == null ||
      (valor.id_preditor_primario != null && valor.id_preditor_secundario !== valor.id_preditor_primario),
    {
      message: "id_preditor_secundario exige id_preditor_primario e não pode repeti-lo",
      path: ["id_preditor_secundario"],
    }
  );

export type ObjetivoEspecificoInput = z.infer<typeof objetivoEspecificoSchema>;

export const metaSchema = z
  .object({
    id_meta: z.number().int().positive().nullable().optional(),
    id_objetivo: z.number().int().positive("id_objetivo é obrigatório"),
    ordem: z.number().int().nullable().optional(),
    descricao: z.string().trim().min(1, "descricao é obrigatória"),
    id_preditor_primario: z.number().int().positive().nullable().optional(),
    id_preditor_secundario: z.number().int().positive().nullable().optional(),
    id_agenda: z.number().int().positive().nullable().optional(),
    prioridade: z.enum(["alta", "media", "baixa"]).nullable().optional(),
    classe: z.enum(["programatica", "governanca"]).nullable().optional(),
    id_usuario_responsavel: z.number().int().positive().nullable().optional(),
    // Sem .default() (diferente de v8-style Zod comum): @hookform/resolvers/zod
    // infere o tipo do form pelo INPUT do schema, não pelo OUTPUT -- um campo
    // com .default() vira opcional no input e obrigatório no output, e
    // useForm<MetaInput> (que é o output) não bate com o Resolver esperado
    // pelo form. Mesma convenção de contratoSchema (status sem default,
    // sempre setado explicitamente em defaultValues do form).
    status: z.enum(["ativa", "pausada", "descartada"]),
    pct_atingimento: z.number().min(0).max(100).nullable().optional(),
  })
  // ck_meta_preditores: mesma regra de objetivoEspecificoSchema.
  .refine(
    (valor) =>
      valor.id_preditor_secundario == null ||
      (valor.id_preditor_primario != null && valor.id_preditor_secundario !== valor.id_preditor_primario),
    {
      message: "id_preditor_secundario exige id_preditor_primario e não pode repeti-lo",
      path: ["id_preditor_secundario"],
    }
  );

export type MetaInput = z.infer<typeof metaSchema>;

export const sucessoMensalSchema = z
  .object({
    id_sucesso: z.number().int().positive().nullable().optional(),
    id_meta: z.number().int().positive("id_meta é obrigatório"),
    descricao: z.string().trim().min(1, "descricao é obrigatória"),
    mes_referencia: z.string("mes_referencia é obrigatório"),
    dt_limite: z.string().nullable().optional(),
    peso: z.number().min(0).max(100),
    pct_atingimento: z.number().min(0).max(100).nullable().optional(),
    status: z.enum(["pendente", "realizado", "nao_realizado"]), // sem .default() -- ver metaSchema.status
  })
  // ck_sucesso_mes: EXTRACT(DAY FROM mes_referencia) = 1.
  .refine((valor) => Number(valor.mes_referencia.slice(8, 10)) === 1, {
    message: "mes_referencia deve ser o primeiro dia do mês (YYYY-MM-01)",
    path: ["mes_referencia"],
  });

export type SucessoMensalInput = z.infer<typeof sucessoMensalSchema>;
