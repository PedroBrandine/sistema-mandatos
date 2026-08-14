import type { FiltroRecorte } from "@backend/queries/visao-gerencial";
import { CarteiraPonderadaCard } from "@/components/visao-gerencial/carteira-ponderada-card";
import { CicloEtapaCard } from "@/components/visao-gerencial/ciclo-etapa-card";
import { G5AtingimentoCard } from "@/components/visao-gerencial/g5-atingimento-card";
import { G6CompletudeCard } from "@/components/visao-gerencial/g6-completude-card";
import { IipConsolidadoCard } from "@/components/visao-gerencial/iip-consolidado-card";

// visao-gerencial-g3-g6, T28 (Bloco 2, wiring de GER-09/12-18). Grade 2
// colunas -- G1/G2 (Client Components existentes, alternador/estado
// próprios) + G5/G6/IIP (Server Components novos). Nenhum card com 2 eixos
// Y (regra de visualização); wiring puro, sem lógica própria.
export function IndicadoresBloco({ filtro }: { filtro: FiltroRecorte }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CarteiraPonderadaCard filtro={filtro} />
      <CicloEtapaCard filtro={filtro} />
      <G5AtingimentoCard filtro={filtro} />
      <G6CompletudeCard filtro={filtro} />
      <IipConsolidadoCard filtro={filtro} />
    </div>
  );
}
