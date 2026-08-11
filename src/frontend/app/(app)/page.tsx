import Link from "next/link";
import { ArrowRight, BarChart3, Flag, Handshake, Landmark } from "lucide-react";

import { PRODUTO_SLUGS } from "@backend/queries/produto";
import { Card, CardContent } from "@/components/ui/card";

// NAV-01: hub pós-login -- 4 botões grandes, sempre visíveis (RLS decide o
// que aparece dentro de cada produto, decisão confirmada em spec.md). Sem
// fetch de papel/vínculo aqui -- substitui inteiramente o bento grid +
// explorador TSE anteriores.
const BOTOES_PRODUTO = [
  {
    slug: "estrategia" as const,
    icone: Landmark,
    descricao: "Mandatos, contratos e operação da consultoria estratégica",
  },
  {
    slug: "pll" as const,
    icone: Flag,
    descricao: "Contratos e operação do produto PLL",
  },
  {
    slug: "coalizao" as const,
    icone: Handshake,
    descricao: "Federações, alianças e projetos estratégicos",
  },
];

export default function HubPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">
          Legisla Brasil
        </h1>
        <p className="text-sm text-muted-foreground">
          Escolha um produto para começar.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {BOTOES_PRODUTO.map(({ slug, icone: Icone, descricao }) => (
          <Link key={slug} href={`/produtos/${slug}`} className="group">
            <Card className="h-full border border-border/60 shadow-sm transition-all hover:border-primary/50 hover:shadow-md group-hover:-translate-y-0.5">
              <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icone className="size-6" />
                  </div>
                  <ArrowRight className="size-5 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <div className="space-y-1">
                  <h2 className="font-heading text-lg font-bold text-foreground">
                    {PRODUTO_SLUGS[slug].label}
                  </h2>
                  <p className="text-xs text-muted-foreground">{descricao}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        <Link href="/visao-gerencial" className="group">
          <Card className="h-full border border-border/60 shadow-sm transition-all hover:border-primary/50 hover:shadow-md group-hover:-translate-y-0.5">
            <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
              <div className="flex items-center justify-between">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <BarChart3 className="size-6" />
                </div>
                <ArrowRight className="size-5 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="font-heading text-lg font-bold text-foreground">
                  Visão Gerencial
                </h2>
                <p className="text-xs text-muted-foreground">
                  Indicadores consolidados entre produtos
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
