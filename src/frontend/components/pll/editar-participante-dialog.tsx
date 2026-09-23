"use client";

import { useState } from "react";

import type { LinhaCadastroParticipanteParaEdicao } from "@backend/queries/pll-cadastro";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";

// Pedro, 23/09: "não tem crud no lançamento da tabela" -- até aqui, corrigir
// um campo do Anexo A já importado (ex.: nome do parlamentar digitado errado,
// que impede o match com o TSE) só era possível reimportando a planilha
// inteira. Mesmo recorte de campos do CadastroManualDialog (T13) + os 4
// campos do mandato que ajudam a comparar com o TSE (cor/raça, cargos e
// mandatos anteriores, rede social) -- os outros campos do Anexo A (pautas
// prioritárias, identidade de gênero etc.) continuam só por reimportação,
// mesma decisão de escopo do cadastro manual. Exclusão de linha fica fora
// (spec.md, "Out of Scope": "fica para quando houver caso de uso real").
//
// A leitura do registro (useQuery) fica no PAI (page.tsx, mesmo padrão de
// buscarCadastroParticipantesPll/buscarMetricasCadastroPll) -- este componente
// é só presentational, controlado por `linha`/`carregando`/`erroCarregar`.
// O formulário (FormularioEdicaoParticipante) só monta quando `linha` já
// chegou, com `key={linha.email}` pra dar "estado derivado de prop, resetado
// por key" (padrão recomendado pelo React) em vez de sincronizar via
// useEffect + setState.

export interface EditarParticipanteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nomeCompleto: string;
  linha: LinhaCadastroParticipanteParaEdicao | undefined;
  carregando: boolean;
  erroCarregar: boolean;
  onSalvar: (linha: LinhaCadastroParticipanteParaEdicao) => Promise<void>;
}

function FormularioEdicaoParticipante({
  linhaInicial,
  onSalvar,
  onFechar,
}: {
  linhaInicial: LinhaCadastroParticipanteParaEdicao;
  onSalvar: (linha: LinhaCadastroParticipanteParaEdicao) => Promise<void>;
  onFechar: () => void;
}) {
  const [form, setForm] = useState(linhaInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function atualizar<K extends keyof LinhaCadastroParticipanteParaEdicao>(
    campo: K,
    valor: LinhaCadastroParticipanteParaEdicao[K]
  ) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function submeter() {
    setErro(null);
    setSalvando(true);
    try {
      await onSalvar(form);
      onFechar();
    } catch (erroCaptura) {
      setErro(erroCaptura instanceof Error ? erroCaptura.message : "Não foi possível salvar as alterações.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div className="grid gap-4 py-2">
        <div className="grid gap-1.5">
          <Label htmlFor="editar-nome">Nome completo</Label>
          <Input id="editar-nome" value={form.nomeCompleto} onChange={(e) => atualizar("nomeCompleto", e.target.value)} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="editar-email">E-mail</Label>
          <Input id="editar-email" type="email" value={form.email} onChange={(e) => atualizar("email", e.target.value)} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="editar-telefone">Telefone (com DDD)</Label>
          <Input
            id="editar-telefone"
            value={form.telefone ?? ""}
            onChange={(e) => atualizar("telefone", e.target.value || null)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="editar-cor-raca">Cor/raça</Label>
            <Input
              id="editar-cor-raca"
              value={form.corRaca ?? ""}
              onChange={(e) => atualizar("corRaca", e.target.value || null)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="editar-partido-filiado">Partido filiado</Label>
            <Input
              id="editar-partido-filiado"
              value={form.partidoFiliado ?? ""}
              onChange={(e) => atualizar("partidoFiliado", e.target.value || null)}
            />
          </div>
        </div>

        <p className="text-xs font-bold uppercase text-muted-foreground">
          Dados do mandato (usados para comparar com o TSE)
        </p>

        <div className="grid gap-1.5">
          <Label htmlFor="editar-nome-parlamentar">Nome do Parlamentar</Label>
          <Input
            id="editar-nome-parlamentar"
            value={form.nomeParlamentar ?? ""}
            onChange={(e) => atualizar("nomeParlamentar", e.target.value || null)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="editar-partido-parlamentar">Partido do parlamentar</Label>
            <Input
              id="editar-partido-parlamentar"
              value={form.partidoParlamentar ?? ""}
              onChange={(e) => atualizar("partidoParlamentar", e.target.value || null)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="editar-estado-eleicao">Estado de eleição (UF)</Label>
            <Input
              id="editar-estado-eleicao"
              maxLength={2}
              value={form.estadoEleicao ?? ""}
              onChange={(e) => atualizar("estadoEleicao", e.target.value.toUpperCase() || null)}
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="editar-cor-raca-parlamentar">Cor/raça do parlamentar</Label>
          <Input
            id="editar-cor-raca-parlamentar"
            value={form.corRacaParlamentar ?? ""}
            onChange={(e) => atualizar("corRacaParlamentar", e.target.value || null)}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="editar-cargos-anteriores">Cargos anteriores</Label>
          <Input
            id="editar-cargos-anteriores"
            value={form.cargosAnteriores ?? ""}
            onChange={(e) => atualizar("cargosAnteriores", e.target.value || null)}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="editar-mandatos-anteriores">Mandatos anteriores</Label>
          <Input
            id="editar-mandatos-anteriores"
            value={form.mandatosAnteriores ?? ""}
            onChange={(e) => atualizar("mandatosAnteriores", e.target.value || null)}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="editar-rede-social">Instagram/rede social</Label>
          <Input
            id="editar-rede-social"
            value={form.redeSocial ?? ""}
            onChange={(e) => atualizar("redeSocial", e.target.value || null)}
          />
        </div>
      </div>

      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="button" variant="vinho" onClick={() => void submeter()} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function EditarParticipanteDialog({
  open,
  onOpenChange,
  nomeCompleto,
  linha,
  carregando,
  erroCarregar,
  onSalvar,
}: EditarParticipanteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {nomeCompleto}</DialogTitle>
          <DialogDescription>
            Corrige os campos autodeclarados do Anexo A já importados. Uma nova importação da planilha (mesmo
            e-mail) continua atualizando estes campos normalmente.
          </DialogDescription>
        </DialogHeader>

        {erroCarregar ? (
          <ErroInline mensagem="Não foi possível carregar os dados deste participante." />
        ) : carregando || !linha ? (
          <CarregandoSkeleton variante="cards" />
        ) : (
          <FormularioEdicaoParticipante
            key={linha.email}
            linhaInicial={linha}
            onSalvar={onSalvar}
            onFechar={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
