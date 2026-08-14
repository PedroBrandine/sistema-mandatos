"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { mapeiaErroRpc } from "@backend/rpc/errors";
import { encontroSchema, type EncontroInput } from "@backend/schemas/encontro";
import { createClient } from "@backend/supabase/client";

import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SEM_VINCULO = "_nenhum";

interface TipoRegistroOption {
  id: number;
  nome: string;
}

// INC-15, INC-17. INSERT direto (sem RPC -- fat_encontro é 1 tabela só,
// design.md Tech Decisions), componente burro quanto a Dialog (mesmo padrão
// de FatoGeradorForm/InsightForm). status/datas condicionais espelham
// ck_encontro_planejado/ck_encontro_realizado (encontroSchema.refine).
export interface EncontroFormProps {
  idContrato: number;
  onConcluido: (criado?: { idEncontro: number }) => void;
  onCancelar: () => void;
}

export function EncontroForm({ idContrato, onConcluido, onCancelar }: EncontroFormProps) {
  const [tipos, setTipos] = useState<TipoRegistroOption[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<EncontroInput>({
    resolver: zodResolver(encontroSchema),
    mode: "onChange",
    defaultValues: { id_contrato: idContrato, titulo: "", status: "planejado" },
  });

  const status = form.watch("status");

  useEffect(() => {
    // id_tipo_registro do Encontro não é escopado a 1 etapa (ao contrário do
    // Registro) -- Encontro pode ocorrer em qualquer momento do ciclo, lista
    // todos os tipos ativos (fetch inline, mesmo padrão de ref_preditor em
    // objetivo-form.tsx).
    const supabase = createClient();
    supabase
      .from("ref_tipo_registro")
      .select("id_tipo_registro, nome")
      .eq("ativo", true)
      .then(({ data }) => setTipos((data ?? []).map((t) => ({ id: t.id_tipo_registro, nome: t.nome }))));
  }, []);

  async function enviar(valores: EncontroInput) {
    setEnviando(true);
    setErro(null);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("fat_encontro")
      .insert({
        id_contrato: valores.id_contrato,
        id_tipo_registro: valores.id_tipo_registro ?? undefined,
        nr_sequencia: valores.nr_sequencia ?? undefined,
        titulo: valores.titulo,
        status: valores.status,
        dt_prevista_inicio: valores.dt_prevista_inicio ?? undefined,
        dt_prevista_fim: valores.dt_prevista_fim ?? undefined,
        dt_realizada: valores.dt_realizada ?? undefined,
        modalidade: valores.modalidade ?? undefined,
        local: valores.local ?? undefined,
      })
      .select("id_encontro")
      .single();

    setEnviando(false);
    if (error) {
      setErro(mapeiaErroRpc(error).message);
      return;
    }

    onConcluido(data ? { idEncontro: data.id_encontro } : undefined);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(enviar)} className="grid gap-4">
        <FormField
          control={form.control}
          name="titulo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    <SelectItem value="planejado">Planejado</SelectItem>
                    <SelectItem value="realizado">Realizado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                    <SelectItem value="remarcado">Remarcado</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="modalidade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Modalidade (opcional)</FormLabel>
                <Select
                  value={field.value ?? SEM_VINCULO}
                  onValueChange={(v) => field.onChange(v === SEM_VINCULO ? null : v)}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SEM_VINCULO}>Nenhuma</SelectItem>
                    <SelectItem value="presencial">Presencial</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="dt_prevista_inicio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Data prevista de início{status === "planejado" ? "" : " (opcional)"}
                </FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dt_prevista_fim"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data prevista de fim (opcional)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="dt_realizada"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data de realização{status === "realizado" ? "" : " (opcional)"}</FormLabel>
              <FormControl>
                <Input type="date" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="local"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Local (opcional)</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="id_tipo_registro"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo (opcional)</FormLabel>
                <Select
                  value={field.value ? String(field.value) : SEM_VINCULO}
                  onValueChange={(v) => field.onChange(v === SEM_VINCULO ? null : Number(v))}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SEM_VINCULO}>Nenhum</SelectItem>
                    {tipos.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.nome}
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
            name="nr_sequencia"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nº sequência (opcional)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {erro && <ErroInline mensagem={erro} />}
        <div className="flex gap-2">
          <Button type="submit" disabled={enviando || !form.formState.isValid}>
            {enviando ? "Salvando..." : "Criar Encontro"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}
