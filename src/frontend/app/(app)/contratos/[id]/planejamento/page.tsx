import { EmDesenvolvimento } from "@/components/app-shell/em-desenvolvimento";

// NAV-08: corrige o link "Plan."/"Planejamento" já existente e quebrado em
// contratos/page.tsx e mandatos/[id]/page.tsx (AC6 do NAV-04) -- nenhum dos
// dois arquivos muda, só a rota passa a existir.
export default function ContratoPlanejamentoPage() {
  return <EmDesenvolvimento titulo="Planejamento Estratégico em desenvolvimento" />;
}
