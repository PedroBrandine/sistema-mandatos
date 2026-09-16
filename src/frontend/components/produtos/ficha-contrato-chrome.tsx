"use client";

import { useEffect, useState } from "react";
import { notFound, usePathname } from "next/navigation";
import { toast } from "sonner";

import { createClient } from "@backend/supabase/client";
import { buscarContratoParaFicha, type ContratoParaFicha } from "@backend/queries/contrato";

import { RouteTabs, type RouteTabItem } from "@/components/app-shell/route-tabs";
import { FatoGeradorForm } from "@/components/incidencia/fato-gerador-form";
import { IipCard } from "@/components/incidencia/iip-card";
import { InsightForm } from "@/components/incidencia/insight-form";
import { Button } from "@/components/ui/button";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface FichaContratoChromeProps {
  idContrato: number;
  children: React.ReactNode;
}

// NAV-04/NAV-07/FMC-01..04 (.specs/features/ficha-mandato-contrato):
// cabeçalho (ramificado por tipo_contratante) + RouteTabs com a barra
// funcional fixa de 8 abas (mandato) / 7 abas (coalizão, sem "Informações
// Gerais") + ações Insight/Fato Gerador, compartilhados por toda sub-rota de
// /contratos/[id]. A barra não deriva mais de `ref_etapa` (AC2) -- as rotas
// de etapa continuam existindo fora da navegação, mesmo precedente de
// NAV-14/15 (A-01).
// contrato: undefined=carregando, null=confirmado ausente -- notFound() só é
// chamado no corpo do render (nunca dentro do useEffect que popula o
// estado), ver design.md Tech Decisions.
export function FichaContratoChrome({ idContrato, children }: FichaContratoChromeProps) {
  const pathname = usePathname();
  const [contrato, setContrato] = useState<ContratoParaFicha | null | undefined>(undefined);
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
      if (!cancelado) setContrato(encontrado);
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
  // Planejamento Estratégico tem cabeçalho e navegação próprios
  // (PlanejamentoHeader, .specs/features/planejamento-estrategico-redesenho)
  // e a árvore-grade precisa da largura inteira da tela, não dos mesmos
  // ~1152px (`max-w-6xl`) das outras abas de contrato -- pedido do Pedro,
  // 2026-08-14. O cabeçalho/RouteTabs deste chrome continuam com a largura
  // de leitura confortável de sempre; só `{children}` foge do limite quando
  // a rota ativa é a de Planejamento.
  const eTelaDePlanejamento = pathname === `${base}/planejamento`;

  // FMC-01 (AC1): 8 abas funcionais fixas, nesta ordem -- nenhuma derivada de
  // ref_etapa (AC2). "Gestão da equipe" substitui o rótulo antigo
  // "Assessores" na mesma rota /vinculos (AC4/FMC-03). "Informações Gerais"
  // (dados de TSE) só existe pra contrato de mandato -- coalizão não tem
  // candidatura/perfil TSE, então a barra sai com 7 abas (AC3/A-02).
  // "Planejamento Estratégico" absorve o botão solto que existia no
  // cabeçalho (mesma rota /planejamento) -- duas âncoras com o mesmo nome
  // acessível navegando pro mesmo lugar seria redundância, não duas abas.
  const todasAbas: RouteTabItem[] = [
    { href: `${base}/informacoes`, label: "Informações Gerais" },
    { href: `${base}/agenda`, label: "Agenda" },
    { href: `${base}/diagnostico`, label: "Diagnóstico" },
    { href: `${base}/planejamento`, label: "Planejamento Estratégico" },
    { href: `${base}/gip`, label: "GIP" },
    { href: `${base}/formularios`, label: "Formulários" },
    { href: `${base}/vinculos`, label: "Gestão da equipe" },
    { href: `${base}/fatos-registros`, label: "Fatos Geradores e Registros" },
  ];
  const abas: RouteTabItem[] =
    contrato.tipoContratante === "mandato"
      ? todasAbas
      : todasAbas.filter((aba) => aba.label !== "Informações Gerais");

  return (
    <div className="grid gap-4 p-6">
      <div className="mx-auto grid w-full max-w-6xl gap-4">
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
          </div>
        </div>

        <RouteTabs items={abas} />
      </div>

      <div className={cn("pt-2", !eTelaDePlanejamento && "mx-auto w-full max-w-6xl")}>{children}</div>
    </div>
  );
}
