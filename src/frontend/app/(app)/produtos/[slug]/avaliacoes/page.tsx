"use client";

import { EmDesenvolvimento } from "@/components/app-shell/em-desenvolvimento";

// PF2-01 (.specs/features/pente-fino-2026-09-23/spec.md): elimina o 404 real
// da aba "Avaliações" do PLL. `ProdutoLayout`/`ProdutoShell` já cuidam do
// chrome (cabeçalho, abas) e do gate de papel por produto -- esta página só
// precisa do conteúdo, mesmo padrão de placeholder já usado por outras abas
// em desenvolvimento (ver `EmDesenvolvimento`).
export default function ProdutoAvaliacoesPage() {
  return <EmDesenvolvimento titulo="Avaliações em desenvolvimento" />;
}
