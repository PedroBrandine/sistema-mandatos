"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { createClient } from "@backend/supabase/client";
import { buscarCarteiraPonderada } from "@backend/queries/visao-gerencial";
import { PRODUTO_SLUGS, buscarIdProdutoPorNome, type ProdutoSlug } from "@backend/queries/produto";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Papel = "gestora" | "mentor";

// GG-05, GG-06 (design.md, Components -> CarteiraPonderadaCard). Renderiza
// buscarCarteiraPonderada com filtro produto + papel -- soma ponderada,
// atingimento médio acessório e alerta de dado incompleto quando
// qtdContratosSemPeso > 0 (spec.md Edge Cases). useQuery (mesmo padrão de
// KanbanBoard/useProdutoAtual, AD-029) -- evita reset manual de estado em
// useEffect.
export function CarteiraPonderadaCard() {
  const [papel, setPapel] = useState<Papel>("gestora");
  const [slugProduto, setSlugProduto] = useState<ProdutoSlug | "todos">("todos");

  const {
    data: linhas,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["carteira-ponderada", papel, slugProduto],
    queryFn: async () => {
      const client = createClient();
      const idProduto =
        slugProduto === "todos"
          ? undefined
          : (await buscarIdProdutoPorNome(client, PRODUTO_SLUGS[slugProduto].nome)) ?? undefined;
      return buscarCarteiraPonderada(client, { papel, idProduto });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carteira ponderada (G1)</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select value={papel} onValueChange={(v) => setPapel(v as Papel)}>
            <SelectTrigger className="bg-background text-xs">
              <SelectValue placeholder="Filtrar por papel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gestora">Gestora</SelectItem>
              <SelectItem value="mentor">Mentor</SelectItem>
            </SelectContent>
          </Select>

          <Select value={slugProduto} onValueChange={(v) => setSlugProduto(v as ProdutoSlug | "todos")}>
            <SelectTrigger className="bg-background text-xs">
              <SelectValue placeholder="Filtrar por produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os produtos</SelectItem>
              {Object.entries(PRODUTO_SLUGS).map(([slug, info]) => (
                <SelectItem key={slug} value={slug}>
                  {info.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isError ? (
          <ErroInline mensagem="Não foi possível carregar a carteira ponderada." onRetry={() => refetch()} />
        ) : isLoading ? (
          <CarregandoSkeleton variante="list" linhas={3} />
        ) : !linhas || linhas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum contrato ativo encontrado"
            mensagem="Ajuste o filtro de papel ou produto."
          />
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
      </CardContent>
    </Card>
  );
}
