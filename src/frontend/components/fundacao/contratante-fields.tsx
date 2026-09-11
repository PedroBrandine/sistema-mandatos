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

export interface ContratanteFieldsProps<T extends FieldValues = FieldValues> {
  control: Control<T>;
  // EST-10 AC3: nome, UF e município vêm do TSE quando uma candidatura foi
  // vinculada, e nesse caso não podem ser editados. Opcional e `false` por
  // padrão para não mudar os outros usos (mandatos/[id]/page.tsx, edição
  // manual da ficha).
  somenteLeitura?: boolean;
}

// `readOnly` em vez de `disabled`: campo desabilitado sai da ordem de
// tabulação e é lido como indisponível por leitor de tela, quando o que
// queremos comunicar é "preenchido pela fonte oficial". readOnly mantém o
// valor focalizável e copiável.
const CLASSE_SOMENTE_LEITURA = "bg-muted/50 cursor-default focus-visible:ring-0";

export function ContratanteFields<T extends FieldValues = FieldValues>({
  control,
  somenteLeitura = false,
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
              <Input
                placeholder="Nome do contratante"
                {...field}
                value={field.value ?? ""}
                readOnly={somenteLeitura}
                className={somenteLeitura ? CLASSE_SOMENTE_LEITURA : undefined}
              />
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
                <Input
                  placeholder="SP"
                  maxLength={2}
                  {...field}
                  value={field.value ?? ""}
                  readOnly={somenteLeitura}
                  className={somenteLeitura ? CLASSE_SOMENTE_LEITURA : undefined}
                />
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
                <Input
                  placeholder="Município"
                  {...field}
                  value={field.value ?? ""}
                  readOnly={somenteLeitura}
                  className={somenteLeitura ? CLASSE_SOMENTE_LEITURA : undefined}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
