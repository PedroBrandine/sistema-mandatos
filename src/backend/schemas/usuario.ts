import { z } from "zod";

import { textoLimpoSchema } from "./texto-limpo";

// Espelha dim_usuario (supabase/migrations/0008_plataforma_tabelas.sql) -- insert
// direto via PostgREST (design.md UsuarioForm.onCriar, sem RPC). A regra "só
// Admin pode cadastrar Gestora" (spec.md FND-USR AC2) é decidida pela RLS, não
// pelo Zod -- todos os 4 valores de papel_global são estruturalmente válidos
// aqui (ver Error Handling Strategy do design.md: RLS nega com 42501).
export const usuarioSchema = z.object({
  // espelha ck_usuario_email: email = lower(btrim(email)) AND email LIKE '%@%.%'
  email: z
    .string()
    .refine((valor) => valor === valor.trim().toLowerCase(), {
      message: "email deve estar em minúsculas e sem espaço nas bordas",
    })
    .refine((valor) => /@.*\./.test(valor), {
      message: "email deve conter '@' seguido de '.' (ex.: nome@dominio.com)",
    }),
  nome: z.string().trim().min(1, "nome é obrigatório"),
  // espelha domínio texto_limpo
  telefone: textoLimpoSchema,
  // espelha ck_usuario_papel
  papel_global: z.enum(["admin", "gestora", "mentor", "assessor"]),
  ativo: z.boolean().optional(),
});

export type UsuarioInput = z.infer<typeof usuarioSchema>;
