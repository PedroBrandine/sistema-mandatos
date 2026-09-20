"use client";

import { useId } from "react";

import type { EstrategiaKpi } from "@backend/queries/estrategia-kpi";

import { DimensoesIip } from "@/components/incidencia/dimensoes-iip";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// EST-08 (T33, design.md "KpiRow"). A faixa dos números no topo do Dashboard
// do produto, acima do Quadro de Acompanhamento (Figma 44:5 / 44:227).
//
// Este componente não calcula nada e não recebe dado bruto: ele recebe os
// KPIs já agregados por vw_estrategia_kpi (AD-003). Somar, contar ou mediar
// qualquer coisa aqui seria a "agregação inventada pela tela" que a AD
// proíbe -- e a razão de a view existir.
//
// AD-050: a faixa tem CINCO cards. O card "Mandatos em atraso" foi removido
// -- ele exibia um número grande medido pelo prazo planejado original ao lado
// de 3 linhas medidas pelo tempo real na etapa atual, duas definições de
// atraso que nunca fechavam, e foi reprovado na validação de 14/09. A
// situação de prazo passou a ser a quebra do card "Mandatos ativos", onde o
// número grande é o universo e as 3 linhas o decompõem.
//
// Três dos cinco KPIs (IIP, Atingimento, Fatos geradores) são stat tiles
// simples -- número + rótulo, com barra só no Atingimento (única escala 0-100
// conhecida). Os outros dois (Mandatos ativos, NPS) têm layout próprio no
// Figma 44:5 (nodes 86:44 e 44:53): quebra por status e barra segmentada,
// respectivamente.
//
// NPS: `vw_estrategia_kpi` ainda não expõe a segmentação
// promotor/neutro/detrator nem a contagem de avaliações -- o layout da barra
// segmentada e do chip existe (não desaparece), mas cada parte sem dado de
// origem mostra "—" (AUSENCIA_KPI) em vez de inventar uma proporção ou
// contagem (AD-005). Gap remanescente, documentado na seção "Ajuste de
// fidelidade visual" de tasks.md.
//
// As cores usadas são tokens da identidade (globals.css) e classes de
// paleta do Tailwind já em uso pelo Quadro de Acompanhamento
// (quadro-acompanhamento.tsx: emerald/amber/destructive para normal/
// atenção/atrasado) -- nenhum hex cru novo introduzido aqui.
type FormatoKpi = "inteiro" | "decimal" | "percentual";

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

function ValorOuAusencia({ texto }: { texto: string | null }) {
  return (
    <>
      {texto ?? (
        <>
          {AUSENCIA_KPI}
          {/* O travessão comunica ausência visualmente; sem isto o leitor de
              tela anuncia só a pontuação. */}
          <span className="sr-only">Sem dado suficiente</span>
        </>
      )}
    </>
  );
}

interface KpiSimplesProps {
  rotulo: string;
  formato: FormatoKpi;
  valor: number | null;
  barraProgresso?: boolean;
}

