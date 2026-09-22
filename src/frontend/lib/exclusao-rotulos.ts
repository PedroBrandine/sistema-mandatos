import type { ContagensExclusao, ResumoExclusaoIncidencia } from "@backend/rpc/exclusao";

// Texto do que uma exclusão leva junto, a partir das contagens que o banco
// devolve (app.resumo_exclusao_contrato / app.resumo_exclusao_incidencia). Só
// linhas com quantidade > 0 aparecem: uma lista de "0 fatos geradores, 0
// registros..." esconde o que importa. Ordem = ordem da tabela, do mais
// visível ao usuário para o mais técnico.
type Forma = [singular: string, plural: string];

const CONTRATO: Array<[chave: string, forma: Forma]> = [
  ["registros", ["registro", "registros"]],
  ["fatos_geradores", ["fato gerador", "fatos geradores"]],
  ["insights", ["insight", "insights"]],
  ["pre_insights", ["pré-insight", "pré-insights"]],
  ["encontros", ["encontro", "encontros"]],
  ["objetivos", ["objetivo específico", "objetivos específicos"]],
  ["metas", ["meta", "metas"]],
  ["sucessos_mensais", ["sucesso mensal", "sucessos mensais"]],
  ["planejamento", ["planejamento estratégico", "planejamentos estratégicos"]],
  ["submissoes", ["formulário respondido", "formulários respondidos"]],
  ["respostas", ["resposta de formulário", "respostas de formulários"]],
  ["gips", ["avaliação GIP", "avaliações GIP"]],
  ["artefatos", ["artefato", "artefatos"]],
  ["etapas", ["etapa da régua", "etapas da régua"]],
  ["formularios", ["formulário vinculado", "formulários vinculados"]],
  ["vinculos_usuarios", ["vínculo de equipe", "vínculos de equipe"]],
  ["convites", ["convite", "convites"]],
  ["membros_coalizao", ["participação em coalizão", "participações em coalizão"]],
  ["prospeccao_origem", ["prospecção de origem", "prospecções de origem"]],
];

function linha(quantidade: number, [singular, plural]: Forma): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

/** O que sai quando um mandato (contrato) é excluído. */
export function linhasExclusaoContrato(contagens: ContagensExclusao): string[] {
  return CONTRATO.filter(([chave]) => (contagens[chave] ?? 0) > 0).map(([chave, forma]) => linha(contagens[chave], forma));
}

// Efeitos de apagar UM item da Incidência. Diferente do mandato, aqui o
// importante é o que NÃO é apagado mas muda (fatos que perdem a origem,
// insights que perdem o registro), então cada frase já diz isso.
const INCIDENCIA: Array<[chave: string, singular: string, plural: string]> = [
  [
    "fatos_origem_desfeita",
    "1 fato gerador perde a origem (ele não é apagado)",
    "{n} fatos geradores perdem a origem (eles não são apagados)",
  ],
  [
    "insights_desvinculados",
    "1 insight perde o vínculo com este registro (ele não é apagado)",
    "{n} insights perdem o vínculo com este registro (eles não são apagados)",
  ],
  ["participantes", "1 participante do registro é removido", "{n} participantes do registro são removidos"],
  [
    "vinculos_meta_sucesso",
    "1 vínculo com meta ou sucesso mensal é removido",
    "{n} vínculos com meta ou sucesso mensal são removidos",
  ],
  ["vinculos_origem", "1 vínculo de origem é removido", "{n} vínculos de origem são removidos"],
];

/** O que muda quando um item da Incidência é excluído. */
export function linhasExclusaoIncidencia(resumo: ResumoExclusaoIncidencia): string[] {
  const linhas = INCIDENCIA.filter(([chave]) => (resumo.contagens[chave] ?? 0) > 0).map(([chave, singular, plural]) => {
    const n = resumo.contagens[chave];
    return (n === 1 ? singular : plural).replace("{n}", String(n));
  });
  // Só Fato Gerador realizado entra no IIP -- apagar muda o número.
  if (resumo.tipo === "fato_gerador" && resumo.situacao === "realizado") {
    linhas.push("O IIP do mandato será recalculado sem este fato gerador");
  }
  return linhas;
}
