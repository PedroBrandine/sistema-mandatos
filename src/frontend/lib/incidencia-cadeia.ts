// FGC-13/FGC-14 (T14, fatos-geradores-ciclo-vida). Função pura que recebe o
// resultado de buscarCadeiasIncidencia (T12, 1 linha por Fato Gerador) e
// agrupa por origem comum (chaveOrigem, já resolvida por
// vw_cadeia_incidencia -- T5). O rótulo "Cadeia A/B/C" é **gerado aqui**,
// nunca lido de uma coluna: AD-053 -- persistir a letra criaria uma
// identidade falsa para algo que é puramente derivado da ordenação.
//
// Tipo local (não importado de backend/queries): mesmo padrão de
// ItemTimeline em lib/incidencia-timeline.ts / LinhaEvolucaoGip em lib/gip.ts.
export interface OrigemCadeia {
  tipo: "pre_insight" | "registro" | "insight" | "meta";
  titulo: string;
  dataEvento: string | null;
}

export interface ItemCadeia {
  idFatoGerador: number;
  titulo: string | null;
  situacao: "projetado" | "realizado";
  dataEvento: string | null;
  chaveOrigem: string;
  // Opcional (acerto de fidelidade visual pós-Verifier, mockup 109:4): passo
  // de origem do card horizontal. rotulaCadeias só agrupa/rotula -- não
  // interpreta este campo, só repassa.
  origem?: OrigemCadeia | null;
}

export interface CadeiaRotulada {
  rotulo: string;
  // spec.md P2 AC3: mais de 1 Fato Gerador com a mesma origem -- marcado
  // explicitamente como "Origem comum". Uma cadeia direta no fato
  // (chaveOrigem = "fato:<id>", sem rel_fato_origem) é sempre unitária --
  // nunca fica true -- e por isso já sai "sem marca de incompletude" (AC4):
  // nenhum campo aqui sinaliza problema, só a contagem real de membros.
  origemComum: boolean;
  itens: ItemCadeia[];
}

export interface CadeiasAgrupadas {
  realizadas: CadeiaRotulada[];
  // spec.md P2 AC5: cadeia com só fatos projetados vai para a seção própria
  // "Cadeia Projetada (em análise)" -- o rótulo do texto de seção é
  // responsabilidade do componente (T21), aqui só a separação da lista.
  projetadas: CadeiaRotulada[];
}

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function rotuloPorIndice(indice: number): string {
  // Além de Z (26 cadeias na mesma seção): AA, AB... nunca esperado na
  // prática, mas não trava a função.
  if (indice < LETRAS.length) return `Cadeia ${LETRAS[indice]}`;
  const primeira = Math.floor(indice / LETRAS.length) - 1;
  const segunda = indice % LETRAS.length;
  return `Cadeia ${LETRAS[primeira]}${LETRAS[segunda]}`;
}

function rotula(grupos: ItemCadeia[][]): CadeiaRotulada[] {
  return grupos.map((itens, indice) => ({
    rotulo: rotuloPorIndice(indice),
    origemComum: itens.length > 1,
    itens,
  }));
}

export function rotulaCadeias(itens: ItemCadeia[]): CadeiasAgrupadas {
  const ordemChaves: string[] = [];
  const gruposPorChave = new Map<string, ItemCadeia[]>();

  for (const item of itens) {
    if (!gruposPorChave.has(item.chaveOrigem)) {
      ordemChaves.push(item.chaveOrigem);
      gruposPorChave.set(item.chaveOrigem, []);
    }
    gruposPorChave.get(item.chaveOrigem)!.push(item);
  }

  const gruposRealizados: ItemCadeia[][] = [];
  const gruposProjetados: ItemCadeia[][] = [];

  for (const chave of ordemChaves) {
    const grupo = gruposPorChave.get(chave)!;
    const somenteProjetados = grupo.every((i) => i.situacao === "projetado");
    (somenteProjetados ? gruposProjetados : gruposRealizados).push(grupo);
  }

  return {
    realizadas: rotula(gruposRealizados),
    projetadas: rotula(gruposProjetados),
  };
}
