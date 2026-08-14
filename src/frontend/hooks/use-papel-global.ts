"use client";

import { useEffect, useState } from "react";

import { createClient } from "@backend/supabase/client";

export type PapelGlobal = "admin" | "gestora" | "mentor" | "assessor";

interface UsePapelGlobalResult {
  papel: PapelGlobal | null;
  idUsuario: number | null;
  carregando: boolean;
}

// Extrai o padrão hoje ad-hoc em usuarios/page.tsx:56-63 (auth.getUser() +
// dim_usuario.select("papel_global")) para qualquer componente decidir
// visibilidade por papel -- ver design.md (Components -> usePapelGlobal).
// incidencia-encontros T17: ganha id_usuario no .select() -- é o único ponto
// do repo que já resolve "meu próprio dim_usuario" a partir da sessão;
// RegistroForm precisa disso pra preencher id_usuario_autor (NOT NULL, sem
// RPC -- ver design.md "2º achado real de Design").
export function usePapelGlobal(): UsePapelGlobalResult {
  const [papel, setPapel] = useState<PapelGlobal | null>(null);
  const [idUsuario, setIdUsuario] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      const email = auth.user?.email ?? null;

      if (email) {
        const { data: usuario } = await supabase
          .from("dim_usuario")
          .select("id_usuario, papel_global")
          .eq("email", email)
          .maybeSingle();

        if (usuario) {
          setPapel(usuario.papel_global as PapelGlobal);
          setIdUsuario(usuario.id_usuario);
        }
      }

      setCarregando(false);
    }

    void carregar();
  }, []);

  return { papel, idUsuario, carregando };
}
