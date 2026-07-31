"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flag, Handshake, Landmark, Users2 } from "lucide-react";

import { cn } from "@/lib/utils";

// CAD-14: nav fixa da sidebar -- só os itens que já existem hoje (Mandatos,
// Coalizões, Usuários). Cresce quando novas telas existirem (fora de escopo
// desta feature, ver spec.md Out of Scope).
const ITENS_NAV = [
  { href: "/mandatos", label: "Mandatos", icone: Landmark },
  { href: "/coalizoes", label: "Coalizões", icone: Handshake },
  { href: "/usuarios", label: "Usuários", icone: Users2 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col gap-6 bg-sidebar px-4 py-6 text-sidebar-foreground">
      <div className="flex items-center gap-2 px-2">
        {/* Logo oficial fica pro usuário substituir depois -- ícone de
            bandeira/pennant como marcador (Identidade Visual Legisla.md) */}
        <Flag className="size-6 text-sidebar-primary" aria-hidden="true" />
        <span className="font-heading text-lg uppercase tracking-wide">
          Legisla Brasil
        </span>
      </div>
      <nav className="flex flex-col gap-1">
        {ITENS_NAV.map(({ href, label, icone: Icone }) => {
          const ativo = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                ativo
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icone className="size-4" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
