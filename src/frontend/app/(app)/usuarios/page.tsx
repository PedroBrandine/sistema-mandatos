"use client";

import { useCallback, useEffect, useState } from "react";

import { createClient } from "@backend/supabase/client";
import type { Database } from "@backend/supabase/database.types";

import { UsuarioForm } from "@/components/fundacao/usuario-form";

type UsuarioRow = Database["public"]["Tables"]["dim_usuario"]["Row"];

export default function UsuariosPage() {
  const [souAdmin, setSouAdmin] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();

    const { data: auth } = await supabase.auth.getUser();
    const email = auth.user?.email ?? null;
    if (email) {
      const { data: eu } = await supabase
        .from("dim_usuario")
        .select("papel_global")
        .eq("email", email)
        .maybeSingle();
      setSouAdmin(eu?.papel_global === "admin");
    }

    const { data } = await supabase.from("dim_usuario").select("*").order("nome");
    setUsuarios(data ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="mx-auto grid max-w-2xl gap-8 p-6">
      <div>
        <h1 className="mb-6 text-xl font-semibold">Novo usuário</h1>
        <UsuarioForm souAdmin={souAdmin} onCriado={() => void carregar()} />
      </div>
      <div>
        <h2 className="mb-2 text-lg font-medium">Usuários cadastrados</h2>
        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {usuarios.map((u) => (
              <li key={u.id_usuario}>
                {u.nome} — {u.email} ({u.papel_global})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
