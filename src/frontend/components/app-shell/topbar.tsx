"use client";

import Link from "next/link";
import { Flag, Home, Users2, User } from "lucide-react";

import { usePapelGlobal } from "@/hooks/use-papel-global";
import { cn } from "@/lib/utils";

const LINK_CLASSES =
  "flex items-center gap-2.5 rounded-full px-4 py-2 text-sm font-medium text-sidebar-foreground/80 transition-all duration-300 hover:bg-white/10 hover:text-sidebar-foreground active:scale-[0.98]";

export function Topbar() {
  const { papel } = usePapelGlobal();

  return (
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-border/10 bg-sidebar/95 px-6 text-sidebar-foreground backdrop-blur-md supports-[backdrop-filter]:bg-sidebar/85 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-[#852a4e] text-sidebar-primary-foreground shadow-[0_2px_10px_rgba(87,23,48,0.4)] ring-1 ring-white/10">
          <Flag className="size-5" strokeWidth={2.5} aria-hidden="true" />
        </div>
        <div className="flex flex-col">
          <span className="font-heading text-lg font-semibold tracking-wide text-sidebar-foreground">
            Legisla Brasil
          </span>
          <span className="text-[10px] text-sidebar-foreground/60 font-mono tracking-widest uppercase mt-[-2px]">
            Sistema Mandatos
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <nav className="flex items-center gap-1.5 border-r border-white/10 pr-4">
          <Link href="/" className={cn(LINK_CLASSES)}>
            <Home className="size-4 shrink-0 opacity-70" aria-hidden="true" />
            <span>Hub</span>
          </Link>
          {(papel === "admin" || papel === "gestora") && (
            <Link href="/usuarios" className={cn(LINK_CLASSES)}>
              <Users2 className="size-4 shrink-0 opacity-70" aria-hidden="true" />
              <span>Gestão de Usuários</span>
            </Link>
          )}
        </nav>
        
        {/* Placeholder para Avatar de Usuário Logado */}
        <button className="flex size-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 transition-all hover:bg-white/20 hover:ring-white/40 overflow-hidden">
           <User className="size-4 text-sidebar-foreground" />
        </button>
      </div>
    </header>
  );
}
