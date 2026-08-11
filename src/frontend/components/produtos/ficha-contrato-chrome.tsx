"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toast } from "sonner";

import { createClient } from "@backend/supabase/client";
import {
  buscarContratoParaFicha,
  buscarEtapasDoProduto,
  type ContratoParaFicha,
  type EtapaResumo,
} from "@backend/queries/contrato";

import { RouteTabs, type RouteTabItem } from "@/components/app-shell/route-tabs";
import { Button } from "@/components/ui/button";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";

interface FichaContratoChromeProps {
  idContrato: number;
  children: React.ReactNode;
}

// NAV-04/NAV-07: cabeçalho (ramificado por tipo_contratante) + RouteTabs
// (1 aba por ref_etapa + Assessores + Formulários) + ações Insight/Fato
// Gerador/Planejamento, compartilhados por toda sub-rota de /contratos/[id].
// contrato: undefined=carregando, null=confirmado ausente -- notFound() só é
// chamado no corpo do render (nunca dentro do useEffect que popula o
// estado), ver design.md Tech Decisions.
export function FichaContratoChrome({ idContrato, children }: FichaContratoChromeProps) {
  const [contrato, setContrato] = useState<ContratoParaFicha | null | undefined>(undefined);
  const [etapas, setEtapas] = useState<EtapaResumo[]>([]);

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    buscarContratoParaFicha(supabase, idContrato).then((encontrado) => {
      if (cancelado) return;
      setContrato(encontrado);
      if (encontrado) {
        buscarEtapasDoProduto(supabase, encontrado.idProduto).then((lista) => {
          if (!cancelado) setEtapas(lista);
        });
      }
    });

    return () => {
      cancelado = true;
    };
  }, [idContrato]);

  if (contrato === null) {
    notFound();
  }

  if (contrato === undefined) {
    return <CarregandoSkeleton />;
  }

  const base = `/contratos/${idContrato}`;
  const abasEtapas: RouteTabItem[] =
    etapas.length > 0
      ? etapas.map((e) => ({ href: `${base}/etapas/${e.codigo}`, label: e.nome }))
      : [{ href: base, label: "Nenhuma etapa cadastrada" }];

  const abas: RouteTabItem[] = [
    ...abasEtapas,
    { href: `${base}/vinculos`, label: "Assessores" },
    { href: `${base}/formularios`, label: "Formulários" },
  ];

  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">
            {contrato.nomeContratante}
          </h1>
          <p className="text-xs text-muted-foreground">
            {contrato.nomeProduto}
            {contrato.tipoContratante === "mandato" &&
              ` · ${contrato.cargoAtual ?? "—"} · ${contrato.partidoAtual ?? "—"} · ${contrato.sgUf ?? "—"}`}
            {contrato.tipoContratante === "coalizao" &&
              ` · Projeto de origem: ${contrato.nomeProjetoOrigem ?? "—"}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => toast("Em desenvolvimento")}>
            Registrar Insight
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => toast("Em desenvolvimento")}>
            Registrar Fato Gerador
          </Button>
          <Link href={`${base}/planejamento`}>
            <Button type="button" variant="outline" size="sm">
              Planejamento Estratégico
            </Button>
          </Link>
        </div>
      </div>

      <RouteTabs items={abas} />

      <div className="pt-2">{children}</div>
    </div>
  );
}
