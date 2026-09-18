"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@backend/supabase/client";
import { buscarContratoParaFicha, type ContratoParaFicha } from "@backend/queries/contrato";
import { PRODUTO_SLUGS } from "@backend/queries/produto";

import { RouteTabs, type RouteTabItem } from "@/components/app-shell/route-tabs";
import { Button } from "@/components/ui/button";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { cn } from "@/lib/utils";

// PF-11 (.specs/features/pente-fino-2026-09/tasks.md T12). PRODUTO_SLUGS
// mapeia slug -> nome; aqui precisamos do sentido inverso (nomeProduto já
// vem de buscarContratoParaFicha). Só 3 entradas -- não vale criar um índice
// dedicado em produto.ts por causa de 1 consumidor.
function slugDoProduto(nomeProduto: string): string | null {
  return Object.entries(PRODUTO_SLUGS).find(([, info]) => info.nome === nomeProduto)?.[0] ?? null;
}

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
  const slugProduto = slugDoProduto(contrato.nomeProduto);
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
            {/* Registrar Insight / Registrar Fato Gerador saíram daqui
                (AD-057): a aba "Fatos Geradores e Registros" (T25) é agora a
                casa única de escrita das 4 entidades de Incidência.
                PF-11 (T12): o card IIP provisório (sem dado real por trás,
                AD-005) sai daqui -- vira link pra aba de Incidência +
                voltar pro dashboard do produto. IipCard continua existindo:
                incidencia-kpis.tsx (Ciclo de Vida, FGC-14) é outro
                consumidor real, não órfão. */}
            {slugProduto && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/produtos/${slugProduto}/dashboard`}>
                  <ArrowLeft className="size-4" />
                  Voltar ao dashboard
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/fatos-registros`}>Fatos Geradores e Registros</Link>
            </Button>
          </div>
        </div>

        <RouteTabs items={abas} />
      </div>

      <div className={cn("pt-2", !eTelaDePlanejamento && "mx-auto w-full max-w-6xl")}>{children}</div>
    </div>
  );
}
