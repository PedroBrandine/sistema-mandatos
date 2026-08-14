// visao-gerencial-g3-g6, T23 (skill dataviz, references/palette.md). 8
// matizes fixos definidos em globals.css (--series-1..8) -- cor segue a
// ENTIDADE (id_usuario_gestora), nunca o ranking/posição no array: filtrar
// não pode repintar quem sobrou (regra de visualização do pedido original).
// Por isso o slot vem de id % 8, não do índice de ordenação -- uma Gestora
// específica sempre cai no mesmo slot, esteja ela em 1º ou 6º lugar no
// recorte atual. Colisão entre 2 Gestoras simultaneamente visíveis é um
// trade-off aceito (identidade estável > distinção garantida numa única
// tela) -- mesma priorização que a regra do pedido original estabelece.
const SLOTS = 8;

export function corPorId(id: number): string {
  const slot = ((id % SLOTS) + SLOTS) % SLOTS; // sempre positivo
  return `var(--series-${slot + 1})`;
}

export const CorOutras = "var(--series-outras)";
