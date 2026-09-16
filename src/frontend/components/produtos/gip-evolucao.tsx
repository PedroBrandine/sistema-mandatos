"use client";

import { useEffect, useState } from "react";
import type { PostgrestError } from "@supabase/supabase-js";

import { buscarEvolucaoGip, type LinhaEvolucaoGip } from "@backend/queries/gip";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { createClient } from "@backend/supabase/client";
import { resumoEvolucaoGip, rotuloEvolucaoGip } from "@/lib/gip";

import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P1: GIP
// conforme a metodologia vigente" AC8-AC11 (FMC-28). design.md, Components
// -> GipEvolucao. `rotuloEvolucaoGip`/`resumoEvolucaoGip` (T15, lib/gip.ts)
// derivam tudo a partir do `gap` que já vem pronto de vw_gip_evolucao
// (T33) -- este componente nunca recalcula a variação (AD-003/AD-014).
export interface GipEvolucaoProps {
  idContrato: number;
}

export function GipEvolucao({ idContrato }: GipEvolucaoProps) {
  const [linhas, setLinhas] = useState<LinhaEvolucaoGip[] | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setErro(null);
    try {
      const resultado = await buscarEvolucaoGip(createClient(), idContrato);
      setLinhas(resultado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : mapeiaErroRpc(e as PostgrestError).message);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idContrato]);

  if (linhas === undefined) {
    return erro ? <ErroInline mensagem={erro} onRetry={carregar} /> : <CarregandoSkeleton variante="list" />;
  }

  if (erro) {
    return <ErroInline mensagem={erro} onRetry={carregar} />;
  }

  // AC11: o resumo soma exatamente as dimensões com os dois momentos
  // preenchidos -- resumoEvolucaoGip já ignora gap === null (só 1 momento).
  const resumo = resumoEvolucaoGip(linhas);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-semibold">{resumo.evoluiram}</p>
          <p className="text-xs text-muted-foreground">Evoluíram</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-semibold">{resumo.mantiveram}</p>
          <p className="text-xs text-muted-foreground">Mantiveram</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-semibold">{resumo.regrediram}</p>
          <p className="text-xs text-muted-foreground">Regrediram</p>
        </div>
      </div>

      <div className="grid gap-3">
        {linhas.map((linha) => (
          <div key={linha.codigoDimensao} className="grid gap-1 rounded-lg border p-3">
            <p className="text-sm font-medium">{linha.nomeDimensao}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>Início: {linha.nivelInicio ?? "—"}</span>
              <span>Fim: {linha.nivelFim ?? "—"}</span>
              <span className="font-medium text-foreground">{rotuloEvolucaoGip(linha.gap)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
