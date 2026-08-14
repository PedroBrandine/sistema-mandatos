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

export function RouteTabs({ items }: RouteTabsProps) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-6 border-b border-border/40 overflow-x-auto scrollbar-none">
      {items.map(({ href, label, ativoSe }) => {
        const ativo = ativoSe
          ? ativoSe(pathname ?? "")
          : pathname === href || pathname?.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative pb-3 text-sm font-medium transition-colors duration-200 whitespace-nowrap",
              ativo
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
            {/* Active Indicator (Underline) */}
            {ativo && (
              <span className="absolute bottom-0 left-0 w-full h-[2.5px] rounded-t-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
