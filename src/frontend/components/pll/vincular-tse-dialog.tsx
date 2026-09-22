"use client";

import { useState } from "react";

import type { CandidaturaSugerida } from "@backend/types/fundacao";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Command, CommandInput } from "@/components/ui/command";
import { ResultadosBuscaTse, useBuscaTse } from "@/components/fundacao/tse-match-search";

// T11 (design.md "VincularTseDialog", PLL-CP-10, PLL-CP-13). Reaproveita
// `useBuscaTse`/`ResultadosBuscaTse` de tse-match-search.tsx SEM alteração
// nesse arquivo (mesma lógica de busca da Estratégia) -- não usa o
// `<TseMatchSearch>` inteiro porque esse componente não aceita um valor de
// busca pré-preenchido (só gerencia `nome` internamente); aqui o hook e o
// componente puro são consumidos diretamente, com um <CommandInput> próprio
// que já nasce preenchido com o nome autodeclarado (PLL-CP-10).
//
// PLL-CP-13: fechar sem decisão (X, ESC, clique fora) é bloqueado -- o Dialog
// é 100% controlado (`open` só muda por decisão explícita: confirmar
// candidatura ou marcar "não encontrado"). `onOpenChange(false)` vindo do
// Radix (ESC/overlay) é ignorado de propósito.

export interface ParticipantePreenchimentoBusca {
  nomeCompleto: string;
  nomeParlamentar: string | null;
  siglaPartido: string | null;
  siglaUf: string | null;
}

export interface VincularTseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participante: ParticipantePreenchimentoBusca;
  onConfirmar: (candidatura: CandidaturaSugerida) => void | Promise<void>;
  onNaoEncontrado: () => void | Promise<void>;
}

export function VincularTseDialog({
  open,
  onOpenChange,
  participante,
  onConfirmar,
  onNaoEncontrado,
}: VincularTseDialogProps) {
  // PLL-CP-10: busca pré-preenchida com o nome autodeclarado (nome do
  // parlamentar tem prioridade -- é o campo que a busca do TSE realmente
  // localiza; nome completo do participante é a pessoa que assessora, não o
  // parlamentar buscado).
  const [nome, setNome] = useState(participante.nomeParlamentar ?? participante.nomeCompleto);
  const { buscando, erro, resultadosExibidos, modoManualAtivo } = useBuscaTse({
    nome,
    sgUf: participante.siglaUf ?? undefined,
  });
  const [confirmando, setConfirmando] = useState(false);
  const [marcandoNaoEncontrado, setMarcandoNaoEncontrado] = useState(false);

  async function selecionar(candidatura: CandidaturaSugerida) {
    setConfirmando(true);
    try {
      await onConfirmar(modoManualAtivo ? { ...candidatura, metodoMatch: "manual" } : candidatura);
      onOpenChange(false);
    } catch {
      // Erro já é responsabilidade de quem chama (ex.: toast na página que
      // usa este Dialog) -- aqui só evita que a rejeição escape como
      // unhandled. O dialog permanece aberto porque `onOpenChange(false)`
      // não roda neste caminho (PLL-CP-13: erro nunca é decisão explícita).
    } finally {
      setConfirmando(false);
    }
  }

  async function marcarNaoEncontrado() {
    setMarcandoNaoEncontrado(true);
    try {
      await onNaoEncontrado();
      onOpenChange(false);
    } catch {
      // Mesmo raciocínio de `selecionar` acima.
    } finally {
      setMarcandoNaoEncontrado(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(novoEstado) => {
        // PLL-CP-13: só propaga a ABERTURA -- fechar só acontece pelas duas
        // ações explícitas acima (selecionar/marcarNaoEncontrado).
        if (novoEstado) onOpenChange(true);
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular {participante.nomeCompleto} ao TSE</DialogTitle>
          <DialogDescription>
            Confirme a candidatura correta do parlamentar ou marque que não foi encontrado — fechar sem
            uma dessas duas decisões não é permitido.
          </DialogDescription>
        </DialogHeader>

        <Command shouldFilter={false}>
          <CommandInput placeholder="Digite o nome..." value={nome} onValueChange={setNome} />
          <ResultadosBuscaTse
            buscando={buscando}
            erro={erro}
            resultados={resultadosExibidos}
            onSelecionar={(candidatura) => void selecionar(candidatura)}
          />
        </Command>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => void marcarNaoEncontrado()}
            disabled={confirmando || marcandoNaoEncontrado}
          >
            {marcandoNaoEncontrado ? "Marcando..." : "Não encontrado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
