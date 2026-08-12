"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { createClient } from "@backend/supabase/client";
import { buscarPessoasComPapelNoProduto } from "@backend/queries/contrato";
import { buscarCicloEtapa } from "@backend/queries/visao-gerencial";
import { PRODUTO_SLUGS, buscarIdProdutoPorNome, type ProdutoSlug } from "@backend/queries/produto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// GG-03, GG-04 (design.md, Components -> CicloEtapaCard). Renderiza
// buscarCicloEtapa com filtro produto + Gestora -- mediana de dias por
// etapa, "sem dado suficiente" quando mediana === null (spec.md P1 G2 AC3,
// nunca 0). Select de Gestora em cascata (mesmo padrão do Dashboard do
// produto): só habilita depois que um produto é escolhido, já que
// buscarPessoasComPapelNoProduto exige idProduto.
export function CicloEtapaCard() {
  const [slugProduto, setSlugProduto] = useState<ProdutoSlug | "todos">("todos");
  const [idGestora, setIdGestora] = useState<number | "todas">("todas");

  const { data: idProduto } = useQuery({
    queryKey: ["produto-id", slugProduto],
    queryFn: () =>
      slugProduto === "todos" ? null : buscarIdProdutoPorNome(createClient(), PRODUTO_SLUGS[slugProduto].nome),
  });

  const { data: gestoras } = useQuery({
    queryKey: ["pessoas-papel", idProduto, "gestora"],
    queryFn: () => buscarPessoasComPapelNoProduto(createClient(), idProduto as number, "gestora"),
    enabled: idProduto !== null && idProduto !== undefined,
  });

  const {
    data: linhas,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["ciclo-etapa", idProduto, idGestora],
    queryFn: () =>
      buscarCicloEtapa(createClient(), {
        ...(idProduto !== null && idProduto !== undefined ? { idProduto } : {}),
        ...(idGestora !== "todas" ? { idGestora } : {}),
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tempo de ciclo por etapa (G2)</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            value={slugProduto}
            onValueChange={(v) => {
              setSlugProduto(v as ProdutoSlug | "todos");
              setIdGestora("todas");
            }}
          >
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

          <Select
            value={String(idGestora)}
            onValueChange={(v) => setIdGestora(v === "todas" ? "todas" : Number(v))}
            disabled={slugProduto === "todos"}
          >
            <SelectTrigger className="bg-background text-xs">
              <SelectValue placeholder="Filtrar por Gestora" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as Gestoras</SelectItem>
              {(gestoras ?? []).map((g) => (
                <SelectItem key={g.idUsuario} value={String(g.idUsuario)}>
                  {g.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isError ? (
          <ErroInline mensagem="Não foi possível carregar o tempo de ciclo." onRetry={() => refetch()} />
        ) : isLoading ? (
          <CarregandoSkeleton variante="list" linhas={3} />
        ) : !linhas || linhas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma etapa cadastrada"
            mensagem="Ajuste o filtro de produto ou Gestora."
          />
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
      </CardContent>
    </Card>
  );
}
