import { Skeleton } from "@/components/ui/skeleton";

export interface CarregandoSkeletonProps {
  variante?: "cards" | "table" | "list";
  linhas?: number;
}

/**
 * Placeholder de carregamento padronizado -- substitui os divs
 * animate-pulse duplicados hoje (ex.: mandatos/page.tsx). "table" e "list"
 * ficam prontas para consumidores futuros (Kanban, grade de Sucessos
 * Mensais), sem consumidor imediato nesta feature.
 */
export function CarregandoSkeleton({
  variante = "cards",
  linhas = 3,
}: CarregandoSkeletonProps) {
  if (variante === "table") {
    return (
      <div className="flex flex-col gap-2" role="status" aria-label="Carregando">
        {Array.from({ length: linhas }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (variante === "list") {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Carregando">
        {Array.from({ length: linhas }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Carregando"
    >
      {Array.from({ length: linhas }).map((_, i) => (
        <Skeleton key={i} className="h-44 rounded-xl" />
      ))}
    </div>
  );
}
