import { EmDesenvolvimento } from "@/components/app-shell/em-desenvolvimento";

// FMC-04 (spec.md AC6): "Diagnóstico" não tem conteúdo desenhado -- nenhum
// dos 19 mockups da feature desenha o interior (spec.md "Out of Scope";
// conteúdo é spec própria). Rota + placeholder explícito, com título
// próprio, nunca tela em branco.
export default function ContratoDiagnosticoPage() {
  return <EmDesenvolvimento titulo="Diagnóstico" />;
}
