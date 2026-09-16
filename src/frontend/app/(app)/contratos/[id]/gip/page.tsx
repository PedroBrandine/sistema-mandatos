import { EmDesenvolvimento } from "@/components/app-shell/em-desenvolvimento";

// FMC-04 (spec.md, "P1: Barra de abas funcional da ficha"): rota da aba
// "GIP" aberta pela barra de 8 abas (T22). Os três modos de preenchimento
// (Início, Fim, Evolução) chegam na T36; até lá, a rota resolve com um
// placeholder explícito, nunca tela em branco ou 404.
export default function ContratoGipPage() {
  return <EmDesenvolvimento titulo="GIP em desenvolvimento" />;
}
