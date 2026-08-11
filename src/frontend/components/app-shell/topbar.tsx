"use client";

import Link from "next/link";
import { Flag, Home, Users2 } from "lucide-react";

import { usePapelGlobal } from "@/hooks/use-papel-global";
import { cn } from "@/lib/utils";

const LINK_CLASSES =
  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-sidebar-foreground/80 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-[0.98]";

// Substitui a Sidebar (nav lateral por entidade) -- marca + link de volta ao
// hub + Usuários condicionado a papel_global. Ver design.md (Components ->
// Topbar) e NAV-14/NAV-15.
export function Topbar() {
  const { papel } = usePapelGlobal();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/60 bg-sidebar px-6 text-sidebar-foreground">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
          <Flag className="size-5" aria-hidden="true" />
        </div>
        <div className="flex flex-col">
          <span className="font-heading text-base font-bold uppercase tracking-wider text-sidebar-foreground">
            Legisla Brasil
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            Sistema Mandatos
          </span>
        </div>
      </div>

      <nav className="flex items-center gap-1.5">
        <Link href="/" className={cn(LINK_CLASSES)}>
          <Home className="size-4 shrink-0" aria-hidden="true" />
          <span>Voltar ao hub</span>
        </Link>
        {(papel === "admin" || papel === "gestora") && (
          <Link href="/usuarios" className={cn(LINK_CLASSES)}>
            <Users2 className="size-4 shrink-0" aria-hidden="true" />
            <span>Usuários</span>
          </Link>
        )}
      </nav>
    </header>
  );
}
