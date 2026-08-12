import Link from "next/link";
import { LayoutDashboard } from "lucide-react";

import { PRODUTO_SLUGS } from "@backend/queries/produto";
import { EmDesenvolvimento } from "@/components/app-shell/em-desenvolvimento";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CarteiraPonderadaCard } from "@/components/visao-gerencial/carteira-ponderada-card";
import { CicloEtapaCard } from "@/components/visao-gerencial/ciclo-etapa-card";

// GG-07 (P2 AC1-AC3): G1 + G2 na mesma tela, cada um com seu próprio filtro
// (CarteiraPonderadaCard/CicloEtapaCard não compartilham estado), link pro
// Kanban de cada produto (PRODUTO_SLUGS, rota /produtos/{slug}/dashboard) e
// placeholder "G3-G6 em desenvolvimento" pro restante da Visão Gerencial
// (Constituição §2.6) -- não sugere que a tela está completa.
export default function VisaoGerencialPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6">
      <CarteiraPonderadaCard />
      <CicloEtapaCard />

      <Card>
        <CardHeader>
          <CardTitle>Ir para o Kanban</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.entries(PRODUTO_SLUGS).map(([slug, info]) => (
            <Link key={slug} href={`/produtos/${slug}/dashboard`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs font-medium">
                <LayoutDashboard className="size-3.5" />
                {info.label}
              </Button>
            </Link>
          ))}
        </CardContent>
      </Card>

      <EmDesenvolvimento titulo="G3-G6 em desenvolvimento" />
    </div>
  );
}
