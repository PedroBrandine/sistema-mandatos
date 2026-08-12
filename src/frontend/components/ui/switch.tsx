"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// SPEC_DEVIATION: kanban-etapas/design.md assumia "Switch/Checkbox (shadcn)"
// já instalado para o filtro "Minha carteira" (T10) -- nenhum dos dois
// existia em components/ui/. O primitivo Switch já está disponível via
// "radix-ui" (dependência existente, usada por select.tsx), então não foi
// necessário `npm install` novo -- só faltava este wrapper, no mesmo padrão
// de select.tsx (data-slot, import unificado "radix-ui").
// Reason: instalar via `npx shadcn add switch` exigiria rede não disponível
// nesta sessão; a API do primitivo (Root/Thumb, data-state) é estável e
// documentada, replicada aqui manualmente.
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-background ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
