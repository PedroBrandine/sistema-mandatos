// AD-064 (.specs/STATE.md): iip_provisorio/iip_medio = soma/média de
// (nivel_d1+nivel_d2+nivel_d3). Detalhe compartilhado entre IipCard (por
// contrato) e KpiRow do Dashboard (média do recorte) -- mesma leitura visual
// nos dois lugares: quais das 3 dimensões os Fatos Geradores mais atingiram.
// Barras CSS simples, mesmo padrão sem lib de gráfico de
// components/fundacao/perfil-eleitorado-chart.tsx: comprimento relativo ao
// maior dos 3 (compara magnitude entre dimensões, não participação no
// total), valor sempre rotulado ao lado -- nunca só a cor, por causa das
// falhas de contraste/croma do chart-1 no validador de paleta do dataviz.
export interface DimensoesIipProps {
  d1: number;
  d2: number;
  d3: number;
  // IipCard usa soma inteira (String() já serve); KpiRow usa média decimal
  // e precisa do formatador pt-BR do resto da faixa de KPIs -- o rótulo é
  // escolha de quem chama, a largura da barra continua sempre sobre o
  // número bruto.
  formatarValor?: (valor: number) => string;
}

// Mesma ordem categórica fixa (nunca ciclada por valor): D1/D2/D3 são
// identidades fixas, não um ranking, então a cor segue a dimensão, não a
// posição por tamanho.
const COR_DIMENSAO: Record<"D1" | "D2" | "D3", string> = {
  D1: "bg-chart-1",
  D2: "bg-chart-2",
  D3: "bg-chart-3",
};

// Figma 109:79 (Dimensions-List): a quebra do IIP no Ciclo de Vida é uma fila
// de badges "D1 n", uma cor por dimensão (teal/âmbar/vinho), não barras. As
// dimensões seguem SEM nome (context.md, revisão de mockup): só D1/D2/D3.
// O âmbar leva texto escuro -- branco sobre #ffb300 não passa contraste.
const BADGE_DIMENSAO: Record<"D1" | "D2" | "D3", string> = {
  D1: "bg-[#009688] text-white",
  D2: "bg-[#ffb300] text-card-foreground",
  D3: "bg-[#880e4f] text-white",
};

export function BadgesDimensoesIip({ d1, d2, d3, formatarValor = String }: DimensoesIipProps) {
  const dimensoes: Array<{ rotulo: "D1" | "D2" | "D3"; valor: number }> = [
    { rotulo: "D1", valor: d1 },
    { rotulo: "D2", valor: d2 },
    { rotulo: "D3", valor: d3 },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1">
      {dimensoes.map(({ rotulo, valor }) => (
        <span
          key={rotulo}
          className={`rounded-[4px] px-2 py-1 text-[11px] font-bold whitespace-nowrap tabular-nums ${BADGE_DIMENSAO[rotulo]}`}
        >
          {rotulo} {formatarValor(valor)}
        </span>
      ))}
    </div>
  );
}

export function DimensoesIip({ d1, d2, d3, formatarValor = String }: DimensoesIipProps) {
  const maior = Math.max(d1, d2, d3);
  const dimensoes: Array<{ rotulo: "D1" | "D2" | "D3"; valor: number }> = [
    { rotulo: "D1", valor: d1 },
    { rotulo: "D2", valor: d2 },
    { rotulo: "D3", valor: d3 },
  ];

  return (
    <div className="grid gap-1">
      {dimensoes.map(({ rotulo, valor }) => (
        <div key={rotulo} className="flex items-center gap-2">
          <span className="w-5 shrink-0 font-medium text-foreground">{rotulo}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${COR_DIMENSAO[rotulo]}`}
              style={{ width: maior > 0 ? `${(valor / maior) * 100}%` : "0%" }}
            />
          </div>
          <span className="w-8 shrink-0 text-right tabular-nums">{formatarValor(valor)}</span>
        </div>
      ))}
    </div>
  );
}
