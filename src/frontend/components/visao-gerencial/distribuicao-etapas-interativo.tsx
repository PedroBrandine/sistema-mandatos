"use client";

import { useState } from "react";

import type { FiltroRecorte, LinhaDistribuicaoEtapa } from "@backend/queries/visao-gerencial";
import { ChartBarraHorizontal } from "@/components/visao-gerencial/chart-barra-horizontal";
import { EtapaContratosModal } from "@/components/visao-gerencial/etapa-contratos-modal";

// visao-gerencial-g3-g6, T24 (GER-10/GER-11). Client Component -- `onClick`
// é definido AQUI DENTRO (Client -> Client), nunca recebido como prop vinda
// do Server Component pai (achado de T23: função como prop quebra esse
// boundary). `linhas` (já ordenadas por ref_etapa.ordem, GER-10) é
// serializável -- passada como prop normal do bloco Server.
export function DistribuicaoEtapasInterativo({
  linhas,
  filtro,
}: {
  linhas: LinhaDistribuicaoEtapa[];
  filtro: FiltroRecorte;
}) {
  const [etapaSelecionada, setEtapaSelecionada] = useState<{ id: number; nome: string } | null>(null);

  // SPEC_DEVIATION: o pedido original pede atraso como "segmento de status
  // DENTRO da barra" (barra empilhada: parte no prazo + parte atrasada).
  // ChartBarraHorizontal (T21) é de valor único por item, não empilhado --
  // estender pra 2 séries seria escopo novo no componente genérico. Mitigado
  // mantendo a regra que essa exigência protege (nunca só cor): a barra
  // inteira muda de cor quando há atraso E o rótulo sempre declara a
  // contagem em texto, nunca cor sozinha.
  const itens = linhas.map((l) => ({
    id: String(l.idEtapa),
    rotulo: l.qtdAtrasada > 0 ? `${l.nomeEtapa} (${l.qtdAtrasada} atrasado(s))` : l.nomeEtapa,
    valor: l.qtdAtiva,
    cor: l.qtdAtrasada > 0 ? "var(--destructive)" : undefined,
  }));

  return (
    <>
      <ChartBarraHorizontal
        titulo="Contratos por etapa"
        itens={itens}
        ordenarPorValor={false}
        onItemClick={(id) => {
          const linha = linhas.find((l) => String(l.idEtapa) === id);
          if (linha) setEtapaSelecionada({ id: linha.idEtapa, nome: linha.nomeEtapa });
        }}
      />
      <EtapaContratosModal
        idEtapa={etapaSelecionada?.id ?? null}
        nomeEtapa={etapaSelecionada?.nome ?? ""}
        filtro={filtro}
        onClose={() => setEtapaSelecionada(null)}
      />
    </>
  );
}
