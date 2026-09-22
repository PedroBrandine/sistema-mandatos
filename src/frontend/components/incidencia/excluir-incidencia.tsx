"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  excluirIncidencia,
  resumoExclusaoIncidencia,
  type ResumoExclusaoIncidencia,
  type TipoItemIncidencia,
} from "@backend/rpc/exclusao";
import { createClient } from "@backend/supabase/client";

import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
import { usePapelGlobal } from "@/hooks/use-papel-global";
import { linhasExclusaoIncidencia } from "@/lib/exclusao-rotulos";

// Exclusão DEFINITIVA de um item da Incidência (Registro, Pré-Insight, Insight
// ou Fato Gerador), dentro do diálogo de edição do próprio item -- pedido de
// Pedro, 2026-09-21. Só admin/gestora veem o botão; o banco recusa os demais
// (42501), então esconder aqui é conforto, não segurança.
//
// Antes de apagar, mostra o efeito colateral que o banco calculou: apagar uma
// origem NÃO apaga os fatos que nasceram dela (ficam sem origem, estado
// válido), e a tela diz quantos.
const ROTULO: Record<TipoItemIncidencia, { nome: string; artigo: string }> = {
  registro: { nome: "registro", artigo: "este" },
  insight: { nome: "insight", artigo: "este" },
  pre_insight: { nome: "pré-insight", artigo: "este" },
  fato_gerador: { nome: "fato gerador", artigo: "este" },
};

export interface ExcluirIncidenciaProps {
  tipo: TipoItemIncidencia;
  id: number;
  // Chamado depois que o banco confirmou -- quem chama fecha o diálogo e
  // recarrega a aba.
  onExcluido: () => void;
}

export function ExcluirIncidencia({ tipo, id, onExcluido }: ExcluirIncidenciaProps) {
  const { papel } = usePapelGlobal();
  const [aberto, setAberto] = useState(false);
  const [resumo, setResumo] = useState<ResumoExclusaoIncidencia | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (papel !== "admin" && papel !== "gestora") return null;

  const rotulo = ROTULO[tipo];

  async function abrirConfirmacao() {
    setAberto(true);
    setErro(null);
    setCarregando(true);
    try {
      setResumo(await resumoExclusaoIncidencia(createClient(), tipo, id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível levantar o efeito da exclusão.");
    } finally {
      setCarregando(false);
    }
  }

  async function confirmar() {
    setExcluindo(true);
    setErro(null);
    try {
      await excluirIncidencia(createClient(), tipo, id);
      toast.success(`${rotulo.nome[0].toUpperCase()}${rotulo.nome.slice(1)} excluído.`);
      onExcluido();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir.");
      setExcluindo(false);
    }
  }

  if (!aberto) {
    return (
      <div className="border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => void abrirConfirmacao()}
        >
          <Trash2 className="size-4" />
          Excluir {rotulo.nome}
        </Button>
      </div>
    );
  }

  const efeitos = resumo ? linhasExclusaoIncidencia(resumo) : [];

  return (
    <div className="grid gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p className="flex items-center gap-2 font-bold text-destructive">
        <AlertTriangle className="size-4" />
        Excluir {rotulo.artigo} {rotulo.nome} do banco?
      </p>
      <p className="text-muted-foreground">Esta ação é permanente e não poderá ser desfeita.</p>

      {carregando && (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Verificando o que muda…
        </p>
      )}

      {resumo && efeitos.length > 0 && (
        <ul className="list-disc pl-5 text-muted-foreground">
          {efeitos.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {erro && <ErroInline titulo="Não foi possível excluir" mensagem={erro} />}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setAberto(false)} disabled={excluindo}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="gap-2"
          disabled={!resumo || excluindo}
          onClick={() => void confirmar()}
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
      </div>
    </div>
  );
}
