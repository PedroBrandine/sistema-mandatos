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

export interface ContratanteFormValues extends FieldValues {
  contratante?: {
    nome: string;
    sg_uf?: string | null;
    nm_municipio?: string | null;
  };
}

export interface ContratanteFieldsProps<T extends FieldValues = any> {
  control: Control<T>;
}

export function ContratanteFields<T extends FieldValues = any>({
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
