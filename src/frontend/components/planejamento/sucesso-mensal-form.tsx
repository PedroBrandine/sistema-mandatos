"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type { SucessoMensalGrade } from "@backend/queries/planejamento";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { sucessoMensalSchema, type SucessoMensalInput } from "@backend/schemas/planejamento";
import { createClient } from "@backend/supabase/client";

import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// PLM-17/18. INSERT (novo mês) ou UPDATE (detalhes de um existente) direto
// em fat_sucesso_mensal, sem RPC -- 1 linha só (AD-024). Fora da grade (que
// só edita pct_atingimento, T14) -- aqui ficam peso/descrição/mês/prazo/
// status, os campos que a decisão de Pedro de 2026-08-12 já autorizou o
// Assessor a gravar mas nunca tiveram superfície de UI.
//
// status só aparece no modo "editar" -- um Sucesso Mensal novo sempre nasce
// 'pendente' (default do schema), não faz sentido pedir isso na criação.
// pct_atingimento fica de fora dos dois modos -- é campo da grade (T14), a
// AC de PLM-18 não o lista entre os campos deste form.
export type SucessoMensalFormModo = { tipo: "criar"; idMeta: number } | { tipo: "editar"; sucesso: SucessoMensalGrade };

export interface SucessoMensalFormProps {
  modo: SucessoMensalFormModo;
  onConcluido: () => void;
  onCancelar: () => void;
}

/** "YYYY-MM-DD"/"YYYY-MM-01" -> "YYYY-MM" pro <input type="month">. */
function paraInputMes(dataIso: string): string {
  return dataIso.slice(0, 7);
}

/** "YYYY-MM" do <input type="month"> -> "YYYY-MM-01" (ck_sucesso_mes: sempre dia 1). */
function paraMesReferencia(valorInputMes: string): string {
  return `${valorInputMes}-01`;
}

export function SucessoMensalForm({ modo, onConcluido, onCancelar }: SucessoMensalFormProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<SucessoMensalInput>({
    resolver: zodResolver(sucessoMensalSchema),
    mode: "onChange",
    defaultValues:
      modo.tipo === "criar"
        ? { id_meta: modo.idMeta, descricao: "", mes_referencia: "", peso: 100, status: "pendente" }
        : {
            id_sucesso: modo.sucesso.idSucesso,
            id_meta: modo.sucesso.idMeta,
            descricao: modo.sucesso.descricao,
            mes_referencia: modo.sucesso.mesReferencia,
            dt_limite: modo.sucesso.dtLimite,
            peso: modo.sucesso.peso,
            status: modo.sucesso.status,
          },
  });

  async function enviar(valores: SucessoMensalInput) {
    setEnviando(true);
    setErro(null);
    const supabase = createClient();

    const payload = {
      descricao: valores.descricao,
      mes_referencia: valores.mes_referencia,
      dt_limite: valores.dt_limite ?? null,
      peso: valores.peso,
      status: valores.status,
    };

    if (modo.tipo === "criar") {
      const { error } = await supabase.from("fat_sucesso_mensal").insert({ id_meta: modo.idMeta, ...payload });
      setEnviando(false);
      if (error) {
        setErro(mapeiaErroRpc(error).message);
        return;
      }
      onConcluido();
      return;
    }

    const { error } = await supabase.from("fat_sucesso_mensal").update(payload).eq("id_sucesso", modo.sucesso.idSucesso);
    setEnviando(false);
    if (error) {
      setErro(mapeiaErroRpc(error).message);
      return;
    }
    onConcluido();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(enviar)} className="grid gap-4 rounded-lg border p-4">
        <FormField
          control={form.control}
          name="descricao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição do Sucesso Mensal</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* PLM-17 AC1 / Edge Case do spec.md: seletor de mês, nunca campo de
            data livre -- ck_sucesso_mes exige sempre dia 1, <input
            type="month"> torna esse erro inatingível pela UI. */}
        <FormField
          control={form.control}
          name="mes_referencia"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mês de referência</FormLabel>
              <FormControl>
                <Input
                  type="month"
                  value={field.value ? paraInputMes(field.value) : ""}
                  onChange={(e) => field.onChange(e.target.value ? paraMesReferencia(e.target.value) : "")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="peso"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Peso (0–100)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dt_limite"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prazo (opcional)</FormLabel>
              <FormControl>
                <Input type="date" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {modo.tipo === "editar" && (
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="realizado">Realizado</SelectItem>
                    <SelectItem value="nao_realizado">Não realizado</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {erro && <ErroInline mensagem={erro} />}
        <div className="flex gap-2">
          <Button type="submit" disabled={enviando || !form.formState.isValid}>
            {enviando ? "Salvando..." : modo.tipo === "criar" ? "Criar Sucesso Mensal" : "Salvar alterações"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}
