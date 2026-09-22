import Link from "next/link";
import { ArrowRight, BarChart3, Flag, FolderKanban, Handshake, Landmark, Presentation, TrendingUp, Users2, type LucideIcon } from "lucide-react";

import type { CardHub } from "@backend/queries/hub";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// EST-02 (T12). Mapa icone-id -> componente Lucide -- queries/hub.ts (T11) é
// backend puro e não conhece JSX, então devolve só o identificador; este
// componente é o único ponto que resolve o ícone visual.
const ICONES: Record<string, LucideIcon> = {
  estrategia: Landmark,
  pll: Flag,
  coalizao: Handshake,
  "visao-gerencial": BarChart3,
  "numeros-impacto": TrendingUp,
  usuarios: Users2,
  apresentacao: Presentation,
  projetos: FolderKanban,
};

interface HubCardProps {
  card: CardHub;
}

// EST-02 AC1/AC5: um card por destino, navegação por clique. AC3/AC4: badge
// de contador aparece quando a query devolveu um valor e some quando não
// (mesmo padrão visual de HubPage antes desta task, estendido com a faixa de
// badge).
export function HubCard({ card }: HubCardProps) {
  const Icone = ICONES[card.icone] ?? Landmark;

  return (
    <Link href={card.destino} className="group outline-none">
      <Card className="relative h-full overflow-hidden border-border/40 bg-card shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] group-hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-primary/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <CardContent className="relative flex h-full flex-col justify-between gap-6 p-6">
          <div className="flex items-start justify-between">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/5 text-primary shadow-inner ring-1 ring-primary/10 transition-colors duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary/30">
              <Icone className="size-6" strokeWidth={2} />
            </div>
            <div className="flex items-center gap-2">
              {card.badge !== undefined && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {card.badge}
                </Badge>
              )}
              <div className="flex size-8 items-center justify-center rounded-full bg-accent/50 text-muted-foreground opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:bg-primary/10 group-hover:text-primary">
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <h2 className="font-heading text-xl font-medium text-foreground">{card.titulo}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{card.descricao}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
