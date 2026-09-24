import type { CategoriaDistribuicao } from "@backend/queries/pll-dashboard";

import { RoscaAnalise } from "@/components/pll/rosca-analise";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVazio } from "@/components/ui/estado-vazio";

// PF3-02 (.specs/features/pente-fino-2026-09-23-lote2/spec.md): a
// Composição Partidária da Casa era uma lista de texto crua, sem nenhum
// visual (achado "gráfico feio" -- não havia gráfico nenhum). Extraída de
// diagnostico-participante-pll.tsx pra ser testável em isolamento (mesmo
// padrão presentational de FichaDadosTse/FichaAfinidadeAgenda) e passa a
// reaproveitar o donut já validado no Dashboard PLL (RoscaAnalise).

export interface ComposicaoPartidariaCasaProps {
  composicao: { siglaPartido: string; quantidade: number; percentual: number }[];
}

export function ComposicaoPartidariaCasa({ composicao }: ComposicaoPartidariaCasaProps) {
  const categorias: CategoriaDistribuicao[] = composicao.map((c) => ({
    categoria: c.siglaPartido,
    quantidade: c.quantidade,
    percentual: c.percentual,
  }));
  const n = composicao.reduce((soma, c) => soma + c.quantidade, 0);

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Composição Partidária da Casa</CardTitle>
      </CardHeader>
      <CardContent>
        {/* PLL-CP-19: nunca gráfico vazio sem explicação. */}
        {composicao.length === 0 ? (
          <EstadoVazio titulo="Dados indisponíveis para esta Casa/ano" />
        ) : (
          <RoscaAnalise
            titulo="Composição Partidária da Casa"
            n={n}
            categorias={categorias}
            ocultarTitulo
            rotuloCentro="eleitos"
          />
        )}
      </CardContent>
    </Card>
  );
}
