import type { AfinidadeAgendaPll, CategoriaDistribuicao } from "@backend/queries/pll-dashboard";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { RoscaAnalise } from "./rosca-analise";

// pll-dashboard-agenda T18 (design.md "Components", PLL-DB-17). Painel
// "Afinidade de agenda temática" (Figma 44:477): 4 pautas fixas do PLL
// (Educação, Segurança Pública, Modernização do Estado, Clima -- Anexo A de
// pll-cadastro-participantes, D-3) com a distribuição das notas 5..1, mais
// "Outras pautas prioritárias" (múltipla escolha). Lê
// buscarAfinidadeAgendaPll (T16). NÃO usa ref_agenda_tematica (D-3,
// resolvida -- catálogo vazio de propósito, CAT-16).
export interface PainelAfinidadeAgendaProps {
  afinidade: AfinidadeAgendaPll;
}

export function PainelAfinidadeAgenda({ afinidade }: PainelAfinidadeAgendaProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Afinidade de agenda temática</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {afinidade.pautas.map((pauta) => {
          const categorias: CategoriaDistribuicao[] = pauta.distribuicaoNotas.map((d) => ({
            categoria: `Nota ${d.nota}`,
            quantidade: d.quantidade,
            percentual: d.percentual,
          }));
          return (
            <RoscaAnalise
              key={pauta.pauta}
              titulo={pauta.pauta}
              n={pauta.n}
              categorias={categorias}
            />
          );
        })}

        {/* D-3/PLL-DB-17: "Outras pautas prioritárias" é múltipla escolha --
            SPEC_DEVIATION documentada em buscarAfinidadeAgendaPll: a soma dos
            percentuais aqui pode passar de 100% (uma pessoa pode marcar mais
            de uma pauta), diferente das demais roscas do Dashboard. */}
        <RoscaAnalise
          titulo="Outras pautas prioritárias"
          n={afinidade.outrasPautas.n}
          categorias={afinidade.outrasPautas.itens.map((i) => ({
            categoria: i.pauta,
            quantidade: i.quantidade,
            percentual: i.percentual,
          }))}
        />
      </CardContent>
    </Card>
  );
}
