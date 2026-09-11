"use client";

import { useId } from "react";

import type { EstrategiaKpi } from "@backend/queries/estrategia-kpi";

import { Card, CardContent } from "@/components/ui/card";

// EST-08 (T33, design.md "KpiRow"). A faixa dos números no topo do Dashboard
// do produto, acima do Quadro de Acompanhamento (Figma 44:5 / 44:227).
//
// Este componente não calcula nada e não recebe dado bruto: ele recebe os
// KPIs já agregados por vw_estrategia_kpi (AD-003). Somar, contar ou mediar
// qualquer coisa aqui seria a "agregação inventada pela tela" que a AD
// proíbe -- e a razão de a view existir.
//
// É um painel de stat tiles, não um gráfico: nenhuma escala ou paleta
// categórica de série entra aqui. As duas cores usadas são tokens da
// identidade (globals.css): o número em `secondary` (vinho #571730) e a barra
// de atingimento em `primary` (teal #035252). Nenhum hex cru no componente --
// o arquivo do Figma não tem variáveis de design (get_variable_defs devolve
// {}), então o mapeamento hex->token é manual e a fonte de verdade é o
// globals.css, nunca o valor transcrito de um screenshot.

type FormatoKpi = "inteiro" | "decimal" | "percentual";

interface DefinicaoKpi {
  chave: keyof EstrategiaKpi;
  rotulo: string;
  formato: FormatoKpi;
  // Só o atingimento tem barra: é o único KPI cuja escala (0-100) é conhecida
  // e fixa, então a barra representa proporção de verdade. IIP e NPS não têm
  // máximo declarado em lugar nenhum do modelo -- desenhar uma barra para
  // eles exigiria inventar o denominador.
  barraProgresso?: true;
}

// Rótulos e ordem: o spec (EST-08 AC1) manda no CONJUNTO, o Figma manda na
// GRAFIA. AC1 enumera seis -- "mandatos ativos, IIP, mandatos em atraso, NPS
// das imersões, atingimento do planejamento e fatos geradores" -- e o node
// 44:227 desenha cinco, sem "Mandatos em atraso". Mantidos os seis: o spec é
// a fonte de verdade dos ACs e remover o card faria a tela deixar de cumprir
// uma AC aprovada. Divergência registrada como desvio em tasks.md (Fase 8).
const KPIS: DefinicaoKpi[] = [
  { chave: "mandatosAtivos", rotulo: "Mandatos ativos", formato: "inteiro" },
  { chave: "iipMedio", rotulo: "IIP — Índ. de impacto", formato: "decimal" },
  { chave: "mandatosEmAtraso", rotulo: "Mandatos em atraso", formato: "inteiro" },
  { chave: "npsMedio", rotulo: "NPS das imersões", formato: "decimal" },
  { chave: "pctAtingimentoMedio", rotulo: "Atingimento plan.", formato: "percentual", barraProgresso: true },
  { chave: "nrFatosGeradores", rotulo: "Fatos geradores reg.", formato: "inteiro" },
];

// Contagens são inteiras por construção; médias ganham uma casa decimal --
// numa faixa de leitura de conjunto, a segunda casa só adiciona ruído sem
// mudar nenhuma decisão. Não é regra de negócio (AD-004): o valor exato
// continua na view, isto é apresentação.
const FORMATADOR: Record<FormatoKpi, Intl.NumberFormat> = {
  inteiro: new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }),
  decimal: new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }),
  percentual: new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }),
};

export const AUSENCIA_KPI = "—";

function formatar(valor: number | null, formato: FormatoKpi): string | null {
  // AD-005 / EST-08 AC2: só null é ausência. 0 é um número medido -- "nenhum
  // mandato em atraso" é informação, e transformá-lo em "—" esconderia um
  // fato tão real quanto qualquer outro. A checagem é estritamente contra
  // null para que nenhum falsy (0 inclusive) escorregue para o travessão.
  if (valor === null) return null;
  const texto = FORMATADOR[formato].format(valor);
  return formato === "percentual" ? `${texto}%` : texto;
}

export interface KpiRowProps {
  kpi: EstrategiaKpi;
}

export function KpiRow({ kpi }: KpiRowProps) {
  const baseId = useId();

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {KPIS.map((def) => {
        const rotuloId = `${baseId}-${def.chave}`;
        const bruto = kpi[def.chave];
        const valor = formatar(bruto, def.formato);

        return (
          <Card key={def.chave} size="sm" role="group" aria-labelledby={rotuloId}>
            <CardContent>
              {/* Caixa alta pelo CSS, não no texto: o rótulo escrito em
                  maiúsculas de verdade faz leitor de tela soletrar sigla e
                  perde a acentuação correta na leitura. */}
              <p
                id={rotuloId}
                className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {def.rotulo}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-secondary">
                {valor ?? (
                  <>
                    {AUSENCIA_KPI}
                    {/* O travessão comunica ausência visualmente; sem isto o
                        leitor de tela anuncia só a pontuação. */}
                    <span className="sr-only">Sem dado suficiente</span>
                  </>
                )}
              </p>

              {/* Barra só existe quando há número. Renderizá-la vazia num KPI
                  ausente desenharia "0% atingido", que é precisamente o zero
                  inventado que AD-005 proíbe -- e, numa barra, mente com mais
                  força que um dígito. Mesmo padrão de PlanejamentoHeader. */}
              {def.barraProgresso && bruto !== null && (
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-labelledby={rotuloId}
                  aria-valuenow={bruto}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="h-full rounded-full bg-primary" style={{ width: `${bruto}%` }} />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
