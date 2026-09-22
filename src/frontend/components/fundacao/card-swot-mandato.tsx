"use client";

import { useState } from "react";

import { mapeiaErroRpc } from "@backend/rpc/errors";
import { createClient } from "@backend/supabase/client";

import { EditorSwot } from "@/components/pll/editor-swot";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErroInline } from "@/components/ui/erro-inline";

// DIAG-18..DIAG-20 (.specs/features/diagnostico-mandato-estrategia/spec.md,
// "P1: Análise SWOT do mandato"). Reaproveita EditorSwot (pll/editor-swot.tsx)
// como está -- terceiro uso independente do conceito SWOT no sistema (o
// primeiro, em fat_objetivo_especifico, foi removido por AD-049; o segundo é
// o do PLL em cad_participante_pll). Persistência sempre em modo edição
// (EditorSwot não tem toggle próprio), com um único botão Salvar que grava
// as 4 colunas de dim_mandato de uma vez -- nulo quando vazio, mesma
// convenção dos demais campos desta feature.

export interface CardSwotMandatoProps {
  idMandato: number;
  swotForcas: string[] | null;
  swotFraquezas: string[] | null;
  swotOportunidades: string[] | null;
  swotAmeacas: string[] | null;
  onAtualizado: () => void;
}

export function CardSwotMandato({
  idMandato,
  swotForcas,
  swotFraquezas,
  swotOportunidades,
  swotAmeacas,
  onAtualizado,
}: CardSwotMandatoProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sujo, setSujo] = useState(false);

  const [forcas, setForcas] = useState<string[]>(swotForcas ?? []);
  const [fraquezas, setFraquezas] = useState<string[]>(swotFraquezas ?? []);
  const [oportunidades, setOportunidades] = useState<string[]>(swotOportunidades ?? []);
  const [ameacas, setAmeacas] = useState<string[]>(swotAmeacas ?? []);

  function comMudanca<T>(setter: (v: T) => void) {
    return (valor: T) => {
      setter(valor);
      setSujo(true);
    };
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const { error } = await createClient()
      .from("dim_mandato")
      .update({
        swot_forcas: forcas.length > 0 ? forcas : null,
        swot_fraquezas: fraquezas.length > 0 ? fraquezas : null,
        swot_oportunidades: oportunidades.length > 0 ? oportunidades : null,
        swot_ameacas: ameacas.length > 0 ? ameacas : null,
      })
      .eq("id_mandato", idMandato);
    if (error) {
      setErro(mapeiaErroRpc(error).message);
      setSalvando(false);
      return;
    }
    setSalvando(false);
    setSujo(false);
    onAtualizado();
  }

  return (
    <Card>
      <CardContent className="grid gap-4 pt-6">
        {erro && <ErroInline mensagem={erro} />}
        <EditorSwot
          forcas={forcas}
          fraquezas={fraquezas}
          oportunidades={oportunidades}
          ameacas={ameacas}
          onChangeForcas={comMudanca(setForcas)}
          onChangeFraquezas={comMudanca(setFraquezas)}
          onChangeOportunidades={comMudanca(setOportunidades)}
          onChangeAmeacas={comMudanca(setAmeacas)}
        />
        {sujo && (
          <Button type="button" onClick={salvar} disabled={salvando} className="w-fit">
            Salvar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
