// Identificação do mandato nos itens da Incidência quando a lista mistura
// vários contratos (aba "Fatos Geradores" do produto). Na aba do contrato todo
// item é do mesmo mandato, então nada disto é passado e a tela não muda.
//
// `nome` é o do contratante (dim_contratante) -- o mesmo título que o card da
// aba Mandatos usa para o contrato. `href` leva à ficha do contrato, onde a
// escrita mora (AD-057).
export interface ContratoIdentificado {
  nome: string;
  href: string;
}

export type MapaContratos = ReadonlyMap<number, ContratoIdentificado>;
