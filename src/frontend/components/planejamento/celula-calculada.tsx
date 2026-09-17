import { cn } from "@/lib/utils";

// PLR-10 (regra inegociável nº1 do pedido original) + PLV-08 (T18): célula de
// % de Meta/Objetivo é CALCULADA -- nunca pode parecer editável. Fundo
// hachurado real (repeating-linear-gradient, não só cor sólida), marcador
// "fx" antes do valor, tabIndex=-1 real (Tab nunca para aqui), sem handler de
// clique/foco.
//
// Extraído de planejamento-grade.tsx (onde nasceu, PLR-10) para
// meta-form.tsx/objetivo-form.tsx reusarem em vez de duplicar a marcação --
// duplicar deixaria as duas cópias livres para divergir em silêncio, e é
// exatamente a regra que não pode ter exceção por descuido de cópia-e-cola.
export function formatarPct(valor: number | null): string {
  return valor == null ? "—" : `${valor}%`;
}

export function CelulaCalculada({ valor, className }: { valor: number | null; className?: string }) {
  return (
    <span
      tabIndex={-1}
      aria-readonly="true"
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-md border border-dashed border-muted-foreground/30 px-2 py-1 text-sm tabular-nums text-muted-foreground",
        "bg-[repeating-linear-gradient(135deg,transparent,transparent_4px,var(--muted)_4px,var(--muted)_8px)]",
        className
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">fx</span>
      {formatarPct(valor)}
    </span>
  );
}
