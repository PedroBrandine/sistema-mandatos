"use client";

import { useEffect, useState } from "react";

import { createClient } from "@backend/supabase/client";

export type PapelGlobal = "admin" | "gestora" | "mentor" | "assessor";

interface UsePapelGlobalResult {
  papel: PapelGlobal | null;
  carregando: boolean;
}

// Extrai o padrão hoje ad-hoc em usuarios/page.tsx:56-63 (auth.getUser() +
// dim_usuario.select("papel_global")) para qualquer componente decidir
// visibilidade por papel -- ver design.md (Components -> usePapelGlobal).
export function usePapelGlobal(): UsePapelGlobalResult {
  const [papel, setPapel] = useState<PapelGlobal | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      const email = auth.user?.email ?? null;

      if (email) {
        const { data: usuario } = await supabase
          .from("dim_usuario")
          .select("papel_global")
          .eq("email", email)
          .maybeSingle();

        if (usuario) setPapel(usuario.papel_global as PapelGlobal);
      }

      setCarregando(false);
    }

    void carregar();
  }, []);

  return { papel, carregando };
}
