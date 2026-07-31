"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { createClient } from "@backend/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// AD-026: login por e-mail+senha substitui temporariamente o magic link
// pra público Interno Legisla, enquanto o rate limit de e-mail do plano
// free da Supabase (~2/h) não é resolvido. Senha provisionada via
// scripts/provisionar-senhas.ts (service_role), nunca por e-mail.
const loginSchema = z.object({
  email: z.email("Informe um e-mail válido"),
  password: z.string().min(1, "Informe a senha"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [status, setStatus] = useState<
    { type: "idle" } | { type: "error"; message: string }
  >({ type: "idle" });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async ({ email, password }: LoginFormValues) => {
    setStatus({ type: "idle" });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus({ type: "error", message: error.message });
      return;
    }
    router.push("/");
    router.refresh();
  };

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
      <div className="grid gap-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" type="password" {...register("password")} />
        {errors.password && (
          <p className="text-sm text-red-500">{errors.password.message}</p>
        )}
      </div>
      {status.type === "error" && (
        <p className="text-sm text-red-500">{status.message}</p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
