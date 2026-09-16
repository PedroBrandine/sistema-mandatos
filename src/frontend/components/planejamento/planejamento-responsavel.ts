import type { PessoaVinculada } from "@backend/queries/planejamento";

// PLV-03. Quem a coluna RESP. da grade mostra para um Sucesso Mensal.
//
// A herança é de EXIBIÇÃO, nunca gravada: quando o SM não tem responsável
// próprio, ele continua com id_usuario_responsavel nulo no banco e apenas
// mostra o da Meta, marcado como herdado. Persistir o herdado congelaria a
// resposta -- trocar o responsável da Meta deixaria de reverberar nos SMs que
// nunca tiveram um.
//
// Distinto de atualizado_por, que é auditoria (AD-006, quem mexeu por último) e
// não responsabilidade pela entrega.
export interface ResponsavelResolvido {
  /**
   * Ausência real de atribuição é `null` -- a grade mostra `—` (AD-005).
   * `nome: null` é outra coisa: há atribuição, mas a pessoa não está na equipe
   * ativa do contrato, então não temos como nomeá-la.
   */
  pessoa: { idUsuario: number; nome: string | null } | null;
  /** `true` só quando a pessoa veio da Meta por falta de responsável próprio. */
  herdado: boolean;
}

function nomeia(idUsuario: number, equipe: PessoaVinculada[]): { idUsuario: number; nome: string | null } {
  const encontrada = equipe.find((pessoa) => pessoa.idUsuario === idUsuario);
  // buscarPessoasVinculadasAoContrato devolve "" quando dim_usuario não tem o
  // nome; em tela isso vira avatar mudo. Nome vazio e pessoa fora da equipe são
  // a mesma situação para quem lê a grade: sabemos quem, não sabemos o nome.
  return { idUsuario, nome: encontrada?.nome ? encontrada.nome : null };
}

export function resolveResponsavel(
  idResponsavelSucesso: number | null,
  idResponsavelMeta: number | null,
  equipe: PessoaVinculada[]
): ResponsavelResolvido {
  // O próprio vence, mesmo quando é a mesma pessoa da Meta: é atribuição
  // explícita que coincide, e tratá-la como herdada faria tirar o responsável
  // da Meta apagar da grade um responsável que o SM tem gravado.
  if (idResponsavelSucesso != null) {
    return { pessoa: nomeia(idResponsavelSucesso, equipe), herdado: false };
  }

  if (idResponsavelMeta != null) {
    return { pessoa: nomeia(idResponsavelMeta, equipe), herdado: true };
  }

  // AC4. Nada atribuído em lugar nenhum -- não há o que herdar, então `herdado`
  // é false, não uma herança de ninguém.
  return { pessoa: null, herdado: false };
}
