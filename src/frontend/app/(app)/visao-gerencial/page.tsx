import { EmDesenvolvimento } from "@/components/app-shell/em-desenvolvimento";

// NAV-13: placeholder único, sem abas nem produto associado (AC1).
export default function VisaoGerencialPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6">
      <EmDesenvolvimento titulo="Indicadores em desenvolvimento" />
    </div>
  );
}
