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

export function ProdutoShell({ slug, children }: ProdutoShellProps) {
  const { data: produto } = useProdutoAtual(slug);
  const base = `/produtos/${slug}`;
  const tituloProduto = produto?.nome ?? PRODUTO_SLUGS[slug].label;

  const abas = [
    { href: `${base}/dashboard`, label: "Dashboard" },
    { href: `${base}/agenda`, label: "Agenda" },
    { href: `${base}/mandatos`, label: "Mandatos" },
    { href: `${base}/novo-contrato`, label: "Novo Contrato" },
  ];

  // O Quadro de Acompanhamento do Dashboard tem colunas de largura fixa
  // (w-72) e rola na horizontal: preso nos ~1152px de `max-w-6xl`, ele
  // mostrava sempre 3,5 colunas e cortava a 4ª em qualquer monitor, com o
  // espaço extra da tela virando margem vazia -- relato do Pedro,
  // 2026-09-11. Teto alto e fluido em vez de `max-w-6xl` para que título,
  // abas e conteúdo cresçam juntos (sem o desalinhamento de um children
  // full-bleed); quem precisa de largura de leitura curta, como o
  // formulário de Novo Contrato, aplica o próprio max-w.
  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 p-6 md:p-8">
      <div className="flex flex-col gap-3">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 -ml-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar ao hub
        </Link>
        <div className="flex items-center justify-between">
           <h1 className="font-heading text-3xl font-semibold tracking-tight text-primary">
             {tituloProduto}
           </h1>
           {/* Futuro botão de ações globais do produto */}
        </div>
      </div>

      <RouteTabs items={abas} />

      <div className="pt-4">{children}</div>
    </div>
  );
}
