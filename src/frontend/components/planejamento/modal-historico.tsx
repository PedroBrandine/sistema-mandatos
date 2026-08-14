"use client";

import { useEffect, useState } from "react";

import { buscarHistoricoAuditoria, type HistoricoAuditoria } from "@backend/queries/planejamento";
import { createClient } from "@backend/supabase/client";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// PLR-13, PLR-14 (.specs/features/planejamento-estrategico-redesenho, T18).
// Histórico de auditoria (log_auditoria, já conectado às 5 tabelas de
// Planejamento desde planejamento-planilha-monitoramento) por item -- quem,
// quando, de -> para. Gated por permissoes.veAuditoria no chamador (T19);
// este componente não decide visibilidade de novo.
//
// ATENÇÃO -- achado real de T3 (ver tasks.md): log_auditoria tem RLS
// `p_log_admin` restringindo leitura só a papel_atual()='admin'. Mesmo com
// PERMISSOES.gestora.veAuditoria=true, uma Gestora abrindo este modal
// recebe lista vazia (RLS filtra silenciosamente, não lança erro) -- não é
// bug deste componente, é comportamento pré-existente do banco que esta
// feature não deveria resolver sozinha (mudar RLS de segurança sem
// confirmação explícita, mesmo precedente da AD-035). Sinalizado a Pedro.
export interface ModalHistoricoProps {
  tabela: string;
  idRegistro: number;
  titulo: string;
  aberto: boolean;
  onFechar: () => void;
}

const LABEL_ACAO: Record<HistoricoAuditoria["acao"], string> = {
  insert: "Criado",
  update: "Editado",
  delete: "Removido",
};

function formatarQuando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Campos que mudaram entre 2 snapshots (JSONB da linha inteira) -- diff simples por chave. */
function camposAlterados(
  anterior: Record<string, unknown> | null,
  novo: Record<string, unknown> | null
): { campo: string; de: unknown; para: unknown }[] {
  const chaves = new Set([...Object.keys(anterior ?? {}), ...Object.keys(novo ?? {})]);
  const resultado: { campo: string; de: unknown; para: unknown }[] = [];
  for (const chave of chaves) {
    const de = anterior?.[chave] ?? null;
    const para = novo?.[chave] ?? null;
    if (JSON.stringify(de) !== JSON.stringify(para)) {
      resultado.push({ campo: chave, de, para });
    }
  }
  return resultado;
}

function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined) return "—";
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

export function ModalHistorico({ tabela, idRegistro, titulo, aberto, onFechar }: ModalHistoricoProps) {
  const [historico, setHistorico] = useState<HistoricoAuditoria[] | null>(null);

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    const supabase = createClient();
    buscarHistoricoAuditoria(supabase, tabela, idRegistro).then((linhas) => {
      if (!cancelado) setHistorico(linhas);
    });
    return () => {
      cancelado = true;
      // Zera ao fechar/trocar de item -- evita mostrar o histórico do item
      // anterior por 1 frame antes do novo fetch resolver.
      setHistorico(null);
    };
  }, [aberto, tabela, idRegistro]);

  return (
    <Dialog open={aberto} onOpenChange={(valor) => !valor && onFechar()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-bold">Histórico — {titulo}</DialogTitle>
        </DialogHeader>

        {historico === null && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {historico !== null && historico.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
        )}
        {historico !== null && historico.length > 0 && (
          <div className="grid max-h-96 gap-3 overflow-y-auto">
            {historico.map((linha) => {
              const mudancas = camposAlterados(linha.valorAnterior, linha.valorNovo);
              return (
                <div key={linha.idLog} className="grid gap-1.5 rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{LABEL_ACAO[linha.acao]}</Badge>
                    <span className="font-medium">{linha.quem}</span>
                    <span className="text-xs text-muted-foreground">{formatarQuando(linha.quando)}</span>
                  </div>
                  {mudancas.length > 0 && (
                    <ul className="grid gap-0.5 text-xs text-muted-foreground">
                      {mudancas.map(({ campo, de, para }) => (
                        <li key={campo}>
                          <span className="font-medium text-foreground">{campo}</span>: {formatarValor(de)} → {formatarValor(para)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
