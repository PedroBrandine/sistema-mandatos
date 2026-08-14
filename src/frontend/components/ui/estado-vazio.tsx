import { LayoutTemplate } from "lucide-react";

export interface EstadoVazioProps {
  titulo: string;
  mensagem?: string;
  acao?: React.ReactNode;
}

export function EstadoVazio({ titulo, mensagem, acao }: EstadoVazioProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-20 text-center shadow-sm relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5 pointer-events-none" />
      
      {/* Icon with glow effect */}
      <div className="relative flex size-20 items-center justify-center rounded-full bg-primary/5 shadow-inner ring-1 ring-primary/10">
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl opacity-50" />
        <LayoutTemplate className="relative size-10 text-primary/70" strokeWidth={1.5} />
      </div>

      <div className="grid gap-2 relative z-10 max-w-md">
        <p className="font-heading text-xl font-medium text-foreground">{titulo}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {mensagem || "Esta área ainda não possui dados ou está em fase de construção."}
        </p>
      </div>
      
      {acao && <div className="relative z-10 mt-2">{acao}</div>}
    </div>
  );
}
