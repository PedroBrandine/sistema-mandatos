import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Bypass de login só pra dev local (guard real está em ./entrar/route.ts,
// que recusa tudo fora de `next dev`): evita o rate limit de e-mail do
// plano free da Supabase pra Pedro testar o app sem depender de link nenhum
// -- forms de HTML puro em vez de Server Actions, de propósito, pra não
// depender de nenhuma API experimental do React 19 que ainda não foi
// validada neste projeto (Next 16 é recente demais pro treino do modelo,
// ver src/frontend/AGENTS.md).
export default async function AcessoDevPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { error } = await searchParams;

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-xl font-semibold">Acesso dev</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Só funciona em `npm run dev` local. Gera e verifica o magic link no
          servidor, sem enviar e-mail e sem precisar copiar link nenhum.
        </p>
        <form
          method="POST"
          action="/admin/acesso/entrar"
          className="flex flex-col gap-4"
        >
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="voce@legislabrasil.org"
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit">Entrar</Button>
        </form>
      </div>
    </div>
  );
}
