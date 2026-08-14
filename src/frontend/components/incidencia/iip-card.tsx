"use client";

import { useCallback, useEffect, useState } from "react";

import { buscarIipContrato } from "@backend/queries/incidencia";
import { atualizaIipContrato } from "@backend/rpc/iip";
import { createClient } from "@backend/supabase/client";

import { ErroInline } from "@/components/ui/erro-inline";
import { Skeleton } from "@/components/ui/skeleton";

export interface IipCardProps {
  idContrato: number;
}

// INC-04, INC-05, INC-06, INC-07, INC-08. Card compacto na ficha do contrato,
// perto dos botões de Insight/Fato Gerador (mesmo tamanho de componente, ver
// context.md "Card de IIP replica o padrão visual dos botões já existentes
// -- não uma seção nova e destacada"). Ao montar: refresh síncrono de
// mv_iip_contrato (Assumption #3, atualizaIipContrato) seguido da leitura de
// vw_iip_contrato (1 linha por contrato, T8).
//
// iip_provisorio null nunca vira "0" na UI (AD-005) -- 2 causas distintas
// levam a 2 textos distintos, literal de spec.md: nr_fatos null (nenhum Fato
// Gerador ainda, INC-07) mostra "sem fato gerador ainda"; nr_fatos presente
// mas iip_provisorio null (toda ref_tipologia sem id_indicador ainda,
// Assumption #1b/INC-08) mostra "sem dado suficiente" -- mantendo a contagem
// real de fatos como contexto, nunca substituída por um número parcial.
export function IipCard({ idContrato }: IipCardProps) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dado, setDado] = useState<{ nrFatos: number | null; iipProvisorio: number | null } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const supabase = createClient();
    try {
      await atualizaIipContrato(supabase);
      const resultado = await buscarIipContrato(supabase, idContrato);
      setDado(resultado);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao carregar o IIP.");
    } finally {
      setCarregando(false);
    }
  }, [idContrato]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregando) {
    return <Skeleton className="h-8 w-64 rounded-md" />;
  }

  if (erro) {
    return <ErroInline mensagem={erro} onRetry={() => void carregar()} />;
  }

  let texto: string;
  if (!dado || dado.nrFatos === null) {
    texto = "IIP (provisório): sem fato gerador ainda";
  } else if (dado.iipProvisorio === null) {
    texto = `IIP (provisório): sem dado suficiente · ${dado.nrFatos} fatos geradores`;
  } else {
    texto = `IIP (provisório): ${dado.iipProvisorio} · ${dado.nrFatos} fatos geradores`;
  }

  return (
    <div className="flex items-center rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
      {texto}
    </div>
  );
}
