"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { FormEvent } from "react";
import { useForm } from "react-hook-form";

import { consumirSenhaSchema, type ConsumirSenhaInput } from "@backend/schemas/convite";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export interface ConviteConsumoFormProps {
  token: string;
}

// CVT-06. Submit nativo (<form method="POST" action="/convite/[token]/consumir">,
// nunca fetch/JSON) pro Route Handler processar -- mesmo padrão pré-sessão
// de admin/acesso/entrar/route.ts (progressive enhancement). Rota separada
// de /convite/[token] (onde mora a página, T13): App Router não permite
// page.tsx e route.ts no mesmo segmento. RHF só valida
// "senha === confirmarSenha" no cliente antes do POST acontecer;
// handleSubmit não é usado aqui de propósito (ele sempre chama
// preventDefault, o que bloquearia o submit nativo) -- o onSubmit do <form>
// chama form.trigger() manualmente e só bloqueia (preventDefault) quando a
// validação falha; se passar, o navegador segue com o POST nativo.
export function ConviteConsumoForm({ token }: ConviteConsumoFormProps) {
  const form = useForm<ConsumirSenhaInput>({
    resolver: zodResolver(consumirSenhaSchema),
    mode: "onChange",
    defaultValues: { nome: "", senha: "", confirmarSenha: "" },
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const valido = await form.trigger();
    if (!valido) {
      event.preventDefault();
    }
  }

  return (
    <Form {...form}>
      <form method="POST" action={`/convite/${token}/consumir`} onSubmit={onSubmit} className="grid gap-4">
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="senha"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Senha</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmarSenha"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmar senha</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Criar acesso</Button>
      </form>
    </Form>
  );
}
