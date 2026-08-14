import { Suspense } from "react";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";

import { createClient } from "@backend/supabase/server";
import { buscarPapelGlobalAtual } from "@backend/queries/usuario";
import type { FiltroRecorte } from "@backend/queries/visao-gerencial";
import { PRODUTO_SLUGS } from "@backend/queries/produto";
import { NaoAutorizado } from "@/components/app-shell/nao-autorizado";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { BarraRecorte } from "@/components/visao-gerencial/barra-recorte";
import { SaudeOperacaoBloco } from "@/components/visao-gerencial/saude-operacao-bloco";
import { DistribuicaoEtapasBloco } from "@/components/visao-gerencial/distribuicao-etapas-bloco";
import { IndicadoresBloco } from "@/components/visao-gerencial/indicadores-bloco";
import { GargalosBloco } from "@/components/visao-gerencial/gargalos-bloco";

type SearchParams = Record<string, string | string[] | undefined>;

function primeiroValor(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

function parseFiltroRecorte(searchParams: SearchParams): FiltroRecorte {
  const numeroOuUndefined = (chave: string): number | undefined => {
    const bruto = primeiroValor(searchParams[chave]);
    if (bruto === undefined) return undefined;
    const n = Number(bruto);
    return Number.isFinite(n) ? n : undefined;
  };

  return {
    idProduto: numeroOuUndefined("produto"),
    idProjeto: numeroOuUndefined("projeto"),
    idGestora: numeroOuUndefined("gestora"),
    idMentor: numeroOuUndefined("mentor"),
    mesesEvolucao: numeroOuUndefined("periodo"),
  };
}

// visao-gerencial-g3-g6, T19-T30: primeiro Server Component + gate de papel
// server-side do projeto (design.md, Tech Decisions). GER-01 -- mentor/
// assessor bloqueados mesmo por URL direta, antes de qualquer bloco de
// dado renderizar (checagem acontece aqui, não no proxy de sessão --
// src/backend/supabase/proxy.ts só resolve autenticado-ou-não por padrão do
// projeto, lição L-009). Ordem visual fixa (GER-06): BarraRecorte (sticky)
// -> Bloco 0 (G3+G4, saúde do próprio sistema) -> Bloco 1 (onde estão os
// mandatos) -> Bloco 2 (G1/G2/G5/G6/IIP) -> Bloco 3 (gargalos) -- G3/G4
// sempre acima de qualquer indicador de mandato. Cada bloco em seu próprio
// <Suspense> -- um bloco falhando não derruba os outros (12. Estados).
export default async function VisaoGerencialPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const client = await createClient();
  const papel = await buscarPapelGlobalAtual(client);

  if (papel === "mentor" || papel === "assessor") {
    return (
      <div className="mx-auto grid max-w-6xl gap-6 p-6">
        <NaoAutorizado />
      </div>
    );
  }

  const filtro = parseFiltroRecorte(await searchParams);

  return (
    <div className="grid gap-6 pb-6">
      <BarraRecorte />

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-6">
        <Suspense fallback={<CarregandoSkeleton variante="cards" linhas={2} />}>
          <SaudeOperacaoBloco filtro={filtro} />
        </Suspense>

        <Suspense fallback={<CarregandoSkeleton variante="list" linhas={4} />}>
          <DistribuicaoEtapasBloco filtro={filtro} />
        </Suspense>

        <IndicadoresBloco filtro={filtro} />

        <Card>
          <CardHeader>
            <CardTitle>Ir para o Kanban</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(PRODUTO_SLUGS).map(([slug, info]) => (
              <Link key={slug} href={`/produtos/${slug}/dashboard`}>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs font-medium">
                  <LayoutDashboard className="size-3.5" />
                  {info.label}
                </Button>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Suspense fallback={<CarregandoSkeleton variante="table" linhas={6} />}>
          <GargalosBloco filtro={filtro} />
        </Suspense>
      </div>
    </div>
  );
}
