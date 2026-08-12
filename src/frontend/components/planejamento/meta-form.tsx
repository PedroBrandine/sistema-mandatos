"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { mapeiaErroRpc } from "@backend/rpc/errors";
import { metaSchema, type MetaInput } from "@backend/schemas/planejamento";
import { createClient } from "@backend/supabase/client";

import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RefOption {
  id: number;
  nome: string;
}

// PLM-10/11. INSERT direto (fat_meta), sem RPC (AD-024, mesma razão de
// ObjetivoForm). PLM-11: campo de preditor secundário some do formulário
// quando o produto do contrato é PLL -- confirmado por Pedro (spec.md,
// classe='governanca' e preditor secundário no PLL são restrição só de UI,
// nunca de schema, AD-008).
export interface MetaFormProps {
  idObjetivo: number;
  produtoNome: string;
  onConcluido: (criado?: { idMeta: number }) => void;
  onCancelar: () => void;
}

export function MetaForm({ idObjetivo, produtoNome, onConcluido, onCancelar }: MetaFormProps) {
  const [preditores, setPreditores] = useState<RefOption[]>([]);
  const [agendas, setAgendas] = useState<RefOption[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const usaPreditorSecundario = produtoNome !== "PLL";

  const form = useForm<MetaInput>({
    resolver: zodResolver(metaSchema),
    mode: "onChange",
    defaultValues: { id_objetivo: idObjetivo, descricao: "", status: "ativa" },
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

  async function enviar(valores: MetaInput) {
    setEnviando(true);
    setErro(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("fat_meta")
      .insert({
        id_objetivo: valores.id_objetivo,
        descricao: valores.descricao,
        classe: valores.classe ?? null,
        prioridade: valores.prioridade ?? null,
        id_preditor_primario: valores.id_preditor_primario ?? null,
        id_preditor_secundario: usaPreditorSecundario ? (valores.id_preditor_secundario ?? null) : null,
        id_agenda: valores.id_agenda ?? null,
        status: valores.status,
      })
      .select("id_meta")
      .single();
    setEnviando(false);
    if (error) {
      setErro(mapeiaErroRpc(error).message);
      return;
    }
    onConcluido(data ? { idMeta: data.id_meta } : undefined);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(enviar)} className="grid gap-4 rounded-lg border p-4">
        <FormField
          control={form.control}
          name="descricao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição da Meta</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="classe"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Classe (opcional)</FormLabel>
              <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="programatica">Programática</SelectItem>
                  {/* PLM-11: PLL não tem etapa de Governança na régua -- a
                      opção some do formulário, nunca via CHECK (AD-008). */}
                  {produtoNome !== "PLL" && <SelectItem value="governanca">Governança</SelectItem>}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="prioridade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prioridade (opcional)</FormLabel>
              <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
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
        {usaPreditorSecundario && (
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
        )}
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
        {erro && <ErroInline mensagem={erro} />}
        <div className="flex gap-2">
          <Button type="submit" disabled={enviando || !form.formState.isValid}>
            {enviando ? "Salvando..." : "Criar Meta"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}
