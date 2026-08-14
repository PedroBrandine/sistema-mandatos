import Link from "next/link";
import { ArrowRight, BarChart3, Flag, Handshake, Landmark } from "lucide-react";

import { PRODUTO_SLUGS } from "@backend/queries/produto";
import { Card, CardContent } from "@/components/ui/card";

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
    <div className="mx-auto grid max-w-5xl gap-8 p-6 md:p-10">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-primary">
          Legisla Brasil
        </h1>
        <p className="text-base text-muted-foreground max-w-lg">
          Escolha um produto para acessar seu dashboard, mandatos e ferramentas de gestão estratégica.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {BOTOES_PRODUTO.map(({ slug, icone: Icone, descricao }) => (
          <Link key={slug} href={`/produtos/${slug}`} className="group outline-none">
            <Card className="relative h-full overflow-hidden border-border/40 bg-card shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group-hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-primary/50">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <CardContent className="relative flex h-full flex-col justify-between gap-6 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/5 text-primary shadow-inner ring-1 ring-primary/10 transition-colors duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary/30">
                    <Icone className="size-6" strokeWidth={2} />
                  </div>
                  <div className="flex size-8 items-center justify-center rounded-full bg-accent/50 text-muted-foreground opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:bg-primary/10 group-hover:text-primary">
                    <ArrowRight className="size-4" strokeWidth={2.5} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <h2 className="font-heading text-xl font-medium text-foreground">
                    {PRODUTO_SLUGS[slug].label}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{descricao}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        <Link href="/visao-gerencial" className="group outline-none">
          <Card className="relative h-full overflow-hidden border-border/40 bg-card shadow-sm transition-all duration-300 hover:border-secondary/30 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group-hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-secondary/50">
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <CardContent className="relative flex h-full flex-col justify-between gap-6 p-6">
              <div className="flex items-start justify-between">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary/5 text-secondary shadow-inner ring-1 ring-secondary/10 transition-colors duration-500 group-hover:bg-secondary group-hover:text-secondary-foreground group-hover:ring-secondary/30">
                  <BarChart3 className="size-6" strokeWidth={2} />
                </div>
                <div className="flex size-8 items-center justify-center rounded-full bg-accent/50 text-muted-foreground opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:bg-secondary/10 group-hover:text-secondary">
                  <ArrowRight className="size-4" strokeWidth={2.5} />
                </div>
              </div>
              <div className="space-y-1.5">
                <h2 className="font-heading text-xl font-medium text-foreground">
                  Visão Gerencial
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Indicadores consolidados e análise estratégica de todos os produtos
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
