"use client";

import { useCallback, useRef, useState } from "react";

// PLR-18, D-D (.specs/features/planejamento-estrategico-redesenho/context.md).
// Pilha de undo client-side (sessão do navegador, não persistida) -- cada
// escrita bem-sucedida (célula única, faixa colada, edição em massa) empilha
// 1 entrada por Sucesso Mensal escrito. `Ctrl+Z` reescreve pelo MESMO caminho
// de escrita já validado (`onColarFaixa`, a RPC de lote) -- nunca mexe em
// `log_auditoria` diretamente. A reversão gera uma NOVA linha de auditoria
// (o trigger já conectado cuida disso sozinho), preservando o histórico
// completo (AD-006, append-only) -- "revertendo também o registro de
// auditoria correspondente" do pedido original é satisfeito por uma escrita
// nova, nunca por apagar/editar a antiga.
//
// // TODO(D-D): mecanismo aceito como default, não confirmado por Pedro --
// ver context.md "Pontos sem decisão síncrona".
//
// Não restaura valores que eram NULL antes da edição (limpar célula) -- o
// caminho de escrita em lote (`onColarFaixa`/`app.atualiza_sucessos_mensais_lote`)
// não aceita NULL, mesma limitação já existente em `handleEdicaoCelula`
// (débito pré-existente, não introduzido por esta task).
export interface EntradaUndo {
  idSucesso: number;
  valorAnterior: number | null;
}

export function useUndoPlanejamento(aoRestaurar: (valores: { idSucesso: number; pctAtingimento: number }[]) => Promise<void>) {
  const pilhaRef = useRef<EntradaUndo[][]>([]);
  const [temHistorico, setTemHistorico] = useState(false);

  const empilhar = useCallback((entradas: EntradaUndo[]) => {
    if (entradas.length === 0) return;
    pilhaRef.current.push(entradas);
    setTemHistorico(true);
  }, []);

  const desfazer = useCallback(async () => {
    const ultimo = pilhaRef.current.pop();
    setTemHistorico(pilhaRef.current.length > 0);
    if (!ultimo || ultimo.length === 0) return;

    const restauraveis = ultimo.filter((e): e is EntradaUndo & { valorAnterior: number } => e.valorAnterior !== null);
    if (restauraveis.length === 0) return;

    await aoRestaurar(restauraveis.map((e) => ({ idSucesso: e.idSucesso, pctAtingimento: e.valorAnterior })));
  }, [aoRestaurar]);

  return { empilhar, desfazer, temHistorico };
}
