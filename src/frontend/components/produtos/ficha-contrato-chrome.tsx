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
import { FatoGeradorForm } from "@/components/incidencia/fato-gerador-form";
import { IipCard } from "@/components/incidencia/iip-card";
import { InsightForm } from "@/components/incidencia/insight-form";
import { Button } from "@/components/ui/button";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
  const [dialogInsightAberto, setDialogInsightAberto] = useState(false);
  const [dialogFatoGeradorAberto, setDialogFatoGeradorAberto] = useState(false);
  // T31: força IipCard a remontar (e refazer o refresh síncrono de
  // mv_iip_contrato) depois de um Fato Gerador novo -- Insight não afeta o
  // IIP, não precisa disso.
  const [iipRefreshKey, setIipRefreshKey] = useState(0);

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

  // "Informações Gerais" (dados de TSE) só existe pra contrato de mandato --
  // coalizão não tem candidatura/perfil TSE. Primeira aba, antes das etapas
  // (pedido de Pedro, 2026-08-11, após o fechamento da feature).
  const abas: RouteTabItem[] = [
    ...(contrato.tipoContratante === "mandato"
      ? [{ href: `${base}/informacoes`, label: "Informações Gerais" }]
      : []),
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
          <IipCard key={iipRefreshKey} idContrato={idContrato} />

          <Dialog open={dialogInsightAberto} onOpenChange={setDialogInsightAberto}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                Registrar Insight
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Registrar Insight</DialogTitle>
              </DialogHeader>
              <InsightForm
                idContrato={idContrato}
                onConcluido={() => {
                  setDialogInsightAberto(false);
                  toast.success("Insight registrado com sucesso!");
                }}
                onCancelar={() => setDialogInsightAberto(false)}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={dialogFatoGeradorAberto} onOpenChange={setDialogFatoGeradorAberto}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                Registrar Fato Gerador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Registrar Fato Gerador</DialogTitle>
              </DialogHeader>
              <FatoGeradorForm
                idContrato={idContrato}
                onConcluido={() => {
                  setDialogFatoGeradorAberto(false);
                  setIipRefreshKey((k) => k + 1);
                  toast.success("Fato Gerador registrado com sucesso!");
                }}
                onCancelar={() => setDialogFatoGeradorAberto(false)}
              />
            </DialogContent>
          </Dialog>

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
