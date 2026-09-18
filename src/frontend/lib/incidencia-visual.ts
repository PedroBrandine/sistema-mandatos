// Acerto de fidelidade visual pós-Verifier (fatos-geradores-ciclo-vida).
// Cor por tipo puxada do Figma (node 108:4/109:4, `figma-design-to-code`) --
// é decisão só de estilo, não de vocabulário. Os RÓTULOS continuam
// obedecendo o guardrail já fechado em context.md (gate
// `figma-dominio-legisla`): nunca nomear D1/D2/D3, nunca inventar um 5º
// nível, nunca marcar "sem origem" como falha.
export type TipoIncidencia = "pre_insight" | "registro" | "insight" | "fato_gerador";

export const TIPO_ROTULO: Record<TipoIncidencia, string> = {
  pre_insight: "Pré-Insight",
  registro: "Registro",
  insight: "Insight",
  fato_gerador: "Fato Gerador",
};

export interface EstiloTipo {
  dot: string;
  bg: string;
  border: string;
  text: string;
}

export const TIPO_ESTILO: Record<TipoIncidencia, EstiloTipo> = {
  pre_insight: { dot: "#ea580c", bg: "#fff7ed", border: "#ffedd5", text: "#ea580c" },
  registro: { dot: "#2563eb", bg: "#eff6ff", border: "#dbeafe", text: "#2563eb" },
  insight: { dot: "#9333ea", bg: "#faf5ff", border: "#f3e8ff", text: "#9333ea" },
  fato_gerador: { dot: "#059669", bg: "#ecfdf5", border: "#d1fae5", text: "#059669" },
};

// Cor de destaque quando o Fato Gerador está selecionado/em foco (o mockup
// usa um teal mais escuro que o badge -- #0f766e -- para a borda ativa, o
// separador de mês e o botão "Ver no Ciclo de Vida").
export const DESTAQUE_FATO_GERADOR = "#0f766e";

// Ordem real de `ref_nivel_iip` (4 linhas, sem 5º nível -- reincidência
// catalogada em figma-dominio-legisla). `fat_fato_gerador.nivel_d1/2/3` já
// grava o rótulo pronto (Baixo/Médio/Alto/Máximo), não um código -- só
// precisamos da posição para preencher a régua de pontos.
const ORDEM_NIVEL = ["Baixo", "Médio", "Alto", "Máximo"] as const;

export function posicaoNivel(rotulo: string | null): number {
  if (!rotulo) return 0;
  const i = ORDEM_NIVEL.indexOf(rotulo as (typeof ORDEM_NIVEL)[number]);
  return i === -1 ? 0 : i + 1;
}

export const TOTAL_NIVEIS = ORDEM_NIVEL.length;
