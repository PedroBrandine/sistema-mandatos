import type { LinhaEvolucaoMensal } from "@backend/queries/planejamento";

// PLV-13 AC3. A view vw_planejamento_evolucao_mensal entrega os dois
// acumulados (Esperado e Atingido) por mês; o que falta para responder "quanto
// eu avancei no mês X?" é a diferença entre um ponto e o anterior.
//
// Isto não fere AD-003 (número de gestão sai de view, nunca de agregação no
// cliente): não há agregação aqui. Nenhum peso é somado, nenhum Sucesso Mensal
// é lido -- a função subtrai dois números que a view já calculou. Somar pesos
// no browser seria a violação; subtrair dois acumulados prontos é leitura.
//
// Ausência é nula, nunca zero (AD-005). Mês sem Atingido -- futuro, pela AC8,
// ou buraco de dado -- sai com `avanco: null`, e a tela mostra "—". Zero é
// medição: "mediu e não andou". Nulo é "não mediu". Confundir os dois inverte o
// diagnóstico que a Gestora faz na reunião mensal.
export interface PontoEvolucaoMensal extends LinhaEvolucaoMensal {
  /** `Atingido(M) − Atingido(M−1)`. Nulo quando M ou M−1 não tem Atingido. */
  avanco: number | null;
}

export function calculaAvancoMensal(serie: LinhaEvolucaoMensal[]): PontoEvolucaoMensal[] {
  return serie.map((linha, indice) => {
    if (linha.pctAtingido == null) {
      return { ...linha, avanco: null };
    }

    // Antes do primeiro mês o plano vale zero -- não é ponto ausente, é o
    // início da régua. Por isso o primeiro mês tem avanço igual ao acumulado.
    if (indice === 0) {
      return { ...linha, avanco: linha.pctAtingido };
    }

    // Anterior sem medição: a diferença não seria avanço de um mês, e sim de um
    // intervalo de tamanho desconhecido. Preferimos "—" a um número plausível.
    const anterior = serie[indice - 1].pctAtingido;
    if (anterior == null) {
      return { ...linha, avanco: null };
    }

    return { ...linha, avanco: linha.pctAtingido - anterior };
  });
}
