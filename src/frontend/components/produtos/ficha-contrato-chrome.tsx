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

// PF2-07: sub-abas da aba "Agenda" -- "Agenda" (conteúdo atual de
// /contratos/[id]/agenda) e "Encontros" (conteúdo atual de
// /contratos/[id]/encontros), nenhuma lógica de negócio das duas muda.
const SUB_ABAS_AGENDA: { id: "agenda" | "encontros"; label: string }[] = [
  { id: "agenda", label: "Agenda" },
  { id: "encontros", label: "Encontros" },
];

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
  const rotaAgenda = `${base}/agenda`;
  const rotaEncontros = `${base}/encontros`;
  // PF2-07 (.specs/features/pente-fino-2026-09-23/spec.md): Encontros passa
  // a ser alcançável também como sub-aba de Agenda, sem deixar de ser uma
  // rota própria -- 6 pontos do código (encontro-popover.tsx,
  // gargalos-tabela.tsx) já navegam direto pra `${base}/encontros`, e
  // quebrar esses links não é o pedido (o pedido é só reposicionar a
  // navegação). Por isso a sub-aba é feita com Link/pathname (RouteTabs),
  // não com querystring como AbaIncidencia (Linha do Tempo/Ciclo de Vida) --
  // aquele padrão troca de "visão" na MESMA rota, e aqui as duas visões
  // precisam continuar sendo 2 rotas de verdade.
  const naAgendaOuEncontros = pathname === rotaAgenda || pathname === rotaEncontros;
  const slugProduto = slugDoProduto(contrato.nomeProduto);
  // A árvore-grade do Planejamento precisa de mais largura que as outras abas
  // (pedido do Pedro, 2026-08-14). Antes só `{children}` escapava do limite e
  // o cabeçalho ficava numa coluna estreita e centralizada, com a margem
  // esquerda em ponto diferente da do conteúdo -- o desalinhamento que
  // divergia do Figma (57:671, margem única de 48px). Agora cabeçalho, abas
  // e conteúdo dividem UM contêiner; só o teto muda por rota.
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
    // PF2-07: "Agenda" fica ativa também em `/encontros` -- a sub-aba mora
    // dentro da aba-pai, então a aba-pai precisa continuar destacada quando
    // a sub-aba Encontros é a rota atual.
    {
      href: rotaAgenda,
      label: "Agenda",
      ativoSe: (p) => p === rotaAgenda || p.startsWith(`${rotaAgenda}/`) || p === rotaEncontros || p.startsWith(`${rotaEncontros}/`),
    },
    { href: `${base}/diagnostico`, label: "Diagnóstico" },
    { href: `${base}/planejamento`, label: "Planejamento Estratégico" },
    { href: `${base}/gip`, label: "GIP" },
    { href: `${base}/formularios`, label: "Formulários" },
    { href: `${base}/vinculos`, label: "Gestão da equipe" },
    { href: `${base}/fatos-registros`, label: "Fatos Geradores e Registros" },
  ];
  // Pedro, 23/09: GIP, Formulários e Gestão da equipe não existem no PLL --
  // o mentorado não tem GIP (é da Estratégia), Formulários do PLL acontecem
  // dentro do fluxo de Mentoria (aba Agenda), e a equipe do PLL é o
  // mentor/mentorado já mostrado em Informações Gerais, não um vínculo N:N
  // como Assessores/CG.
  const ABAS_OCULTAS_PLL = new Set(["GIP", "Formulários", "Gestão da equipe"]);
  const ehPll = contrato.nomeProduto === "PLL";
  const abas: RouteTabItem[] = todasAbas.filter((aba) => {
    if (aba.label === "Informações Gerais" && contrato.tipoContratante !== "mandato") return false;
    if (ehPll && ABAS_OCULTAS_PLL.has(aba.label)) return false;
    return true;
  });

  return (
    <div
      className={cn(
        "mx-auto grid w-full gap-4 px-6 py-6 md:px-12",
        eTelaDePlanejamento ? "max-w-[1800px]" : "max-w-[1440px]"
      )}
    >
      <div className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            {/* Figma 328:1156 / 57:671: Anton caixa alta vinho, ~40px. Sem
                `font-bold` -- Anton só tem peso 400. */}
            <h1 className="font-heading text-4xl uppercase text-secondary">
              {contrato.nomeContratante}
            </h1>
            <p className="text-sm text-muted-foreground">
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
              <Button asChild variant="vinho" size="lg" className="px-4">
                <Link href={`/produtos/${slugProduto}/dashboard`}>
                  <ArrowLeft className="size-4" />
                  Voltar ao dashboard
                </Link>
              </Button>
            )}
            <Button asChild size="lg" className="px-4 font-bold">
              <Link href={`${base}/fatos-registros`}>Fatos Geradores e Registros</Link>
            </Button>
          </div>
        </div>

        <RouteTabs items={abas} />
      </div>

      <div className="pt-2 grid gap-4">
        {/* PF2-07: sub-abas "Agenda"/"Encontros", mesmo padrão visual das
            sub-abas "Linha do Tempo"/"Ciclo de Vida" de Fatos Geradores e
            Registros (aba-incidencia.tsx) -- border inferior de destaque +
            texto em negrito/secondary na sub-aba ativa. */}
        {naAgendaOuEncontros && (
          <div role="tablist" className="flex gap-3">
            {SUB_ABAS_AGENDA.map((subAba) => {
              const href = subAba.id === "agenda" ? rotaAgenda : rotaEncontros;
              const ativo = pathname === href;
              return (
                <Link
                  key={subAba.id}
                  href={href}
                  role="tab"
                  aria-selected={ativo}
                  className={cn(
                    "border-b-[3px] px-1 py-2 text-sm",
                    ativo
                      ? "border-secondary font-bold text-secondary"
                      : "border-transparent font-medium text-muted-foreground hover:text-foreground"
                  )}
                >
                  {subAba.label}
                </Link>
              );
            })}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
