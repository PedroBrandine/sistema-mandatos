"use client";

import { useState } from "react";

import { linhaCadastroPllSchema, type LinhaCadastroPll } from "@backend/schemas/cadastro-participante-pll";

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

// Sessão ao vivo com Pedro (22/09): botão "Cadastrar participante" na tela
// Participantes -- caminho alternativo ao upload de planilha (UploadPlanilhaCard)
// para UM registro. Reaproveita o MESMO schema Zod do Anexo A
// (linhaCadastroPllSchema) e o MESMO caminho de escrita (upsertCadastroParticipantes
// com um lote de 1 linha) -- nenhuma tabela/validação nova, só uma segunda
// porta de entrada pros mesmos 25 campos.
//
// Sempre papel: "mentorado" -- Mentor não é cadastrado por este caminho
// (mesma decisão de 22/09 que bloqueia 'mentor' em validarLinhasCadastroPll):
// mentor já existe como usuário do sistema, escolhido no pool padrão da
// edição (CriarEdicaoDialog), nunca como staging pré-TSE.
//
// Só expõe os campos mais usados na prática (nome/e-mail/telefone + dados do
// mandato autodeclarado); os demais 15 campos do Anexo A (pautas
// prioritárias, identidade, etc.) ficam null aqui -- AD-005, sem sentinela --
// e continuam editáveis depois via edição em lista/planilha. Cadastro manual
// completo dos 25 campos é escopo de formulário maior, fora desta sessão.

export interface CadastroManualDialogProps {
  onCriar: (linha: LinhaCadastroPll) => Promise<void>;
}

interface EstadoFormulario {
  nomeCompleto: string;
  email: string;
  telefone: string;
  corRaca: string;
  partidoFiliado: string;
  nomeParlamentar: string;
  partidoParlamentar: string;
  estadoEleicao: string;
}

const FORM_VAZIO: EstadoFormulario = {
  nomeCompleto: "",
  email: "",
  telefone: "",
  corRaca: "",
  partidoFiliado: "",
  nomeParlamentar: "",
  partidoParlamentar: "",
  estadoEleicao: "",
};

export function CadastroManualDialog({ onCriar }: CadastroManualDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EstadoFormulario>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function atualizar<K extends keyof EstadoFormulario>(campo: K, valor: EstadoFormulario[K]) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function submeter() {
    setErro(null);

    const bruto = {
      papel: "mentorado" as const,
      nome_completo: form.nomeCompleto.trim(),
      email: form.email.trim(),
      telefone: form.telefone.trim() || null,
      cor_raca: form.corRaca.trim() || null,
      partido_filiado: form.partidoFiliado.trim() || null,
      nome_parlamentar: form.nomeParlamentar.trim() || null,
      partido_parlamentar: form.partidoParlamentar.trim() || null,
      estado_eleicao: form.estadoEleicao.trim() || null,
    };

    const resultado = linhaCadastroPllSchema.safeParse(bruto);
    if (!resultado.success) {
      setErro(resultado.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    setSalvando(true);
    try {
      await onCriar(resultado.data);
      setForm(FORM_VAZIO);
      setOpen(false);
    } catch (erroCaptura) {
      setErro(erroCaptura instanceof Error ? erroCaptura.message : "Não foi possível cadastrar o participante.");
    } finally {
      setSalvando(false);
    }
  }

  const valido = form.nomeCompleto.trim().length > 0 && form.email.trim().length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(aberto) => {
        setOpen(aberto);
        if (!aberto) {
          setForm(FORM_VAZIO);
          setErro(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          Cadastrar participante
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar participante manualmente</DialogTitle>
          <DialogDescription>
            Alternativa à importação por planilha para um único mentorado (Anexo A) -- mentores já são usuários do
            sistema e não passam por aqui. Nome completo e e-mail são obrigatórios; os demais campos podem ser
            completados depois.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="manual-nome">Nome completo</Label>
            <Input id="manual-nome" value={form.nomeCompleto} onChange={(e) => atualizar("nomeCompleto", e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="manual-email">E-mail</Label>
            <Input id="manual-email" type="email" value={form.email} onChange={(e) => atualizar("email", e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="manual-telefone">Telefone (com DDD)</Label>
            <Input id="manual-telefone" value={form.telefone} onChange={(e) => atualizar("telefone", e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="manual-cor-raca">Cor/raça</Label>
            <Input id="manual-cor-raca" value={form.corRaca} onChange={(e) => atualizar("corRaca", e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="manual-partido-filiado">Partido filiado</Label>
            <Input
              id="manual-partido-filiado"
              value={form.partidoFiliado}
              onChange={(e) => atualizar("partidoFiliado", e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="manual-nome-parlamentar">Nome do Parlamentar</Label>
            <Input
              id="manual-nome-parlamentar"
              value={form.nomeParlamentar}
              onChange={(e) => atualizar("nomeParlamentar", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="manual-partido-parlamentar">Partido do parlamentar</Label>
              <Input
                id="manual-partido-parlamentar"
                value={form.partidoParlamentar}
                onChange={(e) => atualizar("partidoParlamentar", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="manual-estado-eleicao">Estado de eleição (UF)</Label>
              <Input
                id="manual-estado-eleicao"
                maxLength={2}
                value={form.estadoEleicao}
                onChange={(e) => atualizar("estadoEleicao", e.target.value.toUpperCase())}
              />
            </div>
          </div>
        </div>

        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" variant="vinho" onClick={submeter} disabled={!valido || salvando}>
            {salvando ? "Cadastrando..." : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
