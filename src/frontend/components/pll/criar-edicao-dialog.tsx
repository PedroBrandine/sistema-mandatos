"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelectPesquisavel, opcoesDeIdNome } from "@/components/ui/multi-select-pesquisavel";

// Sessão ao vivo com Pedro (22/09): botão "Criar edição" na tela
// Participantes do PLL -- nome, data de início, projeto/temática de origem
// (ref_projeto) e o pool de mentores padrão (rel_edicao_mentor), aplicado a
// cada contrato criado sob a edição no momento do vínculo TSE
// (vincularParticipanteAoTse -> app.criar_mandato p_mentores_padrao).
//
// AD-042 (tela de escrita, os dois lados de todo condicional): nome/data/
// projeto são obrigatórios (submit desabilitado sem os três); mentores são
// opcionais (pool vazio é caso válido -- edição sem mentor padrão definido
// ainda).

export interface CriarEdicaoDialogProps {
  projetos: { id: number; nome: string }[];
  mentores: { id: number; nome: string }[];
  onCriar: (input: { nome: string; dtInicio: string; idProjeto: number; idsMentores: number[] }) => Promise<void>;
}

export function CriarEdicaoDialog({ projetos, mentores, onCriar }: CriarEdicaoDialogProps) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [dtInicio, setDtInicio] = useState("");
  const [idProjeto, setIdProjeto] = useState<number | undefined>(undefined);
  const [idsMentores, setIdsMentores] = useState<number[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const valido = nome.trim().length > 0 && dtInicio.length > 0 && idProjeto !== undefined;

  function limpar() {
    setNome("");
    setDtInicio("");
    setIdProjeto(undefined);
    setIdsMentores([]);
    setErro(null);
  }

  async function submeter() {
    if (!valido || idProjeto === undefined) return;
    setSalvando(true);
    setErro(null);
    try {
      await onCriar({ nome: nome.trim(), dtInicio, idProjeto, idsMentores });
      limpar();
      setOpen(false);
    } catch (erroCaptura) {
      setErro(erroCaptura instanceof Error ? erroCaptura.message : "Não foi possível criar a edição.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(aberto) => {
        setOpen(aberto);
        if (!aberto) limpar();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="vinho">
          Criar edição
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar edição</DialogTitle>
          <DialogDescription>
            Uma edição organiza uma turma do PLL: nome, período, projeto/temática de origem e o pool de mentores
            padrão aplicado a cada participante vinculado ao TSE.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="edicao-nome">Nome da edição</Label>
            <Input
              id="edicao-nome"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Ex.: PLL 2026.1"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="edicao-data">Data de início</Label>
            <Input
              id="edicao-data"
              type="date"
              value={dtInicio}
              onChange={(event) => setDtInicio(event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="edicao-projeto">Projeto/temática</Label>
            <Select
              value={idProjeto !== undefined ? String(idProjeto) : undefined}
              onValueChange={(v) => setIdProjeto(Number(v))}
            >
              <SelectTrigger id="edicao-projeto" aria-label="Projeto/temática">
                <SelectValue placeholder="Selecione o projeto" />
              </SelectTrigger>
              <SelectContent>
                {projetos.map((projeto) => (
                  <SelectItem key={projeto.id} value={String(projeto.id)}>
                    {projeto.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Mentores padrão</Label>
            <MultiSelectPesquisavel
              opcoes={opcoesDeIdNome(mentores)}
              valores={idsMentores}
              onChange={setIdsMentores}
              placeholder="Nenhum mentor padrão"
              rotulo="Mentores padrão"
              rotuloPlural="mentores"
              placeholderBusca="Buscar mentor..."
            />
          </div>
        </div>

        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" variant="vinho" onClick={submeter} disabled={!valido || salvando}>
            {salvando ? "Criando..." : "Criar edição"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
