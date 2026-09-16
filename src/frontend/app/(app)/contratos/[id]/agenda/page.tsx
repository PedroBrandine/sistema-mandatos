import { EmDesenvolvimento } from "@/components/app-shell/em-desenvolvimento";

// FMC-04 (spec.md, "P1: Barra de abas funcional da ficha"): rota da aba
// "Agenda" aberta pela barra de 8 abas (T22). O conteúdo real -- a grade
// recortada por contrato -- chega na T37; até lá, a rota resolve com um
// placeholder explícito, nunca tela em branco ou 404. Mesmo precedente de
// `/produtos/[slug]/agenda` antes da T30b (commit 13d72f2).
export default function ContratoAgendaPage() {
  return <EmDesenvolvimento titulo="Agenda em desenvolvimento" />;
}
