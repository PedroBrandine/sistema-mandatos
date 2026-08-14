"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { createClient } from "@backend/supabase/client";
import { buscarCarteiraPonderada, buscarCarteiraPonderadaMensal, type FiltroRecorte } from "@backend/queries/visao-gerencial";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartLinhaEvolucao } from "@/components/visao-gerencial/chart-linha-evolucao";
import { corPorId, CorOutras } from "@/components/visao-gerencial/paleta-serie";

type Papel = "gestora" | "mentor";

// GG-05, GG-06 + visao-gerencial-g3-g6 T23 (GER-09, GER-12). `papel`
// (alternador Gestora/Mentor) continua client-side -- é modo de agregação
// (qual dimensão o card está exibindo), não um recorte (design.md/context.md:
// "não é um filtro de recorte, é modo de agregação"). `filtro` vem da barra
// de recorte global (prop do bloco pai) -- nenhum Select próprio de
// produto/Gestora sobrevive aqui (regra "nenhum bloco com filtro próprio
// contraditório"). Evolução: buscarCarteiraPonderadaMensal, cor por
// id_usuario_gestora (corPorId) -- nunca muda com o ranking.
export function CarteiraPonderadaCard({ filtro }: { filtro: FiltroRecorte }) {
  const [papel, setPapel] = useState<Papel>("gestora");

  const {
    data: linhas,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["carteira-ponderada", papel, filtro],
    queryFn: () => buscarCarteiraPonderada(createClient(), papel, filtro),
  });

  const { data: evolucao } = useQuery({
    queryKey: ["carteira-ponderada-mensal", filtro],
    queryFn: () => buscarCarteiraPonderadaMensal(createClient(), filtro),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carteira ponderada (G1)</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Select value={papel} onValueChange={(v) => setPapel(v as Papel)}>
          <SelectTrigger className="bg-background text-xs sm:w-48">
            <SelectValue placeholder="Ver por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gestora">Ver por Gestora</SelectItem>
            <SelectItem value="mentor">Ver por Mentor</SelectItem>
          </SelectContent>
        </Select>

        {isError ? (
          <ErroInline mensagem="Não foi possível carregar a carteira ponderada." onRetry={() => refetch()} />
        ) : isLoading ? (
          <CarregandoSkeleton variante="list" linhas={3} />
        ) : !linhas || linhas.length === 0 ? (
          <EstadoVazio titulo="Nenhum contrato ativo encontrado" mensagem="Ajuste o recorte da barra." />
        ) : (
          <ul className="grid gap-2">
            {linhas.map((linha) => (
              <li
                key={linha.idUsuario}
                className="grid grid-cols-[1fr_auto] items-start gap-2 rounded-lg border border-border/60 px-3 py-2"
              >
                <div className="grid gap-1">
                  <p className="font-medium">{linha.nomeUsuario}</p>
                  <p className="text-xs text-muted-foreground">
                    {linha.qtdContratos} contrato(s) ativo(s)
                    {linha.atingimentoMedio !== null
                      ? ` · atingimento médio ${linha.atingimentoMedio.toFixed(0)}%`
                      : ""}
                  </p>
                  {linha.qtdContratosSemPeso > 0 ? (
                    <Alert>
                      <AlertTriangle />
                      <AlertDescription>
                        {linha.qtdContratosSemPeso} contrato(s) sem peso cadastrado em ref_peso_etapa -- excluído(s)
                        da soma.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </div>
                <p className="font-heading text-2xl font-bold">{linha.somaPeso}</p>
              </li>
            ))}
          </ul>
        )}

        {evolucao && evolucao.length > 0 && (
          <ChartLinhaEvolucao
            titulo="Evolução mensal da carteira ponderada"
            series={evolucao.map((s) => ({
              id: s.idUsuarioGestora === null ? "outras" : String(s.idUsuarioGestora),
              nome: s.nomeGestora,
              cor: s.idUsuarioGestora === null ? CorOutras : corPorId(s.idUsuarioGestora),
              pontos: s.pontos.map((p) => ({ mes: p.mes, valor: p.somaPeso })),
            }))}
          />
        )}
      </CardContent>
    </Card>
  );
}
