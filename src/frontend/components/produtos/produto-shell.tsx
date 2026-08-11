"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PRODUTO_SLUGS, type ProdutoSlug } from "@backend/queries/produto";
import { RouteTabs } from "@/components/app-shell/route-tabs";
import { useProdutoAtual } from "@/hooks/use-produto-atual";

interface ProdutoShellProps {
  slug: ProdutoSlug;
  children: React.ReactNode;
}

// NAV-02: cabeçalho (nome do produto + link "voltar ao hub") + RouteTabs com
// as 4 abas da área de produto. Abas são rotas reais -- trocar de aba não
// perde o produto selecionado (AC2), o slug vem sempre da própria URL. Ver
// design.md, Components -> ProdutoShell.
export function ProdutoShell({ slug, children }: ProdutoShellProps) {
  const { data: produto } = useProdutoAtual(slug);
  const base = `/produtos/${slug}`;

  const abas = [
    { href: `${base}/dashboard`, label: "Dashboard" },
    { href: `${base}/agenda`, label: "Agenda" },
    { href: `${base}/contratos`, label: "Contratos" },
    { href: `${base}/novo-contrato`, label: "Cadastro de novo Contrato" },
  ];

  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-6">
      <div className="space-y-1">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Voltar ao hub
        </Link>
        <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">
          {produto?.nome ?? PRODUTO_SLUGS[slug].label}
        </h1>
      </div>

      <RouteTabs items={abas} />

      <div className="pt-2">{children}</div>
    </div>
  );
}
