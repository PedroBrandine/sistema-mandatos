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
// PLL-CP-13, revisado em sessão ao vivo com Pedro (22/09): fechar por ESC ou
// clique fora continua bloqueado (dismiss acidental durante a digitação da
// busca) -- mas agora existe um X explícito no canto do Dialog, decisão
// deliberada de sair sem vincular nem marcar "não encontrado" (ex.: revisar
// esta linha depois, seguir para a próxima da planilha). ESC/overlay são
// interceptados em DialogContent (onEscapeKeyDown/onPointerDownOutside);
// o X usa o Radix Dialog.Close padrão, que passa por `onOpenChange(false)`
// normalmente -- por isso o guard abaixo não filtra mais `false`.

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={(evento) => evento.preventDefault()}
        onPointerDownOutside={(evento) => evento.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Vincular {participante.nomeCompleto} ao TSE</DialogTitle>
          <DialogDescription>
            Confirme a candidatura correta do parlamentar ou marque que não foi encontrado — ou feche (X) para
            decidir depois.
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
