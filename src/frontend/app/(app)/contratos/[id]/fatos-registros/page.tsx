import { EmDesenvolvimento } from "@/components/app-shell/em-desenvolvimento";

// FMC-04 (spec.md AC6, AC7): "Fatos Geradores e Registros" já tem dona --
// .specs/features/fatos-geradores-ciclo-vida (Specify concluído, aguardando
// aceite). Aqui entra só como rota + placeholder explícito, com o rótulo
// exato que a barra usa (ficha-contrato-chrome.tsx, T22).
export default function ContratoFatosRegistrosPage() {
  return <EmDesenvolvimento titulo="Fatos Geradores e Registros" />;
}
