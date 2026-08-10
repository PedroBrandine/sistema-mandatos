"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Wrapper do Toaster do sonner sem next-themes -- o app não tem alternância
 * de tema hoje (AD-029). Tema fixo em "light"; cores mapeadas nos tokens já
 * existentes em globals.css (AD-027), mesmos usados por Alert/Dialog.
 */
function Toaster({ style, ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--error-bg": "var(--popover)",
          "--error-text": "var(--destructive)",
          "--error-border": "var(--border)",
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
