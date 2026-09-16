// FGC-10/FGC-12 (T13, fatos-geradores-ciclo-vida). Função pura que recebe o
// resultado de buscarTimelineIncidencia (T12) e devolve agrupado por mês, em
// ordem cronológica decrescente (spec.md P1 "Linha do Tempo" AC1) -- mesmo
// padrão de módulo puro em lib/ de planejamento-formato.ts.
//
// dataEvento é sempre "YYYY-MM-DD" (DATE puro no Postgres, view garante
// COALESCE, T5) -- nunca passa por `new Date()`/`toLocaleDateString`:
// parsing manual evita o fuso horário deslocar o dia/mês (L-002, mesmo
// racional de lista-mandatos.tsx `formatarData`) e garante a data **sem
// hora** exigida por FGC-12/spec.md P1 AC5.
//
// Tipo local (não importado de backend/queries): mesmo padrão de
// LinhaEvolucaoGip em lib/gip.ts -- módulo puro depende só da forma que usa,
// não do módulo de leitura.
export interface ItemTimeline {
  tipo: "pre_insight" | "registro" | "insight" | "fato_gerador";
  idOrigem: number;
  titulo: string | null;
  dataEvento: string | null;
}

export interface GrupoTimeline<T extends ItemTimeline = ItemTimeline> {
  mes: string;
  itens: T[];
}

const NOMES_MES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

// dataEvento nulo é o único caso não coberto pela COALESCE da view (defensivo
// -- mesmo racional de buscarIipContrato tratar null mesmo quando o banco não
// deveria produzir): cai num grupo "Sem data" só, sem quebrar a formatação.
function rotuloMes(dataEvento: string | null): string {
  if (!dataEvento) return "Sem data";
  const [ano, mes] = dataEvento.slice(0, 10).split("-");
  return `${NOMES_MES[Number(mes) - 1]} de ${ano}`;
}

// Genérico (achado de T25/T20: `TimelineItem`, o tipo real que
// buscarTimelineIncidencia devolve, tem mais campos que `ItemTimeline` --
// criadoEm/idUsuarioAutor. Sem o genérico, o retorno desta função "esquece"
// esses campos extras mesmo que o objeto em runtime continue completo,
// quebrando quem precisa deles depois de agrupar, como TimelineFeed).
export function agrupaPorMes<T extends ItemTimeline>(itens: T[]): GrupoTimeline<T>[] {
  if (itens.length === 0) return [];

  const ordenados = [...itens].sort((a, b) => (b.dataEvento ?? "").localeCompare(a.dataEvento ?? ""));

  const grupos: GrupoTimeline<T>[] = [];
  for (const item of ordenados) {
    const mes = rotuloMes(item.dataEvento);
    const grupoAtual = grupos[grupos.length - 1];
    if (grupoAtual && grupoAtual.mes === mes) {
      grupoAtual.itens.push(item);
    } else {
      grupos.push({ mes, itens: [item] });
    }
  }

  return grupos;
}
