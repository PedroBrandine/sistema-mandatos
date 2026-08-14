"use client";

import { use, useState } from "react";

import { EncontroForm } from "@/components/incidencia/encontro-form";
import { EncontrosLista } from "@/components/incidencia/encontros-lista";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// INC-15, INC-16, INC-17, INC-18. Aba "Encontros" do chrome (ver
// ficha-contrato-chrome.tsx) -- lista de fat_encontro do contrato
// (EncontrosLista, com gestão de participantes) + Dialog de criação
// (EncontroForm), mesmo padrão de Dialog de usuarios/page.tsx. Disponível
// pra mandato e coalizão -- spec.md não restringe por tipo de contrato.
export default function EncontrosContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idContrato = Number(id);

  const [dialogAberto, setDialogAberto] = useState(false);
  const [atualizarSinal, setAtualizarSinal] = useState(0);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Encontros</p>

        <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
          <DialogTrigger asChild>
            <Button type="button" size="sm">
              Novo Encontro
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Encontro</DialogTitle>
            </DialogHeader>
            <EncontroForm
              idContrato={idContrato}
              onConcluido={() => {
                setDialogAberto(false);
                setAtualizarSinal((k) => k + 1);
              }}
              onCancelar={() => setDialogAberto(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <EncontrosLista idContrato={idContrato} atualizarSinal={atualizarSinal} />
    </div>
  );
}
