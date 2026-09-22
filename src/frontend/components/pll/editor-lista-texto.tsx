"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Input } from "@/components/ui/input";

// pll-cadastro-participantes T17 (design.md "Components" -- EditorListaTexto;
// PLL-CP-20, PLL-CP-22). Lista editável genérica -- adicionar/editar/remover
// item de texto curto, usada em Desafios e Destaques (T19 monta as 2
// instâncias). Busca por um componente genérico equivalente no repo (design.md
// Risks) não achou nada: `multi-select-pesquisavel.tsx` é outra coisa (seleção
// dentre opções fechadas pré-existentes, não texto livre criado pelo
// usuário) -- este é novo, sem duplicar nada.
//
// `readOnly` (PLL-CP-23, T19): Assessor vê a lista sem nenhum controle de
// edição -- os botões de adicionar/editar/remover somem inteiros, o
// componente vira puramente leitura.

export interface EditorListaTextoProps {
  titulo: string;
  itens: string[];
  onChange: (itens: string[]) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export function EditorListaTexto({
  titulo,
  itens,
  onChange,
  placeholder = "Adicionar item…",
  readOnly = false,
}: EditorListaTextoProps) {
  const [novoItem, setNovoItem] = useState("");
  const [indiceEditando, setIndiceEditando] = useState<number | null>(null);
  const [valorEditando, setValorEditando] = useState("");

  function adicionar() {
    const valor = novoItem.trim();
    if (!valor) return;
    onChange([...itens, valor]);
    setNovoItem("");
  }

  function remover(indice: number) {
    onChange(itens.filter((_, i) => i !== indice));
  }

  function iniciarEdicao(indice: number) {
    setIndiceEditando(indice);
    setValorEditando(itens[indice]);
  }

  function salvarEdicao() {
    if (indiceEditando === null) return;
    const valor = valorEditando.trim();
    if (!valor) {
      remover(indiceEditando);
    } else {
      onChange(itens.map((item, i) => (i === indiceEditando ? valor : item)));
    }
    setIndiceEditando(null);
    setValorEditando("");
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm font-bold">{titulo}</p>

      {itens.length === 0 ? (
        <EstadoVazio
          titulo="Nada registrado ainda"
          mensagem={readOnly ? undefined : `Use o campo abaixo para adicionar o primeiro item de "${titulo}".`}
        />
      ) : (
        <ul className="grid gap-2">
          {itens.map((item, indice) => (
            <li
              key={indice}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
            >
              {indiceEditando === indice ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    value={valorEditando}
                    onChange={(e) => setValorEditando(e.target.value)}
                    aria-label={`Editar item ${indice + 1} de ${titulo}`}
                    autoFocus
                  />
                  <Button type="button" size="sm" onClick={salvarEdicao}>
                    Salvar
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Cancelar edição"
                    onClick={() => setIndiceEditando(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <span>{item}</span>
                  {!readOnly && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Editar "${item}"`}
                        onClick={() => iniciarEdicao(indice)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Remover "${item}"`}
                        onClick={() => remover(indice)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="flex items-center gap-2">
          <Input
            value={novoItem}
            onChange={(e) => setNovoItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionar();
              }
            }}
            placeholder={placeholder}
            aria-label={`Novo item de ${titulo}`}
          />
          <Button type="button" size="sm" onClick={adicionar} disabled={!novoItem.trim()}>
            <Plus className="size-3.5" />
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
