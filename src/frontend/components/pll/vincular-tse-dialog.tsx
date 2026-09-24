"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

import type { ResumoExclusaoContrato } from "@backend/rpc/exclusao";
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
import { linhasExclusaoContrato } from "@/lib/exclusao-rotulos";

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
  // Sessão 23/09 (Pedro): "para fazer o match preciso comparar as
  // informações" -- opcionais porque VincularTseDialog é reaproveitado a
  // partir de ParticipantePll (que sempre traz), mas a interface fica solta
  // de propósito (não acopla este Dialog ao shape completo de ParticipantePll).
  corRacaParlamentar?: string | null;
  cargosAnteriores?: string | null;
  mandatosAnteriores?: string | null;
  redeSocial?: string | null;
}

export interface VincularTseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participante: ParticipantePreenchimentoBusca;
  onConfirmar: (
    candidatura: CandidaturaSugerida,
    opcoes: { confirmouExclusaoContratoAtual: boolean },
  ) => void | Promise<void>;
  onNaoEncontrado: () => void | Promise<void>;
  /** Linha já vinculada (Editar vínculo): o que a troca para esta
   * candidatura apagaria. `null` = nada (mesmo parlamentar). Ausente =
   * primeiro vínculo, nunca há exclusão. */
  previaTroca?: (candidatura: CandidaturaSugerida) => Promise<ResumoExclusaoContrato | null>;
}

export function VincularTseDialog({
  open,
  onOpenChange,
  participante,
  onConfirmar,
  onNaoEncontrado,
  previaTroca,
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
  // Troca para outro parlamentar (Pedro, 24/09): o contrato atual é excluído
  // com tudo que há nele -- o aviso substitui a busca até a pessoa decidir.
  const [trocaPendente, setTrocaPendente] = useState<{
    candidatura: CandidaturaSugerida;
    resumo: ResumoExclusaoContrato;
  } | null>(null);
  const [erroPrevia, setErroPrevia] = useState<string | null>(null);

  async function selecionar(escolhida: CandidaturaSugerida) {
    const candidatura: CandidaturaSugerida = modoManualAtivo ? { ...escolhida, metodoMatch: "manual" } : escolhida;
    setErroPrevia(null);
    if (previaTroca) {
      setConfirmando(true);
      try {
        const resumo = await previaTroca(candidatura);
        if (resumo) {
          setTrocaPendente({ candidatura, resumo });
          return;
        }
      } catch (e) {
        setErroPrevia(e instanceof Error ? e.message : "Não foi possível verificar o vínculo atual.");
        return;
      } finally {
        setConfirmando(false);
      }
    }
    await confirmar(candidatura, false);
  }

  async function confirmar(candidatura: CandidaturaSugerida, confirmouExclusaoContratoAtual: boolean) {
    setConfirmando(true);
    try {
      await onConfirmar(candidatura, { confirmouExclusaoContratoAtual });
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
            Confirme a candidatura correta do parlamentar ou marque que não foi encontrado — ou feche (X) para decidir
            depois.
          </DialogDescription>
        </DialogHeader>

        {trocaPendente ? (
          <AvisoExclusaoTroca
            nomeCandidatura={
              trocaPendente.candidatura.nmUrna ?? trocaPendente.candidatura.nmCandidato ?? "a nova candidatura"
            }
            resumo={trocaPendente.resumo}
            confirmando={confirmando}
            onVoltar={() => setTrocaPendente(null)}
            onConfirmar={() => void confirmar(trocaPendente.candidatura, true)}
          />
        ) : (
          <>
            {(participante.cargosAnteriores ||
              participante.mandatosAnteriores ||
              participante.corRacaParlamentar ||
              participante.redeSocial) && (
              <div className="grid gap-1 rounded-lg border border-border bg-muted/40 p-3 text-xs">
                <p className="font-bold uppercase text-muted-foreground">Autodeclarado na planilha</p>
                {participante.corRacaParlamentar && <p>Cor/raça: {participante.corRacaParlamentar}</p>}
                {participante.cargosAnteriores && <p>Cargos anteriores: {participante.cargosAnteriores}</p>}
                {participante.mandatosAnteriores && <p>Mandatos anteriores: {participante.mandatosAnteriores}</p>}
                {participante.redeSocial && <p>Rede social: {participante.redeSocial}</p>}
              </div>
            )}

            <Command shouldFilter={false}>
              <CommandInput placeholder="Digite o nome..." value={nome} onValueChange={setNome} />
              <ResultadosBuscaTse
                buscando={buscando}
                erro={erro}
                resultados={resultadosExibidos}
                onSelecionar={(candidatura) => void selecionar(candidatura)}
              />
            </Command>

            {erroPrevia && <p className="text-sm text-destructive">{erroPrevia}</p>}

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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Mesma lista "Será apagado do banco" da exclusão de mandato na Estratégia
// (editar-contrato-dialog.tsx), a partir do mesmo resumo do banco.
function AvisoExclusaoTroca({
  nomeCandidatura,
  resumo,
  confirmando,
  onVoltar,
  onConfirmar,
}: {
  nomeCandidatura: string;
  resumo: ResumoExclusaoContrato;
  confirmando: boolean;
  onVoltar: () => void;
  onConfirmar: () => void;
}) {
  const linhas = linhasExclusaoContrato(resumo.contagens);
  return (
    <>
      <div className="grid gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p className="flex items-center gap-2 font-bold text-destructive">
          <AlertTriangle className="size-4" />
          Trocar para {nomeCandidatura} exclui o contrato atual
        </p>
        <p className="text-muted-foreground">
          A candidatura escolhida é de outro parlamentar. O contrato vinculado hoje ({resumo.nomeContratante}) será
          excluído definitivamente, com tudo que foi registrado nele. Não é possível desfazer.
        </p>
        <div className="grid gap-1.5">
          <p className="font-medium">Será apagado do banco:</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            <li>O contrato de {resumo.nomeContratante}</li>
            {linhas.map((l) => (
              <li key={l}>{l}</li>
            ))}
            {resumo.apagaContratante && <li>O cadastro do parlamentar (contratante e mandato)</li>}
          </ul>
        </div>
        {!resumo.apagaContratante && (
          <p className="rounded-md bg-muted/50 p-3 text-muted-foreground">
            O cadastro de {resumo.nomeContratante} <strong>não</strong> será apagado: ainda tem outro contrato,
            prospecção ou coalizão no sistema.
          </p>
        )}
      </div>

      <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onVoltar} disabled={confirmando}>
          Voltar
        </Button>
        <Button type="button" variant="destructive" className="gap-2" onClick={onConfirmar} disabled={confirmando}>
          {confirmando ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Excluindo e vinculando…
            </>
          ) : (
            <>
              <Trash2 className="size-4" />
              Excluir contrato e trocar
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
