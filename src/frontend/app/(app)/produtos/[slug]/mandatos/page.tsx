"use client";

import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { createClient } from "@backend/supabase/client";
import { buscarMandatosLista, type ContratoCard } from "@backend/queries/mandatos-lista";
import { buscarEtapasDoProduto } from "@backend/queries/contrato";
import type { ProdutoSlug } from "@backend/queries/produto";
import { useProdutoAtual } from "@/hooks/use-produto-atual";
import { FiltrosMandatos, type OpcaoFiltroMandatos, type ValorFiltrosMandatos } from "@/components/estrategia/filtros-mandatos";
import { ListaMandatos } from "@/components/estrategia/lista-mandatos";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";

// EST-09 (T21b, design.md/tasks.md). AD-046: tela de leitura -- caminho
// feliz de cada AC. Mesma lacuna de planejamento de T18b (ver tasks.md,
// "### T21b"): T13 só renomeou a aba e moveu a rota, preservando a lista
// antiga sem os 5 filtros do Figma 202:554. Esta task substitui o conteúdo
// por FiltrosMandatos (T21) + ListaMandatos (T20), consumindo
// buscarMandatosLista (T19) com o estado do filtro na página.
async function buscarGestoras(): Promise<OpcaoFiltroMandatos[]> {
  const { data, error } = await createClient()
    .from("dim_usuario")
    .select("id_usuario, nome")
    .eq("papel_global", "gestora")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data ?? []).map((u) => ({ id: u.id_usuario, nome: u.nome }));
}

async function buscarProjetosAtivos(): Promise<OpcaoFiltroMandatos[]> {
  const { data, error } = await createClient()
    .from("ref_projeto")
    .select("id_projeto, nome")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data ?? []).map((p) => ({ id: p.id_projeto, nome: p.nome }));
}

export default function ProdutoMandatosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params) as { slug: ProdutoSlug };
  const { data: produto } = useProdutoAtual(slug);
  const [filtro, setFiltro] = useState<ValorFiltrosMandatos>({});

  const { data: gestoras } = useQuery({ queryKey: ["mandatos-lista-gestoras"], queryFn: buscarGestoras });
  const { data: projetos } = useQuery({ queryKey: ["mandatos-lista-projetos"], queryFn: buscarProjetosAtivos });
  const { data: etapas } = useQuery({
    queryKey: ["mandatos-lista-etapas", produto?.idProduto],
    queryFn: () => buscarEtapasDoProduto(createClient(), produto!.idProduto),
    enabled: produto !== undefined,
  });

  const { data: mandatos } = useQuery<ContratoCard[]>({
    queryKey: ["mandatos-lista", produto?.idProduto, filtro],
    queryFn: () => buscarMandatosLista(createClient(), { idProduto: produto!.idProduto, ...filtro }),
    enabled: produto !== undefined,
  });

  const opcoesEtapa = useMemo<OpcaoFiltroMandatos[]>(
    () => (etapas ?? []).map((e) => ({ id: e.idEtapa, nome: e.nome })),
    [etapas]
  );

  if (produto === undefined || mandatos === undefined) {
    return <CarregandoSkeleton />;
  }

  return (
    <div className="grid gap-7">
      {/* Ajuste de fidelidade visual -- Mandatos (2026-09-14, Figma 202:554
          "Introdução"): título + subtítulo da seção, ausentes desde T21b --
          ProdutoShell (produto-shell.tsx) só renderiza o título do produto
          ("ESTRATÉGIA") e as abas, nunca o título de cada aba. */}
      <div>
        <h2 className="text-2xl font-bold text-secondary">Mandatos</h2>
        <p className="text-sm text-muted-foreground">Acompanhe vigência, etapa e responsáveis de todos os contratos.</p>
      </div>
      <FiltrosMandatos
        filtro={filtro}
        onChange={setFiltro}
        gestoras={gestoras ?? []}
        projetos={projetos ?? []}
        etapas={opcoesEtapa}
        contagem={mandatos.length}
      />
      <ListaMandatos mandatos={mandatos} />
    </div>
  );
}
