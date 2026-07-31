"use client";

import type { ContratanteSimilar } from "@backend/types/fundacao";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Aviso de duplicata de contratante (FND-TSE-05) -- exibido quando
// app.criar_mandato/app.criar_coalizao levanta MDU01 (DuplicataDetectadaError,
// src/backend/rpc/errors.ts, T28). Puramente apresentacional: quem monta o
// componente decide quando ele existe na árvore (sem prop `open` própria --
// design.md só define candidatos/onConfirmar/onCancelar) e o que acontece ao
// confirmar/cancelar (reenviar com ignorarDuplicata=true, ou descartar).
export interface DuplicataWarningDialogProps {
  candidatos: ContratanteSimilar[];
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function DuplicataWarningDialog({
  candidatos,
  onConfirmar,
  onCancelar,
}: DuplicataWarningDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancelar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contratante(s) parecido(s) já cadastrado(s)</DialogTitle>
          <DialogDescription>
            Confira se não é o mesmo contratante antes de continuar o cadastro.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-1 text-sm">
          {candidatos.map((c) => (
            <li key={c.idContratante}>
              {c.nome}
              {c.sgUf ? ` — ${c.sgUf}` : ""}
              {c.nmMunicipio ? ` / ${c.nmMunicipio}` : ""}
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirmar}>
            Confirmar mesmo assim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
