"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// pll-cadastro-participantes T18 (design.md "Components" -- EditorAmbicaoPolitica;
// PLL-CP-21). Texto livre + até 3 marcadores (chips) associados.
//
// `readOnly` (PLL-CP-23, T19): Assessor vê o texto e os chips sem nenhum
// controle de edição.

const MAXIMO_TAGS = 3;

export interface EditorAmbicaoPoliticaProps {
  texto: string | null;
  tags: string[];
  onChangeTexto: (texto: string) => void;
  onChangeTags: (tags: string[]) => void;
  readOnly?: boolean;
}

export function EditorAmbicaoPolitica({
  texto,
  tags,
  onChangeTexto,
  onChangeTags,
  readOnly = false,
}: EditorAmbicaoPoliticaProps) {
  const [novaTag, setNovaTag] = useState("");
  const limiteAtingido = tags.length >= MAXIMO_TAGS;

  function adicionarTag() {
    const valor = novaTag.trim();
    if (!valor || limiteAtingido) return;
    onChangeTags([...tags, valor]);
    setNovaTag("");
  }

  function removerTag(indice: number) {
    onChangeTags(tags.filter((_, i) => i !== indice));
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm font-bold">Ambição Política</p>

      {readOnly ? (
        <p className="text-sm text-muted-foreground">{texto || "Nada registrado ainda."}</p>
      ) : (
        <Textarea
          value={texto ?? ""}
          onChange={(e) => onChangeTexto(e.target.value)}
          placeholder="Descreva a ambição política deste participante…"
          aria-label="Texto da Ambição Política"
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {tags.map((tag, indice) => (
          <Badge key={tag} variant="outline" className="gap-1">
            {tag}
            {!readOnly && (
              <button
                type="button"
                aria-label={`Remover marcador "${tag}"`}
                onClick={() => removerTag(indice)}
              >
                <X className="size-3" />
              </button>
            )}
          </Badge>
        ))}
        {tags.length === 0 && readOnly && <span className="text-sm text-muted-foreground">—</span>}
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2">
          <Input
            value={novaTag}
            onChange={(e) => setNovaTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionarTag();
              }
            }}
            placeholder={limiteAtingido ? "Máximo de 3 marcadores atingido" : "Adicionar marcador…"}
            aria-label="Novo marcador da Ambição Política"
            disabled={limiteAtingido}
          />
          <Button type="button" size="sm" onClick={adicionarTag} disabled={!novaTag.trim() || limiteAtingido}>
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
