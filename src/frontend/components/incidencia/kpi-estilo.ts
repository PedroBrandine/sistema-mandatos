// Estilo compartilhado dos cartões da faixa de KPIs do Ciclo de Vida (Figma
// 109:60): cartão branco com padding 20, rótulo Commissioner Bold 11px em
// caixa alta e número em Anton 36px vinho. Anton só existe em peso 400, então
// o número nunca leva font-bold/font-semibold. Caixa alta pelo CSS, não no
// texto: o rótulo escrito em maiúsculas faz leitor de tela soletrar sigla.
export const CLASSE_KPI_CARD = "[--card-spacing:--spacing(5)] gap-3";
export const CLASSE_KPI_ROTULO = "text-[11px] font-bold uppercase text-muted-foreground";
export const CLASSE_KPI_NUMERO = "font-heading text-4xl leading-none text-secondary";
