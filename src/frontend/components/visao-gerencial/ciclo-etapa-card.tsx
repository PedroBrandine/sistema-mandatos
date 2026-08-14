"use client";

import { useQuery } from "@tanstack/react-query";

import { createClient } from "@backend/supabase/client";
import { buscarCicloEtapa, buscarCicloEtapaMensal, type FiltroRecorte } from "@backend/queries/visao-gerencial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { ChartLinhaEvolucao } from "@/components/visao-gerencial/chart-linha-evolucao";
import { apararUltimosMeses } from "@/components/visao-gerencial/periodo";

// GG-03, GG-04 + visao-gerencial-g3-g6 T23 (GER-09, GER-13). Sem Select
// próprio de produto/Gestora -- `filtro` vem da barra de recorte global
// (prop do bloco pai). Evolução: small multiples via
// buscarCicloEtapaMensal, um mini-gráfico por etapa (série única cada, sem
// legenda -- o título do mini-gráfico já nomeia a etapa).
export function CicloEtapaCard({ filtro }: { filtro: FiltroRecorte }) {
  const {
    data: linhas,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["ciclo-etapa", filtro],
    queryFn: () => buscarCicloEtapa(createClient(), filtro),
  });

  const { data: evolucaoPorEtapa } = useQuery({
    queryKey: ["ciclo-etapa-mensal", filtro],
    queryFn: () => buscarCicloEtapaMensal(createClient(), filtro),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tempo de ciclo por etapa (G2)</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {isError ? (
          <ErroInline mensagem="Não foi possível carregar o tempo de ciclo." onRetry={() => refetch()} />
        ) : isLoading ? (
          <CarregandoSkeleton variante="list" linhas={3} />
        ) : !linhas || linhas.length === 0 ? (
          <EstadoVazio titulo="Nenhuma etapa cadastrada" mensagem="Ajuste o recorte da barra." />
        ) : (
          <ul className="grid gap-2">
            {linhas.map((linha) => (
              <li
                key={linha.idEtapa}
                className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border border-border/60 px-3 py-2"
              >
                <p className="font-medium">{linha.nomeEtapa}</p>
                {linha.mediana === null ? (
                  <p className="text-sm text-muted-foreground">sem dado suficiente</p>
                ) : (
                  <p className="font-heading text-2xl font-bold">
                    {linha.mediana}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      dia(s) · {linha.amostra} amostra(s)
                    </span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {evolucaoPorEtapa && evolucaoPorEtapa.some((e) => e.pontos.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {evolucaoPorEtapa
              .filter((e) => e.pontos.length > 0)
              .map((e) => (
                <ChartLinhaEvolucao
                  key={e.idEtapa}
                  titulo={`Mediana mensal -- ${e.nomeEtapa}`}
                  series={[
                    {
                      id: String(e.idEtapa),
                      nome: e.nomeEtapa,
                      cor: "var(--primary)",
                      pontos: apararUltimosMeses(e.pontos, filtro.mesesEvolucao).map((p) => ({ mes: p.mes, valor: p.mediana })),
                    },
                  ]}
                  unidade="dias"
                />
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
