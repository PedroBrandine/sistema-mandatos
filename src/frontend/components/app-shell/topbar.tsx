"use client";

import Link from "next/link";
import { Flag, User } from "lucide-react";

// Figma 57:671 / 44:5: faixa verde chapada (#035252, sem transparência nem
// blur), logo = quadrado coral com bandeira branca + "LEGISLA BRASIL" em Anton
// caixa alta, "Hub" como texto simples e avatar circular vinho. Sem subtítulo
// e sem sombra -- o desenho não tem.
export function Topbar() {
  return (
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between bg-sidebar px-6 text-sidebar-foreground md:px-12">
      <Link href="/" className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-coral text-white">
          <Flag className="size-4" fill="currentColor" aria-hidden="true" />
        </span>
        <span className="font-heading text-xl uppercase tracking-wide">Legisla Brasil</span>
      </Link>

      <div className="flex items-center gap-5">
        <Link href="/" className="text-sm font-medium text-sidebar-foreground/90 transition-colors hover:text-sidebar-foreground">
          Hub
        </Link>

        {/* Placeholder para Avatar de Usuário Logado */}
        <button
          type="button"
          aria-label="Menu do usuário"
          className="flex size-8 items-center justify-center rounded-full bg-secondary ring-2 ring-white/80 transition-colors hover:bg-secondary/90"
        >
          <User className="size-4 text-sidebar-foreground" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
