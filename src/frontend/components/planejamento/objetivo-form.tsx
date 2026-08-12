"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import type { ObjetivoComMetas } from "@backend/queries/planejamento";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { objetivoEspecificoSchema, type ObjetivoEspecificoInput } from "@backend/schemas/planejamento";
import { createClient } from "@backend/supabase/client";

import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface RefOption {
  id: number;
  nome: string;
}

// PLM-10/PLM-12. INSERT ou UPDATE direto (fat_objetivo_especifico), sem RPC
// -- 1 linha só, sem invariante multi-tabela (AD-024), mesmo padrão de
// ContratoForm (modo "abrir"/"encerrar" -> aqui "criar"/"editar").
// Renderização inline condicional na página, sem <Dialog> -- não há
// precedente de dialog de criação neste repo (só ConfirmDeleteDialog); os
// formulários existentes (ContratoForm, CoalizaoForm) já seguem esse padrão.
//
// oportunidade/ameaca (SWOT): "Usa" nos 3 produtos, sem diferença
// documentada (spec.md, quadro de campos por produto) -- sempre visíveis,
// sem condicional de produto.
export type ObjetivoFormModo = { tipo: "criar"; idPlanejamento: number } | { tipo: "editar"; objetivo: ObjetivoComMetas };

export interface ObjetivoFormProps {
  modo: ObjetivoFormModo;
  onConcluido: (criado?: { idObjetivo: number }) => void;
  onCancelar: () => void;
}

export function ObjetivoForm({ modo, onConcluido, onCancelar }: ObjetivoFormProps) {
  const [preditores, setPreditores] = useState<RefOption[]>([]);
  const [agendas, setAgendas] = useState<RefOption[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<ObjetivoEspecificoInput>({
    resolver: zodResolver(objetivoEspecificoSchema),
    mode: "onChange",
    defaultValues:
      modo.tipo === "criar"
        ? { id_planejamento: modo.idPlanejamento, descricao: "" }
        : {
            id_objetivo: modo.objetivo.idObjetivo,
            id_planejamento: modo.objetivo.idPlanejamento,
            descricao: modo.objetivo.descricao,
            id_preditor_primario: modo.objetivo.idPreditorPrimario,
            id_preditor_secundario: modo.objetivo.idPreditorSecundario,
            id_agenda: modo.objetivo.idAgenda,
            oportunidade: modo.objetivo.oportunidade,
            ameaca: modo.objetivo.ameaca,
          },
  });

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("ref_preditor")
      .select("id_preditor, nome")
      .eq("ativo", true)
      .then(({ data }) => setPreditores((data ?? []).map((p) => ({ id: p.id_preditor, nome: p.nome }))));
    supabase
      .from("ref_agenda_tematica")
      .select("id_agenda, nome")
      .eq("ativo", true)
      .then(({ data }) => setAgendas((data ?? []).map((a) => ({ id: a.id_agenda, nome: a.nome }))));
  }, []);

  async function enviar(valores: ObjetivoEspecificoInput) {
    setEnviando(true);
    setErro(null);
    const supabase = createClient();

    const payload = {
      descricao: valores.descricao,
      id_preditor_primario: valores.id_preditor_primario ?? null,
      id_preditor_secundario: valores.id_preditor_secundario ?? null,
      id_agenda: valores.id_agenda ?? null,
      oportunidade: valores.oportunidade ?? null,
      ameaca: valores.ameaca ?? null,
    };

    if (modo.tipo === "criar") {
      const { data, error } = await supabase
        .from("fat_objetivo_especifico")
        .insert({ id_planejamento: modo.idPlanejamento, ...payload })
        .select("id_objetivo")
        .single();
      setEnviando(false);
      if (error) {
        setErro(mapeiaErroRpc(error).message);
        return;
      }
      onConcluido(data ? { idObjetivo: data.id_objetivo } : undefined);
      return;
    }

    const { error } = await supabase.from("fat_objetivo_especifico").update(payload).eq("id_objetivo", modo.objetivo.idObjetivo);
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
              <FormLabel>Descrição do Objetivo</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="id_preditor_primario"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preditor primário (opcional)</FormLabel>
              <Select
                value={field.value ? String(field.value) : undefined}
                onValueChange={(v) => field.onChange(Number(v))}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {preditores.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="id_preditor_secundario"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preditor secundário (opcional)</FormLabel>
              <Select
                value={field.value ? String(field.value) : undefined}
                onValueChange={(v) => field.onChange(Number(v))}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {preditores.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="id_agenda"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Agenda temática (opcional)</FormLabel>
              <Select
                value={field.value ? String(field.value) : undefined}
                onValueChange={(v) => field.onChange(Number(v))}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {agendas.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="oportunidade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Oportunidade (SWOT, opcional)</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} rows={2} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ameaca"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ameaça (SWOT, opcional)</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} rows={2} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {erro && <ErroInline mensagem={erro} />}
        <div className="flex gap-2">
          <Button type="submit" disabled={enviando || !form.formState.isValid}>
            {enviando ? "Salvando..." : modo.tipo === "criar" ? "Criar Objetivo" : "Salvar alterações"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}
