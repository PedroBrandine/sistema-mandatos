"use client";

import { useState } from "react";

import { marcarFatoRealizado } from "@backend/rpc/fato-gerador";
import { createClient } from "@backend/supabase/client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ErroInline } from "@/components/ui/erro-inline";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// FGC-08 (T19, fatos-geradores-ciclo-vida). Transição projetado -> realizado
// (spec.md P1 "Fato projetado e sua realização" AC4): exige a Data de
// ocorrência NO ATO -- não existe transição automática por passar da data
// prevista (Edge Case do spec). UPDATE direto (T10, marcarFatoRealizado) --
// RLS p_por_contrato já cobre (FOR ALL), nenhuma policy nova.
export interface RealizarFatoDialogProps {
  idFatoGerador: number;
  onConcluido: () => void;
}

export function RealizarFatoDialog({ idFatoGerador, onConcluido }: RealizarFatoDialogProps) {
  const [aberto, setAberto] = useState(false);
  const [dtOcorrencia, setDtOcorrencia] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    const supabase = createClient();

    try {
      await marcarFatoRealizado(supabase, idFatoGerador, dtOcorrencia);
      setAberto(false);
      setDtOcorrencia("");
      onConcluido();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível registrar como realizado.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(novoAberto) => {
        setAberto(novoAberto);
        if (!novoAberto) {
          setDtOcorrencia("");
          setErro(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Registrar como realizado
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar como realizado</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="dt-ocorrencia-realizar">Data de ocorrência</Label>
            <Input
              id="dt-ocorrencia-realizar"
              type="date"
              value={dtOcorrencia}
              onChange={(e) => setDtOcorrencia(e.target.value)}
            />
          </div>

          {erro && <ErroInline mensagem={erro} />}

          <div className="flex justify-end">
            <Button type="button" onClick={confirmar} disabled={enviando || !dtOcorrencia}>
              {enviando ? "Salvando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