function KpiSimples({ rotulo, formato, valor, barraProgresso }: KpiSimplesProps) {
  const rotuloId = useId();
  const texto = formatar(valor, formato);

  return (
    <Card size="sm" role="group" aria-labelledby={rotuloId}>
      <CardContent>
        {/* Caixa alta pelo CSS, não no texto: o rótulo escrito em maiúsculas
            de verdade faz leitor de tela soletrar sigla e perde a
            acentuação correta na leitura. */}
        <p id={rotuloId} className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </p>
        <p className="mt-1 font-heading text-3xl text-secondary">
          <ValorOuAusencia texto={texto} />
        </p>

        {/* Barra só existe quando há número. Renderizá-la vazia num KPI
            ausente desenharia "0% atingido", que é precisamente o zero
            inventado que AD-005 proíbe -- e, numa barra, mente com mais
            força que um dígito. */}
        {barraProgresso && valor !== null && (
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-labelledby={rotuloId}
            aria-valuenow={valor}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${valor}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface KpiIipProps {
  valor: number | null;
  d1: number | null;
  d2: number | null;
  d3: number | null;
}

// AD-064 (20260920): mesmo card de IIP, com o detalhe por dimensão (D1/D2/D3)
// embaixo do número -- quais das 3 dimensões o recorte de mandatos mais
// atingiu, em média. componente_d1/d2/d3_medio chegam null exatamente quando
// iipMedio chega null (mesmo LEFT JOIN em mv_iip_contrato, vw_estrategia_kpi),
// então "tem detalhe" é só checar valor !== null -- sem caso intermediário.
function KpiIip({ valor, d1, d2, d3 }: KpiIipProps) {
  const rotuloId = useId();
  const texto = formatar(valor, "decimal");

  return (
    <Card size="sm" role="group" aria-labelledby={rotuloId}>
      <CardContent className="flex flex-col gap-2">
        <p id={rotuloId} className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
          IIP — Índ. de impacto
        </p>
        <p className="font-heading text-3xl text-secondary">
          <ValorOuAusencia texto={texto} />
        </p>
        {valor !== null && (
          <DimensoesIip
            d1={d1 ?? 0}
            d2={d2 ?? 0}
            d3={d3 ?? 0}
            formatarValor={(v) => FORMATADOR.decimal.format(v)}
          />
        )}
      </CardContent>
    </Card>
  );
}

const ESTADO_BREAKDOWN: { chave: "atrasado" | "atencao" | "normal"; rotulo: string; dotClass: string }[] = [
  { chave: "atrasado", rotulo: "atrasados", dotClass: "bg-destructive" },
  { chave: "atencao", rotulo: "atenção", dotClass: "bg-amber-500" },
  { chave: "normal", rotulo: "normal", dotClass: "bg-emerald-500" },
];

interface KpiMandatosAtivosProps {
  valor: number | null;
  atrasados: number | null;
  atencao: number | null;
  normal: number | null;
}

// Layout do Figma 86:44 ("kpi-atrasos"): número grande + 3 linhas de status
// (dot + contagem) ao lado -- aplicado, desde AD-050, ao card "Mandatos
// ativos". O número grande é o UNIVERSO (mandatos ativos) e as 3 linhas o
// DECOMPÕEM: `mandatos_atraso_atrasados/atencao/normal` (migration
// 20260915115846) somam exatamente o total, e é essa igualdade que o card
// existe para mostrar.
//
// Nada é somado aqui (AD-003): as 3 linhas e o total chegam prontos da view.
// Calcular o total somando as linhas no cliente mascararia justamente o
// defeito que esta feature corrigiu -- o card exibiria coerência que os dados
// não têm.
//
// Cada linha formata o seu próprio valor independentemente (AD-005): "—" só
// aparece onde aquele valor específico vier null (limiar correspondente
// desligado em ref_limiar_pendencia), nunca como travessão fixo para o card.
function KpiMandatosAtivos({ valor, atrasados, atencao, normal }: KpiMandatosAtivosProps) {
  const rotuloId = useId();
  const texto = formatar(valor, "inteiro");
  const valoresPorEstado: Record<"atrasado" | "atencao" | "normal", number | null> = {
    atrasado: atrasados,
    atencao,
    normal,
  };

  return (
    <Card size="sm" role="group" aria-labelledby={rotuloId}>
      <CardContent className="flex flex-col gap-3">
        <p id={rotuloId} className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
          Mandatos ativos
        </p>
        <div className="flex items-center gap-3">
          <p className="font-heading text-3xl text-secondary">
            <ValorOuAusencia texto={texto} />
          </p>
          <div className="flex flex-col gap-1">
            {ESTADO_BREAKDOWN.map((estado) => {
              const textoEstado = formatar(valoresPorEstado[estado.chave], "inteiro");
              return (
                <div key={estado.chave} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={cn("size-1.5 shrink-0 rounded-full", estado.dotClass)} />
                  <span>
                    <ValorOuAusencia texto={textoEstado} /> {estado.rotulo}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Figma 44:53 ("kpi-4"): número grande + barra segmentada (promotor/neutro/
// detrator) + rótulos de percentual + chip de nº de avaliações.
// vw_estrategia_kpi só expõe a média (npsMedio) -- nenhuma das duas quebras
// (segmentos, contagem de avaliações) existe na view hoje. A barra e o chip
// permanecem no layout: a barra desenha um único segmento neutro (sem
// proporção inventada) e o chip mostra "—" em vez de uma contagem forjada.
function KpiNps({ valor }: { valor: number | null }) {
  const rotuloId = useId();
  const texto = formatar(valor, "decimal");

  return (
    <Card size="sm" role="group" aria-labelledby={rotuloId} className="sm:col-span-2 lg:col-span-1">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <p id={rotuloId} className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
            NPS das imersões
          </p>
          <span className="inline-flex items-center whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground">
            {AUSENCIA_KPI} avaliações
            <span className="sr-only"> — número de avaliações indisponível nesta view</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <p className="font-heading text-3xl text-primary">
            <ValorOuAusencia texto={texto} />
          </p>
          <div className="flex flex-1 flex-col gap-2">
            <div
              className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label="Distribuição de promotores, neutros e detratores indisponível nesta view"
            />
            <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
              <span>Promotores: {AUSENCIA_KPI}</span>
              <span>Neutros: {AUSENCIA_KPI}</span>
              <span>Detratores: {AUSENCIA_KPI}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export interface KpiRowProps {
  kpi: EstrategiaKpi;
}

export function KpiRow({ kpi }: KpiRowProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <KpiMandatosAtivos
        valor={kpi.mandatosAtivos}
        atrasados={kpi.mandatosAtrasoAtrasados}
        atencao={kpi.mandatosAtrasoAtencao}
        normal={kpi.mandatosAtrasoNormal}
      />
      <KpiIip valor={kpi.iipMedio} d1={kpi.componenteD1Medio} d2={kpi.componenteD2Medio} d3={kpi.componenteD3Medio} />
      <KpiNps valor={kpi.npsMedio} />
      <KpiSimples rotulo="Atingimento plan." formato="percentual" valor={kpi.pctAtingimentoMedio} barraProgresso />
      <KpiSimples rotulo="Fatos geradores reg." formato="inteiro" valor={kpi.nrFatosGeradores} />
    </div>
  );
}
