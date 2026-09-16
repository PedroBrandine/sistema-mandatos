"use client";

import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";

import type { CampoDinamico } from "@/lib/camada-dinamica";

import { EmDesenvolvimento } from "@/components/app-shell/em-desenvolvimento";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, FMC-16 (P1
// Registro AC4/AC5/AC8), FMC-17 (AC6/AC7), FMC-20 (AC12), FMC-22 (Out of
// Scope -- bloco de fotos, "em desenvolvimento"). design.md, Components
// "CamadaDinamica" + "Contrato de ref_tipo_registro.schema_campos".
//
// Renderer genérico dos campos que `parseSchemaCampos` (T14) já validou e
// tipou -- este componente nunca lê o JSONB cru nem decide o que é
// desconhecido; a lista `campos` chega já filtrada (campo de tipo
// desconhecido nunca aparece aqui, edge case da spec.md). Cada tipo grava
// num "compartimento" fixo do formulário pai (RegistroForm, T31):
//  - texto_curto / texto_longo -> conteudo.<chave>          (fat_registro.conteudo)
//  - link                      -> artefatos.<chave>.url/.descricao (fat_artefato)
//  - leitura_encontro          -> não registra campo nenhum; só lê `encontro`
//  - arquivo                   -> não registra campo nenhum; placeholder FMC-22
export interface CamadaDinamicaProps<TFieldValues extends FieldValues = FieldValues> {
  campos: CampoDinamico[];
  /**
   * Dados de fat_encontro, achatados por chave `origem` (ex.: `{ local: "Gabinete 312" }`).
   * `null` = registro sem encontro (A-08) -- campos `leitura_encontro` somem inteiros.
   */
  encontro: Record<string, string | null> | null;
  control: Control<TFieldValues>;
}

export function CamadaDinamica<TFieldValues extends FieldValues = FieldValues>({
  campos,
  encontro,
  control,
}: CamadaDinamicaProps<TFieldValues>) {
  if (campos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum campo extra necessário para este Tipo de Registro
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {campos.map((campo) => {
        switch (campo.tipo) {
          case "texto_curto":
            return (
              <div key={campo.chave} className="grid gap-1.5">
                <Label htmlFor={`campo-dinamico-${campo.chave}`}>{campo.rotulo}</Label>
                <Controller
                  control={control}
                  name={`conteudo.${campo.chave}` as Path<TFieldValues>}
                  render={({ field }) => (
                    <Input
                      id={`campo-dinamico-${campo.chave}`}
                      {...field}
                      value={(field.value as string | undefined) ?? ""}
                    />
                  )}
                />
              </div>
            );

          case "texto_longo":
            return (
              <div key={campo.chave} className="grid gap-1.5">
                <Label htmlFor={`campo-dinamico-${campo.chave}`}>{campo.rotulo}</Label>
                <Controller
                  control={control}
                  name={`conteudo.${campo.chave}` as Path<TFieldValues>}
                  render={({ field }) => (
                    <Textarea
                      id={`campo-dinamico-${campo.chave}`}
                      {...field}
                      value={(field.value as string | undefined) ?? ""}
                    />
                  )}
                />
              </div>
            );

          case "link":
            return (
              <div key={campo.chave} className="grid gap-1.5">
                <Label htmlFor={`campo-dinamico-${campo.chave}-url`}>{campo.rotulo}</Label>
                <Controller
                  control={control}
                  name={`artefatos.${campo.chave}.url` as Path<TFieldValues>}
                  render={({ field }) => (
                    <Input
                      id={`campo-dinamico-${campo.chave}-url`}
                      placeholder="https://"
                      {...field}
                      value={(field.value as string | undefined) ?? ""}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`artefatos.${campo.chave}.descricao` as Path<TFieldValues>}
                  render={({ field }) => (
                    <Input
                      aria-label={`Descrição de ${campo.rotulo}`}
                      placeholder="Descrição (opcional)"
                      {...field}
                      value={(field.value as string | undefined) ?? ""}
                    />
                  )}
                />
              </div>
            );

          case "leitura_encontro": {
            // A-08/AC4 (FMC-20): sem encontro, o campo inteiro some -- não
            // vira input vazio nem "—" solto.
            if (!encontro) return null;
            const valor = campo.origem ? encontro[campo.origem] : null;
            return (
              <div key={campo.chave} className="grid gap-1">
                <p className="text-xs font-medium text-muted-foreground">{campo.rotulo}</p>
                <p className="text-sm text-foreground">{valor && valor.trim() !== "" ? valor : "—"}</p>
              </div>
            );
          }

          case "arquivo":
            // FMC-22: upload de fotos é Out of Scope desta feature -- bloco
            // padronizado, sem nenhum controle de arquivo.
            return (
              <div key={campo.chave}>
                <EmDesenvolvimento titulo={`${campo.rotulo} (em desenvolvimento)`} />
              </div>
            );

          default:
            // Defensivo: parseSchemaCampos (T14) já descarta tipo
            // desconhecido antes de chegar aqui -- este ramo nunca deveria
            // executar, mas não quebra o formulário se acontecer.
            return null;
        }
      })}
    </div>
  );
}
