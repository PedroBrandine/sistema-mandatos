"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  buscarEncontrosDoContrato,
  buscarTiposRegistroDaEtapa,
  type RefOption,
} from "@backend/queries/incidencia";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { registroSchema, type RegistroInput } from "@backend/schemas/registro";
import { createClient } from "@backend/supabase/client";
import { usePapelGlobal } from "@/hooks/use-papel-global";

import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const SEM_VINCULO = "_nenhum";

// INC-09, INC-10, INC-11. INSERT direto (sem RPC -- fat_registro é 1 tabela
// só, design.md Tech Decisions), inline na aba de etapa (sem Dialog -- a
// página já é dedicada, mesmo padrão de objetivo-form.tsx). id_usuario_autor
// (NOT NULL, sem RPC) vem de usePapelGlobal (T17) -- nunca digitado no
// formulário; RLS (fat_registro.WITH CHECK) rejeitaria qualquer outro valor
// mesmo que o form tentasse enviar (design.md "2º achado real de Design").
export interface RegistroFormProps {
  idContrato: number;
  idEtapa: number;
  onConcluido: () => void;
}

export function RegistroForm({ idContrato, idEtapa, onConcluido }: RegistroFormProps) {
  const { idUsuario, carregando: carregandoUsuario } = usePapelGlobal();
  const [tipos, setTipos] = useState<RefOption[]>([]);
  const [encontros, setEncontros] = useState<RefOption[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<RegistroInput>({
    resolver: zodResolver(registroSchema),
    mode: "onChange",
    defaultValues: {
      id_contrato: idContrato,
      ocorrido_em: new Date().toISOString().slice(0, 10),
    },
  });

  useEffect(() => {
    const supabase = createClient();
    void buscarTiposRegistroDaEtapa(supabase, idEtapa).then(setTipos);
    void buscarEncontrosDoContrato(supabase, idContrato).then((lista) =>
      setEncontros(lista.map((e) => ({ id: e.idEncontro, nome: e.titulo })))
    );
  }, [idContrato, idEtapa]);

  async function enviar(valores: RegistroInput) {
    if (!idUsuario) {
      setErro("Não foi possível identificar o usuário autor. Recarregue a página e tente novamente.");
      return;
    }

    setEnviando(true);
    setErro(null);
    const supabase = createClient();

    const { error } = await supabase.from("fat_registro").insert({
      id_contrato: valores.id_contrato,
      id_tipo_registro: valores.id_tipo_registro,
      nr_sequencia: valores.nr_sequencia ?? undefined,
      id_encontro: valores.id_encontro ?? undefined,
      ocorrido_em: valores.ocorrido_em,
      canal: valores.canal ?? undefined,
      resumo: valores.resumo ?? undefined,
      // conteudo: sem campo no formulário (nenhuma menção em spec.md/design.md
      // como campo de UI) -- omitido do payload, DEFAULT '{}'::jsonb da coluna
      // assume (mesmo rationale documentado em schemas/registro.ts).
      id_usuario_autor: idUsuario,
    });

    setEnviando(false);
    if (error) {
      setErro(mapeiaErroRpc(error).message);
      return;
    }

    form.reset({ id_contrato: idContrato, ocorrido_em: new Date().toISOString().slice(0, 10) });
    onConcluido();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(enviar)} className="grid gap-4 rounded-lg border p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="id_tipo_registro"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Registro</FormLabel>
                <Select value={field.value ? String(field.value) : undefined} onValueChange={(v) => field.onChange(Number(v))}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
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
            name="ocorrido_em"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ocorrido em</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          <FormField
            control={form.control}
            name="canal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Canal (opcional)</FormLabel>
                <Select
                  value={field.value ?? SEM_VINCULO}
                  onValueChange={(v) => field.onChange(v === SEM_VINCULO ? null : v)}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SEM_VINCULO}>Nenhum</SelectItem>
                    <SelectItem value="sistema">Sistema</SelectItem>
                    <SelectItem value="slack">Slack</SelectItem>
                    <SelectItem value="presencial">Presencial</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="id_encontro"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Encontro de origem (opcional)</FormLabel>
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
                    {encontros.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="resumo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Resumo (opcional)</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} rows={2} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {erro && <ErroInline mensagem={erro} />}
        <div>
          <Button type="submit" disabled={enviando || carregandoUsuario || !form.formState.isValid}>
            {enviando ? "Salvando..." : "Registrar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
