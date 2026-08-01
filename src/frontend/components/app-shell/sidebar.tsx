"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Flag,
  Handshake,
  Home,
  Landmark,
  Users2,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ITENS_NAV = [
  { href: "/", label: "Início", icone: Home, exact: true },
  { href: "/mandatos", label: "Mandatos", icone: Landmark },
  { href: "/contratos", label: "Contratos", icone: FileText },
  { href: "/coalizoes", label: "Coalizões", icone: Handshake },
  { href: "/usuarios", label: "Usuários", icone: Users2 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col gap-6 border-r border-border/60 bg-sidebar px-4 py-6 text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-2">
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

      <nav className="flex flex-col gap-1.5">
        {ITENS_NAV.map(({ href, label, icone: Icone, exact }) => {
          const ativo = exact
            ? pathname === href
            : pathname === href || pathname?.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.98]",
                ativo
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm font-semibold"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icone className="size-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
