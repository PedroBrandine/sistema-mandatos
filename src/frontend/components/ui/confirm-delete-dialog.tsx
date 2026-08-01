"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  itemNome?: string;
  description?: string;
  onConfirm: () => Promise<void>;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = "Confirmar Exclusão",
  itemNome,
  description = "Tem certeza que deseja excluir este registro do banco de dados? Esta ação é permanente e não poderá ser desfeita.",
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [excluindo, setExcluindo] = useState(false);

  const handleConfirm = async () => {
    try {
      setExcluindo(true);
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      console.error("Erro ao excluir:", err);
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !excluindo && onOpenChange(val)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex flex-col gap-2">
          <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive w-fit">
            <AlertTriangle className="size-5" />
          </div>
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            {itemNome ? (
              <>
                Você está prestes a excluir <strong className="text-foreground">{itemNome}</strong>. {description}
              </>
            ) : (
              description
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={excluindo}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={excluindo}
            className="gap-2"
          >
            {excluindo ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="size-4" />
                Sim, Excluir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
