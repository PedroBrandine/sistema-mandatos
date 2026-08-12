"use client";

import { use, useCallback, useEffect, useState } from "react";

import { mapeiaErroRpc } from "@backend/rpc/errors";
import { createClient } from "@backend/supabase/client";
import type { Database } from "@backend/supabase/database.types";

import { ConviteForm } from "@/components/fundacao/convite-form";
import { VinculoForm, type VinculoFormModo } from "@/components/fundacao/vinculo-form";
import { VinculoTable } from "@/components/fundacao/vinculo-table";
import { Button } from "@/components/ui/button";

type VinculoRow = Database["public"]["Tables"]["rel_usuario_contrato"]["Row"];
type UsuarioRow = Database["public"]["Tables"]["dim_usuario"]["Row"];

// CVT-01. "Convidar por e-mail" é uma ação distinta de "Adicionar vínculo":
// esta cria acesso pra alguém que ainda não tem conta (dim_usuario nasce só
// no consumo do convite, /convite/[token]); aquela pressupõe que a pessoa já
// está cadastrada. Painel inline (mesmo modoAtivo já existente) em vez de
// tela nova -- convite não vira linha em rel_usuario_contrato até ser
// consumido, então não há nada pra refletir na VinculoTable ao fechar.
type ModoPainel = VinculoFormModo | { tipo: "convidar" };

// Gestão de vínculos usuário-contrato de um contrato (FND-USR-03 a 08):
// listar, adicionar, editar, substituir e encerrar -- cobre também o caso do
// assessor mentorado do PLL (vínculo manual, sem matching automático, já que
// "adicionar" aqui não depende de nenhuma importação/match).
export default function VinculosContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idContrato = Number(id);

  const [vinculos, setVinculos] = useState<VinculoRow[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [modoAtivo, setModoAtivo] = useState<ModoPainel | null>(null);
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
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setModoAtivo({ tipo: "convidar" })}>
            Convidar por e-mail
          </Button>
          <Button type="button" onClick={() => setModoAtivo({ tipo: "adicionar" })}>
            Adicionar vínculo
          </Button>
        </div>
      </div>

      {mensagem && <p className="text-sm text-red-500">{mensagem}</p>}

      <VinculoTable
        vinculos={vinculos}
        nomesPorUsuario={nomesPorUsuario}
        onEditar={(v) => setModoAtivo({ tipo: "editar", vinculo: v })}
        onSubstituir={(v) => setModoAtivo({ tipo: "substituir", vinculo: v })}
        onEncerrar={(v) => void encerrar(v)}
      />

      {modoAtivo?.tipo === "convidar" && (
        <div className="rounded-lg border p-4">
          <ConviteForm
            idContrato={idContrato}
            onConcluido={() => setModoAtivo(null)}
            onCancelar={() => setModoAtivo(null)}
          />
        </div>
      )}

      {modoAtivo && modoAtivo.tipo !== "convidar" && (
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
