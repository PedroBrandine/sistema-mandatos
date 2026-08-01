"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-xs text-muted-foreground">
      <ol className="flex items-center gap-1.5 flex-wrap">
        <li className="inline-flex items-center gap-1.5">
          <Link
            href="/"
            className="flex items-center gap-1 hover:text-foreground transition-colors font-medium"
          >
            <Home className="size-3.5" />
            <span>Início</span>
          </Link>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="inline-flex items-center gap-1.5">
              <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors font-medium max-w-[150px] truncate"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="font-semibold text-foreground max-w-[200px] truncate">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
