import { z } from "zod";

// Espelha fat_registro (docs/schema_sistema.sql:1035-1050) -- INSERT direto
// via PostgREST (design.md Tech Decisions: 1 tabela só, sem RPC). id_usuario_autor
// não entra aqui: é NOT NULL no schema mas resolvido no client via
// usePapelGlobal (T17), nunca digitado no formulário -- ver design.md "2º
// achado real de Design".
export const registroSchema = z.object({
  id_contrato: z.number().int().positive("id_contrato é obrigatório"),
  id_tipo_registro: z.number().int().positive("id_tipo_registro é obrigatório"),
  // ck_registro_sequencia: nr_sequencia IS NULL OR nr_sequencia > 0
  nr_sequencia: z.number().int().positive().nullable().optional(),
  id_encontro: z.number().int().positive().nullable().optional(),
  ocorrido_em: z.string("ocorrido_em é obrigatório"),
  // ck_registro_canal
  canal: z.enum(["sistema", "slack", "presencial"]).nullable().optional(),
  resumo: z.string().nullable().optional(),
  // ck_registro_conteudo: jsonb_typeof(conteudo) = 'object' -- z.record só
  // aceita objeto por construção, e omitir a chave no payload deixa o
  // DEFAULT '{}'::jsonb da coluna assumir (sem .default() aqui -- ver
  // rationale de metaSchema.status em planejamento.ts).
  conteudo: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type RegistroInput = z.infer<typeof registroSchema>;
