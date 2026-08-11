"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export interface RouteTabItem {
  href: string;
  label: string;
  ativoSe?: (pathname: string) => boolean;
}

interface RouteTabsProps {
  items: RouteTabItem[];
}

// Abas baseadas em rota (Link + usePathname), não em estado de client --
// extrai o cálculo de "ativo" que a sidebar antiga usava inline
// (sidebar.tsx:44-47, já removido em T8) para reuso em ProdutoShell e
// FichaContratoChrome. Ver design.md (Components -> RouteTabs).
export function RouteTabs({ items }: RouteTabsProps) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 border-b border-border/60">
      {items.map(({ href, label, ativoSe }) => {
        const ativo = ativoSe
          ? ativoSe(pathname ?? "")
          : pathname === href || pathname?.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "border-b-2 px-3 py-2.5 text-sm font-medium transition-all duration-150",
              ativo
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
