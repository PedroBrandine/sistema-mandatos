"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { ContratoCard } from "@backend/queries/mandatos-lista";
import { excluirContrato, resumoExclusaoContrato, type ResumoExclusaoContrato } from "@backend/rpc/exclusao";
import { createClient } from "@backend/supabase/client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErroInline } from "@/components/ui/erro-inline";
import { linhasExclusaoContrato } from "@/lib/exclusao-rotulos";

// Caixa "Editar contrato" da aba Mandatos. Hoje a única ação é excluir o
// mandato do banco -- DEFINITIVAMENTE (pedido de Pedro, 2026-09-21). Exclusão
// em duas etapas dentro da mesma caixa:
//   1. "Editar contrato": o botão "Excluir mandato" numa zona de perigo;
//   2. "Confirmar": mostra tudo que sai (contagens do banco, inclusive o 2º
//      nível e se o cadastro da pessoa vai junto) e um botão "Excluir
//      definitivamente" -- sem exigir digitar o nome (Pedro, 2026-09-22:
//      "não precisamos desta segurança toda, pode ser mais simples com botão
//      de confirmar").
// Só admin/gestora chegam aqui (a página nem oferece o botão aos demais) e o
// banco recusa qualquer outro papel com 42501.
export interface EditarContratoDialogProps {
  contrato: ContratoCard | null;
  onOpenChange: (aberto: boolean) => void;
  // Chamado depois que o banco confirmou a exclusão -- a página recarrega as
  // listas.
  onExcluido: () => void;
}

export function EditarContratoDialog({ contrato, onOpenChange, onExcluido }: EditarContratoDialogProps) {
  return (
    <Dialog open={contrato !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* key: reabrir em outro contrato zera etapa, texto digitado e erro. */}
        {contrato && (
          <Conteudo
            key={contrato.idContrato}
            contrato={contrato}
            onFechar={() => onOpenChange(false)}
            onExcluido={onExcluido}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Conteudo({
  contrato,
  onFechar,
  onExcluido,
}: {
  contrato: ContratoCard;
  onFechar: () => void;
  onExcluido: () => void;
}) {
  const [etapa, setEtapa] = useState<"editar" | "confirmar">("editar");
  const [resumo, setResumo] = useState<ResumoExclusaoContrato | null>(null);
  const [carregandoResumo, setCarregandoResumo] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const nome = contrato.nomeContratante;

  async function iniciarExclusao() {
    setEtapa("confirmar");
    setErro(null);
    setCarregandoResumo(true);
    try {
      setResumo(await resumoExclusaoContrato(createClient(), contrato.idContrato));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível levantar o que será apagado.");
    } finally {
      setCarregandoResumo(false);
    }
  }

  async function confirmarExclusao() {
    setExcluindo(true);
    setErro(null);
    try {
      await excluirContrato(createClient(), contrato.idContrato);
      toast.success(`Mandato de ${nome} excluído.`);
      onExcluido();
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir o mandato.");
      setExcluindo(false);
    }
  }

  if (etapa === "editar") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Editar contrato</DialogTitle>
          <DialogDescription>Contrato {nome}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="grid gap-1">
            <p className="text-sm font-bold text-destructive">Zona de perigo</p>
            <p className="text-sm text-muted-foreground">
              Exclui o mandato do banco de dados, com tudo que foi registrado nele. Não é possível desfazer.
            </p>
          </div>
          <Button type="button" variant="destructive" className="w-fit gap-2" onClick={() => void iniciarExclusao()}>
            <Trash2 className="size-4" />
            Excluir mandato
          </Button>
        </div>
      </>
    );
  }

  const linhas = resumo ? linhasExclusaoContrato(resumo.contagens) : [];

  return (
    <>
      <DialogHeader className="flex flex-col gap-2">
        <div className="flex size-11 w-fit items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </div>
        <DialogTitle>Excluir o mandato de {nome}?</DialogTitle>
        <DialogDescription>Esta ação é permanente e não poderá ser desfeita.</DialogDescription>
      </DialogHeader>

      {carregandoResumo && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Levantando o que será apagado…
        </p>
      )}

      {resumo && (
        <div className="grid gap-3 text-sm">
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
              O cadastro do parlamentar <strong>não</strong> será apagado: ele ainda tem outro contrato, prospecção ou
              coalizão no sistema.
            </p>
          )}
        </div>
      )}

      {erro && <ErroInline titulo="Não foi possível excluir" mensagem={erro} />}

      <DialogFooter className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onFechar} disabled={excluindo}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="gap-2"
          disabled={!resumo || excluindo}
          onClick={() => void confirmarExclusao()}
        >
          {excluindo ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Excluindo…
            </>
          ) : (
            <>
              <Trash2 className="size-4" />
              Excluir definitivamente
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
