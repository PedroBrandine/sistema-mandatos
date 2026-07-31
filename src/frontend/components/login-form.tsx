"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { createClient } from "@backend/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.email("Informe um e-mail válido"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [status, setStatus] = useState<
    { type: "idle" } | { type: "sent" } | { type: "error"; message: string }
  >({ type: "idle" });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async ({ email }: LoginFormValues) => {
    setStatus({ type: "idle" });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // AD-002: nenhum acesso é anônimo -- o magic link nunca cria conta
        // Auth nova, só autentica um e-mail já provisionado em dim_usuario.
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (error) {
      setStatus({ type: "error", message: error.message });
      return;
    }
    setStatus({ type: "sent" });
  };

  if (status.type === "sent") {
    return (
      <p className="text-sm">
        Link de acesso enviado. Confira seu e-mail para entrar.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          placeholder="voce@legislabrasil.org"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email.message}</p>
        )}
      </div>
      {status.type === "error" && (
        <p className="text-sm text-red-500">{status.message}</p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Enviando..." : "Enviar link de acesso"}
      </Button>
    </form>
  );
}
