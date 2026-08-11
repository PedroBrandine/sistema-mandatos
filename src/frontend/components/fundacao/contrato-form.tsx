"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { mapeiaErroRpc } from "@backend/rpc/errors";
import { contratoSchema, type ContratoInput } from "@backend/schemas/contrato";
import { createClient } from "@backend/supabase/client";
import type { Database } from "@backend/supabase/database.types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ContratoRow = Database["public"]["Tables"]["fat_contrato"]["Row"];
interface RefOption {
  id: number;
  nome: string;
}

// Formulário de abertura ("abrir", FND-CTR-01/02/04/05) e encerramento
// ("encerrar", FND-CTR-03) de fat_contrato -- os dois `insert`/`update`
// diretos via PostgREST (design.md: sem RPC, single-table), reusando
// `contratoSchema` (T26) inteiro nos dois modos (o próprio schema já espelha
// `ck_contrato_motivo`/`ck_contrato_periodo`/`ck_contrato_nao_e_proprio_anterior`).
export type ContratoFormModo = { tipo: "abrir" } | { tipo: "encerrar"; contrato: ContratoRow };

export interface ContratoFormProps {
  idContratante: number;
  contratosExistentes: ContratoRow[];
  modo: ContratoFormModo;
  // produtoTravado (NAV-09 AC1): quando presente, o campo Produto renderiza
  // como rótulo fixo em vez de Select editável, e defaultValues.id_produto
  // já nasce com esse valor -- usado pela aba "Cadastro de novo Contrato"
  // (design.md, ContratoForm -- alterações), onde o produto já vem do slug.
  produtoTravado?: { id: number; nome: string };
  // criado (NAV-09 AC3): id_contrato criado no modo "abrir", necessário pra
  // navegar até a ficha nova. Parâmetro opcional -- compatível com os 3
  // call-sites existentes que ignoram o argumento.
  onConcluido: (criado?: { idContrato: number }) => void;
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ContratoForm({ idContratante, contratosExistentes, modo, produtoTravado, onConcluido }: ContratoFormProps) {
  const [produtos, setProdutos] = useState<RefOption[]>([]);
  const [projetos, setProjetos] = useState<RefOption[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<ContratoInput>({
    resolver: zodResolver(contratoSchema),
    mode: "onChange",
    defaultValues:
      modo.tipo === "abrir"
        ? { id_produto: produtoTravado?.id ?? 0, dt_inicio: hoje(), status: "ativo" }
        : {
            id_contrato: modo.contrato.id_contrato,
            id_produto: modo.contrato.id_produto,
            id_projeto: modo.contrato.id_projeto,
            id_contrato_anterior: modo.contrato.id_contrato_anterior,
            dt_inicio: modo.contrato.dt_inicio,
            status: modo.contrato.status === "ativo" ? "concluido" : (modo.contrato.status as ContratoInput["status"]),
            motivo_encerramento: modo.contrato.motivo_encerramento,
            dt_fim: modo.contrato.dt_fim ?? hoje(),
          },
  });

  useEffect(() => {
    if (modo.tipo !== "abrir") return;
    const supabase = createClient();
    supabase
      .from("ref_produto")
      .select("id_produto, nome")
      .eq("ativo", true)
      .then(({ data }) => setProdutos((data ?? []).map((p) => ({ id: p.id_produto, nome: p.nome }))));
    supabase
      .from("ref_projeto")
      .select("id_projeto, nome")
      .eq("ativo", true)
      .then(({ data }) => setProjetos((data ?? []).map((p) => ({ id: p.id_projeto, nome: p.nome }))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo.tipo]);

  async function enviar(valores: ContratoInput) {
    setEnviando(true);
    setErro(null);
    const supabase = createClient();

    if (modo.tipo === "abrir") {
      const { data, error } = await supabase
        .from("fat_contrato")
        .insert({
          id_contratante: idContratante,
          id_produto: valores.id_produto,
          id_projeto: valores.id_projeto ?? null,
          id_contrato_anterior: valores.id_contrato_anterior ?? null,
          dt_inicio: valores.dt_inicio,
          status: "ativo",
        })
        .select("id_contrato")
        .single();
      setEnviando(false);
      if (error) {
        setErro(mapeiaErroRpc(error).message);
        return;
      }
      onConcluido(data ? { idContrato: data.id_contrato } : undefined);
      return;
    } else {
      const { error } = await supabase
        .from("fat_contrato")
        .update({
          status: valores.status,
          motivo_encerramento: valores.motivo_encerramento ?? null,
          dt_fim: valores.dt_fim,
        })
        .eq("id_contrato", modo.contrato.id_contrato);
      setEnviando(false);
      if (error) {
        setErro(mapeiaErroRpc(error).message);
        return;
      }
    }
    onConcluido();
  }

  if (modo.tipo === "abrir") {
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(enviar)} className="grid gap-4">
          <FormField
            control={form.control}
            name="id_produto"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Produto</FormLabel>
                {produtoTravado ? (
                  <div>
                    <Badge variant="secondary">{produtoTravado.nome}</Badge>
                  </div>
                ) : (
                  <Select
                    value={field.value ? String(field.value) : undefined}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {produtos.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="id_projeto"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Projeto (opcional)</FormLabel>
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
                    {projetos.map((p) => (
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
            name="id_contrato_anterior"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contrato anterior (opcional)</FormLabel>
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
                    {/* FND-CTR-02: lista só contratos do mesmo contratante -- contratosExistentes
                        já vem filtrado pela página (eq id_contratante). */}
                    {contratosExistentes.map((c) => (
                      <SelectItem key={c.id_contrato} value={String(c.id_contrato)}>
                        Contrato #{c.id_contrato} ({c.dt_inicio})
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
            name="dt_inicio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de início</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {erro && <p className="text-sm text-red-500">{erro}</p>}
          <Button type="submit" disabled={enviando} className="w-fit">
            {enviando ? "Salvando..." : "Abrir contrato"}
          </Button>
        </form>
      </Form>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(enviar)} className="grid gap-4">
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status de encerramento</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="nao_concluido">Não concluído</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="motivo_encerramento"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Motivo do encerramento</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dt_fim"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data de fim</FormLabel>
              <FormControl>
                <Input type="date" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {erro && <p className="text-sm text-red-500">{erro}</p>}
        {/* FND-CTR-03: status='nao_concluido' exige motivo_encerramento --
            contratoSchema (T26) já espelha ck_contrato_motivo via .refine(),
            então form.formState.isValid já reflete essa exigência; o submit
            fica desabilitado até o formulário (incluindo o motivo, quando
            exigido) ficar válido. */}
        <Button type="submit" disabled={enviando || !form.formState.isValid} className="w-fit">
          {enviando ? "Salvando..." : "Encerrar contrato"}
        </Button>
      </form>
    </Form>
  );
}
