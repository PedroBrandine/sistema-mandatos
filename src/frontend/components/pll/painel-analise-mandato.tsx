import type { AnaliseMandatoPll } from "@backend/queries/pll-dashboard";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { RoscaAnalise } from "./rosca-analise";

// pll-dashboard-agenda T18 (design.md "Components", PLL-DB-16). Painel
// "Análise do mandato" (Figma 44:477): 5 roscas -- Cor/raça do parlamentar,
// Partido político, Estado de eleição, Cargos anteriores, Mandatos
// anteriores -- lendo dim_mandato/fat_contrato/rel_mandato_candidatura via
// buscarAnaliseMandatoPll (T17). D-5: rótulo "Cor/raça do PARLAMENTAR"
// (não "Deputado" -- há Senadores na base).
export interface PainelAnaliseMandatoProps {
  analise: AnaliseMandatoPll;
}

export function PainelAnaliseMandato({ analise }: PainelAnaliseMandatoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Análise do mandato</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <RoscaAnalise
          titulo="Cor/raça do parlamentar"
          n={analise.corRacaParlamentar.n}
          suprimido={analise.corRacaParlamentar.suprimido}
          categorias={analise.corRacaParlamentar.categorias}
          semResposta={analise.corRacaParlamentar.semResposta}
        />
        <RoscaAnalise
          titulo="Partido político"
          n={analise.partidoPolitico.n}
          suprimido={analise.partidoPolitico.suprimido}
          categorias={analise.partidoPolitico.categorias}
          semResposta={analise.partidoPolitico.semResposta}
        />
        <RoscaAnalise
          titulo="Estado de eleição"
          n={analise.estadoEleicao.n}
          suprimido={analise.estadoEleicao.suprimido}
          categorias={analise.estadoEleicao.categorias}
          semResposta={analise.estadoEleicao.semResposta}
        />
        {/* Cargos/Mandatos anteriores (D-5e) não têm noção de "sem
            resposta" -- 0 é medição real (AD-005), por isso sem a prop
            semResposta. */}
        <RoscaAnalise
          titulo="Cargos anteriores"
          n={analise.cargosAnteriores.n}
          suprimido={analise.cargosAnteriores.suprimido}
          categorias={analise.cargosAnteriores.categorias}
        />
        <RoscaAnalise
          titulo="Mandatos anteriores"
          n={analise.mandatosAnteriores.n}
          suprimido={analise.mandatosAnteriores.suprimido}
          categorias={analise.mandatosAnteriores.categorias}
        />
      </CardContent>
    </Card>
  );
}
