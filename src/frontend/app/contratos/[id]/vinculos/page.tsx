"use client";

import { use, useCallback, useEffect, useState } from "react";

import { mapeiaErroRpc } from "@backend/rpc/errors";
import { createClient } from "@backend/supabase/client";
import type { Database } from "@backend/supabase/database.types";

import { VinculoForm, type VinculoFormModo } from "@/components/fundacao/vinculo-form";
import { VinculoTable } from "@/components/fundacao/vinculo-table";
import { Button } from "@/components/ui/button";

type VinculoRow = Database["public"]["Tables"]["rel_usuario_contrato"]["Row"];
type UsuarioRow = Database["public"]["Tables"]["dim_usuario"]["Row"];

// Gestão de vínculos usuário-contrato de um contrato (FND-USR-03 a 08):
// listar, adicionar, editar, substituir e encerrar -- cobre também o caso do
// assessor mentorado do PLL (vínculo manual, sem matching automático, já que
// "adicionar" aqui não depende de nenhuma importação/match).
export default function VinculosContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idContrato = Number(id);

  const [vinculos, setVinculos] = useState<VinculoRow[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [modoAtivo, setModoAtivo] = useState<VinculoFormModo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();
    const { data: vinculosData } = await supabase
      .from("rel_usuario_contrato")
      .select("*")
      .eq("id_contrato", idContrato)
      .order("dt_inicio", { ascending: false });
    setVinculos(vinculosData ?? []);

    const { data: usuariosData } = await supabase
      .from("dim_usuario")
      .select("*")
      .eq("ativo", true)
      .order("nome");
    setUsuarios(usuariosData ?? []);
    setCarregando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idContrato]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function encerrar(vinculo: VinculoRow) {
    setMensagem(null);
    const supabase = createClient();
    // FND-USR-06: só dt_fim -- nunca apaga a linha, nunca toca dim_usuario.ativo.
    const { error } = await supabase
      .from("rel_usuario_contrato")
      .update({ dt_fim: new Date().toISOString().slice(0, 10) })
      .eq("id_vinculo", vinculo.id_vinculo);
    if (error) {
      setMensagem(mapeiaErroRpc(error).message);
      return;
    }
    await carregar();
  }

  const nomesPorUsuario = Object.fromEntries(usuarios.map((u) => [u.id_usuario, u.nome]));

  if (carregando) return <p className="p-6 text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Vínculos do contrato #{idContrato}</h1>
        <Button type="button" onClick={() => setModoAtivo({ tipo: "adicionar" })}>
          Adicionar vínculo
        </Button>
      </div>

      {mensagem && <p className="text-sm text-red-500">{mensagem}</p>}

      <VinculoTable
        vinculos={vinculos}
        nomesPorUsuario={nomesPorUsuario}
        onEditar={(v) => setModoAtivo({ tipo: "editar", vinculo: v })}
        onSubstituir={(v) => setModoAtivo({ tipo: "substituir", vinculo: v })}
        onEncerrar={(v) => void encerrar(v)}
      />

      {modoAtivo && (
        <div className="rounded-lg border p-4">
          <VinculoForm
            idContrato={idContrato}
            modo={modoAtivo}
            usuarios={usuarios.map((u) => ({ id: u.id_usuario, nome: u.nome }))}
            onConcluido={() => {
              setModoAtivo(null);
              void carregar();
            }}
            onCancelar={() => setModoAtivo(null)}
          />
        </div>
      )}
    </div>
  );
}
