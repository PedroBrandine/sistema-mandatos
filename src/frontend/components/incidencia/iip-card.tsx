"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { buscarIipContrato } from "@backend/queries/incidencia";
import { atualizaIipContrato } from "@backend/rpc/iip";
import { createClient } from "@backend/supabase/client";

import { Card, CardContent } from "@/components/ui/card";
import { ErroInline } from "@/components/ui/erro-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { BadgesDimensoesIip } from "./dimensoes-iip";
import { CLASSE_KPI_CARD, CLASSE_KPI_NUMERO, CLASSE_KPI_ROTULO } from "./kpi-estilo";

export interface IipKpiCardProps {
  // Título do cartão. "IIP — Índ. de impacto" no contrato; o agregado troca
  // por "IIP médio — Índ. de impacto" (é a média dos mandatos do recorte).
  titulo?: string;
  carregando?: boolean;
  erro?: string | null;
  onRetry?: () => void;
  valor: number | null;
  d1: number | null;
  d2: number | null;
  d3: number | null;
  // Texto quando `valor` é null (AD-005) -- a causa muda por chamador.
  mensagemVazia?: string;
  formatarValor?: (valor: number) => string;
  className?: string;
}

// Figma 109:73. Só desenha: quem busca o dado (por contrato ou agregado por
// produto) decide o que é `valor` e o que dizer quando ele não existe.
export function IipKpiCard({
  titulo = "IIP — Índ. de impacto",
  carregando,
  erro,
  onRetry,
  valor,
  d1,
  d2,
  d3,
  mensagemVazia = "sem dado suficiente",
  formatarValor = String,
  className,
}: IipKpiCardProps) {
  let corpo: ReactNode;
  if (carregando) {
    corpo = <Skeleton className="h-10 w-full rounded-md" />;
  } else if (erro) {
    corpo = <ErroInline mensagem={erro} onRetry={onRetry} />;
  } else {
    // Só mostra o detalhe por dimensão quando há IIP calculado (AD-064) --
    // sem isso os 3 componentes também são null, mesma regra de "sem dado".
    const temValor = valor !== null;
    corpo = (
      <>
        <p className="text-[11px] font-bold text-muted-foreground">Somente realizados</p>
        <div className="flex items-center gap-4">
          <p className={CLASSE_KPI_NUMERO}>
            {temValor ? (
              formatarValor(valor)
            ) : (
              <>
                —<span className="sr-only">Sem dado suficiente</span>
              </>
            )}
          </p>
          {temValor ? (
            <BadgesDimensoesIip d1={d1 ?? 0} d2={d2 ?? 0} d3={d3 ?? 0} formatarValor={formatarValor} />
          ) : (
            <p className="text-xs text-muted-foreground">{mensagemVazia}</p>
          )}
        </div>
      </>
    );
  }

  return (
    <Card className={cn(CLASSE_KPI_CARD, className)} role="group" aria-label={`${titulo} (provisório)`}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className={CLASSE_KPI_ROTULO}>{titulo}</p>
          <p className="text-[10px] text-muted-foreground italic">(provisório)</p>
        </div>
        {corpo}
      </CardContent>
    </Card>
  );
}

export interface IipCardProps {
  idContrato: number;
  className?: string;
}

// INC-04, INC-05, INC-06, INC-07, INC-08. Cartão de IIP da faixa de KPIs do
// Ciclo de Vida (Figma 109:73): rótulo + "(provisório)", "Somente realizados",
// número grande e a quebra D1/D2/D3 em badges. Ao montar: refresh síncrono de
// mv_iip_contrato (Assumption #3, atualizaIipContrato) seguido da leitura de
// vw_iip_contrato (1 linha por contrato, T8).
//
// iip_provisorio null nunca vira "0" na UI (AD-005) -- 2 causas distintas
// levam a 2 textos distintos, literal de spec.md: nr_fatos null (nenhum Fato
// Gerador ainda, INC-07) mostra "sem fato gerador ainda"; nr_fatos presente
// mas iip_provisorio null (toda ref_tipologia sem id_indicador ainda,
// Assumption #1b/INC-08) mostra "sem dado suficiente" -- mantendo a contagem
// real de fatos como contexto, nunca substituída por um número parcial.
export function IipCard({ idContrato, className }: IipCardProps) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dado, setDado] = useState<{
    nrFatos: number | null;
    iipProvisorio: number | null;
    componenteD1: number | null;
    componenteD2: number | null;
    componenteD3: number | null;
  } | null>(null);

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
    // Falso-positivo: os setState de `carregar` rodam depois do `await`, e a
    // função também serve ao "tentar de novo" do ErroInline, então não cabe
    // dentro do efeito (mesmo racional de fatos-registros/page.tsx).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  // 2 causas distintas de "sem IIP" (ver comentário acima) => 2 textos.
  const semFato = !dado || dado.nrFatos === null;
  const mensagemVazia = semFato
    ? "sem fato gerador ainda"
    : `sem dado suficiente · ${dado?.nrFatos} fatos geradores`;

  return (
    <IipKpiCard
      carregando={carregando}
      erro={erro}
      onRetry={() => void carregar()}
      valor={semFato ? null : (dado?.iipProvisorio ?? null)}
      d1={dado?.componenteD1 ?? null}
      d2={dado?.componenteD2 ?? null}
      d3={dado?.componenteD3 ?? null}
      mensagemVazia={mensagemVazia}
      className={className}
    />
  );
}
