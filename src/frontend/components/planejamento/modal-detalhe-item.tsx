"use client";

import type { PessoaVinculada } from "@backend/queries/planejamento";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { AcaoAtiva } from "./planejamento-grade";
import { MetaForm } from "./meta-form";
import { ObjetivoForm } from "./objetivo-form";
import { SucessoMensalForm } from "./sucesso-mensal-form";

// PLR-12, PLR-14 (.specs/features/planejamento-estrategico-redesenho, T17/T19).
// Substitui a linha sintética full-width (colSpan) de T11-T16 por um modal
// de verdade -- Radix Dialog já garante Esc-fecha/foco-trap/role="dialog"/
// aria-modal de graça (mesmo padrão de usuarios/page.tsx), sem código extra
// pra essas 4 exigências. `onOpenChange(false)` é o único caminho de
// fechar -- Esc, clique fora e o botão "Cancelar" dos forms convergem pra
// ele, então nunca há como abrir um 2º modal sem fechar o primeiro (T19,
// "nunca empilhar").
export interface ModalDetalheItemProps {
  acao: AcaoAtiva;
  idPlanejamento: number;
  produtoNome: string;
  pessoasVinculadas: PessoaVinculada[];
  onFechar: () => void;
  onHierarquiaAlterada: () => void;
  onGradeAlterada: () => void;
}

const TITULO_POR_TIPO: Record<NonNullable<AcaoAtiva>["tipo"], string> = {
  "criar-objetivo": "Novo Objetivo Específico",
  "criar-meta": "Nova Meta",
  "criar-sucesso": "Novo Sucesso Mensal",
  "editar-objetivo": "Editar Objetivo Específico",
  "editar-meta": "Editar Meta",
  "editar-sucesso": "Editar Sucesso Mensal",
};

export function ModalDetalheItem({
  acao,
  idPlanejamento,
  produtoNome,
  pessoasVinculadas,
  onFechar,
  onHierarquiaAlterada,
  onGradeAlterada,
}: ModalDetalheItemProps) {
  return (
    <Dialog open={acao !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-bold">{acao ? TITULO_POR_TIPO[acao.tipo] : ""}</DialogTitle>
        </DialogHeader>

        {acao?.tipo === "criar-objetivo" && (
          <ObjetivoForm
            modo={{ tipo: "criar", idPlanejamento }}
            onConcluido={() => {
              onFechar();
              onHierarquiaAlterada();
            }}
            onCancelar={onFechar}
          />
        )}
        {acao?.tipo === "editar-objetivo" && (
          <ObjetivoForm
            modo={{ tipo: "editar", objetivo: acao.objetivo }}
            onConcluido={() => {
              onFechar();
              onHierarquiaAlterada();
            }}
            onCancelar={onFechar}
          />
        )}
        {acao?.tipo === "criar-meta" && (
          <MetaForm
            modo={{ tipo: "criar", idObjetivo: acao.idObjetivo }}
            produtoNome={produtoNome}
            pessoasVinculadas={pessoasVinculadas}
            onConcluido={() => {
              onFechar();
              onHierarquiaAlterada();
            }}
            onCancelar={onFechar}
          />
        )}
        {acao?.tipo === "editar-meta" && (
          <MetaForm
            modo={{ tipo: "editar", meta: acao.meta }}
            produtoNome={produtoNome}
            pessoasVinculadas={pessoasVinculadas}
            onConcluido={() => {
              onFechar();
              onHierarquiaAlterada();
            }}
            onCancelar={onFechar}
          />
        )}
        {acao?.tipo === "criar-sucesso" && (
          <SucessoMensalForm
            modo={{ tipo: "criar", idMeta: acao.idMeta }}
            onConcluido={() => {
              onFechar();
              onGradeAlterada();
            }}
            onCancelar={onFechar}
          />
        )}
        {acao?.tipo === "editar-sucesso" && (
          <SucessoMensalForm
            modo={{ tipo: "editar", sucesso: acao.sucesso }}
            onConcluido={() => {
              onFechar();
              onGradeAlterada();
            }}
            onCancelar={onFechar}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
