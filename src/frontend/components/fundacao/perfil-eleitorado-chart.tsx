export interface PerfilEleitoradoChartProps {
  titulo: string;
  dados: Array<{ categoria: string; qtEleitores: number }>;
}

const CORES_BARRA = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

// CAD-11: mini-representação visual de uma dimensão do perfil do eleitorado
// (gênero, faixa etária ou escolaridade) -- barras simples via CSS/Tailwind
// (div com largura proporcional ao percentual da categoria), sem lib de
// gráfico (Tech Decisions de design.md). Renderizada uma vez por dimensão
// pelo chamador (T17).
export function PerfilEleitoradoChart({ titulo, dados }: PerfilEleitoradoChartProps) {
  const total = dados.reduce((soma, d) => soma + d.qtEleitores, 0);

  return (
    <div className="grid gap-1.5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{titulo}</p>
      <div className="grid gap-1">
        {dados.map((d, indice) => {
          const percentual = total > 0 ? (d.qtEleitores / total) * 100 : 0;
          return (
            <div key={d.categoria} className="flex items-center gap-2 text-xs">
              <span className="w-28 shrink-0 truncate" title={d.categoria}>
                {d.categoria}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${CORES_BARRA[indice % CORES_BARRA.length]}`}
                  style={{ width: `${percentual}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                {percentual.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
