import { z } from "zod";

import { textoLimpoSchema } from "./texto-limpo";

// Espelha fat_artefato (docs/schema_sistema.sql:931-948; design.md "Data Models" da
// ficha-mandato-contrato, FMC-17). id_usuario_anexou não entra aqui: é resolvido no
// servidor via app.id_usuario(), nunca digitado no formulário -- mesmo padrão de
// id_usuario_autor em registroSchema.

// ck_artefato_escopo
const ESCOPOS_ARTEFATO = ["contrato", "registro", "submissao", "encontro", "etapa"] as const;

// ck_artefato_tipo -- verbatim de docs/schema_sistema.sql:944-945 (12 valores).
const TIPOS_ARTEFATO = [
  "termo_assinado",
  "mapa_politico",
  "escuta_diagnostica",
  "cronograma",
  "pre_planejamento",
  "mural",
  "organograma",
  "material_replicacao",
  "foto",
  "planilha_legada",
  "pasta_drive",
  "outro",
] as const;

export const artefatoSchema = z
  .object({
    id_contrato: z.number().int().positive("id_contrato é obrigatório"),
    escopo: z.enum(ESCOPOS_ARTEFATO),
    id_referencia: z.number().int().positive().nullable().optional(),
    tipo: z.enum(TIPOS_ARTEFATO),
    // ck_artefato_url: url ~* '^https?://' (case-insensitive no banco)
    url: z.string().regex(/^https?:\/\//i, "URL deve começar com http:// ou https://"),
    descricao: textoLimpoSchema,
  })
  // ck_artefato_referencia: (escopo = 'contrato') = (id_referencia IS NULL)
  .refine((valor) => (valor.escopo === "contrato") === (valor.id_referencia == null), {
    message: "id_referencia deve ser nulo quando escopo é 'contrato', e obrigatório nos demais escopos.",
    path: ["id_referencia"],
  });

export type ArtefatoInput = z.infer<typeof artefatoSchema>;
