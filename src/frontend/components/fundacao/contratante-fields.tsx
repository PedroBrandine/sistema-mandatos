"use client";

import type { Control, FieldValues, Path } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

// Campos comuns de dim_contratante (nome, UF, município) -- validados pelo
// contratanteSchema (src/backend/schemas/contratante.ts, T26) no formulário
// pai. Reusado sem duplicação por MandatoWizard (T32) e CoalizaoForm (T35):
// ambos aninham um objeto `contratante` com este shape na própria árvore de
// campos do react-hook-form (mesmo supertipo criado por app.criar_mandato /
// app.criar_coalizao). Não possui `<form>` próprio -- só sub-campos
// controlados via `control` recebido do formulário pai (design.md).
export interface ContratanteFormValues extends FieldValues {
  contratante: {
    nome: string;
    sg_uf?: string | null;
    nm_municipio?: string | null;
  };
}

export interface ContratanteFieldsProps<T extends ContratanteFormValues> {
  control: Control<T>;
}

export function ContratanteFields<T extends ContratanteFormValues>({
  control,
}: ContratanteFieldsProps<T>) {
  return (
    <div className="grid gap-4">
      <FormField
        control={control}
        name={"contratante.nome" as Path<T>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome</FormLabel>
            <FormControl>
              <Input placeholder="Nome do contratante" {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name={"contratante.sg_uf" as Path<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>UF</FormLabel>
              <FormControl>
                <Input placeholder="SP" maxLength={2} {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={"contratante.nm_municipio" as Path<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Município</FormLabel>
              <FormControl>
                <Input placeholder="Município" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
