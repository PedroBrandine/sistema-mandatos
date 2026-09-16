import type { BaseSucessoMensalLote } from "@backend/rpc/planejamento";
import type { SucessoMensalInput } from "@backend/schemas/planejamento";

// PLV-06. A grade de meses do modal é a razão de existir do lote: a Gestora
// marca Jul/Ago/Set e nascem três Sucessos Mensais irmãos, em vez de cadastrar
// o mesmo item três vezes.
//
// ESTA FUNÇÃO NÃO ESCREVE. A escrita é de app.cria_sucessos_mensais_lote
// (criarSucessosEmLote, T10): um único INSERT atômico, com UMA cascata para o
// plano inteiro (AC6). Montar N inserts aqui quebraria as duas coisas -- lote
// pela metade se um mês violasse constraint, e N recálculos em vez de um.
//
// O que ela faz são as duas pontas que a RPC não cobre:
//   1. normaliza a seleção da grade no array `meses` que a RPC recebe;
//   2. devolve os N irmãos para a PRÉVIA do modal ("isto vai criar 3 linhas"),
//      antes de qualquer chamada ao banco.
export interface LoteExpandido {
  /** Meses normalizados (dia 1), sem repetição, em ordem. Vai para a RPC. */
  meses: string[];
  /** Os N irmãos, para prévia na tela. Nunca são inseridos um a um. */
  sucessos: SucessoMensalInput[];
}

const MAXIMO_MESES = 12;

// ck_sucesso_mes exige EXTRACT(DAY) = 1. A grade já entrega o dia 1, mas
// normalizar aqui faz "dois dias do mesmo mês" colapsarem em um mês só, que é o
// que a Gestora quis dizer ao marcar aquele quadradinho.
function normalizaMes(mes: string): string {
  const casamento = /^(\d{4})-(\d{2})-\d{2}$/.exec(mes);
  if (!casamento) {
    throw new Error(`mês inválido: ${mes}`);
  }
  return `${casamento[1]}-${casamento[2]}-01`;
}

export function expandeMesesEmSucessos(
  base: BaseSucessoMensalLote,
  mesesSelecionados: string[],
  idMeta: number
): LoteExpandido {
  // Dedupe ANTES de contar: o limite de 12 é de meses distintos, o mesmo array
  // que chega na RPC, não de cliques na grade. Contar antes recusaria uma
  // seleção que o banco aceitaria.
  const meses = [...new Set(mesesSelecionados.map(normalizaMes))].sort();

  // PLV-06 AC5. Mesma mensagem do ERRCODE PLN01 e do sucessoMensalLoteSchema --
  // a Gestora lê uma frase só, não três variações conforme a camada que barrou.
  if (meses.length === 0) {
    throw new Error("selecione ao menos um mês");
  }
  if (meses.length > MAXIMO_MESES) {
    throw new Error(`no máximo ${MAXIMO_MESES} meses por lote`);
  }

  // Irmãos, não cópias de um mesmo registro: depois de criados não há vínculo
  // entre eles (context.md D-3), e editar um não toca nos outros (AC3). O único
  // campo que os distingue é mes_referencia.
  const sucessos = meses.map<SucessoMensalInput>((mes) => ({
    id_meta: idMeta,
    descricao: base.descricao,
    mes_referencia: mes,
    dt_limite: base.dtLimite ?? null,
    peso: base.peso,
    pct_atingimento: base.pctAtingimento ?? null,
    status: base.status,
    id_usuario_responsavel: base.idUsuarioResponsavel ?? null,
  }));

  return { meses, sucessos };
}
