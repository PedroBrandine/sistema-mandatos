"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { mapeiaErroRpc } from "@backend/rpc/errors";
import { usuarioSchema, type UsuarioInput } from "@backend/schemas/usuario";
import { createClient } from "@backend/supabase/client";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAPEIS_TODOS = ["admin", "gestora", "mentor", "assessor"] as const;
const PAPEIS_NAO_ADMIN = ["mentor", "assessor"] as const;

export interface UsuarioFormProps {
  souAdmin: boolean;
  onCriado: () => void;
}

// Cadastro de dim_usuario (FND-USR-01/02): insert direto via PostgREST. A
// opção "Gestora" (e "Admin") só aparece para quem já é Admin -- gate de UX,
// não de segurança; o backstop real é RLS/GRANT no banco (design.md Error
// Handling Strategy), refletido aqui só na mensagem genérica que um 42501
// produziria caso a UI fosse contornada.
export function UsuarioForm({ souAdmin, onCriado }: UsuarioFormProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const papeisDisponiveis = souAdmin ? PAPEIS_TODOS : PAPEIS_NAO_ADMIN;

  const form = useForm<UsuarioInput>({
    resolver: zodResolver(usuarioSchema),
    mode: "onChange",
    defaultValues: { email: "", nome: "", papel_global: "assessor" },
  });

  async function enviar(valores: UsuarioInput) {
    setEnviando(true);
    setErro(null);
    const supabase = createClient();
    const { error } = await supabase.from("dim_usuario").insert({
      email: valores.email,
      nome: valores.nome,
      telefone: valores.telefone ?? null,
      papel_global: valores.papel_global,
    });
    setEnviando(false);
    if (error) {
      // 42501 (RLS nega, ex.: Gestora tentando cadastrar outra Gestora) vira
      // mensagem genérica de permissão -- nunca crash, nunca revela dado da
      // linha negada (design.md Error Handling Strategy).
      setErro(mapeiaErroRpc(error).message);
      return;
    }
    form.reset({ email: "", nome: "", papel_global: "assessor" });
    onCriado();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(enviar)} className="grid gap-4">
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
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="telefone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="papel_global"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Papel</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {papeisDisponiveis.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {erro && <p className="text-sm text-red-500">{erro}</p>}
        <Button type="submit" disabled={enviando} className="w-fit">
          {enviando ? "Salvando..." : "Cadastrar usuário"}
        </Button>
      </form>
    </Form>
  );
}
